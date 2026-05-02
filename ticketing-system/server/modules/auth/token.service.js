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

export async function issueRefreshToken(db, userId) {
  const raw = crypto.randomBytes(32).toString("hex");
  const token_hash = hashRefresh(raw);
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + REFRESH_TTL_SEC * 1000).toISOString();
  await db.query(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`, [
    id,
    userId,
    token_hash,
    expires,
  ]);
  return `${id}.${raw}`;
}

export async function revokeRefreshToken(db, composite) {
  const [id, raw] = String(composite || "").split(".", 2);
  if (!id || !raw) return false;
  const token_hash = hashRefresh(raw);
  const r = await db.query(`SELECT id FROM refresh_tokens WHERE id = ? AND token_hash = ?`, [id, token_hash]);
  if (!r.rows.length) return false;
  await db.query(`DELETE FROM refresh_tokens WHERE id = ?`, [id]);
  return true;
}

export async function consumeRefreshToken(db, composite) {
  const [id, raw] = String(composite || "").split(".", 2);
  if (!id || !raw) return null;
  const token_hash = hashRefresh(raw);
  const r = await db.query(`SELECT user_id, expires_at FROM refresh_tokens WHERE id = ? AND token_hash = ?`, [
    id,
    token_hash,
  ]);
  const row = r.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.query(`DELETE FROM refresh_tokens WHERE id = ?`, [id]);
    return null;
  }
  await db.query(`DELETE FROM refresh_tokens WHERE id = ?`, [id]);
  return row.user_id;
}
