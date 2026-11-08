const { pool } = require('../config/db');

const ReviewModel = {
  async findByProduct(productId, { offset = 0, limit = 10 } = {}) {
    const sql = `
      SELECT r.*, u.full_name AS user_name, u.avatar_url AS user_avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(sql, [productId, limit, offset]);
    return rows;
  },

  async countByProduct(productId) {
    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM reviews WHERE product_id = ?', [productId]);
    return rows[0].total;
  },

  async findUserReview(productId, userId) {
    const [rows] = await pool.query(
      'SELECT * FROM reviews WHERE product_id = ? AND user_id = ? LIMIT 1',
      [productId, userId]
    );
    return rows[0] || null;
  },

  async createOrUpdate({ productId, userId, rating, comment = null }) {
    const sql = `
      INSERT INTO reviews (product_id, user_id, rating, comment)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = CURRENT_TIMESTAMP
    `;
    await pool.query(sql, [productId, userId, rating, comment]);
    return this.findUserReview(productId, userId);
  },

  async delete(id, userId, isAdmin = false) {
    let sql = 'DELETE FROM reviews WHERE id = ?';
    const values = [id];

    if (!isAdmin) {
      sql += ' AND user_id = ?';
      values.push(userId);
    }

    const [result] = await pool.query(sql, values);
    return result.affectedRows > 0;
  },

  async getRatingSummary(productId) {
    const [rows] = await pool.query(
      `SELECT
        COALESCE(AVG(rating), 0) AS average_rating,
        COUNT(*) AS total_reviews,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five_star,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS four_star,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS three_star,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS two_star,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS one_star
       FROM reviews
       WHERE product_id = ?`,
      [productId]
    );
    return rows[0];
  },

  async findAllAdmin({ offset = 0, limit = 50, search = null, rating = null } = {}) {
    const conditions = [];
    const values = [];

    if (rating) {
      conditions.push('r.rating = ?');
      values.push(Number(rating));
    }

    if (search) {
      conditions.push('(p.name LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR r.comment LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term, term, term);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit), Number(offset));

    const [rows] = await pool.query(
      `SELECT r.*, u.full_name AS user_name, u.email AS user_email, p.name AS product_name, p.slug AS product_slug
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN products p ON r.product_id = p.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      values
    );
    return rows;
  },

  async countAllAdmin({ search = null, rating = null } = {}) {
    const conditions = [];
    const values = [];

    if (rating) {
      conditions.push('r.rating = ?');
      values.push(Number(rating));
    }

    if (search) {
      conditions.push('(p.name LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR r.comment LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term, term, term);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN products p ON r.product_id = p.id
       ${whereClause}`,
      values
    );
    return rows[0] ? rows[0].total : 0;
  },

  async updateById(id, { rating, comment }) {
    const updates = [];
    const values = [];
    if (rating !== undefined) {
      updates.push('rating = ?');
      values.push(Number(rating));
    }
    if (comment !== undefined) {
      updates.push('comment = ?');
      values.push(comment);
    }
    if (updates.length === 0) return null;
    values.push(id);
    await pool.query(`UPDATE reviews SET ${updates.join(', ')} WHERE id = ?`, values);
    const [rows] = await pool.query(
      `SELECT r.*, u.full_name AS user_name, u.email AS user_email, p.name AS product_name, p.slug AS product_slug
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN products p ON r.product_id = p.id
       WHERE r.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = ReviewModel;
