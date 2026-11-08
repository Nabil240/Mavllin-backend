-- Migration 004: Unified Messaging Schema (Facebook Messenger & WhatsApp Business)
-- Applies to: messaging_conversations, messaging_messages

-- 1. Unified Messaging Conversations
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

-- 2. Unified Messaging Messages
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
