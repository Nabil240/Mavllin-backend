import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Product,
  ProductVariant,
  Review,
  ReviewSummary,
} from '../../../../core/models/api.models';
import { AuthService } from '../../../../core/services/auth.service';
import { CartService } from '../../../../core/services/cart.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { WishlistService } from '../../../../core/services/wishlist.service';
import { SeoService } from '../../../../core/services/seo.service';
import { ProductCardComponent } from '../../../../shared/components/product-card/product-card.component';
import { BdtCurrencyPipe } from '../../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductCardComponent, BdtCurrencyPipe],
  template: `
    <div class="pdp-page container">
      @if (loading()) {
        <div class="pdp-loading">Loading garment details...</div>
      } @else if (!product()) {
        <div class="pdp-not-found">
          <h2>Garment Not Found</h2>
          <p>The requested piece may have been archived or moved.</p>
          <a routerLink="/catalog" class="btn btn-primary">Return to Catalog</a>
        </div>
      } @else {
        @let p = product()!;
        <nav class="breadcrumb">
          <a routerLink="/">Home</a>
          <span>/</span>
          <a routerLink="/catalog">Catalog</a>
          @if (p.category_name && p.category_slug) {
            <span>/</span>
            <a [routerLink]="['/category', p.category_slug]">{{ p.category_name }}</a>
          }
          <span>/</span>
          <span>{{ p.name }}</span>
        </nav>

        <div class="pdp-grid">
          <!-- Left: Gallery -->
          <div class="gallery-col">
            <div class="thumbs-rail">
              @for (img of galleryImages(); track img; let idx = $index) {
                <button
                  type="button"
                  class="thumb-btn"
                  [class.active]="selectedImageIndex() === idx"
                  (click)="selectedImageIndex.set(idx)"
                >
                  <img [src]="img" [alt]="p.name + ' thumbnail ' + (idx + 1)" />
                </button>
              }
            </div>

            <div class="main-stage">
              <img
                [src]="galleryImages()[selectedImageIndex()] || p.thumbnail_url || '/uploads/products/prod-overshirt-1.svg'"
                [alt]="p.name"
              />
              @if (discountPercent() > 0) {
                <span class="badge badge-sale stage-badge">SAVE {{ discountPercent() }}%</span>
              }
            </div>
          </div>

          <!-- Right: Details & Variant Selector -->
          <div class="info-col">
            <div class="meta-top">
              <span class="sku-label">SKU: {{ currentSku() }}</span>
              @if (currentStock() > 0) {
                <span class="badge badge-stock">In Stock ({{ currentStock() }} available)</span>
              } @else {
                <span class="badge badge-soldout">Out of Stock</span>
              }
            </div>

            <h1 class="pdp-title">{{ p.name }}</h1>

            <div class="price-row tabular-price">
              <span class="price-now">{{ currentPrice() | bdt }}</span>
              @if (currentComparePrice() > currentPrice()) {
                <span class="price-was">{{ currentComparePrice() | bdt }}</span>
              }
            </div>

            @if (p.short_description) {
              <p class="short-desc">{{ p.short_description }}</p>
            }

            <!-- Color Selector -->
            @if (uniqueColors().length > 0) {
              <div class="selector-block">
                <div class="selector-head">
                  <span>COLOR: <strong>{{ selectedColor() || 'Select' }}</strong></span>
                </div>
                <div class="swatch-list">
                  @for (color of uniqueColors(); track color) {
                    <button
                      type="button"
                      class="color-pill"
                      [class.active]="selectedColor() === color"
                      (click)="onSelectColor(color)"
                    >
                      {{ color }}
                    </button>
                  }
                </div>
              </div>
            }

            <!-- Size Selector -->
            @if (uniqueSizes().length > 0) {
              <div class="selector-block">
                <div class="selector-head">
                  <span>SIZE: <strong>{{ selectedSize() || 'Select' }}</strong></span>
                  <button type="button" class="size-guide-trigger" (click)="sizeGuideOpen.set(true)">
                    Size Guide (Inches)
                  </button>
                </div>
                <div class="size-boxes">
                  @for (sz of uniqueSizes(); track sz) {
                    @let available = isSizeAvailable(sz);
                    <button
                      type="button"
                      class="size-box"
                      [class.active]="selectedSize() === sz"
                      [class.unavailable]="!available"
                      (click)="onSelectSize(sz)"
                    >
                      {{ sz }}
                    </button>
                  }
                </div>
              </div>
            }

            <!-- Quantity & CTA Buttons -->
            <div class="purchase-controls">
              <div class="qty-box">
                <span class="qty-label">Quantity</span>
                <div class="qty-stepper">
                  <button type="button" (click)="decrementQty()" [disabled]="quantity() <= 1">&minus;</button>
                  <span class="tabular-price">{{ quantity() }}</span>
                  <button
                    type="button"
                    (click)="incrementQty()"
                    [disabled]="quantity() >= currentStock()"
                  >
                    +
                  </button>
                </div>
              </div>

              <div class="cta-buttons">
                <button
                  type="button"
                  class="btn btn-outline btn-lg"
                  [disabled]="currentStock() <= 0"
                  (click)="onAddToCart()"
                >
                  {{ currentStock() > 0 ? 'Add to Bag' : 'Sold Out' }}
                </button>
                <button
                  type="button"
                  class="btn btn-primary btn-lg btn-shimmer"
                  [disabled]="currentStock() <= 0"
                  (click)="onBuyNow()"
                >
                  Buy It Now (Cash on Delivery)
                </button>
              </div>

              <button
                type="button"
                class="wishlist-inline-btn"
                (click)="wishlist.toggle(p)"
              >
                {{ wishlist.isWishlisted(p.id) ? '♥ Saved in Your Wishlist' : '♡ Save to Wishlist' }}
              </button>
            </div>

            <!-- Accordion Details -->
            <div class="pdp-accordions">
              <details open>
                <summary>Garment Craftsmanship &amp; Details</summary>
                <div class="acc-body">
                  <p>{{ p.description || p.short_description || 'Tailored in our Dhaka studio using breathable long-staple fabric engineered for durability and comfort.' }}</p>
                </div>
              </details>
              <details>
                <summary>Delivery &amp; Cash on Delivery (COD)</summary>
                <div class="acc-body">
                  <ul>
                    <li><strong>Inside Dhaka:</strong> ৳70 (24–48 Hours Express Delivery)</li>
                    <li><strong>Outside Dhaka:</strong> ৳130 (3–5 Business Days Nationwide Courier — 64 Districts)</li>
                    <li><strong>Free Shipping:</strong> Complimentary on all orders over ৳2,500</li>
                    <li><strong>Payment:</strong> Cash on Delivery (COD) supported nationwide.</li>
                  </ul>
                </div>
              </details>
              <details>
                <summary>7-Day Exchange &amp; Returns</summary>
                <div class="acc-body">
                  <p>Unworn garments with original tags attached can be exchanged for another size or variant within 7 days of delivery.</p>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Customer Reviews Section -->
        <section class="reviews-section">
          <div class="reviews-grid">
            <div class="reviews-summary-card">
              <h2 class="section-heading">CLIENT REVIEWS</h2>
              <div class="rating-big tabular-price">
                <strong>{{ reviewSummary()?.average_rating || '5.0' }}</strong>
                <span>/ 5.0 ({{ reviewSummary()?.total_reviews || reviews().length }} reviews)</span>
              </div>

              @if (auth.isAuthenticated()) {
                <form class="review-form" (ngSubmit)="submitReview()">
                  <h4>Write a Review</h4>
                  <div class="form-group">
                    <label class="form-label" for="ratingSelect">Rating</label>
                    <select id="ratingSelect" name="rating" class="form-control" [(ngModel)]="newReviewRating">
                      <option [ngValue]="5">5 Stars — Exceptional</option>
                      <option [ngValue]="4">4 Stars — Very Good</option>
                      <option [ngValue]="3">3 Stars — Satisfactory</option>
                      <option [ngValue]="2">2 Stars — Subpar</option>
                      <option [ngValue]="1">1 Star — Poor</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="reviewComment">Your Experience</label>
                    <textarea
                      id="reviewComment"
                      name="comment"
                      rows="3"
                      class="form-control"
                      [(ngModel)]="newReviewComment"
                      placeholder="Share fit, fabric quality, and styling notes..."
                      required
                    ></textarea>
                  </div>
                  <button type="submit" class="btn btn-primary btn-sm" [disabled]="submittingReview()">
                    {{ submittingReview() ? 'Submitting...' : 'Submit Review' }}
                  </button>
                </form>
              } @else {
                <p class="signin-review-prompt">
                  <a routerLink="/auth/login">Sign in</a> to leave a verified review on this garment.
                </p>
              }
            </div>

            <div class="reviews-list">
              @if (reviews().length === 0) {
                <div class="empty-reviews">
                  <p>No reviews yet for this piece. Be the first to review it!</p>
                </div>
              } @else {
                @for (rev of reviews(); track rev.id) {
                  <article class="review-card">
                    <div class="review-top">
                      <strong>{{ rev.reviewer_name || rev.full_name || 'Verified Client' }}</strong>
                      <span class="stars">{{ '★'.repeat(rev.rating) }}{{ '☆'.repeat(5 - rev.rating) }}</span>
                    </div>
                    <p class="review-comment">{{ rev.comment }}</p>
                    <span class="review-date">{{ rev.created_at | date:'mediumDate' }}</span>
                  </article>
                }
              }
            </div>
          </div>
        </section>

        <!-- Related Products -->
        @if (relatedProducts().length > 0) {
          <section class="related-section">
            <h2 class="section-heading">COMPLETE THE LOOK</h2>
            <div class="related-grid">
              @for (rel of relatedProducts(); track rel.id) {
                <app-product-card [product]="rel" />
              }
            </div>
          </section>
        }
      }
    </div>

    <!-- Size Guide Modal -->
    @if (sizeGuideOpen()) {
      <div class="modal-backdrop" (click)="sizeGuideOpen.set(false)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>ECO STUDIO — GARMENT MEASUREMENT GUIDE (INCHES)</h3>
            <button type="button" (click)="sizeGuideOpen.set(false)">&times;</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 1rem;">
              Measurements are garment flat specs in inches. For a relaxed drape, size up one size.
            </p>
            <table class="size-table">
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Chest (in)</th>
                  <th>Shoulder (in)</th>
                  <th>Length — Shirt (in)</th>
                  <th>Length — Panjabi (in)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>S</td><td>40"</td><td>17.5"</td><td>28.5"</td><td>40"</td></tr>
                <tr><td>M</td><td>42"</td><td>18.25"</td><td>29.5"</td><td>42"</td></tr>
                <tr><td>L</td><td>44"</td><td>19.0"</td><td>30.5"</td><td>43.5"</td></tr>
                <tr><td>XL</td><td>46"</td><td>19.75"</td><td>31.5"</td><td>45"</td></tr>
                <tr><td>XXL</td><td>48"</td><td>20.5"</td><td>32.0"</td><td>46"</td></tr>
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary btn-sm" (click)="sizeGuideOpen.set(false)">
              Close Guide
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .pdp-page {
      padding-top: 2rem;
      padding-bottom: 4rem;
    }
    .pdp-loading,
    .pdp-not-found {
      text-align: center;
      padding: 4rem 1rem;
    }
    .breadcrumb {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      font-size: 0.76rem;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 1.75rem;
    }
    .pdp-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.5rem;
      @media (min-width: 992px) {
        grid-template-columns: 1.15fr 0.85fr;
        gap: 3.5rem;
      }
    }
    .gallery-col {
      display: grid;
      grid-template-columns: 76px 1fr;
      gap: 1rem;
      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }
    .thumbs-rail {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      @media (max-width: 640px) {
        order: 2;
        flex-direction: row;
      }
    }
    .thumb-btn {
      width: 76px;
      height: 96px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: var(--color-alabaster);
      &.active {
        border: 2px solid var(--color-onyx);
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
    .main-stage {
      position: relative;
      aspect-ratio: 3 / 4;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .stage-badge {
        position: absolute;
        top: 1rem;
        left: 1rem;
      }
    }

    .info-col {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .meta-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .sku-label {
      font-size: 0.76rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--color-text-light);
    }
    .pdp-title {
      font-size: clamp(1.5rem, 2.5vw, 2.1rem);
      line-height: 1.2;
    }
    .price-row {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
    }
    .price-now {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-onyx);
    }
    .price-was {
      font-size: 1.05rem;
      color: var(--color-text-light);
      text-decoration: line-through;
    }
    .short-desc {
      font-size: 0.92rem;
      color: var(--color-text-muted);
      line-height: 1.6;
    }

    .selector-block {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .selector-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .size-guide-trigger {
      font-size: 0.76rem;
      font-weight: 700;
      text-decoration: underline;
      color: var(--color-onyx);
    }
    .swatch-list,
    .size-boxes {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .color-pill,
    .size-box {
      padding: 0.55rem 1rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      font-weight: 600;
      background: var(--color-white);
      color: var(--color-onyx);
      transition: all var(--transition);

      &.active {
        background: var(--color-onyx);
        color: var(--color-white);
        border-color: var(--color-onyx);
      }
      &.unavailable {
        opacity: 0.4;
        text-decoration: line-through;
      }
    }

    .purchase-controls {
      padding-top: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .qty-box {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .qty-label {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .qty-stepper {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      button {
        width: 36px;
        height: 36px;
        font-size: 1rem;
        &:disabled { opacity: 0.35; }
      }
      span {
        min-width: 36px;
        text-align: center;
        font-weight: 600;
      }
    }
    .cta-buttons {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
      @media (min-width: 540px) {
        grid-template-columns: 1fr 1.3fr;
      }
    }
    .wishlist-inline-btn {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--color-text-muted);
      text-align: left;
      &:hover { color: var(--color-onyx); }
    }

    .pdp-accordions {
      margin-top: 0.75rem;
      border-top: 1px solid var(--color-border);

      details {
        border-bottom: 1px solid var(--color-border);
        padding: 0.95rem 0;
      }
      summary {
        font-family: var(--font-display);
        font-size: 0.84rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        cursor: pointer;
      }
      .acc-body {
        padding-top: 0.75rem;
        font-size: 0.86rem;
        color: var(--color-text-muted);
        line-height: 1.6;
        ul {
          padding-left: 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
      }
    }

    /* Reviews */
    .reviews-section {
      margin-top: 4rem;
      padding-top: 3rem;
      border-top: 1px solid var(--color-border);
    }
    .reviews-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.5rem;
      @media (min-width: 992px) {
        grid-template-columns: 360px 1fr;
      }
    }
    .rating-big {
      margin: 0.5rem 0 1.5rem;
      strong {
        font-size: 2rem;
      }
      span {
        font-size: 0.88rem;
        color: var(--color-text-muted);
        margin-left: 0.4rem;
      }
    }
    .review-form {
      background: var(--color-alabaster);
      padding: 1.25rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
      h4 {
        font-size: 0.88rem;
        text-transform: uppercase;
        margin-bottom: 0.85rem;
      }
    }
    .signin-review-prompt {
      font-size: 0.86rem;
      color: var(--color-text-muted);
      a { text-decoration: underline; color: var(--color-onyx); font-weight: 600; }
    }
    .reviews-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .review-card {
      padding: 1.25rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
    }
    .review-top {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.45rem;
      .stars { color: var(--color-gold); letter-spacing: 0.1em; }
    }
    .review-comment {
      font-size: 0.9rem;
      color: var(--color-text);
      margin-bottom: 0.4rem;
    }
    .review-date {
      font-size: 0.74rem;
      color: var(--color-text-light);
    }

    .related-section {
      margin-top: 4rem;
      padding-top: 3rem;
      border-top: 1px solid var(--color-border);
      h2 { margin-bottom: 1.5rem; }
    }
    .related-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;
      @media (min-width: 768px) {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    .size-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      th, td {
        padding: 0.65rem 0.75rem;
        border: 1px solid var(--color-border);
        text-align: center;
      }
      th {
        background: var(--color-alabaster);
        font-weight: 700;
      }
    }
  `],
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);
  private readonly seoService = inject(SeoService);
  readonly cart = inject(CartService);
  readonly wishlist = inject(WishlistService);
  readonly auth = inject(AuthService);

  readonly product = signal<Product | null>(null);
  readonly loading = signal<boolean>(true);
  readonly selectedImageIndex = signal<number>(0);
  readonly selectedColor = signal<string>('');
  readonly selectedSize = signal<string>('');
  readonly quantity = signal<number>(1);
  readonly sizeGuideOpen = signal<boolean>(false);

  readonly reviews = signal<Review[]>([]);
  readonly reviewSummary = signal<ReviewSummary | null>(null);
  readonly relatedProducts = signal<Product[]>([]);
  readonly submittingReview = signal<boolean>(false);

  newReviewRating = 5;
  newReviewComment = '';

  readonly variants = computed<ProductVariant[]>(() => this.product()?.variants || []);

  readonly uniqueColors = computed<string[]>(() => {
    const list = this.variants().map((v) => v.color).filter(Boolean);
    return [...new Set(list)];
  });

  readonly uniqueSizes = computed<string[]>(() => {
    const list = this.variants().map((v) => v.size).filter(Boolean);
    return [...new Set(list)];
  });

  readonly selectedVariant = computed<ProductVariant | null>(() => {
    const vars = this.variants();
    if (vars.length === 0) return null;
    const c = this.selectedColor();
    const s = this.selectedSize();
    return (
      vars.find((v) => (!c || v.color === c) && (!s || v.size === s)) ||
      vars.find((v) => !s || v.size === s) ||
      vars[0]
    );
  });

  readonly currentPrice = computed<number>(() => {
    const p = this.product();
    const v = this.selectedVariant();
    if (p?.discount_price && Number(p.discount_price) > 0) {
      if (v && Number(v.price) > 0 && Number(v.price) < Number(p.discount_price)) {
        return Number(v.price);
      }
      return Number(p.discount_price);
    }
    if (v && Number(v.price) > 0) return Number(v.price);
    return Number(p?.price || p?.base_price || 0);
  });

  readonly currentComparePrice = computed<number>(() => {
    const p = this.product();
    const v = this.selectedVariant();
    if (p?.discount_price && Number(p.discount_price) > 0) {
      const original = v?.compare_at_price && Number(v.compare_at_price) > 0
        ? Number(v.compare_at_price)
        : Number(v?.price || p.base_price || p.price || 0);
      if (original > this.currentPrice()) return original;
    }
    if (v?.compare_at_price && Number(v.compare_at_price) > 0) {
      return Number(v.compare_at_price);
    }
    return 0;
  });

  readonly discountPercent = computed<number>(() => {
    const comp = this.currentComparePrice();
    const cur = this.currentPrice();
    if (comp > cur && comp > 0) {
      return Math.round(((comp - cur) / comp) * 100);
    }
    return 0;
  });

  readonly currentSku = computed<string>(() => {
    return this.selectedVariant()?.sku || this.product()?.sku || `MAV-${this.product()?.id}`;
  });

  readonly currentStock = computed<number>(() => {
    const v = this.selectedVariant();
    if (v) return Number(v.stock_quantity ?? 0);
    const p = this.product();
    return Number(p?.total_stock ?? p?.stock_quantity ?? 0);
  });

  readonly galleryImages = computed<string[]>(() => {
    const p = this.product();
    if (!p) return [];
    const list: string[] = [];
    if (p.thumbnail_url) list.push(p.thumbnail_url);
    if (p.images && p.images.length > 0) {
      for (const img of p.images) {
        if (img.image_url && !list.includes(img.image_url)) {
          list.push(img.image_url);
        }
      }
    }
    if (list.length === 1 && list[0].includes('-1.svg')) {
      const alt = list[0].replace('-1.svg', '-2.svg');
      if (
        list[0].includes('overshirt') ||
        list[0].includes('linen') ||
        list[0].includes('panjabi') ||
        list[0].includes('crewneck') ||
        list[0].includes('hoodie') ||
        list[0].includes('jeans')
      ) {
        list.push(alt);
      }
    }
    return list.length > 0 ? list : ['/uploads/products/prod-overshirt-1.svg'];
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.loadProduct(slug);
      }
    });
  }

  private loadProduct(slug: string): void {
    this.loading.set(true);
    this.catalog.getProductBySlugOrId(slug).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          const prod = res.data;
          this.product.set(prod);
          this.seoService.updateSeo({
            title: prod.name,
            description: prod.description || `Buy ${prod.name} at MAVLLIN atelier. Authentic tailoring with Cash on Delivery across Bangladesh.`,
            image: prod.thumbnail_url || undefined,
            type: 'product',
          });
          this.selectedImageIndex.set(0);
          this.quantity.set(1);

          const firstAvailable =
            prod.variants?.find((v) => Number(v.stock_quantity) > 0) || prod.variants?.[0];
          if (firstAvailable) {
            this.selectedColor.set(firstAvailable.color || '');
            this.selectedSize.set(firstAvailable.size || '');
          }

          this.loadReviews(prod.id);
          this.loadRelated(prod.category_slug || null, prod.id);
        }
      },
      error: () => {
        this.loading.set(false);
        this.product.set(null);
      },
    });
  }

  onSelectColor(color: string): void {
    this.selectedColor.set(color);
    const matching = this.variants().find(
      (v) => v.color === color && v.size === this.selectedSize() && Number(v.stock_quantity) > 0
    );
    if (!matching) {
      const fallback = this.variants().find((v) => v.color === color && Number(v.stock_quantity) > 0) ||
        this.variants().find((v) => v.color === color);
      if (fallback) {
        this.selectedSize.set(fallback.size);
      }
    }
    this.quantity.set(1);
  }

  onSelectSize(size: string): void {
    this.selectedSize.set(size);
    this.quantity.set(1);
  }

  isSizeAvailable(size: string): boolean {
    const color = this.selectedColor();
    const match = this.variants().find((v) => (!color || v.color === color) && v.size === size);
    return match ? Number(match.stock_quantity) > 0 : false;
  }

  incrementQty(): void {
    const max = this.currentStock();
    if (this.quantity() < max) {
      this.quantity.update((q) => q + 1);
    }
  }

  decrementQty(): void {
    if (this.quantity() > 1) {
      this.quantity.update((q) => q - 1);
    }
  }

  onAddToCart(): void {
    const p = this.product();
    if (!p) return;
    this.cart.addItem(p, this.selectedVariant(), this.quantity(), true);
  }

  onBuyNow(): void {
    const p = this.product();
    if (!p) return;
    this.cart.addItem(p, this.selectedVariant(), this.quantity(), false);
    this.router.navigate(['/checkout']);
  }

  private loadReviews(productId: number): void {
    this.catalog.getProductReviews(productId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.reviews.set(res.data.reviews || []);
          this.reviewSummary.set(res.data.summary || null);
        }
      },
    });
  }

  private loadRelated(categorySlug: string | null, currentProductId: number): void {
    this.catalog.getProducts({ categorySlug, limit: 5 }).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.relatedProducts.set(res.data.filter((p) => p.id !== currentProductId).slice(0, 4));
        }
      },
    });
  }

  submitReview(): void {
    const p = this.product();
    if (!p || !this.newReviewComment.trim()) return;
    this.submittingReview.set(true);
    this.catalog
      .submitReview({
        product_id: p.id,
        rating: this.newReviewRating,
        comment: this.newReviewComment,
      })
      .subscribe({
        next: () => {
          this.submittingReview.set(false);
          this.newReviewComment = '';
          this.toast.success('Thank you for reviewing this piece!');
          this.loadReviews(p.id);
        },
        error: (err) => {
          this.submittingReview.set(false);
          this.toast.error(err?.error?.message || 'Could not submit review.');
        },
      });
  }
}
