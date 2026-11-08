const { pool } = require('../config/db');

const BannerModel = {
  async findAll({ activeOnly = true } = {}) {
    const whereClause = activeOnly ? 'WHERE is_active = 1' : '';
    const [rows] = await pool.query(
      `SELECT * FROM banners ${whereClause} ORDER BY sort_order ASC, id ASC`
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async create(data) {
    const {
      title,
      subtitle = null,
      badge_text = null,
      cta_text = 'Explore Collection',
      cta_link = '/catalog',
      image_url = null,
      sort_order = 0,
      is_active = 1,
    } = data;

    const [result] = await pool.query(
      `INSERT INTO banners (title, subtitle, badge_text, cta_text, cta_link, image_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, subtitle, badge_text, cta_text, cta_link, image_url, Number(sort_order) || 0, is_active ? 1 : 0]
    );
    return this.findById(result.insertId);
  },

  async update(id, fields) {
    const allowed = ['title', 'subtitle', 'badge_text', 'cta_text', 'cta_link', 'image_url', 'sort_order', 'is_active'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(key === 'is_active' ? (fields[key] ? 1 : 0) : fields[key]);
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE banners SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM banners WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = BannerModel;
