import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PoolClient } from 'pg';
import { env } from '../config/env.js';
import type { JwtPayload, UserRole } from '../models/types.js';
import * as userRepo from '../repositories/userRepository.js';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
  return decoded;
}

export async function login(
  db: PoolClient | null,
  email: string,
  password: string,
): Promise<{ token: string; user: Omit<userRepo.UserRow, 'password_hash'> } | null> {
  const user = await userRepo.findUserByEmail(db, email);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  const token = signToken({
    userId: user.id,
    role: user.role as UserRole,
    teamId: user.team_id,
  });
  const { password_hash: _, ...safe } = user;
  return { token, user: safe };
}
