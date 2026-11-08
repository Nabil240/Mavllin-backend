import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryMovement, ProductVariant } from '../../../core/models/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-admin-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, BdtCurrencyPipe],
  template: `
    <div class="admin-inventory">
      <div class="page-head">
        <div>
          <h1 class="section-heading">INVENTORY &amp; STOCK AUDIT TRAIL</h1>
          <p class="section-subtitle">Track stock per SKU variant and record audited manual adjustments</p>
        </div>
        <div class="tab-switch">
          <button
            type="button"
            class="btn btn-sm"
            [class.btn-primary]="activeTab() === 'stock'"
            [class.btn-secondary]="activeTab() !== 'stock'"
            (click)="activeTab.set('stock')"
          >
            Variant Stock Levels
          </button>
          <button
            type="button"
            class="btn btn-sm"
            [class.btn-primary]="activeTab() === 'movements'"
            [class.btn-secondary]="activeTab() !== 'movements'"
            (click)="switchToMovements()"
          >
            Movement Audit Log
          </button>
        </div>
      </div>

      @if (activeTab() === 'stock') {
        <div class="filter-row">
          <input
            type="search"
            class="form-control"
            placeholder="Search SKU or product name..."
            [(ngModel)]="search"
            (keyup.enter)="loadInventory()"
          />
          <select class="form-control" [(ngModel)]="stockFilter" (change)="loadInventory()">
            <option value="">All Stock States</option>
            <option value="low">Low Stock (&le; 5)</option>
            <option value="out">Out of Stock (0)</option>
            <option value="in">In Stock (&gt; 0)</option>
          </select>
          <button type="button" class="btn btn-secondary btn-sm" (click)="loadInventory()">Filter</button>
        </div>

        <div class="table-card">
          <table class="admin-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Size / Color</th>
                <th>Price</th>
                <th>Available Stock</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              @for (v of variants(); track v.id) {
                <tr>
                  <td><code>{{ v.sku }}</code></td>
                  <td><strong>{{ v.product_name || 'Product #' + v.product_id }}</strong></td>
                  <td>{{ v.size }} / {{ v.color }}</td>
                  <td class="tabular-price">{{ Number(v.price) | bdt }}</td>
                  <td>
                    <span
                      class="badge"
                      [class]="v.stock_quantity === 0 ? 'badge-danger' : (v.stock_quantity <= 5 ? 'badge-warning' : 'badge-stock')"
                    >
                      {{ v.stock_quantity }} units
                    </span>
                  </td>
                  <td>
                    <button type="button" class="btn btn-outline btn-sm" (click)="openAdjustModal(v)">
                      Adjust Stock
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="table-card">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>SKU / Variant</th>
                <th>Delta</th>
                <th>Before &rarr; After</th>
                <th>Reason</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              @for (m of movements(); track m.id) {
                <tr>
                  <td>{{ m.created_at | date:'short' }}</td>
                  <td>
                    <strong>{{ m.sku || 'Variant #' + m.variant_id }}</strong>
                    @if (m.product_name) {
                      <div class="sub">{{ m.product_name }} ({{ m.size }} {{ m.color }})</div>
                    }
                  </td>
                  <td>
                    <span class="badge" [class]="m.quantity_delta >= 0 ? 'badge-stock' : 'badge-danger'">
                      {{ m.quantity_delta > 0 ? '+' + m.quantity_delta : m.quantity_delta }}
                    </span>
                  </td>
                  <td class="tabular-price">{{ m.before_quantity }} &rarr; <strong>{{ m.after_quantity }}</strong></td>
                  <td><code>{{ m.reason }}</code></td>
                  <td>{{ m.note || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- Manual Stock Adjustment Modal -->
    @if (selectedVariant()) {
      @let sv = selectedVariant()!;
      <div class="modal-backdrop" (click)="selectedVariant.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>ADJUST STOCK — {{ sv.sku }}</h3>
            <button type="button" (click)="selectedVariant.set(null)">&times;</button>
          </div>
          <form (ngSubmit)="submitAdjustment()">
            <div class="modal-body">
              <p style="font-size: 0.85rem; margin-bottom: 1rem;">
                <strong>{{ sv.product_name }}</strong> ({{ sv.size }} / {{ sv.color }}) &bull;
                Current Stock: <strong>{{ sv.stock_quantity }} units</strong>
              </p>

              <div class="form-group">
                <label class="form-label">Quantity Delta (+ to add, - to deduct) *</label>
                <input
                  type="number"
                  name="delta"
                  class="form-control"
                  [(ngModel)]="adjustDelta"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label">Adjustment Reason *</label>
                <select name="reason" class="form-control" [(ngModel)]="adjustReason">
                  <option value="restock">Restock Shipment Received</option>
                  <option value="manual_adjustment">Physical Inventory Count Audit</option>
                  <option value="damaged">Damaged / QC Reject</option>
                  <option value="return">Customer Return Restocked</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Audit Note (Required) *</label>
                <input
                  type="text"
                  name="note"
                  class="form-control"
                  [(ngModel)]="adjustNote"
                  placeholder="Batch #26B received at Banani warehouse..."
                  required
                />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" (click)="selectedVariant.set(null)">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm">Record Adjustment</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1.5rem;
      .tab-switch { display: flex; gap: 0.5rem; }
    }
    .filter-row {
      display: grid;
      grid-template-columns: 1fr 220px auto;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      max-width: 720px;
    }
    .table-card {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      overflow-x: auto;
    }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      th, td { padding: 0.8rem 1rem; border-bottom: 1px solid var(--color-border); text-align: left; }
      th { background: var(--color-alabaster); font-size: 0.72rem; text-transform: uppercase; }
      .sub { font-size: 0.74rem; color: var(--color-text-muted); }
    }
  `],
})
export class AdminInventoryComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly activeTab = signal<'stock' | 'movements'>('stock');
  readonly variants = signal<ProductVariant[]>([]);
  readonly movements = signal<InventoryMovement[]>([]);
  readonly selectedVariant = signal<ProductVariant | null>(null);
  readonly Number = Number;

  search = '';
  stockFilter = '';
  adjustDelta = 10;
  adjustReason = 'restock';
  adjustNote = '';

  ngOnInit(): void {
    this.loadInventory();
  }

  loadInventory(): void {
    this.adminService
      .getInventory({
        limit: 100,
        search: this.search.trim() || undefined,
        stockStatus: this.stockFilter || undefined,
      })
      .subscribe((res) => {
        if (res.success && Array.isArray(res.data)) {
          this.variants.set(res.data);
        }
      });
  }

  switchToMovements(): void {
    this.activeTab.set('movements');
    this.adminService.getInventoryMovements({ limit: 50 }).subscribe((res) => {
      if (res.success && Array.isArray(res.data)) {
        this.movements.set(res.data);
      }
    });
  }

  openAdjustModal(v: ProductVariant): void {
    this.selectedVariant.set(v);
    this.adjustDelta = 10;
    this.adjustReason = 'restock';
    this.adjustNote = 'Restocked at Dhaka central studio';
  }

  submitAdjustment(): void {
    const v = this.selectedVariant();
    if (!v || !this.adjustDelta || !this.adjustNote.trim()) {
      this.toast.error('Please enter a non-zero delta and an audit note.');
      return;
    }

    this.adminService
      .adjustInventory({
        variant_id: v.id,
        quantity_delta: Number(this.adjustDelta),
        reason: this.adjustReason,
        note: this.adjustNote.trim(),
      })
      .subscribe({
        next: () => {
          this.toast.success(`Stock adjusted for ${v.sku}.`);
          this.selectedVariant.set(null);
          this.loadInventory();
        },
        error: (err) => {
          this.toast.error(err?.error?.message || 'Stock adjustment failed.');
        },
      });
  }
}
