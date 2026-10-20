# 🍅 Tomato Wholesale Billing & Tally Management System

A production-ready, high-speed wholesale billing, tally, and financial ledger management system engineered specifically for wholesale tomato merchants and vegetable market (*mandi*) commission agents.

---

## 📋 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [Key Features & Business Logic](#-key-features--business-logic)
- [Prerequisites](#-prerequisites)
- [Environment Configuration](#-environment-configuration)
- [Initial Admin Provisioning](#-initial-admin-provisioning)
- [Development Setup](#-development-setup)
- [Production Deployment](#-production-deployment)
- [Canon G3030 & Physical Printing Architecture](#-canon-g3030--physical-printing-architecture)
- [Database Backup & Restore](#-database-backup--restore)
- [Automated Verification Tests](#-automated-verification-tests)
- [Health Check & Monitoring](#-health-check--monitoring)

---

## 🏛 Architecture Overview

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, responsive grid & flexbox design (optimized from 320px mobile displays up to desktop monitors).
- **Backend**: Node.js, Express (ES Modules), Mongoose ODM, JWT authentication, sliding-window rate limiting, security headers.
- **Database**: MongoDB (v6+ / v7+ / MongoDB Atlas).
- **Print Engine**: Chrome Headless PDF rendering pipeline with exact millimeter layout geometry:
  - **Buyer Bill**: 89 × 89 mm custom paper format (Tamil typography, Lakshmi logo, accounting ledger reconciliation).
  - **Supplier Voucher**: 105 × 148 mm (A6) purchase lot receipt.

---

## 🌟 Key Features & Business Logic

1. **Daily Supplier Purchases (e.g., A1)**:
   - Records incoming tomato lots with box counts (Big and Small boxes).
   - Independent supplier purchase bills without buyer tally interference.
   - Preserves historical purchase rates permanently per transaction.

2. **Buyer Billing & Continuous Ledger Tally (e.g., B1, B2)**:
   - **Box Equivalence Rule**: $1 \text{ Big Box} = 2 \text{ Small Boxes}$ ($1 \text{ Small Box} = 0.5 \text{ Big Box}$).
   - **Today's Bill**: $(\text{Big Boxes} + \frac{\text{Small Boxes}}{2}) \times \text{Selling Rate}$.
   - **Total Due**: $\text{Old Balance} + \text{Today's Bill}$.
   - **New Balance**: $\text{Total Due} - \text{Amount Paid}$.
   - Automatic chronological carry-forward across all future transactions.

3. **Accounting Single Source of Truth**:
   - The chronological ledger strictly guarantees:
     $$\text{Initial Balance} + \sum \text{Sale Bills} - \sum \text{Payments} = \text{Current Balance}$$
   - Any backdated transaction entry, edit, or voiding automatically recalculates all subsequent chronological running balances.

4. **Edge Cases Handled With Precision**:
   - **Advance / Credit**: When $\text{Amount Paid} > \text{Total Due}$, balance is stored negative and clearly displayed in the UI as **₹X Advance / Credit**, reducing future bills.
   - **Payment-Only Transactions**: Buyers can settle old balances without purchasing boxes.
   - **Zero Payment**: Unpaid bill amounts seamlessly carry forward to outstanding balances.
   - **Partial Payment**: Outstanding tally automatically reflects the remaining unpaid amount.

5. **Operational Timezone**:
   - Default date calculations strictly adhere to Indian Standard Time (`Asia/Kolkata`).

---

## 📦 Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **npm**: v9.0.0 or higher.
- **MongoDB**: Local MongoDB Community Server or remote MongoDB Atlas connection URI.
- **Google Chrome**: Required on the host machine running the print service for headless PDF rendering.

---

## ⚙️ Environment Configuration

### 1. Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Configure the following variables:

```ini
# Node Environment
NODE_ENV=production

# Server Port
PORT=5000

# MongoDB Connection String (Local or MongoDB Atlas)
MONGODB_URI=mongodb://127.0.0.1:27017/tomato_billing

# Secure JWT Secret (Mandatory in production; min 32 characters long)
# Generate via: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=replace_with_a_secure_random_64_character_hex_string_here

# JWT Expiration Period
JWT_EXPIRES_IN=7d

# Allowed Frontend Origins (Comma-separated for multiple domains)
CORS_ORIGIN=https://your-frontend-domain.com

# Printer Name (Local Windows setup)
PRINTER_NAME=Canon G3030 series

# Seed Flag (Strictly false in production)
SEED_DEMO_DATA=false
ALLOW_DEMO_SEED=false
```

> [!IMPORTANT]
> In `NODE_ENV=production`, the application validates all configuration on startup. If `JWT_SECRET` is missing, shorter than 32 characters, or uses known development placeholders, the server will terminate safely to prevent unauthorized token forging.

### 2. Frontend (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

Configure:

```ini
# When frontend is served on a different domain/port from backend:
VITE_API_BASE_URL=https://api.your-domain.com/api

# When using reverse proxy (e.g. Nginx) or single-server deployment:
# Leave empty or set to /api
VITE_API_BASE_URL=/api
```

---

## 👤 Initial Admin Provisioning

Unlike development environments, production installations **do not automatically create insecure default credentials**.

To create your initial administrator account securely via the CLI:

```bash
# Option A: From root directory
npm run admin:create

# Option B: From backend directory
cd backend
npm run admin:create
```

You can pass username and password as environment variables or interactive arguments:

```bash
node src/scripts/createAdmin.js --username myadmin --password MyStrongPassword123!
```

---

## 💻 Development Setup

To run both backend and frontend locally for development:

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# 2. Start Backend (runs on http://localhost:5000)
npm run dev:backend

# 3. Start Frontend in another terminal (runs on http://localhost:3000)
npm run dev:frontend
```

---

## 🚀 Production Deployment

### Option A: Unified / Single-Server Deployment (Recommended for VPS, Railway, Render)

In this setup, the Express backend serves both the API endpoints and the compiled React frontend static files.

1. **Build Frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
   This generates the optimized production bundle in `frontend/dist/`.

2. **Start Backend in Production**:
   ```bash
   cd ../backend
   npm install --omit=dev
   NODE_ENV=production npm start
   ```

3. Express will automatically:
   - Handle all `/api/*` routes with security headers and rate limiting.
   - Return clean 404 JSON for unknown `/api/*` endpoints.
   - Serve static frontend assets from `frontend/dist/` with single-page application (SPA) routing fallback.

### Option B: Decoupled Deployment (Frontend on Vercel/Netlify, Backend on Cloud API Server)

1. **Backend**:
   - Deploy `backend/` to your cloud container provider (e.g., Render, Railway, AWS ECS, DigitalOcean).
   - Set environment variables (`NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN=https://your-frontend.vercel.app`).
2. **Frontend**:
   - Set `VITE_API_BASE_URL=https://your-backend-api.com/api`.
   - Run `npm run build` in CI/CD pipeline.
   - Deploy `frontend/dist/` to CDN/Static Host.

---

## 🖨 Canon G3030 & Physical Printing Architecture

The application supports dual printing modes designed for vegetable wholesale market workflows:

### 1. Print Geometry & Formats
- **Buyer Bill**: `89mm × 89mm` square format, 1-page strict rendering, green Lakshmi logo, Tamil typography, item row, totals, and bottom accounting balances (Old Balance, Bill Amount, Paid, Net Due).
- **Supplier Voucher**: `105mm × 148mm` (A6) portrait format, 1-page strict rendering, supplier details, purchase lot breakdown, and financial totals.

### 2. Deployment Topology Notice: Remote Cloud vs. Local Windows Mandi Terminal

- **Remote Cloud Backend (AWS / Render / DigitalOcean / Vercel)**:
  - A cloud server **cannot** communicate directly over USB with a physical Canon G3030 printer connected to a computer in your local mandi.
  - In remote cloud deployments, the `/api/print/pdf` streaming endpoint generates the exact 89×89mm / A6 PDF and delivers it to the browser.
  - The cashier prints via the browser's native print dialogue or saves the PDF instantly.

- **Local Windows Terminal (Cashier PC)**:
  - When the backend runs locally on the Windows machine connected to the Canon G3030 via USB:
  - Direct silent printing is fully active via `pdf-to-printer` and SumatraPDF.
  - The cashier clicks `[ Quick Print ]` to trigger immediate physical paper output without opening print dialogs.

---

## 💾 Database Backup & Restore

To ensure complete financial data safety, schedule regular backups of your MongoDB database.

### Create a Database Backup

```bash
# Local MongoDB instance
mongodump --uri="mongodb://127.0.0.1:27017/tomato_billing" --out="./backups/$(date +%Y-%m-%d_%H%M%S)"

# MongoDB Atlas instance
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/tomato_billing" --out="./backups/$(date +%Y-%m-%d_%H%M%S)"
```

### Restore from Backup

```bash
# Restore specific backup directory
mongorestore --uri="mongodb://127.0.0.1:27017/tomato_billing" --drop ./backups/2026-10-17_120000/tomato_billing
```

> [!CAUTION]
> The `--drop` flag replaces existing database collections with the backup contents. Use with care.

---

## 🧪 Automated Verification Tests

Run the automated test suite to verify security middleware, rate limiting, MongoDB ObjectId parameter guards, financial box math, money rounding, and Chrome PDF page generation:

```bash
cd backend
npm test
```

Expected output:
```text
✔ 1. Security Middleware - securityHeaders
✔ 2. Security Middleware - validateObjectId
✔ 3. Security Middleware - createRateLimiter
✔ 4. Financial Integrity - Box Equivalence & Money Rounding
✔ 5. Print Engine - 1-Page PDF Generation Check
ℹ tests 5
ℹ pass 5
ℹ fail 0
```

---

## 💓 Health Check & Monitoring

The backend exposes an unauthenticated, safe `/api/health` endpoint for uptime monitoring, load balancer checks, and Docker/Kubernetes readiness probes:

```http
GET /api/health
```

**Response Format (`200 OK`)**:
```json
{
  "status": "ok",
  "service": "Tomato Wholesale Billing API",
  "database": "connected",
  "uptime": 3600,
  "timestamp": "2026-10-17T12:00:00.000Z"
}
```

*If the database connection drops, the endpoint returns `503 Service Unavailable` with `"status": "degraded"`.*

---

## 📄 License & Confidentiality
Internal proprietary software developed for wholesale vegetable mandi operations. All rights reserved.
