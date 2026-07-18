# TransitOps Backend — AI Agent Integration Guide

This document is a complete reference for connecting a frontend or external service to the TransitOps backend API. All responses and error shapes are described exactly as the server returns them.

---

## 1. Base URL & Server

```
http://localhost:3000
```

The server listens on `PORT` (default `3000`), configurable via `.env`. `GET /health` is a no-auth liveness probe:

```
GET /health
→ 200 { "status": "ok", "service": "transitops" }
```

---

## 2. Authentication

### 2.1 Register

```
POST /api/auth/register
Content-Type: application/json

{
  "fullName": "string (1–120 chars, required)",
  "email":    "string, valid email, lowercase, required",
  "password": "string, min 8 chars, required",
  "roleId":   "integer, positive, required",
  "region":   "string (max 80), optional"
}

→ 201 { "user": { "id", "fullName", "email", "roleId", "role": { "name" }, "region", "isActive", ... } }
→ 409 { "error": { "code": "DUPLICATE_VALUE", "message": "A record with that email already exists." } }
→ 400 { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

**Seeded `roleId` values** (`db/seed.js` inserts them in this order):
| `roleId` | Role name          |
|----------|--------------------|
| 1        | Fleet Manager      |
| 2        | Driver             |
| 3        | Safety Officer    |
| 4        | Financial Analyst |

### 2.2 Login

```
POST /api/auth/login
Content-Type: application/json

{
  "email":    "string, valid email",
  "password": "string, min 1 char"
}

→ 200 { "token": "<jwt>", "user": { "id", "fullName", "email", "role": { "name" }, ... } }
→ 401 { "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." } }
```

### 2.3 Get Current User

```
GET /api/auth/me
Authorization: Bearer <token>

→ 200 { "id", "fullName", "email", "roleId", "role": { "name" }, "region", "isActive", ... }
→ 401 { "error": { "code": "UNAUTHENTICATED", "message": "..." } }
```

**JWT format:** Bearer token. The `sub` claim is the user ID. Default TTL is 12h (`JWT_EXPIRES_IN`). Include the token in every authenticated request header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. Role-Based Access Control (RBAC)

Every route beyond registration/login requires a valid token. Write-level endpoints additionally enforce one or more allowed roles:

| Role              | Who creates/edits                     |
|-------------------|---------------------------------------|
| Fleet Manager     | Vehicles, Drivers, Trips, Maintenance |
| Driver            | Their own Trips, Fuel Logs, Expenses  |
| Safety Officer    | Drivers (safetyScore tracking)         |
| Financial Analyst | Expenses, Reports                      |

If the authenticated role isn't permitted, the server responds:

```
→ 403 { "error": { "code": "FORBIDDEN", "message": "This action requires one of: Fleet Manager, Driver." } }
```

---

## 4. API Routes

All routes are prefixed with `/api`. Response shapes are shown without `createdAt`/`updatedAt` unless relevant. All IDs are auto-increment integers.

### 4.1 Vehicles — `/api/vehicles`

```
GET    /api/vehicles           list all (or filter by ?status=&type=&region=)
GET    /api/vehicles/:id       get one with full detail
POST   /api/vehicles           create [Fleet Manager]
PUT    /api/vehicles/:id       update [Fleet Manager]
DELETE /api/vehicles/:id       delete [Fleet Manager]
```

**`GET /api/vehicles` — optional query params:**
| Param   | Values                                  |
|---------|-----------------------------------------|
| `status`| AVAILABLE, ON_TRIP, IN_SHOP, RETIRED    |
| `type`  | free-text (must match vehicle `type`)   |
| `region`| free-text (must match vehicle `region`) |

```json
// 200 list item
{ "id": 1, "registrationNumber": "ABC-1234", "model": "Volvo FH", "type": "Truck",
  "maxLoadCapacity": 5000, "odometer": 142000, "acquisitionCost": 85000,
  "region": "North", "status": "AVAILABLE" }

// 200 single item — same shape, no array
```

**`POST /api/vehicles` body:**
```json
{ "registrationNumber": "ABC-1234", "model": "Volvo FH", "type": "Truck",
  "maxLoadCapacity": 5000, "acquisitionCost": 85000, "region": "North" }
```
`status` always starts as `AVAILABLE`; `odometer` defaults to `0`.

**`PUT /api/vehicles/:id` body** — all fields optional:
```json
{ "status": "IN_SHOP" }
```
Allowed `status` values: `AVAILABLE`, `ON_TRIP`, `IN_SHOP`, `RETIRED`.

```
→ 404 { "error": { "code": "NOT_FOUND", "message": "Vehicle 99 not found." } }
→ 409 { "error": { "code": "DUPLICATE_VALUE", "message": "A record with that registrationNumber already exists." } }
```

---

### 4.2 Drivers — `/api/drivers`

```
GET    /api/drivers            list all (or filter by ?status=)
GET    /api/drivers/:id        get one
POST   /api/drivers            create [Fleet Manager, Safety Officer]
PUT    /api/drivers/:id        update [Fleet Manager, Safety Officer]
DELETE /api/drivers/:id        delete [Fleet Manager, Safety Officer]
```

**`GET /api/drivers?status=ON_TRIP`** — optional filter:

| `status` value |
|---------------|
| AVAILABLE     |
| ON_TRIP       |
| OFF_DUTY      |
| SUSPENDED     |

```json
// 200 single item
{ "id": 1, "fullName": "Jane Smith", "licenseNumber": "DL-88421",
  "licenseCategory": "Class A", "licenseExpiryDate": "2028-04-15T00:00:00.000Z",
  "contactNumber": "+1-555-0123", "safetyScore": 94.5, "status": "AVAILABLE" }
```

**`POST /api/drivers` body:**
```json
{ "fullName": "Jane Smith", "licenseNumber": "DL-88421",
  "licenseCategory": "Class A", "licenseExpiryDate": "2028-04-15",
  "safetyScore": 94.5, "contactNumber": "+1-555-0123" }
```
`licenseExpiryDate` → ISO date string (e.g. `"2028-04-15"`). `status` defaults to `AVAILABLE`, `safetyScore` to `0`.

**`PUT /api/drivers/:id` body** — all optional:
```json
{ "status": "SUSPENDED", "safetyScore": 91.2, "contactNumber": "+1-555-0000" }
```

---

### 4.3 Trips — `/api/trips`

**State machine: DRAFT → DISPATCHED → COMPLETED | CANCELLED**

```
GET    /api/trips              list all (or filter by ?status=)
GET    /api/trips/:id          get one with vehicle + driver nested
POST   /api/trips             create a DRAFT trip [Driver, Fleet Manager]
POST   /api/trips/:id/dispatch set to DISPATCHED; atomically locks vehicle+driver [Driver, Fleet Manager]
POST   /api/trips/:id/complete set to COMPLETED; unlock vehicle+driver, record actuals [Driver, Fleet Manager]
POST   /api/trips/:id/cancel   set to CANCELLED; unlock if was DISPATCHED [Driver, Fleet Manager]
DELETE /api/trips/:id          delete [Driver, Fleet Manager] — DRAFT or CANCELLED only
```

**Trip lifecycle rules enforced server-side:**
- Creating: vehicle must be `AVAILABLE`, driver must be `AVAILABLE` + license not expired, cargo ≤ maxLoadCapacity
- Dispatching: re-checks that vehicle and driver are still `AVAILABLE`; guards against concurrent dispatched trips on same vehicle or driver
- Completing: only `DISPATCHED` trips accept completion; retired vehicle stays retired

**`POST /api/trips` body:**
```json
{ "source": "Lagos", "destination": "Port Harcourt",
  "vehicleId": 1, "driverId": 3, "cargoWeight": 3200,
  "plannedDistance": 580, "plannedRevenue": 120000 }
```

**`GET /api/trips/:id` response:**
```json
{ "id": 1, "source": "Lagos", "destination": "Port Harcourt",
  "vehicleId": 1, "driverId": 3, "cargoWeight": 3200,
  "plannedDistance": 580, "status": "DISPATCHED",
  "plannedRevenue": 120000, "actualRevenue": null,
  "actualDistance": null, "finalOdometer": null, "fuelConsumed": null,
  "startedAt": "2026-07-18T10:00:00.000Z", "completedAt": null,
  "vehicle": { "id": 1, "registrationNumber": "ABC-1234", "model": "Volvo FH", ..." },
  "driver":  { "id": 3, "fullName": "Jane Smith", "licenseNumber": "DL-88421", ... } }
```

**`POST /api/trips/:id/complete` body** — all fields optional:
```json
{ "finalOdometer": 142580, "fuelConsumed": 310, "actualDistance": 582, "actualRevenue": 124000 }
```
`finalOdometer` > current odometer → vehicle's odometer is updated.

**Status filter `?status=`:**
`DRAFT` | `DISPATCHED` | `COMPLETED` | `CANCELLED`

```
→ 409 { "error": { "code": "INVALID_TRIP_STATUS", "message": "Trip 1 is DRAFT; only DRAFT trips can be dispatched." } }
→ 409 { "error": { "code": "DRIVER_LICENSE_EXPIRED", "message": "Jane Smith's licence has expired." } }
→ 409 { "error": { "code": "CARGO_EXCEEDS_CAPACITY", "message": "Cargo weight 6200 kg exceeds ABC-1234's maximum capacity of 5000 kg." } }
→ 409 { "error": { "code": "ALREADY_ON_TRIP", "message": "Vehicle or driver is already on an active trip (trip #2)." } }
```

---

### 4.4 Maintenance — `/api/maintenance`

```
GET    /api/maintenance           list all (no filters)
GET    /api/maintenance/:id        get one
POST   /api/maintenance           create [Fleet Manager]
PUT    /api/maintenance/:id       update [Fleet Manager]
DELETE /api/maintenance/:id        delete [Fleet Manager]
```

**Business rules:**
- Creating a log: vehicle must not be `ON_TRIP`; vehicle status → `IN_SHOP` if not retired.
- Closing a log (`PUT` with `status: "CLOSED"`): vehicle reverts to `AVAILABLE` only if no other `OPEN`/`IN_PROGRESS` logs remain for that vehicle.

**`POST /api/maintenance` body:**
```json
{ "vehicleId": 1, "serviceType": "Brake Pad Replacement",
  "description": "Squeaking noise from front axle", "cost": 8500,
  "notes": "Replaced both front brake pads and resurfaced rotors" }
```

**`PUT /api/maintenance/:id` body** — all optional:
```json
{ "status": "CLOSED", "cost": 9200, "notes": "Updated: replaced rotors too" }
```

**Status values:** `OPEN` | `IN_PROGRESS` | `CLOSED`

```json
// 200 single item
{ "id": 1, "vehicleId": 1, "serviceType": "Brake Pad Replacement",
  "description": "Squeaking noise from front axle", "cost": 9200,
  "status": "CLOSED", "startDate": "2026-07-15T00:00:00.000Z",
  "endDate": "2026-07-17T00:00:00.000Z", "notes": "Updated: replaced rotors too",
  "vehicle": { "id": 1, "registrationNumber": "ABC-1234", ... } }
```

```
→ 409 { "error": { "code": "VEHICLE_ON_TRIP", "message": "Cannot start maintenance on a vehicle currently on a trip." } }
```

---

### 4.5 Fuel Logs — `/api/fuel-logs`

```
GET    /api/fuel-logs              list all (filter by ?vehicleId=)
GET    /api/fuel-logs/:id          get one
POST   /api/fuel-logs              create [Driver, Fleet Manager]
PUT    /api/fuel-logs/:id          update [Driver, Fleet Manager]
DELETE /api/fuel-logs/:id           delete [Driver, Fleet Manager]
```

**`GET /api/fuel-logs?vehicleId=1`** — filter to one vehicle's log.

**`POST /api/fuel-logs` body:**
```json
{ "vehicleId": 1, "tripId": null,
  "liters": 180, "cost": 32400,
  "logDate": "2026-07-18", "odometerAtFill": 142350 }
```

**`PUT /api/fuel-logs/:id` body** — all optional:
```json
{ "tripId": 5, "cost": 33000 }
```

```json
// 200 response includes nested vehicle + trip
{ "id": 1, "vehicleId": 1, "tripId": null,
  "liters": 180, "cost": 32400,
  "logDate": "2026-07-18T00:00:00.000Z",
  "odometerAtFill": 142350,
  "vehicle": { "id": 1, "registrationNumber": "ABC-1234", ... },
  "trip": null }
```

---

### 4.6 Expenses — `/api/expenses`

```
GET    /api/expenses               list all (filter by ?vehicleId=)
GET    /api/expenses/:id           get one
POST   /api/expenses               create [Driver, Financial Analyst]
PUT    /api/expenses/:id           update [Driver, Financial Analyst]
DELETE /api/expenses/:id            delete [Driver, Financial Analyst]
```

**`GET /api/expenses?vehicleId=1`** — filter to one vehicle.

**`POST /api/expenses` body:**
```json
{ "vehicleId": 1, "tripId": null,
  "category": "Road Toll", "amount": 8500,
  "expenseDate": "2026-07-18",
  "notes": "Port Harcourt entrance toll" }
```
`vehicleId` and `tripId` are optional (unassigned expenses are allowed).

**`PUT /api/expenses/:id` body** — all optional:
```json
{ "amount": 9200, "notes": "Corrected amount" }
```

---

### 4.7 Dashboard — `/api/dashboard`

```
GET /api/dashboard                       available to any authenticated role
GET /api/dashboard?type=Truck            scope by vehicle type
GET /api/dashboard?region=North          scope by region
```

```json
// 200
{ "activeVehicles": 4,
  "availableVehicles": 6,
  "vehiclesInMaintenance": 2,
  "activeTrips": 4,
  "pendingTrips": 3,
  "driversOnDuty": 5,
  "fleetUtilizationPercent": 33.3,
  "meta": {
    "totalVehicles": 12,
    "retiredVehicles": 0,
    "activeFleet": 12,
    "filters": { "type": "Truck", "region": null }
  }
}
```

No `status` filter — the KPI response breaks the fleet down by status inside `activeVehicles` (ON_TRIP / IN_SHOP) for each scope.

---

### 4.8 Reports — `/api/reports`

All report routes require `[Fleet Manager, Financial Analyst]`.

```
GET /api/reports/operational-cost     cost breakdown per vehicle across all trips
GET /api/reports/fuel-efficiency       km/L per vehicle
GET /api/reports/fleet-utilization    trip count and distance per vehicle
GET /api/reports/vehicle-roi          net revenue vs acquisition cost per vehicle
GET /api/reports/export?format=csv    same as operational-cost but as a CSV download
                                   Query param: ?format=csv  (default: JSON)
```

All return arrays of objects keyed by `vehicleId` or `registrationNumber`. Numeric fields are floats. CSV export includes a `totalCost` row at the end.

```
→ 403 { "error": { "code": "FORBIDDEN", "message": "This action requires one of: Fleet Manager, Financial Analyst." } }
```

---

## 5. Caching

Read-heavy endpoints (dashboard KPIs, vehicle/driver list+detail, report aggregates) are cached via Upstash Redis when `REDIS_URL` is set. Cache is transparent to the client — the API response is the same whether Redis is on or off.

TTL targets (not guaranteed):
| Endpoint          | Approx TTL | Invalidated when           |
|-------------------|------------|----------------------------|
| Dashboard KPIs    | 60s        | any vehicle/driver/trip change |
| Reports          | 300s       | any vehicle/driver/trip change |
| Vehicle list/detail| 120s      | any vehicle write              |
| Driver list/detail| 120s       | any driver write               |

---

## 6. Error Response Format

Every error follows this shape:

```json
{
  "error": {
    "code":    "SNAKE_CASE_ERROR_CODE",
    "message": "Human-readable description",
    "details": [ ... ]   // only present when Zod validation fails
  }
}
```

**HTTP status → `error.code` mapping:**

| Status | Typical `code` values                                      |
|--------|-------------------------------------------------------------|
| 400    | `VALIDATION_ERROR` — Zod schema failure, `details` array populated |
| 401    | `UNAUTHENTICATED` — missing/invalid/expired token           |
| 403    | `FORBIDDEN` — valid token but insufficient role             |
| 404    | `NOT_FOUND` — resource not found (Prisma `P2025`)          |
| 409    | `DUPLICATE_VALUE` (Prisma `P2002`), `INVALID_TRIP_STATUS`, `VEHICLE_NOT_AVAILABLE`, etc. |
| 500    | `INTERNAL_ERROR` — logged server-side, client sees generic message |

---

## 7. Data Types Quick Reference

| Field           | DB type         | API format                          |
|-----------------|-----------------|------------------------------------|
| dates in schema | Prisma `DateTime` or `@db.Date` | ISO 8601 string: `"2026-07-18T00:00:00.000Z"` |
| date query params | Zod-coerced strings (e.g. `"2026-07-18"`) | |
| money / distance / weight | `Float` | plain JSON number, no formatting |
| IDs             | `Int` (autoincrement) | integer, e.g. `1`, `42`        |
| enums           | DB enum + Prisma | uppercase string: `"AVAILABLE"`  |
| nullable foreign key | `Int?` (optional Int) | integer or `null`             |

---

## 8. Seeded Test Data

Run `npm run db:seed` to populate the DB with:

| Table          | Seed rows                                 |
|----------------|-------------------------------------------|
| `Role`         | Fleet Manager, Driver, Safety Officer, Financial Analyst |
| `User`         | 4 users, one per role                     |
| `Vehicle`      | 12 vehicles (trucks, tankers, trailers)   |
| `Driver`       | 8 drivers                                 |
| `Trip`         | 4 trips in mixed states                    |
| `MaintenanceLog`| 6 logs (open, in-progress, closed)       |
| `FuelLog`      | 10 entries                               |
| `Expense`      | 12 entries                                |

Seed users' passwords are their lowercased names with no spaces and `1` appended (e.g. `fleet manager` → `fleetmanager1`).

---

## 9. Dev Workflow

```bash
# Install deps
npm install

# Generate Prisma client + push schema + seed
npm run db:setup

# Start dev server (auto-reloads on file changes)
npm run dev

# Start production server
npm run start

# Prisma Studio (visual DB browser)
npm run db:studio
```

**`.env` variables required:**

```env
DATABASE_URL="postgresql://..."      # Neon pooled connection string (required)
JWT_SECRET="..."                     # min 48-char random hex (required)
PORT=3000
NODE_ENV=development
JWT_EXPIRES_IN=12h
REDIS_URL=""                          # Optional. Upstash TLS URL: rediss://...
```

**Prisma schema (`prisma/schema.prisma`) is the source of truth for data model.**