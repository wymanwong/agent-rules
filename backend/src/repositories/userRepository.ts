import type { Database } from 'better-sqlite3';
import type { UserRole } from '../models/types.js';

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

export function findUserByEmail(db: Database, email: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as UserRow | undefined;
}

export function findUserById(db: Database, id: number): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function listUsersSafe(db: Database): Omit<UserRow, 'password_hash'>[] {
  return db
    .prepare('SELECT id, name, email, department, role, team_id, created_at, updated_at FROM users ORDER BY id')
    .all() as Omit<UserRow, 'password_hash'>[];
}

export function listUsers(db: Database): UserRow[] {
  return db.prepare('SELECT * FROM users ORDER BY id').all() as UserRow[];
}

export function insertUser(
  db: Database,
  row: Omit<UserRow, 'id'> & { password_hash: string },
): number {
  const r = db
    .prepare(
      `INSERT INTO users (name, email, department, role, password_hash, team_id, created_at, updated_at)
       VALUES (@name, @email, @department, @role, @password_hash, @team_id, @created_at, @updated_at)`,
    )
    .run({
      ...row,
      email: row.email.trim().toLowerCase(),
    });
  return Number(r.lastInsertRowid);
}

export function updateUser(
  db: Database,
  id: number,
  patch: Partial<Pick<UserRow, 'name' | 'department' | 'role' | 'team_id' | 'updated_at' | 'password_hash'>>,
): void {
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE users SET ${sets} WHERE id = @id`).run({ ...patch, id });
}

export function deleteUser(db: Database, id: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
