import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell">
      <aside class="admin-sidebar" [class.open]="sidebarOpen()">
        <div class="sidebar-brand">
          <a routerLink="/admin/dashboard" class="brand-title">MAVLLIN</a>
          <span class="brand-badge">ADMIN CONSOLE</span>
        </div>

        <nav class="sidebar-nav" (click)="sidebarOpen.set(false)">
          <a routerLink="/admin/dashboard" routerLinkActive="active">
            <span>Dashboard Overview</span>
          </a>
          <a routerLink="/admin/messages" routerLinkActive="active">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Unified Messages</span>
          </a>
          <a routerLink="/admin/products" routerLinkActive="active">
            <span>Products &amp; Variants</span>
          </a>
          <a routerLink="/admin/categories" routerLinkActive="active">
            <span>Categories</span>
          </a>
          <a routerLink="/admin/inventory" routerLinkActive="active">
            <span>Inventory &amp; Stock Audit</span>
          </a>
          <a routerLink="/admin/orders" routerLinkActive="active">
            <span>Orders &amp; COD Status</span>
          </a>
          <a routerLink="/admin/delivery-settings" routerLinkActive="active">
            <span>Delivery Settings</span>
          </a>
          <a routerLink="/admin/customers" routerLinkActive="active">
            <span>Customers</span>
          </a>
          <a routerLink="/admin/coupons" routerLinkActive="active">
            <span>Promo Coupons</span>
          </a>
          <a routerLink="/admin/reports" routerLinkActive="active">
            <span>Sales &amp; Payments</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <a routerLink="/" class="storefront-return">&larr; Return to Storefront</a>
          <button type="button" class="logout-btn" (click)="auth.logout('/admin/login')">
            Sign Out
          </button>
        </div>
      </aside>

      <div class="admin-main">
        <header class="admin-topbar">
          <button
            type="button"
            class="mobile-toggle"
            (click)="sidebarOpen.update(v => !v)"
            aria-label="Toggle admin sidebar"
          >
            &#9776;
          </button>
          <div class="topbar-title">MAVLLIN Backoffice</div>
          <div class="topbar-user">
            <span class="role-pill">{{ auth.user()?.role || 'admin' }}</span>
            <strong>{{ auth.user()?.full_name }}</strong>
          </div>
        </header>

        <div class="admin-content">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 250px 1fr;
      background: #f4f4f5;

      @media (max-width: 991px) {
        grid-template-columns: 1fr;
      }
    }
    .admin-sidebar {
      background: var(--color-onyx);
      color: var(--color-white);
      display: flex;
      flex-direction: column;
      padding: 1.5rem 1.15rem;
      position: sticky;
      top: 0;
      height: 100vh;

      @media (max-width: 991px) {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        width: 260px;
        z-index: 1800;
        transform: translateX(-100%);
        transition: transform 200ms ease;
        &.open {
          transform: translateX(0);
        }
      }
    }
    .sidebar-brand {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid #27272a;
      margin-bottom: 1.25rem;
    }
    .brand-title {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      color: var(--color-white);
    }
    .brand-badge {
      font-size: 0.65rem;
      letter-spacing: 0.16em;
      color: #a1a1aa;
    }
    .sidebar-nav {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;

      a {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.7rem 0.85rem;
        border-radius: var(--radius-sm);
        font-size: 0.85rem;
        font-weight: 500;
        color: #d4d4d8;
        transition: all 150ms ease;

        &:hover {
          background: #27272a;
          color: var(--color-white);
        }
        &.active {
          background: var(--color-white);
          color: var(--color-onyx);
          font-weight: 700;
          .nav-icon {
            stroke: var(--color-onyx);
          }
        }
      }
    }
    .nav-icon {
      width: 17px;
      height: 17px;
      flex-shrink: 0;
      stroke: #a1a1aa;
    }
    .sidebar-footer {
      border-top: 1px solid #27272a;
      padding-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .storefront-return {
      font-size: 0.8rem;
      color: #a1a1aa;
      &:hover { color: var(--color-white); }
    }
    .logout-btn {
      text-align: left;
      font-size: 0.82rem;
      font-weight: 600;
      color: #fda4af;
    }
    .admin-main {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .admin-topbar {
      height: 64px;
      background: var(--color-white);
      border-bottom: 1px solid var(--color-border);
      padding: 0 1.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .mobile-toggle {
      display: none;
      font-size: 1.35rem;
      @media (max-width: 991px) {
        display: inline-flex;
      }
    }
    .topbar-title {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .topbar-user {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-size: 0.85rem;
    }
    .role-pill {
      padding: 0.15rem 0.5rem;
      background: var(--color-emerald-bg);
      color: var(--color-emerald);
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      border-radius: 3px;
    }
    .admin-content {
      padding: 1.75rem;
      flex: 1;
    }
  `],
})
export class AdminLayoutComponent {
  readonly auth = inject(AuthService);
  readonly sidebarOpen = signal<boolean>(false);
}
