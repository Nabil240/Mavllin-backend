import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (t of toastService.toasts(); track t.id) {
        <div class="toast-item" [class]="'toast-' + t.type" (click)="toastService.dismiss(t.id)">
          <div class="toast-indicator"></div>
          <div class="toast-content">
            @if (t.title) {
              <div class="toast-title">{{ t.title }}</div>
            }
            <div class="toast-msg">{{ t.message }}</div>
          </div>
          <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      max-width: 360px;
      width: calc(100vw - 2.5rem);
      pointer-events: none;
    }
    .toast-item {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      background: var(--color-onyx);
      color: var(--color-white);
      padding: 0.875rem 1rem;
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      cursor: pointer;
      animation: slideIn 200ms cubic-bezier(0.16, 1, 0.3, 1);
      border-left: 4px solid var(--color-white);
    }
    .toast-success { border-left-color: var(--color-emerald); }
    .toast-error { border-left-color: var(--color-berry); }
    .toast-info { border-left-color: var(--color-gold); }
    .toast-content { flex: 1; }
    .toast-title {
      font-family: var(--font-display);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.8;
      margin-bottom: 0.15rem;
    }
    .toast-msg {
      font-size: 0.85rem;
      line-height: 1.4;
    }
    .toast-close {
      color: rgba(255, 255, 255, 0.7);
      font-size: 1.15rem;
      line-height: 1;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(24px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `],
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
}
