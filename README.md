# 🚕 Taxi Meter API - Enterprise Backend System

<div align="center">

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

Multi-tenant taxi fleet management backend with integrated payment processing, real-time ride lifecycle control, and enterprise-grade administrative tooling.

> **⚠️ Development Status**: This project is under active development. Core functionality is operational, but APIs and features may evolve.

[Features](#-key-features) • [Architecture](#-system-architecture) • [Getting Started](#-getting-started) • [API Docs](#-api-documentation)

</div>

---

## 🎯 Overview

### The Mission

Taxi Meter API is built to modernize and digitize the operational backbone of independent taxi companies.

Traditional taxi environments rely on fragmented hardware and disconnected systems:

- Physical taxi meters for fare calculation

- Separate card terminals for payment processing

- Manual shift and earnings tracking

- Paper-based receipts

- Disconnected reporting tools

> This backend replaces that fragmented ecosystem with a unified, software-driven infrastructure.

### 🚀 The Platform

Taxi Meter API consolidates:

- Server-authoritative fare calculation

- Ride lifecycle management

- Integrated card payment processing (Stripe Connect, Viva Wallet)

- Automated receipt and payment records

- Centralized driver and tenant management

- Real-time operational reporting

Instead of multiple independent devices and manual processes, taxi companies operate through a single scalable backend system powering both mobile and web applications.

### 🏢 Multi-Tenant SaaS Architecture

Taxi Meter API is designed as a shared multi-tenant infrastructure, allowing multiple taxi companies to operate independently within the same backend environment.

Each tenant has:

- Isolated rides

- Isolated drivers

- Independent pricing policies

- Separate payment provider accounts

- Role-based access control

This architecture enables:

- Centralized maintenance

- Scalable infrastructure

- Reduced operational overhead

- Strict data segregation between companies

The system is built to scale horizontally while maintaining financial and operational integrity.

### 🧠 Core Operational Engine

The backend acts as the central control layer for:

- 📱 Driver mobile application

- 🖥️ Administrative management portal

- 💳 Payment provider integrations (OAuth + Webhooks)

It ensures consistency, financial accuracy, and tenant-level isolation across all system components.

### ⚙️ What the Backend Handles

#### 🚗 Ride Lifecycle Management

- State machine: DRAFT → ONGOING → COMPLETED | CANCELLED

- Single active ride enforcement per driver

- Server-side timestamp authority

- Idempotent ride completion logic

#### 💰 Authoritative Fare Calculation

- Base fare + time rate + distance rate
  or
- Fixed pricing
  or
- Custom pricing

- Tax calculation

- Decimal-safe financial precision

- Active pricing policy enforcement per tenant

#### 💳 Payment Processing

- Viva Wallet integration

- Automatic payment record creation

- Webhook-based status synchronization

- Idempotent payment event handling

#### 👥 Access Control & Authentication

- JWT-based authentication

- Role-based access control (ADMIN, MANAGER, DRIVER)

- Tenant-scoped authorization

- Secure driver profile validation

#### 📊 Reporting & Aggregation

- Ride summaries

- Earnings reports

- Time-based filtering

- Financial reconciliation data

#### 🏗 Architecture Philosophy

Taxi Meter API follows a stateless, API-first, financially authoritative backend design.

#### 🔐 Tenant Isolation

Every entity (ride, payment, driver, pricing policy) is strictly scoped to a tenant (company).

#### 🔄 Stateless Authentication

JWT-based authentication enables horizontal scalability and containerized deployments.

#### 💰 Financial Authority

All pricing calculations and payment transitions are handled server-side to guarantee consistency and prevent manipulation.

#### ⚡ Idempotent Payment Handling

Webhook events are stored and validated to prevent duplicate processing and ensure reliable distributed payment flows.

### 👥 System Actors

| Role                     | Responsibility                                  |
| ------------------------ | ----------------------------------------------- |
| 🧑‍💼 **Administrators**    | Manage drivers, pricing, payments, and reports  |
| 🚗 **Drivers**           | Operate rides via mobile application            |
| 💳 **Payment Providers** | Process transactions via OAuth + webhook events |

### 📌 Why This Matters

Taxi Meter API transforms taxi operations from hardware-dependent workflows into a scalable, cloud-based platform.

It reduces operational complexity, improves financial transparency, and enables independent taxi companies to compete with modern ride-hailing platforms — without sacrificing ownership or control of their business.

---

## 🚀 Getting Started

### Prerequisites

Before running the project, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **PostgreSQL** (v14 or higher)
- **Redis** (optional, for caching)
- **Docker** (optional, for containerized setup)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd typescript-version-backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory based on `.env.example`:

```bash
cp .env.example .env
```

Configure the following essential variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/taxi_meter_db?schema=public"

# JWT Authentication
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d



# Viva Wallet Configuration (requires demo/production Viva Wallet account)
VIVA_MERCHANT_ID=your_viva_merchant_id
VIVA_WEBHOOK_VERIFICATION_KEY=your_viva_webhook_key
```

> **⚠️ Payment Provider Setup:**
>
> - **Viva Wallet**: Requires a demo or production account from [Viva Wallet Developer Portal](https://developer.viva.com)
>   - Get `VIVA_MERCHANT_ID` from your merchant settings
>   - Get `VIVA_WEBHOOK_VERIFICATION_KEY` from webhook configuration

> **Tip**: Generate a secure encryption key with:
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

4. **Set up the database**

Run Prisma migrations to create the database schema:

```bash
npx prisma migrate dev
```

5. **Seed the database** (optional)

Populate the database with sample data:

```bash
npm run seed
```

### Running the Application

#### Development Mode

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

#### Production Mode

```bash
npm run build
npm run start:prod
```

#### Using Docker Compose

```bash
docker-compose up -d
```

This will start PostgreSQL, Redis, and the application in containers.

### Verify Installation

Check if the API is running:

```bash
curl http://localhost:3000/health/db
```

---

## 🧪 Testing with Postman

### Quick Start

1. **Import the Postman Collection**
   - Open Postman
   - Click **Import** → Select file
   - Choose: `postman/Taxi-Meter-API.postman_collection.json`

2. **Set Base URL**
   - The collection automatically uses `http://localhost:3000`
   - Modify in collection variables if needed

### Postman Testing Cheat Sheet

#### 🔐 Authentication Flow

##### Driver Authentication (V1)

| Step | Endpoint                        | Method | Description                                   |
| --------------------------------------------- |
| 1    | `/auth/driver/login-v1`         | POST   | Login with credentials                        |
| 1a   | _(conditional)_                 | -      | If multi-tenant: receive `loginTicket` + list |
| 2    | `/auth/driver/select-tenant-v1` | POST   | Select tenant (if required)                   |
| 3    | `/api/driver/profile`           | GET    | Verify token works (auto-saved)               |

**Sample Login Request:**

```json
{
  "email": "driver@demo.com",
  "password": "DriverPass123!"
}
```

**Single Tenant Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 7776000
}
```

**Multi-Tenant Response (requires tenant selection):**

```json
{
  "requiresTenantSelection": true,
  "tenants": [
    { "tenantId": "abc-123", "tenantName": "Helsinki Taxi" },
    { "tenantId": "def-456", "tenantName": "Tampere Taxi" }
  ],
  "loginTicket": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Select Tenant Request (Step 2):**

```json
{
  "loginTicket": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tenantId": "abc-123"
}
```

##### Admin/Manager Authentication

| Step | Endpoint                    | Method | Description                                   |
| ---- | --------------------------- | ------ | --------------------------------------------- |
| 1    | `/auth/admin/login`         | POST   | Login with credentials (optional: tenantId)   |
| 1a   | _(conditional)_             | -      | If multi-tenant: receive `loginTicket` + list |
| 2    | `/auth/admin/select-tenant` | POST   | Select tenant (if required)                   |

> **Note**: Tokens are automatically saved to collection variables after successful authentication. The `loginTicket` is a short-lived token (5 minutes) used only for tenant selection.

#### 🚗 Driver Endpoints

| Endpoint                         | Method | Auth Required | Description        |
| -------------------------------- | ------ | ------------- | ------------------ |
| `/api/driver/profile`            | GET    | ✅            | Get driver profile |
| `/api/driver/rides/active`       | GET    | ✅            | Get active ride    |
| `/api/driver/rides/history`      | GET    | ✅            | Get ride history   |
| `/api/driver/rides/start`        | POST   | ✅            | Start a new ride   |
| `/api/driver/rides/:id/complete` | PATCH  | ✅            | Complete a ride    |

#### 🧑‍💼 Admin Endpoints

| Endpoint                     | Method | Auth Required | Description           |
| ---------------------------- | ------ | ------------- | --------------------- |
| `/api/admin/drivers`         | GET    | ✅            | List all drivers      |
| `/api/admin/drivers`         | POST   | ✅            | Create new driver     |
| `/api/admin/rides`           | GET    | ✅            | List all rides        |
| `/api/admin/reports/summary` | GET    | ✅            | Get financial summary |

#### 💳 Payment Endpoints

| Endpoint                   | Method | Auth Required | Description                 |
| -------------------------- | ------ | ------------- | --------------------------- |
| `/api/payments/:id`        | GET    | ✅            | Get payment details         |
| `/api/payments/:id/status` | PATCH  | ✅            | Update payment status       |
| `/viva/webhook`            | POST   | ❌            | Viva Wallet webhook handler |

### Testing Tips

- 📁 **Collections Available:**
  - `Taxi-Meter-API.postman_collection.json` - Full API endpoints
  - `admin-reports.postman_collection.json` - Admin reporting endpoints
  - `pricing-policies.postman_collection.json` - Pricing management

- 🔄 **Auto-Authentication:** JWT tokens are automatically captured and reused
- 📚 **Detailed Guide:** See [postman/TESTING_GUIDE.md](postman/TESTING_GUIDE.md) for complete testing scenarios
- 🐛 **Debugging:** Enable "Console" in Postman to see detailed request/response logs

---

## 📝 Documentation Notice

> **Note**: This README and portions of the project documentation were created with assistance from AI tools to ensure clarity, consistency, and comprehensive coverage of the system architecture and features.
