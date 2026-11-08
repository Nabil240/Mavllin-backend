const { pool } = require('../config/db');

const DEFAULT_SETTINGS = {
  site_name: 'MAVLLIN',
  site_tagline: 'DHAKA • CONTEMPORARY ATELIER',
  meta_title: 'MAVLLIN — Contemporary Fashion & Heritage Essentials',
  meta_description:
    'MAVLLIN — Minimalist contemporary fashion, heritage panjabi, tailored menswear, womenswear, and everyday luxury essentials crafted in Dhaka, Bangladesh.',
  meta_keywords:
    'MAVLLIN, Bangladesh fashion, Dhaka clothing brand, heritage panjabi, menswear, womenswear, cash on delivery Bangladesh',
  delivery_charge_inside_dhaka: 70.0,
  delivery_charge_outside_dhaka: 130.0,
  free_shipping_threshold: 2500.0,
  announcement_text:
    'COMPLIMENTARY DELIVERY ON ORDERS OVER ৳2,500 • USE CODE WELCOME10 FOR 10% OFF • CASH ON DELIVERY NATIONWIDE',
  support_phone: '+880 1711-000000',
  support_email: 'concierge@mavllin.com',
  trade_license_no: 'TRAD/DNCC/048291/2026',
  dbid_number: 'DBID-884920115',
  currency: 'BDT',
  currency_symbol: '৳',
  estimated_days_inside_dhaka: '1-2 days',
  estimated_days_outside_dhaka: '3-5 days',
  promo_popup_enabled: 'true',
  promo_popup_badge: 'LIMITED SEASONAL PRIVILEGE',
  promo_popup_title: 'FESTIVE ARCHIVE DROP — UP TO 20% OFF',
  promo_popup_subtitle:
    'Discover artisanal Heritage Panjabi, Heavyweight Fleece & Tailored Linen. Use code WELCOME10 at checkout for 10% off your order.',
  promo_popup_cta_text: 'Explore Featured Collection',
  promo_popup_target_link: '/catalog?categorySlug=mens-panjabi',
  promo_popup_discount_code: 'WELCOME10',
};

let tableInitialized = false;

const SettingModel = {
  DEFAULT_SETTINGS,

  async ensureTable() {
    if (tableInitialized) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        setting_key VARCHAR(80) PRIMARY KEY,
        setting_value TEXT DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    const entries = Object.entries(DEFAULT_SETTINGS);
    for (const [key, val] of entries) {
      await pool.query(
        'INSERT IGNORE INTO store_settings (setting_key, setting_value) VALUES (?, ?)',
        [key, String(val)]
      );
    }
    tableInitialized = true;
  },

  async getAll() {
    await this.ensureTable();
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM store_settings');
    const result = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      const k = row.setting_key;
      const v = row.setting_value;
      if (
        k === 'delivery_charge_inside_dhaka' ||
        k === 'delivery_charge_outside_dhaka' ||
        k === 'free_shipping_threshold'
      ) {
        const num = parseFloat(v);
        result[k] = !isNaN(num) && num >= 0 ? num : DEFAULT_SETTINGS[k];
      } else {
        result[k] = v !== null && v !== undefined ? v : DEFAULT_SETTINGS[k];
      }
    }
    return result;
  },

  async updateMany(payload = {}) {
    await this.ensureTable();
    const normalized = { ...payload };
    if (normalized.inside_dhaka_fee !== undefined && normalized.delivery_charge_inside_dhaka === undefined) {
      normalized.delivery_charge_inside_dhaka = normalized.inside_dhaka_fee;
    }
    if (normalized.outside_dhaka_fee !== undefined && normalized.delivery_charge_outside_dhaka === undefined) {
      normalized.delivery_charge_outside_dhaka = normalized.outside_dhaka_fee;
    }

    const allowedKeys = Object.keys(DEFAULT_SETTINGS);
    for (const key of allowedKeys) {
      if (normalized[key] !== undefined && normalized[key] !== null) {
        let val = normalized[key];
        if (
          key === 'delivery_charge_inside_dhaka' ||
          key === 'delivery_charge_outside_dhaka' ||
          key === 'free_shipping_threshold'
        ) {
          const num = parseFloat(val);
          val = !isNaN(num) && num >= 0 ? num.toFixed(2) : String(DEFAULT_SETTINGS[key]);
        } else {
          val = String(val).trim();
        }
        await pool.query(
          `INSERT INTO store_settings (setting_key, setting_value)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [key, val]
        );
      }
    }
    return this.getAll();
  },
};

module.exports = SettingModel;
