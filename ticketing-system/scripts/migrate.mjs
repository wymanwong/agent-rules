#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ticketing_qa";

async function main() {
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migDir = path.join(root, "migrations");
    const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const done = await client.query(`SELECT 1 FROM schema_migrations WHERE filename = $1`, [file]);
      if (done.rows.length) continue;
      const sql = fs.readFileSync(path.join(migDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
        await client.query("COMMIT");
        console.log("Applied migration:", file);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
