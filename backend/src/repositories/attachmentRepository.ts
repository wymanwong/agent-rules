import type { PoolClient } from 'pg';
import { mapRows, query } from '../db/pg.js';

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

export async function insertAttachment(db: PoolClient | null, row: Omit<AttachmentRow, 'id'>): Promise<number> {
  void db;
  const r = await query<{ id: number }>(
    `INSERT INTO ticket_attachments (
        ticket_id, uploaded_by_user_id, original_filename, stored_relative_path,
        mime_type, size_bytes, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      row.ticket_id,
      row.uploaded_by_user_id,
      row.original_filename,
      row.stored_relative_path,
      row.mime_type,
      row.size_bytes,
      row.created_at,
    ],
  );
  return r.rows[0]!.id;
}

export async function findById(db: PoolClient | null, id: number): Promise<AttachmentRow | undefined> {
  void db;
  const r = await query<AttachmentRow>('SELECT * FROM ticket_attachments WHERE id = $1', [id]);
  return mapRows(r.rows)[0];
}

export async function listByTicket(db: PoolClient | null, ticketId: number): Promise<AttachmentRow[]> {
  void db;
  const r = await query<AttachmentRow>('SELECT * FROM ticket_attachments WHERE ticket_id = $1 ORDER BY id ASC', [ticketId]);
  return mapRows(r.rows);
}

export async function deleteAttachment(db: PoolClient | null, id: number): Promise<void> {
  void db;
  await query('DELETE FROM ticket_attachments WHERE id = $1', [id]);
}
