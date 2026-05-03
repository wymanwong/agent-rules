import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { subscribeLive } from '../live/liveHub.js';

/** Server-Sent Events stream for live UI updates (tickets, KB, catalog). */
export function liveSse(req: AuthRequest, res: Response): void {
  if (!req.user) {
    res.status(401).end();
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  send(JSON.stringify({ type: 'connected', at: new Date().toISOString() }));

  const unsub = subscribeLive((json) => {
    try {
      send(json);
    } catch {
      /* client gone */
    }
  });

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 25_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsub();
  });
}
