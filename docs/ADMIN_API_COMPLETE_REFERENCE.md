# 🚕 Complete Admin API Reference & Data Management Plan

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Admin Profile Endpoints](#admin-profile-endpoints)
4. [Driver Management Endpoints](#driver-management-endpoints)
5. [Ride Management Endpoints](#ride-management-endpoints)
6. [Payment Management Endpoints](#payment-management-endpoints)
7. [Invitation Management Endpoints](#invitation-management-endpoints)
8. [Reports & Analytics Endpoints](#reports--analytics-endpoints)
9. [Data Management Strategy](#data-management-strategy)
10. [Response Structures Reference](#response-structures-reference)

---

## Overview

The Admin API provides comprehensive management capabilities for taxi fleet operations. All endpoints are tenant-scoped and require authentication with ADMIN or MANAGER roles.

**Base URL**: `/admin`

**Common Features**:

- ✅ Tenant isolation (all data scoped to tenantId)
- ✅ Pagination support (page, pageSize)
- ✅ Date range filtering (from, to)
- ✅ Search and filter capabilities
- ✅ Consistent response formats

---

## Authentication & Authorization

### Required Headers

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Required Roles

- `ADMIN` - Full access to all admin endpoints
- `MANAGER` - Limited management access

### Guards Applied

- `UniversalV1Guard` - JWT authentication
- `AdminRoleGuard` - Role-based authorization

---

## Admin Profile Endpoints

### 1. Get Admin Profile

**Endpoint**: `GET /admin/profile`

**Description**: Retrieve current admin/manager profile with statistics

**Query Parameters**: None

**Response**: `AdminProfileResponseDto`

```typescript
{
  id: string;                    // Admin user ID
  email: string;                 // Admin email
  username?: string;             // Display name (optional)
  status: string;                // "ACTIVE" | "INACTIVE"
  accountCreatedAt: string;      // ISO timestamp
  role: string;                  // "ADMIN" | "MANAGER"
  tenantId: string;              // Current tenant ID
  tenantName: string;            // Tenant business name
  businessId: string;            // Business registration ID
  joinedTenantAt?: string;       // ISO timestamp
  stats: {
    totalDriversManaged: number;
    totalInvitationsSent: number;
    lastLogin?: string;          // Currently null
  };
}
```

**Use Cases**:

- Dashboard user profile section
- User authentication verification
- Admin statistics display

---

## Driver Management Endpoints

### 2. Get Drivers (Paginated)

**Endpoint**: `GET /admin/drivers`

**Description**: Retrieve paginated list of drivers with search and filter

**Query Parameters**: `DriversQueryDto`
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| q | string | No | - | Search firstName, lastName, phone |
| status | enum | No | ALL | INVITED, ACTIVE, INACTIVE, ALL |
| page | number | No | 1 | Page number (1-based) |
| pageSize | number | No | 25 | Items per page (max 100) |

**Response**: `DriversPageResponse`

```typescript
{
  items: DriverResponseDto[];
  total: number;         // Total count across all pages
  page: number;          // Current page
  pageSize: number;      // Items per page
}

// DriverResponseDto
{
  id: string;            // Driver profile ID
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userId: string;        // Associated user account ID
  status: string;        // INVITED | ACTIVE | INACTIVE
  createdAt: string;     // ISO timestamp
}
```

**Use Cases**:

- Driver list/table view
- Driver search functionality
- Driver status filtering

---

### 3. Create Driver

**Endpoint**: `POST /admin/drivers/create`

**Description**: Create new driver profile and send invitation

**Request Body**: `CreateDriverDto`

```typescript
{
  firstName: string;     // Required
  lastName: string;      // Required
  phone?: string;        // Optional, format: +358401234567
  email: string;         // Required, valid email
}
```

**Response**: `DriverResponseDto`

**Use Cases**:

- Add new driver to fleet
- Driver onboarding workflow

---

### 4. Update Driver

**Endpoint**: `PATCH /admin/drivers/:id`

**Description**: Update driver profile information

**URL Parameters**:

- `id` - Driver profile ID (UUID)

**Request Body**: `UpdateDriverDto`

```typescript
{
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  status?: "INVITED" | "ACTIVE" | "INACTIVE";
}
```

**Response**: `DriverResponseDto`

**Use Cases**:

- Edit driver information
- Change driver status
- Update contact details

---

## Ride Management Endpoints

### 5. Get Rides (Paginated)

**Endpoint**: `GET /admin/rides`

**Description**: Retrieve paginated rides with comprehensive filtering

**Query Parameters**: `RidesQueryDto`
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| from | string | No | - | Start date (ISO) |
| to | string | No | - | End date (ISO) |
| status | enum | No | ALL | DRAFT, ONGOING, COMPLETED, CANCELLED, ALL |
| driverId | UUID | No | - | Filter by driver profile ID |
| driverName | string | No | - | Filter by driver name (partial) |
| paymentStatus | enum | No | - | PENDING, PAID, FAILED, REFUNDED, etc. |
| paymentProvider | enum | No | - | CASH, VIVA, STRIPE |
| page | number | No | 1 | Page number |
| pageSize | number | No | 25 | Items per page (max 100) |

**Response**: `RidePageResponse`

```typescript
{
  items: RideListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

// RideListItemDto
{
  rideId: string;
  driverName: string;           // "FirstName LastName"
  date: string;                 // startedAt ISO string
  rideStatus: RideStatus;       // DRAFT | ONGOING | COMPLETED | CANCELLED
  paymentStatus: PaymentStatus | null;
  paymentMethod: PaymentProvider | null;
  amount: string | null;        // fareTotal as string
}
```

**Use Cases**:

- Ride history view
- Revenue tracking
- Driver activity monitoring
- Payment reconciliation

---

### 6. Get Ride Summary

**Endpoint**: `GET /admin/rides/:id/summary`

**Description**: Get detailed information about a specific ride

**URL Parameters**:

- `id` - Ride ID (UUID)

**Response**: `RideSummaryResponseDto`

```typescript
{
  ride: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationMin: string | null;
    distanceKm: string | null;
    faresubtotal: Decimal | null;
    taxAmount: Decimal | null;
    fareTotal: Decimal | null;
    status: RideStatus;
    pricingMode: RidePricingMode; // FIXED | CALCULATED
  }
  driver: {
    id: string;
    firstName: string;
    lastName: string;
  }
  tenant: {
    id: string;
    tenantName: string;
  }
  payment: {
    id: string;
    provider: PaymentProvider;
    amount: Decimal;
    currency: string;
    status: PaymentStatus;
  }
}
```

**Use Cases**:

- Ride detail modal/page
- Payment verification
- Customer support

---

## Payment Management Endpoints

### 7. Get Payments (Paginated)

**Endpoint**: `GET /admin/payments`

**Description**: Retrieve paginated payments with filtering

**Query Parameters**: `PaymentsQueryDto`
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| from | string | No | - | Start date (ISO) |
| to | string | No | - | End date (ISO) |
| paymentMethod | enum | No | - | cash, card |
| driverId | UUID | No | - | Filter by driver |
| minAmount | string | No | - | Minimum amount filter |
| maxAmount | string | No | - | Maximum amount filter |
| page | number | No | 1 | Page number |
| pageSize | number | No | 25 | Items per page (max 100) |

**Response**: `PaymentsPageResponse`

```typescript
{
  items: PaymentResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

// PaymentResponseDto
{
  id: string;
  tenantId: string;
  rideId: string;
  amount: string;           // Decimal as string
  paymentMethod: string;    // Provider enum: STRIPE, VIVA, CASH
  notes?: string;           // Optional notes or failureCode
  createdAt: string;        // ISO timestamp
}
```

**Use Cases**:

- Payment history
- Revenue reports
- Payment reconciliation

---

### 8. Get Payments Summary

**Endpoint**: `GET /admin/payments/summary`

**Description**: Get aggregated payment statistics

**Query Parameters**:

- `from` (optional) - Start date ISO string
- `to` (optional) - End date ISO string

**Response**:

```typescript
{
  totalPayments: number;
  totalAmount: string;
  paymentMethods: Array<{
    method: string; // CASH | VIVA | STRIPE
    count: number;
    totalAmount: string;
  }>;
}
```

**Use Cases**:

- Dashboard KPIs
- Quick financial overview

---

### 9. Get Payment by ID

**Endpoint**: `GET /admin/payments/:id`

**Description**: Get detailed payment information

**URL Parameters**:

- `id` - Payment ID (UUID)

**Response**: `PaymentResponseDto`

**Use Cases**:

- Payment detail view
- Transaction verification

---

### 10. Create Payment

**Endpoint**: `POST /admin/payments`

**Description**: Manually create payment record

**Request Body**: `CreatePaymentDto`

```typescript
{
  rideId: string;           // UUID
  amount: string;           // "25.50"
  paymentMethod: string;    // "cash" | "card"
  notes?: string;           // Optional notes
}
```

**Response**: `PaymentResponseDto`

**Use Cases**:

- Manual payment entry
- Cash payment recording
- Payment correction

---

### 11. Update Payment

**Endpoint**: `PATCH /admin/payments/:id`

**Description**: Update existing payment record

**URL Parameters**:

- `id` - Payment ID (UUID)

**Request Body**: `UpdatePaymentDto`

```typescript
{
  amount?: string;
  paymentMethod?: string;   // "cash" | "card"
  notes?: string;
}
```

**Response**: `PaymentResponseDto`

**Use Cases**:

- Payment correction
- Update payment notes
- Fix payment amount

---

### 12. Delete Payment

**Endpoint**: `DELETE /admin/payments/:id`

**Description**: Delete payment record

**URL Parameters**:

- `id` - Payment ID (UUID)

**Response**: `204 No Content`

**Use Cases**:

- Remove duplicate payments
- Cancel erroneous entries

---

## Invitation Management Endpoints

### 13. Get Invitations (Paginated)

**Endpoint**: `GET /admin/invitations`

**Description**: Retrieve paginated invitations with filters

**Query Parameters**: `InvitationsQueryDto`
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| status | enum | No | - | pending, accepted, expired |
| role | enum | No | - | DRIVER, MANAGER |
| page | number | No | 1 | Page number |
| pageSize | number | No | 25 | Items per page (max 100) |

**Response**: `InvitationsPageResponse`

```typescript
{
  items: InvitationResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// InvitationResponseDto
{
  id: string;
  tenantId: string;
  email: string;
  role: string;                  // DRIVER | MANAGER
  token: string;
  status: string;                // pending | accepted | expired
  expiresAt: string;
  acceptedAt?: string;
  invitedByName?: string;
  driverProfileName?: string;
  driverProfileId?: string;
}
```

**Use Cases**:

- Invitation management
- Track pending invitations
- Resend expired invitations

---

### 14. Get Invitation by ID

**Endpoint**: `GET /admin/invitations/:id`

**Description**: Get specific invitation details

**URL Parameters**:

- `id` - Invitation ID (UUID)

**Response**: `InvitationResponseDto`

**Use Cases**:

- Invitation detail view
- Verify invitation status

---

### 15. Create Invitation

**Endpoint**: `POST /admin/invitations`

**Description**: Send new invitation to join tenant

**Request Body**: `CreateInvitationDto`

```typescript
{
  email: string;                // Valid email
  role: "DRIVER" | "MANAGER";
  userId: string;               // User ID to invite
  firstName?: string;           // Required for DRIVER
  lastName?: string;            // Required for DRIVER
  phone?: string;
  driverProfileId?: string;     // Link to existing driver profile
}
```

**Response**: `InvitationResponseDto`

**Use Cases**:

- Invite new drivers
- Add managers
- Driver onboarding

---

### 16. Resend Invitation

**Endpoint**: `PATCH /admin/invitations/:id/resend`

**Description**: Resend invitation email

**URL Parameters**:

- `id` - Invitation ID (UUID)

**Response**: `InvitationResponseDto`

**Use Cases**:

- Resend expired invitations
- Resend if email not received

---

### 17. Cancel Invitation

**Endpoint**: `DELETE /admin/invitations/:id`

**Description**: Cancel pending invitation

**URL Parameters**:

- `id` - Invitation ID (UUID)

**Response**: `204 No Content`

**Use Cases**:

- Revoke invitation
- Clean up unused invitations

---

## Reports & Analytics Endpoints

### 18. Revenue Report

**Endpoint**: `GET /admin/reports/revenue`

**Description**: Time-series revenue analysis

**Query Parameters**: `ReportsQueryDto`
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| from | string | No | - | Start date (ISO) |
| to | string | No | - | End date (ISO) |
| driverId | UUID | No | - | Filter by driver |
| granularity | enum | No | daily | daily, weekly, monthly |

**Response**: `RevenueReportResponse`

```typescript
{
  period: string; // "Last 30 days"
  data: Array<{
    period: string; // "2024-01-15"
    rideCount: number;
    totalRevenue: string;
    avgFarePerRide: string;
    totalDistanceKm: string;
    totalDurationMin: string;
  }>;
  summary: {
    totalRides: number;
    totalRevenue: string;
    avgRevenuePerDay: string;
    avgFarePerRide: string;
    totalDistanceKm: string;
    totalDurationHours: string;
  }
}
```

**Use Cases**:

- Revenue charts/graphs
- Financial reporting
- Trend analysis

---

### 19. Driver Performance Report

**Endpoint**: `GET /admin/reports/driver-performance`

**Description**: Driver performance metrics and rankings

**Query Parameters**: `ReportsQueryDto` (same as revenue report)

**Response**: `DriverPerformanceResponse`

```typescript
{
  period: string;
  drivers: Array<{
    driverProfileId: string;
    firstName: string;
    lastName: string;
    rideCount: number;
    totalRevenue: string;
    avgFarePerRide: string;
    totalDistanceKm: string;
    totalDurationHours: string;
    avgRidesPerDay: string;
  }>;
  fleetSummary: {
    totalDrivers: number;
    activeDrivers: number;
    totalRides: number;
    totalRevenue: string;
    avgRidesPerDriver: string;
    avgRevenuePerDriver: string;
  }
}
```

**Use Cases**:

- Driver leaderboard
- Performance evaluation
- Fleet management
- Driver incentives

---

### 20. Payment Methods Report

**Endpoint**: `GET /admin/reports/payment-methods`

**Description**: Payment method distribution and analysis

**Query Parameters**: `ReportsQueryDto` (same as revenue report)

**Response**: `PaymentMethodReportResponse`

```typescript
{
  period: string;
  paymentMethods: Array<{
    paymentMethod: string; // STRIPE, VIVA, CASH
    paymentCount: number;
    totalAmount: string;
    percentage: number; // % of total payments
  }>;
  summary: {
    totalPayments: number;
    totalAmount: string;
    avgPaymentAmount: string;
    paymentRate: string; // % of rides with payments
  }
}
```

**Use Cases**:

- Payment method analysis
- Cash vs card tracking
- Payment rate monitoring

---

### 21. Dashboard Summary

**Endpoint**: `GET /admin/reports/summary`

**Description**: Comprehensive dashboard KPIs

**Query Parameters**: `ReportsQueryDto` (same as revenue report)

**Response**:

```typescript
{
  period: {
    from: string;
    to: string;
  };
  totalRides: number;
  totalRevenue: string;
  totalDistance: string;
  avgFarePerRide: string;
  activeDrivers: number;
  completionRate: string;       // % of completed rides
  paymentRate: string;          // % of rides with payment
  topDriver: {
    name: string;
    rides: number;
    revenue: string;
  } | null;
}
```

**Use Cases**:

- Admin dashboard
- Quick overview
- KPI monitoring

---

## Data Management Strategy

### 1. Caching Strategy

#### **High-Value Cache Targets**

```typescript
// Dashboard Summary - Cache for 5-10 minutes
// Key: `dashboard:summary:{tenantId}:{from}:{to}`
GET / admin / reports / summary;

// Revenue Report - Cache for 15 minutes
// Key: `report:revenue:{tenantId}:{from}:{to}:{granularity}`
GET / admin / reports / revenue;

// Driver Performance - Cache for 10 minutes
// Key: `report:drivers:{tenantId}:{from}:{to}`
GET / admin / reports / driver - performance;

// Payment Methods Report - Cache for 10 minutes
// Key: `report:payments:{tenantId}:{from}:{to}`
GET / admin / reports / payment - methods;
```

#### **Medium-Value Cache Targets**

```typescript
// Driver List - Cache for 2-3 minutes
// Key: `drivers:list:{tenantId}:{page}:{status}:{q}`
GET / admin / drivers;

// Ride List - Cache for 1-2 minutes
// Key: `rides:list:{tenantId}:{page}:{filters...}`
GET / admin / rides;

// Payment Summary - Cache for 5 minutes
// Key: `payments:summary:{tenantId}:{from}:{to}`
GET / admin / payments / summary;
```

#### **No Cache / Short TTL**

- Single record fetches (GET by ID) - Optional 30s cache
- Mutations (POST, PATCH, DELETE) - Never cache
- Real-time data (ongoing rides) - No cache

#### **Cache Invalidation Rules**

```typescript
// Invalidate patterns on mutations:
- Driver created/updated → Invalidate `drivers:list:*`
- Ride ended → Invalidate `rides:list:*`, `dashboard:*`, `report:*`
- Payment created → Invalidate `payments:*`, `dashboard:*`, `report:*`
- Invitation sent → Invalidate `invitations:list:*`
```

---

### 2. Pagination Strategy

#### **Recommended Page Sizes**

```typescript
const PAGINATION_CONFIG = {
  // List views with frequent scrolling
  drivers: { default: 25, max: 100 },
  rides: { default: 25, max: 100 },
  payments: { default: 25, max: 100 },
  invitations: { default: 25, max: 100 },

  // Reports with smaller datasets
  driverPerformance: { default: 50, max: 100 },
};
```

#### **Cursor vs Offset Pagination**

Current: **Offset-based** (page + pageSize)

- ✅ Simple implementation
- ✅ Works well for admin dashboards
- ❌ Can skip records with concurrent updates

Consider cursor-based for:

- Real-time ride monitoring
- High-frequency data updates

---

### 3. Data Fetching Patterns

#### **Pattern 1: Parallel Fetching for Dashboard**

```typescript
// Example: Dashboard initialization
const [profile, summary, recentRides, activeDrivers] = await Promise.all([
  fetch('/admin/profile'),
  fetch('/admin/reports/summary?from=...&to=...'),
  fetch('/admin/rides?page=1&pageSize=10&status=ONGOING'),
  fetch('/admin/drivers?page=1&status=ACTIVE'),
]);
```

#### **Pattern 2: Progressive Enhancement**

```typescript
// Load critical data first
const summary = await fetch('/admin/reports/summary');
renderDashboard(summary);

// Load secondary data in background
Promise.all([
  fetch('/admin/reports/revenue'),
  fetch('/admin/reports/driver-performance'),
]).then(([revenue, drivers]) => {
  updateCharts(revenue, drivers);
});
```

#### **Pattern 3: Optimistic Updates**

```typescript
// For mutations with immediate feedback
updateDriverStatus(driverId, 'INACTIVE') {
  // Update UI immediately
  updateLocalState(driverId, { status: 'INACTIVE' });

  // Send request
  fetch(`/admin/drivers/${driverId}`, {
    method: 'PATCH',
    body: { status: 'INACTIVE' }
  }).catch(error => {
    // Revert on error
    updateLocalState(driverId, { status: previousStatus });
  });
}
```

---

### 4. State Management Recommendations

#### **Global State (Redux/Zustand)**

```typescript
interface AdminState {
  // User context
  currentAdmin: AdminProfile | null;
  tenantId: string;

  // Cached lists (with TTL)
  drivers: {
    data: DriverResponseDto[];
    total: number;
    page: number;
    lastFetch: number;
  };

  rides: {
    data: RideListItemDto[];
    total: number;
    page: number;
    lastFetch: number;
  };

  // Dashboard data
  dashboardSummary: DashboardData | null;
  dashboardLastFetch: number;
}
```

#### **Query Library (React Query / SWR)**

```typescript
// Recommended for automatic caching & refetching
import { useQuery } from '@tanstack/react-query';

const useDashboardSummary = (from: string, to: string) => {
  return useQuery({
    queryKey: ['dashboard', 'summary', from, to],
    queryFn: () => fetchDashboardSummary(from, to),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};
```

---

### 5. Data Export Strategy

#### **CSV Export Endpoints**

```typescript
// Generate exports for large datasets
POST /admin/exports/rides
POST /admin/exports/payments
POST /admin/exports/drivers

// Response: Export job ID
{ exportId: string, status: 'PENDING' }

// Check status
GET /admin/exports/:exportId/status

// Download when ready
GET /admin/exports/:exportId/download
```

#### **Export File Structure**

```
exports/
  {tenantId}/
    {YYYYMM}/
      rides_2024-01-15_to_2024-01-31.csv
      payments_2024-01-15_to_2024-01-31.csv
```

---

### 6. Real-Time Updates

#### **WebSocket Events for Live Data**

```typescript
// Subscribe to real-time events
socket.on('ride:created', (ride) => {
  invalidateCache('rides:list');
  addOptimisticUpdate(ride);
});

socket.on('payment:completed', (payment) => {
  invalidateCache('payments:list');
  invalidateCache('dashboard:summary');
  updateRidePaymentStatus(payment.rideId);
});

socket.on('driver:status_changed', (driver) => {
  updateDriverInList(driver);
});
```

---

### 7. Error Handling & Retry Strategy

#### **Error Types**

```typescript
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR', // Retry with backoff
  AUTH_ERROR = 'AUTH_ERROR', // Redirect to login
  VALIDATION_ERROR = 'VALIDATION_ERROR', // Show form errors
  NOT_FOUND = 'NOT_FOUND', // Show 404 message
  SERVER_ERROR = 'SERVER_ERROR', // Retry once, then error
}
```

#### **Retry Configuration**

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 1000, // 1s, 2s, 4s
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};
```

---

### 8. Performance Optimization

#### **Critical Performance Metrics**

```typescript
const PERFORMANCE_TARGETS = {
  // Time to First Byte
  dashboardLoad: 800, // ms
  listPageLoad: 500,
  reportLoad: 1500,

  // Time to Interactive
  dashboardInteractive: 2000,
  listPageInteractive: 1500,

  // Pagination response time
  pageChange: 300,
};
```

#### **Optimization Techniques**

1. **Lazy Loading**: Load reports on-demand
2. **Virtual Scrolling**: For long lists (100+ items)
3. **Debouncing**: Search inputs (300ms delay)
4. **Prefetching**: Next page on hover/scroll
5. **Service Workers**: Offline caching for read operations

---

### 9. Data Consistency

#### **Eventual Consistency Scenarios**

```typescript
// Scenario 1: Driver status change
// 1. User updates driver status to INACTIVE
// 2. Driver list shows INACTIVE immediately (optimistic)
// 3. Ongoing rides list still shows this driver (stale cache)
// 4. After cache expires (1-2 min), data syncs

// Mitigation: Invalidate related caches on mutation
await updateDriver(driverId, { status: 'INACTIVE' });
invalidate(['drivers:list', 'dashboard:summary', 'rides:list']);
```

#### **Strong Consistency Requirements**

- Payment creation → Immediate reflect in ride detail
- Ride completion → Immediate reflect in reports (or show "processing")
- Driver deletion → Immediate removal from all views

---

### 10. Frontend Component Data Flow

#### **Dashboard Page**

```typescript
// Data Requirements
- Admin profile
- Summary statistics (rides, revenue, drivers)
- Recent rides (5-10)
- Top performing drivers (5)
- Payment method breakdown

// Fetch Strategy
1. Load profile + summary in parallel (critical)
2. Load charts data in background
3. Refresh summary every 5 minutes
```

#### **Driver Management Page**

```typescript
// Data Requirements
- Paginated driver list
- Driver count by status
- Search/filter capabilities

// Fetch Strategy
1. Load first page (25 drivers)
2. Cache for 2-3 minutes
3. Invalidate on create/update/delete
4. Debounced search (300ms)
```

#### **Ride History Page**

```typescript
// Data Requirements
- Paginated ride list with filters
- Ride status distribution
- Date range selector

// Fetch Strategy
1. Load current page with applied filters
2. Cache for 1-2 minutes
3. Prefetch next page on scroll to bottom 20%
4. Real-time updates for ongoing rides
```

#### **Reports Page**

```typescript
// Data Requirements
- Revenue chart data
- Driver performance table
- Payment methods pie chart
- Date range selector

// Fetch Strategy
1. Load all reports in parallel
2. Cache for 10-15 minutes
3. Show loading skeletons
4. Support CSV export for large datasets
```

---

## Response Structures Reference

### Common Response Patterns

#### **Single Resource**

```typescript
{
  id: string;
  tenantId: string;
  // ... resource fields
  createdAt?: string;
  updatedAt?: string;
}
```

#### **Paginated List**

```typescript
{
  items: T[];
  total: number;        // Total count across all pages
  page: number;         // Current page (1-based)
  pageSize: number;     // Items per page
  totalPages?: number;  // Optional: total pages
}
```

#### **Report/Analytics**

```typescript
{
  period: string;       // Human-readable period
  data: Array<T>;       // Time-series or grouped data
  summary: {            // Aggregate statistics
    total*: number;
    avg*: string;
    // ... other aggregates
  };
}
```

#### **Error Response**

```typescript
{
  statusCode: number;   // HTTP status code
  message: string | string[];
  error: string;        // Error type
  path?: string;        // Request path
  timestamp?: string;
}
```

---

## API Usage Examples

### Example 1: Dashboard Initialization

```typescript
async function initializeDashboard() {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today - 30 * 24 * 60 * 60 * 1000);

    const [profile, summary] = await Promise.all([
      api.get('/admin/profile'),
      api.get('/admin/reports/summary', {
        params: {
          from: thirtyDaysAgo.toISOString(),
          to: today.toISOString(),
        },
      }),
    ]);

    return { profile, summary };
  } catch (error) {
    handleError(error);
  }
}
```

### Example 2: Search Drivers

```typescript
async function searchDrivers(searchTerm: string, status: string) {
  const response = await api.get('/admin/drivers', {
    params: {
      q: searchTerm,
      status: status || 'ALL',
      page: 1,
      pageSize: 25,
    },
  });

  return response.data; // DriversPageResponse
}
```

### Example 3: Generate Revenue Report

```typescript
async function generateRevenueReport(from: string, to: string) {
  const response = await api.get('/admin/reports/revenue', {
    params: {
      from,
      to,
      granularity: 'daily',
    },
  });

  // Transform for charting library
  const chartData = response.data.data.map((item) => ({
    date: item.period,
    revenue: parseFloat(item.totalRevenue),
    rides: item.rideCount,
  }));

  return { raw: response.data, chart: chartData };
}
```

### Example 4: Create and Track Payment

```typescript
async function recordCashPayment(rideId: string, amount: string) {
  try {
    const payment = await api.post('/admin/payments', {
      rideId,
      amount,
      paymentMethod: 'cash',
      notes: 'Recorded by admin',
    });

    // Invalidate caches
    invalidateCache(['payments:list', 'dashboard:summary']);

    return payment.data;
  } catch (error) {
    if (error.response?.status === 400) {
      throw new Error('Invalid payment data');
    }
    throw error;
  }
}
```

---

## Security Considerations

### Rate Limiting

- Implement rate limiting per tenant
- Suggested: 100 requests/minute for admin APIs
- 10 requests/minute for report generation

### Data Access Control

- All endpoints enforce tenant isolation via `tenantId`
- No cross-tenant data access
- ADMIN role has full access, MANAGER role may have restrictions

### Sensitive Data

- Payment details include full amounts
- Driver personal information (email, phone)
- Ensure HTTPS in production
- Consider field-level encryption for PII

---

## Changelog & Versioning

### API Version: v1

- All endpoints are under `/admin` base path
- No versioning in URL currently
- Use `Accept` header for future versioning

### Deprecated Endpoints

- None currently

### Planned Enhancements

- CSV export endpoints for bulk data
- Webhook notifications for events
- Advanced filtering with query builder
- Scheduled report generation

---

## Support & Contact

For API issues or questions:

- Check error responses for detailed messages
- Review this documentation
- Contact backend team for clarifications

**Document Version**: 1.0  
**Last Updated**: January 30, 2026  
**Maintained By**: Backend Team
