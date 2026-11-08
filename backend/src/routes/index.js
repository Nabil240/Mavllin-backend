const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');
const cartRoutes = require('./cart.routes');
const couponRoutes = require('./coupon.routes');
const checkoutRoutes = require('./checkout.routes');
const orderRoutes = require('./order.routes');
const reviewRoutes = require('./review.routes');
const wishlistRoutes = require('./wishlist.routes');
const addressRoutes = require('./address.routes');
const adminRoutes = require('./admin.routes');
const bannerRoutes = require('./banner.routes');
const deliveryRoutes = require('./delivery.routes');
const messagingRoutes = require('./messaging.routes');
const ProductController = require('../controllers/product.controller');
const { searchLimiter } = require('../middlewares/rateLimit.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/banners', bannerRoutes);
router.get('/search', searchLimiter, (req, res, next) => {
  req.query.search = req.query.q || req.query.search || '';
  return asyncHandler(ProductController.getAll)(req, res, next);
});
router.use('/cart', cartRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/coupons', couponRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/addresses', addressRoutes);
router.use('/admin', adminRoutes);
router.use('/delivery-charges', deliveryRoutes);
router.use('/messaging', messagingRoutes);

module.exports = router;
