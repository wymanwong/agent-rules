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

## Part 02: Entity Relationship Diagram

### 2.1 Schema Design Principles

- **UUIDs everywhere** — All primary keys are UUID v4. Avoids sequential ID enumeration attacks and simplifies distributed merges.
- **Soft deletes** — Tickets, users, and KB articles use `deleted_at` timestamps instead of hard DELETE. Audit integrity is preserved.
- **JSONB for extensibility** — Metadata fields on tickets and notifications use JSONB to avoid premature schema churn.
- **Temporal columns** — Every table has `created_at` and `updated_at` managed by triggers.
- **Immutable audit logs** — The `audit_logs` table has no UPDATE or DELETE privileges granted; it is insert-only.

---

### 2.2 Entity Definitions

#### users

```
users
  id:              UUID PK
  email:           VARCHAR(255) UNIQUE NOT NULL
  password_hash:   VARCHAR NOT NULL
  full_name:       VARCHAR(255) NOT NULL
  avatar_url:      VARCHAR
  role_id:         UUID FK -> roles.id
  is_active:       BOOLEAN DEFAULT true
  last_login_at:   TIMESTAMPTZ
  created_at:      TIMESTAMPTZ
  updated_at:      TIMESTAMPTZ
  deleted_at:      TIMESTAMPTZ
```

#### roles

```
roles
  id:          UUID PK
  name:        VARCHAR(50) UNIQUE NOT NULL   -- 'admin' | 'agent' | 'end_user'
  description: TEXT
  created_at:  TIMESTAMPTZ
  updated_at:  TIMESTAMPTZ
```

#### teams

```
teams
  id:          UUID PK
  name:        VARCHAR(255) UNIQUE NOT NULL
  description: TEXT
  lead_id:     UUID FK -> users.id
  created_at:  TIMESTAMPTZ
  updated_at:  TIMESTAMPTZ

team_members
  team_id:    UUID FK -> teams.id
  user_id:    UUID FK -> users.id
  PRIMARY KEY (team_id, user_id)
  joined_at:  TIMESTAMPTZ
```

#### sla_policies

```
sla_policies
  id:                      UUID PK
  name:                    VARCHAR(255) NOT NULL
  description:             TEXT
  priority:                ENUM('low','medium','high','critical')
  response_time_minutes:   INTEGER NOT NULL
  resolution_time_minutes: INTEGER NOT NULL
  business_hours_only:     BOOLEAN DEFAULT false
  escalation_user_id:      UUID FK -> users.id
  escalation_team_id:      UUID FK -> teams.id
  is_default:              BOOLEAN DEFAULT false
  created_at:              TIMESTAMPTZ
  updated_at:              TIMESTAMPTZ
```

#### tickets

```
tickets
  id:                      UUID PK
  ticket_number:           SERIAL UNIQUE         -- human-readable TKT-00042
  title:                   VARCHAR(500) NOT NULL
  description:             TEXT NOT NULL
  status:                  ENUM('open','in_progress','pending','resolved','closed')
  priority:                ENUM('low','medium','high','critical')
  category:                VARCHAR(100)
  tags:                    TEXT[]
  metadata:                JSONB DEFAULT '{}'
  requester_id:            UUID FK -> users.id NOT NULL
  assignee_id:             UUID FK -> users.id
  team_id:                 UUID FK -> teams.id
  sla_policy_id:           UUID FK -> sla_policies.id
  sla_response_due_at:     TIMESTAMPTZ
  sla_resolution_due_at:   TIMESTAMPTZ
  sla_response_breached:   BOOLEAN DEFAULT false
  sla_resolution_breached: BOOLEAN DEFAULT false
  first_response_at:       TIMESTAMPTZ
  resolved_at:             TIMESTAMPTZ
  closed_at:               TIMESTAMPTZ
  created_at:              TIMESTAMPTZ
  updated_at:              TIMESTAMPTZ
  deleted_at:              TIMESTAMPTZ
```

#### comments

```
comments
  id:          UUID PK
  ticket_id:   UUID FK -> tickets.id NOT NULL
  author_id:   UUID FK -> users.id NOT NULL
  body:        TEXT NOT NULL
  is_internal: BOOLEAN DEFAULT false    -- internal notes not visible to end-users
  is_solution: BOOLEAN DEFAULT false    -- marks comment as resolution note
  created_at:  TIMESTAMPTZ
  updated_at:  TIMESTAMPTZ
  deleted_at:  TIMESTAMPTZ
```

#### attachments

```
attachments
  id:             UUID PK
  ticket_id:      UUID FK -> tickets.id
  comment_id:     UUID FK -> comments.id   -- nullable; attachment on ticket OR comment
  uploader_id:    UUID FK -> users.id NOT NULL
  filename:       VARCHAR(500) NOT NULL
  mime_type:      VARCHAR(100) NOT NULL
  size_bytes:     BIGINT NOT NULL
  storage_key:    VARCHAR(1000) NOT NULL   -- S3 object key
  storage_bucket: VARCHAR(255) NOT NULL
  created_at:     TIMESTAMPTZ
```

#### sla_escalation_events

```
sla_escalation_events
  id:                    UUID PK
  ticket_id:             UUID FK -> tickets.id NOT NULL
  policy_id:             UUID FK -> sla_policies.id NOT NULL
  escalation_type:       ENUM('response_warning','response_breach','resolution_warning','resolution_breach')
  escalated_to_user_id:  UUID FK -> users.id
  escalated_to_team_id:  UUID FK -> teams.id
  triggered_at:          TIMESTAMPTZ NOT NULL
  acknowledged_at:       TIMESTAMPTZ
  job_id:                VARCHAR(255)    -- BullMQ job reference
```

#### kb_articles

```
kb_articles
  id:               UUID PK
  title:            VARCHAR(500) NOT NULL
  slug:             VARCHAR(500) UNIQUE NOT NULL
  body:             TEXT NOT NULL               -- Markdown
  author_id:        UUID FK -> users.id NOT NULL
  category:         VARCHAR(100)
  tags:             TEXT[]
  status:           ENUM('draft','published','archived')
  view_count:       INTEGER DEFAULT 0
  helpful_count:    INTEGER DEFAULT 0
  not_helpful_count: INTEGER DEFAULT 0
  published_at:     TIMESTAMPTZ
  created_at:       TIMESTAMPTZ
  updated_at:       TIMESTAMPTZ
  deleted_at:       TIMESTAMPTZ

kb_article_ticket_links
  article_id:  UUID FK -> kb_articles.id
  ticket_id:   UUID FK -> tickets.id
  linked_by_id: UUID FK -> users.id
  linked_at:   TIMESTAMPTZ
  PRIMARY KEY (article_id, ticket_id)
```

#### audit_logs

```
audit_logs
  id:          UUID PK
  entity_type: VARCHAR(100) NOT NULL    -- 'ticket' | 'user' | 'kb_article' | ...
  entity_id:   UUID NOT NULL
  action:      VARCHAR(100) NOT NULL    -- 'created' | 'updated' | 'status_changed' | ...
  actor_id:    UUID FK -> users.id
  actor_ip:    INET
  changes:     JSONB                    -- {field: {from: x, to: y}}
  metadata:    JSONB DEFAULT '{}'
  created_at:  TIMESTAMPTZ NOT NULL
```

#### notifications

```
notifications
  id:               UUID PK
  recipient_id:     UUID FK -> users.id NOT NULL
  type:             VARCHAR(100) NOT NULL   -- 'ticket_assigned' | 'sla_breach' | ...
  channel:          ENUM('in_app','email','webhook')
  title:            VARCHAR(500)
  body:             TEXT
  payload:          JSONB                   -- full context for template rendering
  reference_type:   VARCHAR(100)            -- 'ticket' | 'kb_article'
  reference_id:     UUID
  is_read:          BOOLEAN DEFAULT false
  read_at:          TIMESTAMPTZ
  sent_at:          TIMESTAMPTZ
  failed_at:        TIMESTAMPTZ
  failure_reason:   TEXT
  created_at:       TIMESTAMPTZ

notification_preferences
  user_id:          UUID FK -> users.id     PK
  event_type:       VARCHAR(100)            PK
  in_app_enabled:   BOOLEAN DEFAULT true
  email_enabled:    BOOLEAN DEFAULT true
  webhook_enabled:  BOOLEAN DEFAULT false
  updated_at:       TIMESTAMPTZ
```

---

### 2.3 Key Relationships Summary


| Relationship                     | Cardinality | Notes                                   |
| -------------------------------- | ----------- | --------------------------------------- |
| users -> roles                   | N:1         | Each user has exactly one role          |
| tickets -> users (requester)     | N:1         | Who submitted the ticket                |
| tickets -> users (assignee)      | N:1         | Nullable; assigned agent                |
| tickets -> teams                 | N:1         | Nullable; team-level assignment         |
| tickets -> sla_policies          | N:1         | SLA applied at creation time            |
| comments -> tickets              | N:1         | Thread of activity on a ticket          |
| attachments -> tickets/comments  | N:1         | Polymorphic via nullable FKs            |
| kb_articles <-> tickets          | M:N         | Via kb_article_ticket_links             |
| notifications -> users           | N:1         | Per-recipient delivery record           |
| audit_logs -> entity             | N:1         | Polymorphic via entity_type + entity_id |
| sla_escalation_events -> tickets | N:1         | One or more events per ticket           |


---

### 2.4 Performance Indexes

```sql
-- Ticket lookup hot paths
CREATE INDEX idx_tickets_requester ON tickets(requester_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_tickets_assignee ON tickets(assignee_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_tickets_status ON tickets(status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_tickets_sla_due ON tickets(sla_resolution_due_at)
  WHERE status NOT IN ('resolved','closed');

CREATE INDEX idx_tickets_team ON tickets(team_id)
  WHERE deleted_at IS NULL;

-- Composite for common list queries
CREATE INDEX idx_tickets_status_priority ON tickets(status, priority)
  WHERE deleted_at IS NULL;

-- Audit log queries by entity
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- Notification inbox — most critical for UI load
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);

-- KB full-text search
CREATE INDEX idx_kb_fts ON kb_articles
  USING GIN(to_tsvector('english', title || ' ' || body))
  WHERE deleted_at IS NULL AND status = 'published';

-- SLA escalation lookup
CREATE INDEX idx_sla_events_ticket ON sla_escalation_events(ticket_id, triggered_at DESC);

-- Comment thread
CREATE INDEX idx_comments_ticket ON comments(ticket_id, created_at ASC)
  WHERE deleted_at IS NULL;
```

---

### 2.5 Triggers

```sql
-- Auto-update updated_at on every mutation
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to: users, tickets, comments, sla_policies, kb_articles
CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

### 2.6 Schema Migration Strategy (node-pg-migrate)

All schema changes are expressed as numbered migration files:

```
migrations/
  1700000001_create_roles.js
  1700000002_create_users.js
  1700000003_create_teams.js
  1700000004_create_sla_policies.js
  1700000005_create_tickets.js
  1700000006_create_comments.js
  1700000007_create_attachments.js
  1700000008_create_kb_articles.js
  1700000009_create_audit_logs.js
  1700000010_create_notifications.js
  1700000011_create_indexes.js
  1700000012_create_triggers.js
  1700000013_seed_default_roles.js
```

**ADR-004: node-pg-migrate over Prisma/Flyway**

**Status**: Accepted

**Context**: The team evaluated Knex migrations, Flyway, and Prisma Migrate. The requirement was SQL-first (no ORM abstraction over schema), reversible migrations, and no external JVM dependency.

**Decision**: node-pg-migrate. Each migration file exports `up` and `down` functions wrapping raw SQL. CI runs `migrate up` before tests; production deployments run migrations before the new image receives traffic.

**Rule enforced in code review**: Every migration MUST implement a `down` function. Pull requests without reversible migrations are rejected.

**Consequences**:

- Easier: direct SQL control, transparent migration history, no magic schema inference
- Harder: no automatic rollback on deploy failure — `down` must be explicitly authored
- Accepted risk: production `down` migrations require careful testing — run in a staging environment first

---

*Next: Part 03 — API Route Map*

## Part 03: API Route Map

### 3.1 API Design Conventions

**Base path**: `/api/v1`

**Authentication**: Bearer JWT in `Authorization` header for all protected routes.

**Response envelope** (success):

```json
{
  "success": true,
  "data": { },
  "meta": { "page": 1, "total": 42, "per_page": 20 }
}
```

**Response envelope** (error):

```json
{
  "success": false,
  "error": {
    "code": "TICKET_NOT_FOUND",
    "message": "Ticket not found",
    "details": {}
  }
}
```

**Pagination strategy**:

- Cursor-based for large, append-heavy sets: tickets, audit logs, notifications
- Offset-based for small bounded sets: KB articles (up to a few hundred), SLA policies

**Validation**: Zod schemas at the route level. Validation errors return HTTP 400 with field-level messages in `error.details`.

**Rate limiting**: Redis-backed sliding window, enforced per authenticated user. Unauthenticated routes use IP-based limits.

**Idempotency**: Mutation routes (POST, PATCH, DELETE) accept an optional `Idempotency-Key` header. Responses are cached in Redis for 24 hours keyed to the value.

---

### 3.2 Auth Routes — `/api/v1/auth`


| Method | Path                      | Auth          | Description                                       |
| ------ | ------------------------- | ------------- | ------------------------------------------------- |
| POST   | `/auth/register`          | Public        | Create account (end-user self-registration)       |
| POST   | `/auth/login`             | Public        | Email + password; returns access + refresh tokens |
| POST   | `/auth/refresh`           | Refresh token | Issue new access token via token rotation         |
| POST   | `/auth/logout`            | Required      | Revoke refresh token from Redis                   |
| POST   | `/auth/forgot-password`   | Public        | Send password reset email                         |
| POST   | `/auth/reset-password`    | Reset token   | Validate token, set new password                  |
| GET    | `/auth/me`                | Required      | Return current user profile with role             |
| PATCH  | `/auth/me`                | Required      | Update profile (name, avatar)                     |
| PATCH  | `/auth/me/password`       | Required      | Change password (requires current password)       |
| GET    | `/auth/sessions`          | Required      | List active sessions (refresh tokens)             |
| DELETE | `/auth/sessions/:tokenId` | Required      | Revoke a specific session                         |


**ADR-003: JWT + Redis Refresh Token Pattern**

**Status**: Accepted

**Context**: Pure JWT (access tokens only) cannot be revoked without a global blocklist. Long-lived tokens are a security risk. Short-lived tokens without refresh require frequent re-login.

**Decision**: Access tokens are signed JWTs valid for 15 minutes. Refresh tokens are opaque UUIDs stored in Redis as `refresh:{userId}:{tokenId}` with a 7-day TTL. On logout or password change, the Redis key is deleted. On each refresh call, the old token is rotated — deleted and replaced with a new one — reducing the replay window to the network round-trip.

**Consequences**:

- Easier: instant session revocation, token rotation limits replay attacks
- Harder: Redis is now in the critical auth path; mitigated by Redis Sentinel
- Accepted: access tokens are not revocable within their 15-minute window after logout

---

### 3.3 Ticket Routes — `/api/v1/tickets`


| Method | Path                            | Auth     | Role           | Description                                     |
| ------ | ------------------------------- | -------- | -------------- | ----------------------------------------------- |
| GET    | `/tickets`                      | Required | All            | List tickets; end-users see own only            |
| POST   | `/tickets`                      | Required | All            | Create new ticket                               |
| GET    | `/tickets/:id`                  | Required | All            | Ticket detail with comments, attachments, SLA   |
| PATCH  | `/tickets/:id`                  | Required | Agent/Admin    | Update ticket fields                            |
| DELETE | `/tickets/:id`                  | Required | Admin          | Soft-delete ticket                              |
| POST   | `/tickets/:id/assign`           | Required | Agent/Admin    | Assign to agent or team                         |
| POST   | `/tickets/:id/escalate`         | Required | Agent/Admin    | Manual escalation                               |
| POST   | `/tickets/:id/resolve`          | Required | Agent/Admin    | Mark resolved (sets resolved_at)                |
| POST   | `/tickets/:id/close`            | Required | All            | Close ticket                                    |
| POST   | `/tickets/:id/reopen`           | Required | All            | Reopen; recalculates SLA                        |
| GET    | `/tickets/:id/history`          | Required | Agent/Admin    | Full audit trail for this ticket                |
| GET    | `/tickets/:id/sla`              | Required | Agent/Admin    | SLA status, due times, breach flags             |
| POST   | `/tickets/:id/link-article`     | Required | Agent/Admin    | Link a KB article to this ticket                |
| GET    | `/tickets/:id/comments`         | Required | All            | List comments (internal filtered for end-users) |
| POST   | `/tickets/:id/comments`         | Required | All            | Add public comment or internal note             |
| PATCH  | `/tickets/:id/comments/:cid`    | Required | Author/Admin   | Edit comment (time-window enforced)             |
| DELETE | `/tickets/:id/comments/:cid`    | Required | Author/Admin   | Soft-delete comment                             |
| GET    | `/tickets/:id/attachments`      | Required | All            | List attachments                                |
| POST   | `/tickets/:id/attachments`      | Required | All            | Upload file (multipart/form-data, 20MB max)     |
| DELETE | `/tickets/:id/attachments/:aid` | Required | Uploader/Admin | Delete attachment                               |


**Query Parameters for `GET /tickets`**:

```
status=open,in_progress         -- comma-separated ENUM values
priority=high,critical
assignee_id=uuid
team_id=uuid
requester_id=uuid               -- admin/agent only; end-users always filtered to self
category=network
tags=vpn,printer                -- any-match
q=search term                   -- full-text search (PostgreSQL tsvector)
sort=created_at:desc            -- field:direction
cursor=opaque_cursor_string     -- cursor pagination
per_page=20                     -- max 100
date_from=2025-01-01
date_to=2025-12-31
```

---

### 3.4 User & Team Routes

#### `/api/v1/users`


| Method | Path                 | Auth     | Role        | Description                                       |
| ------ | -------------------- | -------- | ----------- | ------------------------------------------------- |
| GET    | `/users`             | Required | Admin       | List users (paginated, filterable by role/status) |
| POST   | `/users`             | Required | Admin       | Create user account (admin-provisioned)           |
| GET    | `/users/:id`         | Required | Admin/Agent | User profile (agents see limited fields)          |
| PATCH  | `/users/:id`         | Required | Admin       | Update user (role, is_active)                     |
| DELETE | `/users/:id`         | Required | Admin       | Soft-delete user                                  |
| GET    | `/users/:id/tickets` | Required | Admin/Agent | All tickets for a user                            |


#### `/api/v1/teams`


| Method | Path                      | Auth     | Role        | Description                              |
| ------ | ------------------------- | -------- | ----------- | ---------------------------------------- |
| GET    | `/teams`                  | Required | Agent/Admin | List teams                               |
| POST   | `/teams`                  | Required | Admin       | Create team                              |
| GET    | `/teams/:id`              | Required | Agent/Admin | Team detail with member list             |
| PATCH  | `/teams/:id`              | Required | Admin       | Update team (name, lead, description)    |
| DELETE | `/teams/:id`              | Required | Admin       | Delete team (requires no active tickets) |
| GET    | `/teams/:id/members`      | Required | Agent/Admin | List team members                        |
| POST   | `/teams/:id/members`      | Required | Admin       | Add user to team                         |
| DELETE | `/teams/:id/members/:uid` | Required | Admin       | Remove user from team                    |


---

### 3.5 SLA Routes — `/api/v1/sla`


| Method | Path                  | Auth     | Role  | Description                                              |
| ------ | --------------------- | -------- | ----- | -------------------------------------------------------- |
| GET    | `/sla/policies`       | Required | Admin | List all SLA policies                                    |
| POST   | `/sla/policies`       | Required | Admin | Create SLA policy                                        |
| GET    | `/sla/policies/:id`   | Required | Admin | Policy detail                                            |
| PATCH  | `/sla/policies/:id`   | Required | Admin | Update policy (triggers recalculation on active tickets) |
| DELETE | `/sla/policies/:id`   | Required | Admin | Delete policy (blocked if active tickets use it)         |
| GET    | `/sla/breaches`       | Required | Admin | All breach events (filterable by date, ticket, type)     |
| GET    | `/sla/report`         | Required | Admin | Compliance metrics: breach rate, MTTR by priority        |
| POST   | `/sla/business-hours` | Required | Admin | Configure business hours schedule                        |
| GET    | `/sla/business-hours` | Required | Admin | Get current business hours configuration                 |


**Note on policy updates**: When a policy's time windows are changed, the system re-evaluates all open tickets assigned to that policy and reschedules BullMQ jobs accordingly. This is done asynchronously via the SLA queue to avoid blocking the HTTP response.

---

### 3.6 Knowledge Base Routes — `/api/v1/kb`


| Method | Path                        | Auth     | Role        | Description                                           |
| ------ | --------------------------- | -------- | ----------- | ----------------------------------------------------- |
| GET    | `/kb/articles`              | Optional | All         | List published articles (filterable by category, tag) |
| GET    | `/kb/articles/:slug`        | Optional | All         | Read article (increments view_count asynchronously)   |
| GET    | `/kb/search`                | Optional | All         | Full-text search via PostgreSQL GIN index             |
| POST   | `/kb/articles`              | Required | Agent/Admin | Create draft article                                  |
| GET    | `/kb/articles/:id/draft`    | Required | Agent/Admin | Read own draft                                        |
| PATCH  | `/kb/articles/:id`          | Required | Agent/Admin | Update article                                        |
| POST   | `/kb/articles/:id/publish`  | Required | Admin       | Publish article (sets published_at)                   |
| POST   | `/kb/articles/:id/archive`  | Required | Admin       | Archive article                                       |
| DELETE | `/kb/articles/:id`          | Required | Admin       | Soft-delete article                                   |
| POST   | `/kb/articles/:id/feedback` | Required | All         | Submit helpful/not-helpful vote                       |
| GET    | `/kb/categories`            | Optional | All         | List all categories with article counts               |


---

### 3.7 Notification Routes — `/api/v1/notifications`


| Method | Path                          | Auth     | Role | Description                                     |
| ------ | ----------------------------- | -------- | ---- | ----------------------------------------------- |
| GET    | `/notifications`              | Required | All  | List notifications for current user (paginated) |
| GET    | `/notifications/unread-count` | Required | All  | Quick count for notification bell               |
| PATCH  | `/notifications/:id/read`     | Required | All  | Mark single notification read                   |
| POST   | `/notifications/read-all`     | Required | All  | Mark all as read                                |
| DELETE | `/notifications/:id`          | Required | All  | Delete notification                             |
| GET    | `/notifications/preferences`  | Required | All  | Get per-event channel preferences               |
| PATCH  | `/notifications/preferences`  | Required | All  | Update preferences                              |
| GET    | `/notifications/stream`       | Required | All  | Server-Sent Events stream for real-time updates |


**Note on SSE**: The `/notifications/stream` endpoint establishes a persistent SSE connection. The server pushes events on new notification inserts using PostgreSQL LISTEN/NOTIFY piped through the Express SSE handler. This avoids polling overhead for the UI. Clients reconnect automatically on disconnect.

---

### 3.8 Reports Routes — `/api/v1/reports`


| Method | Path                      | Auth     | Role  | Description                                               |
| ------ | ------------------------- | -------- | ----- | --------------------------------------------------------- |
| GET    | `/reports/overview`       | Required | Admin | Ticket counts by status, priority, category               |
| GET    | `/reports/agents`         | Required | Admin | Per-agent: ticket volume, avg resolution time, open count |
| GET    | `/reports/sla`            | Required | Admin | Breach count, compliance rate, MTTR by priority           |
| GET    | `/reports/trends`         | Required | Admin | Ticket volume time-series (daily/weekly/monthly)          |
| GET    | `/reports/kb`             | Required | Admin | Article views, helpfulness rates, top articles            |
| POST   | `/reports/export`         | Required | Admin | Queue async CSV export job; returns jobId                 |
| GET    | `/reports/exports/:jobId` | Required | Admin | Poll job status; returns downloadUrl on completion        |


All report endpoints accept `date_from` and `date_to` query parameters. Report queries run against the PostgreSQL read replica to avoid contention with write operations.

---

### 3.9 System Routes


| Method | Path             | Auth     | Description                                            |
| ------ | ---------------- | -------- | ------------------------------------------------------ |
| GET    | `/health`        | Public   | Liveness: returns `{ status: "ok", uptime: 1234 }`     |
| GET    | `/health/ready`  | Public   | Readiness: tests DB + Redis connectivity               |
| GET    | `/metrics`       | Internal | Prometheus metrics (scrape endpoint, not public)       |
| POST   | `/webhooks/test` | Admin    | Send a test payload to the configured webhook endpoint |


---

*Next: Part 04 — Module and Folder Structure*

## Part 04: Module and Folder Structure

### 4.1 Design Philosophy

The backend uses a **domain-module pattern**. Each business domain is a self-contained folder with its own router, service, repository, validators, and types. The rule is strict: no module may import another module's repository. Cross-domain data access goes through service interfaces only.

This is the architectural seam that makes future extraction to microservices tractable. If the `sla` module needs to become its own service, every dependency is already expressed through service method signatures — no hidden SQL queries crossing boundaries.

---

### 4.2 Backend Folder Structure

```
backend/
  src/
    app.ts                     # Express app factory
    server.ts                  # HTTP server entry point (binds port)
    worker.ts                  # BullMQ worker entry point (separate process)

    config/
      index.ts                 # Env var loader, validated with Zod
      database.ts              # pg.Pool factory (primary + read replica)
      redis.ts                 # ioredis client factory
      storage.ts               # @aws-sdk/client-s3 factory

    middleware/
      authenticate.ts          # Verify JWT, attach req.user
      authorize.ts             # Role guard factory: authorize('admin','agent')
      audit.ts                 # Intercepts POST/PATCH/DELETE, writes audit_logs
      rateLimiter.ts           # Redis sliding-window rate limiter
      errorHandler.ts          # Global Express error handler
      correlationId.ts         # X-Correlation-ID injection
      validate.ts              # Zod schema validation middleware factory

    shared/
      db/
        query.ts               # Typed pg wrapper with correlation logging
        transaction.ts         # BEGIN/COMMIT/ROLLBACK helper
      events/
        eventBus.ts            # Typed in-process EventEmitter
        eventTypes.ts          # All domain event type constants and payloads
      queue/
        queues.ts              # BullMQ Queue instances: sla, notifications, reports
        jobTypes.ts            # Typed job payload interfaces per queue
      logger.ts                # Pino logger (JSON output, correlation ID context)
      errors.ts                # AppError, NotFoundError, ForbiddenError, etc.
      pagination.ts            # Cursor encode/decode, offset helpers
      storage.ts               # S3 PutObject, GetSignedUrl, DeleteObject wrappers

    modules/
      auth/
        auth.router.ts
        auth.service.ts        # Login, register, password reset lifecycle
        auth.repository.ts     # User credential lookups
        auth.validators.ts     # LoginDto, RegisterDto, ResetPasswordDto (Zod)
        auth.types.ts
        token.service.ts       # JWT sign/verify, Redis refresh token rotation

      users/
        users.router.ts
        users.service.ts
        users.repository.ts
        users.validators.ts
        users.types.ts

      teams/
        teams.router.ts
        teams.service.ts
        teams.repository.ts
        teams.validators.ts
        teams.types.ts

      tickets/
        tickets.router.ts
        tickets.service.ts     # Orchestrates ticket CRUD + event emission
        tickets.repository.ts  # All DB queries for tickets table
        tickets.validators.ts  # CreateTicketDto, UpdateTicketDto, etc.
        tickets.types.ts
        comments.service.ts
        comments.repository.ts
        attachments.service.ts # S3 upload + attachment metadata
        attachments.repository.ts

      sla/
        sla.router.ts
        sla.service.ts         # Policy application, breach detection logic
        sla.repository.ts
        sla.validators.ts
        sla.types.ts
        sla.scheduler.ts       # BullMQ job scheduling for SLA timers
        sla.processor.ts       # BullMQ worker: evaluate and escalate
        businessHours.ts       # Business-hours deadline calculator

      notifications/
        notifications.router.ts
        notifications.service.ts    # Fan-out to channels per preferences
        notifications.repository.ts
        notifications.validators.ts
        notifications.types.ts
        notifications.processor.ts  # BullMQ worker: per-channel dispatch
        notifications.sse.ts        # SSE connection manager
        channels/
          email.channel.ts          # Nodemailer adapter
          inApp.channel.ts          # PostgreSQL insert + pg NOTIFY
          webhook.channel.ts        # HTTPS POST + HMAC-SHA256

      kb/
        kb.router.ts
        kb.service.ts
        kb.repository.ts       # Full-text search via GIN index
        kb.validators.ts
        kb.types.ts

      reports/
        reports.router.ts
        reports.service.ts
        reports.repository.ts  # Queries against read replica pool
        reports.validators.ts
        reports.types.ts
        reports.processor.ts   # BullMQ worker: CSV export to S3

      audit/
        audit.repository.ts    # Insert-only; no update or delete methods
        audit.types.ts

    jobs/
      index.ts                 # Registers all processors on worker startup

  migrations/
    1700000001_create_roles.js
    1700000002_create_users.js
    1700000003_create_teams.js
    1700000004_create_sla_policies.js
    1700000005_create_tickets.js
    1700000006_create_comments.js
    1700000007_create_attachments.js
    1700000008_create_kb_articles.js
    1700000009_create_audit_logs.js
    1700000010_create_notifications.js
    1700000011_create_indexes.js
    1700000012_create_triggers.js
    1700000013_seed_default_roles.js

  tests/
    unit/                      # Per-module tests; DB layer mocked with jest.mock
    integration/               # Per-module tests against a test database
    e2e/                       # Full request/response cycles via Supertest

  .env.example
  package.json
  tsconfig.json
  jest.config.ts
  docker-compose.dev.yml
```

---

### 4.3 Module Internal Contract

**The rule**: each module owns its own data. No module reaches into another module's table via its repository.

```
HTTP Request
     |
     v
  Router          (input parsing, calls service)
     |
     v
  Service         (business logic, invariant enforcement, event emission)
     |
     v
  Repository      (SQL queries only; no business logic)
     |
     v
  PostgreSQL
```

Cross-module communication is explicit:

```typescript
// ALLOWED: tickets.service.ts calls sla.service.ts
import { SlaService } from '../sla/sla.service';

async createTicket(dto: CreateTicketDto, actor: User): Promise<Ticket> {
  const ticket = await this.repo.insert(dto);
  await this.slaService.applyPolicy(ticket);   // <-- service-to-service
  this.eventBus.emit('ticket.created', ticket);
  return ticket;
}

// FORBIDDEN: tickets.repository.ts importing sla.repository.ts
// import { SlaRepository } from '../sla/sla.repository'; // never
```

---

### 4.4 Frontend Folder Structure

React 18 SPA built with Vite. Server state managed by TanStack Query (React Query). Client UI state managed by Zustand. Routing by React Router v6.

```
frontend/
  src/
    main.tsx                   # React entry point; mounts App
    App.tsx                    # QueryClientProvider, router, auth context

    api/
      client.ts                # Axios instance; request/response interceptors
                               # (auth header injection, 401 -> token refresh)
      auth.api.ts
      tickets.api.ts
      users.api.ts
      teams.api.ts
      sla.api.ts
      kb.api.ts
      notifications.api.ts
      reports.api.ts

    hooks/
      useAuth.ts               # Read/write auth store; expose login/logout
      useTickets.ts            # useQuery + useMutation wrappers for tickets
      useNotifications.ts      # useQuery + SSE subscription
      useSla.ts
      useKb.ts
      useReports.ts
      usePagination.ts         # Cursor/offset pagination state

    stores/
      auth.store.ts            # Zustand: user session, access token, expiry
      ui.store.ts              # Zustand: sidebar, active filters, modal state

    pages/
      auth/
        LoginPage.tsx
        RegisterPage.tsx
        ForgotPasswordPage.tsx
        ResetPasswordPage.tsx

      tickets/
        TicketListPage.tsx
        TicketDetailPage.tsx
        CreateTicketPage.tsx

      admin/
        AdminDashboardPage.tsx
        UsersPage.tsx
        TeamsPage.tsx
        SlaConfigPage.tsx
        ReportsPage.tsx

      kb/
        KbHomePage.tsx
        KbArticlePage.tsx
        KbEditorPage.tsx        # Markdown editor for agents/admins

      notifications/
        NotificationsPage.tsx

    components/
      layout/
        AppShell.tsx            # Sidebar + topbar shell
        Sidebar.tsx
        Topbar.tsx
        PageHeader.tsx

      tickets/
        TicketCard.tsx
        TicketTable.tsx
        TicketFilters.tsx
        TicketStatusBadge.tsx
        TicketPriorityBadge.tsx
        SlaCountdown.tsx        # Live countdown to SLA breach
        CommentThread.tsx
        CommentEditor.tsx       # Rich text / markdown input
        AttachmentList.tsx
        AttachmentUpload.tsx    # Drag-and-drop; shows upload progress

      notifications/
        NotificationBell.tsx    # Unread count badge
        NotificationDropdown.tsx
        NotificationItem.tsx

      kb/
        ArticleCard.tsx
        ArticleSearchBar.tsx
        ArticleViewer.tsx       # Renders Markdown safely
        ArticleEditor.tsx       # Wraps react-md-editor

      reports/
        MetricCard.tsx
        TicketVolumeChart.tsx   # Recharts line/bar chart
        SlaComplianceGauge.tsx
        AgentWorkloadTable.tsx

      ui/                       # Headless / Tailwind primitive components
        Button.tsx
        Input.tsx
        Select.tsx
        Textarea.tsx
        Modal.tsx
        Toast.tsx               # react-hot-toast integration
        Table.tsx
        Pagination.tsx
        Spinner.tsx
        Avatar.tsx
        Badge.tsx
        Tooltip.tsx
        ConfirmDialog.tsx

    lib/
      queryClient.ts            # TanStack Query: staleTime, retries, error boundary
      axiosErrorNormalizer.ts   # Maps API error codes to user-facing messages
      formatters.ts             # Date, duration, file size, ticket number
      cn.ts                     # clsx + tailwind-merge utility

    types/
      api.types.ts              # ResponseEnvelope<T>, PaginatedResponse<T>
      ticket.types.ts
      user.types.ts
      team.types.ts
      sla.types.ts
      kb.types.ts
      notification.types.ts
      report.types.ts

    constants/
      routes.ts                 # Typed path constants (avoids string literals)
      permissions.ts            # Role -> capability lookup (mirrors backend RBAC)
      ticketStatus.ts           # Status labels and colors
      priority.ts               # Priority labels and colors

  public/
    favicon.svg
  index.html
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  package.json
```

---

### 4.5 Technology Decisions — Frontend Stack

**Vite over CRA / Webpack**

Vite uses native ES modules in development: no bundling step, sub-second HMR. CRA is deprecated as of React 18. A custom Webpack config incurs ongoing maintenance. Vite's Rollup-based production build applies the same tree-shaking and code-splitting needed for the reports dashboard.

**Trade-off**: CommonJS packages that rely on `require()` side-effects may behave differently under Rollup. Use `vite.optimizeDeps.include` for known problem packages.

**TanStack Query over Redux for server state**

Tickets, users, KB articles, and notifications are server state. TanStack Query handles fetching, caching, background revalidation, and optimistic updates. Redux Toolkit would replicate these features with more boilerplate and manual invalidation logic.

Zustand handles the small amount of true client state (sidebar open/closed, active modal, filter chips) where server synchronization is not needed.

**Trade-off**: TanStack Query's cache is global. Mutations must explicitly call `invalidateQueries` or return `updatedData` for optimistic updates. Teams must understand `staleTime` (how long cached data is considered fresh) versus `cacheTime` (how long inactive data stays in memory).

**Tailwind CSS over a component library**

A utility-first approach gives full design control without fighting a third-party component library's theme system. The `ui/` folder houses the project's own primitive components, making the design system explicit and auditable.

**Trade-off**: More initial setup than dropping in a UI kit. Offset by the fact that the ticket detail page, SLA timer, and comment editor all have non-standard interaction patterns that would require customizing any library component anyway.

---

*Next: Part 05 — Data Flow Diagrams*

## Part 05: Data Flow Diagrams

### 5.1 Ticket Lifecycle State Machine

The ticket status is a controlled state machine. The service layer enforces legal transitions and rejects illegal ones with a 422 error. No direct SQL UPDATE on the status field is permitted — all status changes go through `tickets.service.ts::transition()`.

```
Valid States:  OPEN | IN_PROGRESS | PENDING | RESOLVED | CLOSED

Transitions:
  OPEN         -> IN_PROGRESS   (agent/admin: assign or start work)
  OPEN         -> RESOLVED      (agent/admin: immediate resolution)
  IN_PROGRESS  -> PENDING       (agent: awaiting requester input)
  IN_PROGRESS  -> RESOLVED      (agent/admin: work complete)
  PENDING      -> IN_PROGRESS   (agent: requester responded)
  PENDING      -> CLOSED        (system: auto-close after idle threshold)
  RESOLVED     -> CLOSED        (any: confirm resolution)
  RESOLVED     -> OPEN          (requester: reopen if not satisfied)
  CLOSED       -> OPEN          (agent/admin: reopen with justification)
```

**Side effects per transition**:


| Transition       | Side Effects                                                      |
| ---------------- | ----------------------------------------------------------------- |
| -> IN_PROGRESS   | Sets `first_response_at` if null; cancels response-breach job     |
| -> RESOLVED      | Sets `resolved_at`; cancels all SLA jobs; emits `ticket.resolved` |
| -> CLOSED        | Sets `closed_at`; emits `ticket.closed`                           |
| -> OPEN (reopen) | Clears breach flags; reschedules SLA timers from now              |
| -> PENDING       | Pauses SLA clock (if business_hours_only = true)                  |


---

### 5.2 Ticket Creation Flow

```
  Client (React)
       |
       | POST /api/v1/tickets
       | { title, description, priority, category }
       v
  authenticate middleware
       | Verify JWT -> attach req.user
       v
  validate middleware (Zod: CreateTicketDto)
       | 400 if invalid
       v
  tickets.router.ts -> tickets.service.ts::createTicket()
       |
       +--[1]--> tickets.repository.ts::insert()
       |           INSERT INTO tickets (...) RETURNING *
       |           -> ticket record
       |
       +--[2]--> sla.service.ts::applyPolicy(ticket)
       |           SELECT sla_policy WHERE priority = ticket.priority
       |             AND (is_default OR explicitly assigned)
       |           Calculate response_due_at, resolution_due_at
       |           UPDATE tickets SET sla_* fields
       |
       |         sla.scheduler.ts::scheduleTimers(ticket, policy)
       |           BullMQ sla queue:
       |             addJob('sla-check', { ticketId, type: 'response_warning' },
       |                    { delay: policy.response_time_minutes * 60000 * 0.8 })
       |             addJob('sla-check', { ticketId, type: 'response_breach' },
       |                    { delay: policy.response_time_minutes * 60000 })
       |             addJob('sla-check', { ticketId, type: 'resolution_warning' },
       |                    { delay: policy.resolution_time_minutes * 60000 * 0.8 })
       |             addJob('sla-check', { ticketId, type: 'resolution_breach' },
       |                    { delay: policy.resolution_time_minutes * 60000 })
       |
       +--[3]--> eventBus.emit('ticket.created', { ticketId, requesterId,
       |                                           assigneeId, priority })
       |
       +--[4]--> audit.repository.ts::insert()
       |           INSERT INTO audit_logs (entity_type='ticket', action='created', ...)
       |
       v
  notifications module (listening to 'ticket.created'):
       |
       +-- notifications.service.ts::handleTicketCreated(event)
       |     Load preferences for: assignee, team members, admin watchers
       |     For each recipient x channel (where enabled):
       |       BullMQ notifications queue: addJob({ recipientId, channel, type, payload })
       |
  v (async, non-blocking to HTTP response)
  BullMQ notifications.processor.ts:
       +-- in_app:   INSERT INTO notifications (...); pg.NOTIFY 'notifications'
       +-- email:    Render Handlebars template; nodemailer.sendMail()
       +-- webhook:  HTTP POST; HMAC-SHA256 X-Signature header

  HTTP Response: 201 Created { data: ticket }
```

---

### 5.3 SLA Escalation Flow

```
BullMQ delayed job fires: { ticketId, policyId, type: 'resolution_breach' }
       |
       v
  sla.processor.ts::process(job)
       |
       +--[1] Load ticket from DB
       |       SELECT * FROM tickets WHERE id = ticketId
       |
       +--[2] Guard: is ticket already RESOLVED or CLOSED?
       |       YES -> job.discard(); return  (no-op, timer fired late)
       |       NO  -> continue
       |
       +--[3] Confirm breach:
       |       Is NOW() > sla_resolution_due_at?
       |       NO  -> job.discard()  (ticket was updated, SLA reset)
       |       YES -> breach confirmed
       |
       +--[4] Persist breach:
       |       UPDATE tickets SET sla_resolution_breached = true
       |       INSERT INTO sla_escalation_events (ticket_id, type, triggered_at, ...)
       |
       +--[5] Determine escalation target:
       |       policy.escalation_user_id OR policy.escalation_team_id
       |       Fallback: ticket.assignee_id
       |       Fallback: admin users (any)
       |
       +--[6] eventBus.emit('sla.breached', {
       |         ticketId, type, escalatedToUserId, escalatedToTeamId })
       |
       +--[7] notifications.service.ts handles 'sla.breached':
       |       BullMQ: notify escalation target (high priority)
       |       BullMQ: notify original assignee
       |       BullMQ: notify requester (if their preferences allow)
       |
       +--[8] audit.repository.ts::insert()
       |       action: 'sla_resolution_breached'
       |
       v
  job.complete()

  On processor throw:
    BullMQ: exponential backoff retry (3 attempts)
    After max retries: job -> FAILED queue
    Alerting: webhook.channel.ts fires to on-call endpoint
```

**Business Hours Handling**:

If `sla_policy.business_hours_only = true`, `businessHours.ts::calculateDeadline()` computes the wall-clock UTC timestamp for the SLA deadline, skipping weekends and configured off-hours. BullMQ receives a specific `delay` value (milliseconds until that timestamp) — no business-hours logic runs inside the processor.

---

### 5.4 Notification Queue Flow

```
Domain event emitted anywhere in the backend:
  eventBus.emit('ticket.assigned', { ticketId, newAssigneeId, oldAssigneeId })
       |
       v
  notifications.service.ts::handleEvent(eventType, payload)
       |
       +-- Load notification_preferences for affected recipients:
       |     SELECT * FROM notification_preferences
       |     WHERE event_type = 'ticket_assigned'
       |     AND user_id IN (newAssigneeId, oldAssigneeId, requesterId)
       |
       +-- For each recipient x channel (where enabled = true):
       |     BullMQ notifications queue:
       |       addJob({
       |         recipientId, channel, type: 'ticket_assigned',
       |         payload: { ticketId, title, priority, ... }
       |       }, { priority: channel === 'in_app' ? 1 : 2 })
       |
  v (BullMQ worker processes job)
  notifications.processor.ts::process(job)
       |
       +-- channel === 'in_app':
       |     inApp.channel.ts::deliver(job.data)
       |       INSERT INTO notifications (recipient_id, type, payload, ...)
       |       pg.query("NOTIFY notifications, $1", [recipientId])
       |       SSE handler pushes event to connected client if present
       |
       +-- channel === 'email':
       |     email.channel.ts::deliver(job.data)
       |       Compile Handlebars template for event type
       |       nodemailer.sendMail({ to, subject, html })
       |       On success: UPDATE notifications SET sent_at = NOW()
       |       On failure: UPDATE SET failed_at, failure_reason
       |       BullMQ auto-retries up to 5x with backoff
       |
       +-- channel === 'webhook':
       |     webhook.channel.ts::deliver(job.data)
       |       Load user's webhook endpoint from config
       |       Build payload: { event, timestamp, data }
       |       Compute HMAC-SHA256 signature over payload
       |       axios.post(endpoint, payload, { headers: { 'X-Signature': sig },
       |                                       timeout: 10000 })
       |       On 2xx: mark delivered
       |       On non-2xx or timeout: retry 3x, then dead-letter
       |
  v
  job.complete()
```

**Real-Time In-App Delivery (SSE)**:

PostgreSQL `NOTIFY` is used as the IPC mechanism between the notification processor and SSE connections:

```
notification worker                Express SSE handler (notifications.sse.ts)
       |                                      |
       | pg NOTIFY 'notifications', userId    |
       |       -------------------------------->
       |                                      | pg LISTEN 'notifications' (on startup)
       |                                      | Receive NOTIFY payload
       |                                      | Find SSE connection for userId
       |                                      | res.write("data: {...}\n\n")
       |                                      | Client EventSource receives update
```

---

### 5.5 Authentication Token Flow

```
LOGIN:
  POST /auth/login { email, password }
       |
       +-- auth.repository.ts::findByEmail(email)
       +-- bcrypt.compare(password, user.password_hash)
       +-- On mismatch: 401 Unauthorized (same message as user not found — no enumeration)
       +-- token.service.ts::issueTokenPair(userId)
       |     accessToken  = jwt.sign({ sub: userId, role }, RS256, expiresIn: '15m')
       |     refreshToken = uuid v4
       |     Redis: SET refresh:{userId}:{refreshToken} userId EX 604800
       +-- UPDATE users SET last_login_at = NOW()
       +-- Return: { accessToken, refreshToken }

REFRESH:
  POST /auth/refresh { refreshToken }
       |
       +-- Decode refreshToken (opaque UUID; userId extracted from header claim)
       +-- Redis: GET refresh:{userId}:{refreshToken}
       +-- Not found? -> 401 (expired or revoked)
       +-- Redis: DEL refresh:{userId}:{refreshToken}   (rotate: invalidate old)
       +-- token.service.ts::issueTokenPair(userId)     (issue new pair)
       +-- Return: { accessToken, refreshToken }

LOGOUT:
  POST /auth/logout { refreshToken }
       |
       +-- Redis: DEL refresh:{userId}:{refreshToken}
       +-- 200 OK (access token expires within 15 min naturally)

PASSWORD CHANGE:
  +-- Redis: DEL refresh:{userId}:*  (wildcard scan: revoke ALL sessions)
  +-- bcrypt.hash(newPassword)
  +-- UPDATE users SET password_hash = ...
  +-- 200 OK; client must re-authenticate
```

---

### 5.6 File Attachment Flow

```
UPLOAD:
  POST /tickets/:id/attachments (multipart/form-data; max 20MB)
       |
       +-- Multer: parse multipart, hold in memory
       +-- Validate mime type against allowlist:
       |     ['image/jpeg','image/png','image/gif','application/pdf',
       |      'text/plain','application/zip', ...]
       +-- attachments.service.ts::upload(file, ticketId, actor)
       |     storageKey = `attachments/${ticketId}/${uuidv4()}/${file.originalname}`
       |     S3: PutObject({ Bucket, Key: storageKey, Body: file.buffer,
       |                     ContentType: file.mimetype })
       |     attachments.repository.ts::insert({
       |       ticket_id, uploader_id, filename, mime_type,
       |       size_bytes, storage_key, storage_bucket })
       +-- Return: { id, filename, size_bytes, presignedUrl (1hr) }

DOWNLOAD:
  GET /tickets/:id/attachments/:attachId
       |
       +-- Verify actor has read access to ticket
       +-- attachments.repository.ts::findById(attachId)
       +-- S3: GetSignedUrl({ Key: attachment.storage_key, Expires: 900 })
       +-- HTTP 302 Redirect to presigned URL
       (Files are never proxied through the API server)

DELETE:
  DELETE /tickets/:id/attachments/:attachId
       |
       +-- Verify actor is uploader OR admin
       +-- S3: DeleteObject({ Key: attachment.storage_key })
       +-- attachments.repository.ts::hardDelete(attachId)
       |   (hard delete — no soft delete for storage objects; S3 is the truth)
       +-- 204 No Content
```

---

### 5.7 Report Export Flow

```
  POST /reports/export { type: 'tickets', filters: { status: 'closed', date_from: ... } }
       |
       +-- reports.service.ts::queueExport({ type, filters, requestedBy: actor.id })
       +-- BullMQ reports queue: addJob({ type, filters, requestedBy })
       +-- Return: { jobId }   (HTTP 202 Accepted)

  Client polling:
  GET /reports/exports/:jobId
       +-- BullMQ: job.getState()   -> 'waiting' | 'active' | 'completed' | 'failed'
       +-- On 'completed': job.returnvalue.downloadUrl
       +-- Return: { status, downloadUrl? }

  BullMQ reports.processor.ts::process(job):
       |
       +-- Connect to READ REPLICA pool (reports.repository.ts uses replicaPool)
       +-- Stream result set using cursor (avoids loading full dataset in memory)
       +-- Pipe rows through fast-csv to CSV string chunks
       +-- Upload chunks to S3 via multipart upload:
       |     Key: exports/{requestedBy}/{jobId}/report.csv
       +-- Return: { downloadUrl: presignedUrl (7 days) }
       +-- BullMQ marks job 'completed' with returnvalue
```

---

*Next: Part 06 — RBAC Permissions Matrix*

## Part 06: RBAC Permissions Matrix

### 6.1 Role Definitions

The system implements three roles. The permission model is additive: agents have a superset of end-user permissions; admins have a superset of agent permissions.


| Role       | Purpose                                         | Typical Holders               |
| ---------- | ----------------------------------------------- | ----------------------------- |
| `end_user` | Submit and track their own support tickets      | Employees, customers          |
| `agent`    | Handle, resolve, and manage tickets; publish KB | Support staff, IT technicians |
| `admin`    | Full system configuration and user management   | IT managers, system owners    |


Roles are stored in the `roles` table and assigned to users via `users.role_id`. A user has exactly one role at any time. Role changes are audited.

---

### 6.2 Ticket Permissions


| Action                                           | end_user                        | agent               | admin               |
| ------------------------------------------------ | ------------------------------- | ------------------- | ------------------- |
| Create ticket                                    | Yes (own)                       | Yes (any requester) | Yes (any requester) |
| View ticket list                                 | Own only                        | All                 | All                 |
| View ticket detail                               | Own only                        | All                 | All                 |
| Update ticket fields (title, priority, category) | No                              | Yes                 | Yes                 |
| Change status -> IN_PROGRESS                     | No                              | Yes                 | Yes                 |
| Change status -> RESOLVED                        | No                              | Yes                 | Yes                 |
| Change status -> CLOSED                          | Yes (own)                       | Yes                 | Yes                 |
| Reopen ticket                                    | Yes (own, if recently resolved) | Yes                 | Yes                 |
| Assign ticket to agent/team                      | No                              | Yes                 | Yes                 |
| Manual escalation                                | No                              | Yes                 | Yes                 |
| Soft-delete ticket                               | No                              | No                  | Yes                 |
| Add public comment                               | Yes (own tickets)               | Yes (all tickets)   | Yes (all tickets)   |
| Add internal note                                | No                              | Yes                 | Yes                 |
| View internal notes                              | No                              | Yes                 | Yes                 |
| Edit own comment                                 | Yes (5 min window)              | Yes (30 min window) | Yes (any time)      |
| Delete own comment                               | Yes (5 min window)              | Yes                 | Yes                 |
| Delete any comment                               | No                              | No                  | Yes                 |
| Upload attachment                                | Yes (own tickets)               | Yes (all tickets)   | Yes (all tickets)   |
| Delete own attachment                            | Yes                             | Yes                 | Yes                 |
| Delete any attachment                            | No                              | No                  | Yes                 |
| View ticket audit history                        | No                              | Yes                 | Yes                 |
| View SLA status on ticket                        | No                              | Yes                 | Yes                 |
| Link KB article to ticket                        | No                              | Yes                 | Yes                 |


**Enforcement note**: End-user visibility is enforced at the repository query level, not only the route level. `tickets.repository.ts::findAll()` appends `WHERE requester_id = $actorId` for callers with role `end_user`. This defense-in-depth approach means a misconfigured route cannot leak tickets even if the route guard is absent.

---

### 6.3 User and Team Management Permissions


| Action                              | end_user | agent                | admin            |
| ----------------------------------- | -------- | -------------------- | ---------------- |
| View own profile                    | Yes      | Yes                  | Yes              |
| Edit own profile (name, avatar)     | Yes      | Yes                  | Yes              |
| Change own password                 | Yes      | Yes                  | Yes              |
| View list of all users              | No       | Yes (limited fields) | Yes (all fields) |
| View any user's full profile        | No       | Yes                  | Yes              |
| Create user account                 | No       | No                   | Yes              |
| Update any user's role              | No       | No                   | Yes              |
| Activate / deactivate user          | No       | No                   | Yes              |
| View team list                      | No       | Yes                  | Yes              |
| View team membership                | No       | Yes                  | Yes              |
| Create team                         | No       | No                   | Yes              |
| Edit team (name, lead, description) | No       | No                   | Yes              |
| Add member to team                  | No       | No                   | Yes              |
| Remove member from team             | No       | No                   | Yes              |
| Delete team                         | No       | No                   | Yes              |
| View agent workload metrics         | No       | Own metrics only     | All agents       |


---

### 6.4 SLA Configuration Permissions


| Action                               | end_user         | agent      | admin      |
| ------------------------------------ | ---------------- | ---------- | ---------- |
| View own ticket's SLA status         | Yes (simplified) | Yes (full) | Yes (full) |
| View SLA policies                    | No               | Yes        | Yes        |
| Create SLA policy                    | No               | No         | Yes        |
| Edit SLA policy                      | No               | No         | Yes        |
| Delete SLA policy                    | No               | No         | Yes        |
| View SLA breach events (all tickets) | No               | No         | Yes        |
| View SLA breach events (own tickets) | No               | Yes        | Yes        |
| View SLA compliance reports          | No               | No         | Yes        |
| Configure business hours             | No               | No         | Yes        |


---

### 6.5 Knowledge Base Permissions


| Action                      | end_user | agent | admin |
| --------------------------- | -------- | ----- | ----- |
| Browse published articles   | Yes      | Yes   | Yes   |
| Read published article      | Yes      | Yes   | Yes   |
| Search articles             | Yes      | Yes   | Yes   |
| Submit helpfulness feedback | Yes      | Yes   | Yes   |
| Create draft article        | No       | Yes   | Yes   |
| Edit own draft              | No       | Yes   | Yes   |
| Edit any article            | No       | No    | Yes   |
| Publish article             | No       | No    | Yes   |
| Archive article             | No       | No    | Yes   |
| Delete article              | No       | No    | Yes   |
| Link article to ticket      | No       | Yes   | Yes   |
| View article analytics      | No       | No    | Yes   |


---

### 6.6 Notification and Reporting Permissions


| Action                                 | end_user | agent | admin |
| -------------------------------------- | -------- | ----- | ----- |
| View own notifications                 | Yes      | Yes   | Yes   |
| Mark notifications read                | Yes      | Yes   | Yes   |
| Configure own notification preferences | Yes      | Yes   | Yes   |
| View admin reports dashboard           | No       | No    | Yes   |
| View own performance metrics           | No       | Yes   | No    |
| Export reports to CSV                  | No       | No    | Yes   |
| View full audit log                    | No       | No    | Yes   |
| View audit log for own actions         | No       | Yes   | Yes   |
| Configure webhook endpoint             | No       | No    | Yes   |
| Send test webhook                      | No       | No    | Yes   |


---

### 6.7 Implementation Pattern

**Layer 1 — Route middleware** (`authorize.ts`):

```typescript
// Guards the entire route by role
export const authorize = (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(`Requires role: ${roles.join(' or ')}`)
      );
    }
    next();
  };

// Usage in tickets.router.ts
router.patch('/:id', authenticate, authorize('agent', 'admin'), updateTicket);
router.delete('/:id', authenticate, authorize('admin'), deleteTicket);
```

**Layer 2 — Service ownership checks**:

```typescript
// tickets.service.ts: end-user can only comment on their own tickets
async addComment(ticketId: string, dto: CreateCommentDto, actor: User) {
  const ticket = await this.repo.findById(ticketId);
  if (!ticket) throw new NotFoundError('Ticket not found');

  if (actor.role === 'end_user' && ticket.requesterId !== actor.id) {
    throw new ForbiddenError('You can only comment on your own tickets');
  }

  if (dto.isInternal && actor.role === 'end_user') {
    throw new ForbiddenError('End users cannot add internal notes');
  }

  const comment = await this.commentRepo.insert({ ticketId, ...dto, authorId: actor.id });
  this.eventBus.emit('comment.added', { ticketId, commentId: comment.id, actor });
  return comment;
}
```

**Layer 3 — Repository-level data filtering**:

```typescript
// tickets.repository.ts: scope queries to actor at DB level
async findAll(filters: TicketFilters, actor: User): Promise<Ticket[]> {
  const where: WhereClause[] = [{ field: 'deleted_at', op: 'IS NULL' }];

  // Hard scope: end-user only sees their own tickets
  if (actor.role === 'end_user') {
    where.push({ field: 'requester_id', op: '=', value: actor.id });
  }

  if (filters.status) where.push({ field: 'status', op: '= ANY', value: filters.status });
  if (filters.priority) where.push({ field: 'priority', op: '= ANY', value: filters.priority });
  if (filters.assigneeId) where.push({ field: 'assignee_id', op: '=', value: filters.assigneeId });

  return this.db.query(buildSelect('tickets', where, filters));
}
```

---

### 6.8 Defense in Depth — Permission Layer Summary


| Layer                       | Mechanism                          | What It Stops                                  |
| --------------------------- | ---------------------------------- | ---------------------------------------------- |
| Route guard (`authorize`)   | Role check before handler executes | Wrong role accessing endpoint entirely         |
| Service ownership check     | Domain logic in service method     | Same-role but unauthorized resource access     |
| Repository query scope      | SQL WHERE appended for role        | Data leakage from service-layer bugs           |
| PostgreSQL RLS (planned v2) | Row-level security policy in DB    | Application layer bypass (e.g., raw DB access) |


No single layer is trusted alone. The route guard is the first line; the repository filter is the last. Both must be present for sensitive data.

---

### 6.9 Security Audit Logging for Permission Denials

All `403 Forbidden` responses are logged by the `errorHandler.ts` middleware with:

```json
{
  "level": "warn",
  "event": "authorization_denied",
  "actor_id": "uuid",
  "actor_role": "end_user",
  "required_roles": ["agent", "admin"],
  "resource_type": "ticket",
  "resource_id": "uuid",
  "method": "PATCH",
  "path": "/api/v1/tickets/uuid",
  "correlation_id": "req-uuid",
  "ip": "1.2.3.4",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

These logs flow to the centralized log aggregator (Datadog / Elastic / Loki). They are kept separate from the business `audit_logs` table — security events belong in the operational log pipeline, not the relational audit trail.

---

### 6.10 Evolution Path

The current model is intentionally simple RBAC. Planned extensions as the product matures:

**Phase 2 — Team-scoped visibility for agents**:
Add `team_id` filter to ticket queries: agents only see tickets assigned to their team(s). Implemented by joining `team_members` in the repository query for `actor.role === 'agent'`.

**Phase 3 — Custom roles**:
Extend the `roles` table with a `permissions: JSONB` column containing a set of permission strings (e.g., `["tickets:read", "tickets:write", "kb:publish"]`). Replace the `authorize('agent','admin')` call with `requiresPermission('tickets:write')`. The permission set is loaded once on login and attached to the session.

**Phase 4 — Attribute-Based Access Control (ABAC)**:
Evaluate only if Phase 3 custom roles prove insufficient. ABAC adds policy evaluation overhead per request. The modular service/repository pattern supports a policy engine (e.g., OPA) as an injectable dependency — the architecture does not need to change, only the authorization middleware.

---

### 6.11 Full System Architecture Summary

```
+--------------------------------------------------------------------+
|                         React Frontend                             |
|  Vite + React 18 + TanStack Query + Zustand + Tailwind CSS         |
|  Pages: Tickets | KB | Notifications | Admin | Reports             |
+------------------------------+-------------------------------------+
                               | HTTPS REST + JWT Bearer
+------------------------------v-------------------------------------+
|              Express API — Modular Monolith                        |
|                                                                    |
|  Middleware pipeline:                                              |
|    correlationId -> authenticate -> authorize -> validate          |
|    -> [handler] -> audit -> errorHandler                           |
|                                                                    |
|  Domain modules (router > service > repository):                  |
|    auth | users | teams | tickets | sla | notifications | kb      |
|    reports | audit                                                 |
|                                                                    |
|  Shared infrastructure:                                            |
|    eventBus (EventEmitter) | BullMQ queues | Pino logger           |
|    AppError hierarchy | pagination | S3 helpers                    |
+--------+-----------------------+-------------------+--------------+
         |                       |                   |
+--------v--------+   +----------v--------+   +------v-----------+
| PostgreSQL 16   |   |   Redis 7         |   |  S3 / MinIO      |
| primary +       |   |  refresh tokens   |   |  attachments     |
| read replica    |   |  rate limits      |   |  report exports  |
| (reports)       |   |  BullMQ transport |   |                  |
+--------+--------+   +-------------------+   +------------------+
         |
+--------v--------+
| node-pg-migrate |
| versioned SQL   |
| migrations      |
+-----------------+
                               |
                    +----------v----------+
                    |  BullMQ Worker      |
                    |  (worker.ts)        |
                    |                     |
                    |  sla.processor      |
                    |  notifications.proc |
                    |  reports.processor  |
                    +---------------------+
```

---

*Architecture document complete.*
*Parts: 01 Introduction | 02 ERD | 03 API | 04 Modules | 05 Flows | 06 RBAC*