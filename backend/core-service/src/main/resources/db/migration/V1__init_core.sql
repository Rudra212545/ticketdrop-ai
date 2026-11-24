-- ============================================================================
-- TicketDrop AI — V1 Core Schema (Auth, RBAC, Events, Seats, Bookings, Audit)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users (SUPER_ADMIN, ADMIN, USER)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    role            VARCHAR(32)  NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'USER')),
    status          VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING_APPROVAL', 'BANNED')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role_status ON users(role, status);

-- 2. Organizer Profiles (for ADMIN role approval workflow)
CREATE TABLE organizer_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    org_name            VARCHAR(200) NOT NULL,
    registration_no     VARCHAR(100),
    approval_status     VARCHAR(32)  NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),
    approved_by         UUID         REFERENCES users(id),
    platform_fee_bps    INT          NOT NULL DEFAULT 500, -- 5.00%
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. Events
CREATE TABLE events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id            UUID          NOT NULL REFERENCES organizer_profiles(id),
    title                   VARCHAR(255)  NOT NULL,
    description             TEXT          NOT NULL,
    category                VARCHAR(64)   NOT NULL,
    city                    VARCHAR(100)  NOT NULL,
    venue_name              VARCHAR(200)  NOT NULL,
    event_start_at          TIMESTAMPTZ   NOT NULL,
    flash_sale_enabled      BOOLEAN       NOT NULL DEFAULT FALSE,
    flash_sale_start_at     TIMESTAMPTZ,
    resale_enabled          BOOLEAN       NOT NULL DEFAULT TRUE,
    max_resale_multiplier   NUMERIC(3,2)  NOT NULL DEFAULT 1.10,
    status                  VARCHAR(32)   NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'SOLD_OUT', 'CANCELLED')),
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_city_status_start ON events(city, status, event_start_at);

-- 4. Seat Tiers
CREATE TABLE seat_tiers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id         UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    base_price_paise BIGINT       NOT NULL CHECK (base_price_paise >= 0),
    total_seats      INT          NOT NULL CHECK (total_seats > 0),
    available_seats  INT          NOT NULL CHECK (available_seats >= 0),
    version          BIGINT       NOT NULL DEFAULT 0
);

CREATE INDEX idx_seat_tiers_event ON seat_tiers(event_id);

-- 5. Individual Seats (Optimistic Locking via version)
CREATE TABLE seats (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tier_id      UUID        NOT NULL REFERENCES seat_tiers(id) ON DELETE CASCADE,
    row_label    VARCHAR(16) NOT NULL,
    seat_number  INT         NOT NULL,
    status       VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'LOCKED', 'BOOKED', 'RESALE_LISTED')),
    locked_by    UUID        REFERENCES users(id),
    locked_until TIMESTAMPTZ,
    version      BIGINT      NOT NULL DEFAULT 0,
    UNIQUE (event_id, row_label, seat_number)
);

CREATE INDEX idx_seats_event_status ON seats(event_id, status);

-- 6. Bookings (Idempotent Checkout)
CREATE TABLE bookings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID         NOT NULL REFERENCES users(id),
    event_id             UUID         NOT NULL REFERENCES events(id),
    idempotency_key      VARCHAR(128) NOT NULL UNIQUE,
    total_amount_paise   BIGINT       NOT NULL,
    platform_fee_paise   BIGINT       NOT NULL DEFAULT 0,
    status               VARCHAR(32)  NOT NULL CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'FAILED', 'REFUNDED')),
    payment_ref          VARCHAR(128),
    expires_at           TIMESTAMPTZ  NOT NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_user ON bookings(user_id, created_at DESC);

-- 7. Issued Tickets & Signed QR Tokens
CREATE TABLE tickets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id   UUID         NOT NULL REFERENCES bookings(id),
    seat_id      UUID         NOT NULL REFERENCES seats(id),
    owner_id     UUID         NOT NULL REFERENCES users(id),
    qr_token_id  UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    qr_signature VARCHAR(255) NOT NULL,
    status       VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESALE_LISTED', 'TRANSFERRED', 'USED', 'REVOKED')),
    issued_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_owner ON tickets(owner_id, status);

-- 8. Transactional Outbox (Guaranteed Kafka Delivery)
CREATE TABLE outbox_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64)  NOT NULL,
    aggregate_id   UUID         NOT NULL,
    topic          VARCHAR(128) NOT NULL,
    payload        JSONB        NOT NULL,
    status         VARCHAR(32)  NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    retry_count    INT          NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_pending ON outbox_events(status, created_at) WHERE status = 'PENDING';

-- 9. Immutable Audit Logs (Spring AOP @Audited)
CREATE TABLE audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id      UUID,
    actor_role    VARCHAR(32),
    action        VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64)  NOT NULL,
    resource_id   VARCHAR(128),
    old_state     JSONB,
    new_state     JSONB,
    ip_address    VARCHAR(64),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

