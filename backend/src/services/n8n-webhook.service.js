const env = require('../config/env');

const DEEPSEEK_SYSTEM_PROMPT = `You are the Executive Operations AI for MAVLLIN (Dhaka, Bangladesh), a contemporary luxury menswear and atelier fashion house.
Transform the provided order JSON into an elegant, high-impact, scannable executive WhatsApp notification for the store owner.

Formatting Guidelines:
1. Use WhatsApp formatting: *bold* for emphasis, _italics_ for sub-notes, bullet points for lists.
2. Minimalist luxury emojis (🛍️, 📋, 👤, 📍, 📦, 💰, 💳, 📝, ⚠️).
3. Express all prices strictly in Bangladeshi Taka (৳).
4. Highlight urgency:
   - For bKash/Nagad/Rocket/Upay/Manual payments: Flag "⚠️ ACTION REQUIRED: Verify Transaction ID in statement".
   - For COD: Display "Cash on Delivery - Collect payment on parcel handover".
   - State destination region: "Inside Dhaka" or "Outside Dhaka".
5. Keep within 20–25 lines so it can be reviewed at a glance without scrolling.
6. Do NOT output markdown headers (#, ##). Use divider lines: ━━━━━━━━━━━━━━━━━━━━━━`;

/**
 * Safely parse shipping address whether it is an object, JSON string, or plain text string.
 * Gracefully extracts or infers city and avoids unhandled SyntaxError crashes.
 */
function parseShippingAddress(address) {
  if (!address) return null;
  if (typeof address === 'object') return address;
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Fallback for non-JSON plain string address
      const lower = address.toLowerCase();
      let city = 'Dhaka';
      if (lower.includes('chattogram') || lower.includes('chittagong')) city = 'Chattogram';
      else if (lower.includes('sylhet')) city = 'Sylhet';
      else if (lower.includes('rajshahi')) city = 'Rajshahi';
      else if (lower.includes('khulna')) city = 'Khulna';
      else if (lower.includes('barishal') || lower.includes('barisal')) city = 'Barishal';
      else if (lower.includes('rangpur')) city = 'Rangpur';
      else if (lower.includes('mymensingh')) city = 'Mymensingh';

      return { street_address: address, city };
    }
  }
  return { street_address: String(address), city: 'Dhaka' };
}

function formatExecutiveWhatsAppAlert(order) {
  const customerName = order.customer_name || 'Guest Customer';
  const parsedAddress = parseShippingAddress(order.shipping_address);
  const customerPhone = order.customer_phone || (parsedAddress && parsedAddress.phone) || 'N/A';

  let addressCity = 'Dhaka';
  let addressArea = '';
  if (parsedAddress) {
    addressCity = parsedAddress.city || 'Dhaka';
    addressArea = parsedAddress.area || parsedAddress.street_address || '';
  }

  const isInsideDhaka = addressCity.toLowerCase().includes('dhaka');
  const regionTag = isInsideDhaka ? 'Inside Dhaka (1-2 days)' : 'Outside Dhaka (3-5 days)';
  const destLocation = addressArea
    ? (addressArea.toLowerCase().includes(addressCity.toLowerCase()) ? addressArea : `${addressArea}, ${addressCity}`)
    : addressCity;

  const itemsList = (order.items || []).map((i) => {
    const sizeColor = [i.size ? `Size: ${i.size}` : null, i.color ? `Color: ${i.color}` : null].filter(Boolean).join(' | ');
    return `• ${i.quantity}x ${i.product_name || 'Garment'}\n  _${sizeColor ? `${sizeColor} | ` : ''}৳${Number(i.unit_price || 0).toLocaleString('en-US')}_`;
  }).join('\n');

  const subtotal = Number(order.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const discount = Number(order.discount_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const shipping = Number(order.shipping_fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const total = Number(order.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const advance = Number(order.advance_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const due = Number(order.due_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

  const isManual = ['manual', 'bkash', 'nagad', 'rocket', 'upay'].includes((order.payment_method || '').toLowerCase());
  const trxId = order.transaction_id || 'NOT_PROVIDED';
  const senderPhone = order.sender_phone || 'NOT_PROVIDED';

  let paymentBlock = `• *Payment:* ${String(order.payment_method).toUpperCase()} (${order.payment_status || 'unpaid'})`;
  if (isManual) {
    paymentBlock += `\n• *TrxID:* \`${trxId}\` (Sender: \`${senderPhone}\`)`;
  }
  if (Number(order.advance_amount) > 0) {
    paymentBlock += `\n• *Advance Paid/Required:* ৳${advance} | *Due upon delivery:* ৳${due}`;
  }

  let actionBlock = '1. Review and transition order status to "Confirmed".\n2. Dispatch to tailoring and packaging.';
  if (isManual) {
    actionBlock = `1. ⚠️ VERIFY TrxID \`${trxId}\` in Merchant Statement before dispatch!\n2. Transition order status to "Confirmed".`;
  }

  return `🛍️ *NEW MAVLLIN ORDER RECEIVED*
━━━━━━━━━━━━━━━━━━━━━━
📋 *Order:* #${order.order_number}
👤 *Client:* ${customerName} (📞 \`${customerPhone}\`)
📍 *Destination:* ${destLocation} (*${regionTag}*)

📦 *Garment Selection:*
${itemsList || '• Standard Collection Item'}

💰 *Order Financials:*
• Subtotal: ৳${subtotal}
• Promo Discount: -৳${discount}
• Delivery Fee: ৳${shipping}
• *Total Payable:* *৳${total}*
${paymentBlock}

${order.notes ? `📝 *Customer Note:* _"${order.notes}"_\n` : ''}⚠️ *ACTION REQUIRED:*
${actionBlock}
━━━━━━━━━━━━━━━━━━━━━━`;
}

class N8nWebhookService {
  constructor() {
    this.dispatchedEvents = [];
  }

  /**
   * Format WhatsApp alert fallback helper (exposed for direct consumer access)
   */
  formatWhatsAppAlertFallback(order) {
    return formatExecutiveWhatsAppAlert(order);
  }

  formatExecutiveWhatsAppAlert(order) {
    return formatExecutiveWhatsAppAlert(order);
  }

  /**
   * Build N8N webhook payload with complete order, customer, financial, and DeepSeek configurations.
   */
  buildPayload(order) {
    const formattedAlert = formatExecutiveWhatsAppAlert(order);

    return {
      event: 'order.created',
      event_id: `evt_mav_${order.id}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      store: {
        name: 'MAVLLIN',
        atelier_location: 'Dhaka, Bangladesh',
        currency: 'BDT',
        currency_symbol: '৳',
        admin_order_url: `${env.clientUrl}/admin/orders`,
      },
      order: {
        id: order.id,
        order_number: order.order_number,
        created_at: order.created_at,
        status: order.status,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        payment_provider: order.payment_provider || order.payment_method,
        transaction_id: order.transaction_id || null,
        sender_phone: order.sender_phone || null,
        subtotal: Number(order.subtotal || 0),
        discount_amount: Number(order.discount_amount || 0),
        shipping_fee: Number(order.shipping_fee || 0),
        advance_amount: Number(order.advance_amount || 0),
        due_amount: Number(order.due_amount || 0),
        advance_payment_status: order.advance_payment_status || 'unpaid',
        total_amount: Number(order.total_amount || 0),
        customer_notes: order.notes || null,
      },
      customer: {
        name: order.customer_name || 'Guest',
        email: order.customer_email || null,
        phone: order.customer_phone || null,
        is_guest: !order.user_id,
      },
      shipping_address: parseShippingAddress(order.shipping_address),
      items: (order.items || []).map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        variant_sku: item.variant_sku || null,
        size: item.size || null,
        color: item.color || null,
        unit_price: Number(item.unit_price || 0),
        quantity: item.quantity,
        line_total: Number(item.line_total || 0),
        advance_amount: Number(item.advance_amount || 0),
      })),
      notification_target: {
        recipient_whatsapp: env.n8n.ownerWhatsAppNumber,
        ai_formatting: {
          provider: 'deepseek',
          model: env.n8n.deepseekModel,
          prompt_type: 'owner_executive_alert',
        },
      },
      deepseek_config: {
        system_prompt: DEEPSEEK_SYSTEM_PROMPT,
        user_prompt: `Generate an executive WhatsApp order alert for this order:\n${JSON.stringify(order, null, 2)}`,
      },
      formatted_alert_fallback: formattedAlert,
    };
  }

  /**
   * Dispatch webhook asynchronously.
   * NEVER blocks caller and handles mock mode gracefully.
   */
  async dispatchOrderPlaced(order) {
    if (!order) return { success: false, reason: 'No order provided' };

    const payload = this.buildPayload(order);
    const isMock =
      process.env.ORDER_NOTIFICATION_MODE === 'mock' ||
      env.n8n.orderNotificationMode === 'mock' ||
      process.env.NODE_ENV === 'test' ||
      !env.n8n.webhookUrl;

    if (isMock) {
      this.dispatchedEvents.push(payload);
      return {
        success: true,
        mock: true,
        eventId: payload.event_id,
        orderNumber: order.order_number,
        alertPreview: payload.formatted_alert_fallback,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (env.n8n.webhookSecret) {
        headers['X-Webhook-Secret'] = env.n8n.webhookSecret;
      }

      const res = await fetch(env.n8n.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.error(`[N8N-Webhook] Failed with status ${res.status}`);
        return { success: false, status: res.status };
      }

      return { success: true, eventId: payload.event_id };
    } catch (err) {
      console.error('[N8N-Webhook] Network error during dispatch:', err.message);
      return { success: false, error: err.message };
    } finally {
      clearTimeout(timeout);
    }
  }

  getDispatchedEvents() {
    return [...this.dispatchedEvents];
  }

  getLastDispatchedEvent() {
    return this.dispatchedEvents[this.dispatchedEvents.length - 1] || null;
  }

  clearDispatchedEvents() {
    this.dispatchedEvents = [];
  }
}

module.exports = new N8nWebhookService();
