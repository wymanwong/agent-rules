import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { uuid } from "../../db.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../shared/response.js";
import { insertAudit } from "../audit/audit.repo.js";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(["admin", "agent", "end_user"]),
});

const patchUserSchema = z.object({
  full_name: z.string().optional(),
  role: z.enum(["admin", "agent", "end_user"]).optional(),
  is_active: z.boolean().optional(),
});

export function usersRouter(db) {
  const r = Router();

  r.get("/", authenticate(db), authorize("admin"), (req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.email, u.full_name, u.is_active, u.last_login_at, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.deleted_at IS NULL ORDER BY u.full_name`
      )
      .all();
    ok(res, rows);
  });

  r.post("/", authenticate(db), authorize("admin"), validateBody(createUserSchema), (req, res) => {
    const roleRow = db.prepare(`SELECT id FROM roles WHERE name = ?`).get(req.validBody.role);
    if (!roleRow) return fail(res, 400, "BAD_ROLE", "Invalid role");

    const exists = db.prepare(`SELECT id FROM users WHERE lower(email) = lower(?)`).get(req.validBody.email);
    if (exists) return fail(res, 409, "EMAIL_IN_USE", "Email in use");

    const id = uuid();
    const hash = bcrypt.hashSync(req.validBody.password, 10);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role_id) VALUES (?, ?, ?, ?, ?)`
    ).run(id, req.validBody.email.trim().toLowerCase(), hash, req.validBody.full_name.trim(), roleRow.id);

    insertAudit(db, { entity_type: "user", entity_id: id, action: "created", actor_id: req.user.id });
    ok(res, { id }, {}, 201);
  });

  r.get("/:id", authenticate(db), (req, res) => {
    if (req.user.role === "end_user" && req.user.id !== req.params.id) {
      return fail(res, 403, "FORBIDDEN", "Forbidden");
    }
    const row = db
      .prepare(
        `SELECT u.id, u.email, u.full_name, u.avatar_url, u.is_active, u.last_login_at, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND u.deleted_at IS NULL`
      )
      .get(req.params.id);
    if (!row) return fail(res, 404, "NOT_FOUND", "User not found");
    ok(res, row);
  });

  r.patch("/:id", authenticate(db), authorize("admin"), validateBody(patchUserSchema), (req, res) => {
    const u = db.prepare(`SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`).get(req.params.id);
    if (!u) return fail(res, 404, "NOT_FOUND", "User not found");

    const dto = req.validBody;
    const updates = [];
    const vals = [];
    if (dto.full_name !== undefined) {
      updates.push("full_name = ?");
      vals.push(dto.full_name);
    }
    if (dto.is_active !== undefined) {
      updates.push("is_active = ?");
      vals.push(dto.is_active ? 1 : 0);
    }
    if (dto.role !== undefined) {
      const rr = db.prepare(`SELECT id FROM roles WHERE name = ?`).get(dto.role);
      if (!rr) return fail(res, 400, "BAD_ROLE", "Invalid role");
      updates.push("role_id = ?");
      vals.push(rr.id);
    }
    if (updates.length) {
      updates.push("updated_at = datetime('now')");
      vals.push(req.params.id);
      db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
    }
    insertAudit(db, { entity_type: "user", entity_id: req.params.id, action: "updated", actor_id: req.user.id });
    ok(res, { updated: true });
  });

  r.delete("/:id", authenticate(db), authorize("admin"), (req, res) => {
    db.prepare(`UPDATE users SET deleted_at = datetime('now') WHERE id = ?`).run(req.params.id);
    insertAudit(db, { entity_type: "user", entity_id: req.params.id, action: "soft_deleted", actor_id: req.user.id });
    ok(res, { deleted: true });
  });

  r.get("/:id/tickets", authenticate(db), authorize("admin", "agent"), (req, res) => {
    const rows = db
      .prepare(`SELECT id, ticket_number, title, status, priority FROM tickets WHERE requester_id = ? AND deleted_at IS NULL`)
      .all(req.params.id);
    ok(res, rows);
  });

  return r;
}
