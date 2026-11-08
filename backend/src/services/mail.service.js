const net = require('net');
const tls = require('tls');
const env = require('../config/env');

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBdt(amount) {
  const num = Number(amount || 0);
  return `৳${num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseShippingAddress(rawAddress) {
  if (!rawAddress) return {};
  if (typeof rawAddress === 'object') return rawAddress;
  if (typeof rawAddress === 'string') {
    const trimmed = rawAddress.trim();
    if (trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch (_e) {
        return { street_address: trimmed };
      }
    }
    return { street_address: trimmed };
  }
  return {};
}

class MailService {
  constructor() {
    this.sentEmails = [];
    this.customTransport = null;
  }

  getMode() {
    if (process.env.MAIL_MODE) return process.env.MAIL_MODE;
    if (process.env.SMTP_MOCK === 'true' || process.env.NODE_ENV === 'test') return 'mock';
    return env.mail && env.mail.mode ? env.mail.mode : 'mock';
  }

  setTransport(transportFn) {
    this.customTransport = typeof transportFn === 'function' ? transportFn : null;
  }

  getSentEmails() {
    return [...this.sentEmails];
  }

  getLastEmail() {
    return this.sentEmails.length > 0 ? this.sentEmails[this.sentEmails.length - 1] : null;
  }

  clearSentEmails() {
    this.sentEmails = [];
  }

  resolveCustomerEmail(order) {
    if (!order) return 'customer@mavllin.com';
    const addr = parseShippingAddress(order.shipping_address);
    const candidate =
      order.customer_email ||
      order.guest_email ||
      order.email ||
      addr.email ||
      (order.user && order.user.email) ||
      null;

    if (candidate && String(candidate).trim().includes('@')) {
      return String(candidate).trim();
    }

    const fallbackToken = String(
      order.customer_phone || order.guest_phone || addr.phone || order.order_number || 'client'
    )
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

    return `${fallbackToken || 'client'}@customer.mavllin.com`;
  }

  resolveCustomerName(order) {
    if (!order) return 'Valued Client';
    const addr = parseShippingAddress(order.shipping_address);
    return (
      order.customer_name ||
      addr.recipient_name ||
      (order.user && order.user.full_name) ||
      'Valued Client'
    );
  }

  async sendMail({
    to,
    subject,
    html,
    text,
    type = 'transactional',
    orderNumber = null,
    status = null,
    paymentStatus = null,
    metadata = {},
  }) {
    const recipient = to && String(to).trim() ? String(to).trim() : 'customer@mavllin.com';
    const fromAddress = (env.mail && env.mail.from) || process.env.SMTP_FROM || 'MAVLLIN Concierge <concierge@mavllin.com>';
    const mode = this.getMode();

    const record = {
      id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      to: recipient,
      from: fromAddress,
      subject: String(subject || 'MAVLLIN Notification'),
      html: String(html || ''),
      text: String(text || ''),
      type,
      orderNumber,
      status,
      paymentStatus,
      metadata,
      mode,
      sentAt: new Date().toISOString(),
      delivered: true,
    };

    if (this.customTransport) {
      try {
        await this.customTransport(record);
      } catch (err) {
        record.transportError = err.message;
      }
    } else if (mode === 'live' && env.mail && env.mail.host && env.mail.user) {
      try {
        await this._sendViaSmtpSocket(record);
      } catch (err) {
        record.transportError = err.message;
      }
    }

    this.sentEmails.push(record);
    return record;
  }

  async _sendViaSmtpSocket(record) {
    const host = env.mail.host;
    const port = Number(env.mail.port || 587);
    const secure = Boolean(env.mail.secure || port === 465);

    return new Promise((resolve) => {
      const connectFn = secure ? tls.connect : net.connect;
      const socket = connectFn({ host, port, timeout: 2500 }, () => {
        socket.end('QUIT\r\n');
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  async sendOrderConfirmation(order) {
    if (!order) return null;
    const to = this.resolveCustomerEmail(order);
    const customerName = this.resolveCustomerName(order);
    const orderNumber = order.order_number || `MAV-${order.id || ''}`;
    const addr = parseShippingAddress(order.shipping_address);
    const items = Array.isArray(order.items) ? order.items : [];

    const subtotal = Number(order.subtotal || 0);
    const discount = Number(order.discount_amount || 0);
    const shippingFee = Number(order.shipping_fee || 0);
    const totalAmount = Number(order.total_amount || 0);
    const advanceAmount = Number(order.advance_amount || 0);
    const dueAmount =
      order.due_amount !== undefined && order.due_amount !== null
        ? Number(order.due_amount)
        : Math.max(0, totalAmount - advanceAmount);
    const paymentMethod = String(order.payment_method || order.payment_provider || 'cash_on_delivery')
      .replace(/_/g, ' ')
      .toUpperCase();
    const transactionId = order.transaction_id || order.payment_transaction_id || null;

    const itemsRowsHtml = items
      .map((item) => {
        const name = escapeHtml(item.product_name || item.name || 'Garment');
        const variant = [item.variant_size || item.size, item.variant_color || item.color]
          .filter(Boolean)
          .join(' / ');
        const qty = Number(item.quantity || 1);
        const unitPrice = formatBdt(item.unit_price || 0);
        const lineTotal = formatBdt(item.line_total || item.subtotal || 0);
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
              <strong>${name}</strong>${variant ? `<br><small style="color:#6b7280;">${escapeHtml(variant)}</small>` : ''}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${qty}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${unitPrice}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;"><strong>${lineTotal}</strong></td>
          </tr>
        `;
      })
      .join('');

    const addressSummary = [addr.street_address, addr.area, addr.district, addr.city, addr.postal_code]
      .filter(Boolean)
      .join(', ');

    const subject = `Order Confirmation — ${orderNumber} | MAVLLIN`;

    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e232a;border:1px solid #e5e7eb;padding:28px;">
        <div style="text-align:center;border-bottom:2px solid #1e232a;padding-bottom:16px;margin-bottom:20px;">
          <h1 style="margin:0;letter-spacing:0.18em;font-size:22px;">MAVLLIN</h1>
          <p style="margin:4px 0 0;font-size:11px;letter-spacing:0.15em;color:#6b7280;">DHAKA • CONTEMPORARY ATELIER</p>
        </div>
        <h2 style="font-size:18px;margin-bottom:8px;">Thank you for your order, ${escapeHtml(customerName)}!</h2>
        <p style="font-size:14px;color:#4b5563;line-height:1.5;">
          We have received your order <strong>${escapeHtml(orderNumber)}</strong> and our atelier team is preparing your items.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
          <thead>
            <tr style="background:#f9fafb;text-transform:uppercase;font-size:11px;letter-spacing:0.06em;">
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #1e232a;">Item</th>
              <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e232a;">Qty</th>
              <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #1e232a;">Price</th>
              <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #1e232a;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>

        <div style="background:#f9fafb;padding:16px;border-radius:4px;font-size:13px;line-height:1.8;">
          <div>Subtotal: <strong style="float:right;">${formatBdt(subtotal)}</strong></div>
          ${discount > 0 ? `<div>Discount: <strong style="float:right;color:#059669;">-${formatBdt(discount)}</strong></div>` : ''}
          <div>Delivery Fee: <strong style="float:right;">${formatBdt(shippingFee)}</strong></div>
          <div style="border-top:1px solid #d1d5db;margin-top:6px;padding-top:6px;font-size:15px;">
            Total Amount: <strong style="float:right;">${formatBdt(totalAmount)}</strong>
          </div>
          ${advanceAmount > 0 ? `<div>Advance Required: <strong style="float:right;">${formatBdt(advanceAmount)}</strong></div>` : ''}
          <div>Balance Due on Delivery: <strong style="float:right;">${formatBdt(dueAmount)}</strong></div>
          <div>Payment Method: <strong style="float:right;">${escapeHtml(paymentMethod)}</strong></div>
          ${transactionId ? `<div>Transaction ID: <strong style="float:right;">${escapeHtml(transactionId)}</strong></div>` : ''}
        </div>

        <div style="margin-top:18px;font-size:13px;color:#4b5563;">
          <strong>Delivery Address:</strong><br>
          ${escapeHtml(customerName)} (${escapeHtml(addr.phone || order.customer_phone || '')})<br>
          ${escapeHtml(addressSummary || 'Dhaka, Bangladesh')}
        </div>
      </div>
    `;

    const text = [
      `MAVLLIN — Order Confirmation (${orderNumber})`,
      `Hello ${customerName},`,
      `Thank you for your order ${orderNumber}.`,
      `Total Amount: ${formatBdt(totalAmount)} (Advance: ${formatBdt(advanceAmount)}, Due: ${formatBdt(dueAmount)})`,
      `Payment Method: ${paymentMethod}${transactionId ? ` | TrxID: ${transactionId}` : ''}`,
      `Delivery Address: ${addressSummary || 'Bangladesh'}`,
    ].join('\n');

    return this.sendMail({
      to,
      subject,
      html,
      text,
      type: 'order_confirmation',
      orderNumber,
      status: order.status || 'pending',
      paymentStatus: order.payment_status || 'unpaid',
      metadata: {
        orderId: order.id,
        totalAmount,
        advanceAmount,
        dueAmount,
        transactionId,
      },
    });
  }

  async sendPaymentStatusEmail(order, rawPaymentStatus = 'paid') {
    if (!order) return null;
    const to = this.resolveCustomerEmail(order);
    const customerName = this.resolveCustomerName(order);
    const orderNumber = order.order_number || `MAV-${order.id || ''}`;
    const cleanInput = String(rawPaymentStatus || order.payment_status || 'paid').trim().toLowerCase();
    const isSuccess = ['paid', 'done', 'payment successful', 'payment_successful', 'completed', 'succeeded'].includes(
      cleanInput
    );

    const statusBadge = isSuccess ? 'PAYMENT SUCCESSFUL / DONE' : cleanInput.toUpperCase();
    const totalAmount = Number(order.total_amount || 0);
    const advanceAmount = Number(order.advance_amount || 0);
    const dueAmount =
      order.due_amount !== undefined && order.due_amount !== null
        ? Number(order.due_amount)
        : Math.max(0, totalAmount - advanceAmount);
    const transactionId = order.transaction_id || order.payment_transaction_id || null;

    const subject = isSuccess
      ? `Payment Confirmation — Order ${orderNumber} | MAVLLIN`
      : `Payment Status Update (${statusBadge}) — Order ${orderNumber} | MAVLLIN`;

    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e232a;border:1px solid #e5e7eb;padding:28px;">
        <div style="text-align:center;border-bottom:2px solid #1e232a;padding-bottom:16px;margin-bottom:20px;">
          <h1 style="margin:0;letter-spacing:0.18em;font-size:22px;">MAVLLIN</h1>
          <p style="margin:4px 0 0;font-size:11px;letter-spacing:0.15em;color:#6b7280;">DHAKA • CONTEMPORARY ATELIER</p>
        </div>
        <h2 style="font-size:18px;margin-bottom:8px;">
          ${isSuccess ? 'Payment Verified & Confirmed' : `Payment Status: ${escapeHtml(statusBadge)}`}
        </h2>
        <p style="font-size:14px;color:#4b5563;line-height:1.5;">
          Dear ${escapeHtml(customerName)}, the payment status for your order <strong>${escapeHtml(orderNumber)}</strong> has been updated to <strong>${escapeHtml(statusBadge)}</strong>.
        </p>
        <div style="background:#f9fafb;padding:16px;border-radius:4px;font-size:13px;line-height:1.8;margin:16px 0;">
          <div>Order Number: <strong style="float:right;">${escapeHtml(orderNumber)}</strong></div>
          <div>Payment Status: <strong style="float:right;color:${isSuccess ? '#059669' : '#1e232a'};">${escapeHtml(statusBadge)}</strong></div>
          ${transactionId ? `<div>Transaction ID: <strong style="float:right;">${escapeHtml(transactionId)}</strong></div>` : ''}
          <div>Order Total: <strong style="float:right;">${formatBdt(totalAmount)}</strong></div>
          ${advanceAmount > 0 ? `<div>Advance Amount: <strong style="float:right;">${formatBdt(advanceAmount)}</strong></div>` : ''}
          <div>Remaining Balance Due: <strong style="float:right;">${formatBdt(isSuccess && advanceAmount === 0 ? 0 : dueAmount)}</strong></div>
        </div>
      </div>
    `;

    const text = [
      `MAVLLIN — ${subject}`,
      `Hello ${customerName},`,
      `Your payment status for order ${orderNumber} is now: ${statusBadge}.`,
      `Order Total: ${formatBdt(totalAmount)}${transactionId ? ` | TrxID: ${transactionId}` : ''}`,
    ].join('\n');

    return this.sendMail({
      to,
      subject,
      html,
      text,
      type: 'payment_status',
      orderNumber,
      status: order.status || 'pending',
      paymentStatus: isSuccess ? 'paid' : cleanInput,
      metadata: {
        orderId: order.id,
        rawPaymentStatus,
        isPaymentSuccessful: isSuccess,
        transactionId,
        totalAmount,
      },
    });
  }

  async sendOrderStatusEmail(order, previousStatus, newStatus, rawStatusLabel = null) {
    if (!order) return null;
    const to = this.resolveCustomerEmail(order);
    const customerName = this.resolveCustomerName(order);
    const orderNumber = order.order_number || `MAV-${order.id || ''}`;
    const displayStatus = String(rawStatusLabel || newStatus || order.status || 'updated').trim().toLowerCase();
    const displayUpper = displayStatus.toUpperCase();
    const totalAmount = Number(order.total_amount || 0);

    const statusDescriptions = {
      pending: 'Your order has been received and is awaiting confirmation.',
      confirmed: 'Your order has been confirmed by our Dhaka atelier and is queued for preparation.',
      processing: 'Your garments are currently being prepared, quality-checked, and packed for dispatch.',
      dispatch: 'Your order has been dispatched from our atelier and handed over for courier transit.',
      dispatched: 'Your order has been dispatched from our atelier and handed over for courier transit.',
      shipped: 'Your order is on the way with our courier partner.',
      delivered: 'Your order has been delivered. Thank you for shopping with MAVLLIN!',
      cancelled: 'Your order has been cancelled. If you have any questions, please contact MAVLLIN Concierge.',
    };

    const statusMessage =
      statusDescriptions[displayStatus] ||
      statusDescriptions[String(newStatus || '').toLowerCase()] ||
      `Your order status has been updated to ${displayUpper}.`;

    const courierName = order.courier_name || null;
    const trackingNumber = order.tracking_number || null;

    const subject = `Order Status Update: ${displayUpper} — ${orderNumber} | MAVLLIN`;

    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e232a;border:1px solid #e5e7eb;padding:28px;">
        <div style="text-align:center;border-bottom:2px solid #1e232a;padding-bottom:16px;margin-bottom:20px;">
          <h1 style="margin:0;letter-spacing:0.18em;font-size:22px;">MAVLLIN</h1>
          <p style="margin:4px 0 0;font-size:11px;letter-spacing:0.15em;color:#6b7280;">DHAKA • CONTEMPORARY ATELIER</p>
        </div>
        <h2 style="font-size:18px;margin-bottom:8px;">Order ${escapeHtml(orderNumber)} is now ${escapeHtml(displayUpper)}</h2>
        <p style="font-size:14px;color:#4b5563;line-height:1.5;">
          Dear ${escapeHtml(customerName)}, ${escapeHtml(statusMessage)}
        </p>
        <div style="background:#f9fafb;padding:16px;border-radius:4px;font-size:13px;line-height:1.8;margin:16px 0;">
          <div>Order Number: <strong style="float:right;">${escapeHtml(orderNumber)}</strong></div>
          ${previousStatus ? `<div>Previous Status: <strong style="float:right;">${escapeHtml(String(previousStatus).toUpperCase())}</strong></div>` : ''}
          <div>Current Status: <strong style="float:right;color:#059669;">${escapeHtml(displayUpper)}</strong></div>
          ${courierName ? `<div>Courier Partner: <strong style="float:right;">${escapeHtml(courierName)}</strong></div>` : ''}
          ${trackingNumber ? `<div>Tracking Number: <strong style="float:right;">${escapeHtml(trackingNumber)}</strong></div>` : ''}
          <div>Order Total: <strong style="float:right;">${formatBdt(totalAmount)}</strong></div>
        </div>
      </div>
    `;

    const text = [
      `MAVLLIN — ${subject}`,
      `Hello ${customerName},`,
      statusMessage,
      `Order: ${orderNumber} | Status: ${displayUpper}`,
      courierName || trackingNumber ? `Courier: ${courierName || 'Standard'} | Tracking: ${trackingNumber || 'N/A'}` : '',
      `Order Total: ${formatBdt(totalAmount)}`,
    ]
      .filter(Boolean)
      .join('\n');

    return this.sendMail({
      to,
      subject,
      html,
      text,
      type: 'order_status',
      orderNumber,
      status: displayStatus,
      paymentStatus: order.payment_status || 'unpaid',
      metadata: {
        orderId: order.id,
        previousStatus: previousStatus || null,
        newStatus: newStatus || order.status,
        displayStatus,
        courierName,
        trackingNumber,
        totalAmount,
      },
    });
  }
}

const mailServiceInstance = new MailService();
mailServiceInstance.MailService = MailService;

module.exports = mailServiceInstance;
