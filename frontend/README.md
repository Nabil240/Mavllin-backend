# MAVLLIN E-Commerce — Storefront Frontend

MAVLLIN Storefront is an Angular 19 standalone web application crafted with an Arjo BD minimalist aesthetic, NGXUI visual effects, responsive mobile design, and full e-commerce flows (catalog, search, variant selection, cart, multi-channel checkout, order tracking, and administrative control panels).

---

## Key Features

- **Storefront Architecture**: Angular 19 standalone components, signals, and functional guards/interceptors
- **Visual Design**: Arjo BD minimalist aesthetic, SCSS variables, NGXUI effects (border beams, background rays, marquees, shimmer buttons)
- **Catalog & Discovery**: Category browsing, multi-variant filtering (size, color, price range), search, and promotional popups
- **Cart & Checkout**:
  - Real-time cart calculations with product-specific discounts
  - Advance payment calculation and enforcement (30%, 50%, 100%, delivery-charge-first)
  - Manual mobile payment integration (bKash, Nagad, Rocket, Bank Transfer) with Transaction ID submission
  - Downloadable/printable digital receipts post-checkout
- **Customer Account**: Profile management, order tracking with real-time status updates, wishlist
- **Admin Management Panel**:
  - Product catalog management with multi-variant inventory tracking
  - Order full lifecycle management (payment verification, status transitions, stock recovery on deletion)
  - Unified customer messaging center with multi-channel adapters and AI auto-reply toggle
  - Category, coupon, and delivery settings management

---

## Directory Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/              # Guards, interceptors, models, services
│   │   ├── features/
│   │   │   ├── admin/         # Admin management dashboards and forms
│   │   │   ├── auth/          # Login, registration, password recovery
│   │   │   └── storefront/    # Public shop, catalog, cart, checkout, tracking
│   │   ├── layouts/           # StorefrontLayout and AdminLayout
│   │   └── shared/            # Shared UI components (pipes, buttons, NGXUI)
│   ├── index.html             # HTML entry template
│   ├── main.ts                # Angular bootstrap entry
│   └── styles.scss            # Global stylesheets and design tokens
├── public/                    # Static assets, SVG illustrations, and icons
├── angular.json               # Angular CLI workspace configuration
├── proxy.conf.json            # Dev server backend proxy config (/api -> :5000)
├── tsconfig.json              # TypeScript compilation configuration
└── package.json               # Frontend dependencies and scripts
```

---

## Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20 or later)
- [npm](https://www.npmjs.com/) (v10+)
- Running MAVLLIN backend server on `http://localhost:5000`

### 2. Install Dependencies
```bash
cd frontend
npm install
```

### 3. Start Development Server
```bash
npm start
# or: ng serve --proxy-config proxy.conf.json
```
Navigate to `http://localhost:4200/`. The application connects to the backend API via the proxy configured in `proxy.conf.json`.

### 4. Build for Production
```bash
npm run build
```
Compiles production bundles into `dist/eco-storefront/browser`.

### 5. Run Unit Tests
```bash
npm test
```
Executes frontend unit tests using the Vitest runner.

---

## License

Proprietary — MAVLLIN Lifestyle. All rights reserved.
