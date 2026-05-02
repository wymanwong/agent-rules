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
- **Catalog**: `POST /catalog/items/:id/requests` creates a service request; optional approval uses first Admin as approver when `requires_manager_approval` is set.

## Tests

```bash
cd backend && npm test
```
