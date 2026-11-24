# 04 — API & Kafka Event Contracts

## 1. API Conventions
* **Base Path:** `/api/v1` (via `api-gateway` on port `8080`)
* **Auth Header:** `Authorization: Bearer <access_jwt>`
* **Idempotency Header (Mutations):** `Idempotency-Key: <uuid-v4>` (required on checkout, resale purchase, and payment webhooks)
* **Error Format:** RFC 7807 `ProblemDetail` (`type`, `title`, `status`, `detail`, `instance`, `correlationId`, `errors[]`)

---

## 2. REST & SSE Endpoints by Role

### 2.1 Public & Authentication
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public | Register `USER` or `ADMIN` (Organizer starts `PENDING_APPROVAL`) |
| `POST` | `/api/v1/auth/login` | Public | Returns Access JWT + Refresh Token |
| `POST` | `/api/v1/auth/refresh` | Public | Rotates Refresh Token in Redis |
| `POST` | `/api/v1/auth/logout` | Authenticated | Blacklists Access JWT `jti` + revokes Refresh Token |
| `GET` | `/api/v1/events` | Public | Paginated event discovery (filters: `city`, `category`, `date`) |
| `GET` | `/api/v1/events/{eventId}/seatmap` | Public | Live seat map (micro-cached 5s in Redis) |

### 2.2 `USER` (Attendee) Endpoints
| Method | Endpoint | Spring Security Rule | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/events/{id}/queue/join` | `hasRole('USER')` | Join flash-sale Virtual Waiting Room |
| `GET` | `/api/v1/events/{id}/queue/stream` | `hasRole('USER')` | **SSE** stream of live queue position & admission token |
| `POST` | `/api/v1/events/{id}/seats/lock` | `hasRole('USER')` | Lock 1–6 seats for 10 mins (Redisson MultiLock) |
| `POST` | `/api/v1/bookings/checkout` | `hasRole('USER')` | Idempotent checkout (`Idempotency-Key` required) |
| `POST` | `/api/v1/events/{id}/waitlist` | `hasRole('USER')` | Join Smart Auto-Waitlist (tier, count, maxPrice) |
| `POST` | `/api/v1/waitlist/{entryId}/claim` | `hasRole('USER')` | One-click claim of an offered waitlist seat |
| `GET` | `/api/v1/tickets/me` | `hasRole('USER')` | Attendee QR ticket wallet (mobile offline-friendly) |
| `POST` | `/api/v1/resale/listings` | `hasRole('USER')` | List owned ticket for resale (validated against organizer cap) |
| `POST` | `/api/v1/resale/listings/{id}/buy` | `hasRole('USER')` | Idempotent resale escrow purchase (rotates QR atomically) |
| `POST` | `/api/v1/ai/concierge/chat` | `hasRole('USER')` | Natural-language **Spring AI** Event Concierge (with live seat `@Tool`) |
| `GET` | `/api/v1/notifications/stream` | `hasRole('USER')` | **SSE** stream for waitlist offers, booking & resale alerts |

### 2.3 `ADMIN` (Event Organizer) Endpoints
| Method | Endpoint | Spring Security Rule | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/events` | `hasRole('ADMIN')` | Create event + seat tiers + auto-generate seat grid |
| `PATCH` | `/api/v1/admin/events/{id}/publish` | `hasRole('ADMIN')` + Owner check | Publish event (triggers Kafka -> `ai-service` embedding) |
| `PATCH` | `/api/v1/admin/events/{id}/resale-policy` | `hasRole('ADMIN')` + Owner check | Toggle resale & set `maxResaleMultiplier` |
| `GET` | `/api/v1/admin/events/{id}/analytics` | `hasRole('ADMIN')` + Owner check | Live sales, lock conversion rate, waitlist depth |
| `POST` | `/api/v1/admin/events/{id}/ai-pricing` | `hasRole('ADMIN')` + Owner check | **Spring AI** Pricing & Demand Co-Pilot recommendation |
| `POST` | `/api/v1/admin/tickets/verify-qr` | `hasRole('ADMIN')` | Venue gate QR scanner (checks signature + Redis revocation list) |

### 2.4 `SUPER_ADMIN` (Platform Owner) Endpoints
| Method | Endpoint | Spring Security Rule | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/super-admin/organizers?status=PENDING` | `hasRole('SUPER_ADMIN')` | List pending organizer onboarding requests |
| `PATCH` | `/api/v1/super-admin/organizers/{id}/decision` | `hasRole('SUPER_ADMIN')` | Approve / Reject organizer (`@Audited`) |
| `POST` | `/api/v1/super-admin/users/{id}/ban` | `hasRole('SUPER_ADMIN')` | Ban scalper & blacklist active JWTs in Redis (`@Audited`) |
| `GET` | `/api/v1/super-admin/audit-logs` | `hasRole('SUPER_ADMIN')` | Search immutable audit logs |
| `GET` | `/api/v1/super-admin/dlq` | `hasRole('SUPER_ADMIN')` | View failed Kafka DLQ messages |
| `POST` | `/api/v1/super-admin/dlq/{id}/replay` | `hasRole('SUPER_ADMIN')` | Replay a failed DLQ event (`@Audited`) |

---

## 3. Kafka Topic & Event Contracts

All events share a standard envelope in `common-events`:
```json
{
  "eventId": "uuid",
  "eventType": "SEAT_LOCK_EXPIRED",
  "correlationId": "uuid",
  "occurredAt": "2026-11-21T08:00:00Z",
  "payload": {}
}
```

| Topic | Partitions | Partition Key | Producer | Consumer(s) | DLQ Topic |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `event.published` | 3 | `eventId` | `core-service` | `ai-service` (generate Gemini embeddings) | `event.published.dlq` |
| `seat.lock.expired` | 6 | `eventId` | `core-service` | `async-worker-service` (Auto-Waitlist match) | `seat.lock.expired.dlq` |
| `booking.confirmed` | 6 | `bookingId` | `core-service` | `async-worker-service` (QR mint + Email + SSE) | `booking.confirmed.dlq` |
| `resale.completed` | 3 | `listingId` | `core-service` | `async-worker-service` (New QR + Buyer/Seller notify) | `resale.completed.dlq` |
| `waitlist.seat.offered` | 6 | `userId` | `async-worker-service` | `async-worker-service` (SSE push + 5m expiry check) | `waitlist.seat.offered.dlq` |

* **Retry Policy:** 3 exponential backoff retries (`1s`, `5s`, `15s`) via Spring Kafka `@RetryableTopic`, then automatic routing to `<topic>.dlq`.

