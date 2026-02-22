# 🚕 Admin Rides API - Frontend Integration Guide

## 📋 Quick Summary

**Endpoint:** `GET /api/admin/rides`  
**Purpose:** Fetch paginated rides with advanced filtering, sorting, and summary statistics  
**Auth:** Requires admin JWT token  
**Pagination:** Cursor-based (stable, efficient)

---

## 🎯 TypeScript Types (Copy to Frontend)

```typescript
// Enums
export enum RideStatus {
  DRAFT = 'DRAFT',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  REQUIRES_ACTION = 'REQUIRES_ACTION',
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProvider {
  CASH = 'CASH',
  VIVA = 'VIVA',
}

export type PaymentMethod = 'CASH' | 'CARD';

export type RideFlag =
  | 'PAYMENT_FAILED' // Payment status is FAILED
  | 'PAYMENT_PENDING' // Payment status is PENDING
  | 'MISSING_PAYMENT' // Completed ride with no payment
  | 'MISSING_ENDED_AT' // Completed ride with no end time
  | 'FARE_ZERO'; // Fare is 0 or null

// Request Query Params
export interface RidesQueryParams {
  // Time Range
  from?: string; // ISO date string (inclusive)
  to?: string; // ISO date string (exclusive)

  // Filters (comma-separated)
  status?: string; // e.g., "COMPLETED,CANCELLED"
  paymentStatus?: string; // e.g., "PAID,PENDING"
  provider?: string; // e.g., "VIVA,CASH"
  method?: string; // e.g., "CASH,CARD"

  // Single filters
  driverId?: string; // UUID
  q?: string; // Search ride ID or payment external ID

  // Sorting
  sortBy?: 'startedAt' | 'fareTotal' | 'durationMin' | 'distanceKm';
  sortDir?: 'asc' | 'desc';

  // Pagination
  limit?: number; // 1-100, default 20
  cursor?: string; // Opaque cursor from previous response
  cursorDir?: 'next' | 'prev';
}

// Response
export interface AdminRidesResponse {
  data: RideRow[];
  page: PageInfo;
  summary: RideSummary;
}

export interface RideRow {
  id: string;
  startedAt: string; // ISO date string
  endedAt: string | null;
  status: RideStatus;
  driver: {
    id: string;
    name: string; // "First Last" (combined)
  };
  durationMin: string | null; // "23.00"
  distanceKm: string | null; // "12.300"
  fareTotal: string | null; // "38.90"
  currency: string; // "EUR"
  payment: {
    status: PaymentStatus;
    provider: PaymentProvider;
    method: PaymentMethod;
    externalPaymentIdMasked: string | null; // "tx_****8891"
  } | null;
  flags: RideFlag[]; // ["PAYMENT_FAILED"]
}

export interface PageInfo {
  limit: number;
  nextCursor: string | null;
  prevCursor: string | null;
}

export interface RideSummary {
  ridesCount: number;
  totalFare: string; // "4200.50"
  totalTax: string; // "812.00"
  byStatus: {
    COMPLETED: number;
    CANCELLED: number;
    ONGOING: number;
    DRAFT: number;
  };
  byPaymentStatus: {
    PAID: number;
    PENDING: number;
    FAILED: number;
    REQUIRES_ACTION: number;
    REFUNDED: number;
  };
}
```

---

## � Ride Detail Endpoint (Click Row → Open Details)

### **Endpoint**

```
GET /api/admin/rides/:rideId
```

### **Purpose**

Get full ride details for admin audit/review when user clicks on a ride row.

### **TypeScript Types**

```typescript
export interface RideDetail {
  id: string;
  status: RideStatus;
  startedAt: string;
  endedAt: string | null;
  durationMin: string | null;
  distanceKm: string | null;
  fareSubtotal: string | null;
  taxAmount: string | null;
  fareTotal: string | null;
  currency: string;
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string;
  };
  pricingPolicy: {
    id: string;
    name: string;
    baseFare: string;
    perMinute: string;
    perKm: string;
    createdAt: string;
  } | null;
  payment: {
    id: string;
    provider: PaymentProvider;
    status: PaymentStatus;
    method: PaymentMethod;
    amount: string;
    currency: string;
    authorizedAt: string | null;
    capturedAt: string | null;
    failureCode: string | null;
    externalPaymentId: string | null; // ✅ Full ID (not masked) for admin
  } | null;
}
```

### **Example Usage**

```typescript
// When user clicks a ride row
async function openRideDetails(rideId: string) {
  const response = await fetch(`/api/admin/rides/${rideId}`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      showError('Ride not found');
    } else {
      showError('Failed to load ride details');
    }
    return;
  }

  const rideDetail: RideDetail = await response.json();
  openDrawer(rideDetail);
}
```

### **Example Response**

```json
{
  "id": "e3f2a5b8-1234-5678-90ab-cdef01234567",
  "status": "COMPLETED",
  "startedAt": "2026-02-13T09:12:00Z",
  "endedAt": "2026-02-13T09:35:00Z",
  "durationMin": "23.00",
  "distanceKm": "12.300",
  "fareSubtotal": "31.37",
  "taxAmount": "7.53",
  "fareTotal": "38.90",
  "currency": "EUR",
  "driver": {
    "id": "driver-uuid",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+358401234567",
    "email": "john.doe@example.com"
  },
  "pricingPolicy": {
    "id": "policy-uuid",
    "name": "Default 2026",
    "baseFare": "5.00",
    "perMinute": "0.45",
    "perKm": "1.35",
    "createdAt": "2026-01-01T00:00:00Z"
  },
  "payment": {
    "id": "payment-uuid",
    "provider": "VIVA",
    "status": "PAID",
    "method": "CARD",
    "amount": "38.90",
    "currency": "EUR",
    "authorizedAt": null,
    "capturedAt": "2026-02-13T09:36:10Z",
    "failureCode": null,
    "externalPaymentId": "1234567890"
  }
}
```

### **Key Differences from List Endpoint**

| Feature        | List Endpoint          | Detail Endpoint                                  |
| -------------- | ---------------------- | ------------------------------------------------ |
| Driver info    | Combined name only     | Full details (firstName, lastName, phone, email) |
| Payment ID     | Masked (`tx_****8891`) | Full ID (`1234567890`) for audit                 |
| Pricing Policy | Not included           | Full policy details with rates                   |
| Fare breakdown | `fareTotal` only       | `fareSubtotal`, `taxAmount`, `fareTotal`         |
| Use case       | Table display          | Drawer/modal details                             |

### **Security**

✅ **Tenant Isolation**: Ride must belong to your tenant  
✅ **Role Check**: Only ADMIN/MANAGER can access  
✅ **404 Response**: If ride doesn't exist in your tenant (doesn't leak existence)

### **Error Responses**

```typescript
// 400 Bad Request - Invalid UUID format
{
  "statusCode": 400,
  "message": "Invalid ride ID format"
}

// 404 Not Found - Ride doesn't exist in your tenant
{
  "statusCode": 404,
  "message": "Ride with ID e3f2a5b8-1234-5678-90ab-cdef01234567 not found"
}
```

### **React Component Example**

```tsx
function RideDetailsDrawer({ rideId, isOpen, onClose }: Props) {
  const { data, loading, error } = useQuery({
    queryKey: ['ride-detail', rideId],
    queryFn: () => fetchRideDetails(rideId),
    enabled: isOpen && !!rideId,
  });

  if (loading) return <DrawerSkeleton />;
  if (error) return <ErrorMessage />;
  if (!data) return null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose}>
      <DrawerHeader>
        <h2>Ride Details</h2>
        <StatusBadge status={data.status} />
      </DrawerHeader>

      <DrawerBody>
        {/* Time & Duration */}
        <Section title="Timeline">
          <Field label="Started" value={formatDate(data.startedAt)} />
          <Field label="Ended" value={formatDate(data.endedAt)} />
          <Field label="Duration" value={`${data.durationMin} min`} />
          <Field label="Distance" value={`${data.distanceKm} km`} />
        </Section>

        {/* Fare Breakdown */}
        <Section title="Fare Breakdown">
          <Field label="Subtotal" value={`€${data.fareSubtotal}`} />
          <Field label="Tax (24%)" value={`€${data.taxAmount}`} />
          <Divider />
          <Field label="Total" value={`€${data.fareTotal}`} emphasized />
        </Section>

        {/* Driver Info */}
        <Section title="Driver">
          <Field
            label="Name"
            value={`${data.driver.firstName} ${data.driver.lastName}`}
          />
          <Field label="Email" value={data.driver.email} />
          <Field label="Phone" value={data.driver.phone} />
        </Section>

        {/* Pricing Policy */}
        {data.pricingPolicy && (
          <Section title="Pricing Policy">
            <Field label="Policy" value={data.pricingPolicy.name} />
            <Field
              label="Base Fare"
              value={`€${data.pricingPolicy.baseFare}`}
            />
            <Field
              label="Per Minute"
              value={`€${data.pricingPolicy.perMinute}`}
            />
            <Field label="Per Km" value={`€${data.pricingPolicy.perKm}`} />
          </Section>
        )}

        {/* Payment Details */}
        {data.payment ? (
          <Section title="Payment">
            <Field
              label="Status"
              value={<PaymentStatusBadge status={data.payment.status} />}
            />
            <Field label="Provider" value={data.payment.provider} />
            <Field label="Method" value={data.payment.method} />
            <Field
              label="Amount"
              value={`${data.payment.amount} ${data.payment.currency}`}
            />
            <Field
              label="Captured At"
              value={formatDate(data.payment.capturedAt)}
            />
            {data.payment.externalPaymentId && (
              <Field
                label="External ID"
                value={<CopyableText text={data.payment.externalPaymentId} />}
              />
            )}
            {data.payment.failureCode && (
              <Field
                label="Failure Code"
                value={data.payment.failureCode}
                error
              />
            )}
          </Section>
        ) : (
          <Alert type="warning">No payment recorded for this ride</Alert>
        )}
      </DrawerBody>

      <DrawerFooter>
        <Button onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={() => exportRidePDF(rideId)}>
          Export PDF
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}
```

### **Testing in Postman**

```
GET http://localhost:3000/api/admin/rides/e3f2a5b8-1234-5678-90ab-cdef01234567

Headers:
  Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**Test Scenarios:**

1. ✅ Valid ride ID → 200 + full details
2. ❌ Invalid UUID format → 400 error
3. ❌ Non-existent ride ID → 404 error
4. ❌ Ride from different tenant → 404 error

---

## �🔧 Query Parameters Guide

### 1. **Time Range** (Open-ended support)

```javascript
// Last 7 days
const last7Days = {
  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  // No 'to' = open-ended (until now)
};

// Specific month
const januaryRides = {
  from: '2026-01-01T00:00:00Z',
  to: '2026-02-01T00:00:00Z',
};

// Everything before a date
const beforeMarch = {
  to: '2026-03-01T00:00:00Z',
  // No 'from' = all rides before March
};
```

### 2. **Multi-Select Filters** (Comma-separated)

```javascript
// Multiple statuses
const completedOrCancelled = {
  status: 'COMPLETED,CANCELLED',
};

// Multiple payment statuses
const problemPayments = {
  paymentStatus: 'FAILED,PENDING,REQUIRES_ACTION',
};

// Multiple providers
const nonCashRides = {
  provider: 'VIVA', // or 'VIVA,STRIPE' when you add Stripe
};
```

### 3. **Text Search**

```javascript
// Search by ride ID prefix
const searchById = {
  q: 'e3f2a', // Matches ride IDs starting with "e3f2a"
};

// Search by payment external ID
const searchByPayment = {
  q: 'tx_1234', // Matches payment external IDs
};
```

### 4. **Sorting**

```javascript
// Default: newest first
// sortBy: 'startedAt', sortDir: 'desc'

// Highest fare first
const highestFare = {
  sortBy: 'fareTotal',
  sortDir: 'desc',
};

// Longest rides first
const longestRides = {
  sortBy: 'durationMin',
  sortDir: 'desc',
};
```

### 5. **Pagination**

```javascript
// Initial load (page 1)
const initialLoad = {
  limit: 20,
};

// Next page (use cursor from previous response)
const nextPage = {
  limit: 20,
  cursor: response.page.nextCursor,
  cursorDir: 'next',
};

// Previous page
const prevPage = {
  limit: 20,
  cursor: response.page.prevCursor,
  cursorDir: 'prev',
};
```

---

## 📦 Example API Calls

### 1. **Initial Load (Default)**

```typescript
// GET /api/admin/rides
// Returns last 20 rides, sorted by startedAt desc

const response = await fetch('/api/admin/rides', {
  headers: {
    Authorization: `Bearer ${adminToken}`,
  },
});

const data: AdminRidesResponse = await response.json();
```

### 2. **Filter by Completed Rides, Last Month**

```typescript
const params = new URLSearchParams({
  status: 'COMPLETED',
  from: '2026-01-01T00:00:00Z',
  to: '2026-02-01T00:00:00Z',
  limit: '25',
});

const response = await fetch(`/api/admin/rides?${params}`, {
  headers: { Authorization: `Bearer ${adminToken}` },
});
```

### 3. **Filter by Driver and Payment Status**

```typescript
const params = new URLSearchParams({
  driverId: 'uuid-of-driver',
  paymentStatus: 'PAID,PENDING',
  sortBy: 'startedAt',
  sortDir: 'desc',
});
```

### 4. **Search with Text**

```typescript
const params = new URLSearchParams({
  q: 'e3f2a', // Search ride or payment ID
  limit: '20',
});
```

---

## 🎨 React/TypeScript Usage Example

### Hook: `useRides`

```typescript
import { useState, useEffect } from 'react';

interface UseRidesOptions extends RidesQueryParams {
  enabled?: boolean;
}

export function useRides(options: UseRidesOptions = {}) {
  const [data, setData] = useState<AdminRidesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRides = async (params: RidesQueryParams) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();

      // Add all non-null params
      Object.entries(params).forEach(([key, value]) => {
        if (value != null) {
          searchParams.append(key, String(value));
        }
      });

      const response = await fetch(`/api/admin/rides?${searchParams}`, {
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch rides');

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.enabled !== false) {
      fetchRides(options);
    }
  }, [JSON.stringify(options)]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchRides(options),
    fetchNext: () => {
      if (data?.page.nextCursor) {
        fetchRides({
          ...options,
          cursor: data.page.nextCursor,
          cursorDir: 'next',
        });
      }
    },
    fetchPrev: () => {
      if (data?.page.prevCursor) {
        fetchRides({
          ...options,
          cursor: data.page.prevCursor,
          cursorDir: 'prev',
        });
      }
    },
  };
}
```

### Component: `RidesTable`

```typescript
import React, { useState } from 'react';

export function RidesTable() {
  const [filters, setFilters] = useState<RidesQueryParams>({
    limit: 20,
    sortBy: 'startedAt',
    sortDir: 'desc',
  });

  const { data, loading, error, fetchNext, fetchPrev } = useRides(filters);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return null;

  return (
    <div>
      {/* Summary Cards */}
      <SummaryCards summary={data.summary} />

      {/* Filters */}
      <RidesFilters filters={filters} onChange={setFilters} />

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>Ride ID</th>
            <th>Date</th>
            <th>Driver</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Distance</th>
            <th>Fare</th>
            <th>Payment</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((ride) => (
            <RideRow key={ride.id} ride={ride} />
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <Pagination
        onNext={fetchNext}
        onPrev={fetchPrev}
        hasNext={!!data.page.nextCursor}
        hasPrev={!!data.page.prevCursor}
      />
    </div>
  );
}
```

### Component: `RideRow`

```typescript
function RideRow({ ride }: { ride: RideRow }) {
  return (
    <tr>
      <td>{ride.id.slice(0, 8)}...</td>
      <td>{new Date(ride.startedAt).toLocaleString()}</td>
      <td>{ride.driver.name}</td>
      <td>
        <StatusBadge status={ride.status} />
      </td>
      <td>{ride.durationMin ? `${ride.durationMin} min` : '-'}</td>
      <td>{ride.distanceKm ? `${ride.distanceKm} km` : '-'}</td>
      <td>
        {ride.fareTotal ? `${ride.fareTotal} ${ride.currency}` : '-'}
      </td>
      <td>
        {ride.payment ? (
          <PaymentBadge payment={ride.payment} />
        ) : (
          <span className="text-gray-400">No payment</span>
        )}
      </td>
      <td>
        <FlagsDisplay flags={ride.flags} />
      </td>
    </tr>
  );
}
```

---

## 🚩 Working with Flags

Flags are **server-generated** problem indicators. Handle them in the UI:

```typescript
function FlagsDisplay({ flags }: { flags: RideFlag[] }) {
  if (flags.length === 0) return <span className="text-green-500">✓</span>;

  const flagConfig = {
    PAYMENT_FAILED: { icon: '❌', color: 'red', label: 'Payment Failed' },
    PAYMENT_PENDING: { icon: '⏳', color: 'yellow', label: 'Payment Pending' },
    MISSING_PAYMENT: { icon: '⚠️', color: 'orange', label: 'Missing Payment' },
    MISSING_ENDED_AT: { icon: '⚠️', color: 'orange', label: 'Missing End Time' },
    FARE_ZERO: { icon: '⚠️', color: 'orange', label: 'Zero Fare' },
  };

  return (
    <div className="flex gap-1">
      {flags.map((flag) => (
        <span
          key={flag}
          className={`badge badge-${flagConfig[flag].color}`}
          title={flagConfig[flag].label}
        >
          {flagConfig[flag].icon}
        </span>
      ))}
    </div>
  );
}
```

---

## 💡 Best Practices

### 1. **Caching**

```typescript
// Cache for 1-2 minutes
const cacheTime = 2 * 60 * 1000; // 2 minutes

// Use React Query or SWR
import { useQuery } from '@tanstack/react-query';

const { data } = useQuery({
  queryKey: ['admin-rides', filters],
  queryFn: () => fetchRides(filters),
  staleTime: cacheTime,
});
```

### 2. **Infinite Scroll**

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['admin-rides', filters],
  queryFn: ({ pageParam }) => fetchRides({ ...filters, cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.page.nextCursor,
});
```

### 3. **Real-time Updates**

```typescript
// Poll for ongoing rides every 10 seconds
const { data } = useQuery({
  queryKey: ['admin-rides', { status: 'ONGOING' }],
  queryFn: () => fetchRides({ status: 'ONGOING' }),
  refetchInterval: 10000, // 10 seconds
});
```

### 4. **Handle Masked Payment IDs**

```typescript
// Already masked server-side: "tx_****8891"
// Just display as-is, no client-side masking needed
<span>{ride.payment?.externalPaymentIdMasked || 'N/A'}</span>
```

### 5. **Summary Widget**

```typescript
function SummaryCards({ summary }: { summary: RideSummary }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <h3>Total Rides</h3>
        <p className="text-3xl">{summary.ridesCount}</p>
      </Card>

      <Card>
        <h3>Total Revenue</h3>
        <p className="text-3xl">€{summary.totalFare}</p>
        <p className="text-sm text-gray-500">Tax: €{summary.totalTax}</p>
      </Card>

      <Card>
        <h3>By Status</h3>
        <ul>
          <li>Completed: {summary.byStatus.COMPLETED}</li>
          <li>Ongoing: {summary.byStatus.ONGOING}</li>
          <li>Cancelled: {summary.byStatus.CANCELLED}</li>
        </ul>
      </Card>

      <Card>
        <h3>Payments</h3>
        <ul>
          <li className="text-green-600">Paid: {summary.byPaymentStatus.PAID}</li>
          <li className="text-yellow-600">Pending: {summary.byPaymentStatus.PENDING}</li>
          <li className="text-red-600">Failed: {summary.byPaymentStatus.FAILED}</li>
        </ul>
      </Card>
    </div>
  );
}
```

---

## 🎯 Common Use Cases

### 1. **Dashboard: Recent Rides**

```typescript
const recentRides = useRides({
  limit: 10,
  sortBy: 'startedAt',
  sortDir: 'desc',
});
```

### 2. **Financial Report: Completed Rides This Month**

```typescript
const thisMonthCompleted = useRides({
  status: 'COMPLETED',
  from: '2026-02-01T00:00:00Z',
  to: '2026-03-01T00:00:00Z',
  limit: 100,
});
```

### 3. **Problem Rides: Failed Payments**

```typescript
const failedPayments = useRides({
  paymentStatus: 'FAILED',
  sortBy: 'startedAt',
  sortDir: 'desc',
});
```

### 4. **Driver Performance: Specific Driver's Rides**

```typescript
const driverRides = useRides({
  driverId: selectedDriver.id,
  from: startOfMonth.toISOString(),
  sortBy: 'startedAt',
  sortDir: 'desc',
});
```

---

## 🔍 Testing the API with Postman

### Step 1: Get Your Admin JWT Token

Before testing, you need an admin token. Use your login endpoint:

**Request:**

```
POST http://localhost:3000/api/auth/admin/login

Body (JSON):
{
  "email": "admin@yourtenant.com",
  "password": "your_password"
}
```

**Copy the `accessToken` from the response.** You'll need it for all subsequent requests.

---

### Step 2: Create a New Request in Postman

1. **Click** "New" → "HTTP Request"
2. **Set Method:** `GET`
3. **Set URL:** `http://localhost:3000/api/admin/rides`
4. **Add Authorization Header:**
   - Go to "Headers" tab
   - Add header:
     - **Key:** `Authorization`
     - **Value:** `Bearer YOUR_ACCESS_TOKEN_HERE`

   Or use the "Authorization" tab:
   - Type: `Bearer Token`
   - Token: `YOUR_ACCESS_TOKEN_HERE`

---

### Step 3: Test Cases in Postman

#### Test 1: **Default Request (No Params)**

Returns last 20 rides, sorted by startedAt desc.

```
GET http://localhost:3000/api/admin/rides
```

**Expected Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "startedAt": "2026-02-13T09:12:00Z",
      "endedAt": "2026-02-13T09:35:00Z",
      "status": "COMPLETED",
      "driver": {
        "id": "uuid",
        "name": "John Doe"
      },
      "durationMin": "23.00",
      "distanceKm": "12.300",
      "fareTotal": "38.90",
      "currency": "EUR",
      "payment": {
        "status": "PAID",
        "provider": "VIVA",
        "method": "CARD",
        "externalPaymentIdMasked": "tx_****8891"
      },
      "flags": []
    }
  ],
  "page": {
    "limit": 20,
    "nextCursor": "eyJzb3J0VmFsdWU...",
    "prevCursor": null
  },
  "summary": {
    "ridesCount": 150,
    "totalFare": "5420.50",
    "totalTax": "1050.20",
    "byStatus": {
      "COMPLETED": 120,
      "CANCELLED": 20,
      "ONGOING": 8,
      "DRAFT": 2
    },
    "byPaymentStatus": {
      "PAID": 110,
      "PENDING": 25,
      "FAILED": 10,
      "REQUIRES_ACTION": 3,
      "REFUNDED": 2
    }
  }
}
```

---

#### Test 2: **Filter by Status**

Get only completed rides.

```
GET http://localhost:3000/api/admin/rides?status=COMPLETED&limit=25
```

**Postman Params Tab:**

- `status`: `COMPLETED`
- `limit`: `25`

---

#### Test 3: **Multiple Status Filter**

Get completed AND cancelled rides (comma-separated).

```
GET http://localhost:3000/api/admin/rides?status=COMPLETED,CANCELLED
```

**Postman Params Tab:**

- `status`: `COMPLETED,CANCELLED`

---

#### Test 4: **Date Range Filter**

Get rides from last 7 days.

```
GET http://localhost:3000/api/admin/rides?from=2026-02-06T00:00:00Z
```

**Postman Params Tab:**

- `from`: `2026-02-06T00:00:00Z`

Or specific date range (January 2026):

```
GET http://localhost:3000/api/admin/rides?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z
```

**Postman Params Tab:**

- `from`: `2026-01-01T00:00:00Z`
- `to`: `2026-02-01T00:00:00Z`

---

#### Test 5: **Filter by Driver**

Get all rides for a specific driver (replace with actual UUID).

```
GET http://localhost:3000/api/admin/rides?driverId=550f37a1-9429-4651-bda3-6f7603df149e
```

**Postman Params Tab:**

- `driverId`: `550f37a1-9429-4651-bda3-6f7603df149e`

---

#### Test 6: **Payment Status Filter**

Get rides with failed or pending payments.

```
GET http://localhost:3000/api/admin/rides?paymentStatus=FAILED,PENDING
```

**Postman Params Tab:**

- `paymentStatus`: `FAILED,PENDING`

---

#### Test 7: **Payment Provider Filter**

Get only VIVA (card) payments.

```
GET http://localhost:3000/api/admin/rides?provider=VIVA
```

**Postman Params Tab:**

- `provider`: `VIVA`

Or only cash payments:

```
GET http://localhost:3000/api/admin/rides?provider=CASH
```

---

#### Test 8: **Text Search**

Search by ride ID prefix.

```
GET http://localhost:3000/api/admin/rides?q=e3f2a
```

**Postman Params Tab:**

- `q`: `e3f2a`

This will match any ride whose ID starts with "e3f2a" OR any payment whose external ID starts with "e3f2a".

---

#### Test 9: **Sorting**

Sort by fare (highest first).

```
GET http://localhost:3000/api/admin/rides?sortBy=fareTotal&sortDir=desc
```

**Postman Params Tab:**

- `sortBy`: `fareTotal`
- `sortDir`: `desc`

Sort by duration (longest first):

```
GET http://localhost:3000/api/admin/rides?sortBy=durationMin&sortDir=desc
```

Sort by distance:

```
GET http://localhost:3000/api/admin/rides?sortBy=distanceKm&sortDir=desc
```

---

#### Test 10: **Pagination (Next Page)**

1. First, make a request to get the initial page
2. Copy the `nextCursor` from the response
3. Use it in the next request:

```
GET http://localhost:3000/api/admin/rides?cursor=eyJzb3J0VmFsdWU6IjIwMjYtMDItMTNUMDk6MTI6MDBaIiwiaWQiOiJ1dWlkIn0=&cursorDir=next
```

**Postman Params Tab:**

- `cursor`: `<paste-the-nextCursor-value>`
- `cursorDir`: `next`

---

#### Test 11: **Pagination (Previous Page)**

Use the `prevCursor` to go back:

```
GET http://localhost:3000/api/admin/rides?cursor=<prevCursor-value>&cursorDir=prev
```

**Postman Params Tab:**

- `cursor`: `<paste-the-prevCursor-value>`
- `cursorDir`: `prev`

---

#### Test 12: **Complex Filter Example**

Get completed rides from last month with failed payments, sorted by fare:

```
GET http://localhost:3000/api/admin/rides?status=COMPLETED&from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z&paymentStatus=FAILED&sortBy=fareTotal&sortDir=desc&limit=50
```

**Postman Params Tab:**

- `status`: `COMPLETED`
- `from`: `2026-01-01T00:00:00Z`
- `to`: `2026-02-01T00:00:00Z`
- `paymentStatus`: `FAILED`
- `sortBy`: `fareTotal`
- `sortDir`: `desc`
- `limit`: `50`

---

### Step 4: Save Your Request Collection

1. **Save the request** as "Get Admin Rides"
2. **Create a Collection** called "Admin Rides API"
3. **Save variables:**
   - Right-click collection → "Edit"
   - Go to "Variables" tab
   - Add:
     - `base_url`: `http://localhost:3000`
     - `admin_token`: `<your-token>`

4. **Update your request URL** to use variables:

   ```
   {{base_url}}/api/admin/rides
   ```

5. **Update Authorization** to use variable:
   ```
   Bearer {{admin_token}}
   ```

---

### Step 5: Test Response Structure

In Postman, go to the "Tests" tab and add validation scripts:

```javascript
// Validate status code
pm.test('Status code is 200', function () {
  pm.response.to.have.status(200);
});

// Validate response structure
pm.test('Response has correct structure', function () {
  const jsonData = pm.response.json();

  pm.expect(jsonData).to.have.property('data');
  pm.expect(jsonData).to.have.property('page');
  pm.expect(jsonData).to.have.property('summary');

  pm.expect(jsonData.data).to.be.an('array');
  pm.expect(jsonData.page).to.have.property('limit');
  pm.expect(jsonData.page).to.have.property('nextCursor');
  pm.expect(jsonData.summary).to.have.property('ridesCount');
});

// Validate ride structure
pm.test('Each ride has required fields', function () {
  const jsonData = pm.response.json();

  if (jsonData.data.length > 0) {
    const ride = jsonData.data[0];

    pm.expect(ride).to.have.property('id');
    pm.expect(ride).to.have.property('startedAt');
    pm.expect(ride).to.have.property('status');
    pm.expect(ride).to.have.property('driver');
    pm.expect(ride).to.have.property('currency');
    pm.expect(ride).to.have.property('flags');

    pm.expect(ride.driver).to.have.property('name');
    pm.expect(ride.flags).to.be.an('array');
  }
});

// Validate summary structure
pm.test('Summary has correct structure', function () {
  const summary = pm.response.json().summary;

  pm.expect(summary).to.have.property('ridesCount');
  pm.expect(summary).to.have.property('totalFare');
  pm.expect(summary).to.have.property('totalTax');
  pm.expect(summary).to.have.property('byStatus');
  pm.expect(summary).to.have.property('byPaymentStatus');

  pm.expect(summary.byStatus).to.have.all.keys(
    'COMPLETED',
    'CANCELLED',
    'ONGOING',
    'DRAFT',
  );
  pm.expect(summary.byPaymentStatus).to.have.all.keys(
    'PAID',
    'PENDING',
    'FAILED',
    'REQUIRES_ACTION',
    'REFUNDED',
  );
});
```

---

### Step 6: Common Errors and Solutions

#### ❌ Error: `401 Unauthorized`

**Cause:** Invalid or expired token

**Solution:**

1. Re-login to get a fresh token
2. Update the `Authorization` header
3. Check that token format is: `Bearer <token>` (with space)

---

#### ❌ Error: `403 Forbidden`

**Cause:** User is not an admin

**Solution:**

- Ensure you're logged in with an admin account
- Check your user role in the database

---

#### ❌ Error: `400 Bad Request`

**Cause:** Invalid query parameters

**Common issues:**

- Invalid date format (must be ISO 8601: `2026-02-13T09:12:00Z`)
- Invalid enum value (check RideStatus, PaymentStatus spelling)
- Invalid UUID format for `driverId`
- `limit` out of range (must be 1-100)

**Solution:** Check the error message in response body for details.

---

### Step 7: Export Postman Collection

To share with your team:

1. Right-click your collection → "Export"
2. Choose "Collection v2.1"
3. Save as `admin-rides-api.postman_collection.json`
4. Share the file or import it into your team workspace

---

### Alternative: cURL Commands

If you prefer command line:

```bash
# Default request
curl -X GET "http://localhost:3000/api/admin/rides" \
  -H "Authorization: Bearer YOUR_TOKEN"

# With filters
curl -X GET "http://localhost:3000/api/admin/rides?status=COMPLETED&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Complex filter
curl -G "http://localhost:3000/api/admin/rides" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --data-urlencode "status=COMPLETED,CANCELLED" \
  --data-urlencode "from=2026-01-01T00:00:00Z" \
  --data-urlencode "paymentStatus=PAID"
```

---

### Pro Tips for Postman

1. **Use Environment Variables** for `base_url` and `admin_token`
2. **Create a Pre-request Script** to auto-refresh expired tokens
3. **Use Collection Runner** to test multiple scenarios at once
4. **Add Tests** to validate response structure automatically
5. **Use Postman Console** (View → Show Postman Console) to debug requests
6. **Save Example Responses** for documentation

---

## 📊 Response Size Estimation

| Rides | Approx Size | Load Time (3G) | Recommendation     |
| ----- | ----------- | -------------- | ------------------ |
| 20    | ~15 KB      | < 1s           | ✅ Default         |
| 50    | ~35 KB      | < 2s           | ✅ Good            |
| 100   | ~70 KB      | ~3s            | ⚠️ Max recommended |

**Use smaller limits (20-25) for mobile, larger (50-100) for desktop.**

---

## ⚠️ Error Handling

```typescript
try {
  const response = await fetch('/api/admin/rides?limit=20');

  if (!response.ok) {
    if (response.status === 401) {
      // Unauthorized - redirect to login
      redirectToLogin();
    } else if (response.status === 403) {
      // Forbidden - not an admin
      showError('Admin access required');
    } else if (response.status === 400) {
      // Bad request - invalid query params
      const error = await response.json();
      showError(error.message);
    } else {
      // Server error
      showError('Failed to load rides');
    }
  }

  const data = await response.json();
} catch (error) {
  // Network error
  showError('Network error. Please check your connection.');
}
```

---

## 🚀 Performance Tips

1. **Debounce search input** (300ms)
2. **Use cursor pagination** (faster than offset)
3. **Cache summary data** (2-5 minutes)
4. **Prefetch next page** on scroll to 80%
5. **Lazy load table rows** (virtual scrolling for 100+ items)
6. **Show loading skeletons** instead of spinners
7. **Use optimistic updates** for quick feedback

---

## 📝 Full Working Example (React + TypeScript)

See the complete implementation in `/examples/AdminRidesPage.tsx` (TODO: create this file)

---

**Questions?** Check the backend code:

- DTOs: `src/admin/controllers/newRides/dto/newRides-dto.ts`
- Service: `src/admin/controllers/newRides/services/newRides-service.ts`
- Controller: `src/admin/controllers/newRides/controllers/newRides.controller.ts`
