import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { ok } from "../../shared/response.js";

export function reportsRouter(db) {
  const r = Router();

  r.get(
    "/overview",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      const byStatus = (await db.query(`SELECT status, COUNT(*)::int AS c FROM tickets WHERE deleted_at IS NULL GROUP BY status`)).rows;
      const byPriority = (
        await db.query(`SELECT priority, COUNT(*)::int AS c FROM tickets WHERE deleted_at IS NULL GROUP BY priority`)
      ).rows;
      const byCategory = (
        await db.query(`SELECT category, COUNT(*)::int AS c FROM tickets WHERE deleted_at IS NULL GROUP BY category`)
      ).rows;
      ok(res, { by_status: byStatus, by_priority: byPriority, by_category: byCategory });
    })
  );

  r.get(
    "/agents",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      const rows = (
        await db.query(
          `SELECT u.id, u.full_name,
          (SELECT COUNT(*)::int FROM tickets t WHERE t.assignee_id = u.id AND t.deleted_at IS NULL
            AND t.status NOT IN ('resolved','closed')) AS open_assigned
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name IN ('agent','admin') AND u.deleted_at IS NULL`
        )
      ).rows;
      ok(res, rows);
    })
  );

  r.get(
    "/sla",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      const breached = (await db.query(`SELECT COUNT(*)::int AS c FROM tickets WHERE sla_resolution_breached = TRUE`)).rows[0].c;
      ok(res, { sla_resolution_breached: breached });
    })
  );

  r.get(
    "/kb",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      const rows = (
        await db.query(
          `SELECT id, title, slug, view_count, helpful_count FROM kb_articles WHERE deleted_at IS NULL ORDER BY view_count DESC LIMIT 20`
        )
      ).rows;
      ok(res, rows);
    })
  );

  return r;
}
