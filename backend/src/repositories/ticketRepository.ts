import type { PoolClient } from 'pg';
import { mapRows, query } from '../db/pg.js';
import type { TicketType } from '../models/types.js';

export interface TicketRow {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  type: TicketType;
  impact: string;
  urgency: string;
  priority: string;
  status: string;
  category: string | null;
  subcategory: string | null;
  requester_id: number;
  team_id: number | null;
  assignee_id: number | null;
  department: string | null;
  source: string;
  channel: string | null;
  ticket_extra_json: string | null;
  catalog_item_id: number | null;
  created_at: string;
  updated_at: string;
  due_at: string | null;
}

export type TicketDetailRow = TicketRow & { catalog_service_name?: string | null };

export interface TicketFilters {
  type?: string;
  status?: string;
  priority?: string;
  teamId?: number;
  assigneeId?: number;
  requesterId?: number;
  category?: string;
  subcategory?: string;
  createdFrom?: string;
  createdTo?: string;
  search?: string;
  rbacFragments?: string[];
  rbacParams?: unknown[];
}

export async function insertTicket(
  db: PoolClient | null,
  row: Omit<TicketRow, 'id' | 'ticket_number'> & { ticket_number?: string },
): Promise<number> {
  void db;
  const tempNum =
    row.ticket_number ?? `TEMP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const r = await query<{ id: number }>(
    `INSERT INTO tickets (
        ticket_number, title, description, type, impact, urgency, priority, status,
        category, subcategory, requester_id, team_id, assignee_id, department,
        source, channel, ticket_extra_json, catalog_item_id, created_at, updated_at, due_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING id`,
    [
      tempNum,
      row.title,
      row.description,
      row.type,
      row.impact,
      row.urgency,
      row.priority,
      row.status,
      row.category ?? null,
      row.subcategory ?? null,
      row.requester_id,
      row.team_id ?? null,
      row.assignee_id ?? null,
      row.department ?? null,
      row.source,
      row.channel ?? null,
      row.ticket_extra_json ?? null,
      row.catalog_item_id ?? null,
      row.created_at,
      row.updated_at,
      row.due_at ?? null,
    ],
  );
  return r.rows[0]!.id;
}

export async function updateTicketNumber(db: PoolClient | null, id: number, ticketNumber: string): Promise<void> {
  void db;
  await query('UPDATE tickets SET ticket_number = $1 WHERE id = $2', [ticketNumber, id]);
}

export async function patchTicket(
  db: PoolClient | null,
  id: number,
  patch: Partial<
    Pick<
      TicketRow,
      | 'title'
      | 'description'
      | 'impact'
      | 'urgency'
      | 'priority'
      | 'status'
      | 'category'
      | 'subcategory'
      | 'team_id'
      | 'assignee_id'
      | 'due_at'
      | 'updated_at'
    >
  >,
): Promise<void> {
  void db;
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${String(k)} = $${i + 2}`).join(', ');
  const vals = keys.map((k) => patch[k]);
  await query(`UPDATE tickets SET ${sets} WHERE id = $1`, [id, ...vals]);
}

export async function getTicketById(db: PoolClient | null, id: number): Promise<TicketRow | undefined> {
  void db;
  const r = await query<TicketRow>('SELECT * FROM tickets WHERE id = $1', [id]);
  return mapRows(r.rows)[0];
}

export async function getTicketByIdWithCatalog(db: PoolClient | null, id: number): Promise<TicketDetailRow | undefined> {
  void db;
  const r = await query<TicketDetailRow>(
    `SELECT t.*, sci.name AS catalog_service_name
     FROM tickets t
     LEFT JOIN service_catalog_items sci ON sci.id = t.catalog_item_id
     WHERE t.id = $1`,
    [id],
  );
  return mapRows(r.rows)[0];
}

export async function listTickets(
  db: PoolClient | null,
  filters: TicketFilters,
  limit: number,
  offset: number,
): Promise<{ rows: TicketRow[]; total: number }> {
  void db;
  const conditions: string[] = [];
  const params: unknown[] = [];

  const pushCond = (sql: string, ...vals: unknown[]) => {
    const start = params.length + 1;
    let n = 0;
    const frag = sql.replace(/\?/g, () => `$${start + n++}`);
    params.push(...vals);
    conditions.push(frag);
  };

  if (filters.rbacFragments?.length) {
    for (const frag of filters.rbacFragments) {
      conditions.push(`(${frag})`);
    }
    if (filters.rbacParams?.length) params.push(...filters.rbacParams);
  }

  if (filters.type) pushCond('type = ?', filters.type);
  if (filters.status) pushCond('status = ?', filters.status);
  if (filters.priority) pushCond('priority = ?', filters.priority);
  if (filters.teamId !== undefined) pushCond('team_id = ?', filters.teamId);
  if (filters.assigneeId !== undefined) pushCond('assignee_id = ?', filters.assigneeId);
  if (filters.requesterId !== undefined) pushCond('requester_id = ?', filters.requesterId);
  if (filters.category) pushCond('category = ?', filters.category);
  if (filters.subcategory) pushCond('subcategory = ?', filters.subcategory);
  if (filters.createdFrom) pushCond('created_at >= ?', filters.createdFrom);
  if (filters.createdTo) pushCond('created_at <= ?', filters.createdTo);
  if (filters.search) {
    const s = `%${filters.search}%`;
    pushCond('(title ILIKE ? OR description ILIKE ? OR ticket_number ILIKE ?)', s, s, s);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const lim = Math.max(0, Math.min(1000, Math.floor(Number(limit))));
  const off = Math.max(0, Math.floor(Number(offset)));
  const totalRow = await query<{ c: string }>(`SELECT COUNT(*)::text as c FROM tickets ${where}`, params);
  const total = Number(totalRow.rows[0]?.c ?? 0);
  const rowsR = await query<TicketRow>(
    `SELECT * FROM tickets ${where} ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}`,
    params,
  );
  return { rows: mapRows(rowsR.rows), total };
}
