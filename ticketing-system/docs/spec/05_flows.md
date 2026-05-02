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

| Transition | Side Effects |
|-----------|-------------|
| -> IN_PROGRESS | Sets `first_response_at` if null; cancels response-breach job |
| -> RESOLVED | Sets `resolved_at`; cancels all SLA jobs; emits `ticket.resolved` |
| -> CLOSED | Sets `closed_at`; emits `ticket.closed` |
| -> OPEN (reopen) | Clears breach flags; reschedules SLA timers from now |
| -> PENDING | Pauses SLA clock (if business_hours_only = true) |

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
