import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { ok, fail } from "../../shared/response.js";
import { asJson } from "../../shared/json.js";

export function notificationsRouter(db) {
  const r = Router();

  r.get(
    "/",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const rows = (
        await db.query(`SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 100`, [
          req.user.id,
        ])
      ).rows;
      ok(
        res,
        rows.map((n) => ({ ...n, payload: asJson(n.payload, {}) }))
      );
    })
  );

  r.get(
    "/unread-count",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const c = (
        await db.query(`SELECT COUNT(*)::int AS c FROM notifications WHERE recipient_id = ? AND is_read = FALSE`, [
          req.user.id,
        ])
      ).rows[0].c;
      ok(res, { count: c });
    })
  );

  r.patch(
    "/:id/read",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const info = await db.query(
        `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND recipient_id = ?`,
        [req.params.id, req.user.id]
      );
      if (info.rowCount === 0) return fail(res, 404, "NOT_FOUND", "Not found");
      ok(res, { read: true });
    })
  );

  r.post(
    "/read-all",
    authenticate(db),
    asyncHandler(async (req, res) => {
      await db.query(`UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE recipient_id = ?`, [
        req.user.id,
      ]);
      ok(res, { ok: true });
    })
  );

  return r;
}
