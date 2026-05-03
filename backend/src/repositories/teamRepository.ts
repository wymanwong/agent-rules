import type { PoolClient } from 'pg';
import { mapRows, query } from '../db/pg.js';

export interface TeamRow {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export async function listTeams(db: PoolClient | null): Promise<TeamRow[]> {
  void db;
  const r = await query<TeamRow>('SELECT * FROM teams ORDER BY name');
  return mapRows(r.rows);
}

export async function findTeamById(db: PoolClient | null, id: number): Promise<TeamRow | undefined> {
  void db;
  const r = await query<TeamRow>('SELECT * FROM teams WHERE id = $1', [id]);
  return mapRows(r.rows)[0];
}

export async function insertTeam(db: PoolClient | null, row: Omit<TeamRow, 'id'>): Promise<number> {
  void db;
  const r = await query<{ id: number }>(
    `INSERT INTO teams (name, description, created_at, updated_at)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [row.name, row.description, row.created_at, row.updated_at],
  );
  return r.rows[0]!.id;
}

export async function updateTeam(
  db: PoolClient | null,
  id: number,
  patch: Partial<Pick<TeamRow, 'name' | 'description' | 'updated_at'>>,
): Promise<void> {
  void db;
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${String(k)} = $${i + 2}`).join(', ');
  const vals = keys.map((k) => patch[k]);
  await query(`UPDATE teams SET ${sets} WHERE id = $1`, [id, ...vals]);
}

export async function deleteTeam(db: PoolClient | null, id: number): Promise<void> {
  void db;
  await query('DELETE FROM teams WHERE id = $1', [id]);
}
