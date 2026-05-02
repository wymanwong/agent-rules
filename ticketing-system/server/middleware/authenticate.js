import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import { fail } from "../shared/response.js";

export function authenticate(db) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m) return fail(res, 401, "UNAUTHORIZED", "Bearer token required");

    try {
      const payload = jwt.verify(m[1], JWT_SECRET);
      const userId = payload.sub;
      const row = db
        .prepare(
          `SELECT u.id, u.email, u.full_name, u.role_id, r.name AS role_name
           FROM users u JOIN roles r ON r.id = u.role_id
           WHERE u.id = ? AND u.deleted_at IS NULL AND u.is_active = 1`
        )
        .get(userId);
      if (!row) return fail(res, 401, "UNAUTHORIZED", "Invalid session");

      req.user = {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        role_id: row.role_id,
        role: row.role_name,
      };
      next();
    } catch {
      return fail(res, 401, "UNAUTHORIZED", "Invalid or expired token");
    }
  };
}

export function optionalAuth(db) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m) {
      req.user = null;
      return next();
    }
    try {
      const payload = jwt.verify(m[1], JWT_SECRET);
      const row = db
        .prepare(
          `SELECT u.id, u.email, u.full_name, u.role_id, r.name AS role_name
           FROM users u JOIN roles r ON r.id = u.role_id
           WHERE u.id = ? AND u.deleted_at IS NULL AND u.is_active = 1`
        )
        .get(payload.sub);
      req.user = row
        ? { id: row.id, email: row.email, full_name: row.full_name, role_id: row.role_id, role: row.role_name }
        : null;
    } catch {
      req.user = null;
    }
    next();
  };
}
