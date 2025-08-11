# 🚕 Taxi Meter API - Postman Testing Guide

## 📋 Overview

This guide provides step-by-step instructions for testing all driver authentication and profile management endpoints using Postman.

## 🚀 Quick Setup

### 1. Import the Collection

1. Open Postman
2. Click "Import" button
3. Select the file: `postman/Taxi-Meter-API.postman_collection.json`
4. The collection will be imported with all endpoints and environment variables

### 2. Environment Variables

The collection automatically sets:

- `base_url`: `http://localhost:3000`
- `driver_token`: Auto-populated after successful login

## 🧪 Test Scenarios

### Scenario 1: Health Check

**Purpose**: Verify the API server and database connection are working

**Endpoint**: `GET /health/db`

- **Expected Response**: `200 OK`
- **Response Body**: Database connection status

### Scenario 2: Driver Authentication Flow

**Purpose**: Test driver login and token generation

#### Step 1: Driver Login

**Endpoint**: `POST /api/driver/login`

- **Body**:

```json
{
  "email": "driver@demo.com",
  "password": "DriverPass123!"
}
```

- **Expected Response**: `200 OK`
- **Response Body**:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "sub": "driver-user-id",
    "email": "driver@demo.com",
    "role": "driver",
    "type": "driver",
    "tenantId": "tenant-id",
    "driverProfileId": "driver-profile-id"
  }
}
```

- **Note**: The JWT token is automatically saved to `driver_token` variable

### Scenario 3: Driver Profile Management

#### Step 1: Get Current Profile

**Endpoint**: `GET /api/driver/profile`

- **Headers**: `Authorization: Bearer {{driver_token}}`
- **Expected Response**: `200 OK`
- **Response Body**:

```json
{
  "id": "driver-profile-id",
  "userId": "user-id",
  "licenseNumber": "DL123456789",
  "phoneNumber": "+1-555-0100",
  "address": "123 Main Street, City, NY 10001",
  "emergencyContact": "John Doe - +1-555-0101",
  "vehicleInfo": {
    "make": "Toyota",
    "model": "Camry",
    "year": 2020,
    "licensePlate": "NYC-1234",
    "color": "Blue"
  },
  "status": "active",
  "rating": 4.8,
  "totalRides": 150,
  "createdAt": "2024-08-10T10:00:00.000Z",
  "updatedAt": "2024-08-11T16:30:00.000Z",
  "user": {
    "email": "driver@demo.com",
    "tenant": {
      "name": "Demo Taxi Company"
    }
  }
}
```

#### Step 2: Update Profile

**Endpoint**: `PUT /api/driver/profile/edit`

- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer {{driver_token}}`
- **Body**:

```json
{
  "phoneNumber": "+1-555-0123",
  "address": "123 Updated Street, New City, NY 10001",
  "emergencyContact": "Jane Doe - +1-555-0199",
  "vehicleInfo": {
    "make": "Toyota",
    "model": "Camry Hybrid",
    "year": 2023,
    "licensePlate": "NYC-2023",
    "color": "Silver"
  }
}
```

- **Expected Response**: `200 OK`
- **Response Body**: Updated profile data

## 🔒 Security Tests

### Test 1: Access Without Token

Try accessing profile endpoints without the `Authorization` header:

- **Expected Response**: `401 Unauthorized`

### Test 2: Access with Invalid Token

Use an invalid or expired token:

- **Expected Response**: `401 Unauthorized`

### Test 3: Non-Driver User Access

1. Login as regular user via `POST /auth/login` with:

```json
{
  "email": "user@demo.com",
  "password": "UserPass123!"
}
```

2. Try to access driver profile endpoints with user token

- **Expected Response**: `403 Forbidden`

## 🐛 Troubleshooting

### Common Issues

#### 1. Server Not Running

**Error**: Connection refused or timeout
**Solution**: Ensure the server is running with `npm run start:dev`

#### 2. Database Connection Failed

**Error**: Health check returns database error
**Solution**:

1. Check if Docker containers are running: `docker-compose up -d`
2. Verify database connection in `.env` file

#### 3. Authentication Errors

**Error**: `401 Unauthorized`
**Solutions**:

- Verify correct email/password combination
- Check if JWT token is properly included in Authorization header
- Ensure token hasn't expired

#### 4. Profile Update Failures

**Error**: `400 Bad Request` or validation errors
**Solutions**:

- Verify JSON structure matches DTO requirements
- Check that required fields are not missing
- Ensure data types are correct (e.g., year as number)

## 📊 Expected Test Results Summary

| Endpoint                   | Method | Auth Required | Expected Status | Purpose        |
| -------------------------- | ------ | ------------- | --------------- | -------------- |
| `/health/db`               | GET    | No            | 200             | Health check   |
| `/api/driver/login`        | POST   | No            | 200             | Get JWT token  |
| `/api/driver/profile`      | GET    | Yes (Driver)  | 200             | Get profile    |
| `/api/driver/profile/edit` | PUT    | Yes (Driver)  | 200             | Update profile |

## 🔄 Complete Test Flow

1. **Health Check** → Verify API is running
2. **Driver Login** → Get authentication token
3. **Get Profile** → Verify current driver data
4. **Update Profile** → Test profile modification
5. **Get Profile Again** → Confirm updates were saved

## 📝 Notes

- All JWT tokens expire based on server configuration
- Profile updates are validated against the UpdateDriverProfileDto schema
- Only the authenticated driver can access/modify their own profile
- The custom `@Driver()` decorator ensures type-safe access to driver information
