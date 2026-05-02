# IT Ticketing System — Architecture Document

## Part 01: Introduction & Architectural Overview

### 1.1 Purpose

This document defines the full system architecture for an IT ticketing system built on Node.js (Express), React, PostgreSQL, and Redis. It serves as the authoritative reference for developers, team leads, and stakeholders who need to understand how the system is structured, why key decisions were made, and how data flows through the platform.

The goal is not a perfect architecture — it is an architecture the team can build, maintain, and evolve without a rewrite. Every abstraction here earns its place.

---

### 1.2 Business Domain Summary

The system supports IT service management (ITSM) workflows. Core business capabilities include:

- **Ticket lifecycle management** — creation, assignment, escalation, resolution, and closure of support requests
- **Multi-role access control** — admins configure the system, agents handle tickets, end-users submit and track requests
- **SLA enforcement** — response and resolution deadlines tracked per policy, with automated escalation when breached
- **Knowledge base** — agents and admins publish articles to deflect common tickets
- **Notification delivery** — in-app, email, and webhook notifications triggered by lifecycle events
- **Audit trail** — immutable log of all changes for compliance and debugging
- **Reporting** — aggregated metrics on ticket volume, resolution times, SLA performance, and agent load

---

### 1.3 Architectural Style: Modular Monolith

**Decision**: The system is built as a **modular monolith**, not microservices.

**Rationale**:


| Concern              | Microservices                            | Modular Monolith (Chosen)        |
| -------------------- | ---------------------------------------- | -------------------------------- |
| Team size            | Requires multiple autonomous teams       | Fits 2-8 engineers               |
| Domain clarity       | Requires stable boundaries upfront       | Boundaries can evolve in-process |
| Operational overhead | High (service mesh, distributed tracing) | Low (single deploy unit)         |
| Consistency model    | Distributed transactions (hard)          | Local transactions (easy)        |
| Scalability path     | Independent service scaling              | Vertical + targeted horizontal   |


**Trade-off accepted**: Individual modules cannot be scaled independently. If the notification pipeline becomes a bottleneck, it must be extracted — but that extraction is easier from a well-bounded module than from an unstructured monolith.

**Escape hatch**: The folder structure mirrors microservice boundaries. If a module needs extraction, it already has clear API contracts, its own data access layer, and no cross-module direct DB queries.

---

### 1.4 Technology Stack


| Layer                  | Technology                                 | Rationale                                                                       |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| Backend runtime        | Node.js 20 LTS                             | Non-blocking I/O suits notification-heavy workloads                             |
| Web framework          | Express 4                                  | Minimal, well-understood, vast ecosystem                                        |
| Primary database       | PostgreSQL 16                              | ACID transactions, JSONB columns for metadata, mature row-level security        |
| Cache + message broker | Redis 7                                    | Session store, rate limiting, BullMQ job queue transport                        |
| Job queue              | BullMQ                                     | Redis-backed, supports delayed jobs (SLA timers), retries, dead-letter queues   |
| Database migrations    | node-pg-migrate                            | SQL-first migrations, reversible, version-controlled                            |
| Frontend framework     | React 18                                   | Component model suits complex ticket forms and dynamic dashboards               |
| Frontend build tool    | Vite                                       | Fast HMR, native ESM, tree-shaking out of the box                               |
| UI styling             | Tailwind CSS                               | Utility-first, consistent design system without a heavyweight component library |
| Authentication         | JWT (access) + Redis (refresh token store) | Stateless access tokens, revocable refresh tokens                               |
| File storage           | S3-compatible (MinIO for self-hosted)      | Attachments stored externally, DB holds metadata only                           |
| Email delivery         | Nodemailer + SMTP / SendGrid               | Pluggable transport, queue-backed for reliability                               |


---

### 1.5 Deployment Topology

```
                   +----------------------------------+
                   |         Load Balancer            |
                   +----------------+-----------------+
                                    |
         +--------------------------|---------------------------+
         |                          |                           |
+--------+--------+       +---------+-------+       +----------+------+
|  Express API 1  |       |  Express API 2  |       |  Express API N  |
|  (stateless)    |       |  (stateless)    |       |  (stateless)    |
+--------+--------+       +---------+-------+       +----------+------+
         |                          |                           |
         +--------------------------+---------------------------+
                                    |
               +--------------------+--------------------+
               |                    |                    |
      +--------+----+     +---------+----+     +--------+---------+
      | PostgreSQL  |     |  Redis 7     |     |  S3 / MinIO      |
      | (primary)   |     |  (cache+MQ)  |     |  (attachments)   |
      +--------+----+     +--------------+     +------------------+
               |
      +--------+----+
      | PostgreSQL  |
      | (replica)   |
      | read-only   |
      +-------------+
```

API nodes are stateless. Session state lives in Redis. This allows horizontal scaling without sticky sessions. The BullMQ worker process shares the Redis instance and can be run as a separate process or co-located with the API in development.

---

### 1.6 Architectural Decision Records (Index)


| ADR     | Title                                   | Status   |
| ------- | --------------------------------------- | -------- |
| ADR-001 | Modular monolith over microservices     | Accepted |
| ADR-002 | BullMQ for SLA timers and notifications | Accepted |
| ADR-003 | JWT + Redis refresh token pattern       | Accepted |
| ADR-004 | node-pg-migrate for schema versioning   | Accepted |
| ADR-005 | S3-compatible storage for attachments   | Accepted |


---

### ADR-001: Modular Monolith over Microservices

**Status**: Accepted

**Context**: The team considered a microservices approach to allow independent scaling of ticket processing, notification delivery, and reporting. Domain boundaries are not yet fully stabilized.

**Decision**: Build a modular monolith where each domain (auth, tickets, SLA, notifications, KB, reports) is a self-contained module with its own router, service layer, and repository. No cross-module direct database access. Modules communicate through a shared event bus (in-process EventEmitter in v1, extractable to Redis pub/sub in v2).

**Consequences**:

- Easier: local development, transactional consistency, debugging, deployment
- Harder: independent scaling of hot paths, team autonomy at scale
- Accepted risk: if ticket volume requires dedicated workers, the notification and SLA modules are extraction candidates

---

### ADR-002: BullMQ for SLA Timers and Async Jobs

**Status**: Accepted

**Context**: SLA policies require delayed job execution (e.g., "escalate this ticket if not responded to within 4 hours"). Notification delivery should be non-blocking and retryable.

**Decision**: Use BullMQ with Redis as the transport for all async jobs: SLA timer scheduling, notification dispatch, and report generation. Jobs are typed and versioned.

**Consequences**:

- Easier: delayed jobs, retries with backoff, job visibility via Bull Board UI
- Harder: Redis becomes a hard dependency (mitigated by Redis Sentinel/Cluster for HA)
- Accepted risk: if Redis is unavailable, queued jobs pause — implement health checks and circuit breakers accordingly

---

### 1.7 Quality Attributes and Non-Functional Requirements


| Attribute          | Target                 | Mechanism                                                           |
| ------------------ | ---------------------- | ------------------------------------------------------------------- |
| Availability       | 99.9% uptime           | Stateless API nodes, Redis Sentinel, Postgres streaming replication |
| Response time      | < 300ms p95 for API    | Redis caching for reference data, read replica for reports          |
| SLA accuracy       | +/- 1 minute           | BullMQ delayed jobs, monotonic Redis clock                          |
| Audit completeness | 100% mutation coverage | Middleware-level audit log interceptor                              |
| Security           | OWASP Top 10           | Input validation (Zod), parameterized queries, RBAC, rate limiting  |
| Observability      | Full request tracing   | Correlation IDs, structured JSON logging (Pino), Prometheus metrics |


---

### 1.8 Guiding Principles

1. **Boring technology wins** — Use PostgreSQL features (triggers, row-level security, JSONB) before reaching for a new service.
2. **Boundaries before optimization** — Establish clean module boundaries now; optimize hot paths later with evidence.
3. **Fail loudly in development, gracefully in production** — Strict error handling middleware with environment-aware responses.
4. **Every async operation is a job** — Nothing async runs in the request lifecycle that does not need to.
5. **Schema migrations are code** — All schema changes go through node-pg-migrate, reviewed and versioned.

---

*Next: Part 02 — Entity Relationship Diagram*