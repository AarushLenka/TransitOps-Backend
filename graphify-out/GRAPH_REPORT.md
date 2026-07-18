# Graph Report - /home/aarushlenka/GitRepos/TransitOps-Backend  (2026-07-18)

## Corpus Check
- Corpus is ~12,256 words - fits in a single context window. You may not need a graph.

## Summary
- 259 nodes · 478 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Controller + Cache Layer
- Middleware + Route Definitions
- App Bootstrap + Services
- DB Singleton + Dashboard
- Package Configuration
- External Dependencies
- Authentication Module
- Server Lifecycle
- Trips Domain Service
- Fuel Logs Service
- Reports Service
- Trips Routes + Schemas
- Database Seeding

## God Nodes (most connected - your core abstractions)
1. `HttpError` - 15 edges
2. `prisma` - 11 edges
3. `authenticate()` - 10 edges
4. `asyncHandler()` - 10 edges
5. `validate()` - 9 edges
6. `scripts` - 8 edges
7. `requireRole()` - 8 edges
8. `invalidateAnalytics()` - 7 edges
9. `cachedGet()` - 6 edges
10. `config` - 5 edges

## Surprising Connections (you probably didn't know these)
- `disconnectPrisma()` --references--> `@prisma/client`  [EXTRACTED]
  src/lib/prisma.js → package.json
- `shutdown()` --calls--> `disconnectPrisma()`  [EXTRACTED]
  src/server.js → src/lib/prisma.js
- `shutdown()` --calls--> `disconnectRedis()`  [EXTRACTED]
  src/server.js → src/lib/redis.js

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "Controller + Cache Layer"
Cohesion: 0.05
Nodes (49): cachedGet(), debug(), invalidateAnalytics(), invalidateDrivers(), invalidatePatterns(), invalidateVehicles(), KEYS, PATTERNS (+41 more)

### Community 1 - "Middleware + Route Definitions"
Cohesion: 0.08
Nodes (34): authenticate(), requireRole(), validate(), router, createDriverSchema, driverQuerySchema, driverStatuses, licenseDate (+26 more)

### Community 2 - "App Bootstrap + Services"
Cohesion: 0.12
Nodes (14): app, errorHandler(), notFound(), create(), ensureRefs(), getById(), INCLUDE, remove() (+6 more)

### Community 3 - "DB Singleton + Dashboard"
Cohesion: 0.13
Nodes (13): prisma, getKpisCtrl, router, dashboardQuerySchema, getKpis(), getById(), remove(), update() (+5 more)

### Community 4 - "Package Configuration"
Cohesion: 0.10
Nodes (20): nodemon, description, devDependencies, nodemon, prisma, main, name, prisma (+12 more)

### Community 5 - "External Dependencies"
Cohesion: 0.11
Nodes (19): bcrypt, cors, dotenv, express, ioredis, jsonwebtoken, morgan, dependencies (+11 more)

### Community 6 - "Authentication Module"
Cohesion: 0.26
Nodes (11): loginCtrl, meCtrl, registerCtrl, router, loginSchema, registerSchema, login(), me() (+3 more)

### Community 7 - "Server Lifecycle"
Cohesion: 0.33
Nodes (6): config, required, disconnectPrisma(), disconnectRedis(), server, shutdown()

### Community 8 - "Trips Domain Service"
Cohesion: 0.27
Nodes (6): create(), dispatch(), getById(), isLicenseValid(), remove(), TRIP_INCLUDE

### Community 9 - "Fuel Logs Service"
Cohesion: 0.39
Nodes (6): create(), ensureRefs(), getById(), INCLUDE, remove(), update()

### Community 10 - "Reports Service"
Cohesion: 0.46
Nodes (6): byVehicleId(), escapeCsv(), fuelEfficiency(), operationalCost(), operationalCostCsv(), vehicleRoi()

### Community 11 - "Trips Routes + Schemas"
Cohesion: 0.36
Nodes (6): router, tripActors, completeTripSchema, createTripSchema, tripQuerySchema, tripStatuses

## Knowledge Gaps
- **85 isolated node(s):** `name`, `version`, `description`, `type`, `main` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `disconnectPrisma()` connect `Server Lifecycle` to `DB Singleton + Dashboard`, `External Dependencies`?**
  _High betweenness centrality (0.260) - this node is a cross-community bridge._
- **Why does `dependencies` connect `External Dependencies` to `Package Configuration`?**
  _High betweenness centrality (0.256) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `External Dependencies` to `Server Lifecycle`?**
  _High betweenness centrality (0.254) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Controller + Cache Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.05367231638418079 - nodes in this community are weakly interconnected._
- **Should `Middleware + Route Definitions` be split into smaller, more focused modules?**
  _Cohesion score 0.0786308973172988 - nodes in this community are weakly interconnected._
- **Should `App Bootstrap + Services` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._