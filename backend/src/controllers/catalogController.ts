import type { Response } from 'express';
import type { Express } from 'express';
import type { Database } from 'better-sqlite3';
import type { AuthRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as catalogRepo from '../repositories/catalogRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import * as approvalRepo from '../repositories/approvalRepository.js';
import { createTicket } from '../services/ticketService.js';
import { persistUploadedFiles } from '../services/attachmentService.js';
import type { Impact, Priority, Urgency } from '../models/types.js';
import {
  extraFieldsToFormSchemaJson,
  normalizeExtraFields,
  parseFormSchemaJsonToExtraFields,
} from '../services/catalogFormFields.js';

function deriveCatalogFormColumns(b: Record<string, unknown>): { extra_form_fields_json: string; form_schema_json: string } {
  let raw = b.extra_form_fields;
  if (raw === undefined && typeof b.extra_form_fields_json === 'string') {
    try {
      raw = JSON.parse(b.extra_form_fields_json) as unknown;
    } catch {
      raw = [];
    }
  }
  const fields = normalizeExtraFields(raw);
  const extra_form_fields_json = JSON.stringify(fields);
  const form_schema_json = extraFieldsToFormSchemaJson(fields);
  return { extra_form_fields_json, form_schema_json };
}

function parseStoredExtraFields(row: catalogRepo.CatalogItemRow) {
  try {
    const parsed = JSON.parse(row.extra_form_fields_json || '[]') as unknown;
    return normalizeExtraFields(parsed);
  } catch {
    return parseFormSchemaJsonToExtraFields(row.form_schema_json);
  }
}

function serializeItem(row: catalogRepo.CatalogItemRow) {
  return {
    ...row,
    extra_form_fields: parseStoredExtraFields(row),
  };
}

export function createCatalogController(db: Database) {
  return {
    listPublished: (_req: AuthRequest, res: Response): void => {
      const items = catalogRepo.listPublished(db).map(serializeItem);
      res.json({ items });
    },

    listAll: (_req: AuthRequest, res: Response): void => {
      const items = catalogRepo.listAll(db).map(serializeItem);
      res.json({ items });
    },

    getById: (req: AuthRequest, res: Response): void => {
      const id = Number(req.params.id);
      const item = catalogRepo.findById(db, id);
      if (!item) throw new HttpError(404, 'Catalog item not found');
      res.json({ item: serializeItem(item) });
    },

    create: (req: AuthRequest, res: Response): void => {
      const b = req.body as Record<string, unknown>;
      const now = new Date().toISOString();
      const { extra_form_fields_json, form_schema_json } = deriveCatalogFormColumns(b);
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
        form_schema_json,
        extra_form_fields_json,
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
      if (b.extra_form_fields !== undefined || b.extra_form_fields_json !== undefined) {
        const derived = deriveCatalogFormColumns(b);
        patch.form_schema_json = derived.form_schema_json;
        patch.extra_form_fields_json = derived.extra_form_fields_json;
      }
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

      const catalogPriority =
        item.default_priority && ['P1', 'P2', 'P3', 'P4'].includes(item.default_priority)
          ? (item.default_priority as Priority)
          : undefined;

      const ticket = createTicket(
        db,
        {
          title,
          description,
          type: 'ServiceRequest',
          impact,
          urgency,
          ...(catalogPriority !== undefined ? { priority: catalogPriority } : {}),
          category: item.default_category ?? undefined,
          subcategory: item.default_subcategory ?? undefined,
          source: 'Portal',
          ticket_extra_json: extraJson,
          catalog_item_id: catalogId,
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

    requestFromCatalogMultipart: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const catalogId = Number(req.params.id);
      const item = catalogRepo.findById(db, catalogId);
      if (!item || item.is_published !== 1) throw new HttpError(404, 'Catalog item not found');

      const requester = userRepo.findUserById(db, req.user.userId);
      const body = req.body as Record<string, string>;
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];

      const impact = (item.default_impact ?? 'SingleUser') as Impact;
      const urgency = (item.default_urgency ?? 'Medium') as Urgency;
      const title = body.title?.trim() || item.name;
      const description = body.description?.trim() || item.description;

      let extraJson: string | null = null;
      const ej = body.extra_json?.trim();
      if (ej) {
        try {
          JSON.parse(ej);
          extraJson = ej;
        } catch {
          throw new HttpError(400, 'extra_json must be valid JSON');
        }
      }

      let status = 'New';
      if (item.requires_manager_approval === 1) {
        status = 'AwaitingApproval';
      }

      const catalogPriority =
        item.default_priority && ['P1', 'P2', 'P3', 'P4'].includes(item.default_priority)
          ? (item.default_priority as Priority)
          : undefined;

      const ticket = createTicket(
        db,
        {
          title,
          description,
          type: 'ServiceRequest',
          impact,
          urgency,
          ...(catalogPriority !== undefined ? { priority: catalogPriority } : {}),
          category: item.default_category ?? undefined,
          subcategory: item.default_subcategory ?? undefined,
          source: 'Portal',
          ticket_extra_json: extraJson,
          catalog_item_id: catalogId,
          status,
        },
        req.user.userId,
        requester?.department ?? null,
      );

      await persistUploadedFiles(db, ticket.id, req.user.userId, files);

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
