const { pool } = require('../config/db');

const ProductModel = {
  async findAll({
    offset = 0,
    limit = 12,
    categoryId = null,
    categorySlug = null,
    search = null,
    minPrice = null,
    maxPrice = null,
    size = null,
    color = null,
    inStock = null,
    isFeatured = null,
    isActive = null,
    sort = 'newest',
  } = {}) {
    const conditions = [];
    const values = [];

    if (isActive !== null) {
      conditions.push('p.is_active = ?');
      values.push(isActive ? 1 : 0);
    }

    if (categoryId) {
      conditions.push('(p.category_id = ? OR c.parent_id = ?)');
      values.push(categoryId, categoryId);
    }

    if (categorySlug) {
      conditions.push('(c.slug = ? OR cp.slug = ?)');
      values.push(categorySlug, categorySlug);
    }

    if (isFeatured !== null) {
      conditions.push('p.is_featured = ?');
      values.push(isFeatured ? 1 : 0);
    }

    const hasMinPrice = minPrice !== null && minPrice !== undefined && minPrice !== '' && !isNaN(minPrice);
    const hasMaxPrice = maxPrice !== null && maxPrice !== undefined && maxPrice !== '' && !isNaN(maxPrice);

    if (hasMinPrice && hasMaxPrice) {
      conditions.push(
        '((p.base_price BETWEEN ? AND ?) OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.price >= ? AND pv.price <= ? AND pv.is_active = 1))'
      );
      values.push(Number(minPrice), Number(maxPrice), Number(minPrice), Number(maxPrice));
    } else if (hasMinPrice) {
      conditions.push(
        '(p.base_price >= ? OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.price >= ? AND pv.is_active = 1))'
      );
      values.push(Number(minPrice), Number(minPrice));
    } else if (hasMaxPrice) {
      conditions.push(
        '(p.base_price <= ? OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.price <= ? AND pv.is_active = 1))'
      );
      values.push(Number(maxPrice), Number(maxPrice));
    }

    if (size) {
      conditions.push(
        'EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.size = ? AND pv.is_active = 1)'
      );
      values.push(size);
    }

    if (color) {
      conditions.push(
        'EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.color = ? AND pv.is_active = 1)'
      );
      values.push(color);
    }

    if (inStock === true || inStock === 'true' || inStock === 1 || inStock === '1') {
      conditions.push(
        'EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.stock_quantity > 0 AND pv.is_active = 1)'
      );
    }

    if (search) {
      conditions.push(
        '(p.name LIKE ? OR p.short_description LIKE ? OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.sku LIKE ?))'
      );
      const term = `%${search}%`;
      values.push(term, term, term);
    }

    let orderBy = 'p.created_at DESC';
    if (sort === 'price_asc') {
      orderBy = 'p.base_price ASC';
    } else if (sort === 'price_desc') {
      orderBy = 'p.base_price DESC';
    } else if (sort === 'rating') {
      orderBy = 'avg_rating DESC';
    } else if (sort === 'name_asc') {
      orderBy = 'p.name ASC';
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit), Number(offset));

    const sql = `
      SELECT
        p.*,
        c.name AS category_name,
        c.slug AS category_slug,
        COALESCE(AVG(r.rating), 0) AS avg_rating,
        COUNT(DISTINCT r.id) AS review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories cp ON c.parent_id = cp.id
      LEFT JOIN reviews r ON p.id = r.product_id
      ${whereClause}
      GROUP BY p.id, c.name, c.slug
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const [products] = await pool.query(sql, values);

    // Hydrate variants and images for products
    if (products.length > 0) {
      const productIds = products.map((p) => p.id);
      const [allVariants] = await pool.query(
        'SELECT * FROM product_variants WHERE product_id IN (?) AND is_active = 1 ORDER BY id ASC',
        [productIds]
      );
      const [allImages] = await pool.query(
        'SELECT id, product_id, variant_id, image_url, alt_text, sort_order FROM product_images WHERE product_id IN (?) ORDER BY sort_order ASC, id ASC',
        [productIds]
      );

      const variantMap = {};
      for (const v of allVariants) {
        v.stockQuantity = v.stock_quantity;
        if (!variantMap[v.product_id]) variantMap[v.product_id] = [];
        variantMap[v.product_id].push(v);
      }

      const imageMap = {};
      for (const img of allImages) {
        if (!imageMap[img.product_id]) imageMap[img.product_id] = [];
        imageMap[img.product_id].push(img);
      }

      for (const p of products) {
        p.variants = variantMap[p.id] || [];
        p.images = imageMap[p.id] || [];
        p.price = p.base_price || (p.variants[0] ? p.variants[0].price : 0);
        p.total_stock = p.variants.reduce((acc, v) => acc + (Number(v.stock_quantity) || 0), 0);
        p.available_sizes = [...new Set(p.variants.map((v) => v.size).filter(Boolean))];
        p.available_colors = [...new Set(p.variants.map((v) => v.color).filter(Boolean))];
      }
    }

    return products;
  },

  async countAll({
    categoryId = null,
    categorySlug = null,
    search = null,
    minPrice = null,
    maxPrice = null,
    size = null,
    color = null,
    inStock = null,
    isFeatured = null,
    isActive = null,
  } = {}) {
    const conditions = [];
    const values = [];

    if (isActive !== null) {
      conditions.push('p.is_active = ?');
      values.push(isActive ? 1 : 0);
    }

    if (categoryId) {
      conditions.push('(p.category_id = ? OR c.parent_id = ?)');
      values.push(categoryId, categoryId);
    }

    if (categorySlug) {
      conditions.push('(c.slug = ? OR cp.slug = ?)');
      values.push(categorySlug, categorySlug);
    }

    if (isFeatured !== null) {
      conditions.push('p.is_featured = ?');
      values.push(isFeatured ? 1 : 0);
    }

    const hasMinPrice = minPrice !== null && minPrice !== undefined && minPrice !== '' && !isNaN(minPrice);
    const hasMaxPrice = maxPrice !== null && maxPrice !== undefined && maxPrice !== '' && !isNaN(maxPrice);

    if (hasMinPrice && hasMaxPrice) {
      conditions.push(
        '((p.base_price BETWEEN ? AND ?) OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.price >= ? AND pv.price <= ? AND pv.is_active = 1))'
      );
      values.push(Number(minPrice), Number(maxPrice), Number(minPrice), Number(maxPrice));
    } else if (hasMinPrice) {
      conditions.push(
        '(p.base_price >= ? OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.price >= ? AND pv.is_active = 1))'
      );
      values.push(Number(minPrice), Number(minPrice));
    } else if (hasMaxPrice) {
      conditions.push(
        '(p.base_price <= ? OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.price <= ? AND pv.is_active = 1))'
      );
      values.push(Number(maxPrice), Number(maxPrice));
    }

    if (size) {
      conditions.push(
        'EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.size = ? AND pv.is_active = 1)'
      );
      values.push(size);
    }

    if (color) {
      conditions.push(
        'EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.color = ? AND pv.is_active = 1)'
      );
      values.push(color);
    }

    if (inStock === true || inStock === 'true' || inStock === 1 || inStock === '1') {
      conditions.push(
        'EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.stock_quantity > 0 AND pv.is_active = 1)'
      );
    }

    if (search) {
      conditions.push(
        '(p.name LIKE ? OR p.short_description LIKE ? OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.sku LIKE ?))'
      );
      const term = `%${search}%`;
      values.push(term, term, term);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories cp ON c.parent_id = cp.id
      ${whereClause}
    `;

    const [rows] = await pool.query(sql, values);
    return rows[0] ? rows[0].total : 0;
  },

  async findById(id) {
    const sql = `
      SELECT
        p.*,
        c.name AS category_name,
        c.slug AS category_slug,
        COALESCE(AVG(r.rating), 0) AS avg_rating,
        COUNT(DISTINCT r.id) AS review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.id = ?
      GROUP BY p.id, c.name, c.slug
      LIMIT 1
    `;

    const [rows] = await pool.query(sql, [id]);
    if (!rows[0]) return null;

    const product = rows[0];
    product.images = await this.getImages(product.id);
    product.variants = await this.getVariants(product.id);

    product.price = product.base_price || (product.variants[0] ? product.variants[0].price : 0);
    product.total_stock = product.variants.reduce((acc, v) => acc + (Number(v.stock_quantity) || 0), 0);
    product.available_sizes = [...new Set(product.variants.map((v) => v.size).filter(Boolean))];
    product.available_colors = [...new Set(product.variants.map((v) => v.color).filter(Boolean))];

    return product;
  },

  async findBySlug(slug) {
    const sql = `
      SELECT
        p.*,
        c.name AS category_name,
        c.slug AS category_slug,
        COALESCE(AVG(r.rating), 0) AS avg_rating,
        COUNT(DISTINCT r.id) AS review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.slug = ?
      GROUP BY p.id, c.name, c.slug
      LIMIT 1
    `;

    const [rows] = await pool.query(sql, [slug]);
    if (!rows[0]) return null;

    const product = rows[0];
    product.images = await this.getImages(product.id);
    product.variants = await this.getVariants(product.id);

    product.price = product.base_price || (product.variants[0] ? product.variants[0].price : 0);
    product.total_stock = product.variants.reduce((acc, v) => acc + (Number(v.stock_quantity) || 0), 0);
    product.available_sizes = [...new Set(product.variants.map((v) => v.size).filter(Boolean))];
    product.available_colors = [...new Set(product.variants.map((v) => v.color).filter(Boolean))];

    return product;
  },

  async findBySku(sku) {
    // Check in products table or product_variants table
    const [rows] = await pool.query(
      `SELECT p.* FROM products p
       LEFT JOIN product_variants pv ON p.id = pv.product_id
       WHERE p.sku = ? OR pv.sku = ?
       LIMIT 1`,
      [sku, sku]
    );
    return rows[0] || null;
  },

  async findVariantBySku(sku) {
    const [rows] = await pool.query('SELECT * FROM product_variants WHERE sku = ? LIMIT 1', [sku]);
    return rows[0] || null;
  },

  async getVariants(productId) {
    const [rows] = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC',
      [productId]
    );
    for (const v of rows) {
      v.stockQuantity = v.stock_quantity;
    }
    return rows;
  },

  async create(productData, variants = []) {
    if ((!variants || variants.length === 0) && Array.isArray(productData.variants)) {
      variants = productData.variants;
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      if (variants.length > 1) {
        const comboSet = new Set();
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          if (!v) continue;
          const s = (v.size || '').trim();
          const c = (v.color || '').trim();
          const comboKey = `${s.toLowerCase()}:::${c.toLowerCase()}`;
          if (comboSet.has(comboKey)) {
            if (!s && !c) {
              throw new Error('Multiple variants cannot all have empty size and color. Each variant must specify a distinct size or color.');
            }
            throw new Error(`Duplicate variant option combination (size: "${s}", color: "${c}") found at variant index ${i}`);
          }
          comboSet.add(comboKey);
        }
      }

      let basePrice = productData.base_price !== undefined ? productData.base_price : productData.price;
      if ((basePrice === undefined || basePrice === null) && variants.length > 0) {
        basePrice = Math.min(...variants.map((v) => Number(v.price) || 0));
      }

      const primarySku = productData.sku || (variants[0] ? variants[0].sku : null);
      const baseCost = (productData.base_cost !== undefined && productData.base_cost !== null && !isNaN(Number(productData.base_cost)))
        ? Number(productData.base_cost)
        : (productData.baseCost !== undefined && productData.baseCost !== null && !isNaN(Number(productData.baseCost)))
          ? Number(productData.baseCost)
          : null;

      const [prodResult] = await connection.query(
        `INSERT INTO products (
          category_id, name, slug, sku, short_description, description, base_cost,
          base_price, price, discount_price, discount_type, discount_value, advance_payment_type,
          thumbnail_url, is_featured, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productData.category_id || null,
          productData.name,
          productData.slug,
          primarySku,
          productData.short_description || null,
          productData.description || null,
          baseCost,
          basePrice || 0,
          basePrice || 0,
          productData.discount_price || null,
          productData.discount_type || 'none',
          productData.discount_value !== undefined ? Number(productData.discount_value) : 0.00,
          productData.advance_payment_type || 'none',
          productData.thumbnail_url || null,
          productData.is_featured ? 1 : 0,
          productData.is_active !== undefined ? Number(productData.is_active) : 1,
        ]
      );

      const productId = prodResult.insertId;

      for (const v of variants) {
        const [varResult] = await connection.query(
          `INSERT INTO product_variants (
            product_id, sku, size, color, price, compare_at_price, stock_quantity, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            productId,
            v.sku,
            (v.size || '').trim(),
            (v.color || '').trim(),
            Number(v.price),
            (v.compare_at_price !== undefined && v.compare_at_price !== null)
              ? Number(v.compare_at_price)
              : (v.compareAtPrice !== undefined && v.compareAtPrice !== null ? Number(v.compareAtPrice) : null),
            Number(v.stock_quantity !== undefined ? v.stock_quantity : v.stockQuantity) || 0,
            v.is_active !== undefined ? (v.is_active ? 1 : 0) : (v.isActive !== undefined ? (v.isActive ? 1 : 0) : 1),
          ]
        );

        const variantId = varResult.insertId;
        const initialStock = Number(v.stock_quantity !== undefined ? v.stock_quantity : v.stockQuantity) || 0;

        if (initialStock > 0) {
          await connection.query(
            `INSERT INTO inventory_movements (
              variant_id, quantity_delta, before_quantity, after_quantity, reason, actor_id
            ) VALUES (?, ?, 0, ?, 'initial_stock', ?)`,
            [variantId, initialStock, initialStock, productData.actor_id || null]
          );
        }
      }

      await connection.commit();
      return this.findById(productId);
    } catch (err) {
      if (typeof connection.rollback === 'function') {
        try {
          await connection.rollback();
        } catch (_rollbackErr) {
          // Suppress rollback errors if transaction was never established or connection dropped
        }
      }
      throw err;
    } finally {
      if (typeof connection.release === 'function') {
        connection.release();
      }
    }
  },

  async update(id, fields) {
    if (fields.baseCost !== undefined && fields.base_cost === undefined) {
      fields.base_cost = fields.baseCost;
    }

    const allowed = [
      'category_id',
      'name',
      'slug',
      'sku',
      'short_description',
      'description',
      'base_cost',
      'base_price',
      'price',
      'discount_price',
      'discount_type',
      'discount_value',
      'advance_payment_type',
      'thumbnail_url',
      'is_featured',
      'is_active',
    ];

    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (fields.base_price !== undefined && fields.price === undefined) {
      updates.push('price = ?');
      values.push(fields.base_price);
    } else if (fields.price !== undefined && fields.base_price === undefined) {
      updates.push('base_price = ?');
      values.push(fields.price);
    }

    const hasVariantsSync = Array.isArray(fields.variants);

    if (updates.length === 0 && !hasVariantsSync) return this.findById(id);

    if (!hasVariantsSync) {
      values.push(id);
      await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);
      return this.findById(id);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      if (updates.length > 0) {
        const prodValues = [...values, id];
        await connection.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, prodValues);
      }

      const [existingVariants] = await connection.query(
        'SELECT * FROM product_variants WHERE product_id = ? FOR UPDATE',
        [id]
      );

      const retainedIds = [];
      for (const v of fields.variants) {
        if (!v) continue;
        const vSize = (v.size || '').trim();
        const vColor = (v.color || '').trim();
        const vPrice = Number(v.price || fields.base_price || 0);
        const vCompare =
          v.compare_at_price !== undefined && v.compare_at_price !== null
            ? Number(v.compare_at_price)
            : v.compareAtPrice !== undefined && v.compareAtPrice !== null
            ? Number(v.compareAtPrice)
            : null;
        const vStock =
          v.stock_quantity !== undefined
            ? Number(v.stock_quantity)
            : v.stockQuantity !== undefined
            ? Number(v.stockQuantity)
            : 0;
        const vActive =
          v.is_active !== undefined ? (v.is_active ? 1 : 0) : v.isActive !== undefined ? (v.isActive ? 1 : 0) : 1;

        let match = null;
        if (v.id) {
          match = existingVariants.find((ev) => Number(ev.id) === Number(v.id));
        }
        if (!match && v.sku) {
          match = existingVariants.find((ev) => ev.sku === v.sku);
        }
        if (!match) {
          match = existingVariants.find(
            (ev) => (ev.size || '').toLowerCase() === vSize.toLowerCase() && (ev.color || '').toLowerCase() === vColor.toLowerCase()
          );
        }

        if (match) {
          retainedIds.push(match.id);
          const beforeQty = Number(match.stock_quantity);
          const delta = vStock - beforeQty;
          await connection.query(
            `UPDATE product_variants
             SET sku = ?, size = ?, color = ?, price = ?, compare_at_price = ?, stock_quantity = ?, is_active = ?
             WHERE id = ?`,
            [v.sku || match.sku, vSize, vColor, vPrice, vCompare, vStock, vActive, match.id]
          );
          if (delta !== 0) {
            await connection.query(
              `INSERT INTO inventory_movements (
                variant_id, quantity_delta, before_quantity, after_quantity, reason, note, actor_id
              ) VALUES (?, ?, ?, ?, 'manual_adjustment', 'Variant stock updated via product edit', ?)`,
              [match.id, delta, beforeQty, vStock, fields.actor_id || null]
            );
          }
        } else {
          const [ins] = await connection.query(
            `INSERT INTO product_variants (
              product_id, sku, size, color, price, compare_at_price, stock_quantity, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, v.sku, vSize, vColor, vPrice, vCompare, vStock, vActive]
          );
          retainedIds.push(ins.insertId);
          if (vStock > 0) {
            await connection.query(
              `INSERT INTO inventory_movements (
                variant_id, quantity_delta, before_quantity, after_quantity, reason, actor_id
              ) VALUES (?, ?, 0, ?, 'initial_stock', ?)`,
              [ins.insertId, vStock, vStock, fields.actor_id || null]
            );
          }
        }
      }

      if (retainedIds.length > 0) {
        await connection.query(
          'UPDATE product_variants SET is_active = 0 WHERE product_id = ? AND id NOT IN (?)',
          [id, retainedIds]
        );
      }

      await connection.commit();
      return this.findById(id);
    } catch (err) {
      if (typeof connection.rollback === 'function') {
        try {
          await connection.rollback();
        } catch (_) {}
      }
      throw err;
    } finally {
      if (typeof connection.release === 'function') {
        connection.release();
      }
    }
  },

  async findVariantById(variantId) {
    const [rows] = await pool.query('SELECT * FROM product_variants WHERE id = ? LIMIT 1', [variantId]);
    return rows[0] || null;
  },

  async addVariant(productId, variantData, actorId = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const stock =
        variantData.stock_quantity !== undefined
          ? Number(variantData.stock_quantity)
          : variantData.stockQuantity !== undefined
          ? Number(variantData.stockQuantity)
          : 0;
      const compareAt =
        variantData.compare_at_price !== undefined && variantData.compare_at_price !== null
          ? Number(variantData.compare_at_price)
          : null;
      const [res] = await connection.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, compare_at_price, stock_quantity, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          variantData.sku,
          (variantData.size || '').trim(),
          (variantData.color || '').trim(),
          Number(variantData.price),
          compareAt,
          stock,
          variantData.is_active !== undefined ? (variantData.is_active ? 1 : 0) : 1,
        ]
      );
      if (stock > 0) {
        await connection.query(
          `INSERT INTO inventory_movements (variant_id, quantity_delta, before_quantity, after_quantity, reason, actor_id)
           VALUES (?, ?, 0, ?, 'initial_stock', ?)`,
          [res.insertId, stock, stock, actorId]
        );
      }
      await connection.commit();
      return this.findVariantById(res.insertId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async updateVariant(productId, variantId, fields, actorId = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        'SELECT * FROM product_variants WHERE id = ? AND product_id = ? FOR UPDATE',
        [variantId, productId]
      );
      if (!rows[0]) {
        await connection.rollback();
        return null;
      }
      const existing = rows[0];
      const updates = [];
      const values = [];
      const allowed = ['sku', 'size', 'color', 'price', 'compare_at_price', 'stock_quantity', 'is_active'];
      for (const k of allowed) {
        if (fields[k] !== undefined) {
          updates.push(`${k} = ?`);
          values.push(fields[k]);
        }
      }
      if (updates.length > 0) {
        values.push(variantId, productId);
        await connection.query(
          `UPDATE product_variants SET ${updates.join(', ')} WHERE id = ? AND product_id = ?`,
          values
        );
      }
      if (fields.stock_quantity !== undefined && Number(fields.stock_quantity) !== Number(existing.stock_quantity)) {
        const delta = Number(fields.stock_quantity) - Number(existing.stock_quantity);
        await connection.query(
          `INSERT INTO inventory_movements (variant_id, quantity_delta, before_quantity, after_quantity, reason, note, actor_id)
           VALUES (?, ?, ?, ?, 'manual_adjustment', 'Variant stock updated', ?)`,
          [variantId, delta, existing.stock_quantity, Number(fields.stock_quantity), actorId]
        );
      }
      await connection.commit();
      return this.findVariantById(variantId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async deleteVariant(productId, variantId) {
    const [orderUsage] = await pool.query('SELECT id FROM order_items WHERE variant_id = ? LIMIT 1', [variantId]);
    if (orderUsage.length > 0) {
      const [res] = await pool.query(
        'UPDATE product_variants SET is_active = 0 WHERE id = ? AND product_id = ?',
        [variantId, productId]
      );
      return res.affectedRows > 0;
    }
    const [result] = await pool.query(
      'DELETE FROM product_variants WHERE id = ? AND product_id = ?',
      [variantId, productId]
    );
    return result.affectedRows > 0;
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async getImages(productId) {
    const [rows] = await pool.query(
      'SELECT id, image_url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
      [productId]
    );
    return rows;
  },

  async addImage(productId, imageUrl, sortOrder = 0) {
    const [result] = await pool.query(
      'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)',
      [productId, imageUrl, sortOrder]
    );
    return { id: result.insertId, product_id: productId, image_url: imageUrl, sort_order: sortOrder };
  },

  async deleteImage(imageId) {
    const [result] = await pool.query('DELETE FROM product_images WHERE id = ?', [imageId]);
    return result.affectedRows > 0;
  },

  async adjustVariantStock(variantId, delta, reason = 'manual_adjustment', actorId = null, orderId = null, connection = null, note = null) {
    const isDedicatedConnection = !connection;
    const conn = connection || (await pool.getConnection());

    try {
      if (isDedicatedConnection) {
        await conn.beginTransaction();
      }

      const [vRows] = await conn.query(
        'SELECT id, stock_quantity FROM product_variants WHERE id = ? FOR UPDATE',
        [variantId]
      );

      if (!vRows || !vRows[0]) {
        throw new Error(`Product variant ${variantId} not found`);
      }

      const beforeQty = Number(vRows[0].stock_quantity);
      const afterQty = beforeQty + Number(delta);

      if (afterQty < 0) {
        throw new Error(
          `Insufficient stock for variant ${variantId}. Available: ${beforeQty}, Requested delta: ${delta}`
        );
      }

      const [updateResult] = await conn.query(
        'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ? AND stock_quantity + ? >= 0',
        [delta, variantId, delta]
      );

      if (updateResult && updateResult.affectedRows !== undefined && updateResult.affectedRows === 0) {
        throw new Error(
          `Insufficient stock for variant ${variantId}. Available: ${beforeQty}, Requested delta: ${delta}`
        );
      }

      await conn.query(
        `INSERT INTO inventory_movements (
          variant_id, quantity_delta, before_quantity, after_quantity, reason, note, actor_id, reference_order_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [variantId, delta, beforeQty, afterQty, reason, note, actorId, orderId]
      );

      if (isDedicatedConnection) {
        await conn.commit();
      }

      return { variantId, beforeQty, afterQty, delta };
    } catch (err) {
      if (isDedicatedConnection) {
        if (typeof conn.rollback === 'function') {
          try {
            await conn.rollback();
          } catch (_) {
            // Suppress rollback error to preserve root cause exception
          }
        }
      }
      throw err;
    } finally {
      if (isDedicatedConnection) {
        if (typeof conn.release === 'function') {
          conn.release();
        }
      }
    }
  },

  async adjustStock(productId, delta, connection = null) {
    // If called on product directly, update the first variant or all variants
    const db = connection || pool;
    const [variants] = await db.query(
      'SELECT id FROM product_variants WHERE product_id = ? LIMIT 1',
      [productId]
    );
    if (variants[0]) {
      return this.adjustVariantStock(variants[0].id, delta, 'manual_adjustment', null, null, connection);
    }
    return false;
  },
};

module.exports = ProductModel;
