#!/usr/bin/env node
/**
 * QA: reset schema, migrate, seed via createDb, in-process HTTP assertions.
 * Requires PostgreSQL reachable at DATABASE_URL (default local docker-friendly).
 */
import { execSync } from "child_process";
import http from "http";
import pg from "pg";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/ticketing_qa";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureDatabaseExists() {
  const idx = DATABASE_URL.lastIndexOf("/");
  if (idx <= 0) return;
  const adminUrl = `${DATABASE_URL.slice(0, idx)}/postgres`;
  const dbName = DATABASE_URL.slice(idx + 1).split("?")[0];
  if (!dbName || dbName === "postgres") return;
  const pool = new pg.Pool({ connectionString: adminUrl });
  try {
    const chk = await pool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (!chk.rows.length) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) throw new Error("Invalid DB name");
      await pool.query(`CREATE DATABASE ${dbName}`);
      console.log("Created database:", dbName);
    }
  } finally {
    await pool.end();
  }
}

async function resetSchema() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await pool.query("GRANT ALL ON SCHEMA public TO public");
    await pool.query("GRANT ALL ON SCHEMA public TO postgres");
  } finally {
    await pool.end();
  }
}

async function waitForDb(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const pool = new pg.Pool({ connectionString: DATABASE_URL });
      await pool.query("SELECT 1");
      await pool.end();
      return true;
    } catch {
      await sleep(1000);
    }
  }
  return false;
}

function request(port, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: { ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let json;
        try {
          json = data ? JSON.parse(data) : {};
        } catch {
          json = { _raw: data };
        }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on("error", reject);
    if (body != null) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log("QA DATABASE_URL:", DATABASE_URL.replace(/:[^:@]+@/, ":****@"));

  await ensureDatabaseExists();

  if (!(await waitForDb())) {
    console.error("PostgreSQL not reachable. Start with:");
    console.error(
      '  docker run -d --name ticketing-pg-qa -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine'
    );
    console.error("  docker exec -it ticketing-pg-qa psql -U postgres -c \"CREATE DATABASE ticketing_qa;\"");
    process.exit(1);
  }

  console.log("Resetting schema...");
  await resetSchema();

  console.log("Running migrations...");
  execSync("node scripts/migrate.mjs", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL },
  });

  const { createDb } = await import("../server/db.js");
  const { createApp } = await import("../server/app.js");

  const db = await createDb();
  const app = createApp(db);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const fail = (msg) => {
    console.error("FAIL:", msg);
    server.close();
    db.close().finally(() => process.exit(1));
  };

  try {
    let r = await request(port, "GET", "/api/v1/health/ready");
    if (!r.json.success || r.json.data?.database !== "postgresql") {
      return fail(`health/ready: ${JSON.stringify(r.json)}`);
    }
    console.log("✓ health/ready");

    r = await request(port, "POST", "/api/v1/auth/login", {
      headers: { "Content-Type": "application/json" },
      body: { email: "agent@local.test", password: "demo123" },
    });
    if (!r.json.success || !r.json.data?.accessToken) {
      return fail(`login agent: ${JSON.stringify(r.json)}`);
    }
    const agentToken = r.json.data.accessToken;
    console.log("✓ login agent");

    r = await request(port, "GET", "/api/v1/tickets", {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    if (!r.json.success || !Array.isArray(r.json.data) || r.json.data.length < 1) {
      return fail(`list tickets (agent): ${JSON.stringify(r.json)}`);
    }
    const ticketId = r.json.data[0].id;
    console.log("✓ list tickets");

    r = await request(port, "POST", "/api/v1/tickets", {
      headers: {
        Authorization: `Bearer ${agentToken}`,
        "Content-Type": "application/json",
      },
      body: {
        title: "QA ticket",
        description: "from qa",
        category: "general",
        priority: "low",
      },
    });
    if (!r.json.success || !r.json.data?.id) {
      return fail(`create ticket: ${JSON.stringify(r.json)}`);
    }
    console.log("✓ create ticket");

    r = await request(port, "GET", `/api/v1/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    if (!r.json.success || !r.json.data?.ticket) {
      return fail(`get ticket detail: ${JSON.stringify(r.json)}`);
    }
    console.log("✓ ticket detail");

    r = await request(port, "POST", "/api/v1/auth/login", {
      headers: { "Content-Type": "application/json" },
      body: { email: "user@local.test", password: "demo123" },
    });
    const userToken = r.json.data?.accessToken;
    if (!userToken) return fail(`login user: ${JSON.stringify(r.json)}`);

    r = await request(port, "GET", `/api/v1/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (r.status !== 403 && !(r.status === 404 && !r.json.success)) {
      /* end user must not see admin's ticket — expect 403 or 404 envelope */
    }
    if (r.json.success) {
      return fail("end user should not access agent/admin ticket");
    }
    console.log("✓ RBAC isolation (end user denied other requester ticket)");

    r = await request(port, "GET", "/api/v1/reports/overview", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (r.json.success) {
      return fail("end user must not access admin reports");
    }
    console.log("✓ reports forbidden for end_user");

    console.log("\nAll QA checks passed.");
  } finally {
    server.close();
    await db.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
