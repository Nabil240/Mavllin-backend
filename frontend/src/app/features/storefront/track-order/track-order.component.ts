import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order } from '../../../core/models/api.models';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BdtCurrencyPipe],
  template: `
    <div class="track-page container">
      <div class="track-header">
        <span class="kicker">REAL-TIME FULFILLMENT</span>
        <h1 class="section-heading">LIVE ORDER TRACKER</h1>
        <p class="section-subtitle">
          Enter your MAVLLIN order number (e.g. <strong>MAV-20261101-1001</strong>) to view courier dispatch status, payment reconciliation, and variant details.
        </p>

        <form class="track-search-bar" (ngSubmit)="onTrack()">
          <input
            type="text"
            name="orderNumberInput"
            class="form-control"
            [(ngModel)]="orderNumberInput"
            placeholder="Enter Order Number (e.g. MAV-20261101-1001)"
            required
          />
          <button type="submit" class="btn btn-primary" [disabled]="loading()">
            {{ loading() ? 'Searching...' : 'Track Order' }}
          </button>
        </form>

        <div class="sample-orders">
          <span>Demo Order References:</span>
          <button type="button" (click)="quickTrack('MAV-20261101-1001')">MAV-20261101-1001</button>
          <button type="button" (click)="quickTrack('MAV-20261101-1002')">MAV-20261101-1002</button>
          <button type="button" (click)="quickTrack('ORD-2026-1002')">ORD-2026-1002</button>
        </div>
      </div>

      <!-- Loading State -->
      @if (loading()) {
        <div class="track-state-box">
          <div class="spinner"></div>
          <p>Locating order status in dispatch network...</p>
        </div>
      } @else if (order()) {
        @let o = order()!;
        <article class="tracked-card">
          <div class="tracked-top">
            <div class="order-id-meta">
              <span class="label-sm">ORDER NUMBER</span>
              <h2>{{ o.order_number }}</h2>
              <span class="placed-date">Placed on {{ o.created_at | date:'medium' }}</span>
            </div>
            <div class="status-badges">
              <span class="badge" [class]="'badge-' + o.status">Status: {{ o.status | uppercase }}</span>
              <span class="badge" [class]="'badge-' + o.payment_status">Payment: {{ o.payment_status | uppercase }} (COD)</span>
            </div>
          </div>

          <!-- Progress Stepper -->
          @if (o.status !== 'cancelled') {
            <div class="lifecycle-bar">
              <div class="step" [class.done]="isStepDone(1, o.status)" [class.active]="o.status === 'pending'">
                <div class="step-circle">1</div>
                <span class="step-name">Order Placed</span>
                <span class="step-time">Cash on Delivery</span>
              </div>
              <div class="step-line" [class.done]="isStepDone(2, o.status)"></div>
              <div class="step" [class.done]="isStepDone(2, o.status)" [class.active]="o.status === 'confirmed' || o.status === 'processing'">
                <div class="step-circle">2</div>
                <span class="step-name">Processing</span>
                <span class="step-time">Atelier Dispatch</span>
              </div>
              <div class="step-line" [class.done]="isStepDone(3, o.status)"></div>
              <div class="step" [class.done]="isStepDone(3, o.status)" [class.active]="o.status === 'shipped'">
                <div class="step-circle">3</div>
                <span class="step-name">Out with Courier</span>
                <span class="step-time">{{ o.courier_name || 'Express Dispatch' }}</span>
              </div>
              <div class="step-line" [class.done]="isStepDone(4, o.status)"></div>
              <div class="step" [class.done]="isStepDone(4, o.status)" [class.active]="o.status === 'delivered'">
                <div class="step-circle">4</div>
                <span class="step-name">Delivered</span>
                <span class="step-time">{{ o.payment_status === 'paid' ? 'COD Collected' : 'Cash on Arrival' }}</span>
              </div>
            </div>
          } @else {
            <div class="cancelled-notice">
              <strong>Order Cancelled</strong>
              <p>{{ o.cancellation_reason || 'This order was cancelled and inventory has been restored.' }}</p>
            </div>
          }

          <!-- Grid: Courier & Shipping -->
          <div class="track-grid-2">
            <div class="info-pane">
              <h3>Courier &amp; Delivery Tracking</h3>
              <div class="detail-row">
                <span class="lbl">Courier Service:</span>
                <strong>{{ o.courier_name || 'Dhaka Dispatch Hub (Steadfast / Pathao)' }}</strong>
              </div>
              @if (o.tracking_number) {
                <div class="detail-row">
                  <span class="lbl">Consignment Waybill:</span>
                  <code>{{ o.tracking_number }}</code>
                </div>
              }
              <div class="detail-row">
                <span class="lbl">Payment Method:</span>
                <span>Cash on Delivery (COD)</span>
              </div>
              <div class="detail-row">
                <span class="lbl">Recipient Contact:</span>
                <span>{{ o.shipping_address?.recipient_name || o.customer_name }} &bull; {{ o.shipping_address?.phone }}</span>
              </div>
              <div class="detail-row">
                <span class="lbl">Shipping Address:</span>
                <span>
                  {{ o.shipping_address?.street_address }}, {{ o.shipping_address?.city }}
                  @if (o.shipping_address?.postal_code) {
                    — {{ o.shipping_address?.postal_code }}
                  }
                </span>
              </div>
            </div>

            <div class="info-pane">
              <h3>Financial Summary</h3>
              <div class="detail-row">
                <span class="lbl">Subtotal:</span>
                <span class="tabular-price">{{ Number(o.subtotal) | bdt }}</span>
              </div>
              @if (Number(o.discount_amount) > 0) {
                <div class="detail-row text-danger">
                  <span class="lbl">Discount Applied:</span>
                  <span class="tabular-price">-{{ Number(o.discount_amount) | bdt }}</span>
                </div>
              }
              <div class="detail-row">
                <span class="lbl">Courier Shipping:</span>
                <span class="tabular-price">{{ Number(o.shipping_fee || 0) | bdt }}</span>
              </div>
              <div class="detail-row total-row">
                <strong>Total COD Due:</strong>
                <strong class="tabular-price grand-val">{{ Number(o.total_amount) | bdt }}</strong>
              </div>
            </div>
          </div>

          <!-- Ordered Items Table -->
          @if (o.items && o.items.length > 0) {
            <div class="items-pane">
              <h3>Ordered Garment Items ({{ o.items.length }})</h3>
              <div class="table-responsive">
                <table class="track-table">
                  <thead>
                    <tr>
                      <th>Garment Details</th>
                      <th>SKU</th>
                      <th>Size</th>
                      <th>Color</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (it of o.items; track it.id) {
                      <tr>
                        <td class="garment-cell">
                          @if (it.thumbnail_url) {
                            <img [src]="it.thumbnail_url" [alt]="it.product_name" class="thumb" />
                          }
                          <div>
                            <strong>{{ it.product_name }}</strong>
                            @if (it.product_slug) {
                              <a [routerLink]="['/products', it.product_slug]" class="p-link">View Details</a>
                            }
                          </div>
                        </td>
                        <td><code>{{ it.variant_sku || 'N/A' }}</code></td>
                        <td><span class="spec-pill">{{ it.variant_size || 'Std' }}</span></td>
                        <td><span class="spec-pill">{{ it.variant_color || 'Std' }}</span></td>
                        <td>{{ it.quantity }}</td>
                        <td class="tabular-price">{{ Number(it.unit_price) | bdt }}</td>
                        <td class="tabular-price font-bold">{{ Number(it.line_total) | bdt }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </article>
      }
    </div>
  `,
  styles: [`
    .track-page {
      padding-top: 3rem;
      padding-bottom: 5rem;
    }

    .track-header {
      text-align: center;
      max-width: 680px;
      margin: 0 auto 2.5rem;
    }

    .kicker {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      color: var(--color-gold, #996515);
      display: block;
      margin-bottom: 0.25rem;
    }

    .track-search-bar {
      display: flex;
      gap: 0.5rem;
      margin: 1.5rem 0 1rem;

      .form-control {
        flex: 1;
        padding: 0.75rem 1rem;
        font-size: 0.95rem;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 2px;
      }
    }

    .sample-orders {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--color-text-muted, #767676);
      flex-wrap: wrap;

      button {
        background: var(--color-alabaster, #f4f4f4);
        border: 1px solid var(--color-border, #ddd);
        padding: 0.2rem 0.5rem;
        border-radius: 2px;
        font-family: monospace;
        cursor: pointer;
        &:hover { background: #e5e5e5; }
      }
    }

    .track-state-box {
      text-align: center;
      padding: 3rem;
      background: #fafafa;
      border: 1px solid var(--color-border, #eee);
    }

    .tracked-card {
      background: var(--color-white, #fff);
      border: 1px solid var(--color-border, #e5e5e5);
      border-radius: 2px;
      padding: 2rem;
      box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    }

    .tracked-top {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--color-border, #eee);

      @media (min-width: 768px) {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }

      h2 { margin: 0.25rem 0; font-size: 1.4rem; letter-spacing: 0.04em; }
      .label-sm { font-size: 0.68rem; color: var(--color-text-muted, #888); font-weight: 700; letter-spacing: 0.08em; }
      .placed-date { font-size: 0.8rem; color: var(--color-text-muted, #666); }
    }

    .status-badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .badge {
      padding: 0.35rem 0.75rem;
      border-radius: 2px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;

      &.badge-pending { background: #fff3cd; color: #856404; }
      &.badge-confirmed, &.badge-processing { background: #d1ecf1; color: #0c5460; }
      &.badge-shipped { background: #cce5ff; color: #004085; }
      &.badge-delivered { background: #d4edda; color: #155724; }
      &.badge-cancelled { background: #f8d7da; color: #721c24; }
      &.badge-unpaid { background: #fff3cd; color: #856404; }
      &.badge-paid { background: #d4edda; color: #155724; }
    }

    .lifecycle-bar {
      display: grid;
      grid-template-columns: auto 1fr auto 1fr auto 1fr auto;
      align-items: center;
      margin: 2.5rem 0;

      .step {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        position: relative;

        .step-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid #ccc;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.85rem;
          color: #777;
          margin-bottom: 0.5rem;
        }

        .step-name { font-size: 0.8rem; font-weight: 600; }
        .step-time { font-size: 0.68rem; color: #888; }

        &.done {
          .step-circle {
            background: var(--color-onyx, #121212);
            border-color: var(--color-onyx, #121212);
            color: #fff;
          }
        }

        &.active {
          .step-circle {
            border-color: var(--color-gold, #996515);
            color: var(--color-gold, #996515);
            box-shadow: 0 0 0 4px rgba(153,101,21,0.15);
          }
        }
      }

      .step-line {
        height: 2px;
        background: #e0e0e0;
        margin: 0 0.5rem;
        margin-bottom: 2rem;

        &.done {
          background: var(--color-onyx, #121212);
        }
      }
    }

    .cancelled-notice {
      margin: 2rem 0;
      padding: 1.25rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 2px;
      color: #991b1b;
      font-size: 0.9rem;
      strong { display: block; margin-bottom: 0.25rem; }
    }

    .track-grid-2 {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      margin-bottom: 2rem;

      @media (min-width: 768px) {
        grid-template-columns: 1fr 1fr;
      }
    }

    .info-pane {
      background: var(--color-alabaster, #fbfbfb);
      border: 1px solid var(--color-border, #eee);
      border-radius: 2px;
      padding: 1.25rem;

      h3 {
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-top: 0;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #e5e5e5;
      }
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      margin-bottom: 0.5rem;

      .lbl { color: var(--color-text-muted, #666); }

      &.total-row {
        border-top: 1px solid #e0e0e0;
        padding-top: 0.75rem;
        margin-top: 0.75rem;
        font-size: 1rem;
      }
      .grand-val { font-size: 1.15rem; color: var(--color-onyx, #121212); }
    }

    .items-pane {
      border-top: 1px solid var(--color-border, #eee);
      padding-top: 1.5rem;

      h3 {
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 1rem;
      }
    }

    .table-responsive { overflow-x: auto; }

    .track-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;

      th {
        text-align: left;
        padding: 0.65rem 0.75rem;
        background: #f9f9f9;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #666;
        border-bottom: 1px solid #e5e5e5;
      }

      td {
        padding: 0.75rem;
        border-bottom: 1px solid #f0f0f0;
        vertical-align: middle;
      }

      .garment-cell {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .thumb {
        width: 44px;
        height: 56px;
        object-fit: cover;
        border-radius: 2px;
        border: 1px solid #eee;
      }

      .p-link {
        display: block;
        font-size: 0.72rem;
        color: #777;
        text-decoration: underline;
      }

      .spec-pill {
        display: inline-block;
        padding: 0.15rem 0.4rem;
        background: #eee;
        border-radius: 2px;
        font-size: 0.75rem;
      }
    }
  `],
})
export class TrackOrderComponent implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  orderNumberInput = '';
  readonly order = signal<Order | null>(null);
  readonly loading = signal<boolean>(false);

  readonly Number = Number;

  ngOnInit(): void {
    const qNum = this.route.snapshot.queryParamMap.get('orderNumber');
    if (qNum) {
      this.orderNumberInput = qNum;
      this.onTrack();
    }
  }

  quickTrack(num: string): void {
    this.orderNumberInput = num;
    this.onTrack();
  }

  onTrack(): void {
    if (!this.orderNumberInput.trim()) return;

    this.loading.set(true);
    this.orderService.trackOrder(this.orderNumberInput.trim()).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.order.set(res.data);
        } else {
          this.order.set(null);
          this.toast.error('Order not found with the provided order number.');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.order.set(null);
        this.toast.error(err?.error?.message || 'Unable to track order. Please verify your order number.');
      },
    });
  }

  isStepDone(step: number, status: string): boolean {
    const statusRanks: Record<string, number> = {
      pending: 1,
      confirmed: 2,
      processing: 2,
      shipped: 3,
      delivered: 4,
    };
    const current = statusRanks[status] || 0;
    return current >= step;
  }
}
