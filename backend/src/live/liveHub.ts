import { EventEmitter } from 'node:events';

export type LivePayload = {
  type: 'tickets' | 'ticket' | 'knowledge' | 'catalog';
  ticketId?: number;
  at: string;
};

const bus = new EventEmitter();
bus.setMaxListeners(2000);

export function emitLive(payload: LivePayload): void {
  bus.emit('msg', JSON.stringify(payload));
}

export function subscribeLive(listener: (json: string) => void): () => void {
  bus.on('msg', listener);
  return () => bus.off('msg', listener);
}
