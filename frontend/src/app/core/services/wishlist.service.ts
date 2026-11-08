import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { ApiResponse, Product } from '../models/api.models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

const GUEST_WISHLIST_KEY = 'mavllin_guest_wishlist_v1';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly items = signal<Product[]>(this.readGuestWishlist());
  readonly count = computed(() => this.items().length);
  readonly productIds = computed(() => new Set(this.items().map((p) => Number(p.id))));

  private lastUserId: number | null = null;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      const uid = user ? user.id : null;
      if (uid !== this.lastUserId) {
        this.lastUserId = uid;
        if (uid) {
          this.loadWishlist();
        } else {
          this.items.set(this.readGuestWishlist());
        }
      }
    });
  }

  private readGuestWishlist(): Product[] {
    try {
      const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeGuestWishlist(list: Product[]): void {
    try {
      localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.items.set(list);
  }

  loadWishlist(): void {
    if (!this.auth.isAuthenticated()) {
      this.items.set(this.readGuestWishlist());
      return;
    }
    this.http
      .get<ApiResponse<Product[]>>('/api/v1/wishlist')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res?.success && Array.isArray(res.data)) {
          this.items.set(res.data);
        }
      });
  }

  isWishlisted(productId: number): boolean {
    return this.productIds().has(Number(productId));
  }

  toggle(product: Product): void {
    if (this.auth.isAuthenticated()) {
      this.http
        .post<ApiResponse<{ wishlisted: boolean }>>(`/api/v1/wishlist/toggle/${product.id}`, {})
        .subscribe({
          next: (res) => {
            if (res.success) {
              if (res.data?.wishlisted) {
                this.items.update((list) => [product, ...list.filter((p) => p.id !== product.id)]);
                this.toast.success(`${product.name} saved to wishlist.`);
              } else {
                this.items.update((list) => list.filter((p) => p.id !== product.id));
                this.toast.info(`${product.name} removed from wishlist.`);
              }
            }
          },
          error: () => {
            this.toast.error('Could not update wishlist.');
          },
        });
      return;
    }

    const current = this.readGuestWishlist();
    const exists = current.some((p) => Number(p.id) === Number(product.id));
    if (exists) {
      this.writeGuestWishlist(current.filter((p) => Number(p.id) !== Number(product.id)));
      this.toast.info(`${product.name} removed from wishlist.`);
    } else {
      this.writeGuestWishlist([product, ...current]);
      this.toast.success(`${product.name} saved to wishlist.`);
    }
  }
}
