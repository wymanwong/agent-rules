import type { Response } from 'express';
import type { PoolClient } from 'pg';
import type { AuthRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as userRepo from '../repositories/userRepository.js';
import * as teamRepo from '../repositories/teamRepository.js';
import { hashPassword } from '../services/authService.js';
import type { UserRole } from '../models/types.js';
import { emitLive } from '../live/liveHub.js';

export function createAdminController(_db: PoolClient | null) {
  void _db;
  return {
    listUsers: async (_req: AuthRequest, res: Response): Promise<void> => {
      res.json({ users: await userRepo.listUsersSafe(null) });
    },

    createUser: async (req: AuthRequest, res: Response): Promise<void> => {
      const b = req.body as Record<string, unknown>;
      const email = String(b.email ?? '');
      const password = String(b.password ?? '');
      const name = String(b.name ?? '');
      const role = b.role as UserRole;
      if (!email || !password || !name || !role) throw new HttpError(400, 'Missing fields');
      if (await userRepo.findUserByEmail(null, email)) throw new HttpError(409, 'Email already exists');
      const now = new Date().toISOString();
      const id = await userRepo.insertUser(null, {
        name,
        email,
        department: b.department != null ? String(b.department) : null,
        role,
        password_hash: await hashPassword(password),
        team_id: b.team_id != null ? Number(b.team_id) : null,
        created_at: now,
        updated_at: now,
      });
      emitLive({ type: 'tickets', at: now });
      emitLive({ type: 'staff', at: now });
      res.status(201).json({ id });
    },

    updateUser: async (req: AuthRequest, res: Response): Promise<void> => {
      const id = Number(req.params.id);
      const u = await userRepo.findUserById(null, id);
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
      await userRepo.updateUser(null, id, patch);
      emitLive({ type: 'tickets', at: patch.updated_at! });
      emitLive({ type: 'staff', at: patch.updated_at! });
      res.json({ ok: true });
    },

    deleteUser: async (req: AuthRequest, res: Response): Promise<void> => {
      const id = Number(req.params.id);
      if (req.user?.userId === id) throw new HttpError(400, 'Cannot delete self');
      await userRepo.deleteUser(null, id);
      const at = new Date().toISOString();
      emitLive({ type: 'tickets', at });
      emitLive({ type: 'staff', at });
      res.json({ ok: true });
    },

    listTeams: async (_req: AuthRequest, res: Response): Promise<void> => {
      res.json({ teams: await teamRepo.listTeams(null) });
    },

    createTeam: async (req: AuthRequest, res: Response): Promise<void> => {
      const b = req.body as Record<string, unknown>;
      const name = String(b.name ?? '');
      if (!name) throw new HttpError(400, 'name required');
      const now = new Date().toISOString();
      const id = await teamRepo.insertTeam(null, {
        name,
        description: b.description != null ? String(b.description) : null,
        created_at: now,
        updated_at: now,
      });
      emitLive({ type: 'tickets', at: now });
      emitLive({ type: 'staff', at: now });
      res.status(201).json({ id });
    },

    updateTeam: async (req: AuthRequest, res: Response): Promise<void> => {
      const id = Number(req.params.id);
      const b = req.body as Record<string, unknown>;
      await teamRepo.updateTeam(null, id, {
        ...(b.name !== undefined ? { name: String(b.name) } : {}),
        ...(b.description !== undefined ? { description: b.description as string | null } : {}),
        updated_at: new Date().toISOString(),
      });
      const at = new Date().toISOString();
      emitLive({ type: 'tickets', at });
      emitLive({ type: 'staff', at });
      res.json({ ok: true });
    },

    deleteTeam: async (req: AuthRequest, res: Response): Promise<void> => {
      const id = Number(req.params.id);
      await teamRepo.deleteTeam(null, id);
      const at = new Date().toISOString();
      emitLive({ type: 'tickets', at });
      emitLive({ type: 'staff', at });
      res.json({ ok: true });
    },
  };
}
