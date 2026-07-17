export interface PaisResponse {
  idPais: number;
  nombrePais: string;
}

export interface UserResponse {
  idUsuario: number;
  nombres: string;
  apellidos: string;
  correo: string;
  fechaNacimiento: string;
  idPais?: number;
  nombrePais?: string;
  fechaRegistro: string;
  estadoCuenta: boolean;
  roles: string[];
  permisos?: string[];
  dosFactoresHabilitado: boolean;
}

export interface CreateUserRequest {
  nombres: string;
  apellidos: string;
  correo: string;
  contrasena: string;
  fechaNacimiento?: string;
  idPais?: number;
  roles?: string[];
  estadoCuenta?: boolean;
}

export interface AdminUpdateUserRequest {
  nombres?: string;
  apellidos?: string;
  fechaNacimiento?: string;
  idPais?: number;
  estadoCuenta?: boolean;
  roles?: string[];
  dosFactoresHabilitado?: boolean;
}

export interface UpdateUserRequest {
  nombres?: string;
  apellidos?: string;
  fechaNacimiento?: string;
  idPais?: number;
}

export interface ChangePasswordRequest {
  contrasenaActual: string;
  nuevaContrasena: string;
}

export interface AssignRolesRequest {
  roles: string[];
}

export interface ChangeEstadoRequest {
  estadoCuenta: boolean;
}

export interface PagedResponse<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export type UserRole = 'ADMINISTRADOR' | 'ADMIN' | 'CREADOR' | 'CLIENTE' | 'MODERADOR' | 'SOPORTE' | 'AUDITOR_FINANCIERO';
export type UserStatus = 'Activo' | 'Pendiente' | 'Suspendido';
