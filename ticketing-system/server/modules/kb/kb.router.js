import { Router } from "express";
import { z } from "zod";
import { uuid } from "../../db.js";
import { authenticate, optionalAuth } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { ok, fail } from "../../shared/response.js";
import { asJson } from "../../shared/json.js";

const articleSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export function kbRouter(db) {
  const r = Router();

  r.get(
    "/articles",
    optionalAuth(db),
    asyncHandler(async (req, res) => {
      const rows = (
        await db.query(
          `SELECT id, title, slug, category, tags, status, view_count, published_at FROM kb_articles WHERE deleted_at IS NULL AND status = 'published' ORDER BY published_at DESC`
        )
      ).rows;
      ok(res, rows.map((row) => ({ ...row, tags: asJson(row.tags, []) })));
    })
  );

  r.get(
    "/articles/:slug",
    optionalAuth(db),
    asyncHandler(async (req, res) => {
      const row = (
        await db.query(`SELECT * FROM kb_articles WHERE slug = ? AND deleted_at IS NULL AND status = 'published'`, [
          req.params.slug,
        ])
      ).rows[0];
      if (!row) return fail(res, 404, "NOT_FOUND", "Not found");
      await db.query(`UPDATE kb_articles SET view_count = view_count + 1 WHERE id = ?`, [row.id]);
      ok(res, { ...row, tags: asJson(row.tags, []) });
    })
  );

  r.get(
    "/search",
    optionalAuth(db),
    asyncHandler(async (req, res) => {
      const q = String(req.query.q || "").trim();
      if (!q) return ok(res, []);
      const like = `%${q}%`;
      const rows = (
        await db.query(
          `SELECT id, title, slug FROM kb_articles WHERE deleted_at IS NULL AND status = 'published' AND (title ILIKE ? OR body ILIKE ?) LIMIT 50`,
          [like, like]
        )
      ).rows;
      ok(res, rows);
    })
  );

  r.post(
    "/articles",
    authenticate(db),
    authorize("agent", "admin"),
    validateBody(articleSchema),
    asyncHandler(async (req, res) => {
      const dto = req.validBody;
      const id = uuid();
      try {
        await db.query(
          `INSERT INTO kb_articles (id, title, slug, body, author_id, category, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, 'draft')`,
          [id, dto.title, dto.slug, dto.body, req.user.id, dto.category ?? null, JSON.stringify(dto.tags ?? [])]
        );
      } catch {
        return fail(res, 409, "SLUG_CONFLICT", "Slug already exists");
      }
      ok(res, { id }, {}, 201);
    })
  );

  r.patch(
    "/articles/:id",
    authenticate(db),
    authorize("agent", "admin"),
    asyncHandler(async (req, res) => {
      const row = (await db.query(`SELECT * FROM kb_articles WHERE id = ? AND deleted_at IS NULL`, [req.params.id])).rows[0];
      if (!row) return fail(res, 404, "NOT_FOUND", "Not found");
      if (req.user.role === "agent" && row.author_id !== req.user.id) {
        return fail(res, 403, "FORBIDDEN", "Can only edit own drafts unless admin");
      }
      const dto = req.body || {};
      const updates = [];
      const vals = [];
      if (dto.title) {
        updates.push("title = ?");
        vals.push(dto.title);
      }
      if (dto.body) {
        updates.push("body = ?");
        vals.push(dto.body);
      }
      if (dto.category !== undefined) {
        updates.push("category = ?");
        vals.push(dto.category);
      }
      if (!updates.length) return ok(res, { updated: false });
      updates.push("updated_at = NOW()");
      vals.push(req.params.id);
      await db.query(`UPDATE kb_articles SET ${updates.join(", ")} WHERE id = ?`, vals);
      ok(res, { updated: true });
    })
  );

  r.post(
    "/articles/:id/publish",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      await db.query(`UPDATE kb_articles SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = ?`, [
        req.params.id,
      ]);
      ok(res, { published: true });
    })
  );

  const feedbackSchema = z.object({ helpful: z.boolean() });

  r.post(
    "/articles/:id/feedback",
    authenticate(db),
    validateBody(feedbackSchema),
    asyncHandler(async (req, res) => {
      const col = req.validBody.helpful ? "helpful_count" : "not_helpful_count";
      await db.query(`UPDATE kb_articles SET ${col} = ${col} + 1 WHERE id = ?`, [req.params.id]);
      ok(res, { ok: true });
    })
  );

  r.get(
    "/categories",
    optionalAuth(db),
    asyncHandler(async (req, res) => {
      const rows = (
        await db.query(
          `SELECT category, COUNT(*)::int AS count FROM kb_articles WHERE deleted_at IS NULL AND status = 'published' AND category IS NOT NULL GROUP BY category`
        )
      ).rows;
      ok(res, rows);
    })
  );

  return r;
}
