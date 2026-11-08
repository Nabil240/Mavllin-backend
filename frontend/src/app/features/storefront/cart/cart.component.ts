import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { CouponValidationResult } from '../../../core/models/api.models';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BdtCurrencyPipe],
  template: `
    <div class="cart-page container">
      <header class="page-head">
        <div>
          <h1 class="section-heading">YOUR SHOPPING BAG</h1>
          <p class="section-subtitle">{{ cart.totalItems() }} item(s) reserved in your bag</p>
        </div>
        @if (cart.items().length > 0) {
          <button type="button" class="btn btn-secondary btn-sm" (click)="cart.clearCart()">
            Clear Bag
          </button>
        }
      </header>

      @if (cart.items().length === 0) {
        <div class="empty-cart-box">
          <h2>Your shopping bag is currently empty</h2>
          <p>Browse our seasonal collections to add tailored shirts, heritage panjabis, and trousers.</p>
          <a routerLink="/catalog" class="btn btn-primary btn-lg">Explore Collection</a>
        </div>
      } @else {
        <div class="cart-layout">
          <div class="cart-table-wrap">
            <table class="cart-table">
              <thead>
                <tr>
                  <th>Garment</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Line Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (item of cart.items(); track item.variant_id || item.id) {
                  <tr>
                    <td>
                      <div class="item-cell">
                        <a [routerLink]="['/products', item.product_slug]" class="cell-thumb">
                          <img
                            [src]="item.thumbnail_url || '/uploads/products/prod-overshirt-1.svg'"
                            [alt]="item.product_name"
                          />
                        </a>
                        <div>
                          <a [routerLink]="['/products', item.product_slug]" class="cell-title">
                            {{ item.product_name }}
                          </a>
                          <div class="cell-meta">
                            @if (item.size) { <span>Size: <strong>{{ item.size }}</strong></span> }
                            @if (item.color) { <span>Color: <strong>{{ item.color }}</strong></span> }
                            @if (item.variant_sku) { <span>SKU: {{ item.variant_sku }}</span> }
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="tabular-price">{{ item.effective_price | bdt }}</td>
                    <td>
                      <div class="qty-stepper">
                        <button type="button" (click)="cart.updateQuantity(item, item.quantity - 1)">&minus;</button>
                        <span class="tabular-price">{{ item.quantity }}</span>
                        <button
                          type="button"
                          (click)="cart.updateQuantity(item, item.quantity + 1)"
                          [disabled]="item.quantity >= item.stock_quantity"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td class="tabular-price font-bold">
                      {{ (item.effective_price * item.quantity) | bdt }}
                    </td>
                    <td>
                      <button
                        type="button"
                        class="remove-link"
                        (click)="cart.removeItem(item)"
                        aria-label="Remove item"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <aside class="cart-summary-card">
            <h3>ORDER SUMMARY</h3>

            <div class="shipping-progress-box">
              @if (cart.freeShippingRemaining() > 0) {
                <p>Add <strong>{{ cart.freeShippingRemaining() | bdt }}</strong> more for <strong>Free Shipping</strong>!</p>
              } @else {
                <p class="unlocked">You qualify for <strong>FREE EXPRESS SHIPPING!</strong></p>
              }
              <div class="bar-bg">
                <div class="bar-fill" [style.width.%]="cart.freeShippingPercent()"></div>
              </div>
            </div>

            <!-- Promo Coupon Preview -->
            <div class="coupon-box">
              <label class="form-label" for="cartCoupon">Promo Code Preview</label>
              <div class="coupon-input-row">
                <input
                  id="cartCoupon"
                  type="text"
                  class="form-control"
                  placeholder="WELCOME10 / FASHION20"
                  [(ngModel)]="couponCode"
                />
                <button type="button" class="btn btn-outline btn-sm" (click)="applyCoupon()">
                  Check
                </button>
              </div>
              @if (appliedCoupon()) {
                <div class="coupon-applied">
                  Code <strong>{{ appliedCoupon()!.code }}</strong> valid:
                  -{{ appliedCoupon()!.discount_amount | bdt }}
                </div>
              }
            </div>

            <div class="summary-lines tabular-price">
              <div class="line">
                <span>Subtotal</span>
                <span>{{ cart.subtotal() | bdt }}</span>
              </div>
              @if (appliedCoupon()) {
                <div class="line discount">
                  <span>Promo ({{ appliedCoupon()!.code }})</span>
                  <span>-{{ appliedCoupon()!.discount_amount | bdt }}</span>
                </div>
              }
              <div class="line">
                <span>Delivery Estimate (Dhaka)</span>
                <span>{{ cart.subtotal() >= 2500 ? 'FREE' : ('70' | bdt) }}</span>
              </div>
              <div class="line total">
                <span>Estimated Total</span>
                <span>
                  {{
                    (
                      cart.subtotal() -
                      (appliedCoupon()?.discount_amount || 0) +
                      (cart.subtotal() >= 2500 ? 0 : 70)
                    ) | bdt
                  }}
                </span>
              </div>
            </div>

            <div class="cod-notice">
              <strong>Payment Method:</strong> Cash on Delivery (COD) nationwide
            </div>

            <a routerLink="/checkout" class="btn btn-primary btn-block btn-lg btn-shimmer">
              Proceed to Checkout
            </a>
            <a routerLink="/catalog" class="continue-link">
              &larr; Continue Shopping
            </a>
          </aside>
        </div>
      }
    </div>
  `,
  styles: [`
    .cart-page {
      padding-top: 2.5rem;
      padding-bottom: 4rem;
    }
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 1.25rem;
      margin-bottom: 2rem;
    }
    .empty-cart-box {
      text-align: center;
      padding: 4rem 1.5rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .cart-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.5rem;
      @media (min-width: 992px) {
        grid-template-columns: 1fr 380px;
      }
    }
    .cart-table-wrap {
      overflow-x: auto;
    }
    .cart-table {
      width: 100%;
      border-collapse: collapse;

      th {
        text-align: left;
        font-family: var(--font-display);
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-muted);
        padding: 0.75rem 0.5rem;
        border-bottom: 1px solid var(--color-border);
      }
      td {
        padding: 1.25rem 0.5rem;
        border-bottom: 1px solid var(--color-border);
        vertical-align: middle;
      }
    }
    .item-cell {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .cell-thumb {
      width: 72px;
      height: 94px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      overflow: hidden;
      flex-shrink: 0;
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
    .cell-title {
      font-weight: 600;
      color: var(--color-onyx);
      font-size: 0.95rem;
    }
    .cell-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      font-size: 0.78rem;
      color: var(--color-text-muted);
      margin-top: 0.25rem;
    }
    .qty-stepper {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      button {
        width: 30px;
        height: 30px;
        &:disabled { opacity: 0.35; }
      }
      span {
        min-width: 30px;
        text-align: center;
        font-weight: 600;
        font-size: 0.85rem;
      }
    }
    .font-bold { font-weight: 700; }
    .remove-link {
      font-size: 0.78rem;
      color: var(--color-berry);
      text-decoration: underline;
    }

    .cart-summary-card {
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 1.75rem;
      height: fit-content;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;

      h3 {
        font-size: 1rem;
        letter-spacing: 0.08em;
        border-bottom: 1px solid var(--color-border);
        padding-bottom: 0.75rem;
      }
    }
    .shipping-progress-box {
      font-size: 0.8rem;
      .unlocked { color: var(--color-emerald); }
      .bar-bg {
        height: 5px;
        background: var(--color-border);
        border-radius: 99px;
        margin-top: 0.4rem;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        background: var(--color-onyx);
      }
    }
    .coupon-input-row {
      display: flex;
      gap: 0.5rem;
    }
    .coupon-applied {
      margin-top: 0.4rem;
      font-size: 0.78rem;
      color: var(--color-emerald);
    }
    .summary-lines {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      font-size: 0.9rem;

      .line {
        display: flex;
        justify-content: space-between;
      }
      .discount { color: var(--color-emerald); font-weight: 600; }
      .total {
        border-top: 1px solid var(--color-border);
        padding-top: 0.75rem;
        font-size: 1.05rem;
        font-weight: 700;
      }
    }
    .cod-notice {
      font-size: 0.78rem;
      padding: 0.65rem 0.85rem;
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
    }
    .continue-link {
      text-align: center;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--color-text-muted);
    }
  `],
})
export class CartComponent {
  readonly cart = inject(CartService);
  private readonly orderService = inject(OrderService);
  private readonly toast = inject(ToastService);

  couponCode = '';
  readonly appliedCoupon = signal<CouponValidationResult | null>(null);

  applyCoupon(): void {
    const code = this.couponCode.trim();
    if (!code) return;
    this.orderService.validateCoupon(code, this.cart.subtotal()).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.appliedCoupon.set(res.data);
          this.toast.success(`Coupon ${res.data.code} applied!`);
        }
      },
      error: (err) => {
        this.appliedCoupon.set(null);
        this.toast.error(err?.error?.message || 'Invalid coupon code.');
      },
    });
  }
}
