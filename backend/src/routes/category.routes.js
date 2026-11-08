const express = require('express');
const { body, param } = require('express-validator');
const CategoryController = require('../controllers/category.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/v1/categories
router.get('/', asyncHandler(CategoryController.getAll));

// GET /api/v1/categories/:identifier (ID or slug)
router.get('/:identifier', asyncHandler(CategoryController.getOne));

// Admin routes
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('parent_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('Parent category ID must be an integer'),
    body('description').optional({ nullable: true }).trim(),
    body('image_url').optional({ nullable: true }).trim(),
    body('is_active').optional().isInt({ min: 0, max: 1 }),
    validateRequest,
  ],
  asyncHandler(CategoryController.create)
);

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Category ID must be an integer'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('parent_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('Parent category ID must be an integer'),
    validateRequest,
  ],
  asyncHandler(CategoryController.update)
);

router.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Category ID must be an integer'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('parent_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('Parent category ID must be an integer'),
    validateRequest,
  ],
  asyncHandler(CategoryController.update)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  [param('id').isInt().withMessage('Category ID must be an integer'), validateRequest],
  asyncHandler(CategoryController.delete)
);

module.exports = router;
