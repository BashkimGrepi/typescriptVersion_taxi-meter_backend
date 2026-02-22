# Taxi Meter API - Enterprise Backend System

<div align="center">


![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

Multi-tenant taxi fleet management system with integrated payment processing, real-time ride tracking, and comprehensive admin capabilities.

> **⚠️ Development Status**: This project is currently under active development. Features and APIs may change.


</div>
# Taxi Meter Backend
## Overview

Taxi Meter Backend is a multi-tenant SaaS backend built to power digital taxi meter systems for independent taxi companies.

The system enables multiple taxi companies (tenants) to operate independently within a single platform while maintaining strict data isolation and role-based access control. Each tenant manages its own drivers, rides, pricing policies, and payment provider integrations.

The backend is designed to:

Handle real-time ride lifecycle management

Perform authoritative fare calculations

Process payments via Stripe Connect and Viva Wallet

Enforce tenant-level data isolation

Provide reporting and analytics for administrators

Support secure driver authentication for mobile applications

This backend serves:

🧑‍💼 Taxi company administrators (web admin portal)

🚗 Drivers (mobile application)

💳 Payment providers (via OAuth + webhooks)

🏗 Architecture Philosophy

This backend follows a multi-tenant, stateless, API-first architecture:

Multi-Tenant Isolation
Every ride, payment, driver, and pricing policy is strictly scoped to a tenant.

Stateless Authentication
JWT-based authentication ensures horizontal scalability and containerized deployment readiness.

Server-Authoritative Financial Logic
All fare calculations and payment state transitions are handled server-side to guarantee financial integrity.

Idempotent Payment Processing
Webhook handling prevents duplicate processing and ensures consistency in distributed payment workflows.

🎯 Core Responsibilities

The backend is responsible for:

Managing ride lifecycle (DRAFT → ONGOING → COMPLETED)

Calculating fares based on active pricing policies

Creating and updating payment records

Processing payment provider webhooks

Managing tenant-based driver accounts

Enforcing role-based access control (ADMIN, MANAGER, DRIVER)

Generating reports and financial summaries
---

## 🎯 Overview

