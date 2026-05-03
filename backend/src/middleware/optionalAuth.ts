import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { verifyToken } from '../services/authService.js';

/** Attach req.user when Bearer token is valid; otherwise continue without user */
export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
  } catch {
    /* ignore invalid token for public routes */
  }
  next();
}
