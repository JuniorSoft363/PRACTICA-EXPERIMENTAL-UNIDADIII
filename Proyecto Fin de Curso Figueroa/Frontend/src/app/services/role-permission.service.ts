import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MessageResponse } from '../models/auth.model';

export interface RolMatrixResponse {
  idRol: number;
  nombreRol: string;
  descripcionRol: string;
  permisos: string[];
}

export interface PermisoCatalogResponse {
  idPermiso: number;
  nombrePermiso: string;
  moduloAplicacion: string;
}

export interface SyncPermissionsRequest {
  roleName: string;
  permissionCodes: string[];
}

export interface CreateRoleRequest {
  nombreRol: string;
  descripcionRol?: string;
  permisosIniciales?: string[];
}

export interface UpdateRoleRequest {
  descripcionRol?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RolePermissionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/admin/role-permissions`;

  getAllRoles(): Observable<RolMatrixResponse[]> {
    return this.http.get<RolMatrixResponse[]>(`${this.apiUrl}/roles`);
  }

  getAllPermisos(): Observable<PermisoCatalogResponse[]> {
    return this.http.get<PermisoCatalogResponse[]>(`${this.apiUrl}/permisos`);
  }

  getPermissionsByRole(roleName: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/${roleName}`);
  }

  syncPermissions(request: SyncPermissionsRequest): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.apiUrl}/sync`, request);
  }

  createRole(request: CreateRoleRequest): Observable<RolMatrixResponse> {
    return this.http.post<RolMatrixResponse>(`${this.apiUrl}/roles`, request);
  }

  updateRole(idRol: number, request: UpdateRoleRequest): Observable<RolMatrixResponse> {
    return this.http.put<RolMatrixResponse>(`${this.apiUrl}/roles/${idRol}`, request);
  }

  deleteRole(idRol: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.apiUrl}/roles/${idRol}`);
  }
}
