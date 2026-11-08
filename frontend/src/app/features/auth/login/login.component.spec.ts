import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

describe('LoginComponent', () => {
  let fixture: any;
  let component: LoginComponent;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should instantiate LoginComponent', () => {
    expect(component).toBeTruthy();
    expect(component.email).toBe('');
    expect(component.password).toBe('');
  });

  it('should fill demo credentials for customer and admin', () => {
    component.fillDemo('customer');
    expect(component.email).toBe('user@shop.com');
    expect(component.password).toBe('User@2026');

    component.fillDemo('admin');
    expect(component.email).toBe('admin@shop.com');
    expect(component.password).toBe('Admin@2026');
  });

  it('should call AuthService.login and navigate customer to /account/orders on success', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    vi.spyOn(authService, 'login').mockReturnValue(
      of({
        success: true,
        message: 'Login successful',
        data: {
          token: 'jwt-customer-token',
          user: {
            id: 10,
            full_name: 'Jane Doe',
            email: 'customer@mavllin.com',
            role: 'customer',
            is_active: 1,
          },
        },
      })
    );

    component.email = 'customer@mavllin.com';
    component.password = 'Customer@123';
    component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith({
      email: 'customer@mavllin.com',
      password: 'Customer@123',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/account/orders']);
  });

  it('should navigate admin user to /admin/dashboard on login', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    vi.spyOn(authService, 'login').mockReturnValue(
      of({
        success: true,
        message: 'Login successful',
        data: {
          token: 'jwt-admin-token',
          user: {
            id: 1,
            full_name: 'Atelier Admin',
            email: 'admin@mavllin.com',
            role: 'admin',
            is_active: 1,
          },
        },
      })
    );

    component.email = 'admin@mavllin.com';
    component.password = 'Admin@123';
    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('should display error toast on invalid credentials', () => {
    const toast = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toast, 'error');
    vi.spyOn(authService, 'login').mockReturnValue(
      throwError(() => ({ error: { message: 'Invalid credentials.' } }))
    );

    component.email = 'wrong@eco.com';
    component.password = 'badpass';
    component.onSubmit();

    expect(toastSpy).toHaveBeenCalledWith('Invalid credentials.');
  });
});
