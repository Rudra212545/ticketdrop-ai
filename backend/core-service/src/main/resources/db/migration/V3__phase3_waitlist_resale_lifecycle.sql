-- ============================================================================
-- TicketDrop AI — V3 Phase 3: Event Lifecycle, Auto-Waitlist, Resale Escrow & DLQ
-- ============================================================================

-- 1. Add COMPLETED status to events lifecycle
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events
    ADD CONSTRAINT events_status_check
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'SOLD_OUT', 'CANCELLED', 'COMPLETED'));

-- 2. Track gate-entry scan timestamp on tickets
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- 3. Track Outbox delivery / DLQ metadata
ALTER TABLE outbox_events
    ADD COLUMN IF NOT EXISTS last_error TEXT,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dlq_replayed_at TIMESTAMPTZ;

-- 4. Smart Auto-Waitlist Entries
CREATE TABLE IF NOT EXISTS waitlist_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tier_id         UUID        NOT NULL REFERENCES seat_tiers(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(32) NOT NULL DEFAULT 'WAITING'
                    CHECK (status IN ('WAITING', 'OFFERED', 'CLAIMED', 'EXPIRED', 'CANCELLED')),
    offered_seat_id UUID        REFERENCES seats(id),
    offer_expires_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_fifo
    ON waitlist_entries(event_id, tier_id, status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_waitlist_user
    ON waitlist_entries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_offer_expiry
    ON waitlist_entries(status, offer_expires_at) WHERE status = 'OFFERED';

-- 5. Anti-Scalper Price-Capped Resale Escrow Listings
CREATE TABLE IF NOT EXISTS resale_listings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id               UUID        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    event_id                UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    seller_id               UUID        NOT NULL REFERENCES users(id),
    buyer_id                UUID        REFERENCES users(id),
    original_price_paise    BIGINT      NOT NULL CHECK (original_price_paise >= 0),
    asking_price_paise      BIGINT      NOT NULL CHECK (asking_price_paise > 0),
    max_allowed_price_paise BIGINT      NOT NULL CHECK (max_allowed_price_paise > 0),
    status                  VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE', 'SOLD', 'CANCELLED')),
    version                 BIGINT      NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sold_at                 TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_resale_event_active
    ON resale_listings(event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resale_seller
    ON resale_listings(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_resale_ticket_active
    ON resale_listings(ticket_id, status);

