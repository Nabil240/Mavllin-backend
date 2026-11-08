const { pool } = require('../config/db');

const AddressModel = {
  async findByUserId(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [userId]
    );
    return rows;
  },

  async findById(id, userId) {
    const [rows] = await pool.query(
      'SELECT * FROM addresses WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const {
      label = 'Home',
      recipient_name,
      phone,
      street_address,
      area = null,
      city,
      state = null,
      postal_code,
      country = 'Bangladesh',
      is_default = 0,
    } = data;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // If marked as default or first address, reset others
      if (is_default) {
        await connection.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
      } else {
        const [existing] = await connection.query('SELECT COUNT(*) AS count FROM addresses WHERE user_id = ?', [userId]);
        if (existing[0].count === 0) {
          data.is_default = 1;
        }
      }

      const [result] = await connection.query(
        `INSERT INTO addresses (
          user_id, label, recipient_name, phone, street_address, area, city, state, postal_code, country, is_default
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          label,
          recipient_name,
          phone,
          street_address,
          area,
          city,
          state,
          postal_code,
          country,
          data.is_default ? 1 : 0,
        ]
      );

      await connection.commit();
      return this.findById(result.insertId, userId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async update(id, userId, fields) {
    const allowed = ['label', 'recipient_name', 'phone', 'street_address', 'area', 'city', 'state', 'postal_code', 'country', 'is_default'];
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      if (fields.is_default) {
        await connection.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
      }

      const updates = [];
      const values = [];

      for (const key of allowed) {
        if (fields[key] !== undefined) {
          updates.push(`${key} = ?`);
          values.push(fields[key]);
        }
      }

      if (updates.length > 0) {
        values.push(id, userId);
        await connection.query(`UPDATE addresses SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
      }

      await connection.commit();
      return this.findById(id, userId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async setDefault(id, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
      await connection.query('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [id, userId]);
      await connection.commit();
      return this.findById(id, userId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async delete(id, userId) {
    const [result] = await pool.query('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, userId]);
    return result.affectedRows > 0;
  },
};

module.exports = AddressModel;
