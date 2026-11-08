const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:4200',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_db',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  messaging: {
    mode: process.env.MESSAGING_MODE || (process.env.NODE_ENV === 'test' ? 'mock' : 'live'),
    fbVerifyToken: process.env.FB_VERIFY_TOKEN || 'mavllin_fb_verify_token_2026',
    fbPageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN || '',
    fbAppSecret: process.env.FB_APP_SECRET || '',
    whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'mavllin_wa_verify_token_2026',
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || process.env.FB_APP_SECRET || '',
  },
  n8n: {
    orderNotificationMode: process.env.ORDER_NOTIFICATION_MODE || (process.env.NODE_ENV === 'test' ? 'mock' : 'live'),
    webhookUrl: process.env.N8N_WEBHOOK_URL || '',
    webhookSecret: process.env.N8N_WEBHOOK_SECRET || 'mavllin_n8n_secret_token_2026',
    ownerWhatsAppNumber: process.env.OWNER_WHATSAPP_NUMBER || '+8801711000000',
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
    deepseekApiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
    deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
  mail: {
    mode:
      process.env.MAIL_MODE ||
      (process.env.SMTP_MOCK === 'true' || process.env.NODE_ENV === 'test' || !process.env.SMTP_HOST ? 'mock' : 'live'),
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'MAVLLIN Concierge <concierge@mavllin.com>',
  },
};
