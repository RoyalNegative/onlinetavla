// Single Socket.IO connection to the game server (same origin; dev proxies it).

import { io, type Socket } from 'socket.io-client';
import type { Ack } from '../protocol';

export const socket: Socket = io({ autoConnect: true });

/** Emit an event and await the server's acknowledgement. */
export function emit(event: string, payload?: unknown): Promise<Ack> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (ack: Ack) => resolve(ack ?? { ok: true }));
  });
}
