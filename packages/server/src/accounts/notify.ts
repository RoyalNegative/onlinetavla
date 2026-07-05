// Push notifications to a user's live sockets from outside the socket layer
// (e.g. the REST routes via the accounts store). Mirrors presence.ts: the
// socket layer initializes it, anyone can emit through it.

import type { Server } from 'socket.io';
import * as presence from './presence';

let io: Server | null = null;

export function initNotify(server: Server): void {
  io = server;
}

/** Emit `event` to every live socket of `uid`. No-op if they are offline. */
export function notifyUser(uid: string, event: string, payload: unknown): void {
  if (!io) return;
  for (const sid of presence.socketsFor(uid)) io.to(sid).emit(event, payload);
}
