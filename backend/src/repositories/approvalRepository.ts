import type { PoolClient } from 'pg';
import { mapRows, query } from '../db/pg.js';

export interface ApprovalRow {
  id: number;
  ticket_id: number;
  approver_user_id: number;
  status: string;
  comment: string | null;
  created_at: string;
  decided_at: string | null;
}

export async function insertApproval(db: PoolClient | null, row: Omit<ApprovalRow, 'id'>): Promise<number> {
  void db;
  const r = await query<{ id: number }>(
    `INSERT INTO approvals (ticket_id, approver_user_id, status, comment, created_at, decided_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [row.ticket_id, row.approver_user_id, row.status, row.comment, row.created_at, row.decided_at],
  );
  return r.rows[0]!.id;
}

export async function listByTicket(db: PoolClient | null, ticketId: number): Promise<ApprovalRow[]> {
  void db;
  const r = await query<ApprovalRow>('SELECT * FROM approvals WHERE ticket_id = $1 ORDER BY id', [ticketId]);
  return mapRows(r.rows);
}

export async function findById(db: PoolClient | null, id: number): Promise<ApprovalRow | undefined> {
  void db;
  const r = await query<ApprovalRow>('SELECT * FROM approvals WHERE id = $1', [id]);
  return mapRows(r.rows)[0];
}

export async function updateApproval(
  db: PoolClient | null,
  id: number,
  patch: Partial<Pick<ApprovalRow, 'status' | 'comment' | 'decided_at'>>,
): Promise<void> {
  void db;
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${String(k)} = $${i + 2}`).join(', ');
  const vals = keys.map((k) => patch[k]);
  await query(`UPDATE approvals SET ${sets} WHERE id = $1`, [id, ...vals]);
}

export async function allApprovedForTicket(db: PoolClient | null, ticketId: number): Promise<boolean> {
  void db;
  const r = await query<{ status: string }>('SELECT status FROM approvals WHERE ticket_id = $1', [ticketId]);
  if (r.rows.length === 0) return false;
  return r.rows.every((row) => row.status === 'Approved');
}

export async function anyRejected(db: PoolClient | null, ticketId: number): Promise<boolean> {
  void db;
  const r = await query<{ status: string }>('SELECT status FROM approvals WHERE ticket_id = $1', [ticketId]);
  return r.rows.some((row) => row.status === 'Rejected');
}
