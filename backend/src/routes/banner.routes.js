const express = require('express');
const { body, param } = require('express-validator');
const BannerController = require('../controllers/banner.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Public
router.get('/', asyncHandler(BannerController.getAll));

// Admin
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  [
    body('title').trim().notEmpty().withMessage('Banner title is required'),
    validateRequest,
  ],
  asyncHandler(BannerController.create)
);

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  [param('id').isInt().withMessage('Banner ID must be an integer'), validateRequest],
  asyncHandler(BannerController.update)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  [param('id').isInt().withMessage('Banner ID must be an integer'), validateRequest],
  asyncHandler(BannerController.delete)
);

module.exports = router;
