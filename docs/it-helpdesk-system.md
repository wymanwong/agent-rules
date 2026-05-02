# ITIL-Aligned Helpdesk (SQLite + Node + React + MUI)

This workspace includes a demo internal ticketing stack: Express + TypeScript + `better-sqlite3`, and a Vite React (MUI) portal and IT console.

## Architecture

- **Backend** (`backend/`): Layered layout under `src/` — `config`, `db`, `repositories`, `services`, `controllers`, `routes`, `middleware`. SQLite file from `DB_PATH` (default `./data/helpdesk.db`). JWT auth; RBAC for `EndUser`, `IT`, `Admin`.
- **Frontend** (`frontend/`): React Router, MUI theme, `/login` and protected routes. Dev server proxies API paths to port 4000.
- **Priority & SLA**: `backend/src/services/prioritySla.ts` derives `priority` (P1–P4) from impact × urgency and computes `due_at` (P1 +4h, P2 +8h, P3 +3d, P4 +5d).
- **Workflow**: `backend/src/services/ticketWorkflow.ts` validates incident vs service-request statuses and transitions.

## Setup

```bash
cd backend && cp .env.example .env && npm install && npm run db:init -- --force
cd ../frontend && npm install
```

## Attachments & voice

- **Uploads**: Files are stored under `UPLOADS_DIR` (default `./data/uploads`) with metadata in `ticket_attachments`. Max size per file: `MAX_UPLOAD_MB` (default 15).
- **API**: `POST /tickets/multipart` (fields + optional `attachments[]`), `POST /catalog/items/:id/requests/multipart`, `POST /tickets/:id/attachments/multipart`; download `GET /tickets/:ticketId/attachments/:attachmentId/download` (JWT); delete `DELETE /tickets/:ticketId/attachments/:attachmentId` (requester + IT/Admin may remove).
- **Portal**: Incident and catalog request forms support **voice-to-text** (Web Speech API — Chrome/Edge/Safari; HTTPS except localhost), **camera / gallery**, and **multi-file** picks.

## Run

Terminal 1:

```bash
cd backend && npm run dev
```

Terminal 2:

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 — API health: http://localhost:4000/health.

## Demo accounts (after seed)

Password for all: `password123`

- `admin@example.com` — Admin  
- `it.helpdesk@example.com`, `it.network@example.com`, `it.apps@example.com` — IT (per team)  
- `user@example.com` — EndUser  

## Notable API behavior

- **Knowledge GET** `/knowledge/articles` and `/knowledge/articles/:id` are public for published articles; optional JWT unlocks unpublished listing for Admin.
- **Tickets**: `POST /tickets` creates incidents or requests; ticket number `IT-######` is set after insert.
- **Catalog**: Admin UI lives at `/admin/catalog` (list + configure). **GET** `/catalog/items/:id` (Admin JWT) loads one item for editing. **POST** `/catalog/items/:id/requests` creates a service request whose row links to that offering via **`catalog_item_id`** (not hardcoded in app code). Ticket detail API returns **`catalog_item`** `{ id, name }` when linked. If `default_priority` is set on the item it overrides impact×urgency for ticket priority and SLA; optional approval uses first Admin as approver when `requires_manager_approval` is set.

## Tests

```bash
cd backend && npm test
```
