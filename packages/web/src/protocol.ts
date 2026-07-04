// Client-side copy of the server's socket contracts (engine types are shared).

import type { Action, BattleshipView, DamaView, DortluView, MangalaView, SHView, TavlaView } from '@tavla/engine';

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
  view: TavlaView | DamaView | BattleshipView | MangalaView | DortluView | SHView;
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

export type { Action };
