// Global client state: identity (nickname / optional account), the live socket
// connection, and the current room snapshot pushed by the server.

import { create } from 'zustand';
import type { GameId } from '@tavla/engine';
import { track } from './lib/analytics';
import { fetchAccountsEnabled } from './lib/api';
import { currentIdToken, watchAuth } from './lib/firebase';
import { emit, socket } from './lib/socket';
import { setSoundEnabled, sfx, soundEnabled } from './lib/sound';
import type { RoomUpdate } from './protocol';
import { navigate, roomIdFromPath } from './router';

interface AuthUser {
  uid: string;
  name: string;
  avatar: string | null;
}

interface Store {
  nickname: string;
  authUser: AuthUser | null;
  accountsEnabled: boolean;
  connected: boolean;
  update: RoomUpdate | null;
  toast: string | null;
  initialized: boolean;
  soundOn: boolean;
  matchmaking: boolean;
  invite: { fromName: string; roomId: string; gameId: string } | null;

  setNickname: (n: string) => void;
  toggleSound: () => void;
  displayName: () => string;
  init: () => void;
  findMatch: (gameId: GameId) => Promise<void>;
  cancelMatch: () => void;
  inviteFriend: (toUid: string, gameId: GameId) => Promise<void>;
  acceptInvite: () => void;
  dismissInvite: () => void;
  createRoom: (opts: { gameId: GameId; mode?: 'classic' | 'backgammon'; targetPoints?: number; noTouch?: boolean }) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  sendAction: (action: unknown) => Promise<void>;
  sendChat: (text: string, kind?: 'chat' | 'emoji') => void;
  voteRematch: () => void;
  setToast: (t: string | null) => void;
}

const tokenKey = (roomId: string) => `tavla.token.${roomId}`;

export const useStore = create<Store>((set, get) => ({
  nickname: localStorage.getItem('tavla.nickname') ?? '',
  authUser: null,
  accountsEnabled: false,
  connected: socket.connected,
  update: null,
  toast: null,
  initialized: false,
  soundOn: soundEnabled(),
  matchmaking: false,
  invite: null,

  setNickname(n) {
    const clean = n.slice(0, 20);
    localStorage.setItem('tavla.nickname', clean);
    set({ nickname: clean });
  },

  toggleSound() {
    const next = !get().soundOn;
    setSoundEnabled(next);
    set({ soundOn: next });
  },

  displayName() {
    const { authUser, nickname } = get();
    return authUser?.name || nickname || 'Oyuncu';
  },

  init() {
    if (get().initialized) return;
    set({ initialized: true });

    const announcePresence = async () => {
      const idToken = await currentIdToken();
      if (idToken) socket.emit('presence:online', { idToken });
    };

    // Note: re-joining on (re)connect is driven by the Room component's effect,
    // which depends on `connected`. Doing it here too caused double-join races.
    socket.on('connect', () => {
      set({ connected: true });
      if (get().authUser) void announcePresence();
    });
    socket.on('disconnect', () => set({ connected: false, matchmaking: false }));
    // The socket starts connecting at module load; on a fast handshake its
    // 'connect' can fire before this subscription exists. Without this sync
    // `connected` stays false forever and the room join never happens.
    if (socket.connected) set({ connected: true });
    socket.on('room:update', (u: RoomUpdate) => set({ update: u }));
    socket.on('matchmake:found', (p: { roomId: string; token?: string }) => {
      if (p.token) localStorage.setItem(tokenKey(p.roomId), p.token);
      set({ matchmaking: false });
      navigate(`/r/${p.roomId}`);
    });
    socket.on('friend:invited', (p: { fromName: string; roomId: string; gameId: string }) => {
      sfx.turn();
      navigator.vibrate?.([80, 60, 80]);
      set({ invite: p });
    });

    watchAuth((user) => {
      const authUser: AuthUser | null = user
        ? { uid: user.uid, name: user.displayName ?? 'Oyuncu', avatar: user.photoURL ?? null }
        : null;
      set({ authUser });
      if (authUser && get().connected) void announcePresence();
      const rid = roomIdFromPath(window.location.pathname);
      if (rid && get().connected) void get().joinRoom(rid);
    });

    void fetchAccountsEnabled().then((accountsEnabled) => set({ accountsEnabled }));
  },

  async findMatch(gameId) {
    set({ matchmaking: true });
    track('match_search', { game: gameId });
    const idToken = await currentIdToken();
    const ack = await emit('matchmake', { gameId, name: get().displayName(), idToken });
    if (!ack.ok) set({ matchmaking: false, toast: 'Eşleşme başlatılamadı.' });
  },

  cancelMatch() {
    void emit('matchmake:cancel');
    set({ matchmaking: false });
  },

  async inviteFriend(toUid, gameId) {
    const idToken = await currentIdToken();
    const ack = await emit('friend:invite', { toUid, gameId, name: get().displayName(), idToken });
    if (ack.ok && ack.roomId) {
      if (ack.token) localStorage.setItem(tokenKey(ack.roomId), ack.token);
      navigate(`/r/${ack.roomId}`);
    } else {
      set({ toast: ack.error === 'offline' ? 'Arkadaşın çevrimdışı.' : 'Davet gönderilemedi.' });
    }
  },

  acceptInvite() {
    const inv = get().invite;
    if (!inv) return;
    set({ invite: null });
    navigate(`/r/${inv.roomId}`);
  },

  dismissInvite() {
    set({ invite: null });
  },

  async createRoom(opts) {
    const idToken = await currentIdToken();
    const ack = await emit('room:create', {
      name: get().displayName(),
      gameId: opts.gameId,
      mode: opts.mode,
      targetPoints: opts.targetPoints,
      noTouch: opts.noTouch,
      idToken,
    });
    if (!ack.ok || !ack.roomId) {
      set({ toast: 'Oda oluşturulamadı, tekrar dene.' });
      return;
    }
    if (ack.token) localStorage.setItem(tokenKey(ack.roomId), ack.token);
    track('room_created', { game: opts.gameId, mode: opts.mode, target: opts.targetPoints });
    navigate(`/r/${ack.roomId}`);
  },

  async joinRoom(roomId) {
    const idToken = await currentIdToken();
    const ack = await emit('room:join', {
      roomId,
      name: get().displayName(),
      token: localStorage.getItem(tokenKey(roomId)) ?? undefined,
      idToken,
    });
    if (!ack.ok) {
      set({ toast: ack.error === 'room_not_found' ? 'Oda bulunamadı.' : 'Odaya girilemedi.' });
      return;
    }
    if (ack.token) localStorage.setItem(tokenKey(roomId), ack.token);
  },

  async sendAction(action) {
    const ack = await emit('game:action', { action });
    if (!ack.ok && ack.error === 'illegal_move') set({ toast: 'Geçersiz hamle.' });
  },

  sendChat(text, kind = 'chat') {
    void emit('chat:send', { text, kind }).then((ack) => {
      if (!ack.ok && ack.error === 'rate_limited') set({ toast: 'Biraz yavaş ol 🙂' });
    });
  },

  voteRematch() {
    void emit('rematch:vote');
  },

  setToast(t) {
    set({ toast: t });
  },
}));
