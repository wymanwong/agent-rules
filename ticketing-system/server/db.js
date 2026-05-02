import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.TICKETING_DB || path.join(__dirname, "..", "data", "ticketing.db");

export function openDb() {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  seedIfEmpty(db);
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','agent','admin')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      form_schema TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','assigned','pending','resolved','closed')),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical')),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      requester_id INTEGER NOT NULL REFERENCES users(id),
      assignee_id INTEGER REFERENCES users(id),
      parent_ticket_id INTEGER REFERENCES tickets(id),
      custom_fields TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_parent ON tickets(parent_ticket_id);

    CREATE TABLE IF NOT EXISTS ticket_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seedIfEmpty(db) {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (count > 0) return;

  const hash = bcrypt.hashSync("demo123", 10);
  db.prepare(
    `INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)`
  ).run("admin@local.test", "Admin User", hash, "admin");
  db.prepare(
    `INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)`
  ).run("agent@local.test", "IT Agent", hash, "agent");
  db.prepare(
    `INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)`
  ).run("user@local.test", "End User", hash, "user");

  const defaultSchema = JSON.stringify([
    { id: "asset_tag", label: "Asset tag", type: "text", required: false },
    { id: "location", label: "Location / site", type: "text", required: false },
  ]);

  db.prepare(
    `INSERT INTO categories (name, slug, description, form_schema) VALUES (?, ?, ?, ?)`
  ).run(
    "Hardware",
    "hardware",
    "Laptops, monitors, peripherals",
    defaultSchema
  );
  db.prepare(
    `INSERT INTO categories (name, slug, description, form_schema) VALUES (?, ?, ?, ?)`
  ).run(
    "Software / access",
    "software",
    "Licenses, accounts, VPN",
    JSON.stringify([
      { id: "app_name", label: "Application or system", type: "text", required: true },
      { id: "justification", label: "Business justification", type: "textarea", required: false },
    ])
  );
  db.prepare(
    `INSERT INTO categories (name, slug, description, form_schema) VALUES (?, ?, ?, ?)`
  ).run(
    "General",
    "general",
    "Anything else",
    "[]"
  );

  const adminId = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@local.test").id;
  const cat = db.prepare("SELECT id FROM categories WHERE slug = ?").get("general").id;

  db.prepare(
    `INSERT INTO tickets (number, title, description, status, priority, category_id, requester_id, assignee_id, custom_fields)
     VALUES (1, ?, ?, 'assigned', 'normal', ?, ?, ?, '{}')`
  ).run(
    "Welcome ticket",
    "This is a sample ticket. Try split, migrate, and custom fields from the UI.",
    cat,
    adminId,
    db.prepare("SELECT id FROM users WHERE email = ?").get("agent@local.test").id
  );
}
