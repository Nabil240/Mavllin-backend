const express = require('express');
const { body, param } = require('express-validator');
const ProductController = require('../controllers/product.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { uploadProductImage } = require('../middlewares/upload.middleware');
const { searchLimiter } = require('../middlewares/rateLimit.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Rate limit search requests (max 60 req/min when search query parameter is present)
const applySearchLimiter = (req, res, next) => {
  if (req.query && (req.query.search || req.query.q)) {
    return searchLimiter(req, res, next);
  }
  return next();
};

// Public routes
router.get('/', applySearchLimiter, asyncHandler(ProductController.getAll));
router.get('/featured', asyncHandler(ProductController.getFeatured));
router.get('/:identifier', asyncHandler(ProductController.getOne));

// Admin routes
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('category_id').optional({ nullable: true }).isInt().withMessage('Category ID must be an integer'),
    body('base_price').optional().isFloat({ min: 0 }).withMessage('Base price must be a non-negative number'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
    body('discount_price')
      .optional({ nullable: true })
      .isFloat({ min: 0 })
      .withMessage('Discount price must be a valid number'),
    body('discount_type')
      .optional()
      .isIn(['none', 'percentage', 'fixed'])
      .withMessage('discount_type must be one of: none, percentage, fixed'),
    body('discount_value')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('discount_value must be a non-negative number'),
    body('advance_payment_type')
      .optional()
      .isIn(['none', 'thirty_percent', 'fifty_percent', 'full', 'delivery_charge', 'percent_30', 'percent_50', 'percent_100'])
      .withMessage('advance_payment_type must be a valid advance option'),
    body('is_featured').optional().isInt({ min: 0, max: 1 }),
    body('is_active').optional().isInt({ min: 0, max: 1 }),

    // Variants validation
    body('variants')
      .isArray({ min: 1 })
      .withMessage('At least one product variant is required in the variants array'),
    body('variants.*.sku')
      .trim()
      .notEmpty()
      .withMessage('Each variant must have a valid non-empty SKU'),
    body('variants.*.price')
      .isFloat({ gt: 0 })
      .withMessage('Each variant price must be greater than 0'),
    body('variants.*.compare_at_price')
      .optional({ nullable: true })
      .isFloat({ gt: 0 })
      .withMessage('compare_at_price must be greater than 0'),
    body('variants.*.stock_quantity')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Variant stock quantity must be an integer >= 0'),
    body('variants.*.stockQuantity')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Variant stock quantity must be an integer >= 0'),
    body('variants.*.size')
      .optional({ nullable: true })
      .trim(),
    body('variants.*.color')
      .optional({ nullable: true })
      .trim(),

    // Custom check within the same payload
    body('variants').custom((variants) => {
      if (!Array.isArray(variants)) return true;
      const skuSet = new Set();
      const comboSet = new Set();

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v) continue;
        if (v.stock_quantity !== undefined && (isNaN(v.stock_quantity) || Number(v.stock_quantity) < 0)) {
          throw new Error(`Variant at index ${i} stock_quantity must be >= 0`);
        }
        if (v.stockQuantity !== undefined && (isNaN(v.stockQuantity) || Number(v.stockQuantity) < 0)) {
          throw new Error(`Variant at index ${i} stockQuantity must be >= 0`);
        }
        if (v && v.sku) {
          if (skuSet.has(v.sku)) {
            throw new Error(`Duplicate SKU "${v.sku}" found in variants payload`);
          }
          skuSet.add(v.sku);
        }

        // Multi-variant size/color combination uniqueness validation
        if (variants.length > 1) {
          const s = (v.size || '').trim();
          const c = (v.color || '').trim();
          const comboKey = `${s.toLowerCase()}:::${c.toLowerCase()}`;

          if (comboSet.has(comboKey)) {
            if (!s && !c) {
              throw new Error(
                'Multiple variants cannot all have empty size and color. Each variant must specify a distinct size or color.'
              );
            }
            throw new Error(
              `Duplicate variant option combination (size: "${s}", color: "${c}") found at variant index ${i}`
            );
          }
          comboSet.add(comboKey);
        }
      }
      return true;
    }),

    validateRequest,
  ],
  asyncHandler(ProductController.create)
);

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Product ID must be an integer'),
    body('base_price').optional().isFloat({ min: 0 }),
    body('price').optional().isFloat({ min: 0 }),
    body('discount_price').optional({ nullable: true }).isFloat({ min: 0 }),
    body('discount_type').optional().isIn(['none', 'percentage', 'fixed']),
    body('discount_value').optional().isFloat({ min: 0 }),
    body('advance_payment_type').optional().isIn(['none', 'thirty_percent', 'fifty_percent', 'full', 'delivery_charge', 'percent_30', 'percent_50', 'percent_100']),
    validateRequest,
  ],
  asyncHandler(ProductController.update)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  [param('id').isInt().withMessage('Product ID must be an integer'), validateRequest],
  asyncHandler(ProductController.delete)
);

// Product images
router.post(
  '/:id/images',
  authenticate,
  requireRole('admin'),
  [param('id').isInt().withMessage('Product ID must be an integer'), validateRequest],
  uploadProductImage.array('images', 5),
  asyncHandler(ProductController.uploadImages)
);

router.delete(
  '/images/:imageId',
  authenticate,
  requireRole('admin'),
  [param('imageId').isInt().withMessage('Image ID must be an integer'), validateRequest],
  asyncHandler(ProductController.deleteImage)
);

// Product variants management
router.post(
  '/:id/variants',
  authenticate,
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Product ID must be an integer'),
    body('sku').trim().notEmpty().withMessage('Variant SKU is required'),
    body('price').isFloat({ gt: 0 }).withMessage('Variant price must be greater than 0'),
    body('stock_quantity').optional().isInt({ min: 0 }).withMessage('stock_quantity must be >= 0'),
    validateRequest,
  ],
  asyncHandler(ProductController.addVariant)
);

router.put(
  '/:id/variants/:variantId',
  authenticate,
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Product ID must be an integer'),
    param('variantId').isInt().withMessage('Variant ID must be an integer'),
    body('price').optional().isFloat({ gt: 0 }).withMessage('Variant price must be greater than 0'),
    body('stock_quantity').optional().isInt({ min: 0 }).withMessage('stock_quantity must be >= 0'),
    validateRequest,
  ],
  asyncHandler(ProductController.updateVariant)
);

router.delete(
  '/:id/variants/:variantId',
  authenticate,
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Product ID must be an integer'),
    param('variantId').isInt().withMessage('Variant ID must be an integer'),
    validateRequest,
  ],
  asyncHandler(ProductController.deleteVariant)
);

module.exports = router;
