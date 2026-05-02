import type { Database } from 'better-sqlite3';

export interface TeamRow {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function listTeams(db: Database): TeamRow[] {
  return db.prepare('SELECT * FROM teams ORDER BY name').all() as TeamRow[];
}

export function findTeamById(db: Database, id: number): TeamRow | undefined {
  return db.prepare('SELECT * FROM teams WHERE id = ?').get(id) as TeamRow | undefined;
}

export function insertTeam(
  db: Database,
  row: Omit<TeamRow, 'id'>,
): number {
  const r = db
    .prepare(
      `INSERT INTO teams (name, description, created_at, updated_at)
       VALUES (@name, @description, @created_at, @updated_at)`,
    )
    .run(row);
  return Number(r.lastInsertRowid);
}

export function updateTeam(
  db: Database,
  id: number,
  patch: Partial<Pick<TeamRow, 'name' | 'description' | 'updated_at'>>,
): void {
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE teams SET ${sets} WHERE id = @id`).run({ ...patch, id });
}

export function deleteTeam(db: Database, id: number): void {
  db.prepare('DELETE FROM teams WHERE id = ?').run(id);
}
