import { api } from '../api';

export interface TeamOption {
  id: number;
  name: string;
}

export interface StaffOption {
  id: number;
  name: string;
  email: string;
  team_id: number | null;
}

export type AssignmentMetaPayload = { teams: TeamOption[]; staff: StaffOption[] };

let cached: AssignmentMetaPayload | null = null;
let inflight: Promise<AssignmentMetaPayload> | null = null;

/** Single-flight fetch; resolves from cache when already loaded. */
export function ensureAssignmentMeta(): Promise<AssignmentMetaPayload> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api<AssignmentMetaPayload>('/tickets/assignment-meta')
      .then((r) => {
        cached = r;
        return r;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Call after login on IT pages so the first Assign click is instant. */
export function warmAssignmentMeta(): void {
  void ensureAssignmentMeta().catch(() => {
    /* ignore — panel will retry */
  });
}

export function clearAssignmentMetaCache(): void {
  cached = null;
}
