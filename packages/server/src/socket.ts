// Socket.IO wiring: validate inbound events, drive the RoomManager, push a
// per-seat view to every participant, auto-pass dead turns, and record finished
// matches to the (optional) accounts store.

import type { Server, Socket } from 'socket.io';
import { mustPass, seatToColor, tavlaModule } from '@tavla/engine';
import type { GameMode } from '@tavla/engine';
import { verifyIdToken } from './accounts/firebase';
import { recordMatchResult, type MatchPlayer } from './accounts/store';
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

function buildSnapshot(room: Room): RoomSnapshot {
  return {
    roomId: room.id,
    gameId: room.gameId,
    status: room.state.matchWinner ? 'finished' : room.seats.length < 2 ? 'waiting' : 'playing',
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
  for (const seat of room.seats) {
    if (seat.socketId && seat.connected) {
      io.to(seat.socketId).emit('room:update', {
        you: { seat: seat.index, name: seat.name, uid: seat.uid },
        view: tavlaModule.viewFor(room.state, seat.index),
        room: snapshot,
      });
    }
  }
  for (const [sid, info] of room.spectators) {
    if (room.seats.some((s) => s.socketId === sid)) continue; // safety: seat wins
    io.to(sid).emit('room:update', {
      you: { seat: null, name: info.name, uid: null },
      view: tavlaModule.viewFor(room.state, null),
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

export function attachSockets(io: Server, rooms: RoomManager): void {
  const passTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const chatTimes = new Map<string, number[]>();

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

  function maybeAutoPass(room: Room): void {
    if (room.state.matchWinner) return;
    if (!mustPass(room.state.game)) return;
    if (passTimers.has(room.id)) return;
    const timer = setTimeout(() => {
      passTimers.delete(room.id);
      const current = rooms.get(room.id);
      if (!current || !mustPass(current.state.game)) return;
      const seatIndex = current.seats.find(
        (s) => seatToColor(s.index) === current.state.game.turn,
      )?.index;
      if (seatIndex === undefined) return;
      try {
        rooms.applyAction(current, seatIndex, { type: 'pass' });
      } catch {
        /* state already advanced */
      }
      broadcastRoom(io, current);
    }, PASS_DELAY_MS);
    passTimers.set(room.id, timer);
  }

  async function maybeRecord(room: Room): Promise<void> {
    if (!room.state.matchWinner || room.recordedMatch) return;
    room.recordedMatch = true;
    const players: MatchPlayer[] = room.seats.map((s) => ({
      seat: s.index,
      color: s.index === 0 ? 'white' : 'black',
      uid: s.uid,
      name: s.name,
      avatar: s.avatar,
      score: s.index === 0 ? room.state.score.white : room.state.score.black,
    }));
    try {
      await recordMatchResult({
        roomId: room.id,
        mode: room.config.mode,
        targetPoints: room.config.targetPoints,
        players,
        winnerColor: room.state.matchWinner,
        finalKind: room.state.lastResult?.kind ?? 'single',
        finishedAt: Date.now(),
      });
    } catch (e) {
      console.warn('[accounts] record failed:', (e as Error).message);
    }
  }

  io.on('connection', (socket: Socket) => {
    socket.on('room:create', async (payload: CreatePayload, cb?: (ack: Ack) => void) => {
      const user = await verifyIdToken(payload?.idToken);
      const config = { mode: cleanMode(payload?.mode), targetPoints: cleanTarget(payload?.targetPoints) };
      const room = rooms.create(config);
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
      maybeAutoPass(room);
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
      maybeAutoPass(room);
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

    socket.on('disconnect', () => {
      chatTimes.delete(socket.id);
      const room = rooms.detach(socket.id);
      if (room) broadcastRoom(io, room);
    });
  });

  // Periodic cleanup of abandoned rooms.
  setInterval(() => rooms.sweep(30 * 60 * 1000), 5 * 60 * 1000).unref();
}
