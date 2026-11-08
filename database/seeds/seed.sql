USE ecommerce_db;

-- 1. Users (Admin and Customer)
-- Password for both accounts is 'Admin@123' hashed with bcrypt: $2a$10$CwTycUXWue0Thq9StjUM0uJ8h6bZ6/V.b9x8aQ2rM6sV2L2w7uP4G
INSERT INTO users (id, full_name, email, password_hash, role, is_active)
VALUES 
  (1, 'Store Admin', 'admin@mavllin.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ8h6bZ6/V.b9x8aQ2rM6sV2L2w7uP4G', 'admin', 1),
  (2, 'Jane Customer', 'jane.customer@example.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ8h6bZ6/V.b9x8aQ2rM6sV2L2w7uP4G', 'customer', 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role);

-- 2. Fashion Apparel Categories (Parent & Child Hierarchy)
INSERT INTO categories (id, parent_id, name, slug, description, is_active)
VALUES
  (1, NULL, 'Men''s Apparel', 'mens-apparel', 'Sustainable everyday menswear essentials and streetwear', 1),
  (2, NULL, 'Women''s Apparel', 'womens-apparel', 'Contemporary, high-quality fashion apparel for women', 1),
  (3, NULL, 'Unisex Basics', 'unisex-basics', 'Timeless gender-neutral staples engineered for comfort and longevity', 1),
  (4, 1, 'Men''s T-Shirts', 'mens-tshirts', 'Organic cotton crewnecks, v-necks, and oversized tees', 1),
  (5, 1, 'Men''s Hoodies & Sweats', 'mens-hoodies', 'Heavyweight French terry hoodies and fleece sweatshirts', 1),
  (6, 1, 'Men''s Denim & Jeans', 'mens-jeans', 'Japanese selvedge and raw denim crafted for durability', 1),
  (7, 2, 'Women''s Tops & Tees', 'womens-tops', 'Relaxed linen shirts, ribbed tees, and knitwear', 1),
  (8, 2, 'Women''s Jeans & Trousers', 'womens-jeans', 'High-rise vintage straight leg and tailored trousers', 1),
  (9, 3, 'Eco Fleece Hoodies', 'eco-fleece-hoodies', 'Recycled cotton and fleece hoodies in neutral colorways', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

-- 3. Products Catalog
INSERT INTO products (id, category_id, name, slug, sku, short_description, description, base_price, price, thumbnail_url, is_featured, is_active)
VALUES
  (
    1, 4,
    'Organic Classic Crewneck T-Shirt',
    'organic-classic-crewneck-tee',
    'ECO-TEE-WHT-S',
    '100% certified organic combed cotton crewneck tee with a relaxed modern fit.',
    'Engineered for everyday wear, this classic tee is spun from 180 GSM ring-spun organic cotton. Pre-shrunk and garment-dyed for maximum softness and minimal environmental footprint.',
    29.99, 29.99,
    '/uploads/products/crewneck-white.jpg',
    1, 1
  ),
  (
    2, 5,
    'Heavyweight French Terry Hoodie',
    'heavyweight-french-terry-hoodie',
    'ECO-HOD-BLK-S',
    '450 GSM French terry cotton pullover hoodie with ribbed side gussets.',
    'A substantial luxury hoodie built to last decades. Features double-needle coverstitch seams, a structured double-layer hood, and a custom kangaroo front pocket.',
    69.99, 69.99,
    '/uploads/products/hoodie-black.jpg',
    1, 1
  ),
  (
    3, 6,
    'Selvedge Raw Slim-Taper Denim Jeans',
    'selvedge-raw-slim-taper-jeans',
    'ECO-JNS-IND-30',
    '13.5oz Japanese shuttle-loom selvedge raw denim with classic red-line ID.',
    'Pure indigo dyed shuttle-woven denim. Will develop custom fades and honeycombs with wear. Features copper hardware, reinforced pocket bags, and clean slim-taper silhouette.',
    119.99, 119.99,
    '/uploads/products/selvedge-indigo.jpg',
    1, 1
  ),
  (
    4, 7,
    'Women''s Relaxed Linen-Blend Shirt',
    'womens-relaxed-linen-shirt',
    'ECO-LIN-WHT-XS',
    'Breathable European flax linen-cotton blend button-down with dropped shoulders.',
    'Tailored for effortless casual elegance. Features mother-of-pearl buttons, a curved hemline, and natural temperature-regulating linen fibers.',
    49.99, 49.99,
    '/uploads/products/linen-white.jpg',
    1, 1
  ),
  (
    5, 8,
    'Women''s High-Rise Vintage Straight Jeans',
    'womens-high-rise-straight-jeans',
    'ECO-WJN-LGT-26',
    'Flattering 11-inch high rise with straight leg silhouette in organic comfort stretch denim.',
    'The quintessential vintage jean remastered. 12oz organic cotton with 1% elastane for just the right amount of ease.',
    89.99, 89.99,
    '/uploads/products/vintage-straight-light.jpg',
    1, 1
  ),
  (
    6, 9,
    'Unisex Eco Recycled Zip Hoodie',
    'unisex-eco-recycled-zip-hoodie',
    'ECO-ZIP-GRY-S',
    'Eco-conscious full-zip fleece hoodie crafted from 60% recycled cotton and 40% recycled poly.',
    'Plush brushed interior meets a smooth anti-pill face. Equipped with an antique brass YKK zipper and double-drawcord hood.',
    74.99, 74.99,
    '/uploads/products/zip-hoodie-grey.jpg',
    1, 1
  ),
  (
    7, 7,
    'Essential Ribbed Long Sleeve Tee',
    'essential-ribbed-long-sleeve-tee',
    'ECO-RIB-IVR-S',
    'Ultra-soft micro-rib modal knit with contouring fit and crew neckline.',
    'A luxurious base layer made from sustainable beechwood modal. Breathable, stretchy, and silky against the skin.',
    34.99, 34.99,
    '/uploads/products/ribbed-tee-ivory.jpg',
    0, 1
  ),
  (
    8, 1,
    'Cargo Utility Relaxed Pants',
    'cargo-utility-relaxed-pants',
    'ECO-CRG-OLV-32',
    'Durable ripstop cotton pants with articulated knees and deep side bellows pockets.',
    'Modern tactical utility meeting relaxed street fashion. Features drawcord cuffs and reinforced seat stitching.',
    79.99, 79.99,
    '/uploads/products/cargo-olive.jpg',
    0, 1
  )
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), price = VALUES(price);

-- 4. Product Variants (Multi-Size, Multi-Color with Stock & Pricing)
INSERT INTO product_variants (id, product_id, sku, size, color, price, compare_at_price, stock_quantity, is_active)
VALUES
  -- 1. Organic Classic Crewneck T-Shirt Variants
  (1,  1, 'ECO-TEE-WHT-S',   'S',  'Vintage White', 29.99, 35.00, 45, 1),
  (2,  1, 'ECO-TEE-WHT-M',   'M',  'Vintage White', 29.99, 35.00, 60, 1),
  (3,  1, 'ECO-TEE-WHT-L',   'L',  'Vintage White', 29.99, 35.00, 50, 1),
  (4,  1, 'ECO-TEE-BLK-S',   'S',  'Washed Black',  29.99, 35.00, 40, 1),
  (5,  1, 'ECO-TEE-BLK-M',   'M',  'Washed Black',  29.99, 35.00, 75, 1),
  (6,  1, 'ECO-TEE-BLK-L',   'L',  'Washed Black',  29.99, 35.00, 55, 1),
  (7,  1, 'ECO-TEE-NVY-M',   'M',  'Navy Blue',     29.99, NULL,  30, 1),
  (8,  1, 'ECO-TEE-NVY-L',   'L',  'Navy Blue',     29.99, NULL,  25, 1),

  -- 2. Heavyweight French Terry Hoodie Variants
  (9,  2, 'ECO-HOD-BLK-S',   'S',  'Washed Black',  69.99, 85.00, 25, 1),
  (10, 2, 'ECO-HOD-BLK-M',   'M',  'Washed Black',  69.99, 85.00, 40, 1),
  (11, 2, 'ECO-HOD-BLK-L',   'L',  'Washed Black',  69.99, 85.00, 35, 1),
  (12, 2, 'ECO-HOD-BLK-XL',  'XL', 'Washed Black',  69.99, 85.00, 20, 1),
  (13, 2, 'ECO-HOD-GRY-M',   'M',  'Heather Grey',  69.99, 85.00, 30, 1),
  (14, 2, 'ECO-HOD-GRY-L',   'L',  'Heather Grey',  69.99, 85.00, 30, 1),

  -- 3. Selvedge Raw Slim-Taper Denim Jeans Variants
  (15, 3, 'ECO-JNS-IND-30',  '30', 'Raw Indigo',    119.99, 140.00, 20, 1),
  (16, 3, 'ECO-JNS-IND-32',  '32', 'Raw Indigo',    119.99, 140.00, 35, 1),
  (17, 3, 'ECO-JNS-IND-34',  '34', 'Raw Indigo',    119.99, 140.00, 25, 1),
  (18, 3, 'ECO-JNS-BLK-32',  '32', 'Solid Black',   119.99, NULL,   20, 1),

  -- 4. Women's Relaxed Linen-Blend Shirt Variants
  (19, 4, 'ECO-LIN-WHT-XS',  'XS', 'Crisp White',   49.99, 60.00, 25, 1),
  (20, 4, 'ECO-LIN-WHT-S',   'S',  'Crisp White',   49.99, 60.00, 35, 1),
  (21, 4, 'ECO-LIN-WHT-M',   'M',  'Crisp White',   49.99, 60.00, 30, 1),
  (22, 4, 'ECO-LIN-SGE-S',   'S',  'Sage Green',    49.99, NULL,  20, 1),
  (23, 4, 'ECO-LIN-SGE-M',   'M',  'Sage Green',    49.99, NULL,  25, 1),

  -- 5. Women's High-Rise Vintage Straight Jeans Variants
  (24, 5, 'ECO-WJN-LGT-26',  '26', 'Light Wash',    89.99, 105.00, 20, 1),
  (25, 5, 'ECO-WJN-LGT-28',  '28', 'Light Wash',    89.99, 105.00, 30, 1),
  (26, 5, 'ECO-WJN-LGT-30',  '30', 'Light Wash',    89.99, 105.00, 25, 1),
  (27, 5, 'ECO-WJN-MED-28',  '28', 'Vintage Medium', 89.99, 105.00, 25, 1),

  -- 6. Unisex Eco Recycled Zip Hoodie Variants
  (28, 6, 'ECO-ZIP-GRY-S',   'S',  'Heather Grey',  74.99, 90.00, 25, 1),
  (29, 6, 'ECO-ZIP-GRY-M',   'M',  'Heather Grey',  74.99, 90.00, 40, 1),
  (30, 6, 'ECO-ZIP-GRY-L',   'L',  'Heather Grey',  74.99, 90.00, 35, 1),

  -- 7. Essential Ribbed Long Sleeve Tee Variants
  (31, 7, 'ECO-RIB-IVR-S',   'S',  'Ivory',         34.99, NULL,  30, 1),
  (32, 7, 'ECO-RIB-IVR-M',   'M',  'Ivory',         34.99, NULL,  35, 1),

  -- 8. Cargo Utility Relaxed Pants Variants
  (33, 8, 'ECO-CRG-OLV-32',  '32', 'Olive Green',   79.99, 95.00, 30, 1),
  (34, 8, 'ECO-CRG-OLV-34',  '34', 'Olive Green',   79.99, 95.00, 25, 1)
ON DUPLICATE KEY UPDATE price = VALUES(price), stock_quantity = VALUES(stock_quantity);

-- 5. Initial Inventory Movements (Stock Intake Audit Log)
INSERT INTO inventory_movements (variant_id, quantity_delta, before_quantity, after_quantity, reason, actor_id, reference_order_id)
SELECT id, stock_quantity, 0, stock_quantity, 'initial_stock', 1, NULL
FROM product_variants
WHERE id BETWEEN 1 AND 34
ON DUPLICATE KEY UPDATE after_quantity = VALUES(after_quantity);

-- 6. Sample Promotional Coupons
INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, is_active)
VALUES
  ('WELCOME10', 'percentage', 10.00, 30.00, 1000, 1),
  ('FASHION20', 'percentage', 20.00, 100.00, 500, 1),
  ('FREESHIP15', 'fixed', 15.00, 50.00, 500, 1)
ON DUPLICATE KEY UPDATE discount_value = VALUES(discount_value), min_order_amount = VALUES(min_order_amount);
