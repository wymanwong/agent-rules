import type { PoolClient } from 'pg';
import type { UserRole } from '../models/types.js';
import { mapRows, query } from '../db/pg.js';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  department: string | null;
  role: UserRole;
  password_hash: string;
  team_id: number | null;
  created_at: string;
  updated_at: string;
}

export async function findUserByEmail(db: PoolClient | null, email: string): Promise<UserRow | undefined> {
  void db;
  const r = await query<UserRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [email.trim()]);
  return mapRows(r.rows)[0];
}

export async function findUserById(db: PoolClient | null, id: number): Promise<UserRow | undefined> {
  void db;
  const r = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return mapRows(r.rows)[0];
}

export async function listUsersSafe(db: PoolClient | null): Promise<Omit<UserRow, 'password_hash'>[]> {
  void db;
  const r = await query<Omit<UserRow, 'password_hash'>>(
    'SELECT id, name, email, department, role, team_id, created_at, updated_at FROM users ORDER BY id',
  );
  return mapRows(r.rows as Omit<UserRow, 'password_hash'>[]);
}

/** IT/Admin users for ticket assignment pickers (no password hash). */
export async function listAssignableStaff(
  db: PoolClient | null,
): Promise<Pick<UserRow, 'id' | 'name' | 'email' | 'team_id'>[]> {
  void db;
  const r = await query<Pick<UserRow, 'id' | 'name' | 'email' | 'team_id'>>(
    `SELECT id, name, email, team_id FROM users WHERE role IN ('IT', 'Admin') ORDER BY name ASC`,
  );
  return mapRows(r.rows);
}

export async function listUsers(db: PoolClient | null): Promise<UserRow[]> {
  void db;
  const r = await query<UserRow>('SELECT * FROM users ORDER BY id');
  return mapRows(r.rows);
}

export async function insertUser(
  db: PoolClient | null,
  row: Omit<UserRow, 'id'> & { password_hash: string },
): Promise<number> {
  void db;
  const r = await query<{ id: number }>(
    `INSERT INTO users (name, email, department, role, password_hash, team_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      row.name,
      row.email.trim().toLowerCase(),
      row.department,
      row.role,
      row.password_hash,
      row.team_id,
      row.created_at,
      row.updated_at,
    ],
  );
  return r.rows[0]!.id;
}

export async function updateUser(
  db: PoolClient | null,
  id: number,
  patch: Partial<Pick<UserRow, 'name' | 'department' | 'role' | 'team_id' | 'updated_at' | 'password_hash'>>,
): Promise<void> {
  void db;
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${String(k)} = $${i + 2}`).join(', ');
  const vals = keys.map((k) => patch[k]);
  await query(`UPDATE users SET ${sets} WHERE id = $1`, [id, ...vals]);
}

export async function deleteUser(db: PoolClient | null, id: number): Promise<void> {
  void db;
  await query('DELETE FROM users WHERE id = $1', [id]);
}
