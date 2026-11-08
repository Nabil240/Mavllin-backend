-- =========================================================
-- MAVLLIN - Complete MySQL 8.0 E-Commerce Schema
-- Includes Product Variants, Inventory Movements, Order History & Banners
-- =========================================================

CREATE DATABASE IF NOT EXISTS ecommerce_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ecommerce_db;

-- 1. Users (Customers, Staff & Admins)
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  avatar_url VARCHAR(255) DEFAULT NULL,
  role ENUM('customer', 'admin', 'staff') NOT NULL DEFAULT 'customer',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  reset_token_hash VARCHAR(255) DEFAULT NULL,
  reset_token_expires_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_active (is_active)
) ENGINE=InnoDB;

-- 2. Customer Shipping Addresses
CREATE TABLE IF NOT EXISTS addresses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  label VARCHAR(50) DEFAULT 'Home',
  recipient_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  street_address VARCHAR(255) NOT NULL,
  area VARCHAR(100) DEFAULT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) DEFAULT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Bangladesh',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_addresses_user (user_id)
) ENGINE=InnoDB;

-- 3. Categories (Supports nested parent/child categories)
CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id INT UNSIGNED DEFAULT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description TEXT DEFAULT NULL,
  image_url VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_categories_parent (parent_id),
  INDEX idx_categories_active (is_active),
  INDEX idx_categories_slug (slug)
) ENGINE=InnoDB;

-- 4. Products (Parent Catalog Model)
CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED DEFAULT NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  sku VARCHAR(100) DEFAULT NULL,
  short_description VARCHAR(500) DEFAULT NULL,
  description LONGTEXT DEFAULT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  price DECIMAL(10, 2) DEFAULT NULL,
  discount_price DECIMAL(10, 2) DEFAULT NULL,
  discount_type ENUM('none', 'percentage', 'fixed') NOT NULL DEFAULT 'none',
  discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  advance_payment_type ENUM('none', 'thirty_percent', 'fifty_percent', 'full', 'delivery_charge') NOT NULL DEFAULT 'none',
  thumbnail_url VARCHAR(255) DEFAULT NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_products_category (category_id),
  INDEX idx_products_featured (is_featured, is_active),
  INDEX idx_products_slug (slug),
  INDEX idx_products_base_price (base_price)
) ENGINE=InnoDB;

-- 5. Product Variants (Sellable SKU Options: Size, Color, Stock, Pricing)
CREATE TABLE IF NOT EXISTS product_variants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  sku VARCHAR(100) NOT NULL UNIQUE,
  size VARCHAR(30) NOT NULL DEFAULT '',
  color VARCHAR(50) NOT NULL DEFAULT '',
  price DECIMAL(10, 2) NOT NULL,
  compare_at_price DECIMAL(10, 2) DEFAULT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT chk_variant_price CHECK (price >= 0),
  CONSTRAINT chk_variant_compare_price CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  CONSTRAINT chk_variant_stock CHECK (stock_quantity >= 0),
  UNIQUE KEY uq_product_size_color (product_id, size, color),
  INDEX idx_variants_product (product_id),
  INDEX idx_variants_sku (sku),
  INDEX idx_variants_size (size),
  INDEX idx_variants_color (color),
  INDEX idx_variants_price (price),
  INDEX idx_variants_stock (stock_quantity),
  INDEX idx_variants_active (is_active)
) ENGINE=InnoDB;

-- 6. Product Gallery Images
CREATE TABLE IF NOT EXISTS product_images (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  variant_id INT UNSIGNED DEFAULT NULL,
  image_url VARCHAR(255) NOT NULL,
  alt_text VARCHAR(200) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_images_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  INDEX idx_product_images_product (product_id),
  INDEX idx_product_images_variant (variant_id)
) ENGINE=InnoDB;

-- 7. Coupons / Promo Codes
CREATE TABLE IF NOT EXISTS coupons (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10, 2) NOT NULL,
  min_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  usage_limit INT UNSIGNED DEFAULT NULL,
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_universal TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_coupons_code (code),
  INDEX idx_coupons_active (is_active)
) ENGINE=InnoDB;

-- 8. Orders (Supports Registered Customer & Guest Checkout)
CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  user_id INT UNSIGNED DEFAULT NULL,
  guest_email VARCHAR(160) DEFAULT NULL,
  guest_phone VARCHAR(30) DEFAULT NULL,
  coupon_id INT UNSIGNED DEFAULT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  shipping_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  advance_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  due_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash_on_delivery',
  payment_status ENUM('unpaid', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'unpaid',
  advance_payment_status ENUM('unpaid', 'paid', 'partially_paid') NOT NULL DEFAULT 'unpaid',
  shipping_address JSON NOT NULL,
  notes TEXT DEFAULT NULL,
  cancellation_reason VARCHAR(500) DEFAULT NULL,
  courier_name VARCHAR(100) DEFAULT NULL,
  tracking_number VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_payment_method (payment_method),
  INDEX idx_orders_payment_status (payment_status),
  INDEX idx_orders_number (order_number),
  INDEX idx_orders_created (created_at)
) ENGINE=InnoDB;

-- 9. Order Line Items (Preserves variant snapshot at time of purchase)
CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED DEFAULT NULL,
  variant_id INT UNSIGNED DEFAULT NULL,
  product_name VARCHAR(200) NOT NULL,
  variant_sku VARCHAR(100) DEFAULT NULL,
  variant_size VARCHAR(30) DEFAULT NULL,
  size VARCHAR(30) DEFAULT NULL,
  variant_color VARCHAR(50) DEFAULT NULL,
  color VARCHAR(50) DEFAULT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  line_total DECIMAL(10, 2) NOT NULL,
  advance_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(10, 2) DEFAULT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_variant (variant_id)
) ENGINE=InnoDB;

-- 10. Order Status History (Audit Trail for Lifecycle Transitions)
CREATE TABLE IF NOT EXISTS order_status_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  previous_status VARCHAR(40) DEFAULT NULL,
  new_status VARCHAR(40) NOT NULL,
  actor_id INT UNSIGNED DEFAULT NULL,
  note VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_status_history_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status_history_order (order_id)
) ENGINE=InnoDB;

-- 11. Inventory Movements (Audit Log for Stock Changes)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  variant_id INT UNSIGNED NOT NULL,
  quantity_delta INT NOT NULL,
  before_quantity INT NOT NULL,
  after_quantity INT NOT NULL,
  reason ENUM('restock', 'order_placed', 'order_cancelled', 'manual_adjustment', 'damaged', 'return', 'initial_stock') NOT NULL DEFAULT 'manual_adjustment',
  note VARCHAR(255) DEFAULT NULL,
  actor_id INT UNSIGNED DEFAULT NULL,
  reference_order_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movements_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  CONSTRAINT fk_movements_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_movements_order FOREIGN KEY (reference_order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_movements_variant (variant_id),
  INDEX idx_movements_created (created_at),
  INDEX idx_movements_reason (reason),
  INDEX idx_movements_order (reference_order_id)
) ENGINE=InnoDB;

-- 12a. Carts Session Table (Supports authenticated users and guest sessions)
CREATE TABLE IF NOT EXISTS carts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED DEFAULT NULL,
  session_id VARCHAR(100) DEFAULT NULL,
  status ENUM('active', 'merged', 'converted', 'abandoned') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_carts_user (user_id),
  INDEX idx_carts_session (session_id)
) ENGINE=InnoDB;

-- 12. Shopping Cart Items
CREATE TABLE IF NOT EXISTS cart_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id INT UNSIGNED DEFAULT NULL,
  user_id INT UNSIGNED DEFAULT NULL,
  session_id VARCHAR(100) DEFAULT NULL,
  product_id INT UNSIGNED NOT NULL,
  variant_id INT UNSIGNED DEFAULT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_variant (user_id, variant_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  INDEX idx_cart_user (user_id),
  INDEX idx_cart_session (session_id),
  INDEX idx_cart_cart_id (cart_id)
) ENGINE=InnoDB;

-- 13. Payments
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'cod',
  transaction_id VARCHAR(160) DEFAULT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'succeeded', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  refund_reason VARCHAR(255) DEFAULT NULL,
  paid_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_payments_order (order_id),
  INDEX idx_payments_status (status)
) ENGINE=InnoDB;

-- 14. Product Reviews & Ratings
CREATE TABLE IF NOT EXISTS reviews (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review_product_user (product_id, user_id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reviews_product (product_id)
) ENGINE=InnoDB;

-- 15. Wishlists
CREATE TABLE IF NOT EXISTS wishlists (
  user_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 16. Promotional Banners
CREATE TABLE IF NOT EXISTS banners (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  subtitle VARCHAR(300) DEFAULT NULL,
  badge_text VARCHAR(60) DEFAULT NULL,
  cta_text VARCHAR(60) DEFAULT 'Explore Collection',
  cta_link VARCHAR(200) DEFAULT '/catalog',
  image_url VARCHAR(255) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_banners_active (is_active, sort_order)
) ENGINE=InnoDB;

-- 17. Store & SEO Settings (Delivery Charges, Free Shipping Threshold, Meta SEO, Contact Info)
CREATE TABLE IF NOT EXISTS store_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO store_settings (setting_key, setting_value)
VALUES
  ('site_name', 'MAVLLIN'),
  ('site_tagline', 'DHAKA • CONTEMPORARY ATELIER'),
  ('meta_title', 'MAVLLIN — Contemporary Fashion & Heritage Essentials'),
  ('meta_description', 'MAVLLIN — Minimalist contemporary fashion, heritage panjabi, tailored menswear, womenswear, and everyday luxury essentials crafted in Dhaka, Bangladesh.'),
  ('meta_keywords', 'MAVLLIN, Bangladesh fashion, Dhaka clothing brand, heritage panjabi, menswear, womenswear, cash on delivery Bangladesh'),
  ('delivery_charge_inside_dhaka', '70.00'),
  ('delivery_charge_outside_dhaka', '130.00'),
  ('free_shipping_threshold', '2500.00'),
  ('announcement_text', 'COMPLIMENTARY DELIVERY ON ORDERS OVER ৳2,500 • USE CODE WELCOME10 FOR 10% OFF • CASH ON DELIVERY NATIONWIDE'),
  ('support_phone', '+880 1711-000000'),
  ('support_email', 'concierge@mavllin.com'),
  ('trade_license_no', 'TRAD/DNCC/048291/2026'),
  ('dbid_number', 'DBID-884920115'),
  ('currency', 'BDT'),
  ('currency_symbol', '৳'),
  ('estimated_days_inside_dhaka', '1-2 days'),
  ('estimated_days_outside_dhaka', '3-5 days')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- 18. Unified Messaging Conversations (Omnichannel: Facebook Messenger & WhatsApp Business)
CREATE TABLE IF NOT EXISTS messaging_conversations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel ENUM('facebook', 'whatsapp') NOT NULL,
  external_sender_id VARCHAR(191) NOT NULL,
  customer_name VARCHAR(150) DEFAULT NULL,
  customer_phone VARCHAR(50) DEFAULT NULL,
  last_message_text TEXT DEFAULT NULL,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_ai_enabled TINYINT(1) NOT NULL DEFAULT 1,
  unread_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conv_channel_sender (channel, external_sender_id),
  INDEX idx_conv_channel (channel),
  INDEX idx_conv_last_message_at (last_message_at),
  INDEX idx_conv_is_ai_enabled (is_ai_enabled),
  INDEX idx_conv_customer_phone (customer_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Unified Messaging Messages
CREATE TABLE IF NOT EXISTS messaging_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT UNSIGNED NOT NULL,
  direction ENUM('inbound', 'outbound') NOT NULL,
  sender_type ENUM('customer', 'admin', 'ai') NOT NULL,
  content TEXT NOT NULL,
  raw_payload JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_conversation FOREIGN KEY (conversation_id) REFERENCES messaging_conversations(id) ON DELETE CASCADE,
  INDEX idx_msg_conversation (conversation_id),
  INDEX idx_msg_created_at (created_at),
  INDEX idx_msg_direction (direction),
  INDEX idx_msg_sender_type (sender_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
