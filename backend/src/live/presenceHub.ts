import { emitLive } from './liveHub.js';

/** Ref-counted SSE connections per user (multiple tabs = multiple connections). */
const connectionCount = new Map<number, number>();

function emitStaffPresenceChanged(): void {
  emitLive({ type: 'staff', at: new Date().toISOString() });
}

/** Call when an authenticated user opens the live SSE stream. */
export function presenceRegister(userId: number): void {
  const prev = connectionCount.get(userId) ?? 0;
  connectionCount.set(userId, prev + 1);
  if (prev === 0) emitStaffPresenceChanged();
}

/** Call when that SSE connection closes. */
export function presenceUnregister(userId: number): void {
  const prev = connectionCount.get(userId) ?? 0;
  if (prev <= 1) {
    connectionCount.delete(userId);
    if (prev === 1) emitStaffPresenceChanged();
    return;
  }
  connectionCount.set(userId, prev - 1);
}

export function presenceOnlineUserIds(): Set<number> {
  return new Set(connectionCount.keys());
}
