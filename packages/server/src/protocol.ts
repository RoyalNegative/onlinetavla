// Socket.IO message contracts shared in spirit with the web client (the client
// keeps its own copy importing the same engine types).

import type { Action, GameMode, TavlaView } from '@tavla/engine';

export interface CreatePayload {
  name: string;
  gameId?: string; // 'tavla' (default) | 'dama' | 'amiral'
  mode?: GameMode; // tavla only
  targetPoints?: number; // tavla only
  idToken?: string | null;
}

export interface JoinPayload {
  roomId: string;
  name: string;
  token?: string;
  idToken?: string | null;
}

export interface ActionPayload {
  action: Action;
}

export interface ChatPayload {
  text: string;
  kind?: 'chat' | 'emoji';
}

export interface PlayerInfo {
  seat: number;
  color: 'white' | 'black';
  name: string;
  uid: string | null;
  avatar: string | null;
  connected: boolean;
}

export interface ChatMessageDTO {
  id: string;
  from: string;
  uid: string | null;
  text: string;
  ts: number;
  kind: 'chat' | 'emoji' | 'system';
}

export interface RoomSnapshot {
  roomId: string;
  gameId: string;
  status: 'waiting' | 'playing' | 'finished';
  players: PlayerInfo[];
  spectators: number;
  chat: ChatMessageDTO[];
  rematch: { votes: number; needed: number };
}

export interface RoomUpdate {
  you: { seat: number | null; name: string; uid: string | null };
  view: TavlaView;
  room: RoomSnapshot;
}

export interface Ack {
  ok: boolean;
  error?: string;
  roomId?: string;
  token?: string;
  seat?: number | null;
  spectator?: boolean;
}
