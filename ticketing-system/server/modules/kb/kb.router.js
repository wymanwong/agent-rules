import { Router } from "express";
import { z } from "zod";
import { uuid } from "../../db.js";
import { authenticate, optionalAuth } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../shared/response.js";
import { parseJson } from "../../shared/json.js";

const articleSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export function kbRouter(db) {
  const r = Router();

  r.get("/articles", optionalAuth(db), (req, res) => {
    const rows = db
      .prepare(`SELECT id, title, slug, category, tags, status, view_count, published_at FROM kb_articles WHERE deleted_at IS NULL AND status = 'published' ORDER BY published_at DESC`)
      .all();
    ok(
      res,
      rows.map((row) => ({ ...row, tags: parseJson(row.tags, []) }))
    );
  });

  r.get("/articles/:slug", optionalAuth(db), (req, res) => {
    const row = db
      .prepare(`SELECT * FROM kb_articles WHERE slug = ? AND deleted_at IS NULL AND status = 'published'`)
      .get(req.params.slug);
    if (!row) return fail(res, 404, "NOT_FOUND", "Not found");
    db.prepare(`UPDATE kb_articles SET view_count = view_count + 1 WHERE id = ?`).run(row.id);
    ok(res, { ...row, tags: parseJson(row.tags, []) });
  });

  r.get("/search", optionalAuth(db), (req, res) => {
    const q = String(req.query.q || "").trim();
    if (!q) return ok(res, []);
    const like = `%${q}%`;
    const rows = db
      .prepare(
        `SELECT id, title, slug FROM kb_articles WHERE deleted_at IS NULL AND status = 'published' AND (title LIKE ? OR body LIKE ?) LIMIT 50`
      )
      .all(like, like);
    ok(res, rows);
  });

  r.post("/articles", authenticate(db), authorize("agent", "admin"), validateBody(articleSchema), (req, res) => {
    const dto = req.validBody;
    const id = uuid();
    try {
      db.prepare(
        `INSERT INTO kb_articles (id, title, slug, body, author_id, category, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`
      ).run(id, dto.title, dto.slug, dto.body, req.user.id, dto.category ?? null, JSON.stringify(dto.tags ?? []));
    } catch {
      return fail(res, 409, "SLUG_CONFLICT", "Slug already exists");
    }
    ok(res, { id }, {}, 201);
  });

  r.patch("/articles/:id", authenticate(db), authorize("agent", "admin"), (req, res) => {
    const row = db.prepare(`SELECT * FROM kb_articles WHERE id = ? AND deleted_at IS NULL`).get(req.params.id);
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
    updates.push("updated_at = datetime('now')");
    vals.push(req.params.id);
    db.prepare(`UPDATE kb_articles SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
    ok(res, { updated: true });
  });

  r.post("/articles/:id/publish", authenticate(db), authorize("admin"), (req, res) => {
    db.prepare(`UPDATE kb_articles SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(
      req.params.id
    );
    ok(res, { published: true });
  });

  const feedbackSchema = z.object({ helpful: z.boolean() });

  r.post("/articles/:id/feedback", authenticate(db), validateBody(feedbackSchema), (req, res) => {
    const col = req.validBody.helpful ? "helpful_count" : "not_helpful_count";
    db.prepare(`UPDATE kb_articles SET ${col} = ${col} + 1 WHERE id = ?`).run(req.params.id);
    ok(res, { ok: true });
  });

  r.get("/categories", optionalAuth(db), (req, res) => {
    const rows = db
      .prepare(
        `SELECT category, COUNT(*) AS count FROM kb_articles WHERE deleted_at IS NULL AND status = 'published' AND category IS NOT NULL GROUP BY category`
      )
      .all();
    ok(res, rows);
  });

  return r;
}
