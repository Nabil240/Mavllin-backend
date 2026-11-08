import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page container">
      <div class="auth-card">
        <div class="auth-head">
          <span class="auth-kicker">{{ isAdminRoute() ? 'BACKOFFICE ACCESS' : 'CLIENT ATELIER ACCOUNT' }}</span>
          <h1 class="section-heading">{{ isAdminRoute() ? 'ADMIN SIGN IN' : 'WELCOME BACK' }}</h1>
          <p class="section-subtitle">
            {{ isAdminRoute() ? 'Sign in with administrator credentials to manage catalog, stock & orders.' : 'Sign in to access saved addresses, order history, and your wishlist.' }}
          </p>
        </div>

        <!-- 1-Click Demo Quick-Fill Buttons -->
        <div class="demo-box">
          <span class="demo-label">Instant Demo Credentials:</span>
          <div class="demo-btns">
            <button type="button" class="btn btn-secondary btn-sm" (click)="fillDemo('customer')">
              Fill Demo Customer
            </button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="fillDemo('admin')">
              Fill Demo Admin
            </button>
          </div>
          <div class="demo-hint">
            Admin: <code>admin&#64;shop.com</code> / <code>Admin&#64;2026</code> &bull;
            User: <code>user&#64;shop.com</code> / <code>User&#64;2026</code>
          </div>
        </div>

        @if (errorMsg()) {
          <div class="error-banner" role="alert">{{ errorMsg() }}</div>
        }

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label class="form-label" for="loginEmail">Email Address</label>
            <input
              id="loginEmail"
              type="email"
              name="email"
              class="form-control"
              [value]="emailSig()"
              (input)="onEmailInput($event)"
              [placeholder]="isAdminRoute() ? 'admin@shop.com' : 'user@shop.com'"
              autocomplete="username"
              required
            />
          </div>

          <div class="form-group">
            <div class="label-row">
              <label class="form-label" for="loginPassword">Password</label>
              <div class="pw-links">
                <button type="button" class="toggle-pw-btn" (click)="showPassword.set(!showPassword())">
                  {{ showPassword() ? 'Hide' : 'Show' }}
                </button>
                <a routerLink="/auth/forgot-password" class="forgot-link">Forgot Password?</a>
              </div>
            </div>
            <input
              id="loginPassword"
              [type]="showPassword() ? 'text' : 'password'"
              name="password"
              class="form-control"
              [value]="passwordSig()"
              (input)="onPasswordInput($event)"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg" [disabled]="auth.loading()">
            {{ auth.loading() ? 'Signing In...' : 'Sign In' }}
          </button>
        </form>

        <div class="auth-footer">
          <p>
            New to MAVLLIN?
            <a routerLink="/auth/register">Create a Client Account</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      padding-top: 3.5rem;
      padding-bottom: 4rem;
      display: flex;
      justify-content: center;
    }
    .auth-card {
      width: 100%;
      max-width: 460px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 2.25rem;
      background: var(--color-white);
    }
    .auth-head {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .auth-kicker {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: var(--color-text-light);
    }
    .demo-box {
      background: var(--color-alabaster);
      border: 1px dashed var(--color-border-dark);
      border-radius: var(--radius-sm);
      padding: 0.85rem;
      margin-bottom: 1.5rem;
      text-align: center;
    }
    .demo-label {
      display: block;
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.5rem;
      color: var(--color-text-muted);
    }
    .demo-btns {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
    }
    .demo-hint {
      margin-top: 0.6rem;
      font-size: 0.72rem;
      color: var(--color-text-muted);
      line-height: 1.5;
      code {
        font-weight: 700;
        color: var(--color-onyx);
      }
    }
    .error-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      border-radius: var(--radius-sm);
      padding: 0.75rem 0.9rem;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 1.15rem;
    }
    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pw-links {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .toggle-pw-btn {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--color-onyx);
      text-decoration: underline;
      cursor: pointer;
    }
    .forgot-link {
      font-size: 0.76rem;
      color: var(--color-text-muted);
      text-decoration: underline;
    }
    .auth-footer {
      margin-top: 1.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--color-border);
      text-align: center;
      font-size: 0.85rem;
      a {
        font-weight: 700;
        text-decoration: underline;
        margin-left: 0.25rem;
      }
    }
  `],
})
export class LoginComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isAdminRoute = signal<boolean>(false);
  readonly emailSig = signal<string>('');
  readonly passwordSig = signal<string>('');
  readonly showPassword = signal<boolean>(false);
  readonly errorMsg = signal<string>('');
  private returnUrl = '';

  get email(): string {
    return this.emailSig();
  }
  set email(val: string) {
    this.emailSig.set(val);
  }

  get password(): string {
    return this.passwordSig();
  }
  set password(val: string) {
    this.passwordSig.set(val);
  }

  ngOnInit(): void {
    this.isAdminRoute.set(this.router.url.includes('/admin/login'));
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '';
  }

  onEmailInput(event: Event): void {
    this.errorMsg.set('');
    this.emailSig.set((event.target as HTMLInputElement).value);
  }

  onPasswordInput(event: Event): void {
    this.errorMsg.set('');
    this.passwordSig.set((event.target as HTMLInputElement).value);
  }

  fillDemo(role: 'customer' | 'admin'): void {
    this.errorMsg.set('');
    if (role === 'admin') {
      this.emailSig.set('admin@shop.com');
      this.passwordSig.set('Admin@2026');
    } else {
      this.emailSig.set('user@shop.com');
      this.passwordSig.set('User@2026');
    }
  }

  onSubmit(): void {
    const cleanEmail = this.emailSig().trim();
    const rawPassword = this.passwordSig();
    if (!cleanEmail || !rawPassword) return;
    this.errorMsg.set('');
    this.auth.clearSession();
    this.auth.login({ email: cleanEmail, password: rawPassword }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          if (this.isAdminRoute() && res.data.user.role !== 'admin' && res.data.user.role !== 'staff') {
            this.auth.clearSession();
            const msg = 'Administrator privileges required to access backoffice.';
            this.errorMsg.set(msg);
            this.toast.error(msg);
            return;
          }
          this.toast.success(`Welcome back, ${res.data.user.full_name}!`);
          if (this.returnUrl) {
            this.router.navigateByUrl(this.returnUrl);
          } else if (res.data.user.role === 'admin' || res.data.user.role === 'staff') {
            this.router.navigate(['/admin/dashboard']);
          } else {
            this.router.navigate(['/account/orders']);
          }
        }
      },
      error: (err) => {
        const msg = err?.error?.message || 'Invalid email or password.';
        this.errorMsg.set(msg);
        this.toast.error(msg);
      },
    });
  }
}
