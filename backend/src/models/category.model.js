const { pool } = require('../config/db');

const CategoryModel = {
  async findAll({ activeOnly = false } = {}) {
    const where = activeOnly ? 'WHERE c.is_active = 1' : '';
    const [rows] = await pool.query(
      `SELECT c.*, p.name AS parent_name
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
       ${where}
       ORDER BY c.parent_id ASC, c.name ASC`
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT c.*, p.name AS parent_name
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async findBySlug(slug) {
    const [rows] = await pool.query(
      `SELECT c.*, p.name AS parent_name
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE c.slug = ? LIMIT 1`,
      [slug]
    );
    return rows[0] || null;
  },

  async create({ parent_id = null, name, slug, description = null, image_url = null, is_active = 1 }) {
    const [result] = await pool.query(
      `INSERT INTO categories (parent_id, name, slug, description, image_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [parent_id, name, slug, description, image_url, is_active]
    );
    return this.findById(result.insertId);
  },

  async update(id, fields) {
    const allowed = ['parent_id', 'name', 'slug', 'description', 'image_url', 'is_active'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = CategoryModel;
