import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserResponse } from '../../../models/user.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly isLoading = signal<boolean>(true);
  readonly isSubmitting = signal<boolean>(false);
  readonly userProfile = signal<UserResponse | null>(null);

  readonly showPasswordModal = signal<boolean>(false);
  readonly showDisable2FaModal = signal<boolean>(false);

  passwordForm: FormGroup = this.fb.group({
    contrasenaActual: ['', Validators.required],
    nuevaContrasena: ['', [Validators.required, Validators.minLength(8)]]
  });

  disable2FaForm: FormGroup = this.fb.group({
    codigo: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]]
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    this.userService.getCurrentUser().subscribe({
      next: (profile) => {
        this.userProfile.set(profile);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.error('Error al cargar la información del perfil');
        this.isLoading.set(false);
      }
    });
  }

  toggle2FA(): void {
    const current = this.userProfile()?.dosFactoresHabilitado;
    if (!current) {
      // Iniciar configuración de 2FA
      this.router.navigate(['/profile/2fa-setup']);
    } else {
      // Abrir modal para confirmar desactivación
      this.disable2FaForm.reset();
      this.showDisable2FaModal.set(true);
    }
  }

  confirmDisable2FA(): void {
    if (this.disable2FaForm.invalid) {
      this.disable2FaForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const { codigo } = this.disable2FaForm.getRawValue();
    this.authService.disable2fa({ codigo }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.showDisable2FaModal.set(false);
        this.toastService.success(res.message || '2FA desactivado correctamente');
        this.loadProfile();
      },
      error: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  openPasswordModal(): void {
    this.passwordForm.reset();
    this.showPasswordModal.set(true);
  }

  submitChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.userService.changePassword(this.passwordForm.getRawValue()).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.showPasswordModal.set(false);
        this.toastService.success(res.message || 'Contraseña cambiada exitosamente');
      },
      error: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  revokeAllSessions(): void {
    this.isSubmitting.set(true);
    this.userService.revokeAllMySessions().subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.toastService.success(res.message || 'Todas las sesiones fueron cerradas.');
      },
      error: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  savePreferences(): void {
    this.toastService.success('Preferencias de notificación guardadas');
  }
}
