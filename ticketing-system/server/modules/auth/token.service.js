import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ACCESS_TTL_SEC, JWT_SECRET, REFRESH_TTL_SEC } from "../../config.js";

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role ?? user.role_name },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL_SEC }
  );
}

export function hashRefresh(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function issueRefreshToken(db, userId) {
  const raw = crypto.randomBytes(32).toString("hex");
  const token_hash = hashRefresh(raw);
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + REFRESH_TTL_SEC * 1000).toISOString();
  db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`
  ).run(id, userId, token_hash, expires);
  return `${id}.${raw}`;
}

export function revokeRefreshToken(db, composite) {
  const [id, raw] = String(composite || "").split(".", 2);
  if (!id || !raw) return false;
  const token_hash = hashRefresh(raw);
  const row = db.prepare(`SELECT id FROM refresh_tokens WHERE id = ? AND token_hash = ?`).get(id, token_hash);
  if (!row) return false;
  db.prepare(`DELETE FROM refresh_tokens WHERE id = ?`).run(id);
  return true;
}

/** Validates refresh token, deletes it (rotation), returns user id */
export function consumeRefreshToken(db, composite) {
  const [id, raw] = String(composite || "").split(".", 2);
  if (!id || !raw) return null;
  const token_hash = hashRefresh(raw);
  const row = db
    .prepare(`SELECT user_id, expires_at FROM refresh_tokens WHERE id = ? AND token_hash = ?`)
    .get(id, token_hash);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(`DELETE FROM refresh_tokens WHERE id = ?`).run(id);
    return null;
  }
  db.prepare(`DELETE FROM refresh_tokens WHERE id = ?`).run(id);
  return row.user_id;
}
