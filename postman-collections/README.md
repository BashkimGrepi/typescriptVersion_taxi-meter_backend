# 🚕 Pricing Policies API Testing Guide

## 📁 Import Instructions

1. **Open Postman**
2. **Click "Import"**
3. **Select the file**: `postman-collections/pricing-policies.postman_collection.json`
4. **Click "Import"**

## 🔧 Setup Variables

The collection uses these variables (auto-configured):

- `base_url`: `http://localhost:3000` (adjust if needed)
- `access_token`: Auto-filled by login requests
- `policy_id`: Auto-filled when creating policies

## 🎯 Testing Workflow

### Step 1: Authentication

Run these in order to test different user roles:

1. **Login Admin** → Saves admin token automatically
2. **Login Manager** → Saves manager token automatically
3. **Login Driver** → Saves driver token automatically

### Step 2: Test Admin/Manager Functions

With Admin or Manager token:

1. **Get All Policies** → Should work ✅
2. **Create Standard Policy** → Creates policy + saves ID ✅
3. **Update Policy** → Should work ✅

### Step 3: Test Admin-Only Functions

With Admin token:

1. **Activate Policy** → Should work ✅

With Manager token:

1. **Activate Policy** → Should fail ❌ ("Not an admin user")

### Step 4: Test Driver Functions

With Driver token:

1. **Get Active Policy for Driver** → Should work ✅
2. **Get All Policies** → Should fail ❌ ("Access denied")

### Step 5: Security Tests

Test unauthorized access:

1. **No Token requests** → Should fail ❌ (401 Unauthorized)
2. **Driver unauthorized actions** → Should fail ❌
3. **Manager trying admin actions** → Should fail ❌

## 📊 Expected API Responses

### ✅ Successful List Response

```json
{
  "items": [
    {
      "id": "uuid-here",
      "name": "Standard City Rate",
      "isActive": true,
      "baseFare": "3.50",
      "perKm": "1.20",
      "createdAt": "2025-08-29T...",
      "updatedAt": "2025-08-29T..."
    }
  ],
  "total": 1,
  "activeCount": 1,
  "page": 1,
  "pageSize": 20
}
```

### ✅ Successful Create Response

```json
{
  "id": "new-policy-uuid",
  "name": "Standard City Rate",
  "baseFare": "3.50",
  "perKm": "1.20",
  "isActive": false,
  "createdAt": "2025-08-29T...",
  "updatedAt": "2025-08-29T..."
}
```

### ❌ Security Error Response

```json
{
  "statusCode": 403,
  "message": "Access denied. Admin or Manager role required",
  "error": "Forbidden"
}
```

## 🎲 Test Data Examples

### Create Policy Bodies:

```json
// Standard Rate
{
  "name": "Standard City Rate",
  "baseFare": "3.50",
  "perKm": "1.20",
  "isActive": false
}

// Premium Rate
{
  "name": "Premium Night Rate",
  "baseFare": "5.00",
  "perKm": "1.80",
  "isActive": false
}

// Budget Rate
{
  "name": "Budget Daytime Rate",
  "baseFare": "2.50",
  "perKm": "0.90",
  "isActive": false
}
```

### Update Policy Bodies:

```json
// Update name only
{
  "name": "Updated Standard Rate"
}

// Update rates only
{
  "baseFare": "4.00",
  "perKm": "1.50"
}

// Update everything
{
  "name": "Complete Updated Policy",
  "baseFare": "3.75",
  "perKm": "1.25"
}
```

## 🛡️ Security Matrix

| Endpoint                               | Admin | Manager | Driver |
| -------------------------------------- | ----- | ------- | ------ |
| `GET /pricing-policies`                | ✅    | ✅      | ❌     |
| `POST /pricing-policies`               | ✅    | ✅      | ❌     |
| `PATCH /pricing-policies/update/:id`   | ✅    | ✅      | ❌     |
| `POST /pricing-policies/:id/activate`  | ✅    | ❌      | ❌     |
| `GET /pricing-policies/active/current` | ✅    | ✅      | ✅     |
| `GET /pricing-policies/active/driver`  | ✅    | ✅      | ✅     |

## 🔍 Query Parameters

### List Policies:

- `isActive`: `true` or `false` - Filter by active status
- `search`: `string` - Search by name (case insensitive)
- `limit`: `1-100` - Number of results (default: 20)
- `offset`: `number` - Pagination offset (default: 0)
- `orderBy`: `createdAt|name|isActive` - Sort field (default: createdAt)
- `orderDir`: `asc|desc` - Sort direction (default: desc)

### Examples:

```
GET /pricing-policies?isActive=true
GET /pricing-policies?search=standard&limit=10
GET /pricing-policies?orderBy=name&orderDir=asc
```

## 🚨 Common Issues

1. **401 Unauthorized**: Token expired or missing → Re-login
2. **403 Forbidden**: Wrong role → Check user permissions
3. **400 Bad Request**: Invalid data → Check request body format
4. **404 Not Found**: Invalid policy ID → Check policy exists

Happy testing! 🎉
