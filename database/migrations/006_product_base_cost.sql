-- Migration 006: Add base_cost to products table for inventory investment and profit calculations
-- Milestone 8: Profit and Total Investment metrics in Admin Dashboard Overview

ALTER TABLE products
  ADD COLUMN base_cost DECIMAL(10, 2) DEFAULT NULL AFTER description;
