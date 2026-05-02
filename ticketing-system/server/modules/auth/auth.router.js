import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { uuid } from "../../db.js";
import { validateBody } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { ok, fail } from "../../shared/response.js";
import { issueRefreshToken, signAccessToken, consumeRefreshToken, revokeRefreshToken } from "./token.service.js";
import { insertAudit } from "../audit/audit.repo.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export function authRouter(db) {
  const r = Router();

  r.post(
    "/login",
    validateBody(loginSchema),
    asyncHandler(async (req, res) => {
      const { email, password } = req.validBody;
      const qr = await db.query(
        `SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id
         WHERE lower(u.email) = lower(?) AND u.deleted_at IS NULL AND u.is_active = TRUE`,
        [email.trim()]
      );
      const user = qr.rows[0];
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return fail(res, 401, "INVALID_CREDENTIALS", "Invalid email or password");
      }
      await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);
      const accessToken = signAccessToken({ id: user.id, role: user.role_name });
      const refreshToken = await issueRefreshToken(db, user.id);
      ok(res, {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role_name },
      });
    })
  );

  r.post(
    "/register",
    validateBody(registerSchema),
    asyncHandler(async (req, res) => {
      const rr = await db.query(`SELECT id FROM roles WHERE name = 'end_user'`);
      const ROLE_END_USER = rr.rows[0]?.id;
      if (!ROLE_END_USER) return fail(res, 500, "SERVER_ERROR", "Roles not seeded");

      const ex = await db.query(`SELECT id FROM users WHERE lower(email) = lower(?)`, [req.validBody.email.trim()]);
      if (ex.rows.length) return fail(res, 409, "EMAIL_IN_USE", "Email already registered");

      const id = uuid();
      const hash = bcrypt.hashSync(req.validBody.password, 10);
      await db.query(`INSERT INTO users (id, email, password_hash, full_name, role_id) VALUES (?, ?, ?, ?, ?)`, [
        id,
        req.validBody.email.trim().toLowerCase(),
        hash,
        req.validBody.full_name.trim(),
        ROLE_END_USER,
      ]);

      await insertAudit(db, {
        entity_type: "user",
        entity_id: id,
        action: "created",
        actor_id: id,
        changes: { via: "self_registration" },
      });

      const accessToken = signAccessToken({ id, role: "end_user" });
      const refreshToken = await issueRefreshToken(db, id);
      ok(res, {
        accessToken,
        refreshToken,
        user: {
          id,
          email: req.validBody.email.trim().toLowerCase(),
          full_name: req.validBody.full_name,
          role: "end_user",
        },
      });
    })
  );

  r.post(
    "/refresh",
    validateBody(refreshSchema),
    asyncHandler(async (req, res) => {
      const userId = await consumeRefreshToken(db, req.validBody.refreshToken);
      if (!userId) return fail(res, 401, "INVALID_REFRESH", "Refresh token invalid or expired");

      const ur = await db.query(
        `SELECT u.id, u.email, u.full_name, r.name AS role_name FROM users u
         JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND u.deleted_at IS NULL AND u.is_active = TRUE`,
        [userId]
      );
      const user = ur.rows[0];
      if (!user) return fail(res, 401, "INVALID_REFRESH", "User inactive");

      const accessToken = signAccessToken({ id: user.id, role: user.role_name });
      const refreshToken = await issueRefreshToken(db, user.id);
      ok(res, { accessToken, refreshToken });
    })
  );

  r.post(
    "/logout",
    authenticate(db),
    validateBody(logoutSchema),
    asyncHandler(async (req, res) => {
      if (req.validBody.refreshToken) await revokeRefreshToken(db, req.validBody.refreshToken);
      ok(res, { loggedOut: true });
    })
  );

  r.get(
    "/me",
    authenticate(db),
    asyncHandler(async (req, res) => {
      ok(res, {
        user: {
          id: req.user.id,
          email: req.user.email,
          full_name: req.user.full_name,
          role: req.user.role,
        },
      });
    })
  );

  return r;
}
