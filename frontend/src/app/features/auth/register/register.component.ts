import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page container">
      <div class="auth-card">
        <div class="auth-head">
          <span class="auth-kicker">JOIN ECO STUDIO</span>
          <h1 class="section-heading">CREATE CLIENT ACCOUNT</h1>
          <p class="section-subtitle">
            Save delivery addresses, track orders, and enjoy seamless checkout.
          </p>
        </div>

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label class="form-label" for="regName">Full Name *</label>
            <input
              id="regName"
              type="text"
              name="fullName"
              class="form-control"
              [(ngModel)]="fullName"
              placeholder="Nabil Rahman"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="regEmail">Email Address *</label>
            <input
              id="regEmail"
              type="email"
              name="email"
              class="form-control"
              [(ngModel)]="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="regPhone">Mobile Number</label>
            <input
              id="regPhone"
              type="tel"
              name="phone"
              class="form-control"
              [(ngModel)]="phone"
              placeholder="+880 1711-000000"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="regPassword">Password (min 8 chars, 1 uppercase &amp; 1 number) *</label>
            <input
              id="regPassword"
              type="password"
              name="password"
              class="form-control"
              [(ngModel)]="password"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg" [disabled]="auth.loading()">
            {{ auth.loading() ? 'Creating Account...' : 'Create Account' }}
          </button>
        </form>

        <div class="auth-footer">
          <p>
            Already have an account?
            <a routerLink="/auth/login">Sign In</a>
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
      margin-bottom: 1.75rem;
    }
    .auth-kicker {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: var(--color-text-light);
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
export class RegisterComponent {
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  fullName = '';
  email = '';
  phone = '';
  password = '';

  onSubmit(): void {
    if (!this.fullName.trim() || !this.email.trim() || !this.password) return;
    this.auth
      .register({
        full_name: this.fullName.trim(),
        email: this.email.trim(),
        phone: this.phone.trim() || undefined,
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.toast.success('Account created! Welcome to ECO STUDIO.');
            this.router.navigate(['/account']);
          }
        },
        error: (err) => {
          this.toast.error(err?.error?.message || 'Registration failed. Check password requirements.');
        },
      });
  }
}
