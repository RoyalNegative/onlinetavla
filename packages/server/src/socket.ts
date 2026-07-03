// Socket.IO wiring: validate inbound events, drive the RoomManager, push a
// per-seat view to every participant, auto-pass dead turns, and record finished
// matches to the (optional) accounts store.

import type { Server, Socket } from 'socket.io';
import { games } from '@tavla/engine';
import type { GameMode } from '@tavla/engine';
import { verifyIdToken } from './accounts/firebase';
import * as presence from './accounts/presence';
import { isFriend, recordMatchResult, type MatchPlayer } from './accounts/store';
import type { RoomManager, Room, ChatMessage } from './rooms';
import type {
  Ack,
  ActionPayload,
  ChatPayload,
  CreatePayload,
  JoinPayload,
  RoomSnapshot,
} from './protocol';

const ALLOWED_TARGETS = [1, 3, 5, 7, 11];
const PASS_DELAY_MS = 1300;

function cleanName(name: unknown): string {
  const s = typeof name === 'string' ? name.trim().slice(0, 20) : '';
  return s.length > 0 ? s : 'Oyuncu';
}

function cleanMode(mode: unknown): GameMode {
  return mode === 'backgammon' ? 'backgammon' : 'classic';
}

function cleanTarget(t: unknown): number {
  const n = typeof t === 'number' ? t : 5;
  return ALLOWED_TARGETS.includes(n) ? n : 5;
}

function cleanGameId(g: unknown): string {
  return typeof g === 'string' && g in games ? g : 'tavla';
}

function buildSnapshot(room: Room): RoomSnapshot {
  return {
    roomId: room.id,
    gameId: room.gameId,
    status: games[room.gameId].isOver(room.state) ? 'finished' : room.seats.length < 2 ? 'waiting' : 'playing',
    players: room.seats.map((s) => ({
      seat: s.index,
      color: s.index === 0 ? 'white' : 'black',
      name: s.name,
      uid: s.uid,
      avatar: s.avatar,
      connected: s.connected,
    })),
    spectators: room.spectators.size,
    chat: room.chat,
    rematch: { votes: room.seats.filter((s) => s.rematchVote).length, needed: 2 },
  };
}

function broadcastRoom(io: Server, room: Room): void {
  const snapshot = buildSnapshot(room);
  const game = games[room.gameId];
  for (const seat of room.seats) {
    if (seat.socketId && seat.connected) {
      io.to(seat.socketId).emit('room:update', {
        you: { seat: seat.index, name: seat.name, uid: seat.uid },
        view: game.viewFor(room.state, seat.index),
        room: snapshot,
      });
    }
  }
  for (const [sid, info] of room.spectators) {
    if (room.seats.some((s) => s.socketId === sid)) continue; // safety: seat wins
    io.to(sid).emit('room:update', {
      you: { seat: null, name: info.name, uid: null },
      view: game.viewFor(room.state, null),
      room: snapshot,
    });
  }
}

function systemMessage(text: string): ChatMessage {
  return {
    id: Math.random().toString(36).slice(2),
    from: 'Sistem',
    uid: null,
    text,
    ts: Date.now(),
    kind: 'system',
  };
}

const CHAT_WINDOW_MS = 5000;
const CHAT_MAX_IN_WINDOW = 5;

interface QueueEntry {
  socketId: string;
  name: string;
  uid: string | null;
  avatar: string | null;
}

export function attachSockets(io: Server, rooms: RoomManager): void {
  const passTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const chatTimes = new Map<string, number[]>();
  const queues = new Map<string, QueueEntry[]>(); // gameId -> waiting players

  function leaveQueues(socketId: string): void {
    for (const [g, list] of queues) queues.set(g, list.filter((e) => e.socketId !== socketId));
  }

  function allowChat(socketId: string): boolean {
    const now = Date.now();
    const recent = (chatTimes.get(socketId) ?? []).filter((t) => now - t < CHAT_WINDOW_MS);
    if (recent.length >= CHAT_MAX_IN_WINDOW) {
      chatTimes.set(socketId, recent);
      return false;
    }
    recent.push(now);
    chatTimes.set(socketId, recent);
    return true;
  }

  function maybeAutoStep(room: Room): void {
    const step = games[room.gameId].needsAutoStep?.(room.state);
    if (!step || passTimers.has(room.id)) return;
    const timer = setTimeout(() => {
      passTimers.delete(room.id);
      const current = rooms.get(room.id);
      if (!current) return;
      const s = games[current.gameId].needsAutoStep?.(current.state);
      if (!s) return;
      try {
        rooms.applyAction(current, s.seat, s.action);
      } catch {
        /* state already advanced */
      }
      broadcastRoom(io, current);
    }, PASS_DELAY_MS);
    passTimers.set(room.id, timer);
  }

  async function maybeRecord(room: Room): Promise<void> {
    const game = games[room.gameId];
    if (!game.isOver(room.state) || room.recordedMatch) return;
    const res = game.result?.(room.state);
    if (!res) return;
    room.recordedMatch = true;
    const players: MatchPlayer[] = room.seats.map((s) => ({
      seat: s.index,
      color: s.index === 0 ? 'white' : 'black',
      uid: s.uid,
      name: s.name,
      avatar: s.avatar,
      score: res.scores[s.index] ?? 0,
    }));
    try {
      await recordMatchResult({
        roomId: room.id,
        gameId: room.gameId,
        players,
        winnerColor: res.winnerSeat === 0 ? 'white' : 'black',
        finalKind: res.kind,
        finishedAt: Date.now(),
      });
    } catch (e) {
      console.warn('[accounts] record failed:', (e as Error).message);
    }
  }

  io.on('connection', (socket: Socket) => {
    socket.on('room:create', async (payload: CreatePayload, cb?: (ack: Ack) => void) => {
      const user = await verifyIdToken(payload?.idToken);
      const gameId = cleanGameId(payload?.gameId);
      const config =
        gameId === 'tavla'
          ? { mode: cleanMode(payload?.mode), targetPoints: cleanTarget(payload?.targetPoints) }
          : {};
      const room = rooms.create(gameId, config);
      const result = rooms.join(room, {
        name: cleanName(payload?.name),
        uid: user?.uid ?? null,
        avatar: user?.picture ?? null,
        socketId: socket.id,
      });
      socket.join(room.id);
      broadcastRoom(io, room);
      const seat = 'seat' in result ? result.seat : null;
      cb?.({ ok: true, roomId: room.id, token: seat?.token, seat: seat?.index ?? null });
    });

    socket.on('room:join', async (payload: JoinPayload, cb?: (ack: Ack) => void) => {
      const room = rooms.get(payload?.roomId ?? '');
      if (!room) return cb?.({ ok: false, error: 'room_not_found' });
      const wasFull = room.seats.length >= 2;
      const user = await verifyIdToken(payload?.idToken);
      const result = rooms.join(room, {
        name: cleanName(payload?.name),
        uid: user?.uid ?? null,
        avatar: user?.picture ?? null,
        token: payload?.token,
        socketId: socket.id,
      });
      socket.join(room.id);
      if ('seat' in result && !wasFull) {
        rooms.addChat(room, systemMessage(`${result.seat.name} katıldı`));
      }
      broadcastRoom(io, room);
      maybeAutoStep(room);
      if ('seat' in result) {
        cb?.({ ok: true, roomId: room.id, token: result.seat.token, seat: result.seat.index });
      } else {
        cb?.({ ok: true, roomId: room.id, spectator: true, seat: null });
      }
    });

    socket.on('game:action', (payload: ActionPayload, cb?: (ack: Ack) => void) => {
      const room = rooms.roomForSocket(socket.id);
      if (!room) return cb?.({ ok: false, error: 'no_room' });
      const seat = rooms.seatForSocket(room, socket.id);
      if (!seat) return cb?.({ ok: false, error: 'spectators_cannot_act' });
      try {
        rooms.applyAction(room, seat.index, payload.action);
      } catch (e) {
        return cb?.({ ok: false, error: (e as Error).message });
      }
      broadcastRoom(io, room);
      void maybeRecord(room);
      maybeAutoStep(room);
      cb?.({ ok: true });
    });

    socket.on('rematch:vote', (_payload: unknown, cb?: (ack: Ack) => void) => {
      const room = rooms.roomForSocket(socket.id);
      if (!room) return cb?.({ ok: false, error: 'no_room' });
      const seat = rooms.seatForSocket(room, socket.id);
      if (!seat) return cb?.({ ok: false, error: 'spectators_cannot_act' });
      rooms.voteRematch(room, seat.index);
      broadcastRoom(io, room);
      cb?.({ ok: true });
    });

    socket.on('chat:send', (payload: ChatPayload, cb?: (ack: Ack) => void) => {
      const room = rooms.roomForSocket(socket.id);
      if (!room) return cb?.({ ok: false, error: 'no_room' });
      const text = typeof payload?.text === 'string' ? payload.text.trim().slice(0, 280) : '';
      if (!text) return cb?.({ ok: false, error: 'empty' });
      if (!allowChat(socket.id)) return cb?.({ ok: false, error: 'rate_limited' });
      const seat = rooms.seatForSocket(room, socket.id);
      const from = seat?.name ?? room.spectators.get(socket.id)?.name ?? 'Oyuncu';
      rooms.addChat(room, {
        id: Math.random().toString(36).slice(2),
        from,
        uid: seat?.uid ?? null,
        text,
        ts: Date.now(),
        kind: payload?.kind === 'emoji' ? 'emoji' : 'chat',
      });
      broadcastRoom(io, room);
      cb?.({ ok: true });
    });

    // Online matchmaking: queue per game; pair the first two waiting players.
    socket.on('matchmake', async (payload: { gameId?: string; name?: string; idToken?: string | null }, cb?: (ack: Ack) => void) => {
      const user = await verifyIdToken(payload?.idToken);
      const gameId = cleanGameId(payload?.gameId);
      const me: QueueEntry = { socketId: socket.id, name: cleanName(payload?.name), uid: user?.uid ?? null, avatar: user?.picture ?? null };
      const waiting = (queues.get(gameId) ?? []).filter(
        (e) => e.socketId !== socket.id && io.sockets.sockets.get(e.socketId)?.connected,
      );
      const opp = waiting.shift();
      if (!opp) {
        waiting.push(me);
        queues.set(gameId, waiting);
        return cb?.({ ok: true });
      }
      queues.set(gameId, waiting);
      const config = gameId === 'tavla' ? { mode: 'classic', targetPoints: 1 } : {};
      const room = rooms.create(gameId, config);
      const r1 = rooms.join(room, { name: opp.name, uid: opp.uid, avatar: opp.avatar, socketId: opp.socketId });
      const r2 = rooms.join(room, { name: me.name, uid: me.uid, avatar: me.avatar, socketId: me.socketId });
      io.sockets.sockets.get(opp.socketId)?.join(room.id);
      socket.join(room.id);
      broadcastRoom(io, room);
      io.to(opp.socketId).emit('matchmake:found', { roomId: room.id, token: 'seat' in r1 ? r1.seat.token : undefined });
      socket.emit('matchmake:found', { roomId: room.id, token: 'seat' in r2 ? r2.seat.token : undefined });
      cb?.({ ok: true });
    });

    socket.on('matchmake:cancel', () => leaveQueues(socket.id));

    // Presence: register the authenticated user as online for this socket.
    socket.on('presence:online', async (payload: { idToken?: string | null }) => {
      const user = await verifyIdToken(payload?.idToken);
      if (user) {
        presence.attach(user.uid, socket.id);
        socket.data.uid = user.uid;
      }
    });

    // Invite a friend to a fresh room. Requires auth, an actual friendship, and
    // an online recipient; the inviter's name comes from the verified token.
    socket.on('friend:invite', async (payload: { toUid?: string; gameId?: string; idToken?: string | null }, cb?: (ack: Ack) => void) => {
      const user = await verifyIdToken(payload?.idToken);
      if (!user) return cb?.({ ok: false, error: 'unauthorized' });
      const toUid = String(payload?.toUid ?? '');
      if (!toUid || toUid === user.uid) return cb?.({ ok: false, error: 'bad_request' });
      if (!(await isFriend(user.uid, toUid))) return cb?.({ ok: false, error: 'not_friend' });
      const targets = presence.socketsFor(toUid);
      if (targets.length === 0) return cb?.({ ok: false, error: 'offline' });

      const fromName = cleanName(user.name);
      const gameId = cleanGameId(payload?.gameId);
      const config = gameId === 'tavla' ? { mode: 'classic', targetPoints: 1 } : {};
      const room = rooms.create(gameId, config);
      const r = rooms.join(room, { name: fromName, uid: user.uid, avatar: user.picture, socketId: socket.id });
      socket.join(room.id);
      broadcastRoom(io, room);
      for (const sid of targets) io.to(sid).emit('friend:invited', { fromName, roomId: room.id, gameId });
      cb?.({ ok: true, roomId: room.id, token: 'seat' in r ? r.seat.token : undefined });
    });

    socket.on('disconnect', () => {
      chatTimes.delete(socket.id);
      leaveQueues(socket.id);
      const uid = socket.data?.uid as string | undefined;
      if (uid) presence.detach(uid, socket.id);
      const room = rooms.detach(socket.id);
      if (room) broadcastRoom(io, room);
    });
  });

  // Periodic cleanup of abandoned rooms.
  setInterval(() => rooms.sweep(30 * 60 * 1000), 5 * 60 * 1000).unref();
}
