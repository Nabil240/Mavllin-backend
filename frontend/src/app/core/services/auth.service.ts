import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';
import { ApiResponse, User } from '../models/api.models';
import { ToastService } from './toast.service';

const TOKEN_KEY = 'mavllin_auth_token';
const USER_KEY = 'mavllin_auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly user = signal<User | null>(this.loadStoredUser());
  readonly token = signal<string | null>(this.loadStoredToken());
  readonly loading = signal<boolean>(false);

  readonly isAuthenticated = computed(() => !!this.token() && !!this.user());
  readonly isAdmin = computed(() => {
    const u = this.user();
    return !!u && (u.role === 'admin' || u.role === 'staff');
  });

  private loadStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private loadStoredUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private persistSession(token: string, user: User): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // ignore storage errors
    }
    this.token.set(token);
    this.user.set(user);
  }

  clearSession(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
    this.token.set(null);
    this.user.set(null);
  }

  login(credentials: { email: string; password: string }): Observable<ApiResponse<{ user: User; token: string }>> {
    this.loading.set(true);
    return this.http.post<ApiResponse<{ user: User; token: string }>>('/api/v1/auth/login', credentials).pipe(
      tap({
        next: (res) => {
          this.loading.set(false);
          if (res.success && res.data) {
            this.persistSession(res.data.token, res.data.user);
          }
        },
        error: () => this.loading.set(false),
      })
    );
  }

  register(payload: {
    full_name: string;
    email: string;
    password: string;
    phone?: string;
  }): Observable<ApiResponse<{ user: User; token: string }>> {
    this.loading.set(true);
    return this.http.post<ApiResponse<{ user: User; token: string }>>('/api/v1/auth/register', payload).pipe(
      tap({
        next: (res) => {
          this.loading.set(false);
          if (res.success && res.data) {
            this.persistSession(res.data.token, res.data.user);
          }
        },
        error: () => this.loading.set(false),
      })
    );
  }

  logout(redirectUrl = '/'): void {
    if (this.token()) {
      this.http.post('/api/v1/auth/logout', {}).pipe(catchError(() => of(null))).subscribe();
    }
    this.clearSession();
    this.toast.info('You have been signed out.');
    this.router.navigateByUrl(redirectUrl);
  }

  refreshProfile(): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>('/api/v1/auth/me').pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.user.set(res.data);
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(res.data));
          } catch {
            // ignore
          }
        }
      })
    );
  }

  updateProfile(payload: { full_name: string; phone?: string }): Observable<ApiResponse<User>> {
    return this.http.put<ApiResponse<User>>('/api/v1/auth/profile', payload).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.user.set(res.data);
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(res.data));
          } catch {
            // ignore
          }
        }
      })
    );
  }

  changePassword(payload: { currentPassword: string; newPassword: string }): Observable<ApiResponse<null>> {
    return this.http.put<ApiResponse<null>>('/api/v1/auth/change-password', payload);
  }

  forgotPassword(email: string): Observable<ApiResponse<{ resetToken?: string; message?: string }>> {
    return this.http.post<ApiResponse<{ resetToken?: string; message?: string }>>('/api/v1/auth/forgot-password', {
      email,
    });
  }

  resetPassword(payload: { token: string; newPassword: string }): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>('/api/v1/auth/reset-password', payload);
  }
}
