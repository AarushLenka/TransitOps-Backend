-- ============================================================================
-- TransitOps — Smart Transport Operations Platform  (basic schema)
-- Portable SQL DDL (PostgreSQL / MySQL / SQLite — minor edits only).
-- Eight expected entities (§6): Users, Roles, Vehicles, Drivers, Trips,
-- Maintenance Logs, Fuel Logs, Expenses  + bonus: Vehicle Documents.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ROLES  (RBAC: Fleet Manager, Driver, Safety Officer, Financial Analyst)
-- ----------------------------------------------------------------------------
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL UNIQUE,   -- 'Fleet Manager' | 'Driver' | 'Safety Officer' | 'Financial Analyst'
    description VARCHAR(255)
);

-- ----------------------------------------------------------------------------
-- 2. USERS  (auth: email + password, RBAC)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(120) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id       INTEGER      NOT NULL REFERENCES roles(id),
    region        VARCHAR(80),                   -- used by dashboard region filter
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. VEHICLES  (registry; filters by type / status / region on dashboard)
-- ----------------------------------------------------------------------------
CREATE TABLE vehicles (
    id                 SERIAL PRIMARY KEY,
    registration_number VARCHAR(30)  NOT NULL UNIQUE,   -- RULE: registration number is unique
    model              VARCHAR(120) NOT NULL,            -- Vehicle Name / Model
    type               VARCHAR(40)  NOT NULL,            -- Van | Truck | Bus | Tanker ...  (dashboard filter)
    max_load_capacity  NUMERIC(12,2) NOT NULL,            -- kg  (RULE: cargo must not exceed this)
    odometer           NUMERIC(12,2) NOT NULL DEFAULT 0,  -- current reading; updated on trip completion
    acquisition_cost   NUMERIC(14,2) NOT NULL,            -- used by ROI formula
    region             VARCHAR(80),                       -- dashboard filter
    status             VARCHAR(20)  NOT NULL DEFAULT 'Available'
        CHECK (status IN ('Available','On Trip','In Shop','Retired')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 4. DRIVERS
-- ----------------------------------------------------------------------------
CREATE TABLE drivers (
    id                 SERIAL PRIMARY KEY,
    full_name          VARCHAR(120) NOT NULL,
    license_number     VARCHAR(40)  NOT NULL UNIQUE,
    license_category   VARCHAR(40)  NOT NULL,             -- LMV | HMV | HGV ...  (must fit vehicle's needs)
    license_expiry_date DATE         NOT NULL,             -- RULE: expired license => cannot assign
    contact_number     VARCHAR(30),
    safety_score       NUMERIC(5,2) DEFAULT 0,            -- 0-100; tracked by Safety Officer
    status             VARCHAR(20)   NOT NULL DEFAULT 'Available'
        CHECK (status IN ('Available','On Trip','Off Duty','Suspended')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5. TRIPS   lifecycle: Draft -> Dispatched -> Completed | Cancelled
-- ----------------------------------------------------------------------------
CREATE TABLE trips (
    id               SERIAL PRIMARY KEY,
    source           VARCHAR(120) NOT NULL,
    destination      VARCHAR(120) NOT NULL,
    vehicle_id       INTEGER       NOT NULL REFERENCES vehicles(id),
    driver_id        INTEGER       NOT NULL REFERENCES drivers(id),
    cargo_weight     NUMERIC(12,2) NOT NULL CHECK (cargo_weight >= 0),  -- RULE: <= vehicle.max_load_capacity (app/trigger)
    planned_distance NUMERIC(12,2) NOT NULL,
    actual_distance  NUMERIC(12,2),                        -- set on completion (fuel efficiency = distance/fuel)
    status           VARCHAR(20)   NOT NULL DEFAULT 'Draft'
        CHECK (status IN ('Draft','Dispatched','Completed','Cancelled')),
    planned_revenue  NUMERIC(14,2),                        -- ROI needs Revenue
    actual_revenue   NUMERIC(14,2),                        -- set on completion
    final_odometer   NUMERIC(12,2),                        -- Step 6: entered on completion
    fuel_consumed    NUMERIC(12,2),                        -- Step 6: entered on completion (liters)
    started_at       TIMESTAMP,                             -- set when Dispatched
    completed_at     TIMESTAMP,                             -- set when Completed
    created_by       INTEGER REFERENCES users(id),
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 6. MAINTENANCE LOGS
--    RULE: creating an 'Open' record sets vehicle status -> 'In Shop'
--          closing (-> 'Closed') restores vehicle -> 'Available' (unless Retired)
-- ----------------------------------------------------------------------------
CREATE TABLE maintenance_logs (
    id           SERIAL PRIMARY KEY,
    vehicle_id   INTEGER      NOT NULL REFERENCES vehicles(id),
    service_type VARCHAR(80)  NOT NULL,            -- Oil Change | Brake Service | Tire Rotation ...
    description  VARCHAR(255),
    cost         NUMERIC(14,2) NOT NULL DEFAULT 0,   -- feeds Operational Cost & ROI
    status       VARCHAR(20)  NOT NULL DEFAULT 'Open'
        CHECK (status IN ('Open','In Progress','Closed')),
    start_date   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date     TIMESTAMP,                          -- set when Closed
    notes        TEXT,
    created_by   INTEGER REFERENCES users(id),
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 7. FUEL LOGS   (liters, cost, date)  -> Operational Cost & fuel efficiency
-- ----------------------------------------------------------------------------
CREATE TABLE fuel_logs (
    id            SERIAL PRIMARY KEY,
    vehicle_id    INTEGER       NOT NULL REFERENCES vehicles(id),
    trip_id       INTEGER REFERENCES trips(id),       -- optional link to a trip
    liters        NUMERIC(10,2) NOT NULL CHECK (liters > 0),
    cost          NUMERIC(14,2) NOT NULL CHECK (cost >= 0),
    log_date      DATE          NOT NULL,
    odometer_at_fill NUMERIC(12,2),                   -- optional
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 8. EXPENSES   (tolls & other non-fuel, non-maintenance costs)
-- ----------------------------------------------------------------------------
CREATE TABLE expenses (
    id           SERIAL PRIMARY KEY,
    vehicle_id   INTEGER REFERENCES vehicles(id),
    trip_id      INTEGER REFERENCES trips(id),
    category     VARCHAR(40)  NOT NULL,            -- Toll | Parking | Fine | Other ...
    amount       NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    expense_date DATE         NOT NULL,
    notes        VARCHAR(255),
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- BONUS: VEHICLE DOCUMENTS  (insurance, pollution, registration, fitness...)
-- ----------------------------------------------------------------------------
CREATE TABLE vehicle_documents (
    id             SERIAL PRIMARY KEY,
    vehicle_id     INTEGER      NOT NULL REFERENCES vehicles(id),
    document_type  VARCHAR(50)  NOT NULL,         -- Insurance | Pollution | Registration | Fitness
    file_path      VARCHAR(255) NOT NULL,
    issue_date     DATE,
    expiry_date    DATE,                            -- can drive email reminders (bonus)
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES  (support dashboard filters + common lookups)
-- ============================================================================
CREATE INDEX idx_vehicles_region_type_status ON vehicles (region, type, status);
CREATE INDEX idx_drivers_status_expiry       ON drivers  (status, license_expiry_date);
CREATE INDEX idx_trips_status                ON trips    (status);
CREATE INDEX idx_trips_vehicle_driver        ON trips    (vehicle_id, driver_id);
CREATE INDEX idx_maint_vehicle_status        ON maintenance_logs (vehicle_id, status);
CREATE INDEX idx_fuel_vehicle_date           ON fuel_logs (vehicle_id, log_date);
CREATE INDEX idx_expenses_vehicle_date       ON expenses  (vehicle_id, expense_date);

-- ----------------------------------------------------------------------------
-- OPTIONAL: enforce "one active trip per vehicle /driver" at the DB level.
-- A vehicle (or driver) can appear on AT MOST ONE trip whose status='Dispatched'.
-- (The vehicle/driver status already mirrors this; this is a safety net.)
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX uniq_active_trip_vehicle
    ON trips (vehicle_id) WHERE status = 'Dispatched';   -- Postgres partial index
CREATE UNIQUE INDEX uniq_active_trip_driver
    ON trips (driver_id) WHERE status = 'Dispatched';
