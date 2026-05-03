import { useEffect, useRef } from 'react';
import { getToken } from '../api';

export type LiveEventPayload =
  | { type: 'connected'; at?: string }
  | {
      type: 'tickets' | 'ticket' | 'knowledge' | 'catalog' | 'staff';
      ticketId?: number;
      at: string;
    };

/**
 * Subscribe to server-sent events for cross-user live updates.
 * Uses `?token=` because EventSource cannot send Authorization headers.
 */
export function useLiveEvents(enabled: boolean, onEvent: (msg: LiveEventPayload) => void): void {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;

    const url = `/live/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as LiveEventPayload;
        if (msg.type === 'connected') return;
        cb.current(msg);
      } catch {
        /* ignore malformed */
      }
    };

    return () => {
      es.close();
    };
  }, [enabled]);
}
