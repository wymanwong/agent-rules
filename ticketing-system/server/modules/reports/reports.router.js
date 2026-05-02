import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { ok } from "../../shared/response.js";

export function reportsRouter(db) {
  const r = Router();

  r.get("/overview", authenticate(db), authorize("admin"), (req, res) => {
    const byStatus = db
      .prepare(`SELECT status, COUNT(*) AS c FROM tickets WHERE deleted_at IS NULL GROUP BY status`)
      .all();
    const byPriority = db
      .prepare(`SELECT priority, COUNT(*) AS c FROM tickets WHERE deleted_at IS NULL GROUP BY priority`)
      .all();
    const byCategory = db
      .prepare(`SELECT category, COUNT(*) AS c FROM tickets WHERE deleted_at IS NULL GROUP BY category`)
      .all();
    ok(res, { by_status: byStatus, by_priority: byPriority, by_category: byCategory });
  });

  r.get("/agents", authenticate(db), authorize("admin"), (req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.full_name,
          (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = u.id AND t.deleted_at IS NULL
            AND t.status NOT IN ('resolved','closed')) AS open_assigned
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name IN ('agent','admin') AND u.deleted_at IS NULL`
      )
      .all();
    ok(res, rows);
  });

  r.get("/sla", authenticate(db), authorize("admin"), (req, res) => {
    const breached = db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE sla_resolution_breached = 1`).get().c;
    ok(res, { sla_resolution_breached: breached });
  });

  r.get("/kb", authenticate(db), authorize("admin"), (req, res) => {
    const rows = db
      .prepare(`SELECT id, title, slug, view_count, helpful_count FROM kb_articles WHERE deleted_at IS NULL ORDER BY view_count DESC LIMIT 20`)
      .all();
    ok(res, rows);
  });

  return r;
}
