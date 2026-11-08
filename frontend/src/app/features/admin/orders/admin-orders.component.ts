import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Order } from '../../../core/models/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, BdtCurrencyPipe],
  template: `
    <div class="admin-orders">
      <div class="page-head">
        <div>
          <h1 class="section-heading">ORDERS &amp; CASH ON DELIVERY FULFILLMENT</h1>
          <p class="section-subtitle">Manage order lifecycle transitions, courier tracking, and COD cash collection</p>
        </div>
      </div>

      <div class="filter-bar">
        <input
          type="search"
          class="form-control"
          placeholder="Search Order #, customer name, or email..."
          [(ngModel)]="search"
          (keyup.enter)="loadOrders()"
        />
        <select class="form-control" [(ngModel)]="statusFilter" (change)="loadOrders()">
          <option value="">All Order Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select class="form-control" [(ngModel)]="paymentFilter" (change)="loadOrders()">
          <option value="">All Payment States</option>
          <option value="unpaid">Unpaid (COD Pending)</option>
          <option value="paid">Paid (COD Collected)</option>
          <option value="refunded">Refunded</option>
        </select>
        <button type="button" class="btn btn-secondary btn-sm" (click)="loadOrders()">Filter</button>
      </div>

      <div class="table-card">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date</th>
              <th>Client</th>
              <th>Method</th>
              <th>Order Status</th>
              <th>Payment Status</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (o of orders(); track o.id) {
              <tr>
                <td><strong>{{ o.order_number }}</strong></td>
                <td>{{ o.created_at | date:'shortDate' }}</td>
                <td>
                  <strong>{{ o.customer_name || o.shipping_address?.recipient_name || 'Guest Client' }}</strong>
                  <div class="sub">{{ o.customer_email || o.guest_email || o.shipping_address?.phone }}</div>
                </td>
                <td>
                  @let provider = o.payment_provider || o.payment_method || 'cod';
                  @if (provider === 'manual' || provider === 'manual_payment') {
                    <span class="badge badge-manual">Bank Transfer</span>
                  } @else if (provider === 'bkash') {
                    <span class="badge badge-bkash">bKash</span>
                  } @else if (provider === 'nagad') {
                    <span class="badge badge-nagad">Nagad</span>
                  } @else if (provider === 'rocket') {
                    <span class="badge badge-rocket">Rocket</span>
                  } @else if (provider === 'upay') {
                    <span class="badge badge-upay">Upay</span>
                  } @else {
                    <span class="badge badge-dark">COD</span>
                  }
                  @let trx = o.transaction_id || o.payment_transaction_id || o.payment?.transaction_id;
                  @if (trx) {
                    <div class="sub-trx" [title]="'TrxID: ' + trx">
                      Trx: {{ trx.length > 14 ? (trx.slice(0, 12) + '...') : trx }}
                    </div>
                  }
                  @if (o.sender_phone) {
                    <div class="sub">{{ o.sender_phone }}</div>
                  }
                </td>
                <td><span class="badge" [class]="'badge-' + o.status">{{ o.status }}</span></td>
                <td><span class="badge" [class]="'badge-' + o.payment_status">{{ o.payment_status }}</span></td>
                <td class="tabular-price font-bold">{{ Number(o.total_amount) | bdt }}</td>
                <td class="action-cell">
                  <button type="button" class="btn btn-outline btn-sm" (click)="openOrderModal(o)">
                    Manage
                  </button>
                  <button type="button" class="btn btn-outline-danger btn-sm" (click)="deleteOrder(o)" title="Delete Order">
                    Delete
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Order Detail & Lifecycle Updater Modal -->
    @if (selectedOrder()) {
      @let ord = selectedOrder()!;
      <div class="modal-backdrop" (click)="selectedOrder.set(null)">
        <div class="modal-card wide-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>ORDER {{ ord.order_number }} — FULFILLMENT &amp; COD</h3>
            <button type="button" (click)="selectedOrder.set(null)">&times;</button>
          </div>
          <div class="modal-body">
            <div class="modal-grid-2">
              <!-- Order Status Updater -->
              <div class="updater-box">
                <h4>1. Update Order Lifecycle Status</h4>
                <div class="form-group">
                  <label class="form-label">Order Status</label>
                  <select class="form-control" [(ngModel)]="newStatus">
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled (Restores Variant Stock)</option>
                  </select>
                </div>

                @if (newStatus === 'shipped' || newStatus === 'delivered') {
                  <div class="form-group">
                    <label class="form-label">Courier Name</label>
                    <input type="text" class="form-control" [(ngModel)]="courierName" placeholder="Pathao / RedX / Steadfast" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tracking Number</label>
                    <input type="text" class="form-control" [(ngModel)]="trackingNumber" placeholder="TRK-BD-88921" />
                  </div>
                }

                @if (newStatus === 'cancelled') {
                  <div class="form-group">
                    <label class="form-label">Cancellation Reason</label>
                    <input type="text" class="form-control" [(ngModel)]="cancellationReason" placeholder="Customer requested cancellation" />
                  </div>
                }

                <button type="button" class="btn btn-primary btn-sm" (click)="saveOrderStatus()">
                  Save Order Status
                </button>
              </div>

              <!-- Payment & Manual Gateway Verification Box -->
              <div class="updater-box">
                <h4>2. Payment Gateway &amp; Verification</h4>
                <div class="payment-meta-details">
                  <div class="p-row">
                    <span>Gateway:</span>
                    <strong>{{ (ord.payment_provider || ord.payment_method || 'cod') | uppercase }}</strong>
                  </div>
                  @let modalTrx = ord.transaction_id || ord.payment_transaction_id || ord.payment?.transaction_id;
                  @if (modalTrx) {
                    <div class="p-row">
                      <span>Transaction ID:</span>
                      <code class="font-bold">{{ modalTrx }}</code>
                    </div>
                  }
                  @if (ord.sender_phone) {
                    <div class="p-row">
                      <span>Sender Phone:</span>
                      <strong>{{ ord.sender_phone }}</strong>
                    </div>
                  }
                  @if (Number(ord.advance_amount) > 0) {
                    <div class="p-row">
                      <span>Advance Required:</span>
                      <strong class="text-emerald">{{ Number(ord.advance_amount) | bdt }}</strong>
                    </div>
                    <div class="p-row">
                      <span>Balance Due on Delivery:</span>
                      <strong>{{ Number(ord.due_amount) | bdt }}</strong>
                    </div>
                  }
                </div>

                @if (ord.payment_status !== 'paid') {
                  <div class="verify-action-box">
                    <button
                      type="button"
                      class="btn btn-success btn-sm btn-block"
                      [disabled]="verifyingPayment()"
                      (click)="verifyManualPayment(ord)"
                    >
                      {{ verifyingPayment() ? 'Verifying Gateway Transaction...' : 'Verify Manual Payment (Mark as Paid)' }}
                    </button>
                    <small class="sub" style="display:block; margin-top: 0.35rem; text-align: center;">
                      Verifies TrxID, updates payment to 'completed', and logs audit history note.
                    </small>
                  </div>
                } @else {
                  <div class="payment-verified-notice">
                    ✓ Payment Verified &amp; Paid
                  </div>
                }

                <div class="form-group" style="margin-top: 1rem;">
                  <label class="form-label">Payment Status Override</label>
                  <select class="form-control" [(ngModel)]="newPaymentStatus">
                    <option value="unpaid">Unpaid (Cash Pending)</option>
                    <option value="paid">Paid (Cash Collected / Verified)</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <button type="button" class="btn btn-outline btn-sm" (click)="savePaymentStatus()">
                  Update Payment Status
                </button>

                <div class="addr-summary">
                  <strong>Delivery Address:</strong>
                  <div>{{ ord.shipping_address?.recipient_name || ord.customer_name }} ({{ ord.shipping_address?.phone }})</div>
                  <div>{{ ord.shipping_address?.street_address }}, {{ ord.shipping_address?.city }} {{ ord.shipping_address?.postal_code }}</div>
                </div>
              </div>
            </div>

            <!-- Line Items Snapshot Table -->
            <h4 style="margin: 1.25rem 0 0.65rem; font-size: 0.82rem; text-transform: uppercase;">
              Ordered Items &amp; Variant Snapshots
            </h4>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant SKU / Size / Color</th>
                  <th>Unit Price</th>
                  <th>Qty</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                @for (item of ord.items || []; track item.id) {
                  <tr>
                    <td><strong>{{ item.product_name }}</strong></td>
                    <td>
                      <code>{{ item.variant_sku || 'N/A' }}</code>
                      @if (item.variant_size || item.variant_color) {
                        <span> ({{ item.variant_size }} / {{ item.variant_color }})</span>
                      }
                    </td>
                    <td class="tabular-price">{{ Number(item.unit_price) | bdt }}</td>
                    <td class="tabular-price">{{ item.quantity }}</td>
                    <td class="tabular-price font-bold">{{ Number(item.line_total) | bdt }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-danger btn-sm" (click)="deleteOrder(ord)">
              Delete Order (Restore Stock)
            </button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="selectedOrder.set(null)">
              Close
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-head { margin-bottom: 1.5rem; }
    .filter-bar {
      display: grid;
      grid-template-columns: 1fr 180px 180px auto;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
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
      .font-bold { font-weight: 700; }
    }
    .wide-modal { max-width: 820px; }
    .modal-grid-2 {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
      @media (min-width: 768px) {
        grid-template-columns: 1fr 1fr;
      }
    }
    .updater-box {
      padding: 1.15rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      h4 { font-size: 0.82rem; text-transform: uppercase; margin-bottom: 0.75rem; }
    }
    .addr-summary {
      margin-top: 1rem;
      padding-top: 0.85rem;
      border-top: 1px solid var(--color-border);
      font-size: 0.8rem;
    }
    .badge-manual { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .badge-bkash { background: #fce7f3; color: #be185d; border: 1px solid #f9a8d4; }
    .badge-nagad { background: #ffedd5; color: #c2410c; border: 1px solid #fdba74; }
    .badge-rocket { background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; }
    .badge-upay { background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; }
    .sub-trx {
      font-size: 0.72rem;
      font-family: monospace;
      color: var(--color-onyx);
      font-weight: 600;
      margin-top: 0.2rem;
    }
    .payment-meta-details {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.75rem 0.85rem;
      margin-bottom: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.8rem;
      .p-row {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        span { color: var(--color-text-muted); }
      }
    }
    .verify-action-box {
      margin-bottom: 0.85rem;
    }
    .payment-verified-notice {
      background: var(--color-emerald-bg);
      color: var(--color-emerald);
      border: 1px solid var(--color-emerald);
      border-radius: var(--radius-sm);
      padding: 0.5rem;
      text-align: center;
      font-size: 0.8rem;
      font-weight: 700;
      margin-bottom: 0.85rem;
    }
    .btn-success {
      background: var(--color-emerald);
      color: var(--color-white);
      border: none;
      font-weight: 600;
      &:hover { background: #059669; }
    }
    .btn-block {
      width: 100%;
      display: block;
    }
    .text-emerald { color: var(--color-emerald); }
  `],
})
export class AdminOrdersComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly orders = signal<Order[]>([]);
  readonly selectedOrder = signal<Order | null>(null);
  readonly verifyingPayment = signal<boolean>(false);
  readonly Number = Number;

  search = '';
  statusFilter = '';
  paymentFilter = '';

  newStatus = 'pending';
  newPaymentStatus = 'unpaid';
  courierName = '';
  trackingNumber = '';
  cancellationReason = '';

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.adminService
      .getOrders({
        limit: 50,
        search: this.search.trim() || undefined,
        status: this.statusFilter || undefined,
        paymentStatus: this.paymentFilter || undefined,
      })
      .subscribe((res) => {
        if (res.success && Array.isArray(res.data)) {
          this.orders.set(res.data);
        }
      });
  }

  openOrderModal(o: Order): void {
    this.adminService.getOrderById(o.id).subscribe({
      next: (res) => {
        const full = res.data || o;
        this.selectedOrder.set(full);
        this.newStatus = full.status;
        this.newPaymentStatus = full.payment_status;
        this.courierName = full.courier_name || 'Pathao Express';
        this.trackingNumber = full.tracking_number || '';
        this.cancellationReason = full.cancellation_reason || '';
      },
    });
  }

  saveOrderStatus(): void {
    const ord = this.selectedOrder();
    if (!ord) return;
    this.adminService
      .updateOrderStatus(ord.id, {
        status: this.newStatus,
        courier_name: this.courierName || undefined,
        tracking_number: this.trackingNumber || undefined,
        cancellation_reason: this.cancellationReason || undefined,
      })
      .subscribe({
        next: (res) => {
          this.toast.success(`Order status updated to ${this.newStatus}.`);
          if (res.data) this.selectedOrder.set(res.data);
          this.loadOrders();
        },
        error: (err) => this.toast.error(err?.error?.message || 'Could not update status.'),
      });
  }

  savePaymentStatus(): void {
    const ord = this.selectedOrder();
    if (!ord) return;
    this.adminService.updatePaymentStatus(ord.id, this.newPaymentStatus).subscribe({
      next: (res) => {
        this.toast.success(`Payment status updated to ${this.newPaymentStatus}.`);
        if (res.data) this.selectedOrder.set(res.data);
        this.loadOrders();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not update payment status.'),
    });
  }

  verifyManualPayment(ord: Order): void {
    this.verifyingPayment.set(true);
    this.adminService.verifyPayment(ord.id, 'Verified via Admin Orders Dashboard').subscribe({
      next: (res) => {
        this.verifyingPayment.set(false);
        this.toast.success(`Payment for order ${ord.order_number} verified and marked as Paid.`);
        if (res.data) {
          this.selectedOrder.set(res.data);
          this.newPaymentStatus = 'paid';
        }
        this.loadOrders();
      },
      error: (err) => {
        this.verifyingPayment.set(false);
        this.toast.error(err?.error?.message || 'Failed to verify payment.');
      },
    });
  }

  deleteOrder(o: Order): void {
    if (!confirm(`Are you sure you want to delete order ${o.order_number}? Inventory will be restored for unfulfilled items.`)) {
      return;
    }
    this.adminService.deleteOrder(o.id).subscribe({
      next: () => {
        this.toast.success(`Order ${o.order_number} deleted successfully.`);
        if (this.selectedOrder()?.id === o.id) {
          this.selectedOrder.set(null);
        }
        this.loadOrders();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to delete order.'),
    });
  }

  getAvailableStatuses(currentStatus: string): string[] {
    const transitions: Record<string, string[]> = {
      pending: ['pending', 'confirmed', 'processing', 'cancelled'],
      confirmed: ['confirmed', 'processing', 'shipped', 'cancelled'],
      processing: ['processing', 'shipped', 'delivered', 'cancelled'],
      shipped: ['shipped', 'delivered'],
      delivered: ['delivered'],
      cancelled: ['cancelled'],
    };
    return transitions[currentStatus] || ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  }
}
