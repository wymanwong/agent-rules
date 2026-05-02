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
