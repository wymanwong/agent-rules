import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function uuid() {
  return crypto.randomUUID();
}

export function openDb() {
  const dbPath = process.env.TICKETING_DB || path.join(__dirname, "..", "data", "ticketing-v2.db");
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  seedIfEmpty(db);
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar_url TEXT,
      role_id TEXT NOT NULL REFERENCES roles(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      lead_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS sla_policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL CHECK(priority IN ('low','medium','high','critical')),
      response_time_minutes INTEGER NOT NULL,
      resolution_time_minutes INTEGER NOT NULL,
      business_hours_only INTEGER NOT NULL DEFAULT 0,
      escalation_user_id TEXT REFERENCES users(id),
      escalation_team_id TEXT REFERENCES teams(id),
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      form_schema TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      ticket_number INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','pending','resolved','closed')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      category TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}',
      requester_id TEXT NOT NULL REFERENCES users(id),
      assignee_id TEXT REFERENCES users(id),
      team_id TEXT REFERENCES teams(id),
      sla_policy_id TEXT REFERENCES sla_policies(id),
      sla_response_due_at TEXT,
      sla_resolution_due_at TEXT,
      sla_response_breached INTEGER NOT NULL DEFAULT 0,
      sla_resolution_breached INTEGER NOT NULL DEFAULT 0,
      first_response_at TEXT,
      resolved_at TEXT,
      closed_at TEXT,
      parent_ticket_id TEXT REFERENCES tickets(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_tickets_parent ON tickets(parent_ticket_id);

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 0,
      is_solution INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id, created_at) WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
      comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
      uploader_id TEXT NOT NULL REFERENCES users(id),
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL,
      storage_bucket TEXT NOT NULL DEFAULT 'local',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sla_escalation_events (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      policy_id TEXT NOT NULL REFERENCES sla_policies(id),
      escalation_type TEXT NOT NULL CHECK(escalation_type IN ('response_warning','response_breach','resolution_warning','resolution_breach')),
      escalated_to_user_id TEXT REFERENCES users(id),
      escalated_to_team_id TEXT REFERENCES teams(id),
      triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
      acknowledged_at TEXT,
      job_id TEXT
    );

    CREATE TABLE IF NOT EXISTS kb_articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      body TEXT NOT NULL,
      author_id TEXT NOT NULL REFERENCES users(id),
      category TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      view_count INTEGER NOT NULL DEFAULT 0,
      helpful_count INTEGER NOT NULL DEFAULT 0,
      not_helpful_count INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS kb_article_ticket_links (
      article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      linked_by_id TEXT NOT NULL REFERENCES users(id),
      linked_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (article_id, ticket_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_id TEXT REFERENCES users(id),
      actor_ip TEXT,
      changes TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'in_app' CHECK(channel IN ('in_app','email','webhook')),
      title TEXT,
      body TEXT,
      payload TEXT NOT NULL DEFAULT '{}',
      reference_type TEXT,
      reference_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      sent_at TEXT,
      failed_at TEXT,
      failure_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);

    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      webhook_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, event_type)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
  `);
}

const ROLE_ADMIN = "00000000-0000-4000-8000-000000000001";
const ROLE_AGENT = "00000000-0000-4000-8000-000000000002";
const ROLE_END_USER = "00000000-0000-4000-8000-000000000003";

function seedIfEmpty(db) {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM roles").get();
  if (n > 0) return;

  const insRole = db.prepare(`INSERT INTO roles (id, name, description) VALUES (?, ?, ?)`);
  insRole.run(ROLE_ADMIN, "admin", "Full configuration");
  insRole.run(ROLE_AGENT, "agent", "Ticket handling");
  insRole.run(ROLE_END_USER, "end_user", "Self-service");

  const hash = bcrypt.hashSync("demo123", 10);
  const insUser = db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, role_id) VALUES (?, ?, ?, ?, ?)`
  );
  const U_ADMIN = "10000000-0000-4000-8000-000000000001";
  const U_AGENT = "10000000-0000-4000-8000-000000000002";
  const U_USER = "10000000-0000-4000-8000-000000000003";
  insUser.run(U_ADMIN, "admin@local.test", hash, "Admin User", ROLE_ADMIN);
  insUser.run(U_AGENT, "agent@local.test", hash, "IT Agent", ROLE_AGENT);
  insUser.run(U_USER, "user@local.test", hash, "End User", ROLE_END_USER);

  const TEAM_ID = "20000000-0000-4000-8000-000000000001";
  db.prepare(`INSERT INTO teams (id, name, description, lead_id) VALUES (?, ?, ?, ?)`).run(
    TEAM_ID,
    "Service Desk",
    "Default team",
    U_AGENT
  );
  db.prepare(`INSERT INTO team_members (team_id, user_id) VALUES (?, ?)`).run(TEAM_ID, U_AGENT);

  const spi = db.prepare(`INSERT INTO sla_policies (id, name, priority, response_time_minutes, resolution_time_minutes, is_default) VALUES (?, ?, ?, ?, ?, ?)`);
  const SLA_LOW = "30000000-0000-4000-8000-000000000001";
  const SLA_MED = "30000000-0000-4000-8000-000000000002";
  const SLA_HIGH = "30000000-0000-4000-8000-000000000003";
  const SLA_CRIT = "30000000-0000-4000-8000-000000000004";
  spi.run(SLA_LOW, "Default Low", "low", 480, 2880, 1);
  spi.run(SLA_MED, "Default Medium", "medium", 240, 1440, 1);
  spi.run(SLA_HIGH, "Default High", "high", 120, 720, 1);
  spi.run(SLA_CRIT, "Default Critical", "critical", 60, 240, 1);

  const catSchema = JSON.stringify([
    { id: "asset_tag", label: "Asset tag", type: "text", required: false },
    { id: "location", label: "Location", type: "text", required: false },
  ]);
  const ic = db.prepare(`INSERT INTO ticket_categories (id, name, slug, description, form_schema) VALUES (?, ?, ?, ?, ?)`);
  ic.run(uuid(), "Hardware", "hardware", "Devices", catSchema);
  ic.run(
    uuid(),
    "Software",
    "software",
    "Apps & access",
    JSON.stringify([
      { id: "app_name", label: "Application", type: "text", required: true },
      { id: "justification", label: "Justification", type: "textarea", required: false },
    ])
  );
  ic.run(uuid(), "General", "general", "Other", "[]");

  const nextNum =
    db.prepare(`SELECT COALESCE(MAX(ticket_number), 0) + 1 AS n FROM tickets`).get().n;
  const T1 = uuid();
  const pol = SLA_MED;
  const created = new Date().toISOString();
  const respDue = minutesFromNow(240);
  const resDue = minutesFromNow(1440);

  db.prepare(
    `INSERT INTO tickets (id, ticket_number, title, description, status, priority, category, requester_id, assignee_id, team_id, sla_policy_id, sla_response_due_at, sla_resolution_due_at)
     VALUES (?, ?, ?, ?, 'in_progress', 'medium', 'general', ?, ?, ?, ?, ?, ?)`
  ).run(
    T1,
    nextNum,
    "Welcome ticket",
    "Sample ticket — try close, reopen, split, migrate, and KB link as an agent.",
    U_ADMIN,
    U_AGENT,
    TEAM_ID,
    pol,
    respDue,
    resDue
  );

  db.prepare(
    `INSERT INTO kb_articles (id, title, slug, body, author_id, category, status, published_at) VALUES (?, ?, ?, ?, ?, ?, 'published', datetime('now'))`
  ).run(
    uuid(),
    "Reset your password",
    "reset-password",
    "## Steps\n\n1. Open login\n2. Use forgot password (coming soon)\n",
    U_AGENT,
    "Account"
  );
}

function minutesFromNow(mins) {
  const d = new Date(Date.now() + mins * 60 * 1000);
  return d.toISOString();
}

export { ROLE_ADMIN, ROLE_AGENT, ROLE_END_USER };
