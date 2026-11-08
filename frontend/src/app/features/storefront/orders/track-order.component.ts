import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Order } from '../../../core/models/api.models';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="track-page container">
      <div class="track-header">
        <h1 class="section-heading">LIVE ORDER TRACKER</h1>
        <p class="section-subtitle">
          Enter your ECO STUDIO order number (e.g., <strong>ORD-2026-1001</strong>) to view real-time fulfillment and courier status.
        </p>

        <form class="track-search-bar" (ngSubmit)="onTrack()">
          <input
            type="text"
            name="orderNumberInput"
            class="form-control"
            [(ngModel)]="orderNumberInput"
            placeholder="Enter Order Number (e.g. ORD-2026-1001)"
            required
          />
          <button type="submit" class="btn btn-primary" [disabled]="loading()">
            {{ loading() ? 'Searching...' : 'Track Order' }}
          </button>
        </form>

        <div class="sample-orders">
          <span>Demo Order Numbers:</span>
          <button type="button" (click)="quickTrack('ORD-2026-1001')">ORD-2026-1001</button>
          <button type="button" (click)="quickTrack('ORD-2026-1002')">ORD-2026-1002</button>
          <button type="button" (click)="quickTrack('ORD-2026-1003')">ORD-2026-1003</button>
        </div>
      </div>

      @if (order()) {
        @let o = order()!;
        <div class="tracked-card">
          <div class="tracked-top">
            <div>
              <span class="label-sm">ORDER NUMBER</span>
              <h2>{{ o.order_number }}</h2>
              <span class="placed-date">Placed on {{ o.created_at | date:'medium' }}</span>
            </div>
            <div class="status-badges">
              <span class="badge" [class]="'badge-' + o.status">Status: {{ o.status }}</span>
              <span class="badge" [class]="'badge-' + o.payment_status">Payment: {{ o.payment_status }} (COD)</span>
            </div>
          </div>

          <!-- Progress Stepper -->
          @if (o.status !== 'cancelled') {
            <div class="lifecycle-bar">
              @for (st of steps; track st; let idx = $index) {
                <div class="life-step" [class.completed]="isStepCompleted(o.status, st)">
                  <div class="step-num">{{ idx + 1 }}</div>
                  <div class="step-label">{{ st }}</div>
                </div>
              }
            </div>
          } @else {
            <div class="cancelled-alert">
              <strong>Order Cancelled</strong>
              @if (o.cancellation_reason) {
                <p>Reason: {{ o.cancellation_reason }}</p>
              }
            </div>
          }

          @if (o.courier_name || o.tracking_number) {
            <div class="courier-banner">
              <div><strong>Courier Partner:</strong> {{ o.courier_name || 'Pathao / RedX Express' }}</div>
              @if (o.tracking_number) {
                <div><strong>Consignment Tracking ID:</strong> {{ o.tracking_number }}</div>
              }
            </div>
          }

          <div class="tracked-columns">
            <div class="col-box">
              <h4>Line Items &amp; Variant Snapshots</h4>
              <ul class="item-list">
                @for (item of o.items || []; track item.id) {
                  <li>
                    <div>
                      <strong>{{ item.product_name }}</strong>
                      <div class="meta-line">
                        @if (item.variant_size) { Size: {{ item.variant_size }} }
                        @if (item.variant_color) { &bull; Color: {{ item.variant_color }} }
                        @if (item.variant_sku) { &bull; SKU: {{ item.variant_sku }} }
                      </div>
                    </div>
                    <div class="tabular-price">
                      {{ item.quantity }} &times; \${{ Number(item.unit_price).toFixed(2) }} =
                      <strong>\${{ Number(item.line_total).toFixed(2) }}</strong>
                    </div>
                  </li>
                }
              </ul>

              <div class="totals-summary tabular-price">
                <div><span>Subtotal:</span> <span>\${{ Number(o.subtotal).toFixed(2) }}</span></div>
                @if (Number(o.discount_amount) > 0) {
                  <div><span>Discount:</span> <span>-\${{ Number(o.discount_amount).toFixed(2) }}</span></div>
                }
                <div><span>Shipping Fee:</span> <span>\${{ Number(o.shipping_fee).toFixed(2) }}</span></div>
                <div class="grand"><span>Total (COD):</span> <span>\${{ Number(o.total_amount).toFixed(2) }}</span></div>
              </div>
            </div>

            <div class="col-box">
              <h4>Destination &amp; Status Timeline</h4>
              <div class="addr-block">
                <strong>{{ o.shipping_address?.recipient_name || o.shipping_address?.full_name || o.customer_name }}</strong>
                <div>{{ o.shipping_address?.phone }}</div>
                <div>{{ o.shipping_address?.street_address }}, {{ o.shipping_address?.city }} {{ o.shipping_address?.postal_code }}</div>
              </div>

              @if (o.status_history && o.status_history.length > 0) {
                <ul class="timeline-list">
                  @for (h of o.status_history; track h.id) {
                    <li>
                      <span class="tl-dot"></span>
                      <div>
                        <strong>{{ h.new_status | uppercase }}</strong>
                        @if (h.note) { <p>{{ h.note }}</p> }
                        <span class="tl-date">{{ h.created_at | date:'short' }}</span>
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .track-page {
      padding-top: 3rem;
      padding-bottom: 4rem;
      max-width: 960px;
    }
    .track-header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .track-search-bar {
      display: flex;
      gap: 0.65rem;
      max-width: 540px;
      margin: 1.5rem auto 0.75rem;
    }
    .sample-orders {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.76rem;
      color: var(--color-text-muted);
      button {
        padding: 0.2rem 0.55rem;
        background: var(--color-alabaster);
        border: 1px solid var(--color-border);
        border-radius: 3px;
        font-weight: 700;
        &:hover { border-color: var(--color-onyx); }
      }
    }
    .tracked-card {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 2rem;
      background: var(--color-white);
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }
    .tracked-top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--color-border);
      .label-sm { font-size: 0.7rem; letter-spacing: 0.1em; color: var(--color-text-light); }
      .placed-date { font-size: 0.8rem; color: var(--color-text-muted); }
      .status-badges { display: flex; gap: 0.5rem; }
    }
    .lifecycle-bar {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.5rem;
      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }
    .life-step {
      padding: 0.85rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      gap: 0.6rem;
      opacity: 0.45;
      &.completed {
        opacity: 1;
        border-color: var(--color-onyx);
        background: var(--color-alabaster);
      }
      .step-num {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--color-onyx);
        color: var(--color-white);
        font-size: 0.75rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .step-label {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }
    }
    .cancelled-alert {
      padding: 1rem;
      background: var(--color-berry-bg);
      color: var(--color-berry);
      border-radius: var(--radius-sm);
    }
    .courier-banner {
      padding: 0.9rem 1.25rem;
      background: var(--color-blue-bg);
      color: var(--color-blue);
      border-radius: var(--radius-sm);
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      font-size: 0.85rem;
    }
    .tracked-columns {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      @media (min-width: 768px) {
        grid-template-columns: 1.2fr 0.8fr;
      }
    }
    .col-box {
      padding: 1.25rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      h4 {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 1rem;
      }
    }
    .item-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--color-border);
        font-size: 0.85rem;
      }
      .meta-line { font-size: 0.75rem; color: var(--color-text-muted); }
    }
    .totals-summary {
      margin-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      font-size: 0.85rem;
      div { display: flex; justify-content: space-between; }
      .grand { font-size: 1rem; font-weight: 700; border-top: 1px solid var(--color-border); padding-top: 0.5rem; }
    }
    .addr-block {
      font-size: 0.85rem;
      margin-bottom: 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--color-border);
    }
    .timeline-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      li {
        display: flex;
        gap: 0.75rem;
        font-size: 0.82rem;
      }
      .tl-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--color-onyx);
        margin-top: 0.3rem;
        flex-shrink: 0;
      }
      .tl-date { font-size: 0.72rem; color: var(--color-text-light); }
    }
  `],
})
export class TrackOrderComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);
  private readonly toast = inject(ToastService);

  orderNumberInput = '';
  readonly order = signal<Order | null>(null);
  readonly loading = signal<boolean>(false);
  readonly Number = Number;
  readonly steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((q) => {
      const num = q.get('orderNumber');
      if (num) {
        this.orderNumberInput = num;
        this.onTrack();
      }
    });
  }

  quickTrack(num: string): void {
    this.orderNumberInput = num;
    this.onTrack();
  }

  onTrack(): void {
    const num = this.orderNumberInput.trim();
    if (!num) return;
    this.loading.set(true);
    this.orderService.trackOrder(num).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.order.set(res.data);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.order.set(null);
        this.toast.error(err?.error?.message || `No order found matching "${num}".`);
      },
    });
  }

  isStepCompleted(current: string, step: string): boolean {
    const curIdx = this.steps.indexOf(current);
    const stepIdx = this.steps.indexOf(step);
    return curIdx >= stepIdx && curIdx !== -1;
  }
}
