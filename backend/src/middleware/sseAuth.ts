import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { verifyToken } from '../services/authService.js';

/** For SSE: browsers cannot set Authorization on EventSource; allow ?token=JWT */
export function authenticateSse(req: AuthRequest, res: Response, next: NextFunction): void {
  const q = req.query.token;
  const fromQuery = typeof q === 'string' ? q : undefined;
  const header = req.headers.authorization;
  const fromBearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = fromBearer || fromQuery;
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
