import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
  NgZone,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Banner, Category, Product } from '../../../core/models/api.models';
import { CatalogService } from '../../../core/services/catalog.service';
import { SeoService } from '../../../core/services/seo.service';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import {
  NgxBackgroundBeamsComponent,
  NgxBorderBeamComponent,
  NgxMarqueeComponent,
  NgxShinyTextComponent,
} from '../../../shared/components/ngxui';

interface ShowcaseTab {
  key: string;
  label: string;
  slug: string | null;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ProductCardComponent,
    NgxBackgroundBeamsComponent,
    NgxBorderBeamComponent,
    NgxMarqueeComponent,
    NgxShinyTextComponent,
  ],
  template: `
    <!-- Hero Slider with 5s Auto-Rotation and Smooth CSS Cross-Fade -->
    <!-- Hero Slider with NgxUI Background Beams & 5s Auto-Rotation -->
    <section class="hero-section">
      <om-background-beams></om-background-beams>
      @if (banners().length > 0) {
        <div
          class="hero-slider-track"
          (mouseenter)="pauseCarousel()"
          (mouseleave)="resumeCarousel()"
          (focusin)="pauseCarousel()"
          (focusout)="resumeCarousel()"
        >
          @for (banner of banners(); track banner.id; let idx = $index) {
            <div
              class="hero-slide"
              [class.active]="idx === activeSlide()"
              [attr.aria-hidden]="idx !== activeSlide()"
            >
              <img
                class="hero-bg"
                [src]="banner.image_url || '/uploads/products/banner-hero-1.svg'"
                [alt]="banner.title"
              />
              <div class="hero-overlay">
                <div class="container hero-content">
                  @if (banner.badge_text) {
                    <span class="hero-kicker">
                      <om-shiny-text [text]="banner.badge_text" [shimmerColor]="'#ffffff'"></om-shiny-text>
                    </span>
                  }
                  <h1 class="hero-title">{{ banner.title }}</h1>
                  @if (banner.subtitle) {
                    <p class="hero-subtitle">{{ banner.subtitle }}</p>
                  }
                  <div class="hero-actions">
                    <a [routerLink]="banner.cta_link || '/catalog'" class="btn btn-primary btn-lg btn-shimmer">
                      {{ banner.cta_text || 'Explore Collection' }}
                    </a>
                    <a routerLink="/catalog" class="btn btn-outline btn-lg hero-secondary-btn">
                      View Lookbook
                    </a>
                  </div>
                </div>
              </div>
            </div>
          }

          @if (banners().length > 1) {
            <div class="hero-controls container">
              <div class="hero-dots">
                @for (b of banners(); track b.id; let idx = $index) {
                  <button
                    type="button"
                    class="dot-btn"
                    [class.active]="idx === activeSlide()"
                    (click)="goToSlide(idx)"
                    [attr.aria-label]="'Go to slide ' + (idx + 1)"
                  ></button>
                }
              </div>
              <div class="hero-arrows">
                <button type="button" (click)="prevSlide()" aria-label="Previous slide">&larr;</button>
                <button type="button" (click)="nextSlide()" aria-label="Next slide">&rarr;</button>
              </div>
            </div>
          }
        </div>
      }
    </section>

    <!-- Trust Highlights Strip (Bangladeshi Commerce & BDT Guarantees with NgxUI Infinite Marquee) -->
    <section class="trust-strip">
      <om-marquee [animationDuration]="'32s'" [pauseOnHover]="true" [marqueeGap]="'2.5rem'">
        <div class="trust-item">
          <strong>CASH ON DELIVERY</strong>
          <span>Doorstep payment &amp; inspection nationwide</span>
        </div>
        <div class="trust-item">
          <strong>DHAKA METRO DISPATCH</strong>
          <span>24–48hr delivery inside Dhaka (৳70) &bull; Free over ৳2,500</span>
        </div>
        <div class="trust-item">
          <strong>7-DAY EASY EXCHANGE</strong>
          <span>Complimentary size exchange on unworn garments</span>
        </div>
        <div class="trust-item">
          <strong>SMALL-BATCH ATELIER</strong>
          <span>Artisanal weaves, organic cotton &amp; breathable linen</span>
        </div>
      </om-marquee>
    </section>

    <!-- Category Shortcut Tiles -->
    <section class="section-block container">
      <div class="section-head">
        <div>
          <h2 class="section-heading">CURATED DEPARTMENTS</h2>
          <p class="section-subtitle">Explore contemporary silhouettes tailored for everyday refinement</p>
        </div>
        <a routerLink="/catalog" class="link-arrow">View Full Archive &rarr;</a>
      </div>

      <div class="category-grid">
        @for (cat of displayedCategories(); track cat.id) {
          <a [routerLink]="['/category', cat.slug]" class="category-tile ngx-spotlight-card">
            <img
              [src]="cat.image_url || '/uploads/products/cat-mens.svg'"
              [alt]="cat.name"
              loading="lazy"
            />
            <div class="category-tile-overlay">
              <h3>{{ cat.name }}</h3>
              <span>Explore &rarr;</span>
            </div>
          </a>
        }
      </div>
    </section>

    <!-- Interactive Tabbed Product Showcase -->
    <section class="section-block container">
      <div class="showcase-header">
        <div>
          <h2 class="section-heading">SEASONAL DROPS &amp; EDITS</h2>
          <p class="section-subtitle">Filter by department to browse ready-to-ship garments</p>
        </div>

        <div class="showcase-tabs" role="tablist">
          @for (tab of showcaseTabs; track tab.key) {
            <button
              type="button"
              role="tab"
              class="tab-pill"
              [class.active]="activeTab() === tab.key"
              (click)="selectTab(tab)"
            >
              {{ tab.label }}
            </button>
          }
        </div>
      </div>

      @if (loadingProducts()) {
        <div class="products-grid">
          @for (n of [1,2,3,4,5,6,7,8]; track n) {
            <div class="skeleton-card"></div>
          }
        </div>
      } @else if (showcaseProducts().length === 0) {
        <div class="empty-showcase">
          <p>No products found in this department.</p>
          <button type="button" class="btn btn-outline btn-sm" (click)="selectTab(showcaseTabs[0])">
            Show All Drops
          </button>
        </div>
      } @else {
        <div class="products-grid">
          @for (product of showcaseProducts(); track product.id) {
            <app-product-card [product]="product" />
          }
        </div>
      }

      <div class="showcase-footer">
        <a
          [routerLink]="activeTabSlug() ? ['/category', activeTabSlug()] : ['/catalog']"
          class="btn btn-outline btn-lg"
        >
          View All {{ activeTabLabel() }}
        </a>
      </div>
    </section>

    <!-- Split 50/50 Editorial Lookbook Banners with NgxUI Border Beam -->
    <section class="section-block container">
      <div class="duo-banners">
        <div class="promo-card ngx-spotlight-card">
          <om-border-beam [gradientColorStart]="'#e8decb'" [gradientColorEnd]="'#9a6b32'" [animationDuration]="'9s'"></om-border-beam>
          <img src="/uploads/products/prod-panjabi-1.svg" alt="Heritage Panjabi Atelier" loading="lazy" />
          <div class="promo-overlay">
            <span class="promo-tag">
              <om-shiny-text text="FESTIVE & FRIDAY EDIT" [shimmerColor]="'#ffffff'"></om-shiny-text>
            </span>
            <h3>THE HERITAGE PANJABI</h3>
            <p>Intricate tonal geometric embroidery on breathable long-staple cotton.</p>
            <a [routerLink]="['/category', 'heritage-panjabi']" class="btn btn-primary btn-shimmer">
              Shop Heritage Panjabi
            </a>
          </div>
        </div>

        <div class="promo-card ngx-spotlight-card">
          <om-border-beam [gradientColorStart]="'#e8decb'" [gradientColorEnd]="'#9a6b32'" [animationDuration]="'9s'"></om-border-beam>
          <img src="/uploads/products/prod-overshirt-1.svg" alt="Structured Outerwear & Linen" loading="lazy" />
          <div class="promo-overlay">
            <span class="promo-tag">
              <om-shiny-text text="UTILITY TAILORING" [shimmerColor]="'#ffffff'"></om-shiny-text>
            </span>
            <h3>OVERSHIRTS &amp; RELAXED DENIM</h3>
            <p>Architectural layering pieces built for year-round versatility.</p>
            <a [routerLink]="['/category', 'outerwear']" class="btn btn-primary btn-shimmer">
              Explore Outerwear
            </a>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .hero-section {
      position: relative;
      background: var(--color-onyx);
      overflow: hidden;

      om-background-beams {
        z-index: 2;
      }
    }
    .hero-slider-track {
      position: relative;
      min-height: 520px;
      height: 70vh;
      max-height: 680px;
      overflow: hidden;
    }
    .hero-slide {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 700ms ease, visibility 700ms ease;

      &.active {
        opacity: 1;
        visibility: visible;
      }
    }
    .hero-slide.active .hero-bg {
      animation: heroKenBurns 5.8s ease-out forwards;
    }
    .hero-slide.active .hero-kicker {
      animation: heroFadeUp 650ms cubic-bezier(0.16, 1, 0.3, 1) 60ms both;
    }
    .hero-slide.active .hero-title {
      animation: heroFadeUp 700ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both;
    }
    .hero-slide.active .hero-subtitle {
      animation: heroFadeUp 700ms cubic-bezier(0.16, 1, 0.3, 1) 240ms both;
    }
    .hero-slide.active .hero-actions {
      animation: heroFadeUp 700ms cubic-bezier(0.16, 1, 0.3, 1) 330ms both;
    }
    @keyframes heroFadeUp {
      from {
        opacity: 0;
        transform: translateY(22px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes heroKenBurns {
      from {
        transform: scale(1);
      }
      to {
        transform: scale(1.08);
      }
    }
    @keyframes dotProgress {
      from {
        transform: scaleX(0);
      }
      to {
        transform: scaleX(1);
      }
    }
    @keyframes cardCascadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .hero-slide {
        transition: none !important;
      }
      .hero-slide.active .hero-bg,
      .hero-slide.active .hero-kicker,
      .hero-slide.active .hero-title,
      .hero-slide.active .hero-subtitle,
      .hero-slide.active .hero-actions {
        animation: none !important;
      }
    }
    .hero-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.55;
      z-index: 1;
    }
    .hero-overlay {
      position: relative;
      z-index: 3;
      width: 100%;
      color: var(--color-white);
    }
    .hero-content {
      max-width: 720px;
      margin: 0;
    }
    .hero-kicker {
      display: inline-block;
      padding: 0.3rem 0.75rem;
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.3);
      font-family: var(--font-display);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      margin-bottom: 1rem;
      border-radius: 2px;
    }
    .hero-title {
      font-size: clamp(2rem, 4.5vw, 3.5rem);
      color: var(--color-white);
      letter-spacing: 0.04em;
      line-height: 1.08;
      margin-bottom: 1rem;
    }
    .hero-subtitle {
      font-size: 1.05rem;
      color: rgba(255, 255, 255, 0.86);
      max-width: 540px;
      margin-bottom: 1.85rem;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem;
    }
    .hero-actions .btn-primary {
      background: var(--color-white);
      color: var(--color-onyx);
      border-color: var(--color-white);
    }
    .hero-secondary-btn {
      color: var(--color-white);
      border-color: rgba(255, 255, 255, 0.6);
      &:hover {
        background: var(--color-white);
        color: var(--color-onyx);
      }
    }
    .hero-controls {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 1.5rem;
      z-index: 4;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .hero-dots {
      display: flex;
      gap: 0.5rem;
    }
    .dot-btn {
      position: relative;
      width: 28px;
      height: 3px;
      background: rgba(255, 255, 255, 0.32);
      transition: width 300ms cubic-bezier(0.16, 1, 0.3, 1), background-color 300ms ease;
      cursor: pointer;
      border: none;
      padding: 0;
      overflow: hidden;
      border-radius: 99px;
      &.active {
        width: 48px;
        background: rgba(255, 255, 255, 0.35);
      }
      &.active::after {
        content: '';
        position: absolute;
        inset: 0;
        background: var(--color-white);
        transform-origin: left center;
        animation: dotProgress 5000ms linear forwards;
      }
    }
    .hero-arrows {
      display: flex;
      gap: 0.5rem;
      button {
        width: 38px;
        height: 38px;
        border: 1px solid rgba(255, 255, 255, 0.4);
        background: transparent;
        color: var(--color-white);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all var(--transition);
        &:hover {
          background: var(--color-white);
          color: var(--color-onyx);
        }
      }
    }

    /* Trust Strip with NgxUI Marquee */
    .trust-strip {
      background: linear-gradient(90deg, #f3ede2 0%, #ede3d2 50%, #f3ede2 100%);
      border-bottom: 1px solid var(--color-border-dark);
      padding: 0.95rem 0;
      overflow: hidden;
    }
    .trust-item {
      display: inline-flex;
      flex-direction: column;
      gap: 0.2rem;
      padding: 0.4rem 1.25rem;
      border-left: 2px solid var(--color-onyx);
      white-space: nowrap;
      min-width: max-content;
      flex-shrink: 0;
      transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1), border-color 250ms ease;

      &:hover {
        transform: translateY(-2px);
      }

      strong {
        font-family: var(--font-display);
        font-size: 0.78rem;
        letter-spacing: 0.08em;
        color: var(--color-onyx);
      }
      span {
        font-size: 0.78rem;
        color: var(--color-text-muted);
      }
    }

    .section-block {
      padding-top: 3.75rem;
    }
    .section-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-end;
      gap: 1rem;
      margin-bottom: 1.75rem;
    }
    .link-arrow {
      font-family: var(--font-display);
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-onyx);
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease;
      &:hover {
        transform: translateX(4px);
      }
    }

    /* Category Grid */
    .category-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      @media (min-width: 768px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (min-width: 1024px) {
        grid-template-columns: repeat(6, 1fr);
      }
    }
    .category-tile {
      position: relative;
      aspect-ratio: 4 / 5;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      animation: cardCascadeIn 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
      transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 320ms ease;

      &:nth-child(1) { animation-delay: 40ms; }
      &:nth-child(2) { animation-delay: 95ms; }
      &:nth-child(3) { animation-delay: 150ms; }
      &:nth-child(4) { animation-delay: 205ms; }
      &:nth-child(5) { animation-delay: 260ms; }
      &:nth-child(6) { animation-delay: 315ms; }

      &:hover {
        transform: translateY(-5px);
        box-shadow: 0 14px 28px -8px rgba(24, 24, 27, 0.18);
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 650ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      &:hover img {
        transform: scale(1.08);
      }
      &:hover .category-tile-overlay span {
        transform: translateX(4px);
        opacity: 1;
      }
    }
    .category-tile-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(24, 24, 27, 0.84) 0%, rgba(24, 24, 27, 0.1) 60%);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 1rem;
      color: var(--color-white);

      h3 {
        color: var(--color-white);
        font-size: 0.92rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      span {
        font-size: 0.72rem;
        opacity: 0.82;
        margin-top: 0.15rem;
        display: inline-block;
        transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease;
      }
    }

    /* Tabbed Showcase */
    .showcase-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-end;
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .showcase-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .tab-pill {
      padding: 0.55rem 1.15rem;
      font-family: var(--font-display);
      font-size: 0.78rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border-dark);
      border-radius: 99px;
      color: var(--color-text-muted);
      transition: all var(--transition);

      &:hover {
        background: var(--color-beige);
        border-color: var(--color-onyx);
        color: var(--color-onyx);
      }
      &.active {
        background: var(--color-onyx);
        color: var(--color-white);
        border-color: var(--color-onyx);
      }
    }
    .products-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;
      @media (min-width: 768px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (min-width: 1024px) {
        grid-template-columns: repeat(4, 1fr);
        gap: 1.5rem;
      }

      & > * {
        animation: cardCascadeIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      & > *:nth-child(1) { animation-delay: 30ms; }
      & > *:nth-child(2) { animation-delay: 80ms; }
      & > *:nth-child(3) { animation-delay: 130ms; }
      & > *:nth-child(4) { animation-delay: 180ms; }
      & > *:nth-child(5) { animation-delay: 230ms; }
      & > *:nth-child(6) { animation-delay: 280ms; }
      & > *:nth-child(7) { animation-delay: 330ms; }
      & > *:nth-child(8) { animation-delay: 380ms; }
    }
    .skeleton-card {
      aspect-ratio: 3 / 4;
      background: linear-gradient(90deg, #f3ede2 25%, #e8decb 50%, #f3ede2 75%);
      background-size: 200% 100%;
      border-radius: var(--radius-sm);
      animation: shimmerWave 1.5s infinite linear;
    }
    .empty-showcase {
      text-align: center;
      padding: 3rem 1rem;
      background: var(--color-alabaster);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .showcase-footer {
      margin-top: 2.5rem;
      text-align: center;
    }

    /* Duo Banners */
    .duo-banners {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      @media (min-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .promo-card {
      position: relative;
      min-height: 360px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: var(--color-onyx);
      display: flex;
      align-items: flex-end;
      transition: transform 350ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 350ms ease;
      animation: cardCascadeIn 650ms cubic-bezier(0.16, 1, 0.3, 1) both;

      &:nth-child(1) { animation-delay: 80ms; }
      &:nth-child(2) { animation-delay: 180ms; }

      &:hover {
        transform: translateY(-5px);
        box-shadow: 0 18px 36px -10px rgba(24, 24, 27, 0.25);
      }

      img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.55;
        transition: transform 750ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease;
      }
      &:hover img {
        transform: scale(1.06);
        opacity: 0.65;
      }
    }
    .promo-overlay {
      position: relative;
      z-index: 2;
      padding: 2.25rem;
      color: var(--color-white);
      max-width: 480px;

      .promo-tag {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        opacity: 0.85;
      }
      h3 {
        color: var(--color-white);
        font-size: 1.65rem;
        margin: 0.4rem 0 0.6rem;
        letter-spacing: 0.04em;
      }
      p {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.85);
        margin-bottom: 1.25rem;
      }
      .btn-primary {
        background: var(--color-white);
        color: var(--color-onyx);
        border-color: var(--color-white);
      }
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
  `],
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly catalog = inject(CatalogService);
  private readonly seoService = inject(SeoService);
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  readonly banners = signal<Banner[]>([]);
  readonly activeSlide = signal<number>(0);
  readonly categories = signal<Category[]>([]);
  readonly showcaseProducts = signal<Product[]>([]);
  readonly loadingProducts = signal<boolean>(true);

  private autoSlideTimer: ReturnType<typeof setInterval> | null = null;
  private isPaused = false;

  readonly showcaseTabs: ShowcaseTab[] = [
    { key: 'all', label: 'All Drops', slug: null },
    { key: 'heritage-panjabi', label: 'Heritage Panjabi', slug: 'heritage-panjabi' },
    { key: 'menswear', label: 'Menswear', slug: 'menswear' },
    { key: 'womenswear', label: 'Womenswear', slug: 'womenswear' },
    { key: 'outerwear', label: 'Outerwear', slug: 'outerwear' },
  ];

  readonly activeTab = signal<string>('all');

  readonly activeTabSlug = computed(() => {
    const found = this.showcaseTabs.find((t) => t.key === this.activeTab());
    return found?.slug || null;
  });

  readonly activeTabLabel = computed(() => {
    const found = this.showcaseTabs.find((t) => t.key === this.activeTab());
    return found?.label || 'Collection';
  });

  readonly displayedCategories = computed(() => this.categories().slice(0, 6));

  ngOnInit(): void {
    this.seoService.updateSeo({
      title: 'MAVLLIN — Contemporary Fashion & Heritage Essentials',
      description:
        'Contemporary Bangladeshi atelier offering heritage panjabis, tailored shirts, minimal essentials, and ready-to-wear garments with nationwide Cash on Delivery.',
    });

    this.catalog.getBanners().subscribe((res) => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        this.banners.set(res.data);
        this.startCarouselTimer();
      }
    });

    this.catalog.getCategories(true).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.categories.set(res.data);
        }
      },
    });

    this.loadShowcaseProducts(null);
  }

  ngOnDestroy(): void {
    this.clearCarouselTimer();
  }

  startCarouselTimer(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.clearCarouselTimer();
    this.ngZone.runOutsideAngular(() => {
      this.autoSlideTimer = setInterval(() => {
        if (!this.isPaused && this.banners().length > 1) {
          this.ngZone.run(() => {
            this.nextSlide(false);
          });
        }
      }, 5000);
    });
  }

  clearCarouselTimer(): void {
    if (this.autoSlideTimer !== null) {
      clearInterval(this.autoSlideTimer);
      this.autoSlideTimer = null;
    }
  }

  pauseCarousel(): void {
    this.isPaused = true;
  }

  resumeCarousel(): void {
    this.isPaused = false;
  }

  goToSlide(index: number): void {
    this.activeSlide.set(index);
    this.startCarouselTimer();
  }

  nextSlide(resetTimer = true): void {
    const total = this.banners().length;
    if (total <= 1) return;
    this.activeSlide.update((i) => (i + 1) % total);
    if (resetTimer) {
      this.startCarouselTimer();
    }
  }

  prevSlide(): void {
    const total = this.banners().length;
    if (total <= 1) return;
    this.activeSlide.update((i) => (i - 1 + total) % total);
    this.startCarouselTimer();
  }

  selectTab(tab: ShowcaseTab): void {
    this.activeTab.set(tab.key);
    this.loadShowcaseProducts(tab.slug);
  }

  private loadShowcaseProducts(categorySlug: string | null): void {
    this.loadingProducts.set(true);
    this.catalog
      .getProducts({
        limit: 8,
        categorySlug: categorySlug || undefined,
        sort: 'newest',
      })
      .subscribe({
        next: (res) => {
          this.loadingProducts.set(false);
          if (res.success && Array.isArray(res.data)) {
            this.showcaseProducts.set(res.data);
          }
        },
        error: () => {
          this.loadingProducts.set(false);
        },
      });
  }
}
