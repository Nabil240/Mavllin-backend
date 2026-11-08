const { pool } = require('../config/db');

const WishlistModel = {
  async getItems(userId) {
    const sql = `
      SELECT
        w.product_id,
        w.created_at AS added_at,
        p.name AS product_name,
        p.slug AS product_slug,
        p.sku AS product_sku,
        p.price,
        p.discount_price,
        COALESCE(p.discount_price, p.base_price, p.price) AS effective_price,
        (SELECT COALESCE(SUM(pv.stock_quantity), 0) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) AS stock_quantity,
        p.thumbnail_url,
        p.is_active,
        c.name AS category_name
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `;
    const [rows] = await pool.query(sql, [userId]);
    return rows;
  },

  async isWishlisted(userId, productId) {
    const [rows] = await pool.query(
      'SELECT 1 FROM wishlists WHERE user_id = ? AND product_id = ? LIMIT 1',
      [userId, productId]
    );
    return rows.length > 0;
  },

  async addItem(userId, productId) {
    await pool.query(
      'INSERT IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)',
      [userId, productId]
    );
    return true;
  },

  async removeItem(userId, productId) {
    const [result] = await pool.query(
      'DELETE FROM wishlists WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );
    return result.affectedRows > 0;
  },

  async toggleItem(userId, productId) {
    const exists = await this.isWishlisted(userId, productId);
    if (exists) {
      await this.removeItem(userId, productId);
      return { wishlisted: false };
    } else {
      await this.addItem(userId, productId);
      return { wishlisted: true };
    }
  },
};

module.exports = WishlistModel;
