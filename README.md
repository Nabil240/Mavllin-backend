# MAVLLIN E-Commerce — Backend & Database Services

MAVLLIN is a contemporary fashion and heritage lifestyle e-commerce platform built as an API-first service with a modular Node.js/Express REST backend, MySQL 8.0 persistence, automated messaging, and N8N workflow integration.

---

## Architecture Overview

- **Runtime**: Node.js (v20+) / Express.js (v4.21+)
- **Database**: MySQL 8.0 with `mysql2/promise` connection pooling and atomic transactions (`SELECT ... FOR UPDATE`)
- **Containerization**: Docker Compose for local MySQL and phpMyAdmin orchestration
- **Messaging & AI**:
  - Multi-channel messaging adapters (`FacebookAdapter`, `WhatsAppAdapter`, `MockAdapter`)
  - AI auto-reply engine driven by `Mavllin AI Brain.md`
  - Non-blocking N8N order webhook dispatcher with DeepSeek notification configuration
- **Payment & Checkout**:
  - Manual mobile payment processing (bKash, Nagad, Rocket, Bank Transfer) with Transaction ID (TrxID) submission and admin verification
  - Advance payment enforcement (30%, 50%, 100%, delivery charge first)
  - Product-specific discounts (percentage and fixed BDT)
- **Email Notifications**:
  - Modular `MailService` (SMTP transport + in-memory test queue) for order confirmation, payment receipt, and order state transitions

---

## Directory Structure

```
├── backend/
│   ├── config/          # Database connection pool and runtime config
│   ├── controllers/     # Route handlers (admin, auth, orders, products, etc.)
│   ├── middleware/      # Auth, RBAC, error handling, rate limiting
│   ├── models/          # Data access models with transaction support
│   ├── routes/          # Express route declarations (/api/v1/...)
│   ├── services/        # Business logic (MailService, N8N, Messaging)
│   ├── package.json     # Backend dependencies and test scripts
│   └── server.js        # Main application entry point
├── database/
│   ├── schema.sql       # MySQL DDL schema (tables, foreign keys, indexes)
│   └── seeds/           # Seed data (admin user, categories, products)
├── docker-compose.yml   # MySQL 8.0 and phpMyAdmin container services
├── scripts/             # Operational, verification, and deployment scripts
└── tests/               # Unit, integration, and E2E test suites
```

---

## Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20 or later)
- [Docker](https://www.docker.com/) & Docker Compose
- [Git](https://git-scm.com/)

### 2. Environment Configuration
Copy the example environment file and adjust variables if needed:
```bash
cp backend/.env.example backend/.env
```

Key environment settings:
```env
PORT=5000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=eco_user
DB_PASSWORD=eco_password
DB_NAME=ecommerce_db
JWT_SECRET=your_jwt_secret_key_here
FRONTEND_URL=http://localhost:4200
```

### 3. Start Database via Docker
```bash
docker-compose up -d
```
This launches:
- **MySQL 8.0** on `localhost:3306` (automatically runs `01-schema.sql` and `02-seed.sql`)
- **phpMyAdmin** on `http://localhost:8080`

### 4. Install Dependencies & Start Backend
```bash
cd backend
npm install
npm run dev
```
The API server will listen on `http://localhost:5000`.

---

## Running Test Suites

Run all backend unit and integration test suites:
```bash
npm test --prefix backend
```

Run master verification suite:
```bash
bash scripts/verify-mavllin.sh
```

---

## GitHub Deployment

To push changes to GitHub:
```bash
# Push using authorized SSH key:
bash scripts/push-to-github.sh

# Or push using a Personal Access Token:
bash scripts/push-to-github.sh <YOUR_GITHUB_TOKEN>
```

---

## License

Proprietary — MAVLLIN Lifestyle. All rights reserved.
