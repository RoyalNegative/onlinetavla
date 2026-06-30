// Game-agnostic room store. A room owns a game module instance (currently
// tavla), the seated players, spectators, and chat. It holds *data and state
// transitions only* — all IO (sockets, Firestore) lives in the socket layer.

import { customAlphabet } from 'nanoid';
import { tavlaModule } from '@tavla/engine';
import type { Action, MatchConfig, MatchState } from '@tavla/engine';
import { cryptoRng } from './crypto-rng';

const newRoomId = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 6); // unambiguous
const newToken = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);

export type ChatKind = 'chat' | 'emoji' | 'system';

export interface ChatMessage {
  id: string;
  from: string;
  uid: string | null;
  text: string;
  ts: number;
  kind: ChatKind;
}

export interface Seat {
  index: number; // 0 = white, 1 = black
  token: string; // reconnect token (kept server-side and on the client)
  name: string;
  uid: string | null;
  avatar: string | null;
  socketId: string | null;
  connected: boolean;
  rematchVote: boolean;
}

export interface Room {
  id: string;
  gameId: string; // which GameModule (tavla)
  config: MatchConfig;
  state: MatchState;
  seats: Seat[];
  spectators: Map<string, { name: string }>;
  chat: ChatMessage[];
  recordedMatch: boolean; // result already written to accounts?
  createdAt: number;
  lastActive: number;
}

export interface JoinInfo {
  name: string;
  uid: string | null;
  avatar: string | null;
  token?: string;
  socketId: string;
}

export type JoinResult = { seat: Seat } | { spectator: true };

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketRoom = new Map<string, string>();

  create(config: MatchConfig): Room {
    let id = newRoomId();
    while (this.rooms.has(id)) id = newRoomId();
    const room: Room = {
      id,
      gameId: tavlaModule.id,
      config,
      state: tavlaModule.createInitialState(config),
      seats: [],
      spectators: new Map(),
      chat: [],
      recordedMatch: false,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
    this.rooms.set(id, room);
    return room;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  roomForSocket(socketId: string): Room | undefined {
    const id = this.socketRoom.get(socketId);
    return id ? this.rooms.get(id) : undefined;
  }

  join(room: Room, info: JoinInfo): JoinResult {
    this.socketRoom.set(info.socketId, room.id);
    room.lastActive = Date.now();

    // 1) reconnect by explicit token
    if (info.token) {
      const seat = room.seats.find((s) => s.token === info.token);
      if (seat) {
        seat.socketId = info.socketId;
        seat.connected = true;
        if (info.name) seat.name = info.name;
        if (info.uid) seat.uid = info.uid;
        if (info.avatar) seat.avatar = info.avatar;
        return { seat };
      }
    }
    // 2) reconnect by authenticated uid taking over its disconnected seat
    if (info.uid) {
      const seat = room.seats.find((s) => s.uid === info.uid && !s.connected);
      if (seat) {
        seat.socketId = info.socketId;
        seat.connected = true;
        if (info.name) seat.name = info.name;
        return { seat };
      }
    }
    // 3) take a free seat
    if (room.seats.length < 2) {
      const seat: Seat = {
        index: room.seats.length,
        token: newToken(),
        name: info.name,
        uid: info.uid,
        avatar: info.avatar,
        socketId: info.socketId,
        connected: true,
        rematchVote: false,
      };
      room.seats.push(seat);
      return { seat };
    }
    // 4) spectate
    room.spectators.set(info.socketId, { name: info.name });
    return { spectator: true };
  }

  seatForSocket(room: Room, socketId: string): Seat | undefined {
    return room.seats.find((s) => s.socketId === socketId);
  }

  applyAction(room: Room, seatIndex: number, action: Action): void {
    room.state = tavlaModule.applyAction(room.state, action, seatIndex, cryptoRng);
    room.lastActive = Date.now();
  }

  voteRematch(room: Room, seatIndex: number): boolean {
    const seat = room.seats.find((s) => s.index === seatIndex);
    if (seat) seat.rematchVote = true;
    const both = room.seats.length === 2 && room.seats.every((s) => s.rematchVote);
    if (both) this.resetMatch(room);
    return both;
  }

  resetMatch(room: Room): void {
    room.state = tavlaModule.createInitialState(room.config);
    room.recordedMatch = false;
    room.seats.forEach((s) => (s.rematchVote = false));
    room.lastActive = Date.now();
  }

  addChat(room: Room, msg: ChatMessage): void {
    room.chat.push(msg);
    if (room.chat.length > 100) room.chat.splice(0, room.chat.length - 100);
    room.lastActive = Date.now();
  }

  detach(socketId: string): Room | undefined {
    const room = this.roomForSocket(socketId);
    this.socketRoom.delete(socketId);
    if (!room) return undefined;
    const seat = this.seatForSocket(room, socketId);
    if (seat) {
      seat.socketId = null;
      seat.connected = false;
    } else {
      room.spectators.delete(socketId);
    }
    room.lastActive = Date.now();
    return room;
  }

  status(room: Room): 'waiting' | 'playing' | 'finished' {
    if (room.state.matchWinner) return 'finished';
    return room.seats.length < 2 ? 'waiting' : 'playing';
  }

  newId(): string {
    return newToken();
  }

  /** Drop rooms that have had no connected sockets for `maxIdleMs`. */
  sweep(maxIdleMs: number): void {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      const anyConnected =
        room.seats.some((s) => s.connected) || room.spectators.size > 0;
      if (!anyConnected && now - room.lastActive > maxIdleMs) {
        this.rooms.delete(id);
      }
    }
  }
}
