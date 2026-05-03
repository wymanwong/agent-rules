import type { Response, NextFunction } from 'express';
import { parseBearerToken, type AuthRequest } from './auth.js';
import { verifyToken } from '../services/authService.js';

/** Attach req.user when Bearer token is valid; otherwise continue without user */
export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    next();
    return;
  }
  try {
    req.user = verifyToken(token);
  } catch {
    /* ignore invalid token for public routes */
  }
  next();
}
