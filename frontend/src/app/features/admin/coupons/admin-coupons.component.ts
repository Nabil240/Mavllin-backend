import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Coupon } from '../../../core/models/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-admin-coupons',
  standalone: true,
  imports: [CommonModule, FormsModule, BdtCurrencyPipe],
  template: `
    <div class="admin-coupons">
      <div class="page-head">
        <div>
          <h1 class="section-heading">PROMOTIONAL COUPONS</h1>
          <p class="section-subtitle">Manage discount codes, minimum order rules, and redemption limits</p>
        </div>
      </div>

      <div class="coupons-layout">
        <div class="table-card">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type &amp; Value</th>
                <th>Min Order</th>
                <th>Used / Limit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (c of coupons(); track c.id) {
                <tr>
                  <td><code>{{ c.code }}</code></td>
                  <td class="tabular-price">
                    {{ c.discount_type === 'percentage' ? c.discount_value + '%' : (Number(c.discount_value) | bdt) }}
                  </td>
                  <td class="tabular-price">{{ Number(c.min_order_amount) | bdt }}</td>
                  <td class="tabular-price">{{ c.used_count }} / {{ c.usage_limit || '∞' }}</td>
                  <td>
                    <span class="badge" [class]="c.is_active ? 'badge-stock' : 'badge-danger'">
                      {{ c.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td>
                    <button type="button" class="btn btn-danger btn-sm" (click)="deleteCoupon(c)">Delete</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <form class="form-card" (ngSubmit)="createCoupon()">
          <h3>Create Promo Code</h3>
          <div class="form-group">
            <label class="form-label">Coupon Code *</label>
            <input type="text" name="code" class="form-control" [(ngModel)]="form.code" placeholder="SUMMER25" required />
          </div>
          <div class="form-group">
            <label class="form-label">Discount Type</label>
            <select name="discount_type" class="form-control" [(ngModel)]="form.discount_type">
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (৳)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Discount Value *</label>
            <input type="number" step="0.01" name="discount_value" class="form-control" [(ngModel)]="form.discount_value" required />
          </div>
          <div class="form-group">
            <label class="form-label">Minimum Order Subtotal (৳)</label>
            <input type="number" step="0.01" name="min_order_amount" class="form-control" [(ngModel)]="form.min_order_amount" />
          </div>
          <div class="form-group">
            <label class="form-label">Usage Limit (Optional)</label>
            <input type="number" name="usage_limit" class="form-control" [(ngModel)]="form.usage_limit" placeholder="100" />
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Create Coupon</button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page-head { margin-bottom: 1.5rem; }
    .coupons-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.75rem;
      @media (min-width: 992px) {
        grid-template-columns: 1.35fr 0.65fr;
      }
    }
    .table-card, .form-card {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 1.25rem;
      height: fit-content;
    }
    .form-card h3 { font-size: 0.9rem; text-transform: uppercase; margin-bottom: 1rem; }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      th, td { padding: 0.75rem; border-bottom: 1px solid var(--color-border); text-align: left; }
      th { background: var(--color-alabaster); font-size: 0.72rem; text-transform: uppercase; }
    }
  `],
})
export class AdminCouponsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly coupons = signal<Coupon[]>([]);
  readonly Number = Number;

  form: {
    code: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_order_amount: number;
    usage_limit: number | null;
    is_active: number;
  } = {
    code: '',
    discount_type: 'percentage',
    discount_value: 15,
    min_order_amount: 50,
    usage_limit: 100,
    is_active: 1,
  };

  ngOnInit(): void {
    this.loadCoupons();
  }

  loadCoupons(): void {
    this.adminService.getCoupons().subscribe((res) => {
      if (res.success && Array.isArray(res.data)) {
        this.coupons.set(res.data);
      }
    });
  }

  createCoupon(): void {
    if (!this.form.code.trim()) return;
    this.adminService
      .createCoupon({
        ...this.form,
        code: this.form.code.trim().toUpperCase(),
      })
      .subscribe({
        next: () => {
          this.toast.success('Coupon created.');
          this.form.code = '';
          this.loadCoupons();
        },
        error: (err) => this.toast.error(err?.error?.message || 'Could not create coupon.'),
      });
  }

  deleteCoupon(c: Coupon): void {
    this.adminService.deleteCoupon(c.id).subscribe({
      next: () => {
        this.toast.info(`Deleted coupon ${c.code}.`);
        this.loadCoupons();
      },
    });
  }
}
