# 🚕 Admin Profile API Documentation

## Overview

The Admin Profile API allows administrators and managers to view their own profile information, including account details, tenant context, and activity statistics.

## Base URL

```
GET /admin/profile
```

## Authentication & Authorization

### Required Headers

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Required Permissions

- **Role**: `ADMIN` or `MANAGER`
- **Authentication**: Valid JWT token required
- **Scope**: Current tenant only

---

## API Endpoints

### 1. Get Admin Profile

**Endpoint**: `GET /admin/profile`

**Description**: Retrieves the current admin/manager's profile information

#### Request Example

```http
GET /admin/profile HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response Format

```typescript
interface AdminProfileResponse {
  id: string; // Admin user ID
  email: string; // Admin email address
  username?: string; // Display name (optional)
  status: string; // Account status ("ACTIVE" | "INACTIVE")
  accountCreatedAt: string; // ISO timestamp when account was created
  role: string; // Current role ("ADMIN" | "MANAGER")
  tenantId: string; // Current tenant ID
  tenantName: string; // Current tenant name
  businessId: string; // Tenant business ID (e.g., "1234567-8")
  joinedTenantAt?: string; // ISO timestamp when joined this tenant
  stats: {
    totalDriversManaged: number; // Number of drivers in current tenant
    totalInvitationsSent: number; // Total invitations sent by this admin
    lastLogin?: string; // Last login timestamp (currently null)
  };
}
```

#### Success Response Example

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "admin@demotaxi.com",
  "username": null,
  "status": "ACTIVE",
  "accountCreatedAt": "2024-01-15T10:00:00.000Z",
  "role": "ADMIN",
  "tenantId": "987fcdeb-51d2-43a1-b789-123456789000",
  "tenantName": "Demo Taxi Company",
  "businessId": "1234567-8",
  "joinedTenantAt": "2024-01-15T10:05:00.000Z",
  "stats": {
    "totalDriversManaged": 12,
    "totalInvitationsSent": 15,
    "lastLogin": null
  }
}
```

#### Error Responses

**401 Unauthorized**

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**403 Forbidden**

```json
{
  "statusCode": 403,
  "message": "Access denied. Admin or Manager role required",
  "error": "Forbidden"
}
```

**404 Not Found**

```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

---

## Frontend Integration Guide

### TypeScript Types

```typescript
// Define these types in your frontend
export interface AdminProfileResponse {
  id: string;
  email: string;
  username?: string;
  status: string;
  accountCreatedAt: string;
  role: string;
  tenantId: string;
  tenantName: string;
  businessId: string;
  joinedTenantAt?: string;
  stats: {
    totalDriversManaged: number;
    totalInvitationsSent: number;
    lastLogin?: string;
  };
}

export interface AdminProfileStats {
  totalDriversManaged: number;
  totalInvitationsSent: number;
  lastLogin?: string;
}
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth'; // Your auth hook

export const useAdminProfile = () => {
  const [profile, setProfile] = useState<AdminProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/profile', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: AdminProfileResponse = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  return { profile, loading, error, refetch: fetchProfile };
};
```

### Axios Service Example

```typescript
import axios from 'axios';

class AdminProfileService {
  private baseURL = '/api/admin/profile';

  async getProfile(): Promise<AdminProfileResponse> {
    try {
      const response = await axios.get<AdminProfileResponse>(this.baseURL, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          error.response?.data?.message || 'Failed to fetch profile',
        );
      }
      throw error;
    }
  }
}

export const adminProfileService = new AdminProfileService();
```

### React Component Example

```tsx
import React from 'react';
import { useAdminProfile } from './hooks/useAdminProfile';

export const AdminProfileCard: React.FC = () => {
  const { profile, loading, error } = useAdminProfile();

  if (loading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!profile) return <div>No profile data available</div>;

  return (
    <div className="admin-profile-card">
      <h2>Admin Profile</h2>

      {/* Basic Info */}
      <div className="profile-section">
        <h3>Account Information</h3>
        <p>
          <strong>Email:</strong> {profile.email}
        </p>
        <p>
          <strong>Role:</strong> {profile.role}
        </p>
        <p>
          <strong>Status:</strong> {profile.status}
        </p>
        <p>
          <strong>Member Since:</strong>{' '}
          {new Date(profile.accountCreatedAt).toLocaleDateString()}
        </p>
      </div>

      {/* Tenant Info */}
      <div className="profile-section">
        <h3>Tenant Information</h3>
        <p>
          <strong>Company:</strong> {profile.tenantName}
        </p>
        <p>
          <strong>Business ID:</strong> {profile.businessId}
        </p>
        {profile.joinedTenantAt && (
          <p>
            <strong>Joined:</strong>{' '}
            {new Date(profile.joinedTenantAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Statistics */}
      <div className="profile-section">
        <h3>Activity Statistics</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-number">
              {profile.stats.totalDriversManaged}
            </span>
            <span className="stat-label">Drivers Managed</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {profile.stats.totalInvitationsSent}
            </span>
            <span className="stat-label">Invitations Sent</span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## Data Validation & Business Rules

### Field Constraints

- **email**: Valid email format, required
- **username**: 2-50 characters, optional
- **role**: Must be "ADMIN" or "MANAGER"
- **status**: Currently "ACTIVE" or "INACTIVE"
- **timestamps**: ISO 8601 format strings

### Business Logic

- **Driver count**: Scoped to current tenant only
- **Invitation count**: All invitations sent by this admin across all tenants
- **Security**: Admin can only see their own profile data
- **Multi-tenant**: Data is always filtered by current tenant context

### Rate Limiting

- No specific rate limits on profile endpoint
- Standard JWT token expiration applies (typically 1 hour)

---

## Error Handling Best Practices

### Frontend Error Handling

```typescript
const handleProfileError = (error: unknown) => {
  if (error instanceof Error) {
    switch (error.message) {
      case 'HTTP 401: Unauthorized':
        // Redirect to login
        window.location.href = '/login';
        break;
      case 'HTTP 403: Forbidden':
        // Show access denied message
        showErrorToast('You do not have permission to view this profile');
        break;
      case 'HTTP 404: Not Found':
        // Profile not found
        showErrorToast('Profile not found');
        break;
      default:
        // Generic error
        showErrorToast('Failed to load profile. Please try again.');
    }
  }
};
```

### Retry Logic

```typescript
const fetchProfileWithRetry = async (maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await adminProfileService.getProfile();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
};
```

---

## Testing

### Example Test Data

```json
{
  "id": "test-admin-id",
  "email": "test.admin@example.com",
  "username": "test_admin",
  "status": "ACTIVE",
  "accountCreatedAt": "2024-01-01T00:00:00.000Z",
  "role": "ADMIN",
  "tenantId": "test-tenant-id",
  "tenantName": "Test Taxi Company",
  "businessId": "TEST-123",
  "joinedTenantAt": "2024-01-01T00:00:00.000Z",
  "stats": {
    "totalDriversManaged": 5,
    "totalInvitationsSent": 8,
    "lastLogin": null
  }
}
```

### cURL Test Command

```bash
curl -X GET "http://localhost:3000/admin/profile" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## Future Enhancements

### Planned Features

- **Profile Updates**: `PUT /admin/profile` endpoint for updating username
- **Login Tracking**: `lastLogin` field will be populated
- **Profile Picture**: Avatar upload functionality
- **Preferences**: Admin-specific settings and preferences

### Backwards Compatibility

- Current API structure will remain stable
- New fields will be added as optional
- No breaking changes planned for v1
