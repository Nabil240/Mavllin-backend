const { pool } = require('../config/db');

const VALID_STATUS_TRANSITIONS = {
  pending: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

function extractPaymentMeta(transactionIdStr) {
  if (!transactionIdStr) {
    return { transaction_id: null, sender_phone: null };
  }
  const str = String(transactionIdStr).trim();
  if (!str) {
    return { transaction_id: null, sender_phone: null };
  }
  const match = str.match(/^(.*?)\s*\(From:\s*(.+)\)$/i);
  if (match) {
    const rawTrx = match[1].trim();
    const rawPhone = match[2].trim();
    return {
      transaction_id: rawTrx || null,
      sender_phone: rawPhone || null,
    };
  }
  return {
    transaction_id: str || null,
    sender_phone: null,
  };
}

function parseOrderRow(order) {
  if (!order) return null;
  if (typeof order.shipping_address === 'string') {
    try {
      order.shipping_address = JSON.parse(order.shipping_address);
    } catch (_e) {
      // keep as is
    }
  }
  if (order.payment_transaction_id !== undefined) {
    const meta = extractPaymentMeta(order.payment_transaction_id);
    order.transaction_id = meta.transaction_id;
    order.sender_phone = meta.sender_phone;
  }
  return order;
}

const OrderModel = {
  VALID_STATUS_TRANSITIONS,

  canTransition(fromStatus, toStatus) {
    if (fromStatus === toStatus) return false;
    const allowed = VALID_STATUS_TRANSITIONS[fromStatus] || [];
    return allowed.includes(toStatus);
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT
         o.*,
         COALESCE(u.full_name, JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.recipient_name')), 'Guest') AS customer_name,
         COALESCE(u.email, o.guest_email) AS customer_email,
         COALESCE(u.phone, o.guest_phone, JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.phone'))) AS customer_phone
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows[0]) return null;
    const order = parseOrderRow(rows[0]);

    order.items = await this.getOrderItems(order.id);
    order.payment = await this.getOrderPayment(order.id);
    order.payment_provider = (order.payment && order.payment.provider) || order.payment_method;
    order.payment_transaction_id = (order.payment && order.payment.transaction_id) || null;
    order.payment_record_status = (order.payment && order.payment.status) || null;
    const paymentMeta = extractPaymentMeta(order.payment_transaction_id);
    order.transaction_id = paymentMeta.transaction_id;
    order.sender_phone = paymentMeta.sender_phone;
    order.status_history = await this.getStatusHistory(order.id);
    return order;
  },

  async findByOrderNumber(orderNumber) {
    const [rows] = await pool.query('SELECT id FROM orders WHERE order_number = ? LIMIT 1', [orderNumber]);
    if (!rows[0]) return null;
    return this.findById(rows[0].id);
  },

  async getOrderItems(orderId) {
    const sql = `
      SELECT
        oi.*,
        p.slug AS product_slug,
        p.thumbnail_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC
    `;
    const [rows] = await pool.query(sql, [orderId]);
    return rows;
  },

  async getOrderPayment(orderId) {
    const [rows] = await pool.query('SELECT * FROM payments WHERE order_id = ? LIMIT 1', [orderId]);
    return rows[0] || null;
  },

  async getStatusHistory(orderId) {
    const [rows] = await pool.query(
      `SELECT
         osh.*,
         u.full_name AS actor_name
       FROM order_status_history osh
       LEFT JOIN users u ON osh.actor_id = u.id
       WHERE osh.order_id = ?
       ORDER BY osh.created_at ASC, osh.id ASC`,
      [orderId]
    );
    return rows;
  },

  async findByUserId(userId, { offset = 0, limit = 10, status = null } = {}) {
    const conditions = ['o.user_id = ?'];
    const values = [userId];

    if (status) {
      conditions.push('o.status = ?');
      values.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    values.push(Number(limit), Number(offset));

    const [rows] = await pool.query(
      `SELECT
         o.*,
         (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS total_items,
         COALESCE(p.provider, o.payment_method) AS payment_provider,
         p.transaction_id AS payment_transaction_id,
         p.status AS payment_record_status
       FROM orders o
       LEFT JOIN payments p ON o.id = p.order_id
       ${whereClause}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT ? OFFSET ?`,
      values
    );

    const orders = rows.map(parseOrderRow);
    for (const ord of orders) {
      ord.items = await this.getOrderItems(ord.id);
    }
    return orders;
  },

  async countByUserId(userId, { status = null } = {}) {
    const conditions = ['user_id = ?'];
    const values = [userId];

    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM orders ${whereClause}`, values);
    return rows[0].total;
  },

  async findAll({
    offset = 0,
    limit = 20,
    status = null,
    paymentStatus = null,
    search = null,
    startDate = null,
    endDate = null,
  } = {}) {
    const conditions = [];
    const values = [];

    if (status) {
      conditions.push('o.status = ?');
      values.push(status);
    }

    if (paymentStatus) {
      conditions.push('o.payment_status = ?');
      values.push(paymentStatus);
    }

    if (search) {
      conditions.push(
        '(o.order_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR o.guest_email LIKE ? OR o.guest_phone LIKE ? OR p.transaction_id LIKE ?)'
      );
      const term = `%${search}%`;
      values.push(term, term, term, term, term, term);
    }

    if (startDate) {
      conditions.push('o.created_at >= ?');
      values.push(startDate);
    }

    if (endDate) {
      conditions.push('o.created_at <= ?');
      values.push(endDate);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit), Number(offset));

    const sql = `
      SELECT
        o.*,
        COALESCE(u.full_name, JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.recipient_name')), 'Guest') AS customer_name,
        COALESCE(u.email, o.guest_email) AS customer_email,
        COALESCE(u.phone, o.guest_phone, JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.phone'))) AS customer_phone,
        COALESCE(p.provider, o.payment_method) AS payment_provider,
        p.transaction_id AS payment_transaction_id,
        p.status AS payment_record_status,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS total_items
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN payments p ON o.id = p.order_id
      ${whereClause}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(sql, values);
    return rows.map(parseOrderRow);
  },

  async countAll({
    status = null,
    paymentStatus = null,
    search = null,
    startDate = null,
    endDate = null,
  } = {}) {
    const conditions = [];
    const values = [];

    if (status) {
      conditions.push('o.status = ?');
      values.push(status);
    }

    if (paymentStatus) {
      conditions.push('o.payment_status = ?');
      values.push(paymentStatus);
    }

    if (search) {
      conditions.push(
        '(o.order_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR o.guest_email LIKE ? OR o.guest_phone LIKE ? OR p.transaction_id LIKE ?)'
      );
      const term = `%${search}%`;
      values.push(term, term, term, term, term, term);
    }

    if (startDate) {
      conditions.push('o.created_at >= ?');
      values.push(startDate);
    }

    if (endDate) {
      conditions.push('o.created_at <= ?');
      values.push(endDate);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT COUNT(*) AS total
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN payments p ON o.id = p.order_id
      ${whereClause}
    `;

    const [rows] = await pool.query(sql, values);
    return rows[0].total;
  },

  async createWithTransaction({ orderData, items, paymentData, couponId = null }) {
    // Validate mobile or manual payment requirements
    const mobileOrManualProviders = ['manual', 'manual_payment', 'bkash', 'nagad', 'nogod', 'rocket', 'upay', 'upai'];
    const rawMethod = String(orderData.payment_method || (paymentData && paymentData.provider) || '').trim().toLowerCase();
    if (mobileOrManualProviders.includes(rawMethod)) {
      const rawTrx = paymentData && paymentData.transaction_id ? String(paymentData.transaction_id).trim() : '';
      const meta = extractPaymentMeta(rawTrx);
      if (!rawTrx || !meta.transaction_id || !meta.transaction_id.trim() || meta.transaction_id.startsWith('TXN-')) {
        const err = new Error('Transaction ID is required for manual and mobile payments');
        err.statusCode = 400;
        throw err;
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Sort items by variant_id ascending to prevent deadlocks under concurrent checkouts
      const sortedItems = [...items].sort((a, b) => Number(a.variant_id || 0) - Number(b.variant_id || 0));

      const lockedVariants = {};
      for (const item of sortedItems) {
        let variantId = item.variant_id;
        if (!variantId && item.product_id) {
          const [firstVar] = await connection.query(
            'SELECT id FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY stock_quantity DESC, id ASC LIMIT 1',
            [item.product_id]
          );
          if (firstVar[0]) {
            variantId = firstVar[0].id;
            item.variant_id = variantId;
          }
        }

        const [varRows] = await connection.query(
          `SELECT
             pv.*,
             p.name AS product_name,
             p.is_active AS product_is_active
           FROM product_variants pv
           JOIN products p ON pv.product_id = p.id
           WHERE pv.id = ?
           FOR UPDATE`,
          [variantId]
        );

        if (!varRows[0]) {
          const err = new Error(`Product variant ${variantId} not found`);
          err.statusCode = 404;
          throw err;
        }

        const pv = varRows[0];
        if (!pv.product_is_active || !pv.is_active) {
          const err = new Error(`Product "${pv.product_name}" is currently inactive`);
          err.statusCode = 400;
          throw err;
        }

        if (Number(pv.stock_quantity) < Number(item.quantity)) {
          const err = new Error(
            `Insufficient stock for "${pv.product_name}" (${pv.sku}). Available: ${pv.stock_quantity}`
          );
          err.statusCode = 400;
          throw err;
        }

        const beforeQty = Number(pv.stock_quantity);
        const afterQty = beforeQty - Number(item.quantity);

        const [upd] = await connection.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?',
          [item.quantity, pv.id, item.quantity]
        );

        if (!upd || upd.affectedRows === 0) {
          const err = new Error(`Insufficient stock for "${pv.product_name}" (${pv.sku})`);
          err.statusCode = 400;
          throw err;
        }

        lockedVariants[pv.id] = {
          pv,
          beforeQty,
          afterQty,
        };

        // Enrich snapshot fields from locked variant if not set
        item.product_id = pv.product_id;
        item.product_name = item.product_name || pv.product_name;
        item.variant_sku = item.variant_sku || pv.sku;
        item.variant_size = item.variant_size !== undefined ? item.variant_size : pv.size;
        item.size = item.size !== undefined ? item.size : (item.variant_size !== undefined ? item.variant_size : pv.size);
        item.variant_color = item.variant_color !== undefined ? item.variant_color : pv.color;
        item.color = item.color !== undefined ? item.color : (item.variant_color !== undefined ? item.variant_color : pv.color);
        item.subtotal = item.subtotal !== undefined ? item.subtotal : item.line_total;
      }

      // 2. Insert order
      const [orderResult] = await connection.query(
        `INSERT INTO orders (
          order_number, user_id, guest_email, guest_phone, coupon_id,
          subtotal, discount_amount, shipping_fee, total_amount,
          advance_amount, due_amount, advance_payment_status,
          status, payment_method, payment_status, shipping_address, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderData.order_number,
          orderData.user_id || null,
          orderData.guest_email || null,
          orderData.guest_phone || null,
          couponId,
          orderData.subtotal,
          orderData.discount_amount || 0.0,
          orderData.shipping_fee || 0.0,
          orderData.total_amount,
          orderData.advance_amount !== undefined ? Number(orderData.advance_amount) : 0.0,
          orderData.due_amount !== undefined ? Number(orderData.due_amount) : Number(orderData.total_amount),
          orderData.advance_payment_status || (Number(orderData.advance_amount) > 0 ? 'unpaid' : 'paid'),
          orderData.status || 'pending',
          orderData.payment_method || 'cash_on_delivery',
          orderData.payment_status || 'unpaid',
          JSON.stringify(orderData.shipping_address),
          orderData.notes || null,
        ]
      );

      const orderId = orderResult.insertId;

      // 3. Insert line items & inventory movements
      for (const item of sortedItems) {
        await connection.query(
          `INSERT INTO order_items (
            order_id, product_id, variant_id, product_name,
            variant_sku, variant_size, size, variant_color, color,
            unit_price, quantity, line_total, advance_amount, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.product_id,
            item.variant_id,
            item.product_name,
            item.variant_sku || null,
            item.variant_size || null,
            item.size || item.variant_size || null,
            item.variant_color || null,
            item.color || item.variant_color || null,
            item.unit_price,
            item.quantity,
            item.line_total,
            item.advance_amount !== undefined ? Number(item.advance_amount) : 0.00,
            item.subtotal || item.line_total,
          ]
        );

        const snap = lockedVariants[item.variant_id];
        await connection.query(
          `INSERT INTO inventory_movements (
            variant_id, quantity_delta, before_quantity, after_quantity,
            reason, note, actor_id, reference_order_id
          ) VALUES (?, ?, ?, ?, 'order_placed', ?, ?, ?)`,
          [
            item.variant_id,
            -Number(item.quantity),
            snap.beforeQty,
            snap.afterQty,
            `Order ${orderData.order_number} placed`,
            orderData.user_id || null,
            orderId,
          ]
        );
      }

      // 4. Insert initial order status history
      await connection.query(
        `INSERT INTO order_status_history (order_id, previous_status, new_status, actor_id, note)
         VALUES (?, NULL, ?, ?, ?)`,
        [orderId, orderData.status || 'pending', orderData.user_id || null, 'Order placed']
      );

      // 5. Insert payment record
      const safePaymentTrxId = paymentData && paymentData.transaction_id
        ? String(paymentData.transaction_id).trim().slice(0, 160)
        : null;

      await connection.query(
        `INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          paymentData.provider || 'cod',
          safePaymentTrxId,
          orderData.total_amount,
          paymentData.status || 'pending',
          ['succeeded', 'completed'].includes(paymentData.status) ? new Date() : null,
        ]
      );

      // 6. Increment coupon usage if applied
      if (couponId) {
        await connection.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [couponId]);
      }

      // 7. Clear user cart if authenticated order, or guest cart if session_id provided
      if (orderData.user_id) {
        await connection.query('DELETE FROM cart_items WHERE user_id = ?', [orderData.user_id]);
      }
      if (orderData.session_id) {
        await connection.query('DELETE FROM cart_items WHERE session_id = ?', [orderData.session_id]);
      }

      await connection.commit();
      return orderId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async transitionStatus(id, { status, actorId = null, note = null, courier_name, tracking_number, cancellation_reason }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [orderRows] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
      if (!orderRows[0]) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
      }

      const order = orderRows[0];
      const prevStatus = order.status;

      if (!this.canTransition(prevStatus, status)) {
        const err = new Error(`Invalid status transition from "${prevStatus}" to "${status}"`);
        err.statusCode = 400;
        throw err;
      }

      // If transitioning to cancelled, restore stock for all order items
      if (status === 'cancelled' && prevStatus !== 'cancelled') {
        const [items] = await connection.query(
          'SELECT * FROM order_items WHERE order_id = ? ORDER BY variant_id ASC',
          [id]
        );

        for (const item of items) {
          if (!item.variant_id) continue;
          const [vRows] = await connection.query(
            'SELECT id, stock_quantity FROM product_variants WHERE id = ? FOR UPDATE',
            [item.variant_id]
          );
          if (vRows[0]) {
            const beforeQty = Number(vRows[0].stock_quantity);
            const delta = Number(item.quantity);
            const afterQty = beforeQty + delta;

            await connection.query(
              'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
              [delta, item.variant_id]
            );

            await connection.query(
              `INSERT INTO inventory_movements (
                variant_id, quantity_delta, before_quantity, after_quantity,
                reason, note, actor_id, reference_order_id
              ) VALUES (?, ?, ?, ?, 'order_cancelled', ?, ?, ?)`,
              [
                item.variant_id,
                delta,
                beforeQty,
                afterQty,
                cancellation_reason || note || `Order ${order.order_number} cancelled`,
                actorId,
                id,
              ]
            );
          }
        }
      }

      const updates = ['status = ?'];
      const values = [status];

      if (courier_name !== undefined) {
        updates.push('courier_name = ?');
        values.push(courier_name);
      }
      if (tracking_number !== undefined) {
        updates.push('tracking_number = ?');
        values.push(tracking_number);
      }
      if (cancellation_reason !== undefined) {
        updates.push('cancellation_reason = ?');
        values.push(cancellation_reason);
      }

      if (status === 'delivered' && order.payment_status === 'unpaid') {
        updates.push("payment_status = 'paid'");
        await connection.query(
          "UPDATE payments SET status = 'succeeded', paid_at = COALESCE(paid_at, NOW()) WHERE order_id = ?",
          [id]
        );
      }

      values.push(id);
      await connection.query(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, values);

      await connection.query(
        `INSERT INTO order_status_history (order_id, previous_status, new_status, actor_id, note)
         VALUES (?, ?, ?, ?, ?)`,
        [id, prevStatus, status, actorId, note || cancellation_reason || `Status updated to ${status}`]
      );

      await connection.commit();
      return this.findById(id);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async updateStatus(id, status, extra = {}) {
    return this.transitionStatus(id, { status, ...extra });
  },

  async updatePaymentStatus(id, paymentStatus, options = {}) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [orderRows] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
      if (!orderRows[0]) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
      }
      const prevOrder = orderRows[0];

      await connection.query('UPDATE orders SET payment_status = ? WHERE id = ?', [paymentStatus, id]);

      if (paymentStatus === 'paid') {
        await connection.query(
          "UPDATE payments SET status = 'completed', paid_at = NOW() WHERE order_id = ?",
          [id]
        );
      } else if (paymentStatus === 'unpaid') {
        await connection.query(
          "UPDATE payments SET status = 'pending', paid_at = NULL WHERE order_id = ?",
          [id]
        );
      } else {
        await connection.query(
          'UPDATE payments SET status = ? WHERE order_id = ?',
          [paymentStatus, id]
        );
      }

      await connection.query(
        `INSERT INTO order_status_history (order_id, previous_status, new_status, actor_id, note)
         VALUES (?, ?, ?, ?, ?)`,
        [
          id,
          prevOrder.status,
          prevOrder.status,
          options.actorId || null,
          options.note || `Payment status updated from ${prevOrder.payment_status} to ${paymentStatus}`,
        ]
      );

      await connection.commit();
      return this.findById(id);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async delete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
      if (!rows[0]) {
        await connection.rollback();
        return false;
      }
      const order = rows[0];
      if (order.status !== 'cancelled' && order.status !== 'delivered') {
        const [items] = await connection.query(
          'SELECT * FROM order_items WHERE order_id = ? ORDER BY variant_id ASC',
          [id]
        );
        for (const item of items) {
          if (item.variant_id) {
            await connection.query(
              'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
              [Number(item.quantity) || 0, item.variant_id]
            );
          }
        }
      }
      const [res] = await connection.query('DELETE FROM orders WHERE id = ?', [id]);
      await connection.commit();
      return res.affectedRows > 0;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },
};

module.exports = OrderModel;
