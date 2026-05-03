import type { PoolClient } from 'pg';
import { mapRows, query } from '../db/pg.js';

export interface CommentRow {
  id: number;
  ticket_id: number;
  author_id: number;
  is_internal: number;
  body: string;
  created_at: string;
}

export async function insertComment(db: PoolClient | null, row: Omit<CommentRow, 'id'>): Promise<number> {
  void db;
  const r = await query<{ id: number }>(
    `INSERT INTO comments (ticket_id, author_id, is_internal, body, created_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [row.ticket_id, row.author_id, row.is_internal, row.body, row.created_at],
  );
  return r.rows[0]!.id;
}

export async function listCommentsByTicket(db: PoolClient | null, ticketId: number): Promise<CommentRow[]> {
  void db;
  const r = await query<CommentRow>('SELECT * FROM comments WHERE ticket_id = $1 ORDER BY created_at ASC', [ticketId]);
  return mapRows(r.rows);
}
