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

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Create account (end-user self-registration) |
| POST | `/auth/login` | Public | Email + password; returns access + refresh tokens |
| POST | `/auth/refresh` | Refresh token | Issue new access token via token rotation |
| POST | `/auth/logout` | Required | Revoke refresh token from Redis |
| POST | `/auth/forgot-password` | Public | Send password reset email |
| POST | `/auth/reset-password` | Reset token | Validate token, set new password |
| GET | `/auth/me` | Required | Return current user profile with role |
| PATCH | `/auth/me` | Required | Update profile (name, avatar) |
| PATCH | `/auth/me/password` | Required | Change password (requires current password) |
| GET | `/auth/sessions` | Required | List active sessions (refresh tokens) |
| DELETE | `/auth/sessions/:tokenId` | Required | Revoke a specific session |

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

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/tickets` | Required | All | List tickets; end-users see own only |
| POST | `/tickets` | Required | All | Create new ticket |
| GET | `/tickets/:id` | Required | All | Ticket detail with comments, attachments, SLA |
| PATCH | `/tickets/:id` | Required | Agent/Admin | Update ticket fields |
| DELETE | `/tickets/:id` | Required | Admin | Soft-delete ticket |
| POST | `/tickets/:id/assign` | Required | Agent/Admin | Assign to agent or team |
| POST | `/tickets/:id/escalate` | Required | Agent/Admin | Manual escalation |
| POST | `/tickets/:id/resolve` | Required | Agent/Admin | Mark resolved (sets resolved_at) |
| POST | `/tickets/:id/close` | Required | All | Close ticket |
| POST | `/tickets/:id/reopen` | Required | All | Reopen; recalculates SLA |
| GET | `/tickets/:id/history` | Required | Agent/Admin | Full audit trail for this ticket |
| GET | `/tickets/:id/sla` | Required | Agent/Admin | SLA status, due times, breach flags |
| POST | `/tickets/:id/link-article` | Required | Agent/Admin | Link a KB article to this ticket |
| GET | `/tickets/:id/comments` | Required | All | List comments (internal filtered for end-users) |
| POST | `/tickets/:id/comments` | Required | All | Add public comment or internal note |
| PATCH | `/tickets/:id/comments/:cid` | Required | Author/Admin | Edit comment (time-window enforced) |
| DELETE | `/tickets/:id/comments/:cid` | Required | Author/Admin | Soft-delete comment |
| GET | `/tickets/:id/attachments` | Required | All | List attachments |
| POST | `/tickets/:id/attachments` | Required | All | Upload file (multipart/form-data, 20MB max) |
| DELETE | `/tickets/:id/attachments/:aid` | Required | Uploader/Admin | Delete attachment |

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

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/users` | Required | Admin | List users (paginated, filterable by role/status) |
| POST | `/users` | Required | Admin | Create user account (admin-provisioned) |
| GET | `/users/:id` | Required | Admin/Agent | User profile (agents see limited fields) |
| PATCH | `/users/:id` | Required | Admin | Update user (role, is_active) |
| DELETE | `/users/:id` | Required | Admin | Soft-delete user |
| GET | `/users/:id/tickets` | Required | Admin/Agent | All tickets for a user |

#### `/api/v1/teams`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/teams` | Required | Agent/Admin | List teams |
| POST | `/teams` | Required | Admin | Create team |
| GET | `/teams/:id` | Required | Agent/Admin | Team detail with member list |
| PATCH | `/teams/:id` | Required | Admin | Update team (name, lead, description) |
| DELETE | `/teams/:id` | Required | Admin | Delete team (requires no active tickets) |
| GET | `/teams/:id/members` | Required | Agent/Admin | List team members |
| POST | `/teams/:id/members` | Required | Admin | Add user to team |
| DELETE | `/teams/:id/members/:uid` | Required | Admin | Remove user from team |

---

### 3.5 SLA Routes — `/api/v1/sla`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/sla/policies` | Required | Admin | List all SLA policies |
| POST | `/sla/policies` | Required | Admin | Create SLA policy |
| GET | `/sla/policies/:id` | Required | Admin | Policy detail |
| PATCH | `/sla/policies/:id` | Required | Admin | Update policy (triggers recalculation on active tickets) |
| DELETE | `/sla/policies/:id` | Required | Admin | Delete policy (blocked if active tickets use it) |
| GET | `/sla/breaches` | Required | Admin | All breach events (filterable by date, ticket, type) |
| GET | `/sla/report` | Required | Admin | Compliance metrics: breach rate, MTTR by priority |
| POST | `/sla/business-hours` | Required | Admin | Configure business hours schedule |
| GET | `/sla/business-hours` | Required | Admin | Get current business hours configuration |

**Note on policy updates**: When a policy's time windows are changed, the system re-evaluates all open tickets assigned to that policy and reschedules BullMQ jobs accordingly. This is done asynchronously via the SLA queue to avoid blocking the HTTP response.

---

### 3.6 Knowledge Base Routes — `/api/v1/kb`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/kb/articles` | Optional | All | List published articles (filterable by category, tag) |
| GET | `/kb/articles/:slug` | Optional | All | Read article (increments view_count asynchronously) |
| GET | `/kb/search` | Optional | All | Full-text search via PostgreSQL GIN index |
| POST | `/kb/articles` | Required | Agent/Admin | Create draft article |
| GET | `/kb/articles/:id/draft` | Required | Agent/Admin | Read own draft |
| PATCH | `/kb/articles/:id` | Required | Agent/Admin | Update article |
| POST | `/kb/articles/:id/publish` | Required | Admin | Publish article (sets published_at) |
| POST | `/kb/articles/:id/archive` | Required | Admin | Archive article |
| DELETE | `/kb/articles/:id` | Required | Admin | Soft-delete article |
| POST | `/kb/articles/:id/feedback` | Required | All | Submit helpful/not-helpful vote |
| GET | `/kb/categories` | Optional | All | List all categories with article counts |

---

### 3.7 Notification Routes — `/api/v1/notifications`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/notifications` | Required | All | List notifications for current user (paginated) |
| GET | `/notifications/unread-count` | Required | All | Quick count for notification bell |
| PATCH | `/notifications/:id/read` | Required | All | Mark single notification read |
| POST | `/notifications/read-all` | Required | All | Mark all as read |
| DELETE | `/notifications/:id` | Required | All | Delete notification |
| GET | `/notifications/preferences` | Required | All | Get per-event channel preferences |
| PATCH | `/notifications/preferences` | Required | All | Update preferences |
| GET | `/notifications/stream` | Required | All | Server-Sent Events stream for real-time updates |

**Note on SSE**: The `/notifications/stream` endpoint establishes a persistent SSE connection. The server pushes events on new notification inserts using PostgreSQL LISTEN/NOTIFY piped through the Express SSE handler. This avoids polling overhead for the UI. Clients reconnect automatically on disconnect.

---

### 3.8 Reports Routes — `/api/v1/reports`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/reports/overview` | Required | Admin | Ticket counts by status, priority, category |
| GET | `/reports/agents` | Required | Admin | Per-agent: ticket volume, avg resolution time, open count |
| GET | `/reports/sla` | Required | Admin | Breach count, compliance rate, MTTR by priority |
| GET | `/reports/trends` | Required | Admin | Ticket volume time-series (daily/weekly/monthly) |
| GET | `/reports/kb` | Required | Admin | Article views, helpfulness rates, top articles |
| POST | `/reports/export` | Required | Admin | Queue async CSV export job; returns jobId |
| GET | `/reports/exports/:jobId` | Required | Admin | Poll job status; returns downloadUrl on completion |

All report endpoints accept `date_from` and `date_to` query parameters. Report queries run against the PostgreSQL read replica to avoid contention with write operations.

---

### 3.9 System Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Liveness: returns `{ status: "ok", uptime: 1234 }` |
| GET | `/health/ready` | Public | Readiness: tests DB + Redis connectivity |
| GET | `/metrics` | Internal | Prometheus metrics (scrape endpoint, not public) |
| POST | `/webhooks/test` | Admin | Send a test payload to the configured webhook endpoint |

---

*Next: Part 04 — Module and Folder Structure*
