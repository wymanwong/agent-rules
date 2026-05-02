## Part 06: RBAC Permissions Matrix

### 6.1 Role Definitions

The system implements three roles. The permission model is additive: agents have a superset of end-user permissions; admins have a superset of agent permissions.

| Role | Purpose | Typical Holders |
|------|---------|----------------|
| `end_user` | Submit and track their own support tickets | Employees, customers |
| `agent` | Handle, resolve, and manage tickets; publish KB | Support staff, IT technicians |
| `admin` | Full system configuration and user management | IT managers, system owners |

Roles are stored in the `roles` table and assigned to users via `users.role_id`. A user has exactly one role at any time. Role changes are audited.

---

### 6.2 Ticket Permissions

| Action | end_user | agent | admin |
|--------|----------|-------|-------|
| Create ticket | Yes (own) | Yes (any requester) | Yes (any requester) |
| View ticket list | Own only | All | All |
| View ticket detail | Own only | All | All |
| Update ticket fields (title, priority, category) | No | Yes | Yes |
| Change status -> IN_PROGRESS | No | Yes | Yes |
| Change status -> RESOLVED | No | Yes | Yes |
| Change status -> CLOSED | Yes (own) | Yes | Yes |
| Reopen ticket | Yes (own, if recently resolved) | Yes | Yes |
| Assign ticket to agent/team | No | Yes | Yes |
| Manual escalation | No | Yes | Yes |
| Soft-delete ticket | No | No | Yes |
| Add public comment | Yes (own tickets) | Yes (all tickets) | Yes (all tickets) |
| Add internal note | No | Yes | Yes |
| View internal notes | No | Yes | Yes |
| Edit own comment | Yes (5 min window) | Yes (30 min window) | Yes (any time) |
| Delete own comment | Yes (5 min window) | Yes | Yes |
| Delete any comment | No | No | Yes |
| Upload attachment | Yes (own tickets) | Yes (all tickets) | Yes (all tickets) |
| Delete own attachment | Yes | Yes | Yes |
| Delete any attachment | No | No | Yes |
| View ticket audit history | No | Yes | Yes |
| View SLA status on ticket | No | Yes | Yes |
| Link KB article to ticket | No | Yes | Yes |

**Enforcement note**: End-user visibility is enforced at the repository query level, not only the route level. `tickets.repository.ts::findAll()` appends `WHERE requester_id = $actorId` for callers with role `end_user`. This defense-in-depth approach means a misconfigured route cannot leak tickets even if the route guard is absent.

---

### 6.3 User and Team Management Permissions

| Action | end_user | agent | admin |
|--------|----------|-------|-------|
| View own profile | Yes | Yes | Yes |
| Edit own profile (name, avatar) | Yes | Yes | Yes |
| Change own password | Yes | Yes | Yes |
| View list of all users | No | Yes (limited fields) | Yes (all fields) |
| View any user's full profile | No | Yes | Yes |
| Create user account | No | No | Yes |
| Update any user's role | No | No | Yes |
| Activate / deactivate user | No | No | Yes |
| View team list | No | Yes | Yes |
| View team membership | No | Yes | Yes |
| Create team | No | No | Yes |
| Edit team (name, lead, description) | No | No | Yes |
| Add member to team | No | No | Yes |
| Remove member from team | No | No | Yes |
| Delete team | No | No | Yes |
| View agent workload metrics | No | Own metrics only | All agents |

---

### 6.4 SLA Configuration Permissions

| Action | end_user | agent | admin |
|--------|----------|-------|-------|
| View own ticket's SLA status | Yes (simplified) | Yes (full) | Yes (full) |
| View SLA policies | No | Yes | Yes |
| Create SLA policy | No | No | Yes |
| Edit SLA policy | No | No | Yes |
| Delete SLA policy | No | No | Yes |
| View SLA breach events (all tickets) | No | No | Yes |
| View SLA breach events (own tickets) | No | Yes | Yes |
| View SLA compliance reports | No | No | Yes |
| Configure business hours | No | No | Yes |

---

### 6.5 Knowledge Base Permissions

| Action | end_user | agent | admin |
|--------|----------|-------|-------|
| Browse published articles | Yes | Yes | Yes |
| Read published article | Yes | Yes | Yes |
| Search articles | Yes | Yes | Yes |
| Submit helpfulness feedback | Yes | Yes | Yes |
| Create draft article | No | Yes | Yes |
| Edit own draft | No | Yes | Yes |
| Edit any article | No | No | Yes |
| Publish article | No | No | Yes |
| Archive article | No | No | Yes |
| Delete article | No | No | Yes |
| Link article to ticket | No | Yes | Yes |
| View article analytics | No | No | Yes |

---

### 6.6 Notification and Reporting Permissions

| Action | end_user | agent | admin |
|--------|----------|-------|-------|
| View own notifications | Yes | Yes | Yes |
| Mark notifications read | Yes | Yes | Yes |
| Configure own notification preferences | Yes | Yes | Yes |
| View admin reports dashboard | No | No | Yes |
| View own performance metrics | No | Yes | No |
| Export reports to CSV | No | No | Yes |
| View full audit log | No | No | Yes |
| View audit log for own actions | No | Yes | Yes |
| Configure webhook endpoint | No | No | Yes |
| Send test webhook | No | No | Yes |

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

| Layer | Mechanism | What It Stops |
|-------|-----------|--------------|
| Route guard (`authorize`) | Role check before handler executes | Wrong role accessing endpoint entirely |
| Service ownership check | Domain logic in service method | Same-role but unauthorized resource access |
| Repository query scope | SQL WHERE appended for role | Data leakage from service-layer bugs |
| PostgreSQL RLS (planned v2) | Row-level security policy in DB | Application layer bypass (e.g., raw DB access) |

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
