import pg from "pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { toPg } from "./pg/query.js";

export function uuid() {
  return crypto.randomUUID();
}

const ROLE_ADMIN = "00000000-0000-4000-8000-000000000001";
const ROLE_AGENT = "00000000-0000-4000-8000-000000000002";
const ROLE_END_USER = "00000000-0000-4000-8000-000000000003";

export { ROLE_ADMIN, ROLE_AGENT, ROLE_END_USER };

function poolConfig() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    "postgresql://postgres:postgres@localhost:5432/ticketing_qa";
  return { connectionString, max: 20 };
}

export async function createDb() {
  const pool = new pg.Pool(poolConfig());

  const api = {
    pool,

    async query(sql, params = []) {
      const { text, values } = toPg(sql, params);
      return pool.query(text, values);
    },

    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const txdb = {
          async query(sql, params = []) {
            const { text, values } = toPg(sql, params);
            return client.query(text, values);
          },
        };
        const out = await fn(txdb);
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    },
  };

  await seedIfEmpty(api);
  return api;
}

async function seedIfEmpty(db) {
  const r = await db.query(`SELECT COUNT(*)::int AS n FROM roles`);
  if (r.rows[0].n > 0) return;

  await db.query(
    `INSERT INTO roles (id, name, description) VALUES (?,?,?), (?,?,?), (?,?,?)`,
    [
      ROLE_ADMIN,
      "admin",
      "Full configuration",
      ROLE_AGENT,
      "agent",
      "Ticket handling",
      ROLE_END_USER,
      "end_user",
      "Self-service",
    ]
  );

  const hash = bcrypt.hashSync("demo123", 10);
  const U_ADMIN = "10000000-0000-4000-8000-000000000001";
  const U_AGENT = "10000000-0000-4000-8000-000000000002";
  const U_USER = "10000000-0000-4000-8000-000000000003";

  await db.query(
    `INSERT INTO users (id, email, password_hash, full_name, role_id) VALUES
     (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
    [
      U_ADMIN,
      "admin@local.test",
      hash,
      "Admin User",
      ROLE_ADMIN,
      U_AGENT,
      "agent@local.test",
      hash,
      "IT Agent",
      ROLE_AGENT,
      U_USER,
      "user@local.test",
      hash,
      "End User",
      ROLE_END_USER,
    ]
  );

  const TEAM_ID = "20000000-0000-4000-8000-000000000001";
  await db.query(`INSERT INTO teams (id, name, description, lead_id) VALUES (?, ?, ?, ?)`, [
    TEAM_ID,
    "Service Desk",
    "Default team",
    U_AGENT,
  ]);
  await db.query(`INSERT INTO team_members (team_id, user_id) VALUES (?, ?)`, [TEAM_ID, U_AGENT]);

  const SLA_LOW = "30000000-0000-4000-8000-000000000001";
  const SLA_MED = "30000000-0000-4000-8000-000000000002";
  const SLA_HIGH = "30000000-0000-4000-8000-000000000003";
  const SLA_CRIT = "30000000-0000-4000-8000-000000000004";

  await db.query(
    `INSERT INTO sla_policies (id, name, priority, response_time_minutes, resolution_time_minutes, is_default) VALUES (?, ?, 'low', 480, 2880, TRUE)`,
    [SLA_LOW, "Default Low"]
  );
  await db.query(
    `INSERT INTO sla_policies (id, name, priority, response_time_minutes, resolution_time_minutes, is_default) VALUES (?, ?, 'medium', 240, 1440, TRUE)`,
    [SLA_MED, "Default Medium"]
  );
  await db.query(
    `INSERT INTO sla_policies (id, name, priority, response_time_minutes, resolution_time_minutes, is_default) VALUES (?, ?, 'high', 120, 720, TRUE)`,
    [SLA_HIGH, "Default High"]
  );
  await db.query(
    `INSERT INTO sla_policies (id, name, priority, response_time_minutes, resolution_time_minutes, is_default) VALUES (?, ?, 'critical', 60, 240, TRUE)`,
    [SLA_CRIT, "Default Critical"]
  );

  const catSchema = JSON.stringify([
    { id: "asset_tag", label: "Asset tag", type: "text", required: false },
    { id: "location", label: "Location", type: "text", required: false },
  ]);

  await db.query(`INSERT INTO ticket_categories (id, name, slug, description, form_schema) VALUES (?, ?, ?, ?, ?)`, [
    uuid(),
    "Hardware",
    "hardware",
    "Devices",
    catSchema,
  ]);
  await db.query(`INSERT INTO ticket_categories (id, name, slug, description, form_schema) VALUES (?, ?, ?, ?, ?)`, [
    uuid(),
    "Software",
    "software",
    "Apps & access",
    JSON.stringify([
      { id: "app_name", label: "Application", type: "text", required: true },
      { id: "justification", label: "Justification", type: "textarea", required: false },
    ]),
  ]);
  await db.query(`INSERT INTO ticket_categories (id, name, slug, description, form_schema) VALUES (?, ?, ?, ?, ?)`, [
    uuid(),
    "General",
    "general",
    "Other",
    "[]",
  ]);

  const numRes = await db.query(`SELECT COALESCE(MAX(ticket_number), 0) + 1 AS n FROM tickets`);
  const nextNum = Number(numRes.rows[0].n);
  const T1 = uuid();
  const respDue = minutesFromNow(240);
  const resDue = minutesFromNow(1440);

  await db.query(
    `INSERT INTO tickets (id, ticket_number, title, description, status, priority, category, requester_id, assignee_id, team_id, sla_policy_id, sla_response_due_at, sla_resolution_due_at)
     VALUES (?, ?, ?, ?, 'in_progress', 'medium', 'general', ?, ?, ?, ?, ?, ?)`,
    [T1, nextNum, "Welcome ticket", "Sample ticket — try close, reopen, split, migrate, and KB link as an agent.", U_ADMIN, U_AGENT, TEAM_ID, SLA_MED, respDue, resDue]
  );
  await db.query(
    `SELECT setval(pg_get_serial_sequence('tickets', 'ticket_number'), (SELECT COALESCE(MAX(ticket_number), 1) FROM tickets))`
  );

  await db.query(
    `INSERT INTO kb_articles (id, title, slug, body, author_id, category, status, published_at) VALUES (?, ?, ?, ?, ?, ?, 'published', NOW())`,
    [
      uuid(),
      "Reset your password",
      "reset-password",
      "## Steps\n\n1. Open login\n2. Use forgot password (coming soon)\n",
      U_AGENT,
      "Account",
    ]
  );
}

function minutesFromNow(mins) {
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}
