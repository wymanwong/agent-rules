import type { Database } from 'better-sqlite3';
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
  /** Extra WHERE fragments with placeholders (e.g. "(team_id = ? OR assignee_id = ?)") */
  rbacFragments?: string[];
  rbacParams?: unknown[];
}

export function insertTicket(
  db: Database,
  row: Omit<TicketRow, 'id' | 'ticket_number'> & { ticket_number?: string },
): number {
  const tempNum =
    row.ticket_number ?? `TEMP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const r = db
    .prepare(
      `INSERT INTO tickets (
        ticket_number, title, description, type, impact, urgency, priority, status,
        category, subcategory, requester_id, team_id, assignee_id, department,
        source, channel, ticket_extra_json, catalog_item_id, created_at, updated_at, due_at
      ) VALUES (
        @ticket_number, @title, @description, @type, @impact, @urgency, @priority, @status,
        @category, @subcategory, @requester_id, @team_id, @assignee_id, @department,
        @source, @channel, @ticket_extra_json, @catalog_item_id, @created_at, @updated_at, @due_at
      )`,
    )
    .run({
      ticket_number: tempNum,
      title: row.title,
      description: row.description,
      type: row.type,
      impact: row.impact,
      urgency: row.urgency,
      priority: row.priority,
      status: row.status,
      category: row.category ?? null,
      subcategory: row.subcategory ?? null,
      requester_id: row.requester_id,
      team_id: row.team_id ?? null,
      assignee_id: row.assignee_id ?? null,
      department: row.department ?? null,
      source: row.source,
      channel: row.channel ?? null,
      ticket_extra_json: row.ticket_extra_json ?? null,
      catalog_item_id: row.catalog_item_id ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      due_at: row.due_at ?? null,
    });
  return Number(r.lastInsertRowid);
}

export function updateTicketNumber(db: Database, id: number, ticketNumber: string): void {
  db.prepare('UPDATE tickets SET ticket_number = ?, updated_at = updated_at WHERE id = ?').run(ticketNumber, id);
}

export function patchTicket(
  db: Database,
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
): void {
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE tickets SET ${sets} WHERE id = @id`).run({ ...patch, id });
}

export function getTicketById(db: Database, id: number): TicketRow | undefined {
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as TicketRow | undefined;
}

/** Ticket row plus catalog offering name when linked via catalog_item_id */
export function getTicketByIdWithCatalog(db: Database, id: number): TicketDetailRow | undefined {
  return db
    .prepare(
      `SELECT t.*, sci.name AS catalog_service_name
       FROM tickets t
       LEFT JOIN service_catalog_items sci ON sci.id = t.catalog_item_id
       WHERE t.id = ?`,
    )
    .get(id) as TicketDetailRow | undefined;
}

export function listTickets(
  db: Database,
  filters: TicketFilters,
  limit: number,
  offset: number,
): { rows: TicketRow[]; total: number } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const add = (sql: string, ...vals: unknown[]) => {
    conditions.push(sql);
    params.push(...vals);
  };

  if (filters.rbacFragments?.length) {
    for (const frag of filters.rbacFragments) {
      conditions.push(`(${frag})`);
    }
    if (filters.rbacParams?.length) params.push(...filters.rbacParams);
  }

  if (filters.type) add('type = ?', filters.type);
  if (filters.status) add('status = ?', filters.status);
  if (filters.priority) add('priority = ?', filters.priority);
  if (filters.teamId !== undefined) add('team_id = ?', filters.teamId);
  if (filters.assigneeId !== undefined) add('assignee_id = ?', filters.assigneeId);
  if (filters.requesterId !== undefined) add('requester_id = ?', filters.requesterId);
  if (filters.category) add('category = ?', filters.category);
  if (filters.subcategory) add('subcategory = ?', filters.subcategory);
  if (filters.createdFrom) add('created_at >= ?', filters.createdFrom);
  if (filters.createdTo) add('created_at <= ?', filters.createdTo);
  if (filters.search) {
    add('(title LIKE ? OR description LIKE ? OR ticket_number LIKE ?)', `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const totalRow = db.prepare(`SELECT COUNT(*) as c FROM tickets ${where}`).get(...params) as { c: number };
  const rows = db
    .prepare(`SELECT * FROM tickets ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as TicketRow[];

  return { rows, total: totalRow.c };
}
