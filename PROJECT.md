# Project: MAVLLIN E-Commerce & Automated Messaging Platform

## Architecture & System Overview
MAVLLIN is a contemporary fashion and heritage lifestyle e-commerce platform built as an API-first service with a modern decoupled frontend:
- **Backend**: Express.js (v4.21.2) REST API on Node.js (v22.23.1) structured in a modular layered architecture (Routes -> Controllers -> Models -> Services -> MySQL2 Connection Pool).
- **Database Persistence**: MySQL 8.0 engine accessed via `mysql2/promise` connection pool with atomic transactions (`SELECT ... FOR UPDATE`) for inventory, orders, and payment tracking.
- **Frontend**: Angular 22 standalone component architecture in `frontend/src/app` with SCSS, standalone routing, Arjo BD minimalist aesthetic, and Vitest test runner.
- **Automated Messaging & AI Automation**:
  - Unified Messaging Platform (`/admin/messages`) with modular adapters (`BaseMessagingAdapter`, `FacebookAdapter`, `WhatsAppAdapter`, `MockAdapter`) and AI auto-reply engine driven by `Mavllin AI Brain.md`.
  - Non-blocking N8N order webhook dispatcher sending structured order payloads with DeepSeek API configuration to trigger WhatsApp alerts to the store owner.
- **Transactional Commerce & Advance Payments**:
  - Manual payment gateway supporting customer transaction ID entry at checkout and admin panel transaction ID review & verification.
  - Per-product discounts (percentage/fixed) with corrected cart pricing priority.
  - Per-product advance payment rules (30%, 50%, 100%, delivery charge first) enforced during checkout.
  - Post-checkout digital receipt populated with order details and downloadable HTML / printable format.
- **Customer Notifications & Engagement**:
  - Modular `MailService` with SMTP transport and in-memory mock queue for order confirmation and status transition notifications (`paid`/`done`, `confirmed`, `shipped`, `delivered`, `cancelled`).
  - Website promotional popup with anti-spam `localStorage` cooldown and catalog navigation.
- **Project Tracking**:
  - Synchronized `Plan.md` and `plan.md` logging protocol recording every modifying command and action.

---

## Feature Inventory
Every feature from the Survey phase appears here with its assigned milestone:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Plan.md Action Tracking | Synchronized logging protocol in Plan.md/plan.md recording every command and project modification | M1 | ORIGINAL_REQUEST R1 |
| 2 | Backend Manual Payment Routes & Clamping | Add 'manual'/'manual_payment' aliases to validator and clamp transaction_id to prevent MySQL ER_DATA_TOO_LONG | M1 | ORIGINAL_REQUEST R2 |
| 3 | Checkout Manual Payment Interface | Customer selects manual payment option (bKash/Nagad/Rocket/Bank), views payment details, enters TrxID | M1 | ORIGINAL_REQUEST R2 |
| 4 | Admin Manual Payment Verification | Admin Orders UI displays TrxID, sender phone, and one-click verification action to verify payment | M1 | ORIGINAL_REQUEST R2 |
| 5 | Product-Specific Discount Schema & Cart Fix | Add discount_type and discount_value to products; fix CartModel COALESCE priority bug | M1 | ORIGINAL_REQUEST R3 |
| 6 | Admin Product Discount Form | Add discount type and value inputs in admin product upload/edit form, updating prices in BDT | M1 | ORIGINAL_REQUEST R3 |
| 7 | Storefront Discount Price Display | Reflect product-specific discounts on product cards, details, cart, and checkout in BDT | M1 | ORIGINAL_REQUEST R3 |
| 8 | Product Advance Payment Schema & Admin Selector | Add advance_payment_type to products with selector in admin product form | M1 | ORIGINAL_REQUEST R6 |
| 9 | Checkout Advance Payment Enforcement | Calculate required advance payment based on cart items, record advance_amount/due_amount, enforce payment | M1 | ORIGINAL_REQUEST R6 |
| 10 | Downloadable Digital Confirmation Receipt | Display populated digital receipt post-checkout with HTML Blob download and @media print format | M1 | ORIGINAL_REQUEST R8 |
| 11 | Mavllin AI Brain Knowledge Base | Create Mavllin AI Brain.md specifying brand identity, sizing, pricing, delivery, returns, bilingual rules | M2 | ORIGINAL_REQUEST R4 |
| 12 | Unified Messaging Adapters & DB Schema | Implement messaging tables, modular adapters (FB, WA, Mock), REST APIs, and test emulator | M2 | ORIGINAL_REQUEST R4 |
| 13 | AI Messaging Automation Engine | Inbound message processing triggering AI responses based on Mavllin AI Brain.md with mock support | M2 | ORIGINAL_REQUEST R4 |
| 14 | Admin Unified Messaging Interface | Build /admin/messages UI with channel filters (FB/WA), thread viewer, manual reply, and per-chat AI toggle | M2 | ORIGINAL_REQUEST R4 |
| 15 | Non-Blocking N8N Webhook Dispatcher | Dispatch order placement payload asynchronously to N8N with DeepSeek prompt config without blocking checkout | M2 | ORIGINAL_REQUEST R5 |
| 16 | N8N & DeepSeek WhatsApp Store Owner Notification | Format and deliver executive order alerts via WhatsApp to store owner with TrxID and BDT totals | M2 | ORIGINAL_REQUEST R5 |
| 17 | Modular Mail Service & Order Confirmation Email | Implement backend MailService with SMTP + test mock, sending confirmation email upon order placement | M3 | ORIGINAL_REQUEST R7 |
| 18 | Promotional Website Popup | Build PromoPopupComponent in StorefrontLayout with discount promo, 24h dismissal cooldown, catalog navigation | M3 | ORIGINAL_REQUEST R9 |
| 19 | Payment Status Update Email Notification | Trigger customer confirmation email when payment status becomes 'paid', 'done', or 'payment successful' | M3 | ORIGINAL_REQUEST R10 |
| 20 | Order Status Transition Email Notification | Trigger customer notification email on order status changes (confirmed, shipped, dispatch, delivered, cancelled) | M3 | ORIGINAL_REQUEST R10 |
| 21 | Master Automated Test Suites & Quality Gate | Comprehensive unit, integration, adversarial challenger, and E2E test suites with verify-mavllin.sh | M4 | ORIGINAL_REQUEST AC |
| 22 | Backend Coupon Validation Auth Enforcement | Enforce authenticate middleware on /validate and controller-level auth check returning HTTP 401 | M5 | ORIGINAL_REQUEST 2026-11-08 |
| 23 | Backend Order Guest Coupon Rejection | Reject unauthenticated coupon applications in placeGuestOrder/checkoutOrder with HTTP 400/401 while preserving legit guest checkout | M5 | ORIGINAL_REQUEST 2026-11-08 |
| 24 | Frontend Checkout Guest Coupon Restrictions & Banner | Render guest login/register prompt banner, disable coupon inputs, guard validateCoupon/quickApplyCoupon, force null coupon in guest orders | M5 | ORIGINAL_REQUEST 2026-11-08 |
| 25 | Automated Testing & Forensic Verification | Frontend component spec tests, backend coupon auth tests, adversarial testing, and forensic audit | M5 | ORIGINAL_REQUEST 2026-11-08 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Commerce, Payments & Receipts | Features 1-10: Plan.md logging, manual payment gateway (checkout TrxID + admin verification), product discounts (schema, cart fix, admin form), advance payments (schema, calculation, enforcement), downloadable digital receipt | none | DONE |
| M2 | Unified AI Messaging & N8N Automation | Features 11-16: Mavllin AI Brain.md, messaging adapters & schema, AI automation engine, admin messages UI, N8N order webhook dispatcher with DeepSeek WhatsApp notification | M1 | DONE |
| M3 | Storefront Popups & Email Notifications | Features 17-20: Modular MailService with mock queue, order confirmation email, promotional popup with 24h cooldown, payment & order status change notification emails | M1 | DONE |
| M4 | Comprehensive Testing & Final Verification | Feature 21: End-to-end integration test suites, adversarial challenger suites, verify-mavllin.sh quality gate, and independent forensic audit | M1, M2, M3 | DONE |
| M5 | Guest Coupon Restriction & Login Prompt | Features 22-25: Backend coupon/order auth enforcement, frontend checkout UI prompt banner, guest coupon blocking, comprehensive test suites, and forensic audit | M1, M4 | DONE |

---

## Interface Contracts

### 1. Manual & Advance Payments (M1)
#### Order Placement Request (`POST /api/v1/orders` / `POST /api/v1/orders/guest-checkout`)
```json
{
  "payment_method": "manual",
  "transaction_id": "TRX9876543210",
  "sender_phone": "01711000000",
  "advance_amount": 750.00,
  "due_amount": 1750.00,
  "shipping_address": { ... },
  "items": [ ... ]
}
```
- Validation: `payment_method` in `['cod', 'cash_on_delivery', 'manual', 'manual_payment', 'bkash', 'nagad', 'rocket', 'upay']`.
- If `payment_method === 'manual'`, `transaction_id` is required (max length 120 chars).
- If advance payment is required, `advance_amount` must equal or exceed calculated advance requirement.

#### Admin Verify Payment (`PUT /api/v1/admin/orders/:id/verify-payment` or `PUT /api/v1/orders/:id/payment-status`)
- Admin updates payment status to `'paid'` after cross-checking transaction ID.
- Automatically updates `payments` table row status to `'succeeded'`.

### 2. Messaging & Webhook APIs (M2)
#### Inbound Webhook (`POST /api/v1/messaging/webhook/:channel`)
- Access: Public with channel signature verification (`facebook`, `whatsapp`).
- Auto-triggers AI response worker using `Mavllin AI Brain.md` when AI auto-reply is enabled.

#### Admin Messages API (`GET /api/v1/admin/messaging/conversations`, `GET /api/v1/admin/messaging/conversations/:id/messages`, `POST /api/v1/admin/messaging/conversations/:id/reply`)
- Channel filtering: `?channel=all|facebook|whatsapp`.
- Toggle AI: `PATCH /api/v1/admin/messaging/conversations/:id/toggle-ai`.

#### N8N Order Webhook (`POST ${N8N_WEBHOOK_URL}`)
- Payload includes:
```json
{
  "event": "order.created",
  "order_number": "MAV-20261107-1234",
  "total_amount": 2500,
  "advance_amount": 750,
  "due_amount": 1750,
  "payment_method": "manual",
  "transaction_id": "TRX9876543210",
  "customer": { "name": "...", "phone": "...", "district": "Dhaka" },
  "items": [ ... ],
  "deepseek_config": {
    "model": "deepseek-chat",
    "prompt_template": "Generate an executive WhatsApp summary for store owner..."
  }
}
```

### 3. Mail Service APIs (M3)
- `MailService.sendOrderConfirmation(order)`: Sends branded order confirmation email.
- `MailService.sendPaymentStatusEmail(order, paymentStatus)`: Sends payment confirmation email when status is 'paid'/'done'.
- `MailService.sendOrderStatusEmail(order, previousStatus, newStatus)`: Sends status transition email with courier details.
- Testing: When `SMTP_MOCK=true` or `NODE_ENV === 'test'`, captures sent mail in `MailService.sentEmails[]`.

### 4. Coupon Authentication & Guest Restrictions (M5)
#### Coupon Validation (`POST /api/v1/coupons/validate`)
- Headers: `Authorization: Bearer <CUSTOMER_JWT_TOKEN>` (Mandatory)
- Middleware: `authenticate`
- Request: `{ "code": "WELCOME10", "subtotal": 2000 }`
- Unauthenticated response: HTTP 401 `{ "success": false, "message": "Authentication required" }`
- Authenticated response: HTTP 200 `{ "success": true, "data": { "code": "WELCOME10", "discount_amount": 200, ... } }`

#### Guest Order Placement (`POST /api/v1/orders/guest` & `POST /api/v1/checkout/orders` [unauthenticated])
- Unauthenticated requests containing non-empty `coupon_code` or `discount_amount > 0`:
  - Response: HTTP 400/401 `{ "success": false, "message": "Coupons and promotional discounts are exclusively available to registered customers. Please log in or create an account to apply coupons." }`
- Legitimate guest order with `coupon_code: null` and `discount_amount: 0`:
  - Response: HTTP 201 Created `{ "success": true, "data": { "order_number": "...", "discount_amount": 0, "coupon_id": null } }`

#### Frontend Checkout UI Contract (`frontend/src/app/features/storefront/checkout/checkout.component.ts`)
- State check: `auth.isAuthenticated()` boolean signal
- Guest State (`!auth.isAuthenticated()`):
  - Promotional section displays clear alert/banner prompting sign-in or account creation to unlock coupons, linking to `/auth/login` and `/auth/register` with `queryParams: { returnUrl: '/checkout' }`.
  - Coupon code input `<input id="checkoutCoupon">` has `[disabled]="!auth.isAuthenticated()"` and placeholder `'Log in to apply promo codes'`.
  - Apply button has `[disabled]="!auth.isAuthenticated() || !couponInput.trim() || submitting()"`.
  - Quick-apply buttons are disabled or guarded.
  - Calling `validateCoupon()` or `quickApplyCoupon()` produces toast error: `'Please log in or create an account to unlock and apply coupon discounts.'`.
  - `placeGuestOrder()` always submits `coupon_code: null` and `appliedCoupon.set(null)`.

---

## Code Layout
```
/run/media/nabil/New Volume/Project ECO/
├── .agents/teamwork/             # Agent metadata only (BRIEFING, progress, handoffs)
├── Mavllin AI Brain.md           # Knowledge base & AI agent rules for MAVLLIN atelier
├── Plan.md / plan.md             # Synchronized project action & command log
├── backend/
│   ├── src/
│   │   ├── config/env.js         # SMTP, Messaging, N8N, DeepSeek environment variables
│   │   ├── controllers/
│   │   │   ├── admin.controller.js  # Product discounts, verify manual payment
│   │   │   ├── messaging.controller.js # Unified conversations & reply API
│   │   │   └── order.controller.js  # Manual payments, advance enforcement, N8N hook, email hooks
│   │   ├── models/
│   │   │   ├── cart.model.js     # Cart pricing with product-level discount fix
│   │   │   ├── messaging.model.js # Conversations & messages CRUD
│   │   │   ├── order.model.js    # Advance amount, due amount, manual payments
│   │   │   └── product.model.js  # discount_type, discount_value, advance_payment_type
│   │   ├── services/
│   │   │   ├── ai-messaging.service.js # Mavllin AI Brain prompt engine
│   │   │   ├── mail.service.js   # Nodemailer SMTP + in-memory test queue
│   │   │   ├── messaging-adapters/ # FacebookAdapter, WhatsAppAdapter, MockAdapter
│   │   │   └── n8n-webhook.service.js # Non-blocking N8N order webhook dispatcher
│   │   └── routes/
│   │       ├── admin.routes.js   # Wired messaging and payment verification
│   │       ├── messaging.routes.js # Webhooks and conversation APIs
│   │       └── order.routes.js   # Manual payment validation & advance enforcement
│   └── tests/
│       ├── advance-payment.test.js
│       ├── mail-service.test.js
│       ├── manual-payment.test.js
│       ├── messaging-unified.test.js
│       └── n8n-webhook.test.js
├── database/
│   └── migrations/               # Schema updates for advance payments, discounts, messaging
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/services/
│   │   │   │   ├── admin.service.ts    # Manual payment verification & messaging calls
│   │   │   │   └── messaging.service.ts # Unified messaging API client
│   │   │   ├── features/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── messages/admin-messages.component.ts # Unified inbox UI
│   │   │   │   │   ├── orders/admin-orders.component.ts   # TrxID display & verify button
│   │   │   │   │   └── products/product-form/             # Discount & advance options
│   │   │   │   └── storefront/
│   │   │   │       ├── checkout/checkout.component.ts     # Manual payment & advance check
│   │   │   │       └── orders/order-confirmation.component.ts # Digital receipt HTML download/print
│   │   │   └── shared/
│   │   │       └── components/promo-popup/promo-popup.component.ts # Promotional popup
│   │   └── styles.scss
└── scripts/
    └── verify-mavllin.sh         # Master automated verification quality gate
```
