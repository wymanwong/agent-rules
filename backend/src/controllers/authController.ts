import type { Response } from 'express';
import type { PoolClient } from 'pg';
import type { AuthRequest } from '../middleware/auth.js';
import { login } from '../services/authService.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as userRepo from '../repositories/userRepository.js';

export function createAuthController(_db: PoolClient | null) {
  void _db;
  return {
    login: async (req: AuthRequest, res: Response): Promise<void> => {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        throw new HttpError(400, 'email and password required');
      }
      const result = await login(null, email, password);
      if (!result) {
        throw new HttpError(401, 'Invalid credentials');
      }
      res.json({ token: result.token, user: result.user });
    },
    me: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) {
        res.json(null);
        return;
      }
      const u = await userRepo.findUserById(null, req.user.userId);
      if (!u) throw new HttpError(404, 'User not found');
      const { password_hash: _, ...safe } = u;
      res.json(safe);
    },
  };
}
