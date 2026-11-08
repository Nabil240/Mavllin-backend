import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardData } from '../../../core/models/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, BdtCurrencyPipe],
  template: `
    <div class="admin-dashboard">
      <div class="page-head">
        <div>
          <h1 class="section-heading">EXECUTIVE DASHBOARD</h1>
          <p class="section-subtitle">Real-time store performance, inventory alerts, and Cash on Delivery fulfillment</p>
        </div>
        <div class="head-actions">
          <a routerLink="/admin/products" class="btn btn-primary btn-sm">+ New Product</a>
          <a routerLink="/admin/orders" class="btn btn-outline btn-sm">Manage Orders</a>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-box">Loading real-time metrics...</div>
      } @else if (data()) {
        @let d = data()!;
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Total Revenue</span>
            <strong class="kpi-value tabular-price">{{ Number(d.stats.total_revenue) | bdt }}</strong>
            <span class="kpi-sub">Excluding cancelled orders</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Total Orders</span>
            <strong class="kpi-value tabular-price">{{ d.stats.total_orders }}</strong>
            <span class="kpi-sub">{{ d.stats.pending_orders }} pending fulfillment</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Catalog Products</span>
            <strong class="kpi-value tabular-price">{{ d.stats.total_products }}</strong>
            <span class="kpi-sub">Multi-variant active styles</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Registered Clients</span>
            <strong class="kpi-value tabular-price">{{ d.stats.total_customers }}</strong>
            <span class="kpi-sub">Verified accounts</span>
          </div>
          <div class="kpi-card alert">
            <span class="kpi-label">Low-Stock Alerts</span>
            <strong class="kpi-value tabular-price">{{ d.stats.low_stock_count }}</strong>
            <a routerLink="/admin/inventory" class="kpi-link">Adjust Stock &rarr;</a>
          </div>
        </div>

        <div class="dash-grid-2">
          <!-- Monthly Revenue Visual Chart -->
          <section class="panel-card">
            <div class="panel-head">
              <h3>Monthly Revenue Performance</h3>
              <a routerLink="/admin/reports">Full Sales Report &rarr;</a>
            </div>
            @if (d.monthly_revenue && d.monthly_revenue.length > 0) {
              <div class="bar-chart">
                @for (m of d.monthly_revenue; track m.month) {
                  <div class="bar-col">
                    <div class="bar-val tabular-price">{{ Number(m.revenue) | bdt }}</div>
                    <div class="bar-track">
                      <div class="bar-fill" [style.height.%]="barHeight(Number(m.revenue))"></div>
                    </div>
                    <div class="bar-label">{{ m.month }}</div>
                  </div>
                }
              </div>
            } @else {
              <p class="muted">Revenue chart populates as orders are placed.</p>
            }
          </section>

          <!-- Low Stock Variants Table -->
          <section class="panel-card">
            <div class="panel-head">
              <h3>Low-Stock Variant Alerts</h3>
              <a routerLink="/admin/inventory">Open Inventory &rarr;</a>
            </div>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Product / Variant</th>
                  <th>SKU</th>
                  <th>Stock Left</th>
                </tr>
              </thead>
              <tbody>
                @for (item of d.low_stock_products; track item.sku || item.id) {
                  <tr>
                    <td>
                      <strong>{{ item.name }}</strong>
                      @if (item.size || item.color) {
                        <div class="sub-text">{{ item.size }} {{ item.color }}</div>
                      }
                    </td>
                    <td><code>{{ item.sku }}</code></td>
                    <td>
                      <span class="badge" [class]="item.stock_quantity === 0 ? 'badge-danger' : 'badge-warning'">
                        {{ item.stock_quantity }} left
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        </div>

        <div class="dash-grid-2">
          <!-- Recent Orders -->
          <section class="panel-card">
            <div class="panel-head">
              <h3>Recent Orders (Cash on Delivery)</h3>
              <a routerLink="/admin/orders">All Orders &rarr;</a>
            </div>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                @for (ord of d.recent_orders; track ord.id) {
                  <tr>
                    <td><strong>{{ ord.order_number }}</strong></td>
                    <td>{{ ord.customer_name || ord.guest_email || 'Guest Client' }}</td>
                    <td><span class="badge" [class]="'badge-' + ord.status">{{ ord.status }}</span></td>
                    <td><span class="badge" [class]="'badge-' + ord.payment_status">{{ ord.payment_status }}</span></td>
                    <td class="tabular-price font-bold">{{ Number(ord.total_amount) | bdt }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>

          <!-- Top Selling Products -->
          <section class="panel-card">
            <div class="panel-head">
              <h3>Top Selling Garments</h3>
              <a routerLink="/admin/products">Manage Catalog &rarr;</a>
            </div>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Units Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                @for (prod of d.top_products; track prod.id) {
                  <tr>
                    <td><strong>{{ prod.name }}</strong></td>
                    <td class="tabular-price">{{ prod.total_sold }}</td>
                    <td class="tabular-price font-bold">{{ Number(prod.total_revenue) | bdt }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1.75rem;
      .head-actions { display: flex; gap: 0.65rem; }
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.75rem;
    }
    .kpi-card {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      &.alert { border-left: 4px solid var(--color-berry); }
      .kpi-label { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); font-weight: 700; }
      .kpi-value { font-size: 1.65rem; color: var(--color-onyx); }
      .kpi-sub { font-size: 0.76rem; color: var(--color-text-light); }
      .kpi-link { font-size: 0.76rem; font-weight: 700; color: var(--color-berry); }
    }
    .dash-grid-2 {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
      @media (min-width: 1024px) {
        grid-template-columns: 1fr 1fr;
      }
    }
    .panel-card {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 1.35rem;
    }
    .panel-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.15rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--color-border);
      h3 { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.06em; }
      a { font-size: 0.78rem; font-weight: 700; color: var(--color-onyx); }
    }
    .bar-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      height: 210px;
      padding-top: 1.5rem;
      gap: 0.75rem;
    }
    .bar-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      .bar-val { font-size: 0.7rem; font-weight: 700; margin-bottom: 0.35rem; }
      .bar-track {
        flex: 1;
        width: 100%;
        max-width: 38px;
        background: var(--color-alabaster);
        border-radius: 3px 3px 0 0;
        display: flex;
        align-items: flex-end;
        overflow: hidden;
      }
      .bar-fill {
        width: 100%;
        background: var(--color-onyx);
        min-height: 6px;
        transition: height 300ms ease;
      }
      .bar-label { font-size: 0.7rem; color: var(--color-text-muted); margin-top: 0.4rem; }
    }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.84rem;
      th, td {
        padding: 0.65rem 0.5rem;
        border-bottom: 1px solid var(--color-border);
        text-align: left;
      }
      th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); }
      .sub-text { font-size: 0.74rem; color: var(--color-text-muted); }
      .font-bold { font-weight: 700; }
    }
  `],
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly data = signal<DashboardData | null>(null);
  readonly loading = signal<boolean>(true);
  readonly Number = Number;

  readonly maxMonthlyRev = computed(() => {
    const list = this.data()?.monthly_revenue || [];
    const max = Math.max(...list.map((m) => Number(m.revenue || 0)), 1);
    return max;
  });

  ngOnInit(): void {
    this.adminService.getDashboard().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.data.set(res.data);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  barHeight(val: number): number {
    return Math.max(8, Math.round((val / this.maxMonthlyRev()) * 100));
  }
}
