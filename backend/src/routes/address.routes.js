const express = require('express');
const { body, param } = require('express-validator');
const AddressController = require('../controllers/address.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/addresses
router.get('/', asyncHandler(AddressController.getAddresses));

// GET /api/v1/addresses/:id
router.get(
  '/:id',
  [param('id').isInt().withMessage('Address ID must be an integer'), validateRequest],
  asyncHandler(AddressController.getAddress)
);

// POST /api/v1/addresses
router.post(
  '/',
  [
    body('recipient_name').trim().notEmpty().withMessage('Recipient name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('street_address').trim().notEmpty().withMessage('Street address is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('postal_code').trim().notEmpty().withMessage('Postal code is required'),
    validateRequest,
  ],
  asyncHandler(AddressController.createAddress)
);

// PUT /api/v1/addresses/:id
router.put(
  '/:id',
  [param('id').isInt().withMessage('Address ID must be an integer'), validateRequest],
  asyncHandler(AddressController.updateAddress)
);

// PATCH /api/v1/addresses/:id/default
router.patch(
  '/:id/default',
  [param('id').isInt().withMessage('Address ID must be an integer'), validateRequest],
  asyncHandler(AddressController.setDefaultAddress)
);

// DELETE /api/v1/addresses/:id
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Address ID must be an integer'), validateRequest],
  asyncHandler(AddressController.deleteAddress)
);

module.exports = router;
