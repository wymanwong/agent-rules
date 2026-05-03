import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload, UserRole } from '../models/types.js';
import { verifyToken } from '../services/authService.js';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/** RFC 6750-style Bearer token from Authorization header (case-insensitive scheme). */
export function parseBearerToken(authorization: string | undefined): string | null {
  if (typeof authorization !== 'string') return null;
  const m = /^Bearer\s+(\S+)/i.exec(authorization.trim());
  return m ? m[1] : null;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
