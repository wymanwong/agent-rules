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

| Relationship | Cardinality | Notes |
|-------------|-------------|-------|
| users -> roles | N:1 | Each user has exactly one role |
| tickets -> users (requester) | N:1 | Who submitted the ticket |
| tickets -> users (assignee) | N:1 | Nullable; assigned agent |
| tickets -> teams | N:1 | Nullable; team-level assignment |
| tickets -> sla_policies | N:1 | SLA applied at creation time |
| comments -> tickets | N:1 | Thread of activity on a ticket |
| attachments -> tickets/comments | N:1 | Polymorphic via nullable FKs |
| kb_articles <-> tickets | M:N | Via kb_article_ticket_links |
| notifications -> users | N:1 | Per-recipient delivery record |
| audit_logs -> entity | N:1 | Polymorphic via entity_type + entity_id |
| sla_escalation_events -> tickets | N:1 | One or more events per ticket |

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
