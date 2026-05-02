/** SQLite DDL — foreign keys on; timestamps ISO TEXT */

export const SCHEMA_SQL_FULL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  impact TEXT NOT NULL,
  urgency TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  team_id INTEGER REFERENCES teams(id),
  assignee_id INTEGER REFERENCES users(id),
  department TEXT,
  source TEXT NOT NULL,
  channel TEXT,
  ticket_extra_json TEXT,
  catalog_item_id INTEGER REFERENCES service_catalog_items(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  due_at TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  is_internal INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  from_user_id INTEGER REFERENCES users(id),
  to_user_id INTEGER REFERENCES users(id),
  from_team_id INTEGER REFERENCES teams(id),
  to_team_id INTEGER REFERENCES teams(id),
  changed_by_id INTEGER NOT NULL REFERENCES users(id),
  changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_catalog_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ServiceRequest',
  default_category TEXT,
  default_subcategory TEXT,
  default_impact TEXT,
  default_urgency TEXT,
  default_priority TEXT,
  requires_manager_approval INTEGER NOT NULL DEFAULT 0,
  form_schema_json TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  approver_user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  tags TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_team_id ON tickets(team_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_id ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_ticket_id ON comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_approvals_ticket_id ON approvals(ticket_id);
CREATE INDEX IF NOT EXISTS idx_kb_published ON knowledge_articles(is_published);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id),
  original_filename TEXT NOT NULL,
  stored_relative_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
`;
