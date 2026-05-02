import type { Database } from 'better-sqlite3';

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

export function insertAssignment(
  db: Database,
  row: Omit<AssignmentHistoryRow, 'id'>,
): void {
  db.prepare(
    `INSERT INTO assignment_history (
      ticket_id, from_user_id, to_user_id, from_team_id, to_team_id, changed_by_id, changed_at
    ) VALUES (@ticket_id, @from_user_id, @to_user_id, @from_team_id, @to_team_id, @changed_by_id, @changed_at)`,
  ).run(row);
}

export function listByTicket(db: Database, ticketId: number): AssignmentHistoryRow[] {
  return db
    .prepare('SELECT * FROM assignment_history WHERE ticket_id = ? ORDER BY changed_at ASC')
    .all(ticketId) as AssignmentHistoryRow[];
}
