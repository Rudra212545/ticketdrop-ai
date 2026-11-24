# 03 — Low-Level Design: Database, State Machines & Redis

## 1. State Machines

### 1.1 Seat Lifecycle
```text
AVAILABLE ──(Redis Lock)──► LOCKED ──(Payment Confirmed)──► BOOKED
    ▲                         │                               │
    └───(10m TTL Expired)─────┘                               ▼
                                                       RESALE_LISTED
                                                              │
                                                  (Resale Escrow Settled)
                                                              ▼
                                                      BOOKED (New Owner)
```

### 1.2 Booking Lifecycle
```text
PENDING_PAYMENT ──(Webhook Success)──► CONFIRMED ──(Refund/Cancel)──► REFUNDED
       │
       ├──(10m Timeout)──► EXPIRED
       └──(Payment Fail)─► FAILED
```

---

## 2. PostgreSQL 16 + `pgvector` Schema (Flyway Migrations)

All schema changes are strictly versioned under `core-service/src/main/resources/db/migration/` (`V1__init_core.sql`, `V2__resale_waitlist.sql`, `V3__ai_embeddings.sql`). `spring.jpa.hibernate.ddl-auto` is locked to `validate`.

### 2.1 Core Tables

| Table | Key Columns & Constraints | Purpose |
| :--- | :--- | :--- |
| **`users`** | `id (UUID PK)`, `email (UNIQUE)`, `password_hash`, `full_name`, `role (SUPER_ADMIN \| ADMIN \| USER)`, `status (ACTIVE \| PENDING_APPROVAL \| BANNED)`, `created_at` | All platform accounts |
| **`organizer_profiles`** | `id (UUID PK)`, `user_id (FK -> users)`, `org_name`, `gst_or_reg_no`, `approval_status`, `approved_by (FK -> users)`, `platform_fee_bps (INT)` | Verified organizer metadata |
| **`events`** | `id (UUID PK)`, `organizer_id (FK)`, `title`, `description`, `category`, `city`, `venue_name`, `event_start_at`, `flash_sale_enabled (BOOL)`, `flash_sale_start_at`, `resale_enabled (BOOL)`, `max_resale_multiplier (DECIMAL 3,2)`, `status (DRAFT \| PUBLISHED \| SOLD_OUT \| CANCELLED)`, `created_at` | Event master table |
| **`seat_tiers`** | `id (UUID PK)`, `event_id (FK)`, `name`, `base_price (BIGINT paise)`, `total_seats`, `available_seats`, `version (BIGINT)` | Pricing tiers (stored in smallest currency unit: paise) |
| **`seats`** | `id (UUID PK)`, `event_id (FK)`, `tier_id (FK)`, `row_label`, `seat_number`, `status (AVAILABLE \| LOCKED \| BOOKED \| RESALE_LISTED)`, `locked_by (UUID)`, `locked_until (TIMESTAMPTZ)`, `version (BIGINT)` | Individual seats; **Optimistic Lock (`@Version`)** + composite index `(event_id, status)` |
| **`bookings`** | `id (UUID PK)`, `user_id (FK)`, `event_id (FK)`, `idempotency_key (UNIQUE)`, `total_amount (BIGINT)`, `platform_fee (BIGINT)`, `status`, `payment_ref`, `expires_at`, `created_at` | Checkout & payment orders |
| **`tickets`** | `id (UUID PK)`, `booking_id (FK)`, `seat_id (FK)`, `owner_id (FK -> users)`, `qr_token_id (UUID UNIQUE)`, `qr_signature`, `status (ACTIVE \| RESALE_LISTED \| TRANSFERRED \| USED \| REVOKED)`, `issued_at` | Issued tickets & QR validity |
| **`resale_listings`** | `id (UUID PK)`, `ticket_id (FK)`, `seller_id (FK)`, `asking_price (BIGINT)`, `status (ACTIVE \| PENDING_SETTLEMENT \| SOLD \| CANCELLED)`, `version (BIGINT)`, `created_at` | Verified fan-to-fan resale |
| **`waitlist_entries`** | `id (UUID PK)`, `event_id (FK)`, `tier_id (FK)`, `user_id (FK)`, `seat_count (INT)`, `max_price (BIGINT)`, `status (WAITING \| OFFERED \| CLAIMED \| EXPIRED)`, `offer_expires_at`, `created_at` | Durable waitlist records |
| **`outbox_events`** | `id (UUID PK)`, `aggregate_type`, `aggregate_id`, `topic`, `payload (JSONB)`, `status (PENDING \| PUBLISHED \| FAILED)`, `retry_count`, `created_at` | Transactional Outbox for Kafka |
| **`audit_logs`** | `id (UUID PK)`, `actor_id`, `actor_role`, `action`, `resource_type`, `resource_id`, `old_state (JSONB)`, `new_state (JSONB)`, `ip_address`, `created_at` | Immutable AOP audit log |
| **`event_embeddings`** | `id (UUID PK)`, `event_id (FK UNIQUE)`, `content (TEXT)`, `embedding (VECTOR(768))`, `metadata (JSONB)`, `updated_at` | `pgvector` HNSW index for Spring AI RAG |

### 2.2 Critical Indexes
* `CREATE UNIQUE INDEX idx_bookings_idempotency ON bookings(idempotency_key);`
* `CREATE INDEX idx_seats_event_status ON seats(event_id, status);`
* `CREATE INDEX idx_outbox_pending ON outbox_events(status, created_at) WHERE status = 'PENDING';`
* `CREATE INDEX idx_event_embeddings_hnsw ON event_embeddings USING hnsw (embedding vector_cosine_ops);`

---

## 3. Redis 7 Key Design & Data Structures

| Key Pattern | Redis Type | TTL | Purpose |
| :--- | :--- | :--- | :--- |
| `seat:lock:{eventId}:{seatId}` | `String` (Redisson Lock) | `600s` (10m) | Exclusive seat lock holding `{userId}:{lockToken}` |
| `waitlist:{eventId}:{tierId}` | `ZSET` | Event end | Score = join epoch ms; Member = `{waitlistEntryId}:{userId}:{seatCount}` |
| `queue:flash:{eventId}` | `ZSET` | 2 hours | Virtual Waiting Room queue; Score = arrival timestamp |
| `queue:admit:{eventId}:{userId}` | `String` | `300s` (5m) | Admission pass allowing user into seat map during flash drop |
| `qr:revoked:{qrTokenId}` | `String` | Event end + 24h | Instant O(1) check at venue gate so resold/old QRs are rejected |
| `jwt:refresh:{userId}:{jti}` | `String` | `7 days` | Active refresh token family for rotation & reuse detection |
| `jwt:blacklist:{jti}` | `String` | Remaining JWT TTL | Immediate revocation on logout or `SUPER_ADMIN` user ban |
| `ratelimit:{route}:{ipOrUser}` | `Hash` (Bucket4j) | Sliding | Anti-bot token bucket rate limiting at `api-gateway` |
| `cache:seatmap:{eventId}` | `String` (JSON) | `5s` | Micro-cached seat map to absorb high read bursts during flash drops |

---

## 4. Concurrency Strategy (Defense in Depth)
To guarantee **0 double-bookings** even under extreme flash-sale traffic:
1. **Layer 1 — Redis Virtual Waiting Room:** Smooths incoming spikes so only `N` users per second hit the seat-locking API.
2. **Layer 2 — Redisson MultiLock:** When a user locks multiple seats (`[A1, A2]`), sort seat IDs lexicographically before acquiring locks to **prevent deadlocks**.
3. **Layer 3 — PostgreSQL Optimistic Locking (`@Version`):** Even if a Redis failover occurs, PostgreSQL rejects any stale concurrent `UPDATE` with `OptimisticLockException` (`409 Conflict`).
4. **Layer 4 — Idempotency Key:** Prevents duplicate charges if the client retries checkout on a flaky mobile network.

