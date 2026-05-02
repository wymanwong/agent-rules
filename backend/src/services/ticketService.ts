import type { Database } from 'better-sqlite3';
import type { Impact, JwtPayload, Priority, TicketType, Urgency, UserRole } from '../models/types.js';
import * as ticketRepo from '../repositories/ticketRepository.js';
import * as assignRepo from '../repositories/assignmentHistoryRepository.js';
import { computeDueAtIso, computePriority, formatTicketNumber } from './prioritySla.js';
import { canTransition, isValidStatusForType } from './ticketWorkflow.js';

export function buildListFiltersForRole(user: JwtPayload): Pick<ticketRepo.TicketFilters, 'rbacFragments' | 'rbacParams'> {
  if (user.role === 'Admin') {
    return {};
  }
  if (user.role === 'EndUser') {
    return {
      rbacFragments: ['requester_id = ?'],
      rbacParams: [user.userId],
    };
  }
  const teamId = user.teamId;
  if (teamId != null) {
    return {
      rbacFragments: ['(team_id = ? OR assignee_id = ?)'],
      rbacParams: [teamId, user.userId],
    };
  }
  return {
    rbacFragments: ['assignee_id = ?'],
    rbacParams: [user.userId],
  };
}

export function canAccessTicket(db: Database, user: JwtPayload, ticket: ticketRepo.TicketRow): boolean {
  if (user.role === 'Admin') return true;
  if (user.role === 'EndUser') return ticket.requester_id === user.userId;
  if (user.role === 'IT') {
    if (ticket.assignee_id === user.userId) return true;
    if (user.teamId != null && ticket.team_id === user.teamId) return true;
  }
  return false;
}

export function createTicket(
  db: Database,
  input: {
    title: string;
    description: string;
    type: TicketType;
    impact: Impact;
    urgency: Urgency;
    category?: string;
    subcategory?: string;
    source: string;
    channel?: string;
    team_id?: number | null;
    assignee_id?: number | null;
    ticket_extra_json?: string | null;
    status?: string;
    department?: string | null;
  },
  requesterId: number,
  requesterDepartment: string | null,
): ticketRepo.TicketRow {
  const now = new Date().toISOString();
  const priority = computePriority(input.impact, input.urgency);
  const dueAt = computeDueAtIso(new Date(), priority);
  const status = input.status ?? 'New';

  const id = ticketRepo.insertTicket(db, {
    title: input.title,
    description: input.description,
    type: input.type,
    impact: input.impact,
    urgency: input.urgency,
    priority,
    status,
    category: input.category ?? null,
    subcategory: input.subcategory ?? null,
    requester_id: requesterId,
    team_id: input.team_id ?? null,
    assignee_id: input.assignee_id ?? null,
    department: input.department ?? requesterDepartment,
    source: input.source,
    channel: input.channel ?? null,
    ticket_extra_json: input.ticket_extra_json ?? null,
    created_at: now,
    updated_at: now,
    due_at: dueAt,
  });

  const ticketNumber = formatTicketNumber(id);
  ticketRepo.updateTicketNumber(db, id, ticketNumber);

  const row = ticketRepo.getTicketById(db, id);
  if (!row) throw new Error('Ticket insert failed');
  return row;
}

export interface PatchTicketInput {
  status?: string;
  priority?: Priority;
  impact?: Impact;
  urgency?: Urgency;
  team_id?: number | null;
  assignee_id?: number | null;
  due_at?: string | null;
  title?: string;
  description?: string;
  category?: string | null;
  subcategory?: string | null;
}

export function patchTicket(
  db: Database,
  ticketId: number,
  patch: PatchTicketInput,
  actor: JwtPayload,
): ticketRepo.TicketRow {
  const existing = ticketRepo.getTicketById(db, ticketId);
  if (!existing) throw new Error('NOT_FOUND');

  if (!canAccessTicket(db, actor, existing)) throw new Error('FORBIDDEN');

  const role = actor.role as UserRole;
  const now = new Date().toISOString();

  if (role === 'EndUser') {
    if (patch.status === 'Closed') {
      const ok =
        (existing.type === 'Incident' && existing.status === 'Resolved') ||
        (existing.type === 'ServiceRequest' && existing.status === 'Completed');
      if (!ok) throw new Error('BAD_TRANSITION');
      ticketRepo.patchTicket(db, ticketId, { status: 'Closed', updated_at: now });
      return ticketRepo.getTicketById(db, ticketId)!;
    }
    throw new Error('FORBIDDEN');
  }

  let impact = existing.impact as Impact;
  let urgency = existing.urgency as Urgency;
  let priority = existing.priority as Priority;

  if (patch.impact !== undefined) impact = patch.impact;
  if (patch.urgency !== undefined) urgency = patch.urgency;
  if (patch.impact !== undefined || patch.urgency !== undefined) {
    priority = computePriority(impact, urgency);
  }
  if (patch.priority !== undefined && role === 'Admin') {
    priority = patch.priority;
  }

  let dueAt = existing.due_at;
  if (patch.due_at !== undefined && role === 'Admin') {
    dueAt = patch.due_at;
  } else if (patch.impact !== undefined || patch.urgency !== undefined) {
    dueAt = computeDueAtIso(new Date(), priority);
  }

  if (patch.status !== undefined) {
    if (!isValidStatusForType(existing.type as TicketType, patch.status)) {
      throw new Error('INVALID_STATUS');
    }
    if (!canTransition(existing.type as TicketType, existing.status, patch.status)) {
      throw new Error('BAD_TRANSITION');
    }
  }

  const teamChanged =
    patch.team_id !== undefined && patch.team_id !== existing.team_id;
  const assigneeChanged =
    patch.assignee_id !== undefined && patch.assignee_id !== existing.assignee_id;

  if (teamChanged || assigneeChanged) {
    assignRepo.insertAssignment(db, {
      ticket_id: ticketId,
      from_user_id: existing.assignee_id,
      to_user_id: patch.assignee_id !== undefined ? patch.assignee_id : existing.assignee_id,
      from_team_id: existing.team_id,
      to_team_id: patch.team_id !== undefined ? patch.team_id : existing.team_id,
      changed_by_id: actor.userId,
      changed_at: now,
    });
  }

  ticketRepo.patchTicket(db, ticketId, {
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.team_id !== undefined ? { team_id: patch.team_id } : {}),
    ...(patch.assignee_id !== undefined ? { assignee_id: patch.assignee_id } : {}),
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.subcategory !== undefined ? { subcategory: patch.subcategory } : {}),
    impact,
    urgency,
    priority,
    due_at: dueAt ?? null,
    updated_at: now,
  });

  const breached =
    existing.due_at &&
    new Date(existing.due_at) < new Date() &&
    !['Resolved', 'Closed', 'Completed'].includes(existing.status);
  if (breached) {
    console.warn(`SLA breached ticket ${existing.ticket_number}`);
  }

  return ticketRepo.getTicketById(db, ticketId)!;
}
