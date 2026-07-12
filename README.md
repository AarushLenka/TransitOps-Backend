# TransitOps — Smart Transport Operations Platform

A modular Express.js API that digitizes vehicle, driver, dispatch, maintenance, and expense management for a transport fleet, enforcing the hackathon business rules and surfacing operational KPIs/analytics.

- **Backend:** Express.js (ESM) + Prisma ORM
- **Database:** PostgreSQL on Neon
- **Auth:** JWT + bcrypt, RBAC (4 roles)
- **Validation:** Zod

---

## Quick start

```bash
# 1. install dependencies
npm install

# 2. configure environment
cp .env.example .env
#   -> edit .env and paste your Neon DATABASE_URL + JWT_SECRET
#   -> (optional) paste an Upstash REDIS_URL to enable read-through caching — see "Caching" below

# 3. create the schema + seed (prisma generate + db push + seed)
npm run db:setup

# 4. run the API
npm run dev          # http://localhost:3000
```

Other handy scripts:

| Script | What it does |
|---|---|
| `npm run db:studio` | Opens Prisma Studio (a GUI to browse/edit tables) |
| `npm run db:push` | Re-apply `prisma/schema.prisma` to the DB (after schema edits) |
| `npm run db:seed` | Re-run `prisma/seed.js` only |
| `npm start` | Run without nodemon (production-style) |

---

## Seeded accounts (password `Password123!` for all)

| Email | Role | Region |
|---|---|---|
| `fleet@transitops.test` | Fleet Manager | North |
| `driver@transitops.test` | Driver | North |
| `safety@transitops.test` | Safety Officer | North |
| `finance@transitops.test` | Financial Analyst | North |

Seeded data: vehicle **Van-05** (Van, max 500 kg, North, AVAILABLE), driver **Alex Rivera** (licence valid to 2027-12-31, AVAILABLE, safetyScore 88), and one **Draft** trip Van-05 → Alex carrying 450 kg.

---

## Project structure

```
transport-ops/
├─ prisma/
│  ├─ schema.prisma          # models + enums (mirrors db/schema.sql)
│  └─ seed.js
├─ postman/
│  └─ TransitOps.postman_collection.json
├─ db/schema.sql             # original SQL reference
└─ src/
   ├─ server.js              # entry — loads env, listens on PORT
   ├─ app.js                # express app — middleware + /api router
   ├─ config/env.js          # validates DATABASE_URL / JWT_SECRET at boot
   ├─ lib/prisma.js         # single PrismaClient instance
   ├─ middleware/            # auth, rbac, validate, error, notFound
   ├─ routes/index.js        # mounts every module under /api
   └─ modules/<domain>/      # each domain: {routes, controller, service, schema}
      └─ auth, vehicles, drivers, trips, maintenance,
         fuelLogs, expenses, dashboard, reports
```

Every protected route flows: `authenticate → requireRole(...) → validate(...) → controller → service`.
Services throw `HttpError(statusCode, code, message, details?)`; the central error
handler turns them into `{ error: { code, message, details? } }`.

---

## Endpoints

Base URL: `http://localhost:3000/api`. All protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Roles | Body |
|---|---|---|---|
| POST | `/auth/register` | open | `{ fullName, email, password, roleId, region? }` |
| POST | `/auth/login` | open | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | any | — |

### Vehicles
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/vehicles?status=&type=&region=` | any | filters via query |
| GET | `/vehicles/:id` | any | |
| POST | `/vehicles` | Fleet Manager | creates AVAILABLE |
| PUT | `/vehicles/:id` | Fleet Manager | cannot manually set status=ON_TRIP |
| DELETE | `/vehicles/:id` | Fleet Manager | blocked if currently ON_TRIP |

### Drivers
| Method | Path | Roles |
|---|---|---|
| GET | `/drivers?status=` | any |
| GET | `/drivers/:id` | any |
| POST | `/drivers` | Fleet Manager, Safety Officer |
| PUT | `/drivers/:id` | Fleet Manager, Safety Officer (safetyScore) |
| DELETE | `/drivers/:id` | Fleet Manager, Safety Officer (blocked if ON_TRIP) |

### Trips (state machine)
| Method | Path | Roles |
|---|---|---|
| GET | `/trips?status=` | any |
| GET | `/trips/:id` | any |
| POST | `/trips` | Driver, Fleet Manager (creates DRAFT) |
| POST | `/trips/:id/dispatch` | Driver, Fleet Manager (DRAFT → DISPATCHED) |
| POST | `/trips/:id/complete` | Driver, Fleet Manager (DISPATCHED → COMPLETED) |
| POST | `/trips/:id/cancel` | Driver, Fleet Manager |
| DELETE | `/trips/:id` | Driver, Fleet Manager (only DRAFT/CANCELLED) |

Complete body: `{ finalOdometer?, fuelConsumed?, actualDistance?, actualRevenue? }`

### Maintenance
| Method | Path | Roles |
|---|---|---|
| GET | `/maintenance` | any |
| GET | `/maintenance/:id` | any |
| POST | `/maintenance` | Fleet Manager (vehicle → IN_SHOP) |
| PUT | `/maintenance/:id` | Fleet Manager (closing → AVAILABLE if no other open logs) |
| DELETE | `/maintenance/:id` | Fleet Manager |

### Fuel logs & Expenses
| Path prefix | Read | Write |
|---|---|---|
| `/fuel-logs` (`?vehicleId=`) | any | Driver, Fleet Manager |
| `/expenses` (`?vehicleId=`) | any | Driver, Financial Analyst |

### Dashboard & Reports
| Method | Path | Roles |
|---|---|---|
| GET | `/dashboard?type=&region=` | any (all roles) |
| GET | `/reports/operational-cost` | Fleet Manager, Financial Analyst |
| GET | `/reports/fuel-efficiency` | Fleet Manager, Financial Analyst |
| GET | `/reports/fleet-utilization` | Fleet Manager, Financial Analyst |
| GET | `/reports/vehicle-roi` | Fleet Manager, Financial Analyst |
| GET | `/reports/export?format=csv` | Fleet Manager, Financial Analyst |

---

## Business rules enforced (§4)

| Rule | Where |
|---|---|
| Registration number unique | Prisma `@unique` (→ 409 `DUPLICATE_VALUE`) |
| Retired/In Shop vehicles excluded from dispatch | `trips.service.create` + `dispatch`: vehicle must be `AVAILABLE` |
| Expired licence / suspended driver excluded | `trips.service`: licence-expiry check + status check |
| On-trip vehicle/driver can't be re-assigned | `dispatch` tx + intra-tx `findFirst` conflict check (409 `ALREADY_ON_TRIP`) |
| Cargo weight ≤ max capacity | `trips.service.create` (400 `CARGO_EXCEEDS_CAPACITY`) |
| Dispatch → vehicle + driver ON_TRIP | `dispatch` `$transaction` |
| Complete → statuses back to AVAILABLE | `complete` `$transaction` |
| Cancel dispatched → restore AVAILABLE | `cancel` `$transaction` |
| Open maintenance → vehicle IN_SHOP | `maintenance.service.create` `$transaction` |
| Close maintenance → AVAILABLE (unless retired / other open logs) | `maintenance.service.update` `$transaction` |

---

---

## Postman setup

1. Open Postman → Import → select `postman/TransitOps.postman_collection.json`.
2. In the collection, set the **variable** `baseUrl` = `http://localhost:3000`.
3. Send **Auth → Login** (`fleet@transitops.test` / `Password123!`). The collection's
   test script saves the returned token to the `token` variable automatically —
   every subsequent request sends `Authorization: Bearer {{token}}`.

## §5 workflow walkthrough (recommended first run)

1. **Login** as `fleet@transitops.test` → token auto-saved.
2. **Vehicles → List** → `Van-05` shows `AVAILABLE`.
3. **Trips → Create** with cargo 600 kg → expect **400 `CARGO_EXCEEDS_CAPACITY`**
   (600 > 500). Repeat with 450 kg → **201 Draft** trip.
4. **Trips → Dispatch** the new trip → `Van-05` + `Alex` become `ON_TRIP`.
5. Create a **second** trip on Alex and try to **Dispatch** it → expect **409 `ALREADY_ON_TRIP`**.
6. **Trips → Complete** the dispatched trip with odometer/fuel → statuses back to `AVAILABLE`.
7. **Maintenance → Create** (Oil Change) on Van-05 → vehicle → `IN_SHOP`. Try to create/dispatch a trip on Van-05 → **409 `VEHICLE_NOT_AVAILABLE` / `VEHICLE_IN_SHOP`**.
8. **Maintenance → Update** → `status: CLOSED` → Van-05 → `AVAILABLE`.
9. Retired check: **Vehicles → Update** a vehicle to `status: RETIRED`, then complete/dispatch on it → it stays `RETIRED`.
10. **Dashboard → Get KPIs** → counts + `fleetUtilizationPercent`. **Reports → operational-cost / vehicle-roi / export?format=csv**.
11. **RBAC check**: log in as `finance@transitops.test`, then **POST `/vehicles`** → **403 `FORBIDDEN`**.

## Observability

- `QUERY_LOG=true` in `.env` to log every SQL query (Prisma).
- Requests are logged via `morgan('dev')`.
- Central error handler logs server errors (5xx) to the console with the stack.

---

## Caching (Upstash Redis)

Read-through caching is **opt-in**. Set `REDIS_URL` in `.env` to an Upstash
**Redis** (TLS) connection string (`rediss://default:<password>@<host>.upstash.io:6379`)
and the read paths below stop hitting Postgres. Leave it unset and every cache
operation is a no-op — the API runs exactly as before. If Redis is reachable, it
also logs `[cache] connected` / `[cache] ready` at boot.

**What is cached** (heavy or high-frequency reads whose invalidation is bounded):

| Cache | Keyed by | TTL | Busted by |
|---|---|---|---|
| Dashboard KPIs `GET /dashboard` | `type` + `region` | 60s | any vehicle/driver/trip/maintenance/fuel/expense write |
| Reports `GET /reports/*` + `/reports/export` | report name | 300s | any vehicle/trip/maintenance/fuel/expense write |
| Vehicles list + detail `GET /vehicles` `(/:id)` | filters / id | 120s | vehicle write, trip dispatch/complete/cancel, maintenance open/close |
| Drivers list + detail `GET /drivers` `(/:id)` | filters / id | 120s | driver write, trip dispatch/complete/cancel |

**What is deliberately *not* cached:** trips, maintenance, fuel-log and expense
reads. Their payloads `include` the related vehicle/trip/driver rows, so any
status flip would stale-date a cached copy and force near-total invalidation —
caching them would hurt more than help. They read Postgres directly; their
**writes** still bust the caches above.

**Invalidation contract.** Every mutating endpoint busts exactly the namespaces
its change can affect (defined in `src/lib/cache.js`, called by the controllers):

- `invalidateAnalytics()` → `transitops:dashboard:*` + `transitops:reports:*`
- `invalidateVehicles()` → `transitops:vehicles:*` (list + all details)
- `invalidateDrivers()` → `transitops:drivers:*`

| Write | Bust |
|---|---|
| Vehicle create/update/delete | vehicles + analytics |
| Driver create/update/delete | drivers |
| Trip create/delete | analytics (trip counts) |
| Trip dispatch/complete/cancel | vehicles + drivers + analytics (vehicle & driver status flips; trip aggregates) |
| Maintenance create/update/delete | vehicles (IN_SHOP↔AVAILABLE) + analytics (cost feeds reports) |
| Fuel log create/update/delete | analytics (cost/liters feed reports) |
| Expense create/update/delete | analytics (amount feeds operational-cost) |

Invalidation runs **after** the Prisma transaction commits and is best-effort: if
Redis is briefly down the delete is skipped and TTL self-heals it. Deletion uses
`SCAN` (never `KEYS`) so it never blocks a shared Upstash instance.

**Tuning:** edit the `TTL` table in `src/lib/cache.js`. Set `CACHE_DEBUG=true` to
log `[cache] HIT` / `[cache] MISS` for each key when debugging hit-rate.

**Graceful shutdown:** the Redis client is closed alongside Postgres on `SIGINT` /
`SIGTERM` (`src/server.js`).
