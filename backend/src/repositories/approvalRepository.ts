import type { Database } from 'better-sqlite3';

export interface ApprovalRow {
  id: number;
  ticket_id: number;
  approver_user_id: number;
  status: string;
  comment: string | null;
  created_at: string;
  decided_at: string | null;
}

export function insertApproval(db: Database, row: Omit<ApprovalRow, 'id'>): number {
  const r = db
    .prepare(
      `INSERT INTO approvals (ticket_id, approver_user_id, status, comment, created_at, decided_at)
       VALUES (@ticket_id, @approver_user_id, @status, @comment, @created_at, @decided_at)`,
    )
    .run(row);
  return Number(r.lastInsertRowid);
}

export function listByTicket(db: Database, ticketId: number): ApprovalRow[] {
  return db.prepare('SELECT * FROM approvals WHERE ticket_id = ? ORDER BY id').all(ticketId) as ApprovalRow[];
}

export function findById(db: Database, id: number): ApprovalRow | undefined {
  return db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as ApprovalRow | undefined;
}

export function updateApproval(
  db: Database,
  id: number,
  patch: Partial<Pick<ApprovalRow, 'status' | 'comment' | 'decided_at'>>,
): void {
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE approvals SET ${sets} WHERE id = @id`).run({ ...patch, id });
}

export function allApprovedForTicket(db: Database, ticketId: number): boolean {
  const rows = db.prepare('SELECT status FROM approvals WHERE ticket_id = ?').all(ticketId) as { status: string }[];
  if (rows.length === 0) return false;
  return rows.every((r) => r.status === 'Approved');
}

export function anyRejected(db: Database, ticketId: number): boolean {
  const rows = db.prepare('SELECT status FROM approvals WHERE ticket_id = ?').all(ticketId) as { status: string }[];
  return rows.some((r) => r.status === 'Rejected');
}
