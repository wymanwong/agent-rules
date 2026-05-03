import type { Response } from 'express';
import type { PoolClient } from 'pg';
import fs from 'node:fs';
import type { AuthRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as ticketRepo from '../repositories/ticketRepository.js';
import * as commentRepo from '../repositories/commentRepository.js';
import * as assignRepo from '../repositories/assignmentHistoryRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import * as teamRepo from '../repositories/teamRepository.js';
import * as approvalRepo from '../repositories/approvalRepository.js';
import * as attachmentRepo from '../repositories/attachmentRepository.js';
import {
  buildListFiltersForRole,
  canAccessTicket,
  createTicket,
  patchTicket,
} from '../services/ticketService.js';
import { persistUploadedFiles, absoluteAttachmentPath, deleteAttachmentSync } from '../services/attachmentService.js';
import type { Impact, TicketType, Urgency } from '../models/types.js';
import type { Express } from 'express';
import { emitLive } from '../live/liveHub.js';

function mapTicketError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === 'NOT_FOUND') throw new HttpError(404, 'Ticket not found');
  if (msg === 'FORBIDDEN') throw new HttpError(403, 'Forbidden');
  if (msg === 'BAD_TRANSITION') throw new HttpError(400, 'Invalid status transition');
  if (msg === 'INVALID_STATUS') throw new HttpError(400, 'Invalid status for ticket type');
  throw e;
}

function parseMultipartExtra(body: Record<string, string>): Record<string, unknown> | undefined {
  const raw = body.extra_json ?? body.extra;
  if (raw === undefined || raw === '') return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'extra_json must be valid JSON');
  }
}

export function createTicketController(_db: PoolClient | null) {
  void _db;
  return {
    createMultipart: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const body = req.body as Record<string, string>;
      const type = body.type as TicketType;
      const title = body.title?.trim();
      const description = body.description?.trim();
      const impact = body.impact as Impact;
      const urgency = body.urgency as Urgency;
      const source = body.source?.trim() || 'Portal';
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];

      if (!title || !description || !type || !impact || !urgency) {
        throw new HttpError(400, 'Missing required fields');
      }
      if (req.user.role === 'EndUser' && type !== 'Incident' && type !== 'ServiceRequest') {
        throw new HttpError(400, 'Invalid type');
      }

      const requester = await userRepo.findUserById(null, req.user.userId);
      let ticket_extra_json: string | undefined;
      const extraObj = parseMultipartExtra(body as unknown as Record<string, string>);
      if (extraObj !== undefined) ticket_extra_json = JSON.stringify(extraObj);

      const ticket = await createTicket(
        null,
        {
          title,
          description,
          type,
          impact,
          urgency,
          category: body.category?.trim() || undefined,
          subcategory: body.subcategory?.trim() || undefined,
          source,
          channel: body.channel?.trim() || undefined,
          team_id: body.team_id ? Number(body.team_id) : undefined,
          assignee_id: body.assignee_id ? Number(body.assignee_id) : undefined,
          ticket_extra_json,
        },
        req.user.userId,
        requester?.department ?? null,
      );

      await persistUploadedFiles(null, ticket.id, req.user.userId, files);

      console.info(`Ticket created ${ticket.ticket_number} priority=${ticket.priority}`);
      if (ticket.priority === 'P1') console.warn(`P1 ticket ${ticket.ticket_number}`);
      emitLive({ type: 'tickets', ticketId: ticket.id, at: new Date().toISOString() });
      res.status(201).json({ ticket });
    },

    create: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const body = req.body as Record<string, unknown>;
      const type = body.type as TicketType;
      const title = body.title as string;
      const description = body.description as string;
      const impact = body.impact as Impact;
      const urgency = body.urgency as Urgency;
      const source = (body.source as string) || 'Portal';
      if (!title || !description || !type || !impact || !urgency) {
        throw new HttpError(400, 'Missing required fields');
      }
      if (req.user.role === 'EndUser' && type !== 'Incident' && type !== 'ServiceRequest') {
        throw new HttpError(400, 'Invalid type');
      }
      const requester = await userRepo.findUserById(null, req.user.userId);
      const ticket = await createTicket(
        null,
        {
          title,
          description,
          type,
          impact,
          urgency,
          category: body.category as string | undefined,
          subcategory: body.subcategory as string | undefined,
          source,
          channel: body.channel as string | undefined,
          team_id: body.team_id != null ? Number(body.team_id) : undefined,
          assignee_id: body.assignee_id != null ? Number(body.assignee_id) : undefined,
          ticket_extra_json:
            typeof body.ticket_extra_json === 'string'
              ? body.ticket_extra_json
              : body.extra != null
                ? JSON.stringify(body.extra)
                : undefined,
        },
        req.user.userId,
        requester?.department ?? null,
      );
      console.info(`Ticket created ${ticket.ticket_number} priority=${ticket.priority}`);
      if (ticket.priority === 'P1') console.warn(`P1 ticket ${ticket.ticket_number}`);
      emitLive({ type: 'tickets', ticketId: ticket.id, at: new Date().toISOString() });
      res.status(201).json({ ticket });
    },

    list: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const q = req.query;
      const limit = Math.min(Number(q.limit) || 50, 100);
      const page = Math.max(Number(q.page) || 1, 1);
      const offset = (page - 1) * limit;

      const rbac = buildListFiltersForRole(req.user);
      const filters: ticketRepo.TicketFilters = {
        ...rbac,
        type: q.type as string | undefined,
        status: q.status as string | undefined,
        priority: q.priority as string | undefined,
        teamId: q.teamId !== undefined ? Number(q.teamId) : undefined,
        assigneeId: q.assigneeId !== undefined ? Number(q.assigneeId) : undefined,
        requesterId: q.requesterId !== undefined ? Number(q.requesterId) : undefined,
        category: q.category as string | undefined,
        subcategory: q.subcategory as string | undefined,
        createdFrom: q.createdFrom as string | undefined,
        createdTo: q.createdTo as string | undefined,
        search: q.search as string | undefined,
      };

      const { rows, total } = await ticketRepo.listTickets(null, filters, limit, offset);
      res.json({ tickets: rows, total, page, limit });
    },

    getById: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const id = Number(req.params.id);
      const ticketRow = await ticketRepo.getTicketByIdWithCatalog(null, id);
      if (!ticketRow) throw new HttpError(404, 'Ticket not found');
      if (!canAccessTicket(null, req.user, ticketRow)) throw new HttpError(403, 'Forbidden');

      const { catalog_service_name: catName, ...ticket } = ticketRow;

      const requester = await userRepo.findUserById(null, ticket.requester_id);
      const assignee = ticket.assignee_id ? await userRepo.findUserById(null, ticket.assignee_id) : undefined;
      const team = ticket.team_id ? await teamRepo.findTeamById(null, ticket.team_id) : undefined;

      let comments = await commentRepo.listCommentsByTicket(null, id);
      if (req.user.role === 'EndUser') {
        comments = comments.filter((c) => c.is_internal === 0);
      }

      const history = await assignRepo.listByTicket(null, id);
      const approvals = await approvalRepo.listByTicket(null, id);
      const attachments = await attachmentRepo.listByTicket(null, id);

      const strip = (u?: userRepo.UserRow) => {
        if (!u) return undefined;
        const { password_hash: _, ...s } = u;
        return s;
      };

      const catalog_item =
        ticket.catalog_item_id != null ? { id: ticket.catalog_item_id, name: catName ?? null } : null;

      res.json({
        ticket,
        catalog_item,
        requester: strip(requester),
        assignee: strip(assignee),
        team,
        comments,
        assignment_history: history,
        approvals,
        attachments,
      });
    },

    downloadAttachment: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const ticketId = Number(req.params.ticketId);
      const attachmentId = Number(req.params.attachmentId);
      const ticket = await ticketRepo.getTicketById(null, ticketId);
      if (!ticket) throw new HttpError(404, 'Ticket not found');
      if (!canAccessTicket(null, req.user, ticket)) throw new HttpError(403, 'Forbidden');

      const att = await attachmentRepo.findById(null, attachmentId);
      if (!att || att.ticket_id !== ticketId) throw new HttpError(404, 'Attachment not found');

      const abs = absoluteAttachmentPath(att.stored_relative_path);
      if (!fs.existsSync(abs)) throw new HttpError(404, 'File missing on disk');

      res.setHeader('Content-Type', att.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.original_filename)}"`);
      res.sendFile(abs, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      });
    },

    addAttachmentsMultipart: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const ticketId = Number(req.params.id);
      const ticket = await ticketRepo.getTicketById(null, ticketId);
      if (!ticket) throw new HttpError(404, 'Ticket not found');
      if (!canAccessTicket(null, req.user, ticket)) throw new HttpError(403, 'Forbidden');

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) throw new HttpError(400, 'No files uploaded');

      await persistUploadedFiles(null, ticketId, req.user.userId, files);
      const attachments = await attachmentRepo.listByTicket(null, ticketId);
      emitLive({ type: 'ticket', ticketId, at: new Date().toISOString() });
      res.status(201).json({ attachments });
    },

    deleteAttachment: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const ticketId = Number(req.params.ticketId);
      const attachmentId = Number(req.params.attachmentId);
      const ticket = await ticketRepo.getTicketById(null, ticketId);
      if (!ticket) throw new HttpError(404, 'Ticket not found');
      if (!canAccessTicket(null, req.user, ticket)) throw new HttpError(403, 'Forbidden');

      const att = await attachmentRepo.findById(null, attachmentId);
      if (!att || att.ticket_id !== ticketId) throw new HttpError(404, 'Attachment not found');

      if (req.user.role === 'EndUser') {
        if (ticket.requester_id !== req.user.userId) throw new HttpError(403, 'Forbidden');
      }

      const removed = await deleteAttachmentSync(null, attachmentId);
      if (!removed) throw new HttpError(404, 'Attachment not found');
      emitLive({ type: 'ticket', ticketId, at: new Date().toISOString() });
      res.json({ ok: true });
    },

    patch: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const id = Number(req.params.id);
      try {
        const ticket = await patchTicket(null, id, req.body as Parameters<typeof patchTicket>[2], req.user);
        emitLive({ type: 'ticket', ticketId: id, at: new Date().toISOString() });
        emitLive({ type: 'tickets', ticketId: id, at: new Date().toISOString() });
        res.json({ ticket });
      } catch (e) {
        mapTicketError(e);
      }
    },

    addComment: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const id = Number(req.params.id);
      const ticket = await ticketRepo.getTicketById(null, id);
      if (!ticket) throw new HttpError(404, 'Ticket not found');
      if (!canAccessTicket(null, req.user, ticket)) throw new HttpError(403, 'Forbidden');

      const body = req.body as { body?: string; is_internal?: boolean };
      if (!body.body?.trim()) throw new HttpError(400, 'body required');

      let isInternal = body.is_internal ? 1 : 0;
      if (req.user.role === 'EndUser') {
        isInternal = 0;
      }

      const cid = await commentRepo.insertComment(null, {
        ticket_id: id,
        author_id: req.user.userId,
        is_internal: isInternal,
        body: body.body.trim(),
        created_at: new Date().toISOString(),
      });
      emitLive({ type: 'ticket', ticketId: id, at: new Date().toISOString() });
      res.status(201).json({ id: cid });
    },

    listApprovals: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const id = Number(req.params.id);
      const ticket = await ticketRepo.getTicketById(null, id);
      if (!ticket) throw new HttpError(404, 'Ticket not found');
      if (!canAccessTicket(null, req.user, ticket)) throw new HttpError(403, 'Forbidden');
      res.json({ approvals: await approvalRepo.listByTicket(null, id) });
    },

    approvalDecision: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const ticketId = Number(req.params.id);
      const approvalId = Number(req.params.approvalId);
      const ticket = await ticketRepo.getTicketById(null, ticketId);
      if (!ticket) throw new HttpError(404, 'Ticket not found');

      const appr = await approvalRepo.findById(null, approvalId);
      if (!appr || appr.ticket_id !== ticketId) throw new HttpError(404, 'Approval not found');

      const isApprover = req.user.userId === appr.approver_user_id;
      if (!isApprover && req.user.role !== 'Admin') throw new HttpError(403, 'Forbidden');

      const body = req.body as { status?: string; comment?: string };
      const status = body.status as string;
      if (status !== 'Approved' && status !== 'Rejected') {
        throw new HttpError(400, 'status must be Approved or Rejected');
      }

      const now = new Date().toISOString();
      await approvalRepo.updateApproval(null, approvalId, {
        status,
        comment: body.comment ?? null,
        decided_at: now,
      });

      if (status === 'Rejected') {
        await ticketRepo.patchTicket(null, ticketId, { status: 'Closed', updated_at: now });
      } else if (await approvalRepo.allApprovedForTicket(null, ticketId)) {
        await ticketRepo.patchTicket(null, ticketId, { status: 'Approved', updated_at: now });
      }

      emitLive({ type: 'ticket', ticketId, at: now });
      emitLive({ type: 'tickets', ticketId, at: now });
      res.json({ ok: true });
    },
  };
}
