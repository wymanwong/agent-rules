import type { Response } from 'express';
import type { Database } from 'better-sqlite3';
import type { AuthRequest } from '../middleware/auth.js';
import { login } from '../services/authService.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as userRepo from '../repositories/userRepository.js';

export function createAuthController(db: Database) {
  return {
    login: async (req: AuthRequest, res: Response): Promise<void> => {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        throw new HttpError(400, 'email and password required');
      }
      const result = await login(db, email, password);
      if (!result) {
        throw new HttpError(401, 'Invalid credentials');
      }
      res.json({ token: result.token, user: result.user });
    },
    me: (req: AuthRequest, res: Response): void => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const u = userRepo.findUserById(db, req.user.userId);
      if (!u) throw new HttpError(404, 'User not found');
      const { password_hash: _, ...safe } = u;
      res.json(safe);
    },
  };
}
