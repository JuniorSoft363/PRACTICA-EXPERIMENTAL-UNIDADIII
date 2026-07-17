import { Routes } from '@angular/router';
import { guestGuard } from './core/guards/guest.guard';
import { authGuard } from './core/guards/auth.guard';
import { hasPermissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: 'forgot-password', loadComponent: () => import('./pages/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
      { path: 'reset-password', loadComponent: () => import('./pages/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
      { path: 'two-factor', loadComponent: () => import('./pages/auth/two-factor/two-factor.component').then(m => m.TwoFactorComponent) }
    ]
  },
  {
    path: 'profile/2fa-setup',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/auth/two-factor-setup/two-factor-setup.component').then(m => m.TwoFactorSetupComponent)
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    data: { roles: ['ADMINISTRADOR', 'ADMIN', 'MODERADOR', 'SOPORTE', 'AUDITOR_FINANCIERO'] },
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      { path: 'users', loadComponent: () => import('./pages/admin/users/users.component').then(m => m.UsersComponent) },
      { 
        path: 'roles-permissions', 
        canActivate: [hasPermissionGuard('ROL_GESTIONAR')],
        loadComponent: () => import('./pages/admin/roles-permissions/roles-permissions.component').then(m => m.RolesPermissionsComponent) 
      },
      { path: 'settings', loadComponent: () => import('./pages/admin/settings/settings.component').then(m => m.SettingsComponent) }
    ]
  },
  {
    path: 'no-autorizado',
    loadComponent: () => import('./pages/public/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
  },
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth/login' }
];
