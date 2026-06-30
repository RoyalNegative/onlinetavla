// In-memory online presence: maps authenticated uids to their live sockets.
// Shared by the socket layer (writes) and the REST routes (reads).

const sockets = new Map<string, Set<string>>(); // uid -> socketIds

export function attach(uid: string, socketId: string): void {
  let set = sockets.get(uid);
  if (!set) {
    set = new Set();
    sockets.set(uid, set);
  }
  set.add(socketId);
}

export function detach(uid: string, socketId: string): void {
  const set = sockets.get(uid);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) sockets.delete(uid);
}

export function isOnline(uid: string): boolean {
  return sockets.has(uid);
}

export function socketsFor(uid: string): string[] {
  return [...(sockets.get(uid) ?? [])];
}
