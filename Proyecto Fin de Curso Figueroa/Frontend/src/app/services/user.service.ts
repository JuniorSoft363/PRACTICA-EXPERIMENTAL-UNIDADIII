import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserResponse, UpdateUserRequest, ChangePasswordRequest } from '../models/user.model';
import { MessageResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/usuarios`;

  getCurrentUser(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.apiUrl}/me`);
  }

  updateCurrentUser(request: UpdateUserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.apiUrl}/me`, request);
  }

  changePassword(request: ChangePasswordRequest): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.apiUrl}/me/password`, request);
  }

  deleteOwnAccount(): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.apiUrl}/me`);
  }

  revokeAllMySessions(): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.apiUrl}/me/sesiones`);
  }
}
