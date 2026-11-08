# Fashion E-Commerce Website — Master Project Plan

> **Purpose:** Use this file as the main implementation checklist for a single-store fashion e-commerce website inspired by the shopping experience of [ARJO BD](https://arjobd.com/). Build an original brand and interface; do not copy protected branding, text, or images.
>
> **Frontend:** Angular + TypeScript + SCSS  
> **Backend:** Node.js + Express.js (JavaScript)  
> **Database:** PostgreSQL  
> **ORM:** Prisma  
> **Primary market assumption:** Bangladesh; confirm business, delivery, payment, tax, privacy, and return requirements before launch.

---

## 1. Project Goals and Scope

### 1.1 Main goals

- [ ] Build a polished, responsive fashion storefront for desktop, tablet, and mobile.
- [ ] Allow guests to browse, search, filter, and view products.
- [ ] Support product variants such as size and color, with stock tracked per sellable variant/SKU.
- [ ] Support a cart, checkout, delivery details, order placement, and order history.
- [ ] Support cash on delivery and an online payment provider if eligible and required.
- [ ] Provide a protected admin dashboard for managing products, categories, inventory, orders, customers, promotions, and reports.
- [ ] Store business data safely in PostgreSQL.
- [ ] Test, deploy, monitor, and back up the production system.

### 1.2 User roles

1. **Guest:** Browse products and manage a guest cart; check out as a guest if enabled.
2. **Customer:** Manage profile and addresses, place orders, view order history, and request permitted cancellations/returns.
3. **Admin:** Manage store configuration, catalog, inventory, orders, customers, promotions, reports, and staff permissions.
4. **Staff (optional):** Perform only explicitly permitted tasks, such as fulfillment or customer support.

### 1.3 Release scope

**Must-have for the first release (MVP):**

- Homepage, category/product listings, product detail pages, search, filters, and sorting.
- Product variants, SKU, images, prices, and inventory.
- Customer registration/login or guest checkout, depending on requirements.
- Cart, address entry, checkout, order creation, and order history.
- Cash on delivery and/or one verified online payment integration.
- Admin login, dashboard, product/category management, inventory, and order management.
- Validation, authorization, security controls, tests, deployment, and database backups.

**Can be added after MVP:** wishlist, reviews, coupons, advanced analytics, automated abandoned-cart notifications, loyalty points, multilingual content, multiple warehouses, and multi-vendor marketplace functionality.

---

## 2. Technology and Tools

| Area | Recommended choice | Notes |
|---|---|---|
| Frontend | Angular + TypeScript | Use a currently supported Angular release and its matching Node.js version. |
| Styles | SCSS | Establish reusable tokens, spacing, typography, and responsive breakpoints. |
| UI components | Angular Material or custom components | Choose one approach and avoid unnecessary component-library mixing. |
| Routing | Angular Router | Lazy-load major feature areas. |
| Forms | Angular Reactive Forms | Validate on the frontend and again on the backend. |
| HTTP | Angular HttpClient | Centralize API access and error handling. |
| Backend | Node.js + Express.js | JavaScript modules; use a consistent module format. |
| Database | PostgreSQL | Relational data, constraints, indexes, and transactions. |
| ORM | Prisma | Schema, migrations, and typed database access. |
| Password hashing | Argon2id or bcrypt | Never store plaintext passwords. |
| Auth | Secure server-side session cookie or carefully designed JWT flow | For browser sessions, use HttpOnly/Secure/SameSite cookies and CSRF protection as appropriate. |
| Images | Cloudinary or S3-compatible storage | Store files in object storage and URLs/metadata in PostgreSQL. |
| API testing | Postman or Bruno | Save a reusable API collection. |
| Backend tests | Jest or Vitest + Supertest | Unit, integration, and API tests. |
| Frontend tests | Angular testing tools | Components, services, and route behavior. |
| E2E tests | Playwright or equivalent | Test the complete shopping journey. |
| Version control | Git + GitHub | Track work in issues and small commits. |
| Hosting | Static Angular host + Node-capable backend host + managed PostgreSQL | Choose providers based on budget, region, reliability, and support. |

### 2.1 Why PostgreSQL?

PostgreSQL is the recommended first choice because orders, order items, customers, product variants, payments, and inventory have clear relationships. Database constraints and transactions help maintain consistency. MongoDB is also viable, but using multiple databases is unnecessary for this first version.

---

## 3. Project Setup and Repository

### 3.1 Repository setup

- [ ] Create a Git repository.
- [ ] Use separate `frontend/` and `backend/` directories.
- [ ] Add this file as `PROJECT_PLAN.md` or keep it as `README.md` plus a project-plan file.
- [ ] Configure `.gitignore` for dependencies, build output, local environment files, logs, and editor files.
- [ ] Create `.env.example` files with variable names only—never real secrets.
- [ ] Create development, test, and production configuration conventions.
- [ ] Agree on naming, commit, and branch conventions.
- [ ] Create GitHub issues for individual tasks or task groups.

### 3.2 Suggested top-level structure

```text
fashion-ecommerce/
├── frontend/                    # Angular application
├── backend/                     # Express.js API
├── docs/                        # Architecture, API, deployment notes
├── PROJECT_PLAN.md
├── README.md
└── .gitignore
```

### 3.3 Angular initialization

- [ ] Install a supported Node.js LTS version compatible with the chosen Angular release.
- [ ] Install Angular CLI.
- [ ] Create the Angular app with routing and SCSS.
- [ ] Confirm that the app runs locally.
- [ ] Configure environment-specific API base URLs.
- [ ] Add linting and formatting if desired.

Example commands (adjust based on current Angular CLI guidance):

```bash
npm install -g @angular/cli
ng new frontend --routing --style=scss
cd frontend
ng serve
```

### 3.4 Express initialization

```bash
mkdir backend
cd backend
npm init -y
npm install express cors dotenv helmet express-rate-limit zod prisma @prisma/client
npm install -D nodemon
npx prisma init
```

- [ ] Choose and configure ESM or CommonJS consistently.
- [ ] Create the app and server entry points.
- [ ] Add a health endpoint such as `GET /api/v1/health`.
- [ ] Add central error handling and request validation.
- [ ] Configure CORS for approved frontend origins only.
- [ ] Keep secrets out of source control.
- [ ] Verify the server starts and connects to the database.

> Package names and commands can change. Check the official documentation for the versions you install.

---

## 4. UI/UX and Visual Design

### 4.1 Design system

- [ ] Choose store name, logo, brand voice, and typography.
- [ ] Define primary, secondary, background, border, text, success, warning, and error colors.
- [ ] Define spacing scale, container widths, breakpoints, button styles, inputs, cards, badges, dialogs, and notifications.
- [ ] Define consistent image dimensions/aspect ratios for banners, category cards, and product cards.
- [ ] Design hover, focus, disabled, loading, success, and error states.
- [ ] Use licensed or original product photography.
- [ ] Maintain sufficient text contrast and keyboard accessibility.

### 4.2 Storefront global layout

- [ ] Optional announcement/promotion bar.
- [ ] Header with logo, desktop navigation, search, account, and cart.
- [ ] Mobile navigation/drawer.
- [ ] Breadcrumbs where useful.
- [ ] Consistent page container and footer.
- [ ] Footer links: contact, FAQ, shipping, returns, privacy, terms, and social media.
- [ ] Accessible focus styles and keyboard-operable menus.

### 4.3 Required storefront pages

- [ ] Home page: hero banner, categories, new arrivals, featured/best-selling products, promotions, benefits, and footer.
- [ ] Shop/all products page.
- [ ] Category/product listing page.
- [ ] Search results page.
- [ ] Product detail page with images, description, price, sizes, colors, stock, quantity, and add-to-cart.
- [ ] Cart page or accessible cart drawer.
- [ ] Checkout page.
- [ ] Order confirmation page.
- [ ] Login and registration pages.
- [ ] Forgot-password and reset-password pages.
- [ ] Customer profile page.
- [ ] Address book page.
- [ ] Order history and order detail/tracking pages.
- [ ] Contact page.
- [ ] FAQ page.
- [ ] Shipping/delivery policy page.
- [ ] Returns/refunds policy page.
- [ ] Privacy policy and terms pages.
- [ ] 404/not-found page.

### 4.4 Responsive behavior

- [ ] Design and test small mobile, large mobile, tablet, laptop, and wide desktop layouts.
- [ ] Keep navigation usable on narrow screens.
- [ ] Ensure product images do not stretch or distort.
- [ ] Use touch-friendly hit areas.
- [ ] Make checkout forms easy to complete on mobile.
- [ ] Test long product names, missing images, and out-of-stock variants.

---

## 5. Angular Frontend Architecture

### 5.1 Suggested structure

```text
frontend/src/app/
├── core/
│   ├── auth/
│   ├── guards/
│   ├── interceptors/
│   └── services/
├── shared/
│   ├── components/
│   ├── pipes/
│   ├── directives/
│   └── validators/
├── layout/
│   ├── storefront/
│   └── admin/
├── features/
│   ├── home/
│   ├── products/
│   ├── categories/
│   ├── search/
│   ├── cart/
│   ├── checkout/
│   ├── auth/
│   ├── account/
│   ├── addresses/
│   ├── orders/
│   ├── wishlist/               # optional
│   └── admin/
│       ├── auth/
│       ├── dashboard/
│       ├── products/
│       ├── categories/
│       ├── inventory/
│       ├── orders/
│       ├── customers/
│       ├── payments/
│       ├── coupons/
│       ├── reviews/
│       ├── banners/
│       ├── reports/
│       ├── staff/
│       ├── settings/
│       └── audit-logs/
├── app.routes.ts
└── app.config.ts
```

### 5.2 Shared components

- [ ] Header and footer.
- [ ] Desktop navigation and mobile menu.
- [ ] Product card and product grid.
- [ ] Product image gallery.
- [ ] Price and discount display.
- [ ] Variant/size/color selector.
- [ ] Stock indicator.
- [ ] Search box and optional suggestions.
- [ ] Filters and sort controls.
- [ ] Pagination.
- [ ] Reusable form controls and validation messages.
- [ ] Loading skeleton and spinner.
- [ ] Empty state and error state.
- [ ] Toast notifications.
- [ ] Confirmation dialog.
- [ ] Data table for admin lists.

### 5.3 Angular integration tasks

- [ ] Define TypeScript interfaces for API requests and responses.
- [ ] Build API services for auth, products, categories, cart, orders, addresses, and admin features.
- [ ] Centralize API URL configuration.
- [ ] Implement consistent error handling.
- [ ] Implement route guards for signed-in and admin-only routes.
- [ ] Use backend authorization regardless of frontend route guards.
- [ ] Lazy-load major features.
- [ ] Keep form validation aligned with backend rules.
- [ ] Use URL query parameters for shareable product filters and pagination.
- [ ] Handle session expiry and unauthorized responses cleanly.

---

## 6. Storefront Feature Checklist

### 6.1 Homepage

- [ ] Fetch active categories from the API.
- [ ] Fetch featured/new-arrival/best-selling collections.
- [ ] Render promotion banners.
- [ ] Link category cards and calls to action to the relevant listing pages.
- [ ] Show loading, empty, and error states.
- [ ] Optimize images and avoid unnecessary API calls.

### 6.2 Product listings, categories, and search

- [ ] Product card shows image, name, price, sale price if applicable, and relevant stock/discount indicators.
- [ ] Filter by category, price, size, color, and availability as supported.
- [ ] Sort by newest, price ascending/descending, and popularity if popularity data is defined.
- [ ] Implement pagination or load-more.
- [ ] Reset filters.
- [ ] Keep filters and search terms in URL query parameters.
- [ ] Display no-results state.
- [ ] Apply search, filters, sorting, and pagination on the backend for complete result sets.
- [ ] Add database indexes based on query patterns.

### 6.3 Product detail

- [ ] Show product images and image thumbnails.
- [ ] Show title, description, price, sale price, and relevant product information.
- [ ] Require valid size/color selection when applicable.
- [ ] Show stock for the selected variant.
- [ ] Validate quantity against available stock.
- [ ] Add selected variant to cart.
- [ ] Show delivery and returns information.
- [ ] Show related products if available.
- [ ] Handle unavailable, archived, or out-of-stock products.

### 6.4 Cart

- [ ] Add item.
- [ ] Update quantity.
- [ ] Remove item.
- [ ] Clear cart after confirmation.
- [ ] Display selected variant, quantity, item subtotal, cart subtotal, and estimated shipping/discounts where known.
- [ ] Handle stock changes and unavailable products.
- [ ] Decide whether guest carts are stored locally/server-side and how they merge after login.
- [ ] Revalidate price, stock, coupons, shipping, and total with the backend before order creation.
- [ ] Never trust frontend-supplied prices or totals.

### 6.5 Customer authentication and account

- [ ] Register a customer.
- [ ] Log in and log out.
- [ ] Implement password reset.
- [ ] Add email/phone verification if required by the business.
- [ ] Show and edit permitted profile information.
- [ ] Change password securely.
- [ ] Manage delivery addresses and default address.
- [ ] View orders and order detail.
- [ ] Show order/payment/fulfillment status.
- [ ] Allow permitted cancellation or return requests.

### 6.6 Checkout and orders

- [ ] Collect recipient name and contact number.
- [ ] Collect and validate delivery address.
- [ ] Allow saved-address selection where signed in.
- [ ] Display item summary.
- [ ] Display subtotal, valid discounts, delivery fees, and server-calculated total.
- [ ] Offer only configured payment options.
- [ ] Prevent duplicate form submissions.
- [ ] Show useful failed-payment and retry states.
- [ ] Show order confirmation only after the backend confirms order creation and the relevant payment/order state.
- [ ] Display order number and next steps.

---

## 7. Admin Dashboard — Required Scope

The admin dashboard is part of the same product but should have a distinct layout and protected routes. The Angular frontend and Express API share the same backend and PostgreSQL database; admin functionality must be authorized on the server.

### 7.1 Admin layout

- [ ] Separate admin login route.
- [ ] Sidebar/navigation with active-state indicators.
- [ ] Header with page title, optional search, notification area, and profile/logout menu.
- [ ] Responsive collapsible sidebar on mobile.
- [ ] Breadcrumbs.
- [ ] Reusable data tables with sorting, filters, and pagination.
- [ ] Reusable create/edit forms.
- [ ] Confirmation dialogs for destructive or irreversible actions.
- [ ] Success/error toast messages.
- [ ] Loading, empty, and error states.
- [ ] Permission-aware navigation (in addition to backend checks).

### 7.2 Dashboard overview

- [ ] Sales/revenue summary for a selected date range.
- [ ] Order count.
- [ ] Pending/processing orders.
- [ ] Customer count.
- [ ] Product count.
- [ ] Low-stock products.
- [ ] Recent orders.
- [ ] Best-selling products if the data is meaningful.
- [ ] Charts with explicit date ranges and clear definitions.
- [ ] Use real API/database data; do not hard-code production metrics.
- [ ] Define whether sales totals exclude cancelled orders, refunds, and unpaid COD orders.

### 7.3 Product management

- [ ] List products with search, filters, sorting, and pagination.
- [ ] Create product.
- [ ] Edit product.
- [ ] Archive/deactivate product instead of deleting records needed by order history.
- [ ] Manage description, slug, category, and product status.
- [ ] Manage variants (size, color, SKU, price, stock, status).
- [ ] Validate unique SKUs.
- [ ] Upload, order, replace, and remove product images.
- [ ] Mark products as featured/new arrivals when supported.
- [ ] Preview product details.

### 7.4 Category management

- [ ] List categories.
- [ ] Create and edit category.
- [ ] Manage slug, description, image, and status.
- [ ] Support parent/subcategory structure if required.
- [ ] Avoid invalid parent-child cycles.
- [ ] Prevent unsafe deletion of categories still in use; use reassignment or deactivation.

### 7.5 Inventory management

- [ ] View stock per variant/SKU.
- [ ] Show low-stock and out-of-stock items.
- [ ] Support authorized stock adjustments.
- [ ] Require a reason for manual adjustments.
- [ ] Record stock movements with before/after quantity, actor, reason, and timestamp.
- [ ] Make order-driven inventory changes transactional.
- [ ] Handle concurrent checkouts to prevent overselling.
- [ ] Define when stock is reserved, deducted, released, or restored for each payment/order flow.

### 7.6 Order management

- [ ] List orders with search, date range, status, payment status, and payment method filters.
- [ ] View order items, variant snapshots, address snapshot, and amount breakdown.
- [ ] Confirm/process/ship/deliver orders according to a defined state machine.
- [ ] Add tracking/courier information if available.
- [ ] Cancel orders only when allowed by the workflow.
- [ ] Record cancellation reasons.
- [ ] Handle failed/expired payments.
- [ ] Manage return/refund requests if in scope.
- [ ] Preserve status history and actor information.
- [ ] Notify customer when configured and appropriate.

### 7.7 Customer management

- [ ] List and search customers.
- [ ] View customer profile and order history when authorized.
- [ ] Deactivate/restore accounts if needed.
- [ ] Never reveal passwords, reset tokens, payment secrets, or unnecessary personal data.
- [ ] Restrict staff access to customer information by role.

### 7.8 Payment management

- [ ] View payment records and status.
- [ ] View provider transaction reference.
- [ ] Reconcile payments with provider events.
- [ ] Initiate refunds only through a supported, authorized flow.
- [ ] Record refund status and reason.
- [ ] Avoid storing raw card data.
- [ ] Do not mark a payment successful based only on a browser redirect.

### 7.9 Promotions, banners, and reviews (optional after MVP)

- [ ] Create/edit/deactivate coupon codes.
- [ ] Set eligibility rules, start/end time, usage limits, and redemption limits.
- [ ] Prevent discount abuse and repeated redemptions where relevant.
- [ ] Manage homepage promotional banners and links.
- [ ] Moderate product reviews if reviews are implemented.
- [ ] Record relevant admin actions.

### 7.10 Reports and settings

- [ ] Sales reports by defined date range.
- [ ] Orders by status.
- [ ] Best-selling products.
- [ ] Inventory and low-stock report.
- [ ] Payment method breakdown if available.
- [ ] Export data only for authorized staff and protect exported files.
- [ ] Store settings: store contact details, currency, delivery rules, payment options, and policy links.
- [ ] Clarify metric definitions and timezone used in reports.

### 7.11 Staff and permissions (add before multiple staff accounts are used)

- [ ] Create staff account workflow.
- [ ] Define roles such as admin, catalog manager, fulfillment staff, and support staff.
- [ ] Enforce permissions on every relevant backend endpoint.
- [ ] Do not allow public registration to grant admin privileges.
- [ ] Log sensitive actions.
- [ ] Restrict account administration to authorized admins.

---

## 8. Backend Architecture

### 8.1 Suggested structure

```text
backend/
├── src/
│   ├── config/
│   ├── middleware/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── addresses/
│   │   ├── categories/
│   │   ├── products/
│   │   ├── cart/
│   │   ├── orders/
│   │   ├── inventory/
│   │   ├── payments/
│   │   ├── shipping/
│   │   ├── coupons/            # optional
│   │   ├── reviews/            # optional
│   │   ├── banners/            # optional
│   │   ├── reports/
│   │   └── admin/
│   ├── routes/
│   ├── app.js
│   └── server.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
├── .env.example
└── package.json
```

Inside each module, keep responsibility clear. A common pattern is `route -> controller -> service -> Prisma/database`, with validation schemas and tests. Do not put all business logic in one large route file.

### 8.2 Backend foundation tasks

- [ ] Standardize API prefix, e.g. `/api/v1`.
- [ ] Add environment configuration validation at startup.
- [ ] Configure JSON parsing and reasonable request body limits.
- [ ] Configure security headers with Helmet or an equivalent.
- [ ] Configure strict CORS allow-list.
- [ ] Add rate limiting to authentication, search, checkout, and other abuse-prone endpoints.
- [ ] Validate request body, parameters, and query strings.
- [ ] Add centralized error handling and consistent error shape.
- [ ] Avoid returning stack traces and secrets to clients.
- [ ] Add request IDs and structured logs where useful.
- [ ] Add health/readiness endpoints.
- [ ] Add graceful shutdown and database connection handling.
- [ ] Use parameterized queries/Prisma rather than concatenating SQL with user input.

---

## 9. Database Design

Design the Prisma schema and PostgreSQL constraints before implementing checkout. Choose deletion rules carefully so historical orders are preserved.

### 9.1 Core tables/models

#### `User`

Suggested fields: `id`, `name`, `email`, `phone`, `passwordHash`, `role`, `isActive`, `emailVerifiedAt` if used, `createdAt`, `updatedAt`.

- [ ] Define unique constraints for the identifiers used for login.
- [ ] Never expose `passwordHash` in API responses.
- [ ] Keep public registration separate from admin/staff provisioning.

#### `Address`

Suggested fields: `id`, `userId`, `recipientName`, `phone`, `addressLine`, `area`, `district`, `postalCode` if applicable, `isDefault`, timestamps.

- [ ] Verify the address belongs to the signed-in customer before updating/deleting.
- [ ] Copy required delivery fields into the order as a snapshot when an order is created.

#### `Category`

Suggested fields: `id`, `name`, `slug`, `description`, `imageUrl`, optional `parentId`, `isActive`, timestamps.

- [ ] Add unique slug constraint.
- [ ] Index fields used in category navigation and filters.

#### `Product`

Suggested fields: `id`, `name`, `slug`, `description`, `categoryId`, `status`, `createdAt`, `updatedAt`.

- [ ] Add unique slug constraint.
- [ ] Use a status such as draft/active/archived.
- [ ] Keep sellable stock and SKU in variants, not only on the product, when size/color options exist.

#### `ProductVariant`

Suggested fields: `id`, `productId`, `sku`, `size`, `color`, `price`, optional `compareAtPrice`, `stockQuantity`, `isActive`, timestamps.

- [ ] Add unique SKU constraint.
- [ ] Ensure price and stock cannot be negative.
- [ ] Add useful indexes for product, SKU, and availability queries.
- [ ] Define whether each variant must have a unique size/color combination per product.

#### `ProductImage`

Suggested fields: `id`, `productId`, optional `variantId`, `imageUrl`, `altText`, `sortOrder`.

- [ ] Store image files externally; store metadata and URLs in PostgreSQL.
- [ ] Validate uploads and restrict them to authorized staff.

#### `CartItem` or cart models

Suggested fields depend on guest-cart design: cart ID/user ID or guest identifier, `variantId`, `quantity`, timestamps.

- [ ] Decide guest versus account cart behavior.
- [ ] Prevent duplicate variant rows within the same cart where appropriate.
- [ ] Set sane quantity limits.

#### `Order`

Suggested fields: `id`, unique `orderNumber`, optional `userId` for guest checkout, order status, payment status, payment method, `subtotal`, `discountAmount`, `shippingAmount`, `totalAmount`, `currency`, delivery-address snapshot fields, timestamps.

- [ ] Store all monetary amounts safely using integer minor units or PostgreSQL `NUMERIC`/Prisma `Decimal`.
- [ ] Define order and payment status separately.
- [ ] Add indexes for order number, customer, creation date, and statuses as needed.

#### `OrderItem`

Suggested fields: `id`, `orderId`, optional `variantId`, product name/SKU/size/color snapshots, `unitPrice`, `quantity`, `lineTotal`.

- [ ] Preserve purchase-time product details and price, even if a product later changes or is archived.
- [ ] Validate quantity and price values.

#### `Payment`

Suggested fields: `id`, `orderId`, provider, provider transaction reference, amount, currency, status, timestamps.

- [ ] Store provider references, not card secrets.
- [ ] Handle multiple payment attempts if the provider/workflow requires them.

### 9.2 Additional tables/models

Add when the feature is in scope:

- `InventoryMovement`: variant, quantity delta, before/after quantity if used, reason, actor, related order, timestamp.
- `OrderStatusHistory`: order, prior/new status, actor/system source, note, timestamp.
- `PaymentEvent`: provider event ID, payment/order reference, event type, verification result, processing status, timestamp; uniquely identify events to prevent duplicate processing.
- `Refund`: payment/order, amount, reason, provider reference, status, timestamps.
- `Session` or `RefreshToken`: only if needed for the selected authentication strategy.
- `PasswordResetToken`: store a secure token hash and expiry, not a reusable plaintext token.
- `Coupon` and `CouponRedemption`.
- `Review`.
- `Wishlist` and `WishlistItem`.
- `Banner`.
- `AuditLog`.
- `Role`/`Permission` join models if simple role checks are insufficient.
- `ShippingZone`/`ShippingRule` if delivery fees vary by area, weight, cart total, or service.

### 9.3 Database integrity tasks

- [ ] Add foreign keys, unique constraints, check constraints, and indexes.
- [ ] Define `onDelete` behavior explicitly for each relationship.
- [ ] Use transactions for order creation and inventory updates.
- [ ] Protect against overselling with appropriate row locking, conditional updates, or another concurrency-safe stock strategy.
- [ ] Use atomic/idempotent processing for webhooks and retry-prone actions.
- [ ] Keep schema changes in versioned migrations.
- [ ] Create development seed data with fake accounts/products only.
- [ ] Test restoring a database backup.

---

## 10. REST API Checklist

Use a consistent prefix such as `/api/v1`. Return consistent JSON responses and meaningful HTTP status codes. Enforce permissions on the backend, not just in Angular.

### 10.1 Authentication and account

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public, rate-limited | Register customer |
| POST | `/auth/login` | Public, rate-limited | Login |
| POST | `/auth/logout` | Authenticated | End session |
| GET | `/auth/me` | Authenticated | Current user |
| POST | `/auth/forgot-password` | Public, rate-limited | Request reset |
| POST | `/auth/reset-password` | Reset-token validated | Reset password |
| PATCH | `/users/me` | Authenticated | Update own profile |
| PATCH | `/users/me/password` | Authenticated | Change password |

### 10.2 Public catalog

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/categories` | Public | List active categories |
| GET | `/categories/:slug` | Public | Category details/products if designed that way |
| GET | `/products` | Public | Paginated products and filters |
| GET | `/products/:slug` | Public | Product details and variants |
| GET | `/search` | Public, rate-limited | Product search |

### 10.3 Cart and checkout

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/cart` | Authenticated or supported guest cart | Read cart |
| POST | `/cart/items` | Cart owner/guest session | Add item |
| PATCH | `/cart/items/:id` | Cart owner/guest session | Change quantity |
| DELETE | `/cart/items/:id` | Cart owner/guest session | Remove item |
| DELETE | `/cart` | Cart owner/guest session | Clear cart if supported |
| GET | `/addresses` | Authenticated customer | List addresses |
| POST | `/addresses` | Authenticated customer | Create address |
| PATCH | `/addresses/:id` | Address owner | Update address |
| DELETE | `/addresses/:id` | Address owner | Delete address |
| POST | `/orders` | Authorized checkout flow | Validate and create order |
| GET | `/orders/my` | Authenticated customer | Own order list |
| GET | `/orders/:id` | Owner or authorized admin | Order details |
| POST | `/orders/:id/cancel` | Owner/admin as allowed | Request or execute cancellation |

### 10.4 Payments and provider callbacks

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/payments/initiate` | Authorized checkout user | Start payment |
| GET/POST | `/payments/return/:provider` | Provider-dependent | Handle return flow safely |
| POST | `/payments/webhook/:provider` | Provider signature verification | Process trusted provider event |

The exact return and callback methods depend on the chosen gateway. Webhooks must verify signatures or use the provider's trusted verification process; make event handling idempotent.

### 10.5 Admin APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard` | Admin/authorized role | Summary metrics |
| GET | `/admin/reports/sales` | Authorized role | Sales report |
| GET | `/admin/products` | Catalog manager/admin | Product list |
| POST | `/admin/products` | Catalog manager/admin | Create product |
| PATCH | `/admin/products/:id` | Catalog manager/admin | Update product |
| POST | `/admin/products/:id/images` | Catalog manager/admin | Upload/manage images |
| GET | `/admin/categories` | Catalog manager/admin | Category list |
| POST | `/admin/categories` | Catalog manager/admin | Create category |
| PATCH | `/admin/categories/:id` | Catalog manager/admin | Update category |
| GET | `/admin/inventory` | Inventory role/admin | Stock view |
| POST | `/admin/inventory/adjustments` | Inventory role/admin | Stock adjustment with reason |
| GET | `/admin/orders` | Order role/admin | Search/filter orders |
| GET | `/admin/orders/:id` | Order role/admin | Order detail |
| PATCH | `/admin/orders/:id/status` | Order role/admin | Update permitted status |
| GET | `/admin/customers` | Authorized role | Customer list |
| GET | `/admin/payments` | Payment role/admin | Payment list/reconciliation |
| POST | `/admin/refunds` | Payment role/admin | Initiate supported refund |
| GET/POST/PATCH | `/admin/coupons...` | Admin/marketing role | Coupons (optional) |
| GET/POST/PATCH | `/admin/banners...` | Admin/marketing role | Banners (optional) |
| GET | `/admin/staff` | Admin | Staff administration |
| GET | `/admin/audit-logs` | Admin/auditor role | Audit history |

> Define exact DTOs, status codes, pagination format, and error format in an API specification or Postman collection. Do not expose internal database records blindly.

---

## 11. Business Workflows and Rules

### 11.1 Product and stock workflow

- [ ] Products can be draft, active, or archived.
- [ ] Only active and available variants can be purchased.
- [ ] SKU identifies a sellable variant.
- [ ] Inventory changes are tracked.
- [ ] Admin manual adjustment requires permission and a reason.
- [ ] Stock checks happen during checkout, not only when the product page loads.

### 11.2 Order lifecycle

Agree on exact state transitions before coding. A typical single-store workflow might use:

`PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED`

Possible alternate transitions include `CANCELLED`, `FAILED`, and `RETURN_REQUESTED`/`RETURNED`, depending on the business. These are examples, not a universal state machine. Prevent invalid transitions and record each permitted transition.

- [ ] Define who can trigger each transition.
- [ ] Define how COD orders are confirmed and marked paid after collection.
- [ ] Define what happens to reserved/deducted stock after cancellation or payment failure.
- [ ] Define order edits after placement, if any.
- [ ] Define notification timing.

### 11.3 Payment lifecycle

- [ ] Separate order status from payment status.
- [ ] Recalculate the total on the server at payment initiation.
- [ ] Verify amount, currency, provider reference, and transaction result.
- [ ] Process duplicate provider events safely.
- [ ] Handle pending, successful, failed, expired, and refunded payment states as supported.
- [ ] Reconcile payment records and orders.
- [ ] Never trust a client-supplied `paid: true` value or browser success page.

### 11.4 Pricing and money

- [ ] Define the store currency and decimal/rounding rules.
- [ ] Calculate product subtotals from database prices.
- [ ] Apply discount rules on the backend.
- [ ] Calculate shipping from configured server-side rules.
- [ ] Store a purchase-time price snapshot for each order item.
- [ ] Define sales-report treatment for unpaid COD, cancelled orders, and refunds.

---

## 12. Security and Privacy Checklist

### Authentication and access

- [ ] Hash passwords using Argon2id or bcrypt with appropriate settings.
- [ ] Never store plaintext passwords, raw card numbers, or card security codes.
- [ ] Enforce backend authentication and authorization on every private endpoint.
- [ ] Verify order/address ownership on every request.
- [ ] Keep customer and admin permission models distinct.
- [ ] Prevent public registration from assigning admin privileges.
- [ ] Apply rate limits to login, password reset, payment initiation, and other abuse-prone flows.
- [ ] Use secure cookie attributes or a carefully designed token scheme.
- [ ] Protect cookie-based flows from CSRF.
- [ ] Use secure password-reset tokens with expiration and one-time use.

### API, files, and infrastructure

- [ ] Validate all request bodies, query parameters, and path parameters.
- [ ] Use parameterized database queries or Prisma.
- [ ] Configure CORS with an explicit allow-list.
- [ ] Use HTTPS in production.
- [ ] Set appropriate security headers.
- [ ] Limit upload sizes and allowed file types; verify uploads server-side.
- [ ] Store secrets in environment variables/secrets manager, not Git or frontend bundles.
- [ ] Use least-privilege database credentials.
- [ ] Keep dependencies updated and review vulnerabilities.
- [ ] Avoid leaking stack traces, personal data, tokens, or secrets in logs/errors.
- [ ] Configure backups, monitoring, and an incident response process.

### Privacy and policy

- [ ] Collect only necessary customer data.
- [ ] Define access and retention rules for customer information and logs.
- [ ] Publish accurate privacy, terms, delivery, cancellation, returns, and refund policies.
- [ ] Confirm legal, tax, consumer-protection, and payment obligations for the business before launch.

---

## 13. Testing and QA

### 13.1 Frontend tests

- [ ] Navigation, routes, and 404 page.
- [ ] Product listing, filters, sort, and pagination.
- [ ] Search queries and no-results behavior.
- [ ] Product variants and quantity control.
- [ ] Cart add/update/remove behavior.
- [ ] Form validation and helpful messages.
- [ ] Login/logout and session expiry.
- [ ] Admin route behavior and permissions in the UI.
- [ ] Checkout loading/error/success states.
- [ ] Responsive behavior at common viewport sizes.
- [ ] Keyboard navigation, labels, focus states, and contrast.

### 13.2 Backend and database tests

- [ ] Registration, login, logout, password reset.
- [ ] Invalid/expired credentials and permission denial.
- [ ] Product/category create, update, archive, and validation.
- [ ] Pagination and filters.
- [ ] Cart validation and total calculations.
- [ ] Concurrent purchase/stock consistency tests.
- [ ] Order creation and duplicate-request/idempotency tests.
- [ ] Invalid order status transitions.
- [ ] Payment signature verification and duplicate webhook tests.
- [ ] Refund workflow where supported.
- [ ] Database constraint and transaction rollback tests.
- [ ] Upload validation and access controls.

### 13.3 End-to-end acceptance test

- [ ] Open homepage.
- [ ] Navigate to category and search products.
- [ ] Open product detail and select valid size/color.
- [ ] Add to cart and change quantity.
- [ ] Log in or enter guest checkout details.
- [ ] Add/select delivery address.
- [ ] Select payment method and place order.
- [ ] Verify correct total and order confirmation.
- [ ] Verify order in customer account.
- [ ] Log in to admin dashboard.
- [ ] Find and process the order through permitted statuses.
- [ ] Verify stock and payment records.
- [ ] Verify unauthorized users cannot read or change the order.
- [ ] Verify duplicate payment callbacks do not duplicate side effects.

### 13.4 Performance and browser QA

- [ ] Test supported desktop/mobile browsers.
- [ ] Optimize images and lazy-load below-the-fold content.
- [ ] Avoid unnecessary requests and repeated rendering.
- [ ] Check page loading and layout shifts.
- [ ] Check database query performance for large product/order lists.
- [ ] Test backup restoration.

---

## 14. Deployment and Operations

### 14.1 Environment configuration

- [ ] Choose frontend hosting, backend hosting, and PostgreSQL hosting.
- [ ] Create separate development/test/production settings.
- [ ] Configure database URL, session/auth secrets, image-storage keys, payment secrets, and allowed origins securely.
- [ ] Ensure `.env` is ignored by Git.
- [ ] Ensure no secret is shipped in Angular environment files or compiled bundles.
- [ ] Set up the production domain and HTTPS.
- [ ] Configure database migrations and backup retention.

Example `.env.example` variable names (fill values locally; do not commit secrets):

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=
FRONTEND_ORIGIN=http://localhost:4200
SESSION_SECRET=
# Or the values needed for the selected JWT/session strategy
IMAGE_STORAGE_CLOUD_NAME=
IMAGE_STORAGE_API_KEY=
IMAGE_STORAGE_API_SECRET=
PAYMENT_PROVIDER_MERCHANT_ID=
PAYMENT_PROVIDER_SECRET=
PAYMENT_PROVIDER_WEBHOOK_SECRET=
```

Use only the variables needed by your chosen providers. Do not put private backend secrets in Angular configuration.

### 14.2 Frontend deployment

- [ ] Create a production Angular build.
- [ ] Set the production API URL.
- [ ] Configure SPA route fallback.
- [ ] Confirm refresh works on nested routes.
- [ ] Confirm assets and product images load securely.
- [ ] Verify no credentials/secrets are bundled.

### 14.3 Backend deployment

- [ ] Configure production start command.
- [ ] Apply reviewed database migrations.
- [ ] Verify health/readiness endpoints.
- [ ] Verify CORS, HTTPS, session/cookie settings, and security headers.
- [ ] Verify production payment callback URLs and signatures.
- [ ] Verify database access and object-storage access.
- [ ] Configure error reporting and structured logs.
- [ ] Test graceful restart and recovery behavior.

### 14.4 Monitoring and operations

- [ ] Schedule and monitor database backups.
- [ ] Test restoring backups periodically.
- [ ] Monitor application errors and uptime.
- [ ] Monitor failed payments and stuck orders.
- [ ] Monitor database size/capacity and slow queries.
- [ ] Define a process for dependency updates and security incidents.
- [ ] Document how to roll back a release or restore service.

---

## 15. Suggested Timeline

A rough estimate for one developer working consistently. Actual duration depends on experience, feature decisions, and payment/courier onboarding.

| Week | Focus | Exit criteria |
|---|---|---|
| 1 | Requirements, design, repository, Angular/Express setup | Both apps run locally; design direction approved |
| 2 | PostgreSQL schema, Prisma migrations, catalog APIs | Product/category data can be created and read |
| 3 | Storefront layout, homepage, listings, search, product details | Customers can browse the catalog |
| 4 | Authentication, account, addresses, cart | Customer/cart flows are usable |
| 5 | Checkout, orders, inventory consistency, COD workflow | Order lifecycle passes tests |
| 6 | Admin layout, products, categories, inventory, orders | Staff can manage core store operations |
| 7 | Online payments, customer support workflows, dashboard metrics | Payment path tested in sandbox if used |
| 8 | Automated tests, responsive QA, security review | Release candidate passes key tests |
| 9 | Deployment, backups, monitoring, production verification | Production-ready launch checklist complete |
| 10 | Contingency and launch fixes | Critical issues resolved |

---

## 16. Recommended Build Order

Work through this order to avoid building features on unstable foundations.

1. [ ] Confirm requirements and MVP scope.
2. [ ] Set up Git repository and project skeleton.
3. [ ] Set up PostgreSQL, Prisma, migrations, and seed data.
4. [ ] Build Express foundation, validation, errors, and health endpoint.
5. [ ] Build category and product APIs.
6. [ ] Build Angular design system, header/footer, homepage, and catalog pages.
7. [ ] Build product detail with size/color/SKU variants.
8. [ ] Build protected admin login and role checks.
9. [ ] Build admin product/category management.
10. [ ] Build authentication and customer profile/address management.
11. [ ] Build cart and server-side price/stock validation.
12. [ ] Implement transactional order creation and inventory concurrency controls.
13. [ ] Implement COD workflow.
14. [ ] Integrate and verify an online gateway if needed.
15. [ ] Build customer order history and tracking.
16. [ ] Complete admin order processing, payments, and reporting.
17. [ ] Complete automated tests, security review, and responsive QA.
18. [ ] Deploy frontend, backend, database, and object storage.
19. [ ] Verify backups, monitoring, policies, and launch criteria.
20. [ ] Add optional features after the MVP is stable.

---

## 17. Task Definition of Done

A feature is complete only when:

- [ ] Implementation is finished in the correct layer.
- [ ] User inputs are validated on the backend and appropriately on the frontend.
- [ ] Backend authorization is enforced for private/admin operations.
- [ ] Loading, empty, success, and error states are handled where relevant.
- [ ] Important business rules have tests.
- [ ] The UI has been checked on required screen sizes.
- [ ] No secrets or sensitive information are exposed.
- [ ] Relevant docs/API examples are updated.
- [ ] Changes are committed to Git and reviewed.

---

## 18. Final Launch Checklist

### Storefront

- [ ] All public pages and navigation work.
- [ ] Product search, filters, sorting, and pagination work.
- [ ] Product images, variants, prices, and stock are correct.
- [ ] Cart and checkout totals come from trusted backend calculations.
- [ ] Customer account and order history work.
- [ ] Mobile and desktop layouts are usable.
- [ ] Contact details and relevant policies are published.

### Admin dashboard

- [ ] Admin login and authorization are tested.
- [ ] Product and category management works.
- [ ] Variant-level stock and adjustments are auditable.
- [ ] Orders can be found and processed.
- [ ] Payment/refund access is restricted.
- [ ] Reports use clearly defined calculations.
- [ ] Staff permissions are tested if staff accounts exist.

### Backend and operations

- [ ] Database migrations are applied and reviewed.
- [ ] Order creation and inventory updates are transaction/concurrency safe.
- [ ] Payment callbacks are verified and idempotent.
- [ ] Error responses do not expose stack traces or secrets.
- [ ] HTTPS, CORS, security headers, rate limits, and session settings are correct.
- [ ] Production secrets are stored safely.
- [ ] Backup restoration has been tested.
- [ ] Monitoring and error logging are enabled.
- [ ] Production end-to-end checkout has been verified safely.

---

## 19. Official Documentation

- Angular: https://angular.dev/
- Express.js: https://expressjs.com/
- PostgreSQL: https://www.postgresql.org/docs/
- Prisma: https://www.prisma.io/docs
- Node.js: https://nodejs.org/en/docs

Check current supported versions and deployment/payment-provider documentation while implementing, as tooling and provider requirements can change.

---

## Project Completion Definition

The first version is ready when customers can reliably browse the catalog, choose the correct product variant, place an order with a valid total, receive accurate order status, and access their own order history; administrators can securely manage products, inventory, and orders; and the production application has been tested, deployed over HTTPS, and backed up.

**Keep this file as the master checklist.** Create individual GitHub issues for each major task, check items only after they meet the definition of done, and keep optional features out of the critical path until the MVP is reliable.


## Project Action & Command Execution Log

| Timestamp (UTC) | Agent / Actor | Action / Command | Scope / Files Modified | Rationale / Outcome |
|---|---|---|---|---|
| 2026-11-07T20:04:19.176Z | worker_m1_iter1_1 | `init action logger` | `Plan.md, plan.md, scripts/log-action.*` | Initialized synchronized project action logging protocol |
| 2026-11-07T20:07:35.859Z | worker_m1_iter1_1 | `baseline verification` | `frontend/tests, frontend/build, backend/tests` | Frontend: 77/77 tests passed, build succeeded. Backend baseline verified. |
| 2026-11-07T20:09:00.491Z | worker_m1_iter1_1 | `apply migration 003` | `database/migrations/003_commerce_discounts_and_advances.sql, database/schema.sql` | Applied migration 003 adding discount and advance payment columns to products, orders, order_items |
| 2026-11-07T20:15:19.216Z | worker_m1_iter1_1 | `backend core commerce updates` | `backend/src/routes, models, controllers` | Implemented manual payment routes/clamps/verify-payment, product discount precedence & calculation, advance payment calculation & enforcement |
| 2026-11-07T20:17:18.429Z | worker_m1_iter1_1 | `backend tests passed` | `backend/tests/m1-commerce-strategy.test.js` | All 238 backend tests across 67 suites passed with 0 failures |
| 2026-11-07T20:26:13.927Z | Implement ProductFormComponent discounts (type, value, live preview) and advance payment options selector with unit tests | `frontend/src/app/features/admin/products/product-form/product-form.component.ts, frontend/src/app/features/admin/products/product-form/product-form.component.spec.ts` | `N/A` | Milestone 1 Implementation |
| 2026-11-07T20:30:27.125Z | Implement CheckoutComponent Manual Payment Gateway, City Bank PLC instructions, required advance calculation, and unbacked COD blocking | `frontend/src/app/features/storefront/checkout/checkout.component.ts, frontend/src/app/features/storefront/checkout/checkout.component.spec.ts` | `N/A` | Milestone 1 Implementation |
| 2026-11-07T20:33:07.350Z | Implement AdminOrdersComponent dynamic payment method display, transaction ID, sender phone, and Verify Manual Payment button calling backend verify-payment API | `frontend/src/app/features/admin/orders/admin-orders.component.ts, frontend/src/app/features/admin/orders/admin-orders.component.spec.ts` | `N/A` | Milestone 1 Implementation |
| 2026-11-07T20:36:36.150Z | Implement OrderConfirmationComponent dynamic confirmation receipt, standalone HTML invoice download, and print styles | `frontend/src/app/features/storefront/orders/order-confirmation.component.ts, frontend/src/app/features/storefront/orders/order-confirmation.component.spec.ts, frontend/src/styles.scss` | `N/A` | Milestone 1 Implementation |
| 2026-11-07T20:36:42.086Z | Verification: Run full backend test suite (238/238 passing across 67 suites), frontend test suite (88/88 passing across 21 files), and frontend production build | `backend/tests, frontend/src` | `N/A` | Milestone 1 Implementation |
| 2026-11-07T20:45:06.057Z | challenger_m1_iter1_2 | `frontend-test` | `frontend/src/app/features/storefront/orders/order-confirmation.challenger.spec.ts` | Milestone 1 Receipt integrity & payment methods test matrix (20 tests passed) |
| 2026-11-07T20:47:37.374Z | challenger_m1_iter1_2 | `backend-adversarial-test` | `tests/adversarial/challenger-m1-advance-checkout.test.js` | Milestone 1 Advance payment boundaries, zero-advance defense, IEEE-754 BDT rounding, concurrency stress (13 tests passed) |
| 2026-11-07T20:48:08.641Z | challenger_m1_iter1_1 | `empirical adversarial verification` | `backend/tests/challenger-m1-deep-adversarial.test.js` | Executed 21 empirical stress tests verifying manual payments, advance payment rules, product discounts, and action logging |
| 2026-11-07T21:02:25.135Z | worker_m2_iter1_1 | `create Mavllin AI Brain.md` | `Mavllin AI Brain.md` | Instantiated official atelier guidelines and AI rule engine knowledge base (R4) |
| 2026-11-07T21:03:32.333Z | worker_m2_iter1_1 | `apply migration 004` | `database/migrations/004_unified_messaging_schema.sql, database/schema.sql` | Created and executed DDL for messaging_conversations and messaging_messages (R4) |
| 2026-11-07T21:05:40.690Z | worker_m2_iter1_1 | `create messaging adapters` | `backend/src/services/messaging-adapters/*` | Implemented BaseAdapter, FacebookAdapter, WhatsAppAdapter, MockAdapter, and AdapterFactory (R4) |
| 2026-11-07T21:07:52.319Z | worker_m2_iter1_1 | `implement messaging DAL & APIs` | `backend/src/models/messaging.model.js, backend/src/controllers/messaging.controller.js, backend/src/routes/messaging.routes.js, backend/src/routes/admin.routes.js, backend/src/routes/index.js` | Added messaging conversations/messages CRUD, webhook endpoints, and admin APIs (R4) |
| 2026-11-07T21:09:29.602Z | worker_m2_iter1_1 | `wire N8N order webhook` | `backend/src/services/n8n-webhook.service.js, backend/src/controllers/order.controller.js` | Implemented non-blocking setImmediate N8N webhook with DeepSeek prompt and mock support (R5) |
| 2026-11-07T21:12:25.985Z | worker_m2_iter1_1 | `run backend test verification` | `backend/tests/ai-messaging.test.js, backend/tests/messaging-unified.test.js, backend/tests/n8n-webhook.test.js` | Verified all 283 backend tests pass with 0 failures across 78 suites |
| 2026-11-07T21:16:48.907Z | worker_m2_iter1_1 | `implement frontend admin messaging UI` | `frontend/src/app/core/services/messaging.service.ts, frontend/src/app/features/admin/messages/*, frontend/src/app/app.routes.ts, frontend/src/app/layouts/admin-layout/admin-layout.component.ts` | Created unified messaging service, AdminMessagesComponent with tabs, bubbles, reply composer, AI toggle, and unit tests (R4) |
| 2026-11-07T21:17:30.588Z | worker_m2_iter1_1 | `run frontend test and build verification` | `frontend/dist/eco-storefront` | Verified all 117 frontend tests pass (23 test files) and production bundle compiles cleanly with 0 errors |
| 2026-11-07T21:20:28.059Z | worker_m2_iter1_1 | `Complete Milestone 2 Handoff & Verification` | `.agents/teamwork/worker_m2_iter1_1/handoff.md` | Completed all Milestone 2 R4/R5 deliverables including Mavllin AI Brain, unified messaging schema/adapters/engine, N8N order alerts, and admin messaging UI with 100% test pass rates |
| 2026-11-07T21:36:16.994Z | challenger_m2_iter1_1 | `run empirical challenger adversarial suite` | `backend/tests/challenger-m2-deep-adversarial.test.js` | Executed 27 adversarial stress tests probing sizing boundaries, Banglish mirroring, escalation triggers, webhook defenses, and N8N non-blocking SLA |
| 2026-11-07T21:38:45.042Z | challenger_m2_iter1_2 | `Adversarial empirical stress testing on M2 Unified Messaging & N8N Automation` | `backend/tests/milestone2-challenger-stress.test.js, frontend/src/app/features/admin/messages/admin-messages.challenger.spec.ts` | Created 19 backend stress tests and 17 frontend Vitest challenger tests verifying UI reactivity, webhook edge cases, and non-blocking resilience; verified 100% pass across 335 backend tests and 134 frontend tests |
| 2026-11-07T21:55:55.820Z | worker_m2_remed_1 | `Remediate ai-messaging.service.js` | `backend/src/services/ai-messaging.service.js` | Fixed 4-digit pricing intent hijacking, kobe pabo delivery disambiguation, expanded escalation triggers, low confidence handoff, and Banglish response templates |
| 2026-11-07T21:56:41.336Z | worker_m2_remed_1 | `Remediate adapter.factory.js` | `backend/src/services/messaging-adapters/adapter.factory.js` | Hoisted supported channel validation in getAdapter so unsupported channels throw Unsupported messaging channel in all modes |
| 2026-11-07T21:57:00.675Z | worker_m2_remed_1 | `Update app.js rawBody capture` | `backend/src/app.js` | Configured express.json verify callback to attach raw buffer req.rawBody for Meta webhook HMAC-SHA256 signature verification |
| 2026-11-07T21:57:56.804Z | worker_m2_remed_1 | `Implement HMAC-SHA256 signature verification` | `backend/src/controllers/messaging.controller.js, backend/src/routes/messaging.routes.js, backend/src/config/env.js, backend/.env.example` | Integrated HMAC-SHA256 signature verification via timingSafeEqual for Meta webhooks with app secrets in config and route middleware |
| 2026-11-07T21:58:20.762Z | worker_m2_remed_1 | `Remediate n8n-webhook.service.js safe address parsing` | `backend/src/services/n8n-webhook.service.js` | Introduced parseShippingAddress to safely parse plain text, JSON string, or object addresses, eliminating SyntaxError and preventing WhatsApp alert drop |
| 2026-11-07T21:59:50.707Z | worker_m2_remed_1 | `Update milestone2-challenger-stress.test.js` | `backend/tests/milestone2-challenger-stress.test.js` | Updated challenger stress suite to assert channel rejection in all modes, valid/forged HMAC signature verification, 4-digit pricing inquiry accuracy, and safe plain address parsing |
| 2026-11-08T00:56:42.744Z | main_agent_m3 | `implement MailService & order/payment email hooks` | `backend/src/services/mail.service.js, backend/src/config/env.js, backend/src/models/setting.model.js, backend/src/routes/order.routes.js, backend/src/routes/admin.routes.js, backend/src/controllers/order.controller.js` | Implemented R7 order confirmation emails, R10 payment status (done/payment successful/paid) and order status (confirmed/dispatch/shipped/delivered/cancelled) notification emails, and R9 promo popup store settings |
| 2026-11-08T01:01:28.477Z | Milestone 3 (Frontend) | `Created PromoPopupComponent (R9) with session dismissal and target product section navigation, mounted in StorefrontLayoutComponent, and added Promotional Popup settings form to AdminDeliverySettingsComponent` | `frontend/src/app/shared/components/promo-popup/promo-popup.component.ts, frontend/src/app/shared/components/promo-popup/promo-popup.component.spec.ts, frontend/src/app/layouts/storefront-layout/storefront-layout.component.ts, frontend/src/app/features/admin/delivery-settings/admin-delivery-settings.component.ts` | PASS |
| 2026-11-08T01:06:48.789Z | Milestone 4 (Verification & Audit) | `Expanded E2E test suite tests/e2e/mavllin-journey.test.js for R2-R10, executed full 6-phase master verification pipeline scripts/verify-mavllin.sh (346 backend tests, 84 frontend tests, production AoT build, 10 E2E scenarios - 100% pass), and synchronized PROJECT.md and TEST_READY.md` | `tests/e2e/mavllin-journey.test.js, tests/e2e/helpers/api-client.js, backend/src/routes/admin.routes.js, PROJECT.md, TEST_READY.md` | PASS |
| 2026-11-08T01:55:56.404Z | Implementation | `Created NgxUI standalone components (border-beam, background-beams, shiny-text, marquee) and global CSS animations` | `frontend/src/app/shared/components/ngxui/*, frontend/src/styles.scss` | Created components and global styles |
| 2026-11-08T02:02:34.485Z | Integration | `Integrated NgxBackgroundBeams, NgxBorderBeam, NgxShinyText, NgxMarquee, and btn-shimmer across storefront templates` | `home.component.ts, product-card.component.ts, promo-popup.component.ts, product-detail.component.ts, cart-drawer.component.ts, checkout.component.ts, navbar.component.ts` | Clean compilation and 143 passing unit tests |
| 2026-11-08T02:11:58.901Z | Review QA | `Fix border-beam click interception, standard mask property, and mask-composite fallback` | `frontend/src/app/shared/components/ngxui/border-beam.component.ts` | COMPLETED |
| 2026-11-08T02:12:23.125Z | Review QA | `Fix shiny-text invalid inherit in linear-gradient causing invisible text, set currentColor, and add progressive enhancement fallback` | `frontend/src/app/shared/components/ngxui/shiny-text.component.ts` | COMPLETED |
| 2026-11-08T02:13:01.076Z | Review QA | `Add instance-unique SVG gradient IDs and robust stop-color bindings in background-beams` | `frontend/src/app/shared/components/ngxui/background-beams.component.ts` | COMPLETED |
| 2026-11-08T02:13:20.904Z | Review QA | `Hide duplicate cloned marquee node in reduced motion mode` | `frontend/src/app/shared/components/ngxui/marquee.component.ts` | COMPLETED |
| 2026-11-08T02:13:55.247Z | Review QA | `Add disabled shimmer suppression and standard mask support with @supports guard for spotlight card` | `frontend/src/styles.scss` | COMPLETED |
| 2026-11-08T02:14:23.227Z | Review QA | `Add tests for pointer-events, unique SVG gradient IDs, and currentColor text sanitization` | `frontend/src/app/shared/components/ngxui/ngxui-components.spec.ts` | COMPLETED |
| 2026-11-08T02:16:29.924Z | Review QA | `Add --test-concurrency=1 to backend test script` | `backend/package.json` | COMPLETED |
| 2026-11-08T02:31:20.611Z | Review QA | `Harmonize background-beams SVG dash periods to 960 and optimize mobile GPU composite blur` | `frontend/src/app/shared/components/ngxui/background-beams.component.ts` | COMPLETED |
| 2026-11-08T02:31:48.530Z | Review QA | `Enhance border-beam with dual-mode relative/absolute host styling, explicit mask-clip properties, and 300% centered rotating track` | `frontend/src/app/shared/components/ngxui/border-beam.component.ts` | COMPLETED |
| 2026-11-08T02:32:11.899Z | Review QA | `Add max-width safety and solid color reset under reduced-motion in shiny-text` | `frontend/src/app/shared/components/ngxui/shiny-text.component.ts` | COMPLETED |
| 2026-11-08T02:32:34.398Z | Review QA | `Guard marquee hover pause with @media (hover: hover) and add inert attribute to cloned node for accessibility` | `frontend/src/app/shared/components/ngxui/marquee.component.ts` | COMPLETED |
| 2026-11-08T02:33:01.082Z | Review QA | `Add gold shimmer contrast for light buttons, explicit mask-clip, inset 0, and hover-hover guard for spotlight cards` | `frontend/src/styles.scss` | COMPLETED |
| 2026-11-08T02:33:47.673Z | Review QA | `Elevate hero-overlay to z-index: 3 and hero-controls to z-index: 4 in home.component.ts` | `frontend/src/app/features/storefront/home/home.component.ts` | COMPLETED |
| 2026-11-08T02:34:05.302Z | Review QA | `Add btn-shimmer to primary Proceed to Checkout button on cart page` | `frontend/src/app/features/storefront/cart/cart.component.ts` | COMPLETED |
| 2026-11-08T02:34:33.423Z | Review QA | `Add tests for 960px SVG ray dash period synchronization and inert attribute on cloned marquee node` | `frontend/src/app/shared/components/ngxui/ngxui-components.spec.ts` | COMPLETED |
| 2026-11-08T02:49:26.121Z | Review QA Round 3 | `Resolve hero stacking context entrapment, implement offscreen animation pausing via IntersectionObserver, enforce square aspect ratio on border-beam rotating track, strip cloned marquee IDs, and correct announcement bar shimmer contrast` | `border-beam.component.ts, background-beams.component.ts, marquee.component.ts, shiny-text.component.ts, home.component.ts, navbar.component.ts, styles.scss, ngxui-components.spec.ts` | COMPLETED |
| 2026-11-08T02:52:25.753Z | Victory Audit | `Initiate Victory Audit for NgxUI integration` | `.agents/teamwork/auditor_1` | IN_PROGRESS |
| 2026-11-08T02:56:11.572Z | Victory Audit | `Completed independent test execution and forensic verification` | `frontend/src/app/shared/components/ngxui/*` | PASS |
| 2026-11-08T09:17:55.566Z | Diagnosis | `Diagnose promotional popup visibility, interaction, admin settings fallback, and spec test suite` | `frontend/src/app/shared/components/promo-popup/promo-popup.component.ts, frontend/src/app/shared/components/promo-popup/promo-popup.component.spec.ts` | COMPLETED |
| 2026-11-08T09:20:16.002Z | Implementation | `Fix PromoPopupComponent display reliability, escape key handling, layer stacking, safe routing fallback, and expanded spec test matrix` | `frontend/src/app/shared/components/promo-popup/promo-popup.component.ts, frontend/src/app/shared/components/promo-popup/promo-popup.component.spec.ts` | COMPLETED |
| 2026-11-08T09:20:24.672Z | Verification | `Execute full frontend test suite (156/156 passed across 26 test files), production build check, and master E2E journey test` | `frontend/src/app/shared/components/promo-popup/*, tests/e2e/mavllin-journey.test.js` | PASS |
| 2026-11-08T09:32:44.079Z | Adversarial Review & QA | `Fix promo popup clock skew tolerance, session fallback under storage denial, WebKit blur prefix, touch backdrop cursor, external URL redirect, and accessibility` | `frontend/src/app/shared/components/promo-popup/promo-popup.component.ts, frontend/src/app/shared/components/promo-popup/promo-popup.component.spec.ts` | COMPLETED |
| 2026-11-08T09:41:14.483Z | Adversarial Review Round 2 | `Audit promotional popup implementation` | `frontend/src/app/shared/components/promo-popup/*` | In Progress |
| 2026-11-08T09:44:48.576Z | Adversarial Reviewer R2 | `Harden promotional popup: isolated storage fallbacks, in-memory cross-instance suppression, focus trap, body scroll lock, protocol normalization, touch enlargement` | `frontend/src/app/shared/components/promo-popup/promo-popup.component.ts, frontend/src/app/shared/components/promo-popup/promo-popup.component.spec.ts` | Completed |
| 2026-11-08T10:00:06.797Z | Adversarial Reviewer R3 | `Hardened promo popup with safe integer timestamp validation, auto-healing of corrupted storage, mailto/tel external communication scheme routing, file/blob disallowed protocol neutralization, WCAG 2.1 focus restoration on close, BroadcastChannel cross-tab synchronization, GPU blur transform layer acceleration, and comprehensive adversarial unit tests` | `frontend/src/app/shared/components/promo-popup/promo-popup.component.ts, frontend/src/app/shared/components/promo-popup/promo-popup.component.spec.ts` | COMPLETED |
| 2026-11-08T10:07:38.902Z | Victory Audit | `Independent post-victory audit: timeline analysis, test execution verification, cheating detection` | `frontend/src/app/shared/components/promo-popup/*, Plan.md` | IN_PROGRESS |
| 2026-11-08T10:09:38.189Z | Victory Audit | `Complete independent Victory Audit: VERDICT VICTORY CONFIRMED (181/181 frontend tests, 38/38 promo specs, production build passed, 10/10 E2E passed)` | `.agents/teamwork/teamwork_victory_auditor_1/handoff.md, Plan.md` | COMPLETED |
| 2026-11-08T10:10:18.327Z | Victory Audit | `Completed SWE Light refinement and victory audit for promotional popup fix` | `frontend/src/app/shared/components/promo-popup/*, Plan.md` | PASS |
| 2026-11-08T10:16:17.910Z | Sentinel Victory Audit | `Independent post-victory audit: 3-phase verification completed` | `frontend/src/app/shared/components/promo-popup/*, Plan.md` | COMPLETED |
| 2026-11-08T10:20:18.444Z | Git & GitHub Preparation | `Configured repository git identity, staged all MAVLLIN platform source/test/database files, and created initial production commit ready for GitHub push` | `.gitignore, Plan.md, plan.md` | PASS |
| 2026-11-08T10:42:44.977Z | GitHub Deployment | `Configured dual GitHub remotes and split branches for Mavliin-fontend and Mavllin-backend, generated SSH keypair, and created automated push script awaiting user GitHub auth` | `scripts/push-to-github.sh, Plan.md, plan.md` | IN_PROGRESS |
| 2026-11-08T10:43:35.034Z | GitHub Deployment | `Configured dual GitHub remotes (origin, backend, frontend, backend-ssh, frontend-ssh), split dedicated frontend-main and backend-main release branches, generated ed25519 SSH keypair, and created push-to-github.sh automation` | `scripts/push-to-github.sh, Plan.md, plan.md` | COMPLETED |