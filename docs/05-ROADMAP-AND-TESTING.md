# 05 — Execution Roadmap, Flutter Strategy & Testing Plan

## 1. Vertical-Slice Build Roadmap (Backend + Frontend Together)
Every phase ships a **complete, testable vertical slice** (Spring Boot APIs + React UI screens) so we verify real behavior immediately instead of waiting until the end.

| Phase | Duration | Backend Deliverables (Java 21 / Maven) | Frontend Deliverables (React + TS) | Definition of Done |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0: Foundation** | Days 1–2 | Docker Compose (Postgres `pgvector`, Redis, Kafka KRaft, Kafka UI, MailHog, Prometheus/Grafana), Maven Parent POM, 4 service skeletons, Flyway `V1` | Vite + React + TS + Tailwind + TanStack Query + API client setup | All 4 services boot green, Swagger UI loads, Docker stack healthy |
| **Phase 1: Auth & 3-Role RBAC** | Week 1 | `api-gateway` JWT + Bucket4j; `core-service` Auth, Redis refresh/blacklist, Organizer approval, `@Audited` AOP | Login/Register, role-guarded layouts for `USER`, `ADMIN`, `SUPER_ADMIN` + Organizer Approval & Audit Log pages | `USER` cannot hit `ADMIN` routes; banned user's JWT fails immediately |
| **Phase 2: Events & Flash-Sale Locking** | Week 2 | Event/Tier/Seat-map CRUD, Virtual Waiting Room (Redis), Redisson MultiLock (10m TTL), `@Version` lock, Idempotent Checkout + Mock Payment Webhook, Outbox table | `ADMIN` Event & Seat-Map Builder; `USER` Waiting Room, Interactive SVG Seat Map with live 10m timer & Checkout | 2 tabs trying to lock the same seat -> 1 succeeds, 1 gets `409 Conflict` |
| **Phase 3: Kafka, Auto-Waitlist & Resale** | Week 3 | Outbox Publisher -> Kafka; `async-worker-service` Auto-Waitlist (`ZSET`), QR Minting, SSE notifications, Resale Escrow Saga + QR invalidation, DLQ replay | `USER` QR Ticket Wallet, Auto-Waitlist claim toast, Resale Marketplace; `SUPER_ADMIN` DLQ Replay console | Expired lock auto-offers seat to waiting user within 2s; resold old QR fails scan |
| **Phase 4: Spring AI (Google Gemini)** | Week 4 | `ai-service`: Kafka event embedding -> `pgvector`, Concierge Chat with `@Tool` live seat check, Organizer Pricing Co-Pilot, Resilience4j Circuit Breaker | `USER` AI Concierge drawer; `ADMIN` AI Pricing Co-Pilot panel | AI finds real events with live adjacent seats; graceful fallback when Gemini key disabled |
| **Phase 5: QA, k6 Load Test & Observability** | Week 5 | JUnit 5 + **Testcontainers** (Postgres/Redis/Kafka), Grafana latency dashboards, **k6 flash-sale script** | Polish responsive UI, error states, loading skeletons | k6: 500 concurrent users -> **0 double-bookings**, p95 < 80ms recorded for resume |
| **Phase 6: Flutter Mobile App *(Optional)*** | Week 6 | Zero backend changes needed (already API-first & mobile-ready) | **Flutter (`USER` Attendee App):** Event feed, AI Concierge, Seat Picker, Offline-cached QR Wallet, Live Waitlist alerts | Smooth 60fps Android/iOS demo hitting the same `api-gateway` |

---

## 2. Flutter Mobile App Engineering Notes (Keeping It Fast & Clean)
If we build the Flutter app in **Phase 6**, we will scope it the way real startups (BookMyShow, District, Dice) do:
1. **`USER` Role Only on Mobile:** `ADMIN` and `SUPER_ADMIN` stay on React Web (complex tables, seat-map builders, DLQ replay). Mobile stays laser-focused on fans.
2. **Performance Architecture:**
   * **State Management:** Riverpod (compile-safe, minimal rebuilds).
   * **Networking:** `Dio` with JWT refresh interceptor + `Idempotency-Key` interceptor.
   * **60fps Seat Map:** `CustomPainter` + `InteractiveViewer` (pinch-to-zoom, pan, zero widget-tree lag even with 1,000 seats).
   * **Offline QR Wallet:** Store signed QR payloads in `flutter_secure_storage` / `Hive` so tickets open instantly at crowded venues with zero signal.

---

## 3. Google Gemini API Key Note
* Spring AI connects to **Google Gemini** via an API key from **Google AI Studio** (`aistudio.google.com`)—which has a generous free tier for development (`gemini-2.5-flash` + `text-embedding-004`).
* *(Note: A consumer Google AI Pro subscription is billed separately from Gemini API usage, so we will use a standard Google AI Studio API key via environment variable `GEMINI_API_KEY` and never commit keys to Git.)*

---

## 4. Verification & Resume Metrics Checklist
Before putting TicketDrop AI on your resume, we will verify and capture:
- [ ] **Testcontainers Suite:** Green integration tests against real PostgreSQL, Redis, and Kafka containers.
- [ ] **k6 Flash-Sale Report:** Proof of `0` double-bookings under 500 concurrent virtual users + p95/p99 latency screenshot.
- [ ] **Grafana Dashboard:** Live JVM, HTTP latency, Redis lock contention, and Kafka consumer lag panels.
- [ ] **Architecture Walkthrough:** Clean README with Mermaid diagrams + 3-minute screen-recorded demo across all 3 roles.

