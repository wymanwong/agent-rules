import type { Response } from 'express';
import type { PoolClient } from 'pg';
import type { AuthRequest } from '../middleware/auth.js';
import * as itStaffRepo from '../repositories/itStaffRepository.js';
import { presenceOnlineUserIds } from '../live/presenceHub.js';

export function createItStaffController(_db: PoolClient | null) {
  void _db;
  return {
    list: async (_req: AuthRequest, res: Response): Promise<void> => {
      const staff = await itStaffRepo.listItStaffWithWorkload(null);
      const online = presenceOnlineUserIds();
      res.json({
        staff: staff.map((s) => ({
          ...s,
          online: online.has(s.id),
        })),
      });
    },
  };
}
