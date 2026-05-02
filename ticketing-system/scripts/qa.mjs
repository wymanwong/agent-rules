#!/usr/bin/env node
/**
 * QA against SQLite: isolated DB file, in-process Express, HTTP smoke tests.
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dbPath = path.join(root, "data", `qa-${Date.now()}.db`);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
process.env.TICKETING_DB = dbPath;

const { openDb } = await import("../server/db.js");
const { createApp } = await import("../server/app.js");

const db = openDb();
const app = createApp(db);

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
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const fail = (msg) => {
    console.error("FAIL:", msg);
    server.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
    process.exit(1);
  };

  try {
    let r = await request(port, "GET", "/api/v1/health/ready");
    if (!r.json.success) return fail(`health/ready: ${JSON.stringify(r.json)}`);

    r = await request(port, "POST", "/api/v1/auth/login", {
      headers: { "Content-Type": "application/json" },
      body: { email: "agent@local.test", password: "demo123" },
    });
    if (!r.json.success || !r.json.data?.accessToken) {
      return fail(`login agent: ${JSON.stringify(r.json)}`);
    }
    const agentToken = r.json.data.accessToken;

    r = await request(port, "GET", "/api/v1/tickets", {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    if (!r.json.success || !Array.isArray(r.json.data) || r.json.data.length < 1) {
      return fail(`list tickets: ${JSON.stringify(r.json)}`);
    }
    const ticketId = r.json.data[0].id;

    r = await request(port, "POST", "/api/v1/tickets", {
      headers: {
        Authorization: `Bearer ${agentToken}`,
        "Content-Type": "application/json",
      },
      body: { title: "QA ticket", description: "qa", category: "general", priority: "low" },
    });
    if (!r.json.success || !r.json.data?.id) {
      return fail(`create ticket: ${JSON.stringify(r.json)}`);
    }

    r = await request(port, "GET", `/api/v1/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    if (!r.json.success || !r.json.data?.ticket) {
      return fail(`ticket detail: ${JSON.stringify(r.json)}`);
    }

    r = await request(port, "POST", "/api/v1/auth/login", {
      headers: { "Content-Type": "application/json" },
      body: { email: "user@local.test", password: "demo123" },
    });
    const userToken = r.json.data?.accessToken;
    if (!userToken) return fail(`login user: ${JSON.stringify(r.json)}`);

    r = await request(port, "GET", `/api/v1/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (r.json.success) return fail("end user must not access another requester's ticket");

    r = await request(port, "GET", "/api/v1/reports/overview", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (r.json.success) return fail("end user must not access admin reports");

    console.log("All QA checks passed (SQLite).");
  } finally {
    server.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
