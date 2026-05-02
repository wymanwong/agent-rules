import type { Response } from 'express';
import type { Database } from 'better-sqlite3';
import type { AuthRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as catalogRepo from '../repositories/catalogRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import * as approvalRepo from '../repositories/approvalRepository.js';
import { createTicket } from '../services/ticketService.js';
import type { Impact, Urgency } from '../models/types.js';

export function createCatalogController(db: Database) {
  return {
    listPublished: (_req: AuthRequest, res: Response): void => {
      const items = catalogRepo.listPublished(db);
      res.json({ items });
    },

    listAll: (_req: AuthRequest, res: Response): void => {
      const items = catalogRepo.listAll(db);
      res.json({ items });
    },

    create: (req: AuthRequest, res: Response): void => {
      const b = req.body as Record<string, unknown>;
      const now = new Date().toISOString();
      const id = catalogRepo.insertItem(db, {
        name: String(b.name ?? ''),
        description: String(b.description ?? ''),
        type: String(b.type ?? 'ServiceRequest'),
        default_category: b.default_category != null ? String(b.default_category) : null,
        default_subcategory: b.default_subcategory != null ? String(b.default_subcategory) : null,
        default_impact: b.default_impact != null ? String(b.default_impact) : 'SingleUser',
        default_urgency: b.default_urgency != null ? String(b.default_urgency) : 'Medium',
        default_priority: b.default_priority != null ? String(b.default_priority) : null,
        requires_manager_approval: b.requires_manager_approval ? 1 : 0,
        form_schema_json:
          typeof b.form_schema_json === 'string' ? b.form_schema_json : JSON.stringify(b.form_schema_json ?? {}),
        is_published: b.is_published !== undefined && !b.is_published ? 0 : 1,
        created_at: now,
        updated_at: now,
      });
      res.status(201).json({ id });
    },

    update: (req: AuthRequest, res: Response): void => {
      const id = Number(req.params.id);
      const existing = catalogRepo.findById(db, id);
      if (!existing) throw new HttpError(404, 'Catalog item not found');
      const b = req.body as Record<string, unknown>;
      const patch: Partial<Omit<catalogRepo.CatalogItemRow, 'id'>> = { updated_at: new Date().toISOString() };
      if (b.name !== undefined) patch.name = String(b.name);
      if (b.description !== undefined) patch.description = String(b.description);
      if (b.default_category !== undefined) patch.default_category = b.default_category as string | null;
      if (b.default_subcategory !== undefined) patch.default_subcategory = b.default_subcategory as string | null;
      if (b.default_impact !== undefined) patch.default_impact = String(b.default_impact);
      if (b.default_urgency !== undefined) patch.default_urgency = String(b.default_urgency);
      if (b.default_priority !== undefined) patch.default_priority = b.default_priority as string | null;
      if (b.requires_manager_approval !== undefined) patch.requires_manager_approval = b.requires_manager_approval ? 1 : 0;
      if (b.form_schema_json !== undefined)
        patch.form_schema_json =
          typeof b.form_schema_json === 'string' ? b.form_schema_json : JSON.stringify(b.form_schema_json);
      if (b.is_published !== undefined) patch.is_published = b.is_published ? 1 : 0;
      catalogRepo.updateItem(db, id, patch);
      res.json({ ok: true });
    },

    delete: (req: AuthRequest, res: Response): void => {
      const id = Number(req.params.id);
      catalogRepo.deleteItem(db, id);
      res.json({ ok: true });
    },

    requestFromCatalog: (req: AuthRequest, res: Response): void => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const catalogId = Number(req.params.id);
      const item = catalogRepo.findById(db, catalogId);
      if (!item || item.is_published !== 1) throw new HttpError(404, 'Catalog item not found');

      const requester = userRepo.findUserById(db, req.user.userId);
      const body = req.body as { title?: string; description?: string; extra?: Record<string, unknown> };

      const impact = (item.default_impact ?? 'SingleUser') as Impact;
      const urgency = (item.default_urgency ?? 'Medium') as Urgency;
      const title = body.title?.trim() || item.name;
      const description = body.description?.trim() || item.description;
      const rawBody = req.body as Record<string, unknown>;
      const extraJson =
        body.extra != null
          ? JSON.stringify(body.extra)
          : rawBody.extra_json != null
            ? String(rawBody.extra_json)
            : null;

      let status = 'New';
      if (item.requires_manager_approval === 1) {
        status = 'AwaitingApproval';
      }

      const ticket = createTicket(
        db,
        {
          title,
          description,
          type: 'ServiceRequest',
          impact,
          urgency,
          category: item.default_category ?? undefined,
          subcategory: item.default_subcategory ?? undefined,
          source: 'Portal',
          ticket_extra_json: extraJson,
          status,
        },
        req.user.userId,
        requester?.department ?? null,
      );

      if (item.requires_manager_approval === 1) {
        const approverId = resolveApproverUserId(db, requester);
        approvalRepo.insertApproval(db, {
          ticket_id: ticket.id,
          approver_user_id: approverId,
          status: 'Pending',
          comment: null,
          created_at: new Date().toISOString(),
          decided_at: null,
        });
      }

      res.status(201).json({ ticket });
    },
  };
}

function resolveApproverUserId(db: Database, requester: userRepo.UserRow | undefined): number {
  const admins = db.prepare(`SELECT id FROM users WHERE role = 'Admin' ORDER BY id LIMIT 1`).get() as { id: number } | undefined;
  if (admins) return admins.id;
  const anyIt = db.prepare(`SELECT id FROM users WHERE role = 'IT' ORDER BY id LIMIT 1`).get() as { id: number } | undefined;
  if (anyIt) return anyIt.id;
  throw new HttpError(500, 'No approver configured');
}
