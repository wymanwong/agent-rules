import type { PoolClient } from 'pg';
import { mapRows, query } from '../db/pg.js';

export interface AssignmentHistoryRow {
  id: number;
  ticket_id: number;
  from_user_id: number | null;
  to_user_id: number | null;
  from_team_id: number | null;
  to_team_id: number | null;
  changed_by_id: number;
  changed_at: string;
}

export async function insertAssignment(db: PoolClient | null, row: Omit<AssignmentHistoryRow, 'id'>): Promise<void> {
  void db;
  await query(
    `INSERT INTO assignment_history (
      ticket_id, from_user_id, to_user_id, from_team_id, to_team_id, changed_by_id, changed_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      row.ticket_id,
      row.from_user_id,
      row.to_user_id,
      row.from_team_id,
      row.to_team_id,
      row.changed_by_id,
      row.changed_at,
    ],
  );
}

export async function listByTicket(db: PoolClient | null, ticketId: number): Promise<AssignmentHistoryRow[]> {
  void db;
  const r = await query<AssignmentHistoryRow>(
    'SELECT * FROM assignment_history WHERE ticket_id = $1 ORDER BY changed_at ASC',
    [ticketId],
  );
  return mapRows(r.rows);
}
