# 🚕 Taxi Meter API - Enterprise Backend System

<div align="center">

![Status](https://img.shields.io/badge/Status-In%20Development-yellow?style=for-the-badge)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

Multi-tenant taxi fleet management system with integrated payment processing, real-time ride tracking, and comprehensive admin capabilities.

> **⚠️ Development Status**: This project is currently under active development. Features and APIs may change.

[Features](#-key-features) • [Architecture](#-system-architecture) • [Getting Started](#-getting-started) • [API Docs](#-api-documentation)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Database Schema](#-database-schema)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Environment Configuration](#-environment-configuration)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 🎯 Overview

> **📌 Note**: This system is currently in active development. While core features are functional, some features may be incomplete or subject to change.

The Taxi Meter API is a comprehensive backend solution designed for taxi fleet management operations. Built with enterprise-grade patterns and modern technologies, it provides a robust foundation for managing drivers, rides, payments, and administrative operations across multiple tenant organizations.

### **Big Picture**

This system serves as the backbone for a taxi/ride-hailing platform, handling:

- **Multi-tenancy**: Isolates data and operations for different taxi companies
- **Driver Operations**: Complete lifecycle management for drivers and ride execution
- **Payment Processing**: Integrated with Stripe Connect and Viva Wallet for seamless transactions
- **Administrative Control**: Comprehensive dashboards for fleet managers and admins
- **Compliance & Reporting**: Automated receipt generation and financial reporting

### **Use Cases**

- Traditional taxi companies modernizing their operations
- Ride-hailing startups requiring a scalable backend
- Fleet management companies needing comprehensive operational tools
- Multi-franchise taxi operations with centralized management

---

## ✨ Key Features

### 🏢 **Multi-Tenant Architecture**

- Complete tenant isolation with secure data segregation
- Role-based access control (Admin, Manager, Driver)
- Invitation system for onboarding drivers and managers
- Tenant-specific configuration and branding support

### 🚗 **Ride Management**

- Real-time ride tracking and status management
- Multiple pricing modes:
  - **Meter Mode**: Distance and time-based calculation
  - **Fixed Price**: Pre-determined fare policies
  - **Custom Fixed**: One-time custom pricing
- Ride history with comprehensive filtering and search
- Cursor-based pagination for efficient data handling

### 💳 **Payment Processing**

- **Stripe Connect** integration for credit/debit card payments
- **Viva Wallet** integration for European markets
- Cash payment tracking
- Automatic receipt and invoice generation
- Payment status tracking with webhook support
- Secure token encryption for payment credentials

### 📊 **Admin Dashboard API**

- Driver management and performance tracking
- Ride analytics with date range filtering
- Payment reconciliation and financial reports
- Configurable pricing policies
- Monthly data export with archiving
- User invitation and role management

### 🔐 **Security & Authentication**

- JWT-based authentication with refresh token support
- Password hashing with bcrypt
- OAuth 2.0 integration for payment providers
- Encrypted sensitive data storage
- CORS configuration for frontend integration

### 📝 **Reporting & Documentation**

- Automated PDF receipt generation (Puppeteer)
- Comprehensive API documentation (Swagger/OpenAPI)
- Structured logging for audit trails
- Export functionality for compliance and accounting

### ⚡ **Performance & Scalability**

- Redis caching layer for frequently accessed data
- Optimized database queries with Prisma
- Connection pooling and query optimization
- Pagination strategies for large datasets
- Docker containerization for easy deployment

---

## 🛠 Tech Stack

### **Core Technologies**

| Technology     | Version | Purpose                        |
| -------------- | ------- | ------------------------------ |
| **NestJS**     | 11.x    | Progressive Node.js framework  |
| **TypeScript** | 5.7.x   | Type-safe development          |
| **PostgreSQL** | 16.x    | Primary relational database    |
| **Prisma**     | 6.x     | Modern ORM with type safety    |
| **Redis**      | Latest  | Caching and session management |

### **Payment & Integration**

- **Stripe API** - Payment processing & Connect for marketplaces
- **Viva Wallet API** - European payment gateway
- **Puppeteer** - PDF generation for receipts

### **Authentication & Security**

- **Passport.js** - Authentication middleware
- **JWT** - Stateless authentication
- **bcrypt** - Password hashing

### **Development & DevOps**

- **Docker & Docker Compose** - Containerization
- **ESLint & Prettier** - Code quality
- **Jest** - Unit and E2E testing
- **Swagger/OpenAPI** - API documentation

---

## 🏗 System Architecture

### **High-Level Architecture**

```
┌─────────────────┐
│  Admin Dashboard│
│   (Frontend)    │
└────────┬────────┘
         │
         │ HTTPS/REST
         ▼
┌─────────────────────────────────────────┐
│         NestJS Application              │
│  ┌─────────────────────────────────┐   │
│  │  Authentication Layer (JWT)      │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Admin Module │ Driver Module    │   │
│  │  Auth Module  │ Payment Module   │   │
│  │  Pricing Module │ Webhook Module │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │     Prisma ORM Layer             │   │
│  └─────────────────────────────────┘   │
└─────────┬───────────────────────────────┘
          │
          ├──────────────┬──────────────┐
          ▼              ▼              ▼
    ┌──────────┐   ┌─────────┐   ┌──────────┐
    │PostgreSQL│   │  Redis  │   │ Payment  │
    │ Database │   │  Cache  │   │ Providers│
    └──────────┘   └─────────┘   └──────────┘
                                  (Stripe/Viva)
```

### **Request Flow**

1. **Authentication**: All requests pass through `UniversalV1Guard` for JWT validation
2. **Tenant Isolation**: `@CurrentTenant()` decorator extracts tenant context
3. **Authorization**: Role-based guards ensure proper access control
4. **Business Logic**: Service layer handles domain logic
5. **Data Access**: Prisma ORM manages database operations
6. **Caching**: Redis layer for performance optimization
7. **Response**: Standardized DTOs with class-transformer

---

## 💾 Database Schema

### **Entity Relationship Overview**

The database follows a multi-tenant architecture with the following core entities:

#### **Core Entities**

- **Tenant**: Root entity for multi-tenancy
- **User**: Authentication and user management
- **Membership**: Junction table linking users to tenants with roles
- **DriverProfile**: Driver-specific information and metrics

#### **Operational Entities**

- **Ride**: Core ride tracking with status, pricing, and duration
- **PricingPolicy**: Configurable meter-based pricing (base fare, per km, per minute)
- **FixedPricePolicy**: Pre-determined fixed fare options
- **Payment**: Payment tracking with provider integration
- **Receipt**: Generated receipts linked to completed rides

#### **Integration Entities**

- **ProviderAccount**: Encrypted payment provider credentials
- **VivaAccount**: Viva Wallet specific configuration
- **WebhookEvent**: Webhook event tracking and processing
- **OAuthState**: OAuth flow state management

#### **Administrative Entities**

- **Invitation**: Driver/manager invitation system
- **NumberSequence**: Invoice and receipt numbering
- **ExportArchive**: Monthly data export tracking

### **Key Relationships**

```
Tenant (1) ───┬──> (N) DriverProfile
              ├──> (N) Ride
              ├──> (N) Payment
              ├──> (N) PricingPolicy
              └──> (N) FixedPricePolicy

Ride (1) ──> (1) Payment ──> (1) Receipt

DriverProfile (1) ──> (N) Ride
```

For detailed schema, see [prisma/schema.prisma](prisma/schema.prisma)

---

## 📁 Project Structure

```
typescript-version-backend/
├── prisma/
│   ├── schema.prisma              # Database schema definition
│   ├── seed.ts                    # Database seeding script
│   └── migrations/                # Database migration history
│
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root application module
│   │
│   ├── admin/                     # Admin dashboard endpoints
│   │   ├── drivers/               # Driver management
│   │   ├── rides/                 # Ride management
│   │   ├── payments/              # Payment management
│   │   ├── reports/               # Analytics & reports
│   │   └── exports/               # Data export functionality
│   │
│   ├── auth/                      # Authentication & authorization
│   │   ├── guards/                # JWT, role-based guards
│   │   ├── strategies/            # Passport strategies
│   │   └── decorators/            # Custom auth decorators
│   │
│   ├── drivers/                   # Driver-specific features
│   │   ├── rides/                 # Ride CRUD operations
│   │   ├── payments/              # Payment initiation
│   │   └── profile/               # Driver profile management
│   │
│   ├── pricings/                  # Pricing policy management
│   │   ├── pricing-policies/      # Meter-based policies
│   │   └── fixed-price/           # Fixed fare policies
│   │
│   ├── viva-webhook/              # Viva Wallet webhook handler
│   │
│   ├── prisma/                    # Prisma service module
│   │
│   ├── common/                    # Shared utilities
│   │   ├── filters/               # Exception filters
│   │   ├── interceptors/          # Response interceptors
│   │   └── pipes/                 # Validation pipes
│   │
│   └── decorators/                # Global custom decorators
│
├── docs/                          # API documentation
│   ├── ADMIN_API_COMPLETE_REFERENCE.md
│   ├── CURSOR_PAGINATION_EXPLAINED.md
│   └── WEBHOOK_MIGRATION_PLAN.md
│
├── postman/                       # Postman collections
│
├── test/                          # E2E tests
│
├── docker-compose.yml             # Docker services configuration
├── .env.example                   # Environment variables template
└── package.json                   # Dependencies and scripts
```

---

## 🚀 Getting Started

### **Prerequisites**

- **Node.js** >= 18.x
- **npm** or **yarn**
- **PostgreSQL** >= 14.x
- **Redis** (optional, for caching)
- **Docker & Docker Compose** (optional, for containerized setup)

### **Installation**

#### **Option 1: Local Setup**

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

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start PostgreSQL and Redis**

   ```bash
   # If using Docker:
   docker-compose up -d db redis
   ```

5. **Run database migrations**

   ```bash
   npx prisma migrate dev
   ```

6. **Seed the database (optional)**

   ```bash
   npm run seed
   ```

7. **Start the application**

   ```bash
   # Development mode with hot reload
   npm run start:dev

   # Production mode
   npm run build
   npm run start:prod
   ```

#### **Option 2: Docker Compose (Recommended)**

1. **Clone and configure**

   ```bash
   git clone <repository-url>
   cd typescript-version-backend
   cp .env.example .env
   # Edit .env as needed
   ```

2. **Start all services**

   ```bash
   docker-compose up -d
   ```

3. **Run migrations**
   ```bash
   npx prisma migrate deploy
   ```

The API will be available at `http://localhost:3000`

---

## 📚 API Documentation

### **Swagger/OpenAPI**

Interactive API documentation is available at:

```
http://localhost:3000/api
```

### **Key Endpoint Groups**

#### **Authentication** (`/auth`)

- `POST /auth/register` - Register new user
- `POST /auth/login` - Authenticate and receive JWT
- `POST /auth/refresh` - Refresh access token

#### **Admin** (`/admin`)

- `GET /admin/drivers` - List all drivers (paginated)
- `GET /admin/rides` - List rides with filters
- `GET /admin/payments` - Payment history and reconciliation
- `POST /admin/invitations` - Invite new drivers/managers
- `GET /admin/reports/summary` - Dashboard summary statistics
- `POST /admin/exports/monthly` - Generate monthly data export

#### **Drivers** (`/drivers`)

- `POST /drivers/rides` - Start a new ride
- `PATCH /drivers/rides/:id/end` - End a ride
- `GET /drivers/rides` - Driver's ride history
- `POST /drivers/payment-links` - Generate payment link
- `GET /drivers/profile` - Get driver profile

#### **Pricing Policies** (`/pricing-policies`)

- `GET /pricing-policies` - List active pricing policies
- `POST /pricing-policies` - Create new pricing policy (Admin)
- `PATCH /pricing-policies/:id` - Update pricing policy
- `DELETE /pricing-policies/:id` - Delete pricing policy

#### **Webhooks**

- `POST /viva-webhook` - Viva Wallet webhook handler
- `POST /stripe-webhook` - Stripe webhook handler (future)

### **Documentation Resources**

- [Complete Admin API Reference](docs/ADMIN_API_COMPLETE_REFERENCE.md)
- [Cursor Pagination Guide](docs/CURSOR_PAGINATION_EXPLAINED.md)
- [Webhook Migration Plan](docs/WEBHOOK_MIGRATION_PLAN.md)

---

## ⚙ Environment Configuration

### **Required Environment Variables**

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/taximeter?schema=public"

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
JWT_ISSUER=taxi-meter-api
JWT_AUDIENCE=taxi-meter-frontend
JWT_ACCESS_TTL=28800  # 8 hours in seconds

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_CLIENT_ID=ca_...
STRIPE_REDIRECT_URI=http://localhost:5173/stripe/callback
STRIPE_WEBHOOK_SECRET=whsec_...

# Viva Wallet Configuration
VIVA_CLIENT_ID=your-viva-client-id
VIVA_CLIENT_SECRET=your-viva-client-secret
VIVA_API_KEY=your-viva-api-key
VIVA_WEBHOOK_SECRET=your-viva-webhook-secret

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# Redis (optional)
REDIS_URL=redis://localhost:6379
REDIS_TTL_HOURS=12

# Application
PORT=3000
NODE_ENV=development
```

### **Generating Secure Keys**

```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🧪 Testing

### **Running Tests**

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

### **Test Structure**

```
test/
├── app.e2e-spec.ts           # End-to-end application tests
└── jest-e2e.json             # E2E test configuration
```

### **Testing Strategy**

- **Unit Tests**: Service and controller logic
- **Integration Tests**: Database operations with Prisma
- **E2E Tests**: Full API endpoint testing
- **Mocking**: External payment providers

---

## 🚢 Deployment

### **Production Checklist**

- [ ] Set `NODE_ENV=production`
- [ ] Use strong, unique secrets for JWT and encryption
- [ ] Configure production database with connection pooling
- [ ] Enable SSL/TLS for database connections
- [ ] Set up Redis for production
- [ ] Configure proper CORS origins
- [ ] Set up monitoring and logging (e.g., Sentry, DataDog)
- [ ] Configure webhook endpoints with proper security
- [ ] Set up automated backups for PostgreSQL
- [ ] Use environment-specific `.env` files
- [ ] Enable rate limiting for API endpoints
- [ ] Configure proper security headers

### **Docker Production Build**

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### **Database Migrations in Production**

```bash
# Deploy migrations without prompts
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### **Recommended Hosting Platforms**

- **AWS**: EC2, ECS, or Elastic Beanstalk
- **DigitalOcean**: App Platform or Droplets
- **Heroku**: With PostgreSQL and Redis add-ons
- **Railway**: Built-in PostgreSQL and Redis
- **Render**: Managed PostgreSQL and Redis

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Code Style**

This project uses ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Format code
npm run format
```

---

## 📄 License

This project is licensed under the UNLICENSED license - see the LICENSE file for details.

---

## 📞 Contact & Support

For questions, issues, or collaboration opportunities, please open an issue on GitHub.

---

## 🙏 Acknowledgments

- **NestJS** - Framework foundation
- **Prisma** - Database ORM
- **Stripe** - Payment processing
- **Viva Wallet** - European payment gateway

---

<div align="center">

**Built with ❤️ using NestJS, TypeScript, and PostgreSQL**

⭐ Star this repository if you find it helpful!

</div>
