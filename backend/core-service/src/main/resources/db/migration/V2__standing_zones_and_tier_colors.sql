-- ============================================================================
-- TicketDrop AI — V2 Standing / Open-Ground Zones & Custom Tier Colors
-- ============================================================================

-- 1. Add seating_mode to events (ASSIGNED_SEAT vs STANDING)
ALTER TABLE events
    ADD COLUMN seating_mode VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED_SEAT'
    CHECK (seating_mode IN ('ASSIGNED_SEAT', 'STANDING'));

-- 2. Add organizer-selected color_code to seat_tiers
ALTER TABLE seat_tiers
    ADD COLUMN color_code VARCHAR(32) NOT NULL DEFAULT 'VIOLET';

-- 3. Support standing (General Admission) passes on tickets
ALTER TABLE tickets
    ALTER COLUMN seat_id DROP NOT NULL;

ALTER TABLE tickets
    ADD COLUMN tier_id UUID REFERENCES seat_tiers(id),
    ADD COLUMN pass_label VARCHAR(64);

-- Backfill existing seated tickets with tier_id and pass_label
UPDATE tickets t
SET tier_id = s.tier_id,
    pass_label = s.row_label || '-' || s.seat_number
FROM seats s
WHERE t.seat_id = s.id AND t.tier_id IS NULL;

-- 4. Durable Standing Zone Holds (10-min TTL + expiry sweeper)
CREATE TABLE standing_holds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tier_id     UUID        NOT NULL REFERENCES seat_tiers(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id),
    booking_id  UUID        REFERENCES bookings(id),
    quantity    INT         NOT NULL CHECK (quantity > 0 AND quantity <= 6),
    status      VARCHAR(32) NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'CONFIRMED', 'RELEASED')),
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_standing_holds_booking ON standing_holds(booking_id);
CREATE INDEX idx_standing_holds_expiry ON standing_holds(status, expires_at) WHERE status = 'HELD';

