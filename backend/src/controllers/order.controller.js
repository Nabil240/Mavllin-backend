const OrderModel = require('../models/order.model');
const CartModel = require('../models/cart.model');
const CouponModel = require('../models/coupon.model');
const ProductModel = require('../models/product.model');
const SettingModel = require('../models/setting.model');
const n8nWebhookService = require('../services/n8n-webhook.service');
const mailService = require('../services/mail.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { generateOrderNumber, paginate } = require('../utils/helpers');

async function calculateShippingFee(subtotal, shippingAddress) {
  let settings = SettingModel.DEFAULT_SETTINGS;
  try {
    settings = await SettingModel.getAll();
  } catch (_e) {
    // fallback to defaults
  }

  const freeThreshold = Number(settings.free_shipping_threshold ?? 2500.0);
  const insideFee = Number(settings.delivery_charge_inside_dhaka ?? 70.0);
  const outsideFee = Number(settings.delivery_charge_outside_dhaka ?? 130.0);

  if (freeThreshold > 0 && Number(subtotal) >= freeThreshold) {
    return 0.0;
  }

  const city = String((shippingAddress && shippingAddress.city) || '').trim().toLowerCase();
  const division = String((shippingAddress && (shippingAddress.division || shippingAddress.state)) || '').trim().toLowerCase();
  const district = String((shippingAddress && (shippingAddress.district || shippingAddress.area)) || '').trim().toLowerCase();
  const regionCode = String((shippingAddress && shippingAddress.region_code) || '').trim().toLowerCase();

  const isDhaka =
    regionCode === 'inside_dhaka' ||
    city.includes('dhaka') ||
    division.includes('dhaka') ||
    district.includes('dhaka');

  if (isDhaka) {
    return insideFee;
  }
  return outsideFee;
}

async function resolveDirectOrderItems(rawItems) {
  const orderItems = [];
  let subtotal = 0;

  for (const entry of rawItems) {
    if (!entry) continue;
    const rawVariantId = entry.variant_id || entry.variantId || null;
    const rawProductId = entry.product_id || entry.productId || null;
    const qty = Math.max(1, parseInt(entry.quantity, 10) || 1);

    let variant = null;
    let product = null;

    if (rawVariantId) {
      variant = await ProductModel.findVariantById(Number(rawVariantId));
      if (!variant) {
        const err = new Error(`Product variant ${rawVariantId} not found`);
        err.statusCode = 404;
        throw err;
      }
      product = await ProductModel.findById(variant.product_id);
    } else if (rawProductId) {
      product = await ProductModel.findById(Number(rawProductId));
      if (product) {
        variant = await CartModel.getFirstActiveVariant(product.id);
      }
    }

    if (!product || !variant) {
      const err = new Error('Product or variant not found');
      err.statusCode = 404;
      throw err;
    }

    if (!product.is_active || !variant.is_active) {
      const err = new Error(`Product "${product.name}" is no longer active and cannot be ordered`);
      err.statusCode = 400;
      throw err;
    }

    if (qty > Number(variant.stock_quantity)) {
      const err = new Error(
        `Insufficient stock for "${product.name}" (${variant.sku}). Only ${variant.stock_quantity} available`
      );
      err.statusCode = 400;
      throw err;
    }

    let effectivePrice = Number(variant.price || product.base_price);
    if (product.discount_type === 'percentage' && Number(product.discount_value) > 0) {
      effectivePrice = parseFloat((effectivePrice * (1.0 - Number(product.discount_value) / 100.0)).toFixed(2));
    } else if (product.discount_type === 'fixed' && Number(product.discount_value) > 0) {
      effectivePrice = Math.max(0, parseFloat((effectivePrice - Number(product.discount_value)).toFixed(2)));
    } else if (product.discount_price && Number(product.discount_price) > 0 && Number(product.discount_price) < effectivePrice) {
      effectivePrice = Number(product.discount_price);
    }
    const unitPrice = effectivePrice;
    const lineTotal = parseFloat((unitPrice * qty).toFixed(2));
    subtotal += lineTotal;

    orderItems.push({
      product_id: product.id,
      variant_id: variant.id,
      product_name: product.name,
      variant_sku: variant.sku,
      variant_size: variant.size,
      variant_color: variant.color,
      unit_price: unitPrice,
      quantity: qty,
      line_total: lineTotal,
      subtotal: lineTotal,
      advance_payment_type: product.advance_payment_type || 'none',
    });
  }

  return {
    orderItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
  };
}

const OrderController = {
  async placeOrder(req, res) {
    const userId = req.user.id;
    const {
      shipping_address,
      payment_method,
      payment_provider,
      transaction_id = null,
      sender_phone = null,
      coupon_code = null,
      notes = null,
      recipient_notes = null,
      items: bodyItems,
    } = req.body;

    const cleanPaymentMethod = typeof payment_method === 'string' ? payment_method.trim().toLowerCase().replace(/[\s-]+/g, '_') : null;
    const cleanPaymentProvider = typeof payment_provider === 'string' ? payment_provider.trim().toLowerCase().replace(/[\s-]+/g, '_') : null;
    const rawPaymentInput = cleanPaymentMethod || cleanPaymentProvider || 'cash_on_delivery';
    const paymentAliasMap = {
      cod: 'cod',
      cash_on_delivery: 'cod',
      'cash-on-delivery': 'cod',
      'cash on delivery': 'cod',
      manual: 'manual',
      manual_payment: 'manual',
      'manual-payment': 'manual',
      'manual payment': 'manual',
      bkash: 'bkash',
      nagad: 'nagad',
      nogod: 'nagad',
      rocket: 'rocket',
      upay: 'upay',
      upai: 'upay',
    };
    const provider = paymentAliasMap[rawPaymentInput] || rawPaymentInput;
    const normalizedPaymentMethod = provider === 'cod' ? 'cash_on_delivery' : (provider === 'manual' ? 'manual' : provider);
    const manualVerificationProviders = ['cod', 'manual', 'manual_payment', 'bkash', 'nagad', 'rocket', 'upay'];
    const isManualVerification = manualVerificationProviders.includes(provider);

    const cleanTrx = transaction_id != null ? String(transaction_id).trim().slice(0, 120) : '';
    const cleanPhone = sender_phone != null ? String(sender_phone).trim().slice(0, 30) : '';
    let formattedTrxId = null;
    if (cleanTrx) {
      formattedTrxId = cleanPhone ? `${cleanTrx} (From: ${cleanPhone})` : cleanTrx;
    } else if (provider !== 'cod') {
      formattedTrxId = `TXN-${Date.now()}`;
    }
    if (formattedTrxId && formattedTrxId.length > 160) {
      formattedTrxId = formattedTrxId.slice(0, 160);
    }

    if (['manual', 'manual_payment'].includes(provider) || ['manual', 'manual_payment'].includes(cleanPaymentMethod)) {
      if (!cleanTrx || cleanTrx.length === 0) {
        return sendError(res, { statusCode: 400, message: 'Transaction ID is required for manual payments' });
      }
    }

    const effectiveNotes = notes || recipient_notes || null;

    let orderItems = [];
    let subtotal = 0;

    if (Array.isArray(bodyItems) && bodyItems.length > 0) {
      const resolved = await resolveDirectOrderItems(bodyItems);
      orderItems = resolved.orderItems;
      subtotal = resolved.subtotal;
    } else {
      const cartItems = await CartModel.getItemsByUserId(userId);
      if (!cartItems || cartItems.length === 0) {
        return sendError(res, { statusCode: 400, message: 'Your shopping cart is empty' });
      }

      for (const item of cartItems) {
        if (!item.is_active) {
          return sendError(res, {
            statusCode: 400,
            message: `Product "${item.product_name}" is no longer active and cannot be ordered`,
          });
        }

        if (item.quantity > item.stock_quantity) {
          return sendError(res, {
            statusCode: 400,
            message: `Insufficient stock for "${item.product_name}". Only ${item.stock_quantity} available`,
          });
        }

        const unitPrice = Number(item.effective_price);
        const lineTotal = parseFloat((unitPrice * item.quantity).toFixed(2));
        subtotal += lineTotal;

        orderItems.push({
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.product_name,
          variant_sku: item.variant_sku,
          variant_size: item.size,
          size: item.size,
          variant_color: item.color,
          color: item.color,
          unit_price: unitPrice,
          quantity: item.quantity,
          line_total: lineTotal,
          subtotal: lineTotal,
          advance_payment_type: item.advance_payment_type || 'none',
        });
      }

      subtotal = parseFloat(subtotal.toFixed(2));
    }

    if (orderItems.length === 0) {
      return sendError(res, { statusCode: 400, message: 'No valid items to order' });
    }

    // Process Coupon if provided
    let discountAmount = 0;
    let couponId = null;

    if (coupon_code) {
      const coupon = await CouponModel.findByCode(coupon_code);
      if (coupon) {
        const couponCheck = CouponModel.calculateDiscount(coupon, subtotal);
        if (couponCheck.valid) {
          discountAmount = couponCheck.discount;
          couponId = coupon.id;
        } else {
          return sendError(res, { statusCode: 400, message: couponCheck.message });
        }
      } else {
        return sendError(res, { statusCode: 404, message: 'Invalid coupon code' });
      }
    }

    const shippingFee = await calculateShippingFee(subtotal, shipping_address);
    const totalAmount = parseFloat(Math.max(0, subtotal - discountAmount + shippingFee).toFixed(2));
    const orderNumber = generateOrderNumber();

    // Advance Calculation Engine
    let requiredAdvance = 0;
    let requiresDeliveryAdvance = false;
    let allItemsFullAdvance = orderItems.length > 0;

    for (const item of orderItems) {
      const advType = item.advance_payment_type || 'none';
      let itemAdvance = 0;
      if (advType === 'thirty_percent' || advType === 'percent_30') {
        itemAdvance = parseFloat((item.line_total * 0.30).toFixed(2));
        allItemsFullAdvance = false;
      } else if (advType === 'fifty_percent' || advType === 'percent_50') {
        itemAdvance = parseFloat((item.line_total * 0.50).toFixed(2));
        allItemsFullAdvance = false;
      } else if (advType === 'full' || advType === 'percent_100') {
        itemAdvance = item.line_total;
      } else if (advType === 'delivery_charge') {
        requiresDeliveryAdvance = true;
        allItemsFullAdvance = false;
      } else {
        allItemsFullAdvance = false;
      }
      item.advance_amount = itemAdvance;
      requiredAdvance += itemAdvance;
    }

    const deliveryAdvance = (requiresDeliveryAdvance || allItemsFullAdvance) ? shippingFee : 0.00;
    requiredAdvance = parseFloat(Math.min(totalAmount, requiredAdvance + deliveryAdvance).toFixed(2));
    const dueAmount = parseFloat(Math.max(0.00, totalAmount - requiredAdvance).toFixed(2));

    // Advance payment checkout enforcement
    if (requiredAdvance > 0) {
      if (provider === 'cod' && (!cleanTrx || cleanTrx.length === 0)) {
        return sendError(res, {
          statusCode: 400,
          message: `Advance payment of ৳${requiredAdvance} is required for this order. Please provide a valid transaction ID.`,
        });
      }
    }

    const orderId = await OrderModel.createWithTransaction({
      orderData: {
        order_number: orderNumber,
        user_id: userId,
        subtotal,
        discount_amount: discountAmount,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        advance_amount: requiredAdvance,
        due_amount: dueAmount,
        advance_payment_status: requiredAdvance > 0 ? 'unpaid' : 'paid',
        status: 'pending',
        payment_method: normalizedPaymentMethod,
        payment_status: isManualVerification ? 'unpaid' : 'paid',
        shipping_address,
        notes: effectiveNotes,
      },
      items: orderItems,
      paymentData: {
        provider,
        status: isManualVerification ? 'pending' : 'succeeded',
        transaction_id: formattedTrxId,
      },
      couponId,
    });

    const createdOrder = await OrderModel.findById(orderId);

    // Send customer order confirmation email (R7)
    await mailService
      .sendOrderConfirmation(createdOrder)
      .catch((err) => console.error('[MailService] Order confirmation email failed:', err.message));

    // Trigger non-blocking N8N Order Webhook with DeepSeek executive notification
    setImmediate(() => {
      n8nWebhookService.dispatchOrderPlaced(createdOrder)
        .catch(err => console.error('[N8N-OrderHook] Async dispatch failed:', err.message));
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Order placed successfully',
      data: createdOrder,
    });
  },

  async placeGuestOrder(req, res) {
    const {
      guest_email = null,
      shipping_address,
      payment_method,
      payment_provider,
      transaction_id = null,
      sender_phone = null,
      coupon_code = null,
      notes = null,
      recipient_notes = null,
      items,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, { statusCode: 400, message: 'Order items are required for guest checkout' });
    }

    const cleanCouponCode = typeof coupon_code === 'string' ? coupon_code.trim() : null;
    const hasDiscountAmount = req.body.discount_amount != null && Number(req.body.discount_amount) > 0;
    let universalCoupon = null;

    if (cleanCouponCode) {
      universalCoupon = await CouponModel.findByCode(cleanCouponCode);
      if (!universalCoupon || !universalCoupon.is_universal) {
        return sendError(res, {
          statusCode: 400,
          message: 'Coupons and promotional discounts are exclusively available to registered customers. Please log in or create an account to apply coupons.',
        });
      }
    } else if (hasDiscountAmount) {
      return sendError(res, {
        statusCode: 400,
        message: 'Coupons and promotional discounts are exclusively available to registered customers. Please log in or create an account to apply coupons.',
      });
    }

    const cleanPaymentMethod = typeof payment_method === 'string' ? payment_method.trim().toLowerCase().replace(/[\s-]+/g, '_') : null;
    const cleanPaymentProvider = typeof payment_provider === 'string' ? payment_provider.trim().toLowerCase().replace(/[\s-]+/g, '_') : null;
    const rawPaymentInput = cleanPaymentMethod || cleanPaymentProvider || 'cash_on_delivery';
    const paymentAliasMap = {
      cod: 'cod',
      cash_on_delivery: 'cod',
      'cash-on-delivery': 'cod',
      'cash on delivery': 'cod',
      manual: 'manual',
      manual_payment: 'manual',
      'manual-payment': 'manual',
      'manual payment': 'manual',
      bkash: 'bkash',
      nagad: 'nagad',
      nogod: 'nagad',
      rocket: 'rocket',
      upay: 'upay',
      upai: 'upay',
    };
    const provider = paymentAliasMap[rawPaymentInput] || rawPaymentInput;
    const normalizedPaymentMethod = provider === 'cod' ? 'cash_on_delivery' : (provider === 'manual' ? 'manual' : provider);
    const manualVerificationProviders = ['cod', 'manual', 'manual_payment', 'bkash', 'nagad', 'rocket', 'upay'];
    const isManualVerification = manualVerificationProviders.includes(provider);

    const cleanTrx = transaction_id != null ? String(transaction_id).trim().slice(0, 120) : '';
    const cleanPhone = sender_phone != null ? String(sender_phone).trim().slice(0, 30) : '';
    let formattedTrxId = null;
    if (cleanTrx) {
      formattedTrxId = cleanPhone ? `${cleanTrx} (From: ${cleanPhone})` : cleanTrx;
    } else if (provider !== 'cod') {
      formattedTrxId = `TXN-${Date.now()}`;
    }
    if (formattedTrxId && formattedTrxId.length > 160) {
      formattedTrxId = formattedTrxId.slice(0, 160);
    }

    if (['manual', 'manual_payment'].includes(provider) || ['manual', 'manual_payment'].includes(cleanPaymentMethod)) {
      if (!cleanTrx || cleanTrx.length === 0) {
        return sendError(res, { statusCode: 400, message: 'Transaction ID is required for manual payments' });
      }
    }

    const effectiveNotes = notes || recipient_notes || null;

    const { orderItems, subtotal } = await resolveDirectOrderItems(items);

    let discountAmount = 0;
    let couponId = null;

    if (universalCoupon) {
      const couponCheck = CouponModel.calculateDiscount(universalCoupon, subtotal);
      if (!couponCheck.valid) {
        return sendError(res, { statusCode: 400, message: couponCheck.message });
      }
      discountAmount = couponCheck.discount;
      couponId = universalCoupon.id;
    }

    const shippingFee = await calculateShippingFee(subtotal, shipping_address);
    const totalAmount = parseFloat(Math.max(0, subtotal - discountAmount + shippingFee).toFixed(2));
    const orderNumber = generateOrderNumber();

    // Advance Calculation Engine
    let requiredAdvance = 0;
    let requiresDeliveryAdvance = false;
    let allItemsFullAdvance = orderItems.length > 0;

    for (const item of orderItems) {
      const advType = item.advance_payment_type || 'none';
      let itemAdvance = 0;
      if (advType === 'thirty_percent' || advType === 'percent_30') {
        itemAdvance = parseFloat((item.line_total * 0.30).toFixed(2));
        allItemsFullAdvance = false;
      } else if (advType === 'fifty_percent' || advType === 'percent_50') {
        itemAdvance = parseFloat((item.line_total * 0.50).toFixed(2));
        allItemsFullAdvance = false;
      } else if (advType === 'full' || advType === 'percent_100') {
        itemAdvance = item.line_total;
      } else if (advType === 'delivery_charge') {
        requiresDeliveryAdvance = true;
        allItemsFullAdvance = false;
      } else {
        allItemsFullAdvance = false;
      }
      item.advance_amount = itemAdvance;
      requiredAdvance += itemAdvance;
    }

    const deliveryAdvance = (requiresDeliveryAdvance || allItemsFullAdvance) ? shippingFee : 0.00;
    requiredAdvance = parseFloat(Math.min(totalAmount, requiredAdvance + deliveryAdvance).toFixed(2));
    const dueAmount = parseFloat(Math.max(0.00, totalAmount - requiredAdvance).toFixed(2));

    // Advance payment checkout enforcement
    if (requiredAdvance > 0) {
      if (provider === 'cod' && (!cleanTrx || cleanTrx.length === 0)) {
        return sendError(res, {
          statusCode: 400,
          message: `Advance payment of ৳${requiredAdvance} is required for this order. Please provide a valid transaction ID.`,
        });
      }
    }

    const orderId = await OrderModel.createWithTransaction({
      orderData: {
        order_number: orderNumber,
        user_id: null,
        guest_email: guest_email || (shipping_address && shipping_address.email) || null,
        guest_phone: (shipping_address && shipping_address.phone) || null,
        subtotal,
        discount_amount: discountAmount,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        advance_amount: requiredAdvance,
        due_amount: dueAmount,
        advance_payment_status: requiredAdvance > 0 ? 'unpaid' : 'paid',
        status: 'pending',
        payment_method: normalizedPaymentMethod,
        payment_status: isManualVerification ? 'unpaid' : 'paid',
        shipping_address,
        notes: effectiveNotes,
      },
      items: orderItems,
      paymentData: {
        provider,
        status: isManualVerification ? 'pending' : 'succeeded',
        transaction_id: formattedTrxId,
      },
      couponId,
    });

    const createdOrder = await OrderModel.findById(orderId);

    // Send customer order confirmation email (R7)
    await mailService
      .sendOrderConfirmation(createdOrder)
      .catch((err) => console.error('[MailService] Guest order confirmation email failed:', err.message));

    // Trigger non-blocking N8N Order Webhook with DeepSeek executive notification
    setImmediate(() => {
      n8nWebhookService.dispatchOrderPlaced(createdOrder)
        .catch(err => console.error('[N8N-OrderHook] Async guest dispatch failed:', err.message));
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Guest order placed successfully',
      data: createdOrder,
    });
  },

  async checkoutOrder(req, res) {
    if (req.user && req.user.id) {
      return OrderController.placeOrder(req, res);
    }

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, {
        statusCode: 400,
        message: 'Order items are required for guest checkout (or log in to checkout your cart)',
      });
    }
    return OrderController.placeGuestOrder(req, res);
  },

  async trackOrder(req, res) {
    const identifier = req.params.orderNumber;
    let order = await OrderModel.findByOrderNumber(identifier);
    if (!order && !isNaN(identifier)) {
      order = await OrderModel.findById(Number(identifier));
    }

    if (!order) {
      return sendError(res, { statusCode: 404, message: 'Order not found' });
    }

    return sendSuccess(res, {
      message: 'Order tracking details retrieved',
      data: order,
    });
  },

  async getMyOrders(req, res) {
    const { page = 1, limit = 10, status = null } = req.query;
    const total = await OrderModel.countByUserId(req.user.id, { status });
    const pagination = paginate({ page, limit, total });

    const orders = await OrderModel.findByUserId(req.user.id, {
      offset: pagination.offset,
      limit: pagination.limit,
      status,
    });

    return sendSuccess(res, {
      message: 'Orders retrieved successfully',
      data: orders,
      meta: pagination,
    });
  },

  async getOne(req, res) {
    const { id } = req.params;
    let order = null;

    if (!isNaN(id)) {
      order = await OrderModel.findById(Number(id));
    }

    if (!order) {
      order = await OrderModel.findByOrderNumber(id);
    }

    if (!order) {
      return sendError(res, { statusCode: 404, message: 'Order not found' });
    }

    // Check ownership if not admin
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return sendError(res, { statusCode: 403, message: 'Access denied to this order' });
    }

    return sendSuccess(res, {
      message: 'Order retrieved successfully',
      data: order,
    });
  },

  async cancelOrder(req, res) {
    const { id } = req.params;
    const reason = req.body.reason || req.body.cancellation_reason || 'Cancelled by user';

    let order = null;
    if (!isNaN(id)) {
      order = await OrderModel.findById(Number(id));
    }
    if (!order) {
      order = await OrderModel.findByOrderNumber(id);
    }

    if (!order) {
      return sendError(res, { statusCode: 404, message: 'Order not found' });
    }

    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin && order.user_id !== req.user.id) {
      return sendError(res, { statusCode: 403, message: 'Access denied to this order' });
    }

    const allowedCustomerStatuses = ['pending', 'confirmed'];
    const allowedAdminStatuses = ['pending', 'confirmed', 'processing'];
    const allowedForCaller = isAdmin ? allowedAdminStatuses : allowedCustomerStatuses;

    if (!allowedForCaller.includes(order.status)) {
      return sendError(res, {
        statusCode: 400,
        message: `Order in "${order.status}" status cannot be cancelled`,
      });
    }

    const prevStatus = order.status;
    const updated = await OrderModel.transitionStatus(order.id, {
      status: 'cancelled',
      actorId: req.user ? req.user.id : null,
      note: reason,
      cancellation_reason: reason,
    });

    await mailService
      .sendOrderStatusEmail(updated, prevStatus, 'cancelled', 'cancelled')
      .catch((err) => console.error('[MailService] Order cancellation email failed:', err.message));

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Order cancelled and stock restored successfully',
      data: updated,
    });
  },

  async getAllAdmin(req, res) {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      search,
      startDate,
      endDate,
      from_date,
      to_date,
    } = req.query;

    const effectiveStartDate = startDate || from_date || null;
    const effectiveEndDate = endDate || to_date || null;

    const total = await OrderModel.countAll({
      status,
      paymentStatus,
      search,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
    });
    const pagination = paginate({ page, limit, total });

    const orders = await OrderModel.findAll({
      offset: pagination.offset,
      limit: pagination.limit,
      status,
      paymentStatus,
      search,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
    });

    return sendSuccess(res, {
      message: 'All orders retrieved',
      data: orders,
      meta: pagination,
    });
  },

  async updateStatus(req, res) {
    const { id } = req.params;
    const { status: rawStatusInput, note, courier_name, tracking_number, cancellation_reason } = req.body;
    const rawStatus = typeof rawStatusInput === 'string' ? rawStatusInput.trim().toLowerCase() : '';

    const allowedStatuses = ['pending', 'confirmed', 'processing', 'dispatch', 'dispatched', 'shipped', 'delivered', 'cancelled'];
    if (!allowedStatuses.includes(rawStatus)) {
      return sendError(res, { statusCode: 400, message: 'Invalid order status' });
    }

    const order = await OrderModel.findById(id);
    if (!order) {
      return sendError(res, { statusCode: 404, message: 'Order not found' });
    }

    let targetStatus = rawStatus;
    if (rawStatus === 'dispatch' || rawStatus === 'dispatched') {
      targetStatus = order.status === 'pending' ? 'processing' : 'shipped';
    }

    if (!OrderModel.canTransition(order.status, targetStatus)) {
      return sendError(res, {
        statusCode: 400,
        message: `Invalid status transition from "${order.status}" to "${targetStatus}"`,
      });
    }

    const prevStatus = order.status;
    const updated = await OrderModel.transitionStatus(order.id, {
      status: targetStatus,
      actorId: req.user ? req.user.id : null,
      note: note || (rawStatus !== targetStatus ? `Order status updated to ${rawStatus}` : null),
      courier_name,
      tracking_number,
      cancellation_reason,
    });

    await mailService
      .sendOrderStatusEmail(updated, prevStatus, targetStatus, rawStatus)
      .catch((err) => console.error('[MailService] Order status email failed:', err.message));

    if (targetStatus === 'delivered' && order.payment_status === 'unpaid') {
      await mailService
        .sendPaymentStatusEmail(updated, 'paid')
        .catch((err) => console.error('[MailService] Auto-paid delivery email failed:', err.message));
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: `Order status updated to ${rawStatus}`,
      data: updated,
    });
  },

  async updatePaymentStatus(req, res) {
    const { id } = req.params;
    const { payment_status: rawPaymentStatusInput, note } = req.body;
    const rawPaymentStatus = typeof rawPaymentStatusInput === 'string' ? rawPaymentStatusInput.trim().toLowerCase() : '';

    const paidAliases = ['paid', 'done', 'payment successful', 'payment_successful', 'completed', 'succeeded'];
    const allowed = ['unpaid', ...paidAliases, 'failed', 'refunded'];
    if (!allowed.includes(rawPaymentStatus)) {
      return sendError(res, { statusCode: 400, message: 'Invalid payment status' });
    }

    const normalizedPaymentStatus = paidAliases.includes(rawPaymentStatus) ? 'paid' : rawPaymentStatus;

    const order = await OrderModel.findById(id);
    if (!order) {
      return sendError(res, { statusCode: 404, message: 'Order not found' });
    }

    const updated = await OrderModel.updatePaymentStatus(id, normalizedPaymentStatus, {
      actorId: req.user ? req.user.id : null,
      note: note || (rawPaymentStatus !== normalizedPaymentStatus ? `Payment status set to ${rawPaymentStatus}` : undefined),
    });

    await mailService
      .sendPaymentStatusEmail(updated, rawPaymentStatus)
      .catch((err) => console.error('[MailService] Payment status email failed:', err.message));

    return sendSuccess(res, {
      statusCode: 200,
      message: `Payment status updated to ${normalizedPaymentStatus}`,
      data: updated,
    });
  },

  async verifyPayment(req, res) {
    const { id } = req.params;
    const note = req.body.note || 'Manual payment verified by admin';

    const order = await OrderModel.findById(id);
    if (!order) {
      return sendError(res, { statusCode: 404, message: 'Order not found' });
    }

    const updated = await OrderModel.updatePaymentStatus(id, 'paid', {
      actorId: req.user ? req.user.id : null,
      note,
    });

    await mailService
      .sendPaymentStatusEmail(updated, 'paid')
      .catch((err) => console.error('[MailService] Payment verification email failed:', err.message));

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Manual payment verified and marked as paid',
      data: updated,
    });
  },

  async getDeliveryCharges(_req, res) {
    let settings = SettingModel.DEFAULT_SETTINGS;
    try {
      settings = await SettingModel.getAll();
    } catch (_e) {
      // fallback to defaults
    }

    const insideFee = Number(settings.delivery_charge_inside_dhaka ?? 70.0);
    const outsideFee = Number(settings.delivery_charge_outside_dhaka ?? 130.0);
    const freeThreshold = Number(settings.free_shipping_threshold ?? 2500.0);

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Active delivery charges retrieved successfully',
      data: {
        currency: settings.currency || 'BDT',
        currency_symbol: settings.currency_symbol || '৳',
        inside_dhaka_fee: isNaN(insideFee) ? 70.0 : insideFee,
        outside_dhaka_fee: isNaN(outsideFee) ? 130.0 : outsideFee,
        free_shipping_threshold: isNaN(freeThreshold) ? 2500.0 : freeThreshold,
        estimated_days_inside_dhaka: settings.estimated_days_inside_dhaka || '1-2 days',
        estimated_days_outside_dhaka: settings.estimated_days_outside_dhaka || '3-5 days',
        promo_popup: {
          enabled: String(settings.promo_popup_enabled ?? 'true').toLowerCase() !== 'false',
          badge: settings.promo_popup_badge || 'LIMITED SEASONAL PRIVILEGE',
          title: settings.promo_popup_title || 'FESTIVE ARCHIVE DROP — UP TO 20% OFF',
          subtitle:
            settings.promo_popup_subtitle ||
            'Discover artisanal Heritage Panjabi, Heavyweight Fleece & Tailored Linen. Use code WELCOME10 at checkout for 10% off your order.',
          cta_text: settings.promo_popup_cta_text || 'Explore Featured Collection',
          target_link: settings.promo_popup_target_link || '/catalog?categorySlug=mens-panjabi',
          discount_code: settings.promo_popup_discount_code || 'WELCOME10',
        },
      },
    });
  },
};

OrderController.calculateShippingFee = calculateShippingFee;

module.exports = OrderController;
