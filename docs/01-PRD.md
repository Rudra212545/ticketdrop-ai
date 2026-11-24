# 01 — Product Requirements Document (PRD)

**Product:** TicketDrop AI  
**Version:** 1.0  
**Owner:** Rudra Parmeshwar  
**Status:** Approved for Phase 0 Implementation

---

## 1. Executive Summary
TicketDrop AI is a multi-role live event ticketing and resale platform engineered for high-concurrency flash sales. Unlike traditional ticketing platforms that struggle with seat double-booking, bot scalping, and manual refresh loops when payment timers expire, TicketDrop AI combines **distributed concurrency control (Redis + Kafka)** with **agentic AI workflows (Spring AI + Google Gemini)** to deliver a fair, resilient, and intelligent fan experience.

---

## 2. Target Personas & 3-Role Access Matrix

### 2.1 `SUPER_ADMIN` (Platform Owner / Trust & Safety)
* **Client:** React Web Dashboard (`/super-admin/*`)
* **Goals:** Maintain platform integrity, onboard verified organizers, stop scalping bots, and ensure zero lost transactions.
* **Key Capabilities:**
  * Approve, suspend, or reject Organizer (`ADMIN`) onboarding applications.
  * Configure global platform convenience fee %, max resale markup ceiling, and per-IP/per-user rate limits.
  * Ban suspected scalper accounts and revoke active JWT sessions immediately via Redis.
  * Inspect **Kafka Dead Letter Queues (DLQ)** and trigger one-click event replays.
  * Browse immutable **Audit Logs** of all privileged actions across the platform.

### 2.2 `ADMIN` (Event Organizer / Venue Host)
* **Client:** React Web Dashboard (`/admin/*`)
* **Goals:** Sell out events smoothly, prevent black-market scalping of their tickets, and optimize ticket pricing.
* **Key Capabilities:**
  * Create and publish events with venue metadata, date/time, and flash-sale drop schedules.
  * Configure multi-tier seat maps (VIP, Gold, Silver, General Admission) with auto-generated row/column seat grids.
  * Enable/disable **Verified Resale** and set a strict **Max Resale Price Cap** (e.g., `110%` of face value).
  * Monitor live sales funnel metrics (active waiting room size, locked vs. booked seats, waitlist demand).
  * Consult the **AI Pricing & Demand Co-Pilot** for tier pricing adjustments, flash-drop timing, and second-show recommendations.
  * Scan/verify attendee QR tickets at venue entry (validates cryptographic signature + Redis revocation list).

### 2.3 `USER` (Attendee / Fan)
* **Client:** React Web App (`/`) + **Flutter Mobile App** *(Phase 6 — Attendee-only, high-performance native client)*
* **Goals:** Discover relevant events quickly, book seats fairly during flash drops, avoid scalpers, and access tickets reliably at the venue.
* **Key Capabilities:**
  * Discover events via the **AI Event Concierge** using natural language (*"Indie concerts or comedy shows this weekend under ₹1,500 in Pune with 3 adjacent seats"*).
  * Enter a **Virtual Waiting Room** for high-demand flash drops with real-time queue position updates.
  * Lock seats on an interactive seat map with a live **10-minute checkout countdown**.
  * Complete idempotent checkout and receive a **cryptographically signed QR ticket** in their wallet.
  * Join the **Smart Auto-Waitlist** with preferences (tier, quantity, max price) and receive an instant 5-minute claim alert if someone's lock expires.
  * List owned tickets on the **Verified Resale Marketplace** (within organizer price cap) or purchase verified resale tickets with guaranteed fresh QR codes.

---

## 3. Functional Requirements (FR)

| ID | Feature | Priority | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| **FR-01** | Role-Based Auth & Multi-Client JWT | P0 | Login/Register returns short-lived Access JWT (15m) + Refresh Token stored in Redis. Logout immediately blacklists `jti`. |
| **FR-02** | Organizer Approval Workflow | P0 | Newly registered Organizers start in `PENDING_APPROVAL` and cannot publish events until approved by `SUPER_ADMIN`. |
| **FR-03** | Interactive Seat Map & Concurrency Lock | P0 | Locking seats acquires a Redisson distributed lock + sets a 10-min TTL. Under 500 concurrent requests for the same seat, **exactly 1 succeeds** and 499 receive `409 Conflict`. |
| **FR-04** | Virtual Waiting Room | P1 | When an event is marked `FLASH_SALE`, users enter a Redis queue and receive a time-bound admission token before accessing the seat map. |
| **FR-05** | Idempotent Booking & Payment | P0 | Checkout requires an `Idempotency-Key` header. Retrying the same request returns the exact prior response without double-charging. |
| **FR-06** | Smart Auto-Waitlist | P0 | When a seat lock expires or payment fails, Kafka triggers auto-allocation to the highest-priority matching user in Redis `ZSET` and pushes a real-time SSE alert. |
| **FR-07** | Price-Capped Resale Escrow (Saga) | P0 | Listing above the organizer's `maxResaleMultiplier` is rejected (`422`). Upon resale purchase, old QR is invalidated in Redis + DB and new QR is minted atomically. |
| **FR-08** | AI Event Concierge (Gemini + `pgvector`) | P1 | Natural-language queries perform semantic vector search + call Java `@Tool` functions to verify real-time seat availability before responding. |
| **FR-09** | AI Organizer Pricing Co-Pilot | P1 | Analyzes event velocity, waitlist count, and historical similar events to output structured JSON pricing/capacity recommendations. |
| **FR-10** | Immutable Audit Logging & DLQ Replay | P1 | Every `SUPER_ADMIN`/`ADMIN` mutation is logged via Spring AOP; failed Kafka messages land in `.dlq` topics replayable by `SUPER_ADMIN`. |

---

## 4. Non-Functional Requirements (NFR)

| Category | Target | Verification Method |
| :--- | :--- | :--- |
| **Concurrency Safety** | **0 double-bookings** under 500 concurrent seat-lock requests | k6 Load Test + Testcontainers |
| **API Latency (Hot Path)** | Seat lock & availability read **p95 < 80ms**, **p99 < 150ms** | Micrometer + Grafana + k6 |
| **AI Resilience** | If Gemini API times out (>5s) or rate-limits, degrade gracefully to PostgreSQL search within 200ms | Resilience4j Circuit Breaker test |
| **Event Delivery** | **Zero lost booking/waitlist events** on DB/broker crash | Transactional Outbox + Kafka DLQ |
| **Security** | Strict OWASP baseline: BCrypt passwords, `@PreAuthorize` ownership checks, Redis rate limiting, signed QR payloads (HMAC-SHA256) | Spring Security Integration Tests |
| **Mobile Readiness** | All `USER` endpoints return compact, paginated JSON; QR tickets cacheable offline for venue entry | OpenAPI Contract + Flutter Phase 6 |

