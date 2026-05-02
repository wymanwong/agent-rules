import type { Response } from 'express';
import type { Database } from 'better-sqlite3';
import type { AuthRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as userRepo from '../repositories/userRepository.js';
import * as teamRepo from '../repositories/teamRepository.js';
import { hashPassword } from '../services/authService.js';
import type { UserRole } from '../models/types.js';

export function createAdminController(db: Database) {
  return {
    listUsers: (_req: AuthRequest, res: Response): void => {
      res.json({ users: userRepo.listUsersSafe(db) });
    },

    createUser: async (req: AuthRequest, res: Response): Promise<void> => {
      const b = req.body as Record<string, unknown>;
      const email = String(b.email ?? '');
      const password = String(b.password ?? '');
      const name = String(b.name ?? '');
      const role = b.role as UserRole;
      if (!email || !password || !name || !role) throw new HttpError(400, 'Missing fields');
      if (userRepo.findUserByEmail(db, email)) throw new HttpError(409, 'Email already exists');
      const now = new Date().toISOString();
      const id = userRepo.insertUser(db, {
        name,
        email,
        department: b.department != null ? String(b.department) : null,
        role,
        password_hash: await hashPassword(password),
        team_id: b.team_id != null ? Number(b.team_id) : null,
        created_at: now,
        updated_at: now,
      });
      res.status(201).json({ id });
    },

    updateUser: async (req: AuthRequest, res: Response): Promise<void> => {
      const id = Number(req.params.id);
      const u = userRepo.findUserById(db, id);
      if (!u) throw new HttpError(404, 'User not found');
      const b = req.body as Record<string, unknown>;
      const patch: Parameters<typeof userRepo.updateUser>[2] = {
        updated_at: new Date().toISOString(),
      };
      if (b.name !== undefined) patch.name = String(b.name);
      if (b.department !== undefined) patch.department = b.department as string | null;
      if (b.role !== undefined) patch.role = b.role as UserRole;
      if (b.team_id !== undefined) patch.team_id = b.team_id != null ? Number(b.team_id) : null;
      if (b.password !== undefined && String(b.password).length > 0) {
        patch.password_hash = await hashPassword(String(b.password));
      }
      userRepo.updateUser(db, id, patch);
      res.json({ ok: true });
    },

    deleteUser: (req: AuthRequest, res: Response): void => {
      const id = Number(req.params.id);
      if (req.user?.userId === id) throw new HttpError(400, 'Cannot delete self');
      userRepo.deleteUser(db, id);
      res.json({ ok: true });
    },

    listTeams: (_req: AuthRequest, res: Response): void => {
      res.json({ teams: teamRepo.listTeams(db) });
    },

    createTeam: (req: AuthRequest, res: Response): void => {
      const b = req.body as Record<string, unknown>;
      const name = String(b.name ?? '');
      if (!name) throw new HttpError(400, 'name required');
      const now = new Date().toISOString();
      const id = teamRepo.insertTeam(db, {
        name,
        description: b.description != null ? String(b.description) : null,
        created_at: now,
        updated_at: now,
      });
      res.status(201).json({ id });
    },

    updateTeam: (req: AuthRequest, res: Response): void => {
      const id = Number(req.params.id);
      const b = req.body as Record<string, unknown>;
      teamRepo.updateTeam(db, id, {
        ...(b.name !== undefined ? { name: String(b.name) } : {}),
        ...(b.description !== undefined ? { description: b.description as string | null } : {}),
        updated_at: new Date().toISOString(),
      });
      res.json({ ok: true });
    },

    deleteTeam: (req: AuthRequest, res: Response): void => {
      const id = Number(req.params.id);
      teamRepo.deleteTeam(db, id);
      res.json({ ok: true });
    },
  };
}
