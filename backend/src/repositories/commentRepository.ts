import type { Database } from 'better-sqlite3';

export interface CommentRow {
  id: number;
  ticket_id: number;
  author_id: number;
  is_internal: number;
  body: string;
  created_at: string;
}

export function insertComment(
  db: Database,
  row: Omit<CommentRow, 'id'>,
): number {
  const r = db
    .prepare(
      `INSERT INTO comments (ticket_id, author_id, is_internal, body, created_at)
       VALUES (@ticket_id, @author_id, @is_internal, @body, @created_at)`,
    )
    .run(row);
  return Number(r.lastInsertRowid);
}

export function listCommentsByTicket(db: Database, ticketId: number): CommentRow[] {
  return db.prepare('SELECT * FROM comments WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId) as CommentRow[];
}
