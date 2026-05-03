import pg from 'pg';
import { env } from '../config/env.js';
import { SCHEMA_PG_SQL } from './schemaPg.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.databaseUrl,
      max: Number(process.env.PG_POOL_MAX) || 20,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function ensurePgSchema(): Promise<void> {
  const p = getPool();
  await p.query(SCHEMA_PG_SQL);
  await p.query(
    `ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS body_format TEXT NOT NULL DEFAULT 'markdown'`,
  );
}

/** Run SQL with $1,$2 placeholders */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/** Map pg row timestamps to ISO strings for JSON API compatibility */
export function rowDatesToIso<R>(row: R): R {
  const out = { ...(row as Record<string, unknown>) };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (v instanceof Date) {
      out[k] = v.toISOString();
    }
  }
  return out as R;
}

export function mapRows<R>(rows: R[]): R[] {
  return rows.map((r) => rowDatesToIso(r));
}
