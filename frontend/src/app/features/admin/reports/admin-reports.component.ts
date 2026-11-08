import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../core/services/admin.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, BdtCurrencyPipe],
  template: `
    <div class="admin-reports">
      <div class="page-head">
        <div>
          <h1 class="section-heading">SALES REPORTS &amp; COD RECONCILIATION</h1>
          <p class="section-subtitle">Financial breakdown of orders, revenue by status, and payment records</p>
        </div>
      </div>

      @if (salesReport()) {
        <div class="report-cards">
          <div class="r-card">
            <span>Gross Revenue</span>
            <strong class="tabular-price">{{ Number(salesReport()!['total_revenue'] || salesReport()!['gross_revenue'] || 0) | bdt }}</strong>
          </div>
          <div class="r-card">
            <span>Total Orders Count</span>
            <strong class="tabular-price">{{ salesReport()!['total_orders'] || 0 }}</strong>
          </div>
          <div class="r-card">
            <span>Average Order Value</span>
            <strong class="tabular-price">{{ Number(salesReport()!['average_order_value'] || 0) | bdt }}</strong>
          </div>
        </div>
      }

      <div class="table-card">
        <h3>Payment Records (Cash on Delivery Ledger)</h3>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Order #</th>
              <th>Provider</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            @for (p of payments(); track p['id']) {
              <tr>
                <td>#{{ p['id'] }}</td>
                <td><strong>{{ p['order_number'] || 'Order #' + p['order_id'] }}</strong></td>
                <td><span class="badge badge-dark">{{ p['provider'] || 'cod' }}</span></td>
                <td class="tabular-price font-bold">{{ Number(p['amount'] || 0) | bdt }}</td>
                <td>
                  <span class="badge" [class]="p['status'] === 'succeeded' || p['status'] === 'paid' ? 'badge-stock' : 'badge-warning'">
                    {{ p['status'] }}
                  </span>
                </td>
                <td>{{ $any(p['created_at']) | date:'medium' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page-head { margin-bottom: 1.5rem; }
    .report-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1.75rem;
    }
    .r-card {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      span { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); font-weight: 700; }
      strong { font-size: 1.65rem; }
    }
    .table-card {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 1.25rem;
      overflow-x: auto;
      h3 { font-size: 0.9rem; text-transform: uppercase; margin-bottom: 1rem; }
    }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      th, td { padding: 0.75rem; border-bottom: 1px solid var(--color-border); text-align: left; }
      th { background: var(--color-alabaster); font-size: 0.72rem; text-transform: uppercase; }
      .font-bold { font-weight: 700; }
    }
  `],
})
export class AdminReportsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly salesReport = signal<Record<string, unknown> | null>(null);
  readonly payments = signal<Array<Record<string, unknown>>>([]);
  readonly Number = Number;

  ngOnInit(): void {
    this.adminService.getSalesReport().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.salesReport.set((res.data['summary'] as Record<string, unknown>) || res.data);
        }
      },
    });

    this.adminService.getPayments().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.payments.set(res.data);
        }
      },
    });
  }
}
