import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard, adminGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { User } from '../models/api.models';

describe('Auth & Admin Guards', () => {
  let authService: AuthService;
  let router: Router;
  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = { url: '/account/orders' } as RouterStateSnapshot;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideRouter([])],
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    it('should allow access when user is authenticated', () => {
      authService.token.set('fake-jwt-token');
      authService.user.set({
        id: 1,
        full_name: 'Test Customer',
        email: 'customer@mavllin.com',
        role: 'customer',
        is_active: 1,
      });

      const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
      expect(result).toBe(true);
    });

    it('should redirect unauthenticated users to /auth/login with returnUrl', () => {
      authService.clearSession();

      const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
      expect(result).not.toBe(true);
      expect(result.toString()).toContain('/auth/login');
      expect(result.toString()).toContain('returnUrl=%2Faccount%2Forders');
    });
  });

  describe('adminGuard', () => {
    it('should allow access when user is admin', () => {
      authService.token.set('admin-jwt-token');
      authService.user.set({
        id: 99,
        full_name: 'Admin User',
        email: 'admin@mavllin.com',
        role: 'admin',
        is_active: 1,
      });

      const adminState = { url: '/admin/dashboard' } as RouterStateSnapshot;
      const result = TestBed.runInInjectionContext(() => adminGuard(mockRoute, adminState));
      expect(result).toBe(true);
    });

    it('should block regular customer from admin routes and redirect to /admin/login', () => {
      authService.token.set('customer-jwt-token');
      authService.user.set({
        id: 1,
        full_name: 'Regular Customer',
        email: 'customer@mavllin.com',
        role: 'customer',
        is_active: 1,
      });

      const adminState = { url: '/admin/dashboard' } as RouterStateSnapshot;
      const result = TestBed.runInInjectionContext(() => adminGuard(mockRoute, adminState));
      expect(result).not.toBe(true);
      expect(result.toString()).toContain('/admin/login');
    });
  });
});
