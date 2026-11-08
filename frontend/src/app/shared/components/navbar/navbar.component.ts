import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { NgxShinyTextComponent } from '../ngxui';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, NgxShinyTextComponent],
  template: `
    @if (showAnnouncement()) {
      <div class="announcement-bar">
        <div class="container announcement-inner">
          <p>
            <strong>COMPLIMENTARY DELIVERY</strong> ON ORDERS OVER ৳2,500 &bull; USE CODE
            <strong><om-shiny-text text="WELCOME10" [shimmerColor]="'#9a6b32'"></om-shiny-text></strong> FOR 10% OFF &bull; <strong>CASH ON DELIVERY</strong> NATIONWIDE
          </p>
          <button
            type="button"
            class="dismiss-announcement"
            (click)="showAnnouncement.set(false)"
            aria-label="Dismiss announcement"
          >
            &times;
          </button>
        </div>
      </div>
    }

    <header class="site-header">
      <div class="container header-main">
        <div class="header-left">
          <button
            type="button"
            class="mobile-menu-btn"
            (click)="mobileNavOpen.set(true)"
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <form class="desktop-search" (ngSubmit)="onSearch()">
            <input
              type="search"
              name="q"
              [(ngModel)]="searchTerm"
              placeholder="Search shirts, panjabi, SKU..."
              aria-label="Search catalog"
            />
            <button type="submit" aria-label="Submit search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          </form>
        </div>

        <div class="header-center">
          <a routerLink="/" class="brand-logo">
            <span class="logo-main">MAVLLIN</span>
            <span class="logo-tag">DHAKA &bull; CONTEMPORARY ATELIER</span>
          </a>
        </div>

        <div class="header-right">
          @if (auth.isAdmin()) {
            <a routerLink="/admin/dashboard" class="admin-pill">Admin Panel</a>
          }

          <a routerLink="/track-order" class="nav-utility-link hide-sm">Track Order</a>

          @if (auth.isAuthenticated()) {
            <a routerLink="/account" class="icon-action" title="My Account">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span class="action-label hide-md">{{ auth.user()?.full_name?.split(' ')?.[0] }}</span>
            </a>
            <button
              type="button"
              class="logout-action hide-sm"
              (click)="auth.logout()"
              title="Sign Out"
            >
              Sign Out
            </button>
          } @else {
            <a routerLink="/auth/login" class="icon-action" title="Sign In">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span class="action-label hide-md">Sign In</span>
            </a>
          }

          <a routerLink="/wishlist" class="icon-action" aria-label="Wishlist">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            @if (wishlist.count() > 0) {
              <span class="badge-counter">{{ wishlist.count() }}</span>
            }
          </a>

          <button
            type="button"
            class="icon-action cart-trigger"
            (click)="cart.openDrawer()"
            aria-label="Open shopping bag"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <span class="badge-counter dark" [class.anim-bounce]="cartBounced()">{{ cart.totalItems() }}</span>
          </button>
        </div>
      </div>

      <nav class="category-nav" aria-label="Primary Categories">
        <div class="container nav-links">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <a routerLink="/catalog" routerLinkActive="active">All Drops</a>
          <a [routerLink]="['/category', 'heritage-panjabi']" routerLinkActive="active">Heritage Panjabi</a>
          <a [routerLink]="['/category', 'menswear']" routerLinkActive="active">Menswear</a>
          <a [routerLink]="['/category', 'womenswear']" routerLinkActive="active">Womenswear</a>
          <a [routerLink]="['/category', 'outerwear']" routerLinkActive="active">Outerwear</a>
          <a [routerLink]="['/category', 'bottoms-trousers']" routerLinkActive="active">Bottoms &amp; Denim</a>
          <a routerLink="/track-order" routerLinkActive="active">Order Tracker</a>
        </div>
      </nav>
    </header>

    <!-- Mobile Offcanvas Drawer -->
    @if (mobileNavOpen()) {
      <div class="mobile-backdrop" (click)="mobileNavOpen.set(false)"></div>
      <aside class="mobile-drawer">
        <div class="mobile-drawer-head">
          <span class="logo-main">MAVLLIN</span>
          <button type="button" (click)="mobileNavOpen.set(false)" aria-label="Close menu">&times;</button>
        </div>

        <form class="mobile-search" (ngSubmit)="onSearch(); mobileNavOpen.set(false)">
          <input
            type="search"
            name="mobileQ"
            [(ngModel)]="searchTerm"
            placeholder="Search products, SKU..."
          />
          <button type="submit">Go</button>
        </form>

        <nav class="mobile-links">
          <a routerLink="/" (click)="mobileNavOpen.set(false)">Home</a>
          <a routerLink="/catalog" (click)="mobileNavOpen.set(false)">All Seasonal Drops</a>
          <a [routerLink]="['/category', 'heritage-panjabi']" (click)="mobileNavOpen.set(false)">Heritage Panjabi</a>
          <a [routerLink]="['/category', 'menswear']" (click)="mobileNavOpen.set(false)">Menswear</a>
          <a [routerLink]="['/category', 'womenswear']" (click)="mobileNavOpen.set(false)">Womenswear</a>
          <a [routerLink]="['/category', 'outerwear']" (click)="mobileNavOpen.set(false)">Outerwear &amp; Jackets</a>
          <a [routerLink]="['/category', 'bottoms-trousers']" (click)="mobileNavOpen.set(false)">Bottoms &amp; Trousers</a>
          <hr />
          <a routerLink="/track-order" (click)="mobileNavOpen.set(false)">Track Your Order</a>
          <a routerLink="/wishlist" (click)="mobileNavOpen.set(false)">Saved Wishlist ({{ wishlist.count() }})</a>
          @if (auth.isAuthenticated()) {
            <a routerLink="/account" (click)="mobileNavOpen.set(false)">My Account ({{ auth.user()?.full_name }})</a>
            @if (auth.isAdmin()) {
              <a routerLink="/admin/dashboard" (click)="mobileNavOpen.set(false)">Admin Dashboard</a>
            }
            <button type="button" class="mobile-logout" (click)="auth.logout(); mobileNavOpen.set(false)">
              Sign Out
            </button>
          } @else {
            <a routerLink="/auth/login" (click)="mobileNavOpen.set(false)">Sign In / Register</a>
          }
        </nav>
      </aside>
    }

    <!-- Sticky 5-Icon Mobile Bottom Bar -->
    <nav class="mobile-bottom-bar" aria-label="Mobile Quick Navigation">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="bottom-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
        <span>Home</span>
      </a>
      <a routerLink="/catalog" routerLinkActive="active" class="bottom-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span>Catalog</span>
      </a>
      <button type="button" class="bottom-item" (click)="cart.openDrawer()">
        <div class="bottom-icon-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
          </svg>
          @if (cart.totalItems() > 0) {
            <span class="bottom-badge">{{ cart.totalItems() }}</span>
          }
        </div>
        <span>Bag</span>
      </button>
      <a routerLink="/wishlist" routerLinkActive="active" class="bottom-item">
        <div class="bottom-icon-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          @if (wishlist.count() > 0) {
            <span class="bottom-badge">{{ wishlist.count() }}</span>
          }
        </div>
        <span>Wishlist</span>
      </a>
      <a [routerLink]="auth.isAuthenticated() ? '/account' : '/auth/login'" routerLinkActive="active" class="bottom-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span>Account</span>
      </a>
    </nav>
  `,
  styles: [`
    .announcement-bar {
      background: linear-gradient(90deg, #e8decb 0%, #f1e9da 50%, #e8decb 100%);
      color: var(--color-onyx);
      border-bottom: 1px solid var(--color-border-dark);
      font-size: 0.72rem;
      letter-spacing: 0.06em;
      padding: 0.5rem 0;
    }
    .announcement-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      text-align: center;
      padding-right: 2.5rem;
    }
    .dismiss-announcement {
      position: absolute;
      right: 1.25rem;
      color: var(--color-text-muted);
      font-size: 1.1rem;
      line-height: 1;
    }
    .site-header {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: rgba(253, 252, 251, 0.94);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-border);
    }
    .header-main {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      height: 72px;
      gap: 1rem;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .mobile-menu-btn {
      display: inline-flex;
      color: var(--color-onyx);
      padding: 0.25rem;
      @media (min-width: 992px) {
        display: none;
      }
    }
    .desktop-search {
      display: none;
      align-items: center;
      border-bottom: 1px solid var(--color-onyx);
      padding-bottom: 0.2rem;
      width: 230px;

      @media (min-width: 992px) {
        display: flex;
      }
      input {
        border: none;
        background: transparent;
        width: 100%;
        font-size: 0.82rem;
        outline: none;
      }
      button {
        color: var(--color-onyx);
        padding: 0.15rem;
      }
    }
    .header-center {
      text-align: center;
    }
    .brand-logo {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
    }
    .logo-main {
      font-family: var(--font-display);
      font-size: 1.45rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      color: var(--color-onyx);
      line-height: 1;
    }
    .logo-tag {
      font-size: 0.58rem;
      letter-spacing: 0.22em;
      color: var(--color-text-muted);
      margin-top: 0.2rem;
    }
    .header-right {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1.1rem;
    }
    .admin-pill {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 0.3rem 0.65rem;
      background: var(--color-gold-bg);
      color: var(--color-gold);
      border: 1px solid #fcd34d;
      border-radius: 3px;
    }
    .nav-utility-link {
      font-size: 0.78rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      &:hover { color: var(--color-onyx); }
    }
    .icon-action {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--color-onyx);
      font-size: 0.82rem;
      font-weight: 600;
    }
    .logout-action {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-berry, #be123c);
      padding: 0.25rem 0.55rem;
      border: 1px solid rgba(190, 18, 60, 0.25);
      border-radius: 3px;
      background: transparent;
      cursor: pointer;
      transition: all 0.2s ease;
      &:hover {
        background: var(--color-berry, #be123c);
        color: var(--color-white, #fff);
        border-color: var(--color-berry, #be123c);
      }
    }
    .badge-counter {
      position: absolute;
      top: -6px;
      right: -8px;
      min-width: 17px;
      height: 17px;
      padding: 0 4px;
      border-radius: 99px;
      background: var(--color-berry);
      color: var(--color-white);
      font-size: 0.65rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;

      &.dark {
        background: var(--color-onyx);
      }
    }
    .category-nav {
      display: none;
      border-top: 1px solid var(--color-border);
      background: var(--color-alabaster);

      @media (min-width: 992px) {
        display: block;
      }
    }
    .nav-links {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2.25rem;
      height: 44px;

      a {
        font-family: var(--font-display);
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-muted);
        position: relative;
        padding: 0.25rem 0;

        &:hover,
        &.active {
          color: var(--color-onyx);
        }
        &::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: -9px;
          height: 2px;
          background: var(--color-onyx);
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        &:hover::after,
        &.active::after {
          transform: scaleX(1);
        }
      }
    }
    .hide-sm {
      @media (max-width: 767px) { display: none; }
    }
    .hide-md {
      @media (max-width: 991px) { display: none; }
    }

    /* Mobile Drawer */
    .mobile-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(24, 24, 27, 0.5);
      z-index: 1600;
      animation: fadeIn 180ms ease;
    }
    .mobile-drawer {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 300px;
      background: var(--color-white);
      z-index: 1610;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      overflow-y: auto;
      animation: drawerSlideRight 260ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes drawerSlideRight {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }
    .mobile-drawer-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 0.85rem;

      button {
        font-size: 1.65rem;
        line-height: 1;
      }
    }
    .mobile-search {
      display: flex;
      gap: 0.4rem;
      input {
        flex: 1;
        padding: 0.55rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
      }
      button {
        padding: 0 0.9rem;
        background: var(--color-onyx);
        color: var(--color-white);
        font-size: 0.78rem;
        font-weight: 600;
        border-radius: var(--radius-sm);
      }
    }
    .mobile-links {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      a, .mobile-logout {
        font-family: var(--font-display);
        font-size: 0.9rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-onyx);
        text-align: left;
      }
      hr {
        border: none;
        border-top: 1px solid var(--color-border);
        margin: 0.25rem 0;
      }
      .mobile-logout {
        color: var(--color-berry);
      }
    }

    /* Sticky Mobile Bottom Bar */
    .mobile-bottom-bar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      height: 60px;
      background: var(--color-white);
      border-top: 1px solid var(--color-border);
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      z-index: 1200;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.04);

      @media (min-width: 992px) {
        display: none;
      }
    }
    .bottom-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      font-size: 0.65rem;
      font-weight: 600;
      color: var(--color-text-muted);

      &.active {
        color: var(--color-onyx);
      }
    }
    .bottom-icon-wrap {
      position: relative;
      display: inline-flex;
    }
    .bottom-badge {
      position: absolute;
      top: -5px;
      right: -8px;
      min-width: 15px;
      height: 15px;
      border-radius: 99px;
      background: var(--color-onyx);
      color: var(--color-white);
      font-size: 0.6rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `],
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly wishlist = inject(WishlistService);
  private readonly router = inject(Router);

  readonly showAnnouncement = signal<boolean>(true);
  readonly mobileNavOpen = signal<boolean>(false);
  readonly cartBounced = signal<boolean>(false);
  searchTerm = '';

  constructor() {
    let prev = 0;
    effect(() => {
      const curr = this.cart.totalItems();
      if (curr > prev && prev !== 0) {
        this.cartBounced.set(true);
        setTimeout(() => this.cartBounced.set(false), 400);
      }
      prev = curr;
    });
  }

  onSearch(): void {
    const q = this.searchTerm.trim();
    if (!q) {
      this.router.navigate(['/catalog']);
      return;
    }
    this.router.navigate(['/search'], { queryParams: { search: q } });
  }
}
