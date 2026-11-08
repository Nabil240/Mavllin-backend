const { pool } = require('../config/db');

const UserModel = {
  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async create({ full_name, email, password_hash, phone = null, avatar_url = null, role = 'customer' }) {
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone, avatar_url, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name, email, password_hash, phone, avatar_url, role]
    );
    return this.findById(result.insertId);
  },

  async update(id, fields) {
    const allowedKeys = [
      'full_name',
      'email',
      'phone',
      'avatar_url',
      'password_hash',
      'role',
      'is_active',
      'reset_token_hash',
      'reset_token_expires_at',
    ];
    const updates = [];
    const values = [];

    for (const key of allowedKeys) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async delete(id) {
    const [orders] = await pool.query('SELECT id FROM orders WHERE user_id = ? LIMIT 1', [id]);
    if (orders.length > 0) {
      await pool.query('UPDATE orders SET user_id = NULL WHERE user_id = ?', [id]);
    }
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async findByResetTokenHash(tokenHash) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE reset_token_hash = ? AND reset_token_expires_at > NOW() LIMIT 1',
      [tokenHash]
    );
    return rows[0] || null;
  },

  async findAll({ offset = 0, limit = 10, search = null, role = null }) {
    const conditions = [];
    const values = [];

    if (search) {
      conditions.push('(full_name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term, term);
    }

    if (role) {
      conditions.push('role = ?');
      values.push(role);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit, offset);

    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone, avatar_url, role, is_active, created_at, updated_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      values
    );

    return rows;
  },

  async countAll({ search = null, role = null }) {
    const conditions = [];
    const values = [];

    if (search) {
      conditions.push('(full_name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term, term);
    }

    if (role) {
      conditions.push('role = ?');
      values.push(role);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM users ${whereClause}`, values);
    return rows[0].total;
  },
};

module.exports = UserModel;
