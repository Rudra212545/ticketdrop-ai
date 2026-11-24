# TicketDrop AI

> **Next-Gen Flash-Sale Event Ticketing, Smart Auto-Waitlist, Anti-Scalper Resale Escrow & AI Concierge Platform**

TicketDrop AI is a production-grade, distributed Java Full Stack platform built with **Java 21**, **Spring Boot 3 (Maven)**, **Apache Kafka**, **Redis**, **PostgreSQL (`pgvector`)**, **Spring AI (Google Gemini)**, **React + TypeScript** (Web Portals), and an optional **Flutter** mobile app for attendees.

---

## Why TicketDrop AI? (Differentiation)

| Pain Point in Existing Platforms | TicketDrop AI Solution |
| :--- | :--- |
| Flash-sale crashes & seat double-booking | **Redis Virtual Waiting Room** + **Redisson Distributed Locks (10-min TTL)** + **JPA Optimistic Locking (`@Version`)** |
| "Refresh hell" when payment timers expire | **Kafka-driven Smart Auto-Waitlist** (Redis `ZSET`) that instantly locks expired seats for the next matching fan |
| Black-market scalping & fake QR screenshots | **Price-Capped Resale Escrow (Saga)** that atomically invalidates the old QR in Redis/DB and mints a fresh signed QR |
| Rigid search filters & guesswork pricing | **Spring AI (Google Gemini) + `pgvector`** Event Concierge with `@Tool` live seat checks + Organizer Pricing Co-Pilot |

---

## Roles & Client Architecture

| Role | Primary Client | Core Responsibilities |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | React Web | Onboard/approve organizers, set platform fees & global anti-bot limits, ban scalpers, inspect/replay Kafka DLQs, view immutable audit logs |
| **`ADMIN`** *(Organizer)* | React Web | Create events & seat maps, configure resale price caps, trigger flash drops, view live funnel metrics & AI Pricing Co-Pilot |
| **`USER`** *(Attendee)* | React Web + Flutter Mobile *(Phase 6)* | Natural-language AI Event Concierge, flash-sale waiting room, interactive seat picker, QR ticket wallet, one-click resale & auto-waitlist claims |

---

## Tech Stack

* **Backend:** Java 21 (Virtual Threads), Spring Boot 3.4, Maven (Multi-Module), Spring Cloud Gateway, Spring Security 6 (JWT + RBAC), Spring Data JPA, Flyway, Resilience4j, Spring AI (Google Gemini)
* **Data & Messaging:** PostgreSQL 16 + `pgvector`, Redis 7 (Redisson Locks, `ZSET`, `Geo`, Bucket4j, Pub/Sub), Apache Kafka (KRaft mode)
* **Web Frontend:** React 19, TypeScript, Tailwind CSS, TanStack Query, React Router
* **Mobile Frontend *(Phase 6)*:** Flutter (Dart), Riverpod/Bloc, Dio, Offline QR Wallet
* **Observability & QA:** Micrometer, Prometheus, Grafana, OpenTelemetry, JUnit 5, Testcontainers, k6 Load Testing, Docker Compose

---

## Engineering Documentation Index

All architectural and product specifications live in `docs/`:

1. [01-PRD.md](docs/01-PRD.md) — Product Requirements, Role Matrix, Functional & Non-Functional Requirements
2. [02-HLD.md](docs/02-HLD.md) — High-Level Architecture, Microservice Boundaries, AI & Observability Design
3. [03-LLD-DATABASE-AND-REDIS.md](docs/03-LLD-DATABASE-AND-REDIS.md) — PostgreSQL/`pgvector` Schema, State Machines & Redis Key Design
4. [04-API-AND-KAFKA-CONTRACTS.md](docs/04-API-AND-KAFKA-CONTRACTS.md) — REST/SSE API Contracts, RBAC Matrix & Kafka Event Schemas
5. [05-ROADMAP-AND-TESTING.md](docs/05-ROADMAP-AND-TESTING.md) — Vertical-Slice Build Roadmap, Flutter Strategy & k6 Concurrency Testing Plan

---

## Planned Monorepo Structure

```text
ticketdrop-ai/
├── docs/                          # Company-grade PRD, HLD, LLD, Contracts & Roadmap
├── infra/                         # Docker Compose, Prometheus, Grafana, init SQL
├── backend/                       # Maven Multi-Module Project
│   ├── pom.xml                    # Parent POM (Java 21, Spring Boot 3, Spring AI BOM)
│   ├── common-events/             # Shared Kafka event DTOs & correlation headers
│   ├── api-gateway/               # Spring Cloud Gateway, JWT auth filter, Redis rate limiting
│   ├── core-service/              # Auth/RBAC, Events, Seats, Redis Locks, Bookings, Resale Saga
│   ├── async-worker-service/      # Kafka Consumers: Auto-Waitlist, QR Minting, SSE/Email, DLQ
│   └── ai-service/                # Spring AI (Gemini) + pgvector Concierge & Pricing Co-Pilot
├── frontend/                      # React + TypeScript Web App (USER, ADMIN, SUPER_ADMIN)
├── mobile/                        # Flutter App (Phase 6 - USER Attendee App)
└── load-tests/                    # k6 flash-sale concurrency & latency scripts
```

