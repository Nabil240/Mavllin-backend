const { pool } = require('../config/db');

const DashboardModel = {
  async getOverviewStats() {
    const [stats] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status != 'cancelled') AS gross_revenue,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid' OR status != 'cancelled') AS total_revenue,
        (SELECT COUNT(*) FROM products WHERE is_active = 1) AS total_products,
        (SELECT COUNT(*) FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.is_active = 1 AND p.is_active = 1) AS total_variants,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') AS total_customers,
        (SELECT COUNT(*) FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.stock_quantity <= 5 AND pv.is_active = 1 AND p.is_active = 1) AS low_stock_count,
        (SELECT COUNT(*) FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.stock_quantity = 0 AND pv.is_active = 1 AND p.is_active = 1) AS out_of_stock_count,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending_orders
    `);

    return stats[0];
  },

  async getRecentOrders(limit = 6) {
    const [rows] = await pool.query(
      `SELECT
         o.id,
         o.order_number,
         o.total_amount,
         o.status,
         o.payment_status,
         o.created_at,
         COALESCE(u.full_name, JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.recipient_name')), 'Guest') AS customer_name,
         COALESCE(u.email, o.guest_email) AS customer_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT ?`,
      [Number(limit)]
    );
    return rows;
  },

  async getTopProducts(limit = 5) {
    const [rows] = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.slug,
         p.base_price AS price,
         p.thumbnail_url,
         COALESCE(SUM(oi.quantity), 0) AS units_sold,
         COALESCE(SUM(oi.line_total), 0) AS total_sales
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.status != 'cancelled'
       GROUP BY p.id, p.name, p.slug, p.base_price, p.thumbnail_url
       ORDER BY units_sold DESC
       LIMIT ?`,
      [Number(limit)]
    );
    return rows;
  },

  async getMonthlyRevenue() {
    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(id) AS order_count,
        COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders
      WHERE status != 'cancelled'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);
    return rows;
  },

  async getLowStockProducts(threshold = 5) {
    const [rows] = await pool.query(
      `SELECT
         pv.id AS variant_id,
         p.id AS product_id,
         p.id,
         p.name,
         p.slug,
         pv.sku,
         pv.size,
         pv.color,
         pv.stock_quantity,
         pv.price,
         p.thumbnail_url
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.stock_quantity <= ? AND pv.is_active = 1 AND p.is_active = 1
       ORDER BY pv.stock_quantity ASC, pv.id ASC`,
      [Number(threshold)]
    );
    return rows;
  },

  async getInventoryVariants({ offset = 0, limit = 25, search = null, stockStatus = 'all' } = {}) {
    const conditions = ['p.is_active = 1', 'pv.is_active = 1'];
    const values = [];

    if (search) {
      conditions.push('(p.name LIKE ? OR pv.sku LIKE ? OR pv.color LIKE ? OR pv.size LIKE ?)');
      const term = `%${search}%`;
      values.push(term, term, term, term);
    }

    if (stockStatus === 'low') {
      conditions.push('pv.stock_quantity > 0 AND pv.stock_quantity <= 5');
    } else if (stockStatus === 'out') {
      conditions.push('pv.stock_quantity = 0');
    } else if (stockStatus === 'in_stock') {
      conditions.push('pv.stock_quantity > 5');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       ${whereClause}`,
      values
    );

    const [rows] = await pool.query(
      `SELECT
         pv.id AS variant_id,
         pv.id,
         pv.product_id,
         pv.sku,
         pv.size,
         pv.color,
         pv.price,
         pv.compare_at_price,
         pv.stock_quantity,
         pv.is_active,
         pv.updated_at,
         p.name AS product_name,
         p.slug AS product_slug,
         p.thumbnail_url,
         c.name AS category_name
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}
       ORDER BY pv.stock_quantity ASC, pv.id ASC
       LIMIT ? OFFSET ?`,
      [...values, Number(limit), Number(offset)]
    );

    return {
      total: countRows[0].total,
      items: rows,
    };
  },

  async getInventoryMovements({ variantId = null, reason = null, limit = 50 } = {}) {
    const conditions = [];
    const values = [];

    if (variantId) {
      conditions.push('im.variant_id = ?');
      values.push(Number(variantId));
    }

    if (reason) {
      conditions.push('im.reason = ?');
      values.push(reason);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Math.min(200, Math.max(1, Number(limit) || 50)));

    const [rows] = await pool.query(
      `SELECT
         im.*,
         pv.sku AS variant_sku,
         pv.size AS variant_size,
         pv.color AS variant_color,
         p.name AS product_name,
         u.full_name AS actor_name,
         o.order_number
       FROM inventory_movements im
       JOIN product_variants pv ON im.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       LEFT JOIN users u ON im.actor_id = u.id
       LEFT JOIN orders o ON im.reference_order_id = o.id
       ${whereClause}
       ORDER BY im.created_at DESC, im.id DESC
       LIMIT ?`,
      values
    );

    return rows;
  },

  async getPayments({ offset = 0, limit = 20, status = null, provider = null } = {}) {
    const conditions = [];
    const values = [];

    if (status) {
      conditions.push('pay.status = ?');
      values.push(status);
    }

    if (provider) {
      conditions.push('pay.provider = ?');
      values.push(provider);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM payments pay ${whereClause}`,
      values
    );

    const [rows] = await pool.query(
      `SELECT
         pay.*,
         o.order_number,
         o.status AS order_status,
         o.payment_status AS order_payment_status,
         COALESCE(u.full_name, JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.recipient_name')), 'Guest') AS customer_name,
         COALESCE(u.email, o.guest_email) AS customer_email
       FROM payments pay
       JOIN orders o ON pay.order_id = o.id
       LEFT JOIN users u ON o.user_id = u.id
       ${whereClause}
       ORDER BY pay.created_at DESC, pay.id DESC
       LIMIT ? OFFSET ?`,
      [...values, Number(limit), Number(offset)]
    );

    return {
      total: countRows[0].total,
      items: rows,
    };
  },

  async getSalesReport() {
    const [[summaryRows], [statusRows], [providerRows], topProducts, monthlyRevenue] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_orders,
          SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END) AS active_orders,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
          COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS total_sales,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS realized_revenue,
          COALESCE(AVG(CASE WHEN status != 'cancelled' THEN total_amount ELSE NULL END), 0) AS avg_order_value
        FROM orders
      `),
      pool.query(`
        SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS amount
        FROM orders
        GROUP BY status
      `),
      pool.query(`
        SELECT provider, status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total_amount
        FROM payments
        GROUP BY provider, status
      `),
      this.getTopProducts(10),
      this.getMonthlyRevenue(),
    ]);

    return {
      summary: {
        total_orders: Number(summaryRows[0].total_orders || 0),
        active_orders: Number(summaryRows[0].active_orders || 0),
        cancelled_orders: Number(summaryRows[0].cancelled_orders || 0),
        total_sales: parseFloat(Number(summaryRows[0].total_sales || 0).toFixed(2)),
        realized_revenue: parseFloat(Number(summaryRows[0].realized_revenue || 0).toFixed(2)),
        avg_order_value: parseFloat(Number(summaryRows[0].avg_order_value || 0).toFixed(2)),
      },
      orders_by_status: statusRows,
      payments_by_provider: providerRows,
      top_products: topProducts,
      monthly_revenue: monthlyRevenue,
    };
  },
};

module.exports = DashboardModel;
