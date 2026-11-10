const { pool } = require('../config/db');

const CouponModel = {
  async findByCode(code) {
    const [rows] = await pool.query(
      'SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) LIMIT 1',
      [code.trim()]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async findAll({ offset = 0, limit = 20, search = null, isActive = null } = {}) {
    const conditions = [];
    const values = [];

    if (isActive !== null) {
      conditions.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }

    if (search) {
      conditions.push('code LIKE ?');
      values.push(`%${search}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit, offset);

    const [rows] = await pool.query(
      `SELECT * FROM coupons ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      values
    );
    return rows;
  },

  async countAll({ search = null, isActive = null } = {}) {
    const conditions = [];
    const values = [];

    if (isActive !== null) {
      conditions.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }

    if (search) {
      conditions.push('code LIKE ?');
      values.push(`%${search}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM coupons ${whereClause}`, values);
    return rows[0].total;
  },

  async create(data) {
    const {
      code,
      discount_type = 'percentage',
      discount_value,
      min_order_amount = 0.0,
      usage_limit = null,
      expires_at = null,
      is_active = 1,
      is_universal = 0,
    } = data;

    const [result] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, expires_at, is_active, is_universal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code.toUpperCase().trim(), discount_type, discount_value, min_order_amount, usage_limit, expires_at, is_active, is_universal ? 1 : 0]
    );

    return this.findById(result.insertId);
  },

  async update(id, fields) {
    const allowed = ['code', 'discount_type', 'discount_value', 'min_order_amount', 'usage_limit', 'expires_at', 'is_active', 'is_universal'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        if (key === 'code') {
          updates.push(`${key} = ?`);
          values.push(fields[key].toUpperCase().trim());
        } else if (key === 'is_universal') {
          updates.push(`${key} = ?`);
          values.push(fields[key] ? 1 : 0);
        } else {
          updates.push(`${key} = ?`);
          values.push(fields[key]);
        }
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE coupons SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM coupons WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async incrementUsage(id, connection = null) {
    const db = connection || pool;
    await db.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [id]);
  },

  async getMembers(couponId) {
    const [rows] = await pool.query(
      `SELECT 
         cm.id,
         cm.coupon_id,
         cm.user_id,
         cm.usage_limit,
         cm.used_count,
         GREATEST(0, CAST(cm.usage_limit AS SIGNED) - CAST(cm.used_count AS SIGNED)) AS remaining_uses,
         u.full_name AS customer_name,
         u.email AS customer_email,
         u.phone AS customer_phone,
         cm.created_at,
         cm.updated_at
       FROM coupon_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.coupon_id = ?
       ORDER BY cm.created_at DESC`,
      [couponId]
    );
    return rows.map(r => ({
      ...r,
      usage_limit: Number(r.usage_limit),
      used_count: Number(r.used_count),
      remaining_uses: Number(r.remaining_uses),
    }));
  },

  async getMemberCount(couponId, connection = null) {
    const db = connection || pool;
    const [rows] = await db.query(
      'SELECT COUNT(*) AS total FROM coupon_members WHERE coupon_id = ?',
      [couponId]
    );
    return Number(rows[0]?.total || 0);
  },

  async getMemberUsage(couponId, userId, connection = null, forUpdate = false) {
    const db = connection || pool;
    const lockClause = forUpdate ? ' FOR UPDATE' : '';
    const [rows] = await db.query(
      `SELECT 
         cm.id,
         cm.coupon_id,
         cm.user_id,
         cm.usage_limit,
         cm.used_count,
         GREATEST(0, CAST(cm.usage_limit AS SIGNED) - CAST(cm.used_count AS SIGNED)) AS remaining_uses,
         u.full_name AS customer_name,
         u.email AS customer_email,
         u.phone AS customer_phone,
         cm.created_at,
         cm.updated_at
       FROM coupon_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.coupon_id = ? AND cm.user_id = ? LIMIT 1${lockClause}`,
      [couponId, userId]
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      usage_limit: Number(rows[0].usage_limit),
      used_count: Number(rows[0].used_count),
      remaining_uses: Number(rows[0].remaining_uses),
    };
  },

  async getMemberAssignment(couponId, userId, connection = null, forUpdate = false) {
    return this.getMemberUsage(couponId, userId, connection, forUpdate);
  },

  async addMember(couponId, { userId, user_id, usageLimit, usage_limit } = {}) {
    const effectiveUserId = userId || user_id;
    const effectiveLimit = Math.max(1, parseInt(usageLimit || usage_limit || 1, 10) || 1);

    if (!effectiveUserId) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    // Verify user exists
    const [userRows] = await pool.query('SELECT id, full_name, email FROM users WHERE id = ?', [effectiveUserId]);
    if (!userRows[0]) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    // Check if member is already assigned to this coupon
    const [existing] = await pool.query(
      'SELECT id FROM coupon_members WHERE coupon_id = ? AND user_id = ?',
      [couponId, effectiveUserId]
    );
    if (existing[0]) {
      const err = new Error('Member is already whitelisted for this coupon');
      err.statusCode = 409;
      throw err;
    }

    await pool.query(
      `INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count)
       VALUES (?, ?, ?, 0)`,
      [couponId, effectiveUserId, effectiveLimit]
    );

    return this.getMemberUsage(couponId, effectiveUserId);
  },

  async addMemberByEmail(couponId, { email, usageLimit, usage_limit } = {}) {
    if (!email || typeof email !== 'string' || !email.trim()) {
      const err = new Error('Email is required');
      err.statusCode = 400;
      throw err;
    }

    const [userRows] = await pool.query('SELECT id, full_name, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email.trim()]);
    if (!userRows[0]) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    return this.addMember(couponId, { userId: userRows[0].id, usageLimit: usageLimit || usage_limit });
  },

  async updateMemberLimit(couponId, userId, usageLimit) {
    const effectiveLimit = Math.max(1, parseInt(usageLimit, 10) || 1);
    const [existing] = await pool.query(
      'SELECT id FROM coupon_members WHERE coupon_id = ? AND user_id = ?',
      [couponId, userId]
    );
    if (!existing[0]) {
      const err = new Error('Member is not on the coupon whitelist');
      err.statusCode = 404;
      throw err;
    }

    await pool.query(
      'UPDATE coupon_members SET usage_limit = ? WHERE coupon_id = ? AND user_id = ?',
      [effectiveLimit, couponId, userId]
    );

    return this.getMemberUsage(couponId, userId);
  },

  async removeMember(couponId, userId) {
    const [result] = await pool.query(
      'DELETE FROM coupon_members WHERE coupon_id = ? AND user_id = ?',
      [couponId, userId]
    );
    return result.affectedRows > 0;
  },

  async incrementMemberUsage(couponId, userId, connection = null) {
    const db = connection || pool;
    await db.query(
      'UPDATE coupon_members SET used_count = used_count + 1 WHERE coupon_id = ? AND user_id = ?',
      [couponId, userId]
    );
  },

  async getAnalytics() {
    // 1. Overall high-level statistics
    const [overallRows] = await pool.query(`
      SELECT 
        COUNT(o.id) AS total_redemptions,
        COUNT(DISTINCT o.user_id) AS unique_members_count,
        COUNT(DISTINCT c.id) AS unique_coupons_count,
        COALESCE(SUM(o.discount_amount), 0) AS total_discount_granted,
        COALESCE(SUM(o.total_amount), 0) AS total_order_volume
      FROM orders o
      JOIN coupons c ON c.id = o.coupon_id
      WHERE o.coupon_id IS NOT NULL
    `);

    // 2. Performance breakdown per coupon
    const [byCouponRows] = await pool.query(`
      SELECT 
        c.id AS coupon_id,
        c.code,
        c.discount_type,
        c.discount_value,
        c.min_order_amount,
        c.usage_limit,
        c.used_count AS recorded_used_count,
        c.is_active,
        c.is_universal,
        COUNT(o.id) AS actual_usage_count,
        COUNT(DISTINCT o.user_id) AS unique_members_count,
        COALESCE(SUM(o.discount_amount), 0) AS total_discount_amount,
        COALESCE(SUM(o.total_amount), 0) AS total_order_sales
      FROM coupons c
      LEFT JOIN orders o ON o.coupon_id = c.id
      GROUP BY c.id, c.code, c.discount_type, c.discount_value, c.min_order_amount, c.usage_limit, c.used_count, c.is_active, c.is_universal
      ORDER BY actual_usage_count DESC, c.created_at DESC
    `);

    // 3. Member-level summary: which member used how many coupons and total times
    const [byMemberRows] = await pool.query(`
      SELECT 
        u.id AS user_id,
        u.full_name AS customer_name,
        u.email AS customer_email,
        u.phone AS customer_phone,
        COUNT(o.id) AS total_orders_with_coupons,
        COUNT(DISTINCT c.id) AS distinct_coupons_count,
        GROUP_CONCAT(DISTINCT c.code ORDER BY c.code SEPARATOR ', ') AS coupon_codes_used,
        COALESCE(SUM(o.discount_amount), 0) AS total_discount_saved,
        MAX(o.created_at) AS last_used_at
      FROM orders o
      JOIN coupons c ON c.id = o.coupon_id
      JOIN users u ON u.id = o.user_id
      WHERE o.coupon_id IS NOT NULL
      GROUP BY u.id, u.full_name, u.email, u.phone
      ORDER BY total_orders_with_coupons DESC, total_discount_saved DESC
    `);

    return {
      overview: {
        total_redemptions: Number(overallRows[0]?.total_redemptions || 0),
        unique_members_count: Number(overallRows[0]?.unique_members_count || 0),
        unique_coupons_count: Number(overallRows[0]?.unique_coupons_count || 0),
        total_discount_granted: Number(overallRows[0]?.total_discount_granted || 0),
        total_order_volume: Number(overallRows[0]?.total_order_volume || 0),
      },
      coupons: byCouponRows.map(c => ({
        ...c,
        actual_usage_count: Number(c.actual_usage_count),
        unique_members_count: Number(c.unique_members_count),
        total_discount_amount: Number(c.total_discount_amount),
        total_order_sales: Number(c.total_order_sales),
      })),
      members: byMemberRows.map(m => ({
        ...m,
        total_orders_with_coupons: Number(m.total_orders_with_coupons),
        distinct_coupons_count: Number(m.distinct_coupons_count),
        total_discount_saved: Number(m.total_discount_saved),
      })),
    };
  },

  async getMemberUsageLedger({ search = null, couponCode = null, limit = 50, offset = 0 } = {}) {
    const conditions = ['o.coupon_id IS NOT NULL'];
    const values = [];

    if (couponCode) {
      conditions.push('UPPER(c.code) = UPPER(?)');
      values.push(couponCode.trim());
    }

    if (search) {
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR o.order_number LIKE ?)');
      const term = `%${search.trim()}%`;
      values.push(term, term, term);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await pool.query(
      `SELECT COUNT(o.id) AS total
       FROM orders o
       JOIN coupons c ON c.id = o.coupon_id
       LEFT JOIN users u ON u.id = o.user_id
       ${whereClause}`,
      values
    );

    const limitVal = Math.max(1, Number(limit) || 50);
    const offsetVal = Math.max(0, Number(offset) || 0);

    const [rows] = await pool.query(
      `SELECT 
         o.id AS order_id,
         o.order_number,
         o.user_id,
         COALESCE(u.full_name, 'Guest Customer') AS customer_name,
         COALESCE(u.email, o.guest_email) AS customer_email,
         COALESCE(u.phone, o.guest_phone) AS customer_phone,
         c.id AS coupon_id,
         c.code AS coupon_code,
         c.discount_type,
         c.discount_value,
         o.subtotal,
         o.discount_amount,
         o.shipping_fee,
         o.total_amount,
         o.status AS order_status,
         o.payment_status,
         o.created_at AS redeemed_at
       FROM orders o
       JOIN coupons c ON c.id = o.coupon_id
       LEFT JOIN users u ON u.id = o.user_id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limitVal, offsetVal]
    );

    return {
      total: countRows[0]?.total || 0,
      limit: limitVal,
      offset: offsetVal,
      redemptions: rows.map(r => ({
        ...r,
        subtotal: Number(r.subtotal),
        discount_amount: Number(r.discount_amount),
        shipping_fee: Number(r.shipping_fee),
        total_amount: Number(r.total_amount),
      })),
    };
  },

  calculateDiscount(coupon, subtotal) {
    if (!coupon || !coupon.is_active) {
      return { valid: false, message: 'Coupon is invalid or inactive', discount: 0 };
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { valid: false, message: 'Coupon has expired', discount: 0 };
    }

    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      return { valid: false, message: 'Coupon usage limit reached', discount: 0 };
    }

    if (Number(subtotal) < Number(coupon.min_order_amount)) {
      return {
        valid: false,
        message: `Order subtotal must be at least $${Number(coupon.min_order_amount).toFixed(2)} to use this coupon`,
        discount: 0,
      };
    }

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (Number(subtotal) * Number(coupon.discount_value)) / 100;
    } else {
      discount = Number(coupon.discount_value);
    }

    // Ensure discount does not exceed subtotal
    discount = Math.min(Number(discount), Number(subtotal));

    return {
      valid: true,
      message: 'Coupon applied successfully',
      discount: parseFloat(discount.toFixed(2)),
      coupon,
    };
  },
};

module.exports = CouponModel;
