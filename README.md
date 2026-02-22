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

| Role | Responsibility |
|------|----------------|
| 🧑‍💼 **Administrators** | Manage drivers, pricing, payments, and reports |
| 🚗 **Drivers** | Operate rides via mobile application |
| 💳 **Payment Providers** | Process transactions via OAuth + webhook events |


### 📌 Why This Matters

Taxi Meter API transforms taxi operations from hardware-dependent workflows into a scalable, cloud-based platform.

It reduces operational complexity, improves financial transparency, and enables independent taxi companies to compete with modern ride-hailing platforms — without sacrificing ownership or control of their business.