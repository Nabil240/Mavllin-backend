import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService, FREE_SHIPPING_THRESHOLD } from '../../../core/services/cart.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink, BdtCurrencyPipe],
  template: `
    @if (cart.drawerOpen()) {
      <div class="drawer-backdrop" (click)="cart.closeDrawer()"></div>
      <aside class="cart-drawer" role="dialog" aria-label="Shopping Bag">
        <header class="drawer-header">
          <div>
            <h2 class="drawer-title">YOUR BAG ({{ cart.totalItems() }})</h2>
            <p class="drawer-sub">Cash on Delivery available nationwide</p>
          </div>
          <button type="button" class="close-btn" (click)="cart.closeDrawer()" aria-label="Close bag">
            &times;
          </button>
        </header>

        <div class="shipping-bar">
          @if (cart.freeShippingRemaining() > 0) {
            <p class="shipping-text">
              Add <strong class="tabular-price">{{ cart.freeShippingRemaining() | bdt }}</strong> more for
              <strong>FREE EXPRESS SHIPPING</strong>
            </p>
          } @else {
            <p class="shipping-text unlocked">
              You have unlocked <strong>FREE EXPRESS SHIPPING!</strong>
            </p>
          }
          <div class="progress-track">
            <div class="progress-fill" [style.width.%]="cart.freeShippingPercent()"></div>
          </div>
        </div>

        <div class="drawer-body">
          @if (cart.items().length === 0) {
            <div class="empty-drawer">
              <div class="empty-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <h3>Your shopping bag is empty</h3>
              <p>Explore our latest seasonal drops, tailored linen shirts, and heritage panjabis.</p>
              <button type="button" class="btn btn-primary" (click)="goToCatalog()">
                Explore Collection
              </button>
            </div>
          } @else {
            <ul class="cart-item-list">
              @for (item of cart.items(); track item.variant_id || item.id) {
                <li class="cart-item">
                  <a
                    [routerLink]="['/products', item.product_slug]"
                    (click)="cart.closeDrawer()"
                    class="item-thumb"
                  >
                    <img
                      [src]="item.thumbnail_url || '/uploads/products/prod-overshirt-1.svg'"
                      [alt]="item.product_name"
                    />
                  </a>
                  <div class="item-details">
                    <div class="item-top">
                      <a
                        [routerLink]="['/products', item.product_slug]"
                        (click)="cart.closeDrawer()"
                        class="item-name"
                      >
                        {{ item.product_name }}
                      </a>
                      <button
                        type="button"
                        class="remove-btn"
                        (click)="cart.removeItem(item)"
                        aria-label="Remove item"
                      >
                        &times;
                      </button>
                    </div>

                    @if (item.size || item.color || item.variant_sku) {
                      <div class="item-meta">
                        @if (item.size) { <span>Size: {{ item.size }}</span> }
                        @if (item.color) { <span>Color: {{ item.color }}</span> }
                      </div>
                    }

                    <div class="item-bottom">
                      <div class="qty-stepper">
                        <button
                          type="button"
                          (click)="cart.updateQuantity(item, item.quantity - 1)"
                          aria-label="Decrease quantity"
                        >
                          &minus;
                        </button>
                        <span class="tabular-price">{{ item.quantity }}</span>
                        <button
                          type="button"
                          (click)="cart.updateQuantity(item, item.quantity + 1)"
                          [disabled]="item.quantity >= item.stock_quantity"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <div class="item-price tabular-price">
                        {{ (item.effective_price * item.quantity) | bdt }}
                      </div>
                    </div>
                  </div>
                </li>
              }
            </ul>
          }
        </div>

        @if (cart.items().length > 0) {
          <footer class="drawer-footer">
            <div class="subtotal-row">
              <span>Estimated Subtotal</span>
              <strong class="tabular-price">{{ cart.subtotal() | bdt }}</strong>
            </div>
            <p class="tax-note">Shipping & promo codes calculated at checkout.</p>
            <div class="footer-actions">
              <button type="button" class="btn btn-primary btn-block btn-lg btn-shimmer" (click)="goToCheckout()">
                Proceed to Checkout (COD)
              </button>
              <button type="button" class="btn btn-outline btn-block" (click)="goToCart()">
                View Full Bag
              </button>
            </div>
          </footer>
        }
      </aside>
    }
  `,
  styles: [`
    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(24, 24, 27, 0.5);
      backdrop-filter: blur(2px);
      z-index: 1500;
      animation: fadeIn 180ms ease;
    }
    .cart-drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      max-width: 430px;
      background: var(--color-white);
      z-index: 1510;
      display: flex;
      flex-direction: column;
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.14);
      animation: slideLeft 240ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--color-border);
    }
    .drawer-title {
      font-size: 1.05rem;
      letter-spacing: 0.08em;
    }
    .drawer-sub {
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
    .close-btn {
      font-size: 1.75rem;
      line-height: 1;
      color: var(--color-onyx);
      padding: 0.25rem;
    }
    .shipping-bar {
      padding: 0.85rem 1.5rem;
      background: var(--color-alabaster);
      border-bottom: 1px solid var(--color-border);
    }
    .shipping-text {
      font-size: 0.78rem;
      margin-bottom: 0.45rem;
      color: var(--color-onyx);

      &.unlocked {
        color: var(--color-emerald);
      }
    }
    .progress-track {
      height: 5px;
      background: var(--color-border);
      border-radius: 99px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--color-onyx);
      transition: width 300ms ease;
    }
    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem 1.5rem;
    }
    .empty-drawer {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.85rem;
      padding: 2rem 1rem;
      color: var(--color-text-muted);

      h3 {
        font-size: 1.1rem;
        color: var(--color-onyx);
      }
      p {
        font-size: 0.85rem;
        max-width: 280px;
      }
    }
    .cart-item-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
    }
    .cart-item {
      display: flex;
      gap: 0.9rem;
      padding-bottom: 1.15rem;
      border-bottom: 1px solid var(--color-border);
    }
    .item-thumb {
      width: 78px;
      height: 102px;
      flex-shrink: 0;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
    .item-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .item-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .item-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--color-onyx);
      line-height: 1.3;
    }
    .remove-btn {
      font-size: 1.2rem;
      line-height: 1;
      color: var(--color-text-light);
      &:hover {
        color: var(--color-berry);
      }
    }
    .item-meta {
      display: flex;
      gap: 0.65rem;
      font-size: 0.76rem;
      color: var(--color-text-muted);
      margin: 0.25rem 0;
    }
    .item-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.4rem;
    }
    .qty-stepper {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);

      button {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
        color: var(--color-onyx);
        &:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
      }
      span {
        min-width: 28px;
        text-align: center;
        font-size: 0.82rem;
        font-weight: 600;
      }
    }
    .item-price {
      font-weight: 700;
      font-size: 0.92rem;
    }
    .drawer-footer {
      padding: 1.25rem 1.5rem;
      border-top: 1px solid var(--color-border);
      background: var(--color-alabaster);
    }
    .subtotal-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }
    .tax-note {
      font-size: 0.76rem;
      color: var(--color-text-muted);
      margin-bottom: 1rem;
    }
    .footer-actions {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    @keyframes slideLeft {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
  `],
})
export class CartDrawerComponent {
  readonly cart = inject(CartService);
  private readonly router = inject(Router);
  readonly threshold = FREE_SHIPPING_THRESHOLD;

  goToCatalog(): void {
    this.cart.closeDrawer();
    this.router.navigate(['/catalog']);
  }

  goToCart(): void {
    this.cart.closeDrawer();
    this.router.navigate(['/cart']);
  }

  goToCheckout(): void {
    this.cart.closeDrawer();
    this.router.navigate(['/checkout']);
  }
}
