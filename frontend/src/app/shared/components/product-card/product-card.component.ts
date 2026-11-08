import { Component, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product } from '../../../core/models/api.models';
import { CartService } from '../../../core/services/cart.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';
import { NgxBorderBeamComponent } from '../ngxui';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, BdtCurrencyPipe, NgxBorderBeamComponent],
  template: `
    <article class="product-card ngx-spotlight-card">
      @if (product.is_featured) {
        <om-border-beam [gradientColorStart]="'#e8decb'" [gradientColorEnd]="'#9a6b32'" [borderWidth]="'1px'" [animationDuration]="'12s'"></om-border-beam>
      }
      <div class="media-wrap">
        <a [routerLink]="['/products', product.slug]" class="image-link" [attr.aria-label]="product.name">
          <img
            class="img-primary"
            [src]="primaryImage()"
            [alt]="product.name"
            loading="lazy"
          />
          <img
            class="img-secondary"
            [src]="secondaryImage()"
            [alt]="product.name + ' alternate view'"
            loading="lazy"
          />
        </a>

        <div class="badges-top">
          @if (isSoldOut()) {
            <span class="badge badge-dark">Sold Out</span>
          } @else if (discountPercent() > 0) {
            <span class="badge badge-sale">-{{ discountPercent() }}%</span>
          } @else if (product.is_featured) {
            <span class="badge badge-dark">New Drop</span>
          }
        </div>

        <button
          type="button"
          class="wishlist-btn"
          [class.active]="wishlist.isWishlisted(product.id)"
          (click)="onToggleWishlist($event)"
          [attr.aria-label]="wishlist.isWishlisted(product.id) ? 'Remove from wishlist' : 'Add to wishlist'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" [attr.fill]="wishlist.isWishlisted(product.id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>

        <div class="quick-action">
          @if (!isSoldOut()) {
            <button
              type="button"
              class="quick-add-btn btn-shimmer"
              [class.added]="addedRecently()"
              (click)="onQuickAdd($event)"
            >
              {{ addedRecently() ? 'Added ✓' : '+ Quick Add' }}
            </button>
          } @else {
            <a [routerLink]="['/products', product.slug]" class="quick-add-btn disabled">
              View Details
            </a>
          }
        </div>
      </div>

      <div class="card-info">
        @if (product.category_name) {
          <div class="card-category">{{ product.category_name }}</div>
        }
        <h3 class="card-title">
          <a [routerLink]="['/products', product.slug]">{{ product.name }}</a>
        </h3>

        <div class="card-price tabular-price">
          <span class="price-current">{{ effectivePrice() | bdt }}</span>
          @if (comparePrice() > effectivePrice()) {
            <span class="price-compare">{{ comparePrice() | bdt }}</span>
          }
        </div>

        @if (product.available_sizes && product.available_sizes.length > 0) {
          <div class="size-pills">
            @for (sz of product.available_sizes.slice(0, 5); track sz) {
              <span class="size-dot">{{ sz }}</span>
            }
          </div>
        }
      </div>
    </article>
  `,
  styles: [`
    .product-card {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--color-white);
      padding: 0.55rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
                  box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1),
                  border-color 320ms ease;
      &:hover {
        transform: translateY(-6px);
        border-color: var(--color-beige-deep);
        box-shadow: 0 16px 34px -8px rgba(44, 36, 29, 0.13);
      }
    }
    .media-wrap {
      position: relative;
      aspect-ratio: 3 / 4;
      background: var(--color-alabaster);
      overflow: hidden;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
    }
    .image-link {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .img-primary,
    .img-secondary {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: opacity 380ms ease, transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .img-secondary {
      position: absolute;
      inset: 0;
      opacity: 0;
    }
    .media-wrap:hover .img-primary {
      opacity: 0;
      transform: scale(1.03);
    }
    .media-wrap:hover .img-secondary {
      opacity: 1;
      transform: scale(1.04);
    }
    .badges-top {
      position: absolute;
      top: 0.75rem;
      left: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      z-index: 2;
    }
    .wishlist-btn {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.9);
      color: var(--color-onyx);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      transition: all var(--transition);
      box-shadow: var(--shadow-sm);

      &:hover {
        background: var(--color-white);
        transform: scale(1.12);
      }
      &.active {
        color: var(--color-berry);
        animation: heartPop 420ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
    }
    @keyframes heartPop {
      0% { transform: scale(1); }
      40% { transform: scale(1.32); }
      75% { transform: scale(0.92); }
      100% { transform: scale(1); }
    }
    .quick-action {
      position: absolute;
      left: 0.75rem;
      right: 0.75rem;
      bottom: 0.75rem;
      z-index: 2;
      opacity: 0;
      transform: translateY(8px);
      transition: all 220ms ease;
    }
    .media-wrap:hover .quick-action {
      opacity: 1;
      transform: translateY(0);
    }
    .quick-add-btn {
      width: 100%;
      display: block;
      text-align: center;
      padding: 0.65rem 0.75rem;
      background: rgba(24, 24, 27, 0.92);
      color: var(--color-white);
      font-family: var(--font-display);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-radius: 3px;
      backdrop-filter: blur(4px);
      transition: background var(--transition);

      &:hover {
        background: var(--color-onyx);
      }
      &.added {
        background: var(--color-emerald) !important;
        color: var(--color-white);
        animation: quickAddPop 380ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      &.disabled {
        background: rgba(82, 82, 91, 0.9);
      }
    }
    @keyframes quickAddPop {
      0% { transform: scale(1); }
      45% { transform: scale(1.04); }
      100% { transform: scale(1); }
    }
    .card-info {
      padding: 0.85rem 0.15rem 0.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .card-category {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-light);
      font-weight: 600;
    }
    .card-title {
      font-family: var(--font-sans);
      font-size: 0.925rem;
      font-weight: 600;
      color: var(--color-onyx);
      line-height: 1.35;

      a:hover {
        text-decoration: underline;
      }
    }
    .card-price {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.1rem;
    }
    .price-current {
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--color-onyx);
    }
    .price-compare {
      font-size: 0.825rem;
      color: var(--color-text-light);
      text-decoration: line-through;
    }
    .size-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-top: 0.25rem;
    }
    .size-dot {
      font-size: 0.68rem;
      padding: 0.12rem 0.42rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border-dark);
      color: var(--color-text-muted);
      border-radius: 2px;
    }
  `],
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;

  readonly cart = inject(CartService);
  readonly wishlist = inject(WishlistService);

  primaryImage(): string {
    return (
      this.product.thumbnail_url ||
      this.product.images?.[0]?.image_url ||
      '/uploads/products/prod-overshirt-1.svg'
    );
  }

  secondaryImage(): string {
    if (this.product.secondary_image_url) return this.product.secondary_image_url;
    if (this.product.images && this.product.images.length > 1) {
      return this.product.images[1].image_url;
    }
    const primary = this.primaryImage();
    if (primary.includes('-1.svg')) {
      const candidate = primary.replace('-1.svg', '-2.svg');
      if (
        primary.includes('overshirt') ||
        primary.includes('linen') ||
        primary.includes('panjabi') ||
        primary.includes('crewneck') ||
        primary.includes('hoodie') ||
        primary.includes('jeans')
      ) {
        return candidate;
      }
    }
    return primary;
  }

  effectivePrice(): number {
    const firstVar = this.product.variants?.[0];
    if (this.product.discount_price && Number(this.product.discount_price) > 0) {
      return Number(this.product.discount_price);
    }
    if (firstVar && Number(firstVar.price) > 0) {
      return Number(firstVar.price);
    }
    return Number(this.product.price || this.product.base_price || 0);
  }

  comparePrice(): number {
    const firstVar = this.product.variants?.[0];
    if (firstVar?.compare_at_price && Number(firstVar.compare_at_price) > this.effectivePrice()) {
      return Number(firstVar.compare_at_price);
    }
    if (this.product.discount_price && Number(this.product.base_price) > Number(this.product.discount_price)) {
      return Number(this.product.base_price);
    }
    return 0;
  }

  discountPercent(): number {
    const comp = this.comparePrice();
    const eff = this.effectivePrice();
    if (comp > eff && comp > 0) {
      return Math.round(((comp - eff) / comp) * 100);
    }
    return 0;
  }

  isSoldOut(): boolean {
    if (this.product.total_stock !== undefined) {
      return Number(this.product.total_stock) <= 0;
    }
    if (this.product.variants && this.product.variants.length > 0) {
      return this.product.variants.every((v) => Number(v.stock_quantity) <= 0);
    }
    if (this.product.stock_quantity !== undefined) {
      return Number(this.product.stock_quantity) <= 0;
    }
    return false;
  }

  readonly addedRecently = signal<boolean>(false);

  onQuickAdd(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cart.addItem(this.product, null, 1, true);
    this.addedRecently.set(true);
    setTimeout(() => this.addedRecently.set(false), 1200);
  }

  onToggleWishlist(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.wishlist.toggle(this.product);
  }
}
