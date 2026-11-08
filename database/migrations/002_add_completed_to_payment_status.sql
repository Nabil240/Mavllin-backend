-- Migration 002: Add 'completed' to payments.status ENUM
-- Supports manual mobile payment verification for bKash, Nagad, Rocket, Upay, and COD
-- Previous ENUM: 'pending', 'succeeded', 'failed', 'refunded'
-- New ENUM: 'pending', 'succeeded', 'completed', 'failed', 'refunded'

ALTER TABLE payments
  MODIFY COLUMN status ENUM('pending', 'succeeded', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending';
