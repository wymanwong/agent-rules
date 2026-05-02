import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { ok, fail } from "../../shared/response.js";
import { parseJson } from "../../shared/json.js";

export function notificationsRouter(db) {
  const r = Router();

  r.get("/", authenticate(db), (req, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 100`
      )
      .all(req.user.id);
    ok(
      res,
      rows.map((n) => ({ ...n, payload: parseJson(n.payload, {}) }))
    );
  });

  r.get("/unread-count", authenticate(db), (req, res) => {
    const c = db
      .prepare(`SELECT COUNT(*) AS c FROM notifications WHERE recipient_id = ? AND is_read = 0`)
      .get(req.user.id).c;
    ok(res, { count: c });
  });

  r.patch("/:id/read", authenticate(db), (req, res) => {
    const info = db
      .prepare(
        `UPDATE notifications SET is_read = 1, read_at = datetime('now') WHERE id = ? AND recipient_id = ?`
      )
      .run(req.params.id, req.user.id);
    if (info.changes === 0) return fail(res, 404, "NOT_FOUND", "Not found");
    ok(res, { read: true });
  });

  r.post("/read-all", authenticate(db), (req, res) => {
    db.prepare(`UPDATE notifications SET is_read = 1, read_at = datetime('now') WHERE recipient_id = ?`).run(req.user.id);
    ok(res, { ok: true });
  });

  return r;
}
