import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page container">
      <div class="auth-card">
        @if (!resetMode()) {
          <div class="auth-head">
            <h1 class="section-heading">PASSWORD RECOVERY</h1>
            <p class="section-subtitle">
              Enter your registered email address to generate a password reset token.
            </p>
          </div>

          <form (ngSubmit)="onRequestReset()">
            <div class="form-group">
              <label class="form-label" for="recEmail">Email Address</label>
              <input
                id="recEmail"
                type="email"
                name="email"
                class="form-control"
                [(ngModel)]="email"
                placeholder="customer@projecteco.com"
                required
              />
            </div>

            <button type="submit" class="btn btn-primary btn-block">
              Send Reset Instructions
            </button>
          </form>

          @if (generatedToken()) {
            <div class="token-preview">
              <strong>Demo Reset Token Generated:</strong>
              <code>{{ generatedToken() }}</code>
              <button type="button" class="btn btn-outline btn-sm" (click)="switchToResetWithToken()">
                Proceed to Reset Password &rarr;
              </button>
            </div>
          }
        } @else {
          <div class="auth-head">
            <h1 class="section-heading">SET NEW PASSWORD</h1>
            <p class="section-subtitle">Enter your reset token and choose a new password.</p>
          </div>

          <form (ngSubmit)="onResetPassword()">
            <div class="form-group">
              <label class="form-label" for="resetToken">Reset Token</label>
              <input
                id="resetToken"
                type="text"
                name="token"
                class="form-control"
                [(ngModel)]="token"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="newPass">New Password</label>
              <input
                id="newPass"
                type="password"
                name="newPassword"
                class="form-control"
                [(ngModel)]="newPassword"
                placeholder="Min 8 chars, 1 uppercase & 1 number"
                required
              />
            </div>

            <button type="submit" class="btn btn-primary btn-block">
              Update Password
            </button>
          </form>
        }

        <div class="auth-footer">
          <a routerLink="/auth/login">&larr; Back to Sign In</a>
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
    .token-preview {
      margin-top: 1.25rem;
      padding: 1rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.8rem;
      code {
        word-break: break-all;
        background: var(--color-white);
        padding: 0.4rem;
        border: 1px solid var(--color-border);
      }
    }
    .auth-footer {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border);
      text-align: center;
      font-size: 0.85rem;
    }
  `],
})
export class ForgotPasswordComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly resetMode = signal<boolean>(false);
  readonly generatedToken = signal<string>('');

  email = '';
  token = '';
  newPassword = '';

  ngOnInit(): void {
    if (this.router.url.includes('reset-password')) {
      this.resetMode.set(true);
    }
    const qToken = this.route.snapshot.queryParamMap.get('token');
    if (qToken) {
      this.token = qToken;
      this.resetMode.set(true);
    }
  }

  onRequestReset(): void {
    if (!this.email.trim()) return;
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: (res) => {
        this.toast.success(res.message || 'Password reset token generated.');
        if (res.data?.resetToken) {
          this.generatedToken.set(res.data.resetToken);
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Unable to process request.');
      },
    });
  }

  switchToResetWithToken(): void {
    this.token = this.generatedToken();
    this.resetMode.set(true);
  }

  onResetPassword(): void {
    if (!this.token.trim() || !this.newPassword) return;
    this.auth.resetPassword({ token: this.token.trim(), newPassword: this.newPassword }).subscribe({
      next: () => {
        this.toast.success('Password updated! Please sign in.');
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Reset token invalid or expired.');
      },
    });
  }
}
