-- Migration 003: Product Discounts, Advance Payments, and Order Amounts
-- Applies to: products, orders, order_items

-- 1. Extend products table with discount and advance payment options
ALTER TABLE products
  ADD COLUMN discount_type ENUM('none', 'percentage', 'fixed') NOT NULL DEFAULT 'none' AFTER discount_price,
  ADD COLUMN discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER discount_type,
  ADD COLUMN advance_payment_type ENUM('none', 'thirty_percent', 'fifty_percent', 'full', 'delivery_charge') NOT NULL DEFAULT 'none' AFTER discount_value;

-- 2. Extend orders table with advance and due tracking
ALTER TABLE orders
  ADD COLUMN advance_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER total_amount,
  ADD COLUMN due_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER advance_amount,
  ADD COLUMN advance_payment_status ENUM('unpaid', 'paid', 'partially_paid') NOT NULL DEFAULT 'unpaid' AFTER payment_status;

-- 3. Extend order_items table with item-level advance amount
ALTER TABLE order_items
  ADD COLUMN advance_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER line_total;
