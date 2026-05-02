import type { Database } from 'better-sqlite3';

export interface AttachmentRow {
  id: number;
  ticket_id: number;
  uploaded_by_user_id: number;
  original_filename: string;
  stored_relative_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export function insertAttachment(db: Database, row: Omit<AttachmentRow, 'id'>): number {
  const r = db
    .prepare(
      `INSERT INTO ticket_attachments (
        ticket_id, uploaded_by_user_id, original_filename, stored_relative_path,
        mime_type, size_bytes, created_at
      ) VALUES (
        @ticket_id, @uploaded_by_user_id, @original_filename, @stored_relative_path,
        @mime_type, @size_bytes, @created_at
      )`,
    )
    .run(row);
  return Number(r.lastInsertRowid);
}

export function findById(db: Database, id: number): AttachmentRow | undefined {
  return db.prepare('SELECT * FROM ticket_attachments WHERE id = ?').get(id) as AttachmentRow | undefined;
}

export function listByTicket(db: Database, ticketId: number): AttachmentRow[] {
  return db
    .prepare('SELECT * FROM ticket_attachments WHERE ticket_id = ? ORDER BY id ASC')
    .all(ticketId) as AttachmentRow[];
}

export function deleteAttachment(db: Database, id: number): void {
  db.prepare('DELETE FROM ticket_attachments WHERE id = ?').run(id);
}
