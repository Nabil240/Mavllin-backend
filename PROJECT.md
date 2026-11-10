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
  - `plan.md` logging protocol recording every modifying command and action.

---

## Feature Inventory
Every feature from the Survey phase appears here with its assigned milestone:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Plan.md Action Tracking | Logging protocol in plan.md recording every command and project modification | M1 | ORIGINAL_REQUEST R1 |
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
| 26 | Coupon Whitelist & Per-Member Limits Schema | Database migration creating coupon_members table with foreign keys, unique constraint, usage_limit, and used_count | M6-A | ORIGINAL_REQUEST 2026-11-09 R1, R2 |
| 27 | Backend Whitelist Model & Admin CRUD APIs | CouponModel methods and REST endpoints for listing, assigning, updating limits, and removing members | M6-A | ORIGINAL_REQUEST 2026-11-09 R1, R2, R4 |
| 28 | Real-Time Validation & Member Whitelist Enforcement | POST /api/v1/coupons/validate enforcing is_universal, whitelist membership, and custom per-member limits | M6-A | ORIGINAL_REQUEST 2026-11-09 R1, R2, R3 |
| 29 | Order Placement Atomic Enforcement & Decrementing | POST /api/v1/orders & /checkout/orders row locking with FOR UPDATE, enforcing member limits and incrementing used_count | M6-A | ORIGINAL_REQUEST 2026-11-09 R2, R3 |
| 30 | Admin Coupons Whitelist Modal & Member Assignment | AdminCouponsComponent modal for assigning whitelisted members by user ID or email with custom usage limits | M6-B | ORIGINAL_REQUEST 2026-11-09 R4 |
| 31 | Admin Member Usage Tracking & Live Limit Editing | AdminCouponsComponent displaying member usage counts, custom limits, remaining uses pill, and inline limit updates | M6-B | ORIGINAL_REQUEST 2026-11-09 R4 |
| 32 | Comprehensive Verification Suites & Invariant Logging | Backend coupon-member-access.test.js, frontend admin-coupons.component.spec.ts, log-action.sh synchronization | M6-C | ORIGINAL_REQUEST 2026-11-09 R5 |
| 39 | Product Base Cost Schema Migration & Model Support | Add base_cost DECIMAL(10,2) to products table via migration 006_product_base_cost.sql, update schema.sql, and allow base_cost in ProductModel.create and update | M8 | ORIGINAL_REQUEST R2 |
| 40 | Backend Total Investment Amount SQL Calculation | In DashboardModel.getOverviewStats(), compute total inventory cost aggregating variant stock multiplied by product base cost (with fallback to base_price/variant price) | M8 | ORIGINAL_REQUEST R1, R2 |
| 41 | Backend Realized Sales Profit SQL Calculation & API | In DashboardModel.getOverviewStats() and AdminController.getDashboard(), compute realized profit (revenue - COGS for paid non-cancelled orders) and expose in data.stats | M8 | ORIGINAL_REQUEST R1, R2 |
| 42 | Frontend Admin Dashboard Overview KPI Cards | In AdminDashboardComponent, render "Total Investment" and "Realized Profit" metric cards in .kpi-grid formatted with BdtCurrencyPipe and Arjo BD aesthetic | M8 | ORIGINAL_REQUEST R1 |
| 43 | Automated Backend & Frontend Tests & Verification | Implement backend/tests/dashboard-metrics.test.js and expand admin-dashboard.component.spec.ts with 100% pass on backend and frontend test suites | M8 | ORIGINAL_REQUEST AC |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Commerce, Payments & Receipts | Features 1-10: Plan.md logging, manual payment gateway (checkout TrxID + admin verification), product discounts (schema, cart fix, admin form), advance payments (schema, calculation, enforcement), downloadable digital receipt | none | DONE |
| M2 | Unified AI Messaging & N8N Automation | Features 11-16: Mavllin AI Brain.md, messaging adapters & schema, AI automation engine, admin messages UI, N8N order webhook dispatcher with DeepSeek WhatsApp notification | M1 | DONE |
| M3 | Storefront Popups & Email Notifications | Features 17-20: Modular MailService with mock queue, order confirmation email, promotional popup with 24h cooldown, payment & order status change notification emails | M1 | DONE |
| M4 | Comprehensive Testing & Final Verification | Feature 21: End-to-end integration test suites, adversarial challenger suites, verify-mavllin.sh quality gate, and independent forensic audit | M1, M2, M3 | DONE |
| M5 | Guest Coupon Restriction & Login Prompt | Features 22-25: Backend coupon/order auth enforcement, frontend checkout UI prompt banner, guest coupon blocking, comprehensive test suites, and forensic audit | M1, M4 | DONE |
| M6-A | Backend Whitelist Schema, Validation & Order Enforcement | Features 26-29: Database migration (coupon_members), CouponModel CRUD, real-time validation, order row locking with FOR UPDATE and usage decrementing | M5 | DONE |
| M6-B | Admin Coupons Management UI & Member Assignment | Features 30-31: AdminCouponsComponent modal for member assignment by user ID/email, custom limits, inline edit, and live usage count display | M6-A | DONE |
| M6-C | Comprehensive Verification, Invariants & Quality Gate | Feature 32: 100% pass on backend coupon-member-access.test.js & frontend admin-coupons specs, log-action.sh synchronization, dual challengers, forensic audit | M6-A, M6-B | DONE |
| M8 | Admin Dashboard Investment & Realized Profit Overview | Features 39-43: Database migration 006, ProductModel update, DashboardModel SQL queries, AdminController API stats, Frontend KPI cards, Vitest & Node test suites, action logging | M1-M7 | DONE |

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


### 5. Coupon Member Access Control & Per-Member Limits (M6)

#### Database Schema: `coupon_members`
```sql
CREATE TABLE IF NOT EXISTS coupon_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  usage_limit INT UNSIGNED NOT NULL DEFAULT 1,
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupon_member (coupon_id, user_id),
  INDEX idx_cm_coupon (coupon_id),
  INDEX idx_cm_user (user_id),
  CONSTRAINT fk_cm_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

#### Real-Time Validation API (`POST /api/v1/coupons/validate`)
- Headers: `Authorization: Bearer <JWT>` (Optional for universal coupon, required for restricted coupon)
- Request Body: `{ "code": "VIP50", "subtotal": 1500 }`
- Behavior & Responses:
  * If `coupon.is_universal === 1`:
    - Open to all authenticated members. Guest users are permitted or prompted per store policy.
  * If `coupon.is_universal === 0` (Member-Restricted):
    - Unauthenticated guest: HTTP 401 `{ "success": false, "message": "Authentication required to apply coupon discounts. Please log in or create an account." }`
    - Authenticated non-whitelisted user: HTTP 403 `{ "success": false, "message": "This coupon is restricted to specific eligible members." }`
    - Authenticated whitelisted user who reached custom limit (`used_count >= usage_limit`): HTTP 400 `{ "success": false, "message": "You have reached your usage limit for this coupon." }`
    - Authenticated whitelisted user within limit: HTTP 200 `{ "success": true, "data": { "code": "VIP50", "discount_amount": 750, "member_usage": { "usage_limit": 3, "used_count": 1, "remaining_uses": 2 } } }`

#### Admin Member Whitelist Management APIs
1. `GET /api/v1/coupons/:id/members`
   - Guard: `authenticate`, `requireRole('admin', 'staff')`
   - Response: HTTP 200 `{ "success": true, "data": [ { "id": 1, "coupon_id": 5, "user_id": 2, "customer_name": "Jane Doe", "customer_email": "jane@example.com", "usage_limit": 5, "used_count": 1, "remaining_uses": 4 } ] }`
2. `POST /api/v1/coupons/:id/members`
   - Guard: `authenticate`, `requireRole('admin')`
   - Request Body: `{ "user_id": 2, "usage_limit": 3 }` OR `{ "email": "customer@mavllin.com", "usage_limit": 5 }`
   - Response: HTTP 201 `{ "success": true, "message": "Member assigned to coupon whitelist successfully", "data": { ... } }`
   - If user not found: HTTP 404 `{ "success": false, "message": "User not found" }`
   - If member already assigned: HTTP 409 `{ "success": false, "message": "Member is already whitelisted for this coupon" }`
3. `PUT /api/v1/coupons/:id/members/:userId`
   - Guard: `authenticate`, `requireRole('admin')`
   - Request Body: `{ "usage_limit": 10 }`
   - Response: HTTP 200 `{ "success": true, "message": "Member usage limit updated successfully", "data": { ... } }`
4. `DELETE /api/v1/coupons/:id/members/:userId`
   - Guard: `authenticate`, `requireRole('admin')`
   - Response: HTTP 200 `{ "success": true, "message": "Member removed from coupon whitelist successfully" }`

#### Order Placement & Atomic Enforcement (`POST /api/v1/orders` & `POST /api/v1/checkout/orders`)
- Inside `OrderModel.createWithTransaction`:
  1. Acquire row lock on `coupons`: `SELECT * FROM coupons WHERE id = ? FOR UPDATE`
  2. Verify overall coupon status and global `used_count < usage_limit`.
  3. If `is_universal === 0`:
     - If `user_id` is null (guest): Reject with HTTP 400.
     - Acquire row lock on `coupon_members`: `SELECT * FROM coupon_members WHERE coupon_id = ? AND user_id = ? FOR UPDATE`
     - If row not found: Reject with HTTP 403 (Non-whitelisted member).
     - If `member.used_count >= member.usage_limit`: Reject with HTTP 400 (Member limit reached).
     - Increment member usage: `UPDATE coupon_members SET used_count = used_count + 1 WHERE coupon_id = ? AND user_id = ?`
  4. Increment global usage: `UPDATE coupons SET used_count = used_count + 1 WHERE id = ?`

#### Frontend Admin Contract (`frontend/src/app/core/services/admin.service.ts` & `coupon.model.ts`)
- TypeScript Interface:
```typescript
export interface CouponMember {
  id: number;
  coupon_id: number;
  user_id: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  usage_limit: number;
  used_count: number;
  remaining_uses?: number;
  created_at?: string;
}
```
- Admin Service Methods:
  * `getCouponMembers(couponId: number): Observable<ApiResponse<CouponMember[]>>`
  * `addCouponMember(couponId: number, data: { user_id?: number; email?: string; usage_limit: number }): Observable<ApiResponse<CouponMember>>`
  * `updateCouponMemberLimit(couponId: number, userId: number, usage_limit: number): Observable<ApiResponse<CouponMember>>`
### 6. Admin Dashboard Overview Investment & Realized Profit Metrics (M8)
#### Database Schema Migration (`database/migrations/006_product_base_cost.sql`)
```sql
ALTER TABLE products
  ADD COLUMN base_cost DECIMAL(10, 2) DEFAULT NULL AFTER description;
```

#### Admin Dashboard Stats API Contract (`GET /api/v1/admin/dashboard`)
Response `data.stats` schema:
```json
{
  "total_orders": 630,
  "total_revenue": 734114.99,
  "gross_revenue": 731474.99,
  "total_products": 16,
  "total_variants": 52,
  "total_customers": 3,
  "low_stock_count": 5,
  "out_of_stock_count": 1,
  "pending_orders": 448,
  "total_investment": 3389949.90,
  "realized_profit": 24450.00,
  "investment_amount": 3389949.90,
  "profit": 24450.00
}
```

#### Frontend Dashboard Contract (`frontend/src/app/core/models/api.models.ts`)
```typescript
export interface DashboardData {
  stats: {
    total_orders: number;
    total_revenue: number;
    gross_revenue?: number;
    total_products: number;
    total_variants?: number;
    total_customers: number;
    low_stock_count: number;
    out_of_stock_count?: number;
    pending_orders: number;
    total_investment?: number;
    realized_profit?: number;
    investment_amount?: number;
    profit?: number;
  };
  ...
}
```

#### Frontend KPI Cards (`frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts`)
```html
<div class="kpi-card" data-testid="kpi-total-investment">
  <span class="kpi-label">Total Investment</span>
  <strong class="kpi-value tabular-price">{{ Number(d.stats.total_investment ?? d.stats.investment_amount ?? 0) | bdt }}</strong>
  <span class="kpi-sub">Inventory base cost</span>
</div>

<div class="kpi-card" data-testid="kpi-realized-profit">
  <span class="kpi-label">Realized Profit</span>
  <strong
    class="kpi-value tabular-price"
    [class.text-emerald]="(d.stats.realized_profit ?? d.stats.profit ?? 0) >= 0"
    [class.text-berry]="(d.stats.realized_profit ?? d.stats.profit ?? 0) < 0"
  >
    {{ Number(d.stats.realized_profit ?? d.stats.profit ?? 0) | bdt }}
  </strong>
  <span class="kpi-sub">Net profit from completed sales</span>
</div>
```

---

## Code Layout
```
/run/media/nabil/New Volume/Project ECO/
├── .agents/teamwork/             # Agent metadata only (BRIEFING, progress, handoffs)
├── Mavllin AI Brain.md           # Knowledge base & AI agent rules for MAVLLIN atelier
├── plan.md                       # Project action & command log
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
│       ├── dashboard-metrics.test.js
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
