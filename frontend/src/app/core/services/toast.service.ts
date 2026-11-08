import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);
  private nextId = 1;

  show(message: string, type: 'success' | 'error' | 'info' = 'info', title?: string): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, type, title, message }]);

    setTimeout(() => {
      this.dismiss(id);
    }, 4000);
  }

  success(message: string, title = 'Success'): void {
    this.show(message, 'success', title);
  }

  error(message: string, title = 'Error'): void {
    this.show(message, 'error', title);
  }

  info(message: string, title = 'Notice'): void {
    this.show(message, 'info', title);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
