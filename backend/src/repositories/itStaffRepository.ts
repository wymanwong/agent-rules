import type { PoolClient } from 'pg';
import { mapRows, query } from '../db/pg.js';

export interface ItStaffRow {
  id: number;
  name: string;
  email: string;
  department: string | null;
  role: string;
  team_id: number | null;
  team_name: string | null;
  active_tickets: number;
}

/** IT and Admin users with open workload counts (NexusDesk-style dispatch panel). */
export async function listItStaffWithWorkload(db: PoolClient | null): Promise<ItStaffRow[]> {
  void db;
  const r = await query<ItStaffRow>(
    `SELECT u.id, u.name, u.email, u.department, u.role, u.team_id,
            t.name AS team_name,
            COUNT(tk.id)::int AS active_tickets
     FROM users u
     LEFT JOIN teams t ON t.id = u.team_id
     LEFT JOIN tickets tk ON tk.assignee_id = u.id
       AND tk.status NOT IN ('Closed', 'Resolved', 'Completed')
     WHERE u.role IN ('IT', 'Admin')
     GROUP BY u.id, u.name, u.email, u.department, u.role, u.team_id, t.name
     ORDER BY u.name`,
  );
  return mapRows(r.rows);
}
