import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import { z } from "zod";
import crypto from "crypto";
import { uuid } from "../../db.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { ok, fail } from "../../shared/response.js";
import { parseJson, asJson } from "../../shared/json.js";
import { insertAudit } from "../audit/audit.repo.js";
import { applySlaToTicket } from "../sla/sla.service.js";
import { notify } from "../notifications/inApp.js";
import { canTransition } from "./ticketFsm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fmtTicketNumber(n) {
  return `TKT-${String(n).padStart(5, "0")}`;
}

async function serializeTicket(db, row) {
  if (!row) return null;
  const tags = asJson(row.tags, []);
  const metadata = asJson(row.metadata, {});
  let category_form_schema = [];
  if (row.category) {
    const cr = await db.query(`SELECT form_schema FROM ticket_categories WHERE slug = ?`, [row.category]);
    const cat = cr.rows[0];
    if (cat) category_form_schema = parseJson(cat.form_schema, []);
  }
  return {
    ...row,
    ticket_display: fmtTicketNumber(row.ticket_number),
    tags,
    metadata,
    category_form_schema,
  };
}

function validateMetadataAgainstSchema(schema, values) {
  for (const f of schema) {
    const v = values[f.id];
    if (f.required && (v === undefined || v === null || String(v).trim() === "")) {
      return { ok: false, message: `Missing required field: ${f.label}` };
    }
    if (f.type === "number" && v !== undefined && v !== "" && Number.isNaN(Number(v))) {
      return { ok: false, message: `Invalid number: ${f.label}` };
    }
  }
  return { ok: true };
}

const createTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  priority: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  requester_id: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

const patchTicketSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  team_id: z.string().uuid().nullable().optional(),
  status: z.enum(["open", "in_progress", "pending", "resolved", "closed"]).optional(),
});

const assignSchema = z.object({
  assignee_id: z.string().uuid().nullable().optional(),
  team_id: z.string().uuid().nullable().optional(),
});

const commentSchema = z.object({
  body: z.string().min(1),
  is_internal: z.boolean().optional(),
});

export function ticketsRouter(db) {
  const r = Router();
  const uploadsRoot = path.join(__dirname, "..", "..", "..", "data", "uploads");

  const storage = multer.diskStorage({
    destination(req, file, cb) {
      const tid = req.params.id;
      const dir = path.join(uploadsRoot, tid);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      cb(null, `${crypto.randomUUID()}_${file.originalname.replace(/[^\w.\-]+/g, "_")}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  async function loadTicket(id, actor) {
    const tr = await db.query(`SELECT * FROM tickets WHERE id = ? AND deleted_at IS NULL`, [id]);
    const row = tr.rows[0];
    if (!row) return { code: "NOT_FOUND" };
    if (actor.role === "end_user" && row.requester_id !== actor.id) return { code: "FORBIDDEN" };
    return { ticket: row };
  }

  function guardTicket(res, x) {
    if (x.ticket) return null;
    if (x.code === "FORBIDDEN") return fail(res, 403, "FORBIDDEN", "Forbidden");
    return fail(res, 404, "TICKET_NOT_FOUND", "Ticket not found");
  }

  async function applyStatusSideEffects(txDb, ticket, nextStatus) {
    const nowIso = new Date().toISOString();
    if (nextStatus === "in_progress" && !ticket.first_response_at) {
      await txDb.query(`UPDATE tickets SET first_response_at = ? WHERE id = ?`, [nowIso, ticket.id]);
    }
    if (nextStatus === "resolved") {
      await txDb.query(`UPDATE tickets SET resolved_at = ? WHERE id = ?`, [nowIso, ticket.id]);
    }
    if (nextStatus === "closed") {
      await txDb.query(`UPDATE tickets SET closed_at = ? WHERE id = ?`, [nowIso, ticket.id]);
    }
    if (nextStatus === "open" && (ticket.status === "resolved" || ticket.status === "closed")) {
      await txDb.query(
        `UPDATE tickets SET resolved_at = NULL, closed_at = NULL,
         sla_response_breached = FALSE, sla_resolution_breached = FALSE, updated_at = NOW() WHERE id = ?`,
        [ticket.id]
      );
      await applySlaToTicket(txDb, ticket.id, ticket.priority);
    }
  }

  r.get(
    "/",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const role = req.user.role;
      const page = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 20));
      const offset = (page - 1) * perPage;

      let sql = `SELECT t.*, rq.full_name AS requester_name, rq.email AS requester_email,
      ag.full_name AS assignee_name
      FROM tickets t
      JOIN users rq ON rq.id = t.requester_id
      LEFT JOIN users ag ON ag.id = t.assignee_id
      WHERE t.deleted_at IS NULL`;
      const params = [];

      if (role === "end_user") {
        sql += ` AND t.requester_id = ?`;
        params.push(req.user.id);
      }

      if (req.query.status) {
        const parts = String(req.query.status)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length) {
          sql += ` AND t.status IN (${parts.map(() => "?").join(",")})`;
          params.push(...parts);
        }
      }
      if (req.query.priority) {
        const parts = String(req.query.priority)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length) {
          sql += ` AND t.priority IN (${parts.map(() => "?").join(",")})`;
          params.push(...parts);
        }
      }
      if (req.query.assignee_id && role !== "end_user") {
        sql += ` AND t.assignee_id = ?`;
        params.push(req.query.assignee_id);
      }
      if (req.query.team_id && role !== "end_user") {
        sql += ` AND t.team_id = ?`;
        params.push(req.query.team_id);
      }
      if (req.query.requester_id && (role === "admin" || role === "agent")) {
        sql += ` AND t.requester_id = ?`;
        params.push(req.query.requester_id);
      }
      if (req.query.category) {
        sql += ` AND t.category = ?`;
        params.push(req.query.category);
      }
      if (req.query.q) {
        sql += ` AND (t.title ILIKE ? OR t.description ILIKE ?)`;
        const q = `%${req.query.q}%`;
        params.push(q, q);
      }

      const joinIdx = sql.indexOf("FROM tickets");
      const fromClause = sql.slice(joinIdx);
      const countSql = `SELECT COUNT(*)::int AS c ${fromClause}`;
      const cnt = await db.query(countSql, params);
      const total = cnt.rows[0]?.c ?? 0;

      sql += ` ORDER BY t.updated_at DESC LIMIT ? OFFSET ?`;
      params.push(perPage, offset);

      const rows = (await db.query(sql, params)).rows;
      const mapped = [];
      for (const row of rows) mapped.push(await serializeTicket(db, row));
      ok(res, mapped, { page, per_page: perPage, total });
    })
  );

  r.post(
    "/",
    authenticate(db),
    validateBody(createTicketSchema),
    asyncHandler(async (req, res) => {
      const dto = req.validBody;
      let requester_id = req.user.id;
      if ((req.user.role === "agent" || req.user.role === "admin") && dto.requester_id) {
        requester_id = dto.requester_id;
      }

      const metadata = dto.metadata ?? {};
      const categorySlug = dto.category ?? null;
      if (categorySlug) {
        const catr = await db.query(`SELECT * FROM ticket_categories WHERE slug = ?`, [categorySlug]);
        const cat = catr.rows[0];
        if (!cat) return fail(res, 400, "BAD_CATEGORY", "Unknown category slug");
        const schema = parseJson(cat.form_schema, []);
        const check = validateMetadataAgainstSchema(schema, metadata);
        if (!check.ok) return fail(res, 400, "VALIDATION_ERROR", check.message);
      }

      const id = uuid();

      await db.query(
        `INSERT INTO tickets (id, title, description, priority, category, tags, metadata, requester_id)
         VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?)`,
        [
          id,
          dto.title.trim(),
          dto.description ?? "",
          dto.priority,
          categorySlug,
          JSON.stringify(dto.tags ?? []),
          JSON.stringify(metadata),
          requester_id,
        ]
      );

      await applySlaToTicket(db, id, dto.priority);

      const nr = await db.query(`SELECT ticket_number FROM tickets WHERE id = ?`, [id]);
      const ticketNum = nr.rows[0].ticket_number;

      await insertAudit(db, {
        entity_type: "ticket",
        entity_id: id,
        action: "created",
        actor_id: req.user.id,
        changes: { ticket_number: ticketNum },
      });

      const ticket = (await db.query(`SELECT * FROM tickets WHERE id = ?`, [id])).rows[0];
      ok(res, await serializeTicket(db, ticket), {}, 201);
    })
  );

  r.get(
    "/:id",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      if (x.code === "NOT_FOUND") return fail(res, 404, "TICKET_NOT_FOUND", "Ticket not found");
      if (x.code === "FORBIDDEN") return fail(res, 403, "FORBIDDEN", "Forbidden");

      const ticket = await serializeTicket(db, x.ticket);
      const comments = (
        await db.query(
          `SELECT c.*, u.full_name AS author_name FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.ticket_id = ? AND c.deleted_at IS NULL
         ORDER BY c.created_at ASC`,
          [req.params.id]
        )
      ).rows;

      const visible = comments.filter((c) => !(c.is_internal && req.user.role === "end_user"));

      const attachments = (
        await db.query(`SELECT id, filename, mime_type, size_bytes, created_at FROM attachments WHERE ticket_id = ?`, [
          req.params.id,
        ])
      ).rows;

      const kbLinks = (
        await db.query(
          `SELECT a.id, a.title, a.slug FROM kb_article_ticket_links l
         JOIN kb_articles a ON a.id = l.article_id WHERE l.ticket_id = ?`,
          [req.params.id]
        )
      ).rows;

      const children = (
        await db.query(
          `SELECT id, ticket_number, title, status FROM tickets WHERE parent_ticket_id = ? AND deleted_at IS NULL`,
          [req.params.id]
        )
      ).rows;

      ok(res, { ticket, comments: visible, attachments, kb_links: kbLinks, children });
    })
  );

  r.patch(
    "/:id",
    authenticate(db),
    authorize("agent", "admin"),
    validateBody(patchTicketSchema),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      let t = x.ticket;
      const dto = req.validBody;

      if (dto.status !== undefined && dto.status !== t.status) {
        const chk = canTransition({
          from: t.status,
          to: dto.status,
          actorRole: req.user.role,
          ticket: { ...t, actor_id: req.user.id },
        });
        if (!chk.ok) return fail(res, 422, "INVALID_TRANSITION", chk.message);

        await db.tx(async (tx) => {
          await tx.query(`UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?`, [dto.status, t.id]);
          await applyStatusSideEffects(tx, t, dto.status);
        });

        await insertAudit(db, {
          entity_type: "ticket",
          entity_id: t.id,
          action: "status_changed",
          actor_id: req.user.id,
          changes: { status: { from: t.status, to: dto.status } },
        });
        t = (await db.query(`SELECT * FROM tickets WHERE id = ?`, [t.id])).rows[0];
      }

      const updates = [];
      const vals = [];
      const changes = {};

      if (dto.title !== undefined) {
        updates.push("title = ?");
        vals.push(dto.title);
        changes.title = dto.title;
      }
      if (dto.description !== undefined) {
        updates.push("description = ?");
        vals.push(dto.description);
        changes.description = dto.description;
      }
      if (dto.priority !== undefined) {
        updates.push("priority = ?");
        vals.push(dto.priority);
        changes.priority = dto.priority;
        await applySlaToTicket(db, t.id, dto.priority);
      }
      if (dto.category !== undefined) {
        updates.push("category = ?");
        vals.push(dto.category);
        changes.category = dto.category;
        if (dto.category) {
          const catr = await db.query(`SELECT form_schema FROM ticket_categories WHERE slug = ?`, [dto.category]);
          const cat = catr.rows[0];
          const meta = asJson(t.metadata, {});
          const schema = cat ? parseJson(cat.form_schema, []) : [];
          const check = validateMetadataAgainstSchema(schema, meta);
          if (!check.ok) return fail(res, 400, "VALIDATION_ERROR", check.message);
        }
      }
      if (dto.tags !== undefined) {
        updates.push("tags = ?::jsonb");
        vals.push(JSON.stringify(dto.tags));
        changes.tags = dto.tags;
      }
      if (dto.assignee_id !== undefined) {
        updates.push("assignee_id = ?");
        vals.push(dto.assignee_id);
        changes.assignee_id = dto.assignee_id;
      }
      if (dto.team_id !== undefined) {
        updates.push("team_id = ?");
        vals.push(dto.team_id);
        changes.team_id = dto.team_id;
      }

      if (updates.length) {
        updates.push("updated_at = NOW()");
        vals.push(t.id);
        await db.query(`UPDATE tickets SET ${updates.join(", ")} WHERE id = ?`, vals);
        await insertAudit(db, {
          entity_type: "ticket",
          entity_id: t.id,
          action: "updated",
          actor_id: req.user.id,
          changes,
        });
      }

      const ticket = (await db.query(`SELECT * FROM tickets WHERE id = ?`, [t.id])).rows[0];
      ok(res, await serializeTicket(db, ticket));
    })
  );

  r.delete(
    "/:id",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      const qr = await db.query(`SELECT * FROM tickets WHERE id = ? AND deleted_at IS NULL`, [req.params.id]);
      if (!qr.rows.length) return fail(res, 404, "TICKET_NOT_FOUND", "Ticket not found");
      await db.query(`UPDATE tickets SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?`, [req.params.id]);
      await insertAudit(db, {
        entity_type: "ticket",
        entity_id: req.params.id,
        action: "soft_deleted",
        actor_id: req.user.id,
      });
      ok(res, { deleted: true });
    })
  );

  r.post(
    "/:id/assign",
    authenticate(db),
    authorize("agent", "admin"),
    validateBody(assignSchema),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const { assignee_id, team_id } = req.validBody;
      await db.query(`UPDATE tickets SET assignee_id = ?, team_id = ?, updated_at = NOW() WHERE id = ?`, [
        assignee_id ?? null,
        team_id ?? null,
        req.params.id,
      ]);
      if (assignee_id) {
        await notify(db, {
          recipient_id: assignee_id,
          type: "ticket_assigned",
          title: "Ticket assigned",
          body: `You were assigned ticket ${fmtTicketNumber(x.ticket.ticket_number)}`,
          payload: { ticket_id: req.params.id },
          reference_type: "ticket",
          reference_id: req.params.id,
        });
      }
      await insertAudit(db, {
        entity_type: "ticket",
        entity_id: req.params.id,
        action: "assigned",
        actor_id: req.user.id,
        changes: { assignee_id, team_id },
      });
      const tr = await db.query(`SELECT * FROM tickets WHERE id = ?`, [req.params.id]);
      ok(res, await serializeTicket(db, tr.rows[0]));
    })
  );

  r.post(
    "/:id/escalate",
    authenticate(db),
    authorize("agent", "admin"),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      await insertAudit(db, {
        entity_type: "ticket",
        entity_id: req.params.id,
        action: "manual_escalation",
        actor_id: req.user.id,
        metadata: req.body ?? {},
      });
      ok(res, { escalated: true });
    })
  );

  r.post(
    "/:id/resolve",
    authenticate(db),
    authorize("agent", "admin"),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const chk = canTransition({
        from: x.ticket.status,
        to: "resolved",
        actorRole: req.user.role,
        ticket: { ...x.ticket, actor_id: req.user.id },
      });
      if (!chk.ok) return fail(res, 422, "INVALID_TRANSITION", chk.message);
      await db.tx(async (tx) => {
        await tx.query(`UPDATE tickets SET status = 'resolved', updated_at = NOW() WHERE id = ?`, [req.params.id]);
        await applyStatusSideEffects(tx, x.ticket, "resolved");
      });
      await insertAudit(db, {
        entity_type: "ticket",
        entity_id: req.params.id,
        action: "resolved",
        actor_id: req.user.id,
      });
      const tr = await db.query(`SELECT * FROM tickets WHERE id = ?`, [req.params.id]);
      ok(res, await serializeTicket(db, tr.rows[0]));
    })
  );

  r.post(
    "/:id/close",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const chk = canTransition({
        from: x.ticket.status,
        to: "closed",
        actorRole: req.user.role,
        ticket: { ...x.ticket, actor_id: req.user.id },
      });
      if (!chk.ok) return fail(res, 422, "INVALID_TRANSITION", chk.message);
      await db.tx(async (tx) => {
        await tx.query(`UPDATE tickets SET status = 'closed', updated_at = NOW() WHERE id = ?`, [req.params.id]);
        await applyStatusSideEffects(tx, x.ticket, "closed");
      });
      await insertAudit(db, {
        entity_type: "ticket",
        entity_id: req.params.id,
        action: "closed",
        actor_id: req.user.id,
      });
      const tr = await db.query(`SELECT * FROM tickets WHERE id = ?`, [req.params.id]);
      ok(res, await serializeTicket(db, tr.rows[0]));
    })
  );

  r.post(
    "/:id/reopen",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const chk = canTransition({
        from: x.ticket.status,
        to: "open",
        actorRole: req.user.role,
        ticket: { ...x.ticket, actor_id: req.user.id },
      });
      if (!chk.ok) return fail(res, 422, "INVALID_TRANSITION", chk.message);
      await db.tx(async (tx) => {
        await tx.query(`UPDATE tickets SET status = 'open', updated_at = NOW() WHERE id = ?`, [req.params.id]);
        await applyStatusSideEffects(tx, x.ticket, "open");
      });
      await insertAudit(db, {
        entity_type: "ticket",
        entity_id: req.params.id,
        action: "reopened",
        actor_id: req.user.id,
      });
      const tr = await db.query(`SELECT * FROM tickets WHERE id = ?`, [req.params.id]);
      ok(res, await serializeTicket(db, tr.rows[0]));
    })
  );

  r.get(
    "/:id/history",
    authenticate(db),
    authorize("agent", "admin"),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const logs = (
        await db.query(
          `SELECT * FROM audit_logs WHERE entity_type = 'ticket' AND entity_id = ? ORDER BY created_at ASC`,
          [req.params.id]
        )
      ).rows;
      ok(res, logs);
    })
  );

  r.get(
    "/:id/sla",
    authenticate(db),
    authorize("agent", "admin"),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const t = x.ticket;
      ok(res, {
        sla_policy_id: t.sla_policy_id,
        sla_response_due_at: t.sla_response_due_at,
        sla_resolution_due_at: t.sla_resolution_due_at,
        sla_response_breached: !!t.sla_response_breached,
        sla_resolution_breached: !!t.sla_resolution_breached,
      });
    })
  );

  const linkArticleSchema = z.object({ article_id: z.string().uuid() });

  r.post(
    "/:id/link-article",
    authenticate(db),
    authorize("agent", "admin"),
    validateBody(linkArticleSchema),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const ar = await db.query(`SELECT id FROM kb_articles WHERE id = ? AND deleted_at IS NULL`, [
        req.validBody.article_id,
      ]);
      if (!ar.rows.length) return fail(res, 404, "NOT_FOUND", "Article not found");
      await db.query(
        `INSERT INTO kb_article_ticket_links (article_id, ticket_id, linked_by_id) VALUES (?, ?, ?)
         ON CONFLICT (article_id, ticket_id) DO NOTHING`,
        [req.validBody.article_id, req.params.id, req.user.id]
      );
      await insertAudit(db, {
        entity_type: "ticket",
        entity_id: req.params.id,
        action: "kb_linked",
        actor_id: req.user.id,
        changes: { article_id: req.validBody.article_id },
      });
      ok(res, { linked: true });
    })
  );

  r.get(
    "/:id/comments",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const rows = (
        await db.query(
          `SELECT c.*, u.full_name AS author_name FROM comments c JOIN users u ON u.id = c.author_id
         WHERE c.ticket_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at ASC`,
          [req.params.id]
        )
      ).rows;
      const visible = rows.filter((c) => !(c.is_internal && req.user.role === "end_user"));
      ok(res, visible);
    })
  );

  r.post(
    "/:id/comments",
    authenticate(db),
    validateBody(commentSchema),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const internal = !!(req.validBody.is_internal && (req.user.role === "agent" || req.user.role === "admin"));
      if (req.validBody.is_internal && req.user.role === "end_user") {
        return fail(res, 403, "FORBIDDEN", "End users cannot add internal notes");
      }
      const cid = uuid();
      await db.query(`INSERT INTO comments (id, ticket_id, author_id, body, is_internal) VALUES (?, ?, ?, ?, ?)`, [
        cid,
        req.params.id,
        req.user.id,
        req.validBody.body.trim(),
        internal,
      ]);
      await db.query(`UPDATE tickets SET updated_at = NOW() WHERE id = ?`, [req.params.id]);
      await insertAudit(db, {
        entity_type: "comment",
        entity_id: cid,
        action: "created",
        actor_id: req.user.id,
        metadata: { ticket_id: req.params.id },
      });
      ok(res, { id: cid }, {}, 201);
    })
  );

  const patchCommentSchema = z.object({ body: z.string().min(1) });

  r.patch(
    "/:id/comments/:cid",
    authenticate(db),
    validateBody(patchCommentSchema),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const cr = await db.query(`SELECT * FROM comments WHERE id = ? AND ticket_id = ? AND deleted_at IS NULL`, [
        req.params.cid,
        req.params.id,
      ]);
      const c = cr.rows[0];
      if (!c) return fail(res, 404, "NOT_FOUND", "Comment not found");

      const created = new Date(c.created_at).getTime();
      const now = Date.now();
      const windowMs =
        req.user.role === "admin" ? Infinity : req.user.role === "agent" ? 30 * 60 * 1000 : 5 * 60 * 1000;

      if (c.author_id !== req.user.id && req.user.role !== "admin") {
        return fail(res, 403, "FORBIDDEN", "Cannot edit this comment");
      }
      if (req.user.role !== "admin" && now - created > windowMs) {
        return fail(res, 403, "FORBIDDEN", "Edit window expired");
      }

      await db.query(`UPDATE comments SET body = ?, updated_at = NOW() WHERE id = ?`, [req.validBody.body, req.params.cid]);
      ok(res, { updated: true });
    })
  );

  r.delete(
    "/:id/comments/:cid",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const cr = await db.query(`SELECT * FROM comments WHERE id = ? AND ticket_id = ? AND deleted_at IS NULL`, [
        req.params.cid,
        req.params.id,
      ]);
      const c = cr.rows[0];
      if (!c) return fail(res, 404, "NOT_FOUND", "Comment not found");

      if (req.user.role === "admin") {
        await db.query(`UPDATE comments SET deleted_at = NOW() WHERE id = ?`, [req.params.cid]);
        return ok(res, { deleted: true });
      }

      const created = new Date(c.created_at).getTime();
      const windowMs = req.user.role === "agent" ? 30 * 60 * 1000 : 5 * 60 * 1000;
      if (c.author_id !== req.user.id) return fail(res, 403, "FORBIDDEN", "Cannot delete");
      if (Date.now() - created > windowMs) return fail(res, 403, "FORBIDDEN", "Delete window expired");

      await db.query(`UPDATE comments SET deleted_at = NOW() WHERE id = ?`, [req.params.cid]);
      ok(res, { deleted: true });
    })
  );

  r.get(
    "/:id/attachments",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const rows = (
        await db.query(
          `SELECT id, filename, mime_type, size_bytes, storage_key, created_at FROM attachments WHERE ticket_id = ?`,
          [req.params.id]
        )
      ).rows;
      ok(res, rows);
    })
  );

  r.post(
    "/:id/attachments",
    authenticate(db),
    upload.single("file"),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      if (!req.file) return fail(res, 400, "NO_FILE", "file field required");

      const aid = uuid();
      const storage_key = path.relative(uploadsRoot, req.file.path).replace(/\\/g, "/");
      await db.query(
        `INSERT INTO attachments (id, ticket_id, uploader_id, filename, mime_type, size_bytes, storage_key, storage_bucket)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'local')`,
        [
          aid,
          req.params.id,
          req.user.id,
          req.file.originalname,
          req.file.mimetype || "application/octet-stream",
          req.file.size,
          storage_key,
        ]
      );
      ok(res, { id: aid, filename: req.file.originalname, size_bytes: req.file.size }, {}, 201);
    })
  );

  r.delete(
    "/:id/attachments/:aid",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const ar = await db.query(`SELECT * FROM attachments WHERE id = ? AND ticket_id = ?`, [
        req.params.aid,
        req.params.id,
      ]);
      const a = ar.rows[0];
      if (!a) return fail(res, 404, "NOT_FOUND", "Attachment not found");
      if (req.user.role !== "admin" && a.uploader_id !== req.user.id) {
        return fail(res, 403, "FORBIDDEN", "Cannot delete attachment");
      }
      const abs = path.join(uploadsRoot, a.storage_key);
      try {
        fs.unlinkSync(abs);
      } catch {
        /* ignore */
      }
      await db.query(`DELETE FROM attachments WHERE id = ?`, [req.params.aid]);
      ok(res, { deleted: true });
    })
  );

  const splitSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
    copy_comments: z.boolean().optional(),
  });

  r.post(
    "/:id/split",
    authenticate(db),
    authorize("agent", "admin"),
    validateBody(splitSchema),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const parent = x.ticket;
      const dto = req.validBody;
      const id = uuid();
      const desc =
        (dto.description && dto.description.trim()) ||
        `(Split from ${fmtTicketNumber(parent.ticket_number)})\n\n${parent.description || ""}`.trim();

      const category = dto.category ?? parent.category;
      const metadata = asJson(parent.metadata, {});

      await db.query(
        `INSERT INTO tickets (id, title, description, status, priority, category, tags, metadata, requester_id, assignee_id, team_id, parent_ticket_id, sla_policy_id, sla_response_due_at, sla_resolution_due_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          dto.title.trim(),
          desc,
          parent.priority,
          category,
          JSON.stringify(asJson(parent.tags, [])),
          JSON.stringify(metadata),
          parent.requester_id,
          parent.assignee_id,
          parent.team_id,
          parent.id,
          parent.sla_policy_id,
          parent.sla_response_due_at,
          parent.sla_resolution_due_at,
        ]
      );

      await applySlaToTicket(db, id, parent.priority);

      const nr = await db.query(`SELECT ticket_number FROM tickets WHERE id = ?`, [id]);

      if (dto.copy_comments) {
        const cs = (
          await db.query(`SELECT author_id, body, is_internal FROM comments WHERE ticket_id = ? AND deleted_at IS NULL`, [
            parent.id,
          ])
        ).rows;
        for (const c of cs) {
          await db.query(`INSERT INTO comments (id, ticket_id, author_id, body, is_internal) VALUES (?, ?, ?, ?, ?)`, [
            uuid(),
            id,
            c.author_id,
            `[Copied] ${c.body}`,
            c.is_internal,
          ]);
        }
      }

      await insertAudit(db, {
        entity_type: "ticket",
        entity_id: parent.id,
        action: "split",
        actor_id: req.user.id,
        changes: { child_id: id, ticket_number: nr.rows[0].ticket_number },
      });
      ok(
        res,
        {
          id,
          ticket_number: nr.rows[0].ticket_number,
          ticket_display: fmtTicketNumber(nr.rows[0].ticket_number),
        },
        {},
        201
      );
    })
  );

  const migrateSchema = z.object({
    category: z.string().min(1),
    metadata: z.record(z.any()).optional(),
    append_description: z.string().optional(),
  });

  r.post(
    "/:id/migrate",
    authenticate(db),
    authorize("agent", "admin"),
    validateBody(migrateSchema),
    asyncHandler(async (req, res) => {
      const x = await loadTicket(req.params.id, req.user);
      const ge = guardTicket(res, x);
      if (ge) return ge;
      const t = x.ticket;
      const dto = req.validBody;
      const catr = await db.query(`SELECT * FROM ticket_categories WHERE slug = ?`, [dto.category]);
      const cat = catr.rows[0];
      if (!cat) return fail(res, 400, "BAD_CATEGORY", "Unknown category slug");

      let merged = asJson(t.metadata, {});
      if (dto.metadata && typeof dto.metadata === "object") merged = { ...merged, ...dto.metadata };
      const schema = parseJson(cat.form_schema, []);
      const check = validateMetadataAgainstSchema(schema, merged);
      if (!check.ok) return fail(res, 400, "VALIDATION_ERROR", check.message);

      let description = t.description;
      if (dto.append_description) {
        description = `${t.description || ""}\n\n--- Migrated to ${cat.name} ---\n${dto.append_description}`.trim();
      }

      await db.query(`UPDATE tickets SET category = ?, metadata = ?::jsonb, description = ?, updated_at = NOW() WHERE id = ?`, [
        dto.category,
        JSON.stringify(merged),
        description,
        t.id,
      ]);

      await insertAudit(db, {
        entity_type: "ticket",
        entity_id: t.id,
        action: "migrated_category",
        actor_id: req.user.id,
        changes: { category: dto.category },
      });

      const tr = await db.query(`SELECT * FROM tickets WHERE id = ?`, [t.id]);
      ok(res, await serializeTicket(db, tr.rows[0]));
    })
  );

  return r;
}
