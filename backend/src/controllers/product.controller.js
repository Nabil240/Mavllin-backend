const ProductModel = require('../models/product.model');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { slugify, paginate } = require('../utils/helpers');

function normalizeAdvancePaymentType(val) {
  if (!val) return 'none';
  const str = String(val).trim().toLowerCase();
  if (['thirty_percent', 'percent_30', '30%', '30'].includes(str)) return 'thirty_percent';
  if (['fifty_percent', 'percent_50', '50%', '50'].includes(str)) return 'fifty_percent';
  if (['full', 'percent_100', '100%', '100'].includes(str)) return 'full';
  if (['delivery_charge', 'delivery'].includes(str)) return 'delivery_charge';
  if (['none', 'cod', '0'].includes(str)) return 'none';
  return 'none';
}

function resolveDiscountData(basePrice, discountType, discountValue, discountPrice) {
  let type = discountType || 'none';
  let val = discountValue !== undefined && discountValue !== null ? Number(discountValue) : 0;
  let price = discountPrice !== undefined && discountPrice !== null ? Number(discountPrice) : null;

  if (type === 'percentage' && val > 0) {
    price = parseFloat((basePrice * (1.0 - val / 100.0)).toFixed(2));
  } else if (type === 'fixed' && val > 0) {
    price = Math.max(0, parseFloat((basePrice - val).toFixed(2)));
  } else if (price !== null && price > 0 && price < basePrice && type === 'none') {
    type = 'fixed';
    val = parseFloat((basePrice - price).toFixed(2));
  } else if (type === 'none') {
    price = null;
    val = 0.0;
  }
  return { discount_type: type, discount_value: val, discount_price: price };
}

const ProductController = {
  async getAll(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 12));
    const rawCategoryId = req.query.categoryId || req.query.category || null;
    const parsedCatId = Number(rawCategoryId);
    const categoryId = rawCategoryId && !isNaN(parsedCatId) ? parsedCatId : null;
    const {
      categorySlug,
      minPrice,
      maxPrice,
      size,
      color,
      inStock,
      isFeatured,
      isActive,
      sort = 'newest',
    } = req.query;
    const search = req.query.search || req.query.q || null;

    const filterOptions = {
      categoryId,
      categorySlug: categorySlug || null,
      search: search || null,
      minPrice: minPrice !== undefined && minPrice !== '' && !isNaN(minPrice) ? Number(minPrice) : null,
      maxPrice: maxPrice !== undefined && maxPrice !== '' && !isNaN(maxPrice) ? Number(maxPrice) : null,
      size: size || null,
      color: color || null,
      inStock: inStock !== undefined ? inStock : null,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' || isFeatured === '1' || isFeatured === 1 : null,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === '1' || isActive === 1 ? 1 : 0) : 1,
    };

    const total = await ProductModel.countAll(filterOptions);
    const pagination = paginate({ page, limit, total });

    const products = await ProductModel.findAll({
      ...filterOptions,
      offset: pagination.offset,
      limit: pagination.limit,
      sort,
    });

    return sendSuccess(res, {
      message: 'Products retrieved successfully',
      data: products,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNext: pagination.hasNext,
        hasPrev: pagination.hasPrev,
      },
    });
  },

  async getFeatured(req, res) {
    const limit = Math.min(20, Number(req.query.limit) || 8);
    const products = await ProductModel.findAll({
      offset: 0,
      limit,
      isFeatured: true,
      isActive: 1,
      sort: 'newest',
    });

    return sendSuccess(res, {
      message: 'Featured products retrieved',
      data: products,
    });
  },

  async getOne(req, res) {
    const identifier = req.params.idOrSlug || req.params.identifier;
    let product = null;

    if (!isNaN(identifier)) {
      product = await ProductModel.findById(Number(identifier));
    }

    if (!product) {
      product = await ProductModel.findBySlug(identifier);
    }

    if (!product) {
      return sendError(res, { statusCode: 404, message: 'Product not found' });
    }

    return sendSuccess(res, {
      message: 'Product retrieved successfully',
      data: product,
    });
  },

  async create(req, res) {
    const {
      category_id,
      name,
      short_description,
      description,
      base_price,
      price,
      discount_price,
      thumbnail_url,
      is_featured,
      is_active,
      variants,
    } = req.body;

    // Check duplicate SKU across existing catalog
    if (Array.isArray(variants)) {
      for (const v of variants) {
        if (v.sku) {
          const existing = await ProductModel.findVariantBySku(v.sku);
          if (existing) {
            return sendError(res, {
              statusCode: 409,
              message: `Product variant with SKU "${v.sku}" already exists in catalog`,
            });
          }
        }
      }
    }

    let slug = req.body.slug ? slugify(req.body.slug) : slugify(name);
    const existingSlug = await ProductModel.findBySlug(slug);
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const calculatedBasePrice = base_price !== undefined ? Number(base_price) : (price !== undefined ? Number(price) : null);
    const discountData = resolveDiscountData(
      calculatedBasePrice || 0,
      req.body.discount_type,
      req.body.discount_value,
      discount_price
    );
    const advanceType = normalizeAdvancePaymentType(req.body.advance_payment_type);

    const product = await ProductModel.create(
      {
        category_id: category_id ? Number(category_id) : null,
        name,
        slug,
        short_description: short_description || null,
        description: description || null,
        base_price: calculatedBasePrice,
        price: calculatedBasePrice,
        discount_price: discountData.discount_price,
        discount_type: discountData.discount_type,
        discount_value: discountData.discount_value,
        advance_payment_type: advanceType,
        thumbnail_url: thumbnail_url || null,
        is_featured: is_featured ? 1 : 0,
        is_active: is_active !== undefined ? Number(is_active) : 1,
        actor_id: req.user ? req.user.id : null,
      },
      variants || []
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Product and variants created successfully',
      data: product,
    });
  },

  async update(req, res) {
    const { id } = req.params;
    const product = await ProductModel.findById(id);

    if (!product) {
      return sendError(res, { statusCode: 404, message: 'Product not found' });
    }

    const updateData = { ...req.body };

    if (updateData.slug) {
      updateData.slug = slugify(updateData.slug);
      const existingSlug = await ProductModel.findBySlug(updateData.slug);
      if (existingSlug && existingSlug.id !== Number(id)) {
        return sendError(res, { statusCode: 409, message: 'Slug is already in use by another product' });
      }
    }

    if (updateData.base_price !== undefined) {
      updateData.base_price = Number(updateData.base_price);
      updateData.price = updateData.base_price;
    } else if (updateData.price !== undefined) {
      updateData.price = Number(updateData.price);
      updateData.base_price = updateData.price;
    }

    const baseForDiscount = updateData.base_price !== undefined ? updateData.base_price : Number(product.base_price || product.price || 0);
    const typeForDiscount = updateData.discount_type !== undefined ? updateData.discount_type : product.discount_type;
    const valForDiscount = updateData.discount_value !== undefined ? updateData.discount_value : product.discount_value;
    const priceForDiscount = updateData.discount_price !== undefined ? updateData.discount_price : product.discount_price;

    if (
      updateData.discount_type !== undefined ||
      updateData.discount_value !== undefined ||
      updateData.discount_price !== undefined ||
      updateData.base_price !== undefined
    ) {
      const discountData = resolveDiscountData(baseForDiscount, typeForDiscount, valForDiscount, priceForDiscount);
      updateData.discount_type = discountData.discount_type;
      updateData.discount_value = discountData.discount_value;
      updateData.discount_price = discountData.discount_price;
    }

    if (updateData.advance_payment_type !== undefined) {
      updateData.advance_payment_type = normalizeAdvancePaymentType(updateData.advance_payment_type);
    }

    updateData.actor_id = req.user ? req.user.id : null;

    const updated = await ProductModel.update(id, updateData);

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Product updated successfully',
      data: updated,
    });
  },

  async addVariant(req, res) {
    const { id } = req.params;
    const product = await ProductModel.findById(id);
    if (!product) {
      return sendError(res, { statusCode: 404, message: 'Product not found' });
    }

    if (req.body.sku) {
      const existing = await ProductModel.findVariantBySku(req.body.sku);
      if (existing) {
        return sendError(res, { statusCode: 409, message: `Product variant with SKU "${req.body.sku}" already exists` });
      }
    }

    const variant = await ProductModel.addVariant(Number(id), req.body, req.user ? req.user.id : null);
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Product variant created successfully',
      data: variant,
    });
  },

  async updateVariant(req, res) {
    const { id, variantId } = req.params;
    const variant = await ProductModel.updateVariant(Number(id), Number(variantId), req.body, req.user ? req.user.id : null);
    if (!variant) {
      return sendError(res, { statusCode: 404, message: 'Product variant not found' });
    }
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Product variant updated successfully',
      data: variant,
    });
  },

  async deleteVariant(req, res) {
    const { id, variantId } = req.params;
    const deleted = await ProductModel.deleteVariant(Number(id), Number(variantId));
    if (!deleted) {
      return sendError(res, { statusCode: 404, message: 'Product variant not found' });
    }
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Product variant removed successfully',
    });
  },

  async delete(req, res) {
    const { id } = req.params;
    const success = await ProductModel.delete(id);

    if (!success) {
      return sendError(res, { statusCode: 404, message: 'Product not found or already deleted' });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Product deleted successfully',
    });
  },

  async uploadImages(req, res) {
    const { id } = req.params;
    const product = await ProductModel.findById(id);

    if (!product) {
      return sendError(res, { statusCode: 404, message: 'Product not found' });
    }

    if (!req.files || req.files.length === 0) {
      return sendError(res, { statusCode: 400, message: 'No images uploaded' });
    }

    const inserted = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const imageUrl = `/uploads/products/${file.filename}`;
      const imageRecord = await ProductModel.addImage(Number(id), imageUrl, i);
      inserted.push(imageRecord);

      if (!product.thumbnail_url && i === 0) {
        await ProductModel.update(id, { thumbnail_url: imageUrl });
      }
    }

    return sendSuccess(res, {
      statusCode: 201,
      message: `${inserted.length} image(s) uploaded successfully`,
      data: inserted,
    });
  },

  async deleteImage(req, res) {
    const { imageId } = req.params;
    const success = await ProductModel.deleteImage(imageId);

    if (!success) {
      return sendError(res, { statusCode: 404, message: 'Product image not found' });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Product image deleted successfully',
    });
  },
};

module.exports = ProductController;
