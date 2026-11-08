USE ecommerce_db;

-- 1. Users (Verified bcrypt hashes)
-- 'Admin@123'    -> $2a$10$aegSxTb6QD7JzcmRciQAgOMPFCjf9ZKVTienViKPWlaOZ4MHEn7o2
-- 'Customer@123' -> $2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa
-- 'Admin@2026'   -> $2a$10$j/MAIAtsFiJhPPegiuaycufcnxA9dJAIYMqb1wwpARLss1hq5sOsy
-- 'User@2026'    -> $2a$10$2U/VVYRqv2jw7sLMkmH/QOrtkdmAuaKNjtJTv80WOpjJEO4Vsg.Nu
INSERT INTO users (id, full_name, email, password_hash, phone, role, is_active)
VALUES
  (1, 'Store Admin', 'admin@mavllin.com', '$2a$10$aegSxTb6QD7JzcmRciQAgOMPFCjf9ZKVTienViKPWlaOZ4MHEn7o2', '+8801711000001', 'admin', 1),
  (2, 'Jane Customer', 'jane.customer@example.com', '$2a$10$aegSxTb6QD7JzcmRciQAgOMPFCjf9ZKVTienViKPWlaOZ4MHEn7o2', '+8801711000002', 'customer', 1),
  (3, 'MAVLLIN Atelier Admin', 'admin@mavllin.local', '$2a$10$aegSxTb6QD7JzcmRciQAgOMPFCjf9ZKVTienViKPWlaOZ4MHEn7o2', '+8801711000003', 'admin', 1),
  (4, 'Rahim Ahmed', 'customer@mavllin.com', '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa', '+8801819223344', 'customer', 1),
  (5, 'Nabil Admin', 'admin@shop.com', '$2a$10$j/MAIAtsFiJhPPegiuaycufcnxA9dJAIYMqb1wwpARLss1hq5sOsy', '+8801711000005', 'admin', 1),
  (6, 'Nabil Client', 'user@shop.com', '$2a$10$2U/VVYRqv2jw7sLMkmH/QOrtkdmAuaKNjtJTv80WOpjJEO4Vsg.Nu', '+8801711000006', 'customer', 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash), role = VALUES(role), is_active = VALUES(is_active);

-- 2. Saved Customer Addresses
INSERT INTO addresses (id, user_id, label, recipient_name, phone, street_address, area, city, state, postal_code, country, is_default)
VALUES
  (1, 2, 'Home', 'Jane Customer', '+8801711000002', 'House 14, Road 11, Banani', 'Banani', 'Dhaka', 'Dhaka Division', '1213', 'Bangladesh', 1),
  (2, 4, 'Home', 'Rahim Ahmed', '+8801819223344', 'Flat 4B, House 32, Dhanmondi 27', 'Dhanmondi', 'Dhaka', 'Dhaka Division', '1209', 'Bangladesh', 1),
  (3, 4, 'Office', 'Rahim Ahmed', '+8801819223344', 'Agrabad Commercial Area, Tower 3', 'Agrabad', 'Chattogram', 'Chattogram Division', '4100', 'Bangladesh', 0)
ON DUPLICATE KEY UPDATE street_address = VALUES(street_address);

-- 3. Fashion Apparel Categories (Parent & Child Hierarchy)
INSERT INTO categories (id, parent_id, name, slug, description, image_url, is_active)
VALUES
  (1, NULL, 'Men''s Apparel', 'mens-apparel', 'Sustainable everyday menswear essentials, tailored shirts, and streetwear', '/uploads/products/cat-mens.svg', 1),
  (2, NULL, 'Women''s Apparel', 'womens-apparel', 'Contemporary silhouettes and effortless everyday fashion for women', '/uploads/products/cat-womens.svg', 1),
  (3, NULL, 'Unisex Basics', 'unisex-basics', 'Timeless gender-neutral staples engineered for comfort and longevity', '/uploads/products/cat-unisex.svg', 1),
  (4, 1, 'Men''s T-Shirts & Polos', 'mens-tshirts', 'Organic cotton crewnecks, heavyweight oversized tees, and pique polos', '/uploads/products/prod-crewneck-1.svg', 1),
  (5, 1, 'Men''s Hoodies & Sweats', 'mens-hoodies', 'Heavyweight French terry hoodies, shackets, and fleece sweatshirts', '/uploads/products/prod-hoodie-1.svg', 1),
  (6, 1, 'Men''s Denim & Pants', 'mens-jeans', 'Selvedge denim, tailored chinos, and relaxed cargo utility trousers', '/uploads/products/prod-jeans-1.svg', 1),
  (7, 2, 'Women''s Tops & Shirts', 'womens-tops', 'Relaxed European flax linen shirts, ribbed modal tees, and knitwear', '/uploads/products/prod-linen-1.svg', 1),
  (8, 2, 'Women''s Jeans & Trousers', 'womens-jeans', 'High-rise vintage straight leg denim and wide-leg tailored trousers', '/uploads/products/prod-wjeans-1.svg', 1),
  (9, 3, 'Mavllin Fleece Outerwear', 'mavllin-fleece-hoodies', 'Recycled cotton and fleece outerwear in architectural neutral tones', '/uploads/products/prod-zip-1.svg', 1),
  (10, 1, 'Heritage Panjabi', 'mens-panjabi', 'Artisanal textured cotton and festive embroidered panjabis crafted in Dhaka', '/uploads/products/prod-panjabi-1.svg', 1),
  (11, 1, 'Tailored Shirts', 'mens-shirts', 'Structured linen over-shirts, casual Cuban collars, and crisp formal shirts', '/uploads/products/prod-overshirt-1.svg', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), image_url = VALUES(image_url);

-- 4. Products Catalog
INSERT INTO products (id, category_id, name, slug, sku, short_description, description, base_price, price, discount_price, thumbnail_url, is_featured, is_active)
VALUES
  (
    1, 4,
    'Organic Classic Crewneck T-Shirt',
    'organic-classic-crewneck-tee',
    'MAV-TEE-WHT-S',
    '100% certified organic combed cotton crewneck tee with a relaxed modern fit.',
    'Engineered for everyday wear, this classic tee is spun from 180 GSM ring-spun organic cotton. Pre-shrunk and garment-dyed for maximum softness and minimal environmental footprint.',
    1250.00, 1250.00, NULL,
    '/uploads/products/prod-crewneck-1.svg',
    1, 1
  ),
  (
    2, 5,
    'Heavyweight French Terry Hoodie',
    'heavyweight-french-terry-hoodie',
    'MAV-HOD-BLK-S',
    '450 GSM French terry cotton pullover hoodie with ribbed side gussets.',
    'A substantial luxury hoodie built to last decades. Features double-needle coverstitch seams, a structured double-layer hood, and a custom kangaroo front pocket.',
    2850.00, 2850.00, NULL,
    '/uploads/products/prod-hoodie-1.svg',
    1, 1
  ),
  (
    3, 6,
    'Selvedge Raw Slim-Taper Denim Jeans',
    'selvedge-raw-slim-taper-jeans',
    'MAV-JNS-IND-30',
    '13.5oz Japanese shuttle-loom selvedge raw denim with classic red-line ID.',
    'Pure indigo dyed shuttle-woven denim. Will develop custom fades and honeycombs with wear. Features copper hardware, reinforced pocket bags, and clean slim-taper silhouette.',
    4200.00, 4200.00, NULL,
    '/uploads/products/prod-jeans-1.svg',
    1, 1
  ),
  (
    4, 7,
    'Women''s Relaxed Linen-Blend Shirt',
    'womens-relaxed-linen-shirt',
    'MAV-LIN-WHT-XS',
    'Breathable European flax linen-cotton blend button-down with dropped shoulders.',
    'Tailored for effortless casual elegance. Features mother-of-pearl buttons, a curved hemline, and natural temperature-regulating linen fibers.',
    2150.00, 2150.00, NULL,
    '/uploads/products/prod-linen-1.svg',
    1, 1
  ),
  (
    5, 8,
    'Women''s High-Rise Vintage Straight Jeans',
    'womens-high-rise-straight-jeans',
    'MAV-WJN-LGT-26',
    'Flattering 11-inch high rise with straight leg silhouette in organic comfort stretch denim.',
    'The quintessential vintage jean remastered. 12oz organic cotton with 1% elastane for just the right amount of ease.',
    3450.00, 3450.00, NULL,
    '/uploads/products/prod-wjeans-1.svg',
    1, 1
  ),
  (
    6, 9,
    'Unisex MAVLLIN Recycled Zip Hoodie',
    'unisex-eco-recycled-zip-hoodie',
    'MAV-ZIP-GRY-S',
    'Eco-conscious full-zip fleece hoodie crafted from 60% recycled cotton and 40% recycled poly.',
    'Plush brushed interior meets a smooth anti-pill face. Equipped with an antique brass YKK zipper and double-drawcord hood.',
    3150.00, 3150.00, NULL,
    '/uploads/products/prod-zip-1.svg',
    1, 1
  ),
  (
    7, 7,
    'Essential Ribbed Long Sleeve Tee',
    'essential-ribbed-long-sleeve-tee',
    'MAV-RIB-IVR-S',
    'Ultra-soft micro-rib modal knit with contouring fit and crew neckline.',
    'A luxurious base layer made from sustainable beechwood modal. Breathable, stretchy, and silky against the skin.',
    1450.00, 1450.00, NULL,
    '/uploads/products/prod-ribbed-1.svg',
    0, 1
  ),
  (
    8, 6,
    'Cargo Utility Relaxed Pants',
    'cargo-utility-relaxed-pants',
    'MAV-CRG-OLV-32',
    'Durable ripstop cotton pants with articulated knees and deep side bellows pockets.',
    'Modern tactical utility meeting relaxed street fashion. Features drawcord cuffs and reinforced seat stitching.',
    3250.00, 3250.00, NULL,
    '/uploads/products/prod-cargo-1.svg',
    0, 1
  ),
  (
    9, 10,
    'Artisanal Textured Cotton Panjabi',
    'artisanal-textured-cotton-panjabi',
    'MAV-PNJ-MID-M',
    'Hand-loomed jacquard cotton Panjabi with minimalist tonal collar embroidery.',
    'Inspired by contemporary Bangladeshi craftsmanship. Tailored in breathable 100%slub cotton with concealed placket buttons, side seam pockets, and crisp mandarin collar.',
    3850.00, 3850.00, NULL,
    '/uploads/products/prod-panjabi-1.svg',
    1, 1
  ),
  (
    10, 11,
    'Structured Linen Over-Shirt',
    'structured-linen-overshirt',
    'MAV-OVR-SND-M',
    'Architectural boxy-fit linen-twill overshirt designed for tropical layering.',
    'Woven from heavy 240 GSM linen-cotton twill with dual chest utility pockets and corozo nut buttons. Transitions effortlessly from daytime casual to evening smart wear.',
    2750.00, 2750.00, NULL,
    '/uploads/products/prod-overshirt-1.svg',
    1, 1
  ),
  (
    11, 6,
    'Pleated Wide-Leg Chino Trousers',
    'pleated-wide-leg-chino-trousers',
    'MAV-CHN-STN-30',
    'Double-pleated organic cotton twill trousers with a relaxed tailored drape.',
    'Cut with a comfortable mid-high rise, horn button closure, and clean blind-stitched hem. Enzyme-washed for a broken-in hand feel from day one.',
    2650.00, 2650.00, NULL,
    '/uploads/products/prod-chino-1.svg',
    1, 1
  ),
  (
    12, 4,
    'Signature Honeycomb Pique Polo',
    'signature-honeycomb-pique-polo',
    'MAV-PLO-EME-M',
    'Breathable 220 GSM organic pique knit polo with anti-curl flat-knit collar.',
    'Refined smart-casual staple featuring two-button placket, split-tail side vents, and subtle tonal stitch detailing.',
    1650.00, 1650.00, NULL,
    '/uploads/products/prod-polo-1.svg',
    0, 1
  )
ON DUPLICATE KEY UPDATE name = VALUES(name), sku = VALUES(sku), base_price = VALUES(base_price), price = VALUES(price), thumbnail_url = VALUES(thumbnail_url);

-- 5. Product Gallery Images (Dual-Image Hover Support)
INSERT INTO product_images (id, product_id, image_url, alt_text, sort_order)
VALUES
  (1, 1, '/uploads/products/prod-crewneck-1.svg', 'Organic Classic Crewneck Tee Front', 0),
  (2, 1, '/uploads/products/prod-crewneck-2.svg', 'Organic Classic Crewneck Tee Back Detail', 1),
  (3, 2, '/uploads/products/prod-hoodie-1.svg', 'Heavyweight French Terry Hoodie Front', 0),
  (4, 2, '/uploads/products/prod-hoodie-2.svg', 'Heavyweight French Terry Hoodie Fit View', 1),
  (5, 3, '/uploads/products/prod-jeans-1.svg', 'Selvedge Raw Slim-Taper Denim Front', 0),
  (6, 3, '/uploads/products/prod-jeans-2.svg', 'Selvedge Denim Red-Line Detail', 1),
  (7, 4, '/uploads/products/prod-linen-1.svg', 'Relaxed Linen Shirt Front', 0),
  (8, 4, '/uploads/products/prod-linen-2.svg', 'Relaxed Linen Shirt Drape View', 1),
  (9, 5, '/uploads/products/prod-wjeans-1.svg', 'High-Rise Vintage Straight Jeans Front', 0),
  (10, 6, '/uploads/products/prod-zip-1.svg', 'Unisex Eco Recycled Zip Hoodie Front', 0),
  (11, 7, '/uploads/products/prod-ribbed-1.svg', 'Essential Ribbed Long Sleeve Tee Front', 0),
  (12, 8, '/uploads/products/prod-cargo-1.svg', 'Cargo Utility Relaxed Pants Front', 0),
  (13, 9, '/uploads/products/prod-panjabi-1.svg', 'Artisanal Textured Cotton Panjabi Front', 0),
  (14, 9, '/uploads/products/prod-panjabi-2.svg', 'Artisanal Textured Cotton Panjabi Collar Detail', 1),
  (15, 10, '/uploads/products/prod-overshirt-1.svg', 'Structured Linen Over-Shirt Front', 0),
  (16, 10, '/uploads/products/prod-overshirt-2.svg', 'Structured Linen Over-Shirt Layered Look', 1),
  (17, 11, '/uploads/products/prod-chino-1.svg', 'Pleated Wide-Leg Chino Trousers Front', 0),
  (18, 12, '/uploads/products/prod-polo-1.svg', 'Signature Honeycomb Pique Polo Front', 0)
ON DUPLICATE KEY UPDATE image_url = VALUES(image_url), sort_order = VALUES(sort_order);

-- 6. Product Variants (Multi-Size, Multi-Color with Stock, Low-Stock & Out-of-Stock Cases)
INSERT INTO product_variants (id, product_id, sku, size, color, price, compare_at_price, stock_quantity, is_active)
VALUES
  -- 1. Organic Classic Crewneck T-Shirt Variants
  (1,  1, 'MAV-TEE-WHT-S',   'S',   'Vintage White', 1250.00, 1500.00, 45, 1),
  (2,  1, 'MAV-TEE-WHT-M',   'M',   'Vintage White', 1250.00, 1500.00, 60, 1),
  (3,  1, 'MAV-TEE-WHT-L',   'L',   'Vintage White', 1250.00, 1500.00, 50, 1),
  (4,  1, 'MAV-TEE-BLK-S',   'S',   'Washed Black',  1250.00, 1500.00, 40, 1),
  (5,  1, 'MAV-TEE-BLK-M',   'M',   'Washed Black',  1250.00, 1500.00, 75, 1),
  (6,  1, 'MAV-TEE-BLK-L',   'L',   'Washed Black',  1250.00, 1500.00, 55, 1),
  (7,  1, 'MAV-TEE-NVY-M',   'M',   'Navy Blue',     1250.00, NULL,    30, 1),
  (8,  1, 'MAV-TEE-NVY-L',   'L',   'Navy Blue',     1250.00, NULL,    25, 1),

  -- 2. Heavyweight French Terry Hoodie Variants
  (9,  2, 'MAV-HOD-BLK-S',   'S',   'Washed Black',  2850.00, 3400.00, 25, 1),
  (10, 2, 'MAV-HOD-BLK-M',   'M',   'Washed Black',  2850.00, 3400.00, 40, 1),
  (11, 2, 'MAV-HOD-BLK-L',   'L',   'Washed Black',  2850.00, 3400.00, 35, 1),
  (12, 2, 'MAV-HOD-BLK-XL',  'XL',  'Washed Black',  2850.00, 3400.00, 3,  1),
  (13, 2, 'MAV-HOD-GRY-M',   'M',   'Heather Grey',  2850.00, 3400.00, 30, 1),
  (14, 2, 'MAV-HOD-GRY-L',   'L',   'Heather Grey',  2850.00, 3400.00, 30, 1),

  -- 3. Selvedge Raw Slim-Taper Denim Jeans Variants
  (15, 3, 'MAV-JNS-IND-30',  '30',  'Raw Indigo',    4200.00, 4800.00, 20, 1),
  (16, 3, 'MAV-JNS-IND-32',  '32',  'Raw Indigo',    4200.00, 4800.00, 35, 1),
  (17, 3, 'MAV-JNS-IND-34',  '34',  'Raw Indigo',    4200.00, 4800.00, 25, 1),
  (18, 3, 'MAV-JNS-BLK-32',  '32',  'Solid Black',   4200.00, NULL,    4,  1),

  -- 4. Women's Relaxed Linen-Blend Shirt Variants
  (19, 4, 'MAV-LIN-WHT-XS',  'XS',  'Crisp White',   2150.00, 2600.00, 25, 1),
  (20, 4, 'MAV-LIN-WHT-S',   'S',   'Crisp White',   2150.00, 2600.00, 35, 1),
  (21, 4, 'MAV-LIN-WHT-M',   'M',   'Crisp White',   2150.00, 2600.00, 30, 1),
  (22, 4, 'MAV-LIN-SGE-S',   'S',   'Sage Green',    2150.00, NULL,    20, 1),
  (23, 4, 'MAV-LIN-SGE-M',   'M',   'Sage Green',    2150.00, NULL,    25, 1),

  -- 5. Women's High-Rise Vintage Straight Jeans Variants
  (24, 5, 'MAV-WJN-LGT-26',  '26',  'Light Wash',    3450.00, 3900.00, 20, 1),
  (25, 5, 'MAV-WJN-LGT-28',  '28',  'Light Wash',    3450.00, 3900.00, 30, 1),
  (26, 5, 'MAV-WJN-LGT-30',  '30',  'Light Wash',    3450.00, 3900.00, 25, 1),
  (27, 5, 'MAV-WJN-MED-28',  '28',  'Vintage Medium', 3450.00, 3900.00, 25, 1),

  -- 6. Unisex MAVLLIN Recycled Zip Hoodie Variants
  (28, 6, 'MAV-ZIP-GRY-S',   'S',   'Heather Grey',  3150.00, 3600.00, 25, 1),
  (29, 6, 'MAV-ZIP-GRY-M',   'M',   'Heather Grey',  3150.00, 3600.00, 40, 1),
  (30, 6, 'MAV-ZIP-GRY-L',   'L',   'Heather Grey',  3150.00, 3600.00, 35, 1),

  -- 7. Essential Ribbed Long Sleeve Tee Variants
  (31, 7, 'MAV-RIB-IVR-S',   'S',   'Ivory',         1450.00, NULL,    30, 1),
  (32, 7, 'MAV-RIB-IVR-M',   'M',   'Ivory',         1450.00, NULL,    35, 1),

  -- 8. Cargo Utility Relaxed Pants Variants
  (33, 8, 'MAV-CRG-OLV-32',  '32',  'Olive Green',   3250.00, 3800.00, 30, 1),
  (34, 8, 'MAV-CRG-OLV-34',  '34',  'Olive Green',   3250.00, 3800.00, 25, 1),

  -- 9. Artisanal Textured Cotton Panjabi Variants
  (35, 9, 'MAV-PNJ-MID-M',   'M',   'Midnight Navy', 3850.00, 4500.00, 28, 1),
  (36, 9, 'MAV-PNJ-MID-L',   'L',   'Midnight Navy', 3850.00, 4500.00, 32, 1),
  (37, 9, 'MAV-PNJ-MID-XL',  'XL',  'Midnight Navy', 3850.00, 4500.00, 18, 1),
  (38, 9, 'MAV-PNJ-IVR-M',   'M',   'Ivory Sand',    3850.00, 4500.00, 22, 1),
  (39, 9, 'MAV-PNJ-IVR-L',   'L',   'Ivory Sand',    3850.00, 4500.00, 0,  1),

  -- 10. Structured Linen Over-Shirt Variants
  (40, 10, 'MAV-OVR-SND-M',  'M',   'Warm Sand',     2750.00, 3200.00, 24, 1),
  (41, 10, 'MAV-OVR-SND-L',  'L',   'Warm Sand',     2750.00, 3200.00, 19, 1),
  (42, 10, 'MAV-OVR-CHA-L',  'L',   'Charcoal',      2750.00, 3200.00, 2,  1),

  -- 11. Pleated Wide-Leg Chino Trousers Variants
  (43, 11, 'MAV-CHN-STN-30', '30',  'Stone Khaki',   2650.00, NULL,    20, 1),
  (44, 11, 'MAV-CHN-STN-32', '32',  'Stone Khaki',   2650.00, NULL,    26, 1),
  (45, 11, 'MAV-CHN-ESP-32', '32',  'Espresso',      2650.00, NULL,    15, 1),

  -- 12. Signature Honeycomb Pique Polo Variants
  (46, 12, 'MAV-PLO-EME-M',  'M',   'Forest Emerald', 1650.00, 1950.00, 30, 1),
  (47, 12, 'MAV-PLO-EME-L',  'L',   'Forest Emerald', 1650.00, 1950.00, 28, 1),
  (48, 12, 'MAV-PLO-BLK-M',  'M',   'Jet Black',      1650.00, 1950.00, 34, 1)
ON DUPLICATE KEY UPDATE sku = VALUES(sku), price = VALUES(price), compare_at_price = VALUES(compare_at_price), stock_quantity = VALUES(stock_quantity);

-- 7. Initial Inventory Movements (Stock Intake Audit Log)
INSERT INTO inventory_movements (variant_id, quantity_delta, before_quantity, after_quantity, reason, note, actor_id, reference_order_id)
SELECT id, stock_quantity, 0, stock_quantity, 'initial_stock', 'Initial seasonal inventory intake', 1, NULL
FROM product_variants
WHERE id BETWEEN 1 AND 48
ON DUPLICATE KEY UPDATE after_quantity = VALUES(after_quantity);

-- 8. Promotional Coupons
INSERT INTO coupons (id, code, discount_type, discount_value, min_order_amount, usage_limit, is_active)
VALUES
  (1, 'WELCOME10', 'percentage', 10.00, 1500.00, 1000, 1),
  (2, 'FASHION20', 'percentage', 20.00, 4000.00, 500, 1),
  (3, 'FREESHIP15', 'fixed', 150.00, 2000.00, 500, 1)
ON DUPLICATE KEY UPDATE discount_value = VALUES(discount_value), min_order_amount = VALUES(min_order_amount);

-- 9. Promotional Hero Banners
INSERT INTO banners (id, title, subtitle, badge_text, cta_text, cta_link, image_url, sort_order, is_active)
VALUES
  (1, 'AUTUMN / FESTIVE EDIT 2026', 'Architectural tailoring meets sustainable organic textiles crafted for modern Dhaka living.', 'NEW SEASON DROP', 'Shop New Arrivals', '/catalog?sort=newest', '/uploads/products/banner-hero-1.svg', 0, 1),
  (2, 'ARTISANAL HERITAGE PANJABI', 'Hand-finished jacquard and breathable slub cotton silhouettes in refined earth & midnight tones.', 'LIMITED EDITION', 'Explore Panjabi', '/catalog?categorySlug=mens-panjabi', '/uploads/products/banner-hero-2.svg', 1, 1),
  (3, 'ESSENTIAL HEAVYWEIGHT FLEECE', '450 GSM French terry and recycled cotton outerwear engineered to endure.', 'CORE STAPLES', 'Shop Outerwear', '/catalog?categorySlug=mens-hoodies', '/uploads/products/banner-hero-3.svg', 2, 1)
ON DUPLICATE KEY UPDATE title = VALUES(title), subtitle = VALUES(subtitle);

-- 10. Customer Reviews
INSERT INTO reviews (id, product_id, user_id, rating, comment)
VALUES
  (1, 1, 2, 5, 'Incredible fabric weight and drape. Washed three times and holds its collar structure like day one.'),
  (2, 2, 4, 5, 'Hands down the best heavyweight hoodie I own. The 450 GSM French terry feels genuinely luxury.'),
  (3, 9, 4, 5, 'Wore the Midnight Navy Panjabi to a family dinner in Banani—breathable cotton and razor-sharp collar detailing.'),
  (4, 4, 2, 4, 'Airy linen blend that works wonderfully in warm weather. Relaxed fit, true to size.')
ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment);

-- 11. Sample Historical Orders (Populates Dashboard Metrics & Order History)
INSERT INTO orders (id, order_number, user_id, coupon_id, subtotal, discount_amount, shipping_fee, total_amount, status, payment_method, payment_status, shipping_address, notes, courier_name, tracking_number)
VALUES
  (
    1, 'MAV-20261101-1001', 2, 1,
    4100.00, 410.00, 0.00, 3690.00,
    'delivered', 'cash_on_delivery', 'paid',
    '{"recipient_name":"Jane Customer","phone":"+8801711000002","street_address":"House 14, Road 11, Banani","area":"Banani","city":"Dhaka","postal_code":"1213","country":"Bangladesh"}',
    'Leave with building concierge', 'Pathao Courier', 'PTH-BD-884120'
  ),
  (
    2, 'MAV-20261102-1002', 4, NULL,
    6600.00, 0.00, 0.00, 6600.00,
    'shipped', 'cash_on_delivery', 'paid',
    '{"recipient_name":"Rahim Ahmed","phone":"+8801819223344","street_address":"Flat 4B, House 32, Dhanmondi 27","area":"Dhanmondi","city":"Dhaka","postal_code":"1209","country":"Bangladesh"}',
    NULL, 'Steadfast Express', 'STF-DH-992311'
  ),
  (
    3, 'MAV-20261103-1003', 4, NULL,
    1650.00, 0.00, 70.00, 1720.00,
    'pending', 'cash_on_delivery', 'unpaid',
    '{"recipient_name":"Rahim Ahmed","phone":"+8801819223344","street_address":"Flat 4B, House 32, Dhanmondi 27","area":"Dhanmondi","city":"Dhaka","postal_code":"1209","country":"Bangladesh"}',
    'Call before delivery', NULL, NULL
  )
ON DUPLICATE KEY UPDATE status = VALUES(status), payment_method = VALUES(payment_method), payment_status = VALUES(payment_status);

INSERT INTO order_items (id, order_id, product_id, variant_id, product_name, variant_sku, variant_size, size, variant_color, color, unit_price, quantity, line_total, subtotal)
VALUES
  (1, 1, 1, 2,  'Organic Classic Crewneck T-Shirt', 'MAV-TEE-WHT-M', 'M', 'M', 'Vintage White', 'Vintage White', 1250.00, 1, 1250.00, 1250.00),
  (2, 1, 2, 10, 'Heavyweight French Terry Hoodie',  'MAV-HOD-BLK-M', 'M', 'M', 'Washed Black',  'Washed Black',  2850.00, 1, 2850.00, 2850.00),
  (3, 2, 9, 36, 'Artisanal Textured Cotton Panjabi','MAV-PNJ-MID-L', 'L', 'L', 'Midnight Navy', 'Midnight Navy', 3850.00, 1, 3850.00, 3850.00),
  (4, 2, 10, 40,'Structured Linen Over-Shirt',      'MAV-OVR-SND-M', 'M', 'M', 'Warm Sand',     'Warm Sand',     2750.00, 1, 2750.00, 2750.00),
  (5, 3, 12, 46,'Signature Honeycomb Pique Polo',   'MAV-PLO-EME-M', 'M', 'M', 'Forest Emerald', 'Forest Emerald', 1650.00, 1, 1650.00, 1650.00)
ON DUPLICATE KEY UPDATE line_total = VALUES(line_total), subtotal = VALUES(subtotal);

INSERT INTO payments (id, order_id, provider, transaction_id, amount, status, paid_at)
VALUES
  (1, 1, 'sslcommerz', 'SSLCZ-20261101-A901', 3690.00, 'succeeded', NOW()),
  (2, 2, 'bkash',      'BKASH-20261102-B412', 6600.00, 'succeeded', NOW()),
  (3, 3, 'cod',        NULL,                  1720.00, 'pending',   NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO order_status_history (id, order_id, previous_status, new_status, actor_id, note)
VALUES
  (1, 1, NULL, 'pending', 2, 'Order placed online'),
  (2, 1, 'pending', 'confirmed', 1, 'Payment verified via SSLCommerz'),
  (3, 1, 'confirmed', 'shipped', 1, 'Dispatched via Pathao Courier (PTH-BD-884120)'),
  (4, 1, 'shipped', 'delivered', 1, 'Delivered to recipient'),
  (5, 2, NULL, 'pending', 4, 'Order placed online'),
  (6, 2, 'pending', 'confirmed', 1, 'bKash payment verified'),
  (7, 2, 'confirmed', 'shipped', 1, 'Handed to Steadfast Express'),
  (8, 3, NULL, 'pending', 4, 'Cash on Delivery order placed')
ON DUPLICATE KEY UPDATE note = VALUES(note);

-- 12. Store Settings (MAVLLIN BDT Defaults)
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
