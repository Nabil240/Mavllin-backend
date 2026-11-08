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
    } = data;

    const [result] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [code.toUpperCase().trim(), discount_type, discount_value, min_order_amount, usage_limit, expires_at, is_active]
    );

    return this.findById(result.insertId);
  },

  async update(id, fields) {
    const allowed = ['code', 'discount_type', 'discount_value', 'min_order_amount', 'usage_limit', 'expires_at', 'is_active'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        if (key === 'code') {
          updates.push(`${key} = ?`);
          values.push(fields[key].toUpperCase().trim());
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
