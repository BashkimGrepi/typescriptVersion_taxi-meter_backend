# 🔍 Cursor Pagination Explained

## What Are Those "Random" Strings?

When you test the API, you see responses like this:

```json
{
  "page": {
    "limit": 20,
    "nextCursor": "eyJzb3J0VmFsdWUiOiIyMDI2LTAyLTEzVDA5OjEyOjAwWiIsImlkIjoiZTNmMmE1YjgtMTIzNC01Njc4LTkwYWItY2RlZjAxMjM0NTY3In0=",
    "prevCursor": null
  }
}
```

**That long string is NOT random!** It's a **base64-encoded JSON object** that tells the backend exactly where you are in the list.

---

## 🔓 Decoding the Cursor

Let's decode that "random" string to see what's really inside:

### Step 1: Copy the cursor value

```
eyJzb3J0VmFsdWUiOiIyMDI2LTAyLTEzVDA5OjEyOjAwWiIsImlkIjoiZTNmMmE1YjgtMTIzNC01Njc4LTkwYWItY2RlZjAxMjM0NTY3In0=
```

### Step 2: Decode it (in browser console or Node.js)

```javascript
// Browser Console or Node.js
const cursor =
  'eyJzb3J0VmFsdWUiOiIyMDI2LTAyLTEzVDA5OjEyOjAwWiIsImlkIjoiZTNmMmE1YjgtMTIzNC01Njc4LTkwYWItY2RlZjAxMjM0NTY3In0=';
const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
console.log(decoded);
```

### Step 3: See the actual data

```json
{
  "sortValue": "2026-02-13T09:12:00Z",
  "id": "e3f2a5b8-1234-5678-90ab-cdef01234567"
}
```

**It contains:**

- `sortValue`: The value of the field you're sorting by (startedAt, fareTotal, etc.)
- `id`: The unique ride ID

This tells the backend: _"Get me rides that come AFTER this specific ride in the sort order"_

---

## 📖 Cursor vs Offset Pagination

### ❌ Old Way: Offset Pagination (page numbers)

```
GET /rides?page=1&limit=20  // Rides 1-20
GET /rides?page=2&limit=20  // Rides 21-40
GET /rides?page=3&limit=20  // Rides 41-60
```

**Problems:**

1. **Duplicates:** If a new ride is added while you're on page 2, you might see the same ride twice
2. **Missing items:** If a ride is deleted, you might skip rides
3. **Slow:** Database has to count and skip records (`OFFSET 40 LIMIT 20` is slow on large datasets)

**Example of the problem:**

```
Page 1: [A, B, C, D, E]  ← You see these
[New ride F is added at the top]
Page 2: [F, A, B, C, D]  ← You see A, B, C, D AGAIN! Duplicates!
```

---

### ✅ New Way: Cursor Pagination (bookmarks)

```
GET /rides?limit=20
  → Returns rides + nextCursor

GET /rides?cursor=<nextCursor>&cursorDir=next&limit=20
  → Returns next 20 rides based on exact position
```

**Benefits:**

1. **No duplicates:** You always get the next rides after your exact position
2. **No missing items:** Stable pagination even if data changes
3. **Fast:** Database uses indexes efficiently (no counting/skipping)

**How it works:**

```
Request 1: Get first 20 rides
  Response includes: nextCursor = {sortValue: "2026-02-13T09:12:00Z", id: "uuid"}

Request 2: Get next 20
  Backend queries: WHERE startedAt < "2026-02-13T09:12:00Z" OR (startedAt = "2026-02-13T09:12:00Z" AND id < "uuid")
  → Guaranteed to get the NEXT rides, no matter what changed
```

---

## 🎯 How to Use Cursors in Practice

### Initial Request (No Cursor)

Just call the endpoint without any cursor:

```bash
GET /api/admin/rides?limit=20
```

**Response:**

```json
{
  "data": [/* 20 rides */],
  "page": {
    "limit": 20,
    "nextCursor": "eyJzb3J0VmFsdWU...",  ← Save this!
    "prevCursor": null
  }
}
```

---

### Get Next Page

Use the `nextCursor` from the previous response:

```bash
GET /api/admin/rides?cursor=eyJzb3J0VmFsdWU...&cursorDir=next&limit=20
```

**Response:**

```json
{
  "data": [/* next 20 rides */],
  "page": {
    "limit": 20,
    "nextCursor": "eyJhbm90aGVy...",      ← New cursor for next page
    "prevCursor": "eyJwcmV2aW91cy4uLg=="  ← New cursor to go back
  }
}
```

---

### Go Back to Previous Page

Use the `prevCursor`:

```bash
GET /api/admin/rides?cursor=eyJwcmV2aW91cy4uLg==&cursorDir=prev&limit=20
```

This takes you back to the previous page.

---

## 🔧 Frontend Implementation

### React Example

```tsx
function RidesList() {
  const [cursors, setCursors] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['rides', currentCursor],
    queryFn: () => fetchRides({ cursor: currentCursor, cursorDir: 'next' }),
  });

  const goToNextPage = () => {
    if (data?.page.nextCursor) {
      // Save current cursor for going back
      setCursors([...cursors, currentCursor!]);
      setCurrentCursor(data.page.nextCursor);
    }
  };

  const goToPrevPage = () => {
    if (cursors.length > 0) {
      // Pop the last cursor from history
      const previousCursor = cursors[cursors.length - 1];
      setCursors(cursors.slice(0, -1));
      setCurrentCursor(previousCursor);
    }
  };

  return (
    <div>
      <RidesTable rides={data?.data} />

      <button onClick={goToPrevPage} disabled={cursors.length === 0}>
        Previous
      </button>

      <button onClick={goToNextPage} disabled={!data?.page.nextCursor}>
        Next
      </button>
    </div>
  );
}
```

---

### Simple State Machine

```tsx
interface PaginationState {
  cursor: string | null;
  direction: 'next' | 'prev';
}

function usePagination() {
  const [state, setState] = useState<PaginationState>({
    cursor: null,
    direction: 'next',
  });

  const { data } = useQuery({
    queryKey: ['rides', state.cursor, state.direction],
    queryFn: () => fetchRides(state),
  });

  const next = () => {
    if (data?.page.nextCursor) {
      setState({ cursor: data.page.nextCursor, direction: 'next' });
    }
  };

  const prev = () => {
    if (data?.page.prevCursor) {
      setState({ cursor: data.page.prevCursor, direction: 'prev' });
    }
  };

  return { data, next, prev };
}
```

---

## 🧪 Testing Cursor Pagination in Postman

### Test 1: Initial Load

```
GET http://localhost:3000/api/admin/rides?limit=5
```

**Response:**

```json
{
  "data": [
    { "id": "ride-1", "startedAt": "2026-02-13T10:00:00Z", ... },
    { "id": "ride-2", "startedAt": "2026-02-13T09:30:00Z", ... },
    { "id": "ride-3", "startedAt": "2026-02-13T09:00:00Z", ... },
    { "id": "ride-4", "startedAt": "2026-02-13T08:30:00Z", ... },
    { "id": "ride-5", "startedAt": "2026-02-13T08:00:00Z", ... }
  ],
  "page": {
    "nextCursor": "eyJzb3J0VmFsdWU...",
    "prevCursor": null
  }
}
```

---

### Test 2: Next Page

Copy the `nextCursor` value and use it:

```
GET http://localhost:3000/api/admin/rides?cursor=eyJzb3J0VmFsdWU...&cursorDir=next&limit=5
```

**Response:**

```json
{
  "data": [
    { "id": "ride-6", "startedAt": "2026-02-13T07:30:00Z", ... },
    { "id": "ride-7", "startedAt": "2026-02-13T07:00:00Z", ... },
    { "id": "ride-8", "startedAt": "2026-02-13T06:30:00Z", ... },
    { "id": "ride-9", "startedAt": "2026-02-13T06:00:00Z", ... },
    { "id": "ride-10", "startedAt": "2026-02-13T05:30:00Z", ... }
  ],
  "page": {
    "nextCursor": "eyJhbm90aGVy...",     ← Next page
    "prevCursor": "eyJwcmV2aW91cy4uLg==" ← Go back
  }
}
```

Notice:

- ✅ No duplicate rides
- ✅ Continues from ride-6 (right after ride-5)
- ✅ New `nextCursor` for page 3
- ✅ New `prevCursor` to go back to page 1

---

### Test 3: Go Back (Previous Page)

Copy the `prevCursor` and use `cursorDir=prev`:

```
GET http://localhost:3000/api/admin/rides?cursor=eyJwcmV2aW91cy4uLg==&cursorDir=prev&limit=5
```

**Response:**

```json
{
  "data": [
    { "id": "ride-1", "startedAt": "2026-02-13T10:00:00Z", ... },
    { "id": "ride-2", "startedAt": "2026-02-13T09:30:00Z", ... },
    { "id": "ride-3", "startedAt": "2026-02-13T09:00:00Z", ... },
    { "id": "ride-4", "startedAt": "2026-02-13T08:30:00Z", ... },
    { "id": "ride-5", "startedAt": "2026-02-13T08:00:00Z", ... }
  ]
}
```

You're back to the first page!

---

## 🔎 Decode a Cursor Yourself

### In Browser Console

```javascript
// Copy a cursor from your API response
const cursor =
  'eyJzb3J0VmFsdWUiOiIyMDI2LTAyLTEzVDA5OjEyOjAwWiIsImlkIjoiZTNmMmE1YjgtMTIzNC01Njc4LTkwYWItY2RlZjAxMjM0NTY3In0=';

// Decode it
const decoded = atob(cursor);
console.log(decoded);

// Parse as JSON
const cursorData = JSON.parse(decoded);
console.log(cursorData);
```

**Output:**

```javascript
{
  sortValue: "2026-02-13T09:12:00Z",
  id: "e3f2a5b8-1234-5678-90ab-cdef01234567"
}
```

---

### In Node.js

```javascript
const cursor = 'eyJzb3J0VmFsdWU...';

const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
const cursorData = JSON.parse(decoded);

console.log(cursorData);
```

---

### In Postman (Pre-request Script)

```javascript
// Decode cursor to see what's inside
const cursor = pm.response.json().page.nextCursor;

if (cursor) {
  const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
  const cursorData = JSON.parse(decoded);

  console.log('Cursor contains:', cursorData);

  // Save for next request
  pm.environment.set('nextCursor', cursor);
}
```

---

## 🎓 Different Sort Fields = Different Cursor Values

The cursor changes based on what you're sorting by:

### Sorting by `startedAt` (default)

```json
{
  "sortValue": "2026-02-13T09:12:00Z",  ← ISO date string
  "id": "uuid"
}
```

### Sorting by `fareTotal`

```json
{
  "sortValue": "38.90",  ← Decimal number as string
  "id": "uuid"
}
```

### Sorting by `durationMin`

```json
{
  "sortValue": "23.00",  ← Decimal number as string
  "id": "uuid"
}
```

The backend knows how to handle each type!

---

## ⚠️ Important: Cursor Rules

### ✅ DO:

- Store cursors temporarily (user session)
- Pass cursors exactly as received (don't modify)
- Treat cursors as opaque strings
- Use `cursorDir` to control direction

### ❌ DON'T:

- Store cursors in database (they're session-specific)
- Try to decode/modify cursors client-side
- Reuse cursors across different filter sets
- Share cursors between users

---

## 💡 Why Not Just Use Page Numbers?

**Short answer:** Cursor pagination is more reliable for dynamic data.

**Example scenario:**

You're on the admin dashboard. Drivers are actively completing rides:

| Time  | Action                       | Offset Pagination                                                                            | Cursor Pagination                                           |
| ----- | ---------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 10:00 | You view page 1 (rides 1-20) | ✅ Shows rides 1-20                                                                          | ✅ Shows rides 1-20                                         |
| 10:01 | 5 new rides are completed    |                                                                                              |                                                             |
| 10:02 | You click "Next Page"        | ❌ Shows rides 21-40<br>**But rides 16-20 from page 1 are now 21-25!**<br>You see duplicates | ✅ Shows rides 21-40<br>Picks up exactly where you left off |

Cursor pagination maintains your exact position, even if data changes!

---

## 🚀 Advanced: Infinite Scroll with Cursors

```tsx
function InfiniteRidesList() {
  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['rides'],
    queryFn: ({ pageParam }) => fetchRides({ cursor: pageParam, limit: 20 }),
    getNextPageParam: (lastPage) => lastPage.page.nextCursor,
  });

  // All pages combined
  const allRides = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      <InfiniteScroll
        dataLength={allRides.length}
        next={fetchNextPage}
        hasMore={hasNextPage}
        loader={<Spinner />}
      >
        {allRides.map((ride) => (
          <RideCard key={ride.id} ride={ride} />
        ))}
      </InfiniteScroll>
    </div>
  );
}
```

---

## 📚 Summary

**Cursor = Bookmark in your book**

Instead of saying "go to page 5" (which might have different content if pages are added/removed), you say "continue from where I left off" (which always gives you the next content).

**The "random" string is:**

```
base64( JSON.stringify({ sortValue: "...", id: "..." }) )
```

**To use it:**

1. Make initial request (no cursor)
2. Get `nextCursor` from response
3. Pass it to next request with `cursorDir=next`
4. Repeat!

**Benefits:**

- ✅ No duplicate items
- ✅ No missing items
- ✅ Fast database queries
- ✅ Works with live data

**When cursor is `null`:**

- `nextCursor: null` = You're at the end (no more data)
- `prevCursor: null` = You're at the beginning (first page)

---

## 🎯 Quick Reference Card

```bash
# First page
GET /api/admin/rides?limit=20

# Next page (copy nextCursor from response)
GET /api/admin/rides?cursor=<nextCursor>&cursorDir=next&limit=20

# Previous page (copy prevCursor from response)
GET /api/admin/rides?cursor=<prevCursor>&cursorDir=prev&limit=20

# Decode cursor (browser console)
JSON.parse(atob("eyJzb3J0VmFsdWU..."))
```

**That's it!** The cursor system handles all the complexity for you. Just pass the cursor values back and forth, and you get reliable pagination. 🎉
