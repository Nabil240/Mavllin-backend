import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { ApiResponse, CartItem, CartSummary, Product, ProductVariant } from '../models/api.models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

const GUEST_CART_KEY = 'mavllin_guest_cart_v1';
export const FREE_SHIPPING_THRESHOLD = 2500;

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly items = signal<CartItem[]>(this.readGuestCart());
  readonly loading = signal<boolean>(false);
  readonly drawerOpen = signal<boolean>(false);

  readonly subtotal = computed(() =>
    Number(
      this.items()
        .reduce((sum, item) => sum + Number(item.effective_price || item.price || 0) * Number(item.quantity || 1), 0)
        .toFixed(2)
    )
  );

  readonly totalItems = computed(() =>
    this.items().reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  );

  readonly freeShippingRemaining = computed(() =>
    Math.max(0, Number((FREE_SHIPPING_THRESHOLD - this.subtotal()).toFixed(2)))
  );

  readonly freeShippingPercent = computed(() =>
    Math.min(100, Math.round((this.subtotal() / FREE_SHIPPING_THRESHOLD) * 100))
  );

  private lastAuthUserId: number | null = null;

  constructor() {
    effect(() => {
      const currentUser = this.auth.user();
      const userId = currentUser ? currentUser.id : null;
      if (userId !== this.lastAuthUserId) {
        this.lastAuthUserId = userId;
        if (userId) {
          this.syncOnSignIn();
        } else {
          this.items.set(this.readGuestCart());
        }
      }
    });
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  private readGuestCart(): CartItem[] {
    try {
      const raw = localStorage.getItem(GUEST_CART_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeGuestCart(items: CartItem[]): void {
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
    this.items.set(items);
  }

  clearGuestStorage(): void {
    try {
      localStorage.removeItem(GUEST_CART_KEY);
    } catch {
      // ignore
    }
  }

  syncOnSignIn(): void {
    const guestItems = this.readGuestCart();
    if (guestItems.length > 0) {
      const mergePayload = {
        items: guestItems.map((i) => ({
          variant_id: i.variant_id,
          product_id: i.product_id,
          quantity: i.quantity,
        })),
      };
      this.http
        .post<ApiResponse<{ items: CartItem[]; summary: CartSummary }>>('/api/v1/cart/merge', mergePayload)
        .pipe(
          catchError(() => {
            // Fallback: if /cart/merge is unavailable, add items sequentially or fetch cart
            return this.http.get<ApiResponse<{ items: CartItem[]; summary: CartSummary }>>('/api/v1/cart');
          })
        )
        .subscribe((res) => {
          this.clearGuestStorage();
          if (res?.success && res.data?.items) {
            this.items.set(this.normalizeServerItems(res.data.items));
          } else {
            this.loadServerCart();
          }
        });
    } else {
      this.loadServerCart();
    }
  }

  loadServerCart(): void {
    if (!this.auth.isAuthenticated()) {
      this.items.set(this.readGuestCart());
      return;
    }

    this.loading.set(true);
    this.http
      .get<ApiResponse<{ items: CartItem[]; summary: CartSummary }>>('/api/v1/cart')
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.success && res.data?.items) {
          this.items.set(this.normalizeServerItems(res.data.items));
        }
      });
  }

  private normalizeServerItems(items: CartItem[]): CartItem[] {
    return items.map((item) => {
      const unitPrice = Number(item.effective_price ?? item.unit_price ?? item.price ?? 0);
      const qty = Number(item.quantity || 1);
      return {
        ...item,
        id: item.cart_item_id || item.id,
        cart_item_id: item.cart_item_id || item.id,
        variant_id: item.variant_id || item.product_id,
        size: item.size || item.variant_size || '',
        color: item.color || item.variant_color || '',
        effective_price: unitPrice,
        price: Number(item.price ?? unitPrice),
        line_total: Number((unitPrice * qty).toFixed(2)),
      };
    });
  }

  addItem(product: Product, variant?: ProductVariant | null, quantity = 1, openDrawerAfter = true): void {
    const selectedVariant: ProductVariant =
      variant ||
      (product.variants && product.variants.length > 0
        ? product.variants.find((v) => Number(v.stock_quantity) > 0) || product.variants[0]
        : {
            id: product.id,
            product_id: product.id,
            sku: product.sku || `SKU-${product.id}`,
            size: 'One Size',
            color: 'Default',
            price: Number(product.discount_price || product.price || product.base_price || 0),
            compare_at_price: product.discount_price ? Number(product.base_price || product.price) : null,
            stock_quantity: Number(product.total_stock ?? product.stock_quantity ?? 10),
            is_active: 1,
          });

    const maxStock = Number(selectedVariant.stock_quantity ?? 0);
    if (maxStock <= 0) {
      this.toast.error('This variant is currently out of stock.');
      return;
    }

    if (this.auth.isAuthenticated()) {
      this.http
        .post<ApiResponse<{ items: CartItem[]; summary: CartSummary }>>('/api/v1/cart/items', {
          product_id: product.id,
          variant_id: selectedVariant.id,
          quantity,
        })
        .subscribe({
          next: (res) => {
            if (res.success && res.data?.items) {
              this.items.set(this.normalizeServerItems(res.data.items));
              this.toast.success(`Added ${product.name} to your bag.`);
              if (openDrawerAfter) {
                this.openDrawer();
              }
            }
          },
          error: (err) => {
            this.toast.error(err?.error?.message || 'Could not add item to cart.');
          },
        });
      return;
    }

    // Guest localStorage cart keyed by variant_id
    const current = [...this.readGuestCart()];
    const existingIndex = current.findIndex((i) => Number(i.variant_id) === Number(selectedVariant.id));
    const effPrice = (product.discount_price && Number(product.discount_price) > 0 && (!selectedVariant.price || Number(product.discount_price) <= Number(selectedVariant.price)))
      ? Number(product.discount_price)
      : Number(selectedVariant.price || product.discount_price || product.price || product.base_price || 0);
    const unitPrice = effPrice;

    if (existingIndex > -1) {
      const existing = current[existingIndex];
      const nextQty = Math.min(maxStock, existing.quantity + quantity);
      if (nextQty === existing.quantity && existing.quantity >= maxStock) {
        this.toast.info(`Maximum available stock (${maxStock}) reached for this item.`);
        if (openDrawerAfter) this.openDrawer();
        return;
      }
      current[existingIndex] = {
        ...existing,
        quantity: nextQty,
        stock_quantity: maxStock,
        line_total: Number((unitPrice * nextQty).toFixed(2)),
      };
    } else {
      const initialQty = Math.min(maxStock, Math.max(1, quantity));
      current.unshift({
        id: selectedVariant.id,
        cart_item_id: selectedVariant.id,
        product_id: product.id,
        variant_id: selectedVariant.id,
        product_name: product.name,
        product_slug: product.slug,
        variant_sku: selectedVariant.sku,
        size: selectedVariant.size,
        variant_size: selectedVariant.size,
        color: selectedVariant.color,
        variant_color: selectedVariant.color,
        price: unitPrice,
        effective_price: unitPrice,
        compare_at_price: selectedVariant.compare_at_price || null,
        stock_quantity: maxStock,
        thumbnail_url: product.thumbnail_url || (product.images?.[0]?.image_url ?? '/uploads/products/prod-overshirt-1.svg'),
        quantity: initialQty,
        line_total: Number((unitPrice * initialQty).toFixed(2)),
        discount_type: product.discount_type || 'none',
        discount_value: Number(product.discount_value || 0),
        advance_payment_type: product.advance_payment_type || 'none',
        is_active: 1,
      });
    }

    this.writeGuestCart(current);
    this.toast.success(`Added ${product.name} to your bag.`);
    if (openDrawerAfter) {
      this.openDrawer();
    }
  }

  updateQuantity(item: CartItem, newQuantity: number): void {
    if (newQuantity <= 0) {
      this.removeItem(item);
      return;
    }

    const maxStock = Number(item.stock_quantity || 99);
    if (newQuantity > maxStock) {
      this.toast.info(`Only ${maxStock} item(s) available in stock.`);
      return;
    }

    if (this.auth.isAuthenticated()) {
      const targetId = item.cart_item_id || item.id || item.variant_id || item.product_id;
      this.http
        .patch<ApiResponse<{ items: CartItem[]; summary: CartSummary }>>(`/api/v1/cart/items/${targetId}`, {
          quantity: newQuantity,
        })
        .subscribe({
          next: (res) => {
            if (res.success && res.data?.items) {
              this.items.set(this.normalizeServerItems(res.data.items));
            }
          },
          error: (err) => {
            this.toast.error(err?.error?.message || 'Unable to update quantity.');
          },
        });
      return;
    }

    const current = this.readGuestCart().map((cartItem) => {
      if (Number(cartItem.variant_id) === Number(item.variant_id)) {
        const unit = Number(cartItem.effective_price || cartItem.price || 0);
        return {
          ...cartItem,
          quantity: newQuantity,
          line_total: Number((unit * newQuantity).toFixed(2)),
        };
      }
      return cartItem;
    });
    this.writeGuestCart(current);
  }

  removeItem(item: CartItem): void {
    if (this.auth.isAuthenticated()) {
      const targetId = item.cart_item_id || item.id || item.variant_id || item.product_id;
      this.http
        .delete<ApiResponse<{ items: CartItem[]; summary: CartSummary }>>(`/api/v1/cart/items/${targetId}`)
        .subscribe({
          next: (res) => {
            if (res.success && res.data?.items) {
              this.items.set(this.normalizeServerItems(res.data.items));
              this.toast.info('Item removed from bag.');
            }
          },
          error: (err) => {
            this.toast.error(err?.error?.message || 'Could not remove item.');
          },
        });
      return;
    }

    const filtered = this.readGuestCart().filter((i) => Number(i.variant_id) !== Number(item.variant_id));
    this.writeGuestCart(filtered);
    this.toast.info('Item removed from bag.');
  }

  clearCart(silent = false): void {
    if (this.auth.isAuthenticated()) {
      this.http.delete<ApiResponse<unknown>>('/api/v1/cart').subscribe({
        next: () => {
          this.items.set([]);
          if (!silent) this.toast.info('Shopping bag cleared.');
        },
      });
      return;
    }

    this.clearGuestStorage();
    this.items.set([]);
    if (!silent) this.toast.info('Shopping bag cleared.');
  }
}
