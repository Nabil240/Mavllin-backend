import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order } from '../../../core/models/api.models';
import { OrderService } from '../../../core/services/order.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-order-confirmation',
  standalone: true,
  imports: [CommonModule, RouterLink, BdtCurrencyPipe],
  template: `
    <div class="confirmation-page container">
      @if (loading()) {
        <div class="loading-box">Retrieving your order confirmation...</div>
      } @else if (!order()) {
        <div class="confirmation-card">
          <div class="check-circle">&#10003;</div>
          <h1 class="section-heading">THANK YOU FOR YOUR ORDER</h1>
          <p class="order-num">Order Reference: <strong>{{ orderNumber() }}</strong></p>
          <p>Your order has been registered and is being prepared for dispatch.</p>
          <div class="action-row">
            <a [routerLink]="['/track-order']" [queryParams]="{ orderNumber: orderNumber() }" class="btn btn-primary">
              Track Order Status
            </a>
            <a routerLink="/catalog" class="btn btn-outline">Continue Shopping</a>
          </div>
        </div>
      } @else {
        @let o = order()!;
        <div class="confirmation-card">
          <div class="check-circle">&#10003;</div>
          <span class="kicker">ORDER CONFIRMED &bull; {{ getPaymentMethodTitle(o) | uppercase }}</span>
          <h1 class="section-heading">THANK YOU FOR SHOPPING WITH MAVLLIN</h1>
          <p class="order-num">Order Number: <strong>{{ o.order_number }}</strong></p>

          <!-- Lifecycle Stepper -->
          <div class="stepper">
            @for (st of steps; track st) {
              <div class="step" [class.active]="isStepActive(o.status, st)">
                <div class="step-dot"></div>
                <span>{{ st }}</span>
              </div>
            }
          </div>

          <div class="details-grid">
            <div class="detail-box">
              <h4>Delivery Destination</h4>
              <p><strong>{{ o.shipping_address?.recipient_name || o.shipping_address?.full_name || o.customer_name }}</strong></p>
              <p>Phone: {{ o.shipping_address?.phone || o.customer_phone || o.guest_phone || 'N/A' }}</p>
              <p>Email: {{ o.customer_email || o.guest_email || 'N/A' }}</p>
              <p>{{ o.shipping_address?.street_address }}@if (o.shipping_address?.area) {, {{ o.shipping_address?.area }}}</p>
              <p>{{ o.shipping_address?.city }} {{ o.shipping_address?.postal_code }}, {{ o.shipping_address?.country || 'Bangladesh' }}</p>
            </div>

            <div class="detail-box">
              <h4>Payment &amp; Fulfillment</h4>
              <p><strong>Payment Method:</strong> {{ getPaymentMethodTitle(o) }}</p>
              @let trx = o.transaction_id || o.payment_transaction_id || o.payment?.transaction_id;
              @if (trx) {
                <p><strong>Transaction ID (TrxID):</strong> <code class="font-bold">{{ trx }}</code></p>
              }
              @if (o.sender_phone) {
                <p><strong>Sender Phone:</strong> {{ o.sender_phone }}</p>
              }
              <p><strong>Payment Status:</strong> <span class="badge" [class]="'badge-' + o.payment_status">{{ o.payment_status }}</span></p>
              <p><strong>Order Status:</strong> <span class="badge" [class]="'badge-' + o.status">{{ o.status }}</span></p>
              @if (Number(o.advance_amount) > 0) {
                <p><strong>Advance Amount Paid / Required:</strong> <span class="tabular-price text-emerald font-bold">{{ Number(o.advance_amount) | bdt }}</span></p>
                <p><strong>Amount Due on Delivery:</strong> <span class="tabular-price font-bold">{{ Number(o.due_amount) | bdt }}</span></p>
              } @else {
                <p><strong>Amount Due on Delivery:</strong> <span class="tabular-price font-bold">{{ (o.payment_provider === 'cod' || !o.payment_provider) ? (Number(o.total_amount) | bdt) : '৳0.00 (Fully Paid)' }}</span></p>
              }
            </div>
          </div>

          @if (o.items && o.items.length > 0) {
            <div class="items-box">
              <h4>Ordered Garments</h4>
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Garment &amp; SKU</th>
                    <th>Variant Specs</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of o.items; track item.id) {
                    <tr>
                      <td>
                        <strong>{{ item.product_name }}</strong>
                        @if (item.variant_sku) {
                          <div class="sub-sku">SKU: {{ item.variant_sku }}</div>
                        }
                      </td>
                      <td>
                        @if (item.variant_size) { Size: {{ item.variant_size }} }
                        @if (item.variant_color) { &bull; Color: {{ item.variant_color }} }
                      </td>
                      <td class="tabular-price" style="text-align: right;">{{ Number(item.unit_price) | bdt }}</td>
                      <td class="tabular-price" style="text-align: center;">{{ item.quantity }}</td>
                      <td class="tabular-price font-bold" style="text-align: right;">{{ Number(item.line_total) | bdt }}</td>
                    </tr>
                  }
                </tbody>
              </table>

              <div class="receipt-totals-wrap">
                <div class="receipt-totals-table tabular-price">
                  <div class="r-row"><span>Subtotal:</span> <span>{{ Number(o.subtotal) | bdt }}</span></div>
                  @if (Number(o.discount_amount) > 0) {
                    <div class="r-row text-emerald"><span>Discount:</span> <span>-{{ Number(o.discount_amount) | bdt }}</span></div>
                  }
                  <div class="r-row"><span>Shipping Fee:</span> <span>{{ Number(o.shipping_fee) === 0 ? 'FREE' : (Number(o.shipping_fee) | bdt) }}</span></div>
                  <div class="r-row r-grand-total"><span>Grand Total:</span> <span>{{ Number(o.total_amount) | bdt }}</span></div>
                  @if (Number(o.advance_amount) > 0) {
                    <div class="r-row text-emerald"><span>Advance Paid / Required:</span> <span>{{ Number(o.advance_amount) | bdt }}</span></div>
                    <div class="r-row font-bold"><span>Balance Due on Delivery:</span> <span>{{ Number(o.due_amount) | bdt }}</span></div>
                  }
                </div>
              </div>
            </div>
          }

          <div class="action-row">
            <a [routerLink]="['/track-order']" [queryParams]="{ orderNumber: o.order_number }" class="btn btn-primary">
              Track Order Live
            </a>
            <button type="button" class="btn btn-secondary receipt-btn" (click)="downloadReceiptHtml()">
              📥 Download Receipt (HTML)
            </button>
            <button type="button" class="btn btn-outline receipt-btn" (click)="printReceipt()">
              🖨️ Print Receipt
            </button>
            <a routerLink="/catalog" class="btn btn-outline">Continue Shopping</a>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .confirmation-page {
      padding-top: 3rem;
      padding-bottom: 4rem;
      max-width: 860px;
    }
    .loading-box { text-align: center; padding: 4rem 1rem; }
    .confirmation-card {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 2.5rem;
      background: var(--color-white);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .check-circle {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--color-emerald-bg);
      color: var(--color-emerald);
      font-size: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .kicker {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: var(--color-emerald);
    }
    .order-num {
      font-size: 1rem;
      background: var(--color-alabaster);
      padding: 0.45rem 1rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
    }
    .stepper {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.25rem;
      margin: 1rem 0;
      width: 100%;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.76rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--color-text-light);
      .step-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--color-border);
      }
      &.active {
        color: var(--color-onyx);
        .step-dot { background: var(--color-emerald); }
      }
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
      width: 100%;
      text-align: left;
      margin-top: 0.5rem;
      @media (min-width: 640px) {
        grid-template-columns: 1fr 1fr;
      }
    }
    .detail-box {
      padding: 1.25rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      h4 {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.4rem;
      }
    }
    .items-box {
      width: 100%;
      text-align: left;
      margin-top: 0.5rem;
      h4 {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.65rem;
      }
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      th, td {
        padding: 0.65rem;
        border-bottom: 1px solid var(--color-border);
        text-align: left;
      }
      th { background: var(--color-alabaster); font-size: 0.75rem; text-transform: uppercase; }
    }
    .sub-sku {
      font-size: 0.72rem;
      color: var(--color-text-muted);
      font-family: monospace;
    }
    .receipt-totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-top: 1rem;
    }
    .receipt-totals-table {
      width: 280px;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.85rem;
      .r-row {
        display: flex;
        justify-content: space-between;
      }
      .r-grand-total {
        border-top: 1px solid var(--color-border);
        padding-top: 0.45rem;
        font-size: 1rem;
        font-weight: 700;
      }
    }
    .action-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.85rem;
      margin-top: 1rem;
    }
    .font-bold { font-weight: 700; }
    .text-emerald { color: var(--color-emerald); }
  `],
})
export class OrderConfirmationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);

  readonly orderNumber = signal<string>('');
  readonly order = signal<Order | null>(null);
  readonly loading = signal<boolean>(true);
  readonly Number = Number;

  readonly steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const num = params.get('orderNumber') || '';
      this.orderNumber.set(num);
      if (num) {
        this.orderService.trackOrder(num).subscribe({
          next: (res) => {
            this.loading.set(false);
            if (res.success && res.data) {
              this.order.set(res.data);
            }
          },
          error: () => {
            this.loading.set(false);
          },
        });
      } else {
        this.loading.set(false);
      }
    });
  }

  isStepActive(currentStatus: string, step: string): boolean {
    const orderIdx = this.steps.indexOf(currentStatus);
    const stepIdx = this.steps.indexOf(step);
    return orderIdx >= stepIdx && orderIdx !== -1;
  }

  getPaymentMethodTitle(ord: Order | null): string {
    if (!ord) return 'Cash on Delivery';
    const p = ord.payment_provider || ord.payment_method || 'cod';
    switch (p.toLowerCase()) {
      case 'manual':
      case 'manual_payment':
        return 'Manual Bank Transfer (City Bank PLC)';
      case 'bkash':
        return 'bKash Mobile Banking';
      case 'nagad':
        return 'Nagad Mobile Banking';
      case 'rocket':
        return 'Dutch-Bangla Rocket';
      case 'upay':
        return 'Upay Mobile Wallet';
      case 'cod':
      default:
        return 'Cash on Delivery (COD)';
    }
  }

  printReceipt(): void {
    window.print();
  }

  downloadReceiptHtml(): void {
    const o = this.order();
    if (!o) return;

    const paymentTitle = this.getPaymentMethodTitle(o);
    const trx = o.transaction_id || o.payment_transaction_id || o.payment?.transaction_id || 'N/A';
    const sender = o.sender_phone || 'N/A';
    const clientName = o.shipping_address?.recipient_name || o.shipping_address?.full_name || o.customer_name || 'Valued Customer';
    const clientPhone = o.shipping_address?.phone || o.customer_phone || o.guest_phone || 'N/A';
    const clientEmail = o.customer_email || o.guest_email || 'N/A';
    const address = `${o.shipping_address?.street_address || ''}${o.shipping_address?.area ? ', ' + o.shipping_address.area : ''}, ${o.shipping_address?.city || ''} ${o.shipping_address?.postal_code || ''}, Bangladesh`;
    const orderDate = o.created_at ? new Date(o.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleDateString();

    const itemsHtml = (o.items || [])
      .map((item, idx) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5;">${idx + 1}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5;">
            <strong>${item.product_name}</strong>
            <div style="font-size: 12px; color: #666;">SKU: ${item.variant_sku || 'N/A'} | Size: ${item.variant_size || 'N/A'} | Color: ${item.variant_color || 'N/A'}</div>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">৳${Number(item.unit_price).toFixed(2)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: bold;">৳${Number(item.line_total).toFixed(2)}</td>
        </tr>
      `)
      .join('');

    const advanceSectionHtml = Number(o.advance_amount || 0) > 0
      ? `
        <tr>
          <td colspan="4" style="padding: 8px 12px; text-align: right; color: #047857; font-weight: bold;">Advance Paid / Required:</td>
          <td style="padding: 8px 12px; text-align: right; color: #047857; font-weight: bold;">৳${Number(o.advance_amount).toFixed(2)}</td>
        </tr>
        <tr>
          <td colspan="4" style="padding: 8px 12px; text-align: right; font-weight: bold; border-top: 1px solid #222;">Balance Due on Delivery:</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: bold; border-top: 1px solid #222;">৳${Number(o.due_amount || 0).toFixed(2)}</td>
        </tr>
      `
      : '';

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MAVLLIN Receipt - ${o.order_number}</title>
  <style>
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #2c241d;
      background: #faf7f2;
      margin: 0;
      padding: 40px 20px;
    }
    .receipt-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e6dfd3;
      border-radius: 6px;
      padding: 40px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2c241d;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .brand-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #2c241d;
      margin: 0 0 4px 0;
    }
    .brand-tagline {
      font-size: 13px;
      color: #6e6256;
      letter-spacing: 0.05em;
      margin: 0;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h2 {
      margin: 0 0 6px 0;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #2c241d;
    }
    .grid-2 {
      display: flex;
      justify-content: space-between;
      gap: 30px;
      margin-bottom: 30px;
    }
    .info-card {
      flex: 1;
      background: #fdfcfb;
      border: 1px solid #e6dfd3;
      border-radius: 4px;
      padding: 16px 20px;
      font-size: 14px;
      line-height: 1.6;
    }
    .info-card h3 {
      margin: 0 0 10px 0;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6e6256;
      border-bottom: 1px solid #e6dfd3;
      padding-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      font-size: 14px;
    }
    th {
      background: #f3ede2;
      color: #2c241d;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.06em;
      padding: 10px 12px;
      border-bottom: 1px solid #d6c5ab;
    }
    .totals-table {
      width: 320px;
      margin-left: auto;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .totals-table td {
      padding: 6px 12px;
    }
    .grand-total-row td {
      border-top: 2px solid #2c241d;
      font-size: 16px;
      font-weight: 800;
      padding-top: 10px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: #ecfdf5;
      color: #047857;
    }
    .footer {
      border-top: 1px solid #e6dfd3;
      padding-top: 20px;
      text-align: center;
      font-size: 12px;
      color: #6e6256;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div>
        <h1 class="brand-title">MAVLLIN</h1>
        <p class="brand-tagline">Contemporary Atelier &bull; Dhaka, Bangladesh</p>
      </div>
      <div class="invoice-title">
        <h2>Official Order Receipt</h2>
        <div style="font-size: 13px; color: #6e6256;">Order Ref: <strong>${o.order_number}</strong></div>
        <div style="font-size: 13px; color: #6e6256;">Date: ${orderDate}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="info-card">
        <h3>Customer & Delivery Address</h3>
        <div><strong>${clientName}</strong></div>
        <div>Phone: ${clientPhone}</div>
        <div>Email: ${clientEmail}</div>
        <div style="margin-top: 8px;">${address}</div>
      </div>

      <div class="info-card">
        <h3>Payment & Status</h3>
        <div><strong>Method:</strong> ${paymentTitle}</div>
        ${trx !== 'N/A' ? `<div><strong>TrxID:</strong> <code style="font-weight:bold;">${trx}</code></div>` : ''}
        ${sender !== 'N/A' ? `<div><strong>Sender:</strong> ${sender}</div>` : ''}
        <div style="margin-top: 6px;"><strong>Payment Status:</strong> <span class="badge">${o.payment_status}</span></div>
        <div style="margin-top: 4px;"><strong>Order Status:</strong> <span class="badge">${o.status}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align: left; width: 40px;">#</th>
          <th style="text-align: left;">Garment &amp; Specifications</th>
          <th style="text-align: right; width: 110px;">Unit Price</th>
          <th style="text-align: center; width: 60px;">Qty</th>
          <th style="text-align: right; width: 110px;">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <table class="totals-table">
      <tr>
        <td style="color: #6e6256;">Subtotal:</td>
        <td style="text-align: right; font-weight: 600;">৳${Number(o.subtotal).toFixed(2)}</td>
      </tr>
      ${Number(o.discount_amount) > 0 ? `
      <tr>
        <td style="color: #047857;">Promotional Discount:</td>
        <td style="text-align: right; color: #047857; font-weight: 600;">-৳${Number(o.discount_amount).toFixed(2)}</td>
      </tr>` : ''}
      <tr>
        <td style="color: #6e6256;">Shipping Fee:</td>
        <td style="text-align: right; font-weight: 600;">${Number(o.shipping_fee) === 0 ? 'FREE' : '৳' + Number(o.shipping_fee).toFixed(2)}</td>
      </tr>
      <tr class="grand-total-row">
        <td>Total Order Value:</td>
        <td style="text-align: right;">৳${Number(o.total_amount).toFixed(2)}</td>
      </tr>
      ${advanceSectionHtml}
    </table>

    <div class="footer">
      <div>Thank you for your patronage with MAVLLIN.</div>
      <div>Customer Care: support@mavllin.com &bull; +880 1711-000000 &bull; Gulshan-2, Dhaka 1212</div>
      <div style="margin-top: 6px; font-size: 11px;">This document serves as an official digital confirmation and invoice for your purchase.</div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${o.order_number}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
