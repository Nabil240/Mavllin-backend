const { pool } = require('../config/db');

const CartModel = {
  async getItemsByUserId(userId) {
    const sql = `
      SELECT
        c.id AS cart_item_id,
        c.id,
        c.user_id,
        c.product_id,
        c.variant_id,
        c.quantity,
        c.updated_at,
        p.name AS product_name,
        p.slug AS product_slug,
        p.sku AS product_sku,
        p.thumbnail_url,
        COALESCE(pv.sku, p.sku) AS variant_sku,
        pv.size AS size,
        pv.color AS color,
        COALESCE(pv.price, p.base_price) AS unit_price,
        COALESCE(pv.price, p.base_price) AS price,
        pv.compare_at_price AS compare_at_price,
        p.discount_price,
        p.discount_type,
        p.discount_value,
        p.advance_payment_type,
        CASE
          WHEN p.discount_type = 'percentage' AND p.discount_value > 0 THEN
            ROUND(COALESCE(pv.price, p.base_price) * (1.0 - (p.discount_value / 100.0)), 2)
          WHEN p.discount_type = 'fixed' AND p.discount_value > 0 THEN
            GREATEST(0.00, ROUND(COALESCE(pv.price, p.base_price) - p.discount_value, 2))
          WHEN p.discount_price IS NOT NULL AND p.discount_price > 0 AND p.discount_price < COALESCE(pv.price, p.base_price) THEN
            p.discount_price
          ELSE
            COALESCE(pv.price, p.base_price)
        END AS effective_price,
        COALESCE(pv.stock_quantity, 0) AS stock_quantity,
        (p.is_active = 1 AND COALESCE(pv.is_active, 1) = 1) AS is_active,
        ROUND(c.quantity * (
          CASE
            WHEN p.discount_type = 'percentage' AND p.discount_value > 0 THEN
              ROUND(COALESCE(pv.price, p.base_price) * (1.0 - (p.discount_value / 100.0)), 2)
            WHEN p.discount_type = 'fixed' AND p.discount_value > 0 THEN
              GREATEST(0.00, ROUND(COALESCE(pv.price, p.base_price) - p.discount_value, 2))
            WHEN p.discount_price IS NOT NULL AND p.discount_price > 0 AND p.discount_price < COALESCE(pv.price, p.base_price) THEN
              p.discount_price
            ELSE
              COALESCE(pv.price, p.base_price)
          END
        ), 2) AS line_total
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN product_variants pv ON c.variant_id = pv.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC, c.id DESC
    `;
    const [rows] = await pool.query(sql, [userId]);
    return rows.map((row) => ({
      ...row,
      unit_price: Number(row.unit_price),
      price: Number(row.price),
      effective_price: Number(row.effective_price),
      compare_at_price: row.compare_at_price !== null ? Number(row.compare_at_price) : null,
      stock_quantity: Number(row.stock_quantity),
      quantity: Number(row.quantity),
      is_active: Boolean(row.is_active),
      line_total: parseFloat(Number(row.line_total).toFixed(2)),
      discount_type: row.discount_type || 'none',
      discount_value: Number(row.discount_value || 0),
      advance_payment_type: row.advance_payment_type || 'none',
    }));
  },

  async findItem(userId, productId, variantId = null) {
    if (variantId) {
      const [rows] = await pool.query(
        'SELECT * FROM cart_items WHERE user_id = ? AND variant_id = ? LIMIT 1',
        [userId, variantId]
      );
      return rows[0] || null;
    }
    const [rows] = await pool.query(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ? LIMIT 1',
      [userId, productId]
    );
    return rows[0] || null;
  },

  async findItemByIdentifier(userId, identifier) {
    const [rows] = await pool.query(
      `SELECT
         c.*,
         COALESCE(pv.stock_quantity, 0) AS variant_stock,
         COALESCE(pv.is_active, 1) AS variant_active,
         p.is_active AS product_active
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       LEFT JOIN product_variants pv ON c.variant_id = pv.id
       WHERE c.user_id = ? AND (c.id = ? OR c.variant_id = ? OR c.product_id = ?)
       ORDER BY (c.id = ?) DESC, (c.variant_id = ?) DESC, c.id DESC
       LIMIT 1`,
      [userId, identifier, identifier, identifier, identifier, identifier]
    );
    return rows[0] || null;
  },

  async getFirstActiveVariant(productId) {
    const [rows] = await pool.query(
      `SELECT * FROM product_variants
       WHERE product_id = ? AND is_active = 1
       ORDER BY stock_quantity DESC, id ASC
       LIMIT 1`,
      [productId]
    );
    return rows[0] || null;
  },

  async addItem(userId, productId, variantId, quantity = 1) {
    const existing = await this.findItem(userId, productId, variantId);
    if (existing) {
      await pool.query(
        'UPDATE cart_items SET quantity = quantity + ?, product_id = ?, variant_id = ? WHERE id = ?',
        [quantity, productId, variantId, existing.id]
      );
      return this.findItem(userId, productId, variantId);
    }

    const sql = `
      INSERT INTO cart_items (user_id, product_id, variant_id, quantity)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
    `;
    await pool.query(sql, [userId, productId, variantId, quantity]);
    return this.findItem(userId, productId, variantId);
  },

  async setItemQuantity(userId, productId, variantId, quantity) {
    const existing = await this.findItem(userId, productId, variantId);
    if (existing) {
      await pool.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, existing.id]);
      return this.findItem(userId, productId, variantId);
    }
    await pool.query(
      `INSERT INTO cart_items (user_id, product_id, variant_id, quantity)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
      [userId, productId, variantId, quantity]
    );
    return this.findItem(userId, productId, variantId);
  },

  async updateQuantityById(cartItemId, userId, quantity) {
    if (quantity <= 0) {
      await pool.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [cartItemId, userId]);
      return null;
    }
    await pool.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
      [quantity, cartItemId, userId]
    );
    return true;
  },

  async removeItemByIdentifier(userId, identifier) {
    const item = await this.findItemByIdentifier(userId, identifier);
    if (!item) return false;
    const [result] = await pool.query(
      'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
      [item.id, userId]
    );
    return result.affectedRows > 0;
  },

  async clearCart(userId, connection = null) {
    const db = connection || pool;
    const [result] = await db.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
    return result.affectedRows > 0;
  },
};

module.exports = CartModel;
