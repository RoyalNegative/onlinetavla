// Global client state: identity (nickname / optional account), the live socket
// connection, and the current room snapshot pushed by the server.

import { create } from 'zustand';
import type { GameId } from '@tavla/engine';
import { track } from './lib/analytics';
import { fetchAccountsEnabled, fetchFriendRequests } from './lib/api';
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
  reqCount: number; // pending friend requests — feeds the 🔔 badges
  friendsVersion: number; // bump to make friends lists refetch

  setNickname: (n: string) => void;
  refreshRequests: () => Promise<void>;
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

/** Dev-only escape hatch so browser tests can drive auth-gated UI states. */
declare global {
  interface Window {
    __store?: unknown;
  }
}

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
  reqCount: 0,
  friendsVersion: 0,

  async refreshRequests() {
    if (!get().authUser) return;
    const reqs = await fetchFriendRequests();
    set({ reqCount: reqs.length });
  },

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

    // Re-join on every (re)connect: socket.io can reconnect without the Room
    // effect's `connected` flag ever toggling (transport races), leaving the
    // seat bound to a dead socketId — room:update then emits into the void
    // until the next server push. room:join is idempotent server-side (token
    // rejoin + own-socket guard), so a double join here is harmless.
    socket.on('connect', () => {
      set({ connected: true });
      if (get().authUser) void announcePresence();
      const rid = roomIdFromPath(window.location.pathname);
      if (rid && (get().authUser || get().nickname.trim())) void get().joinRoom(rid);
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
    socket.on('friend:request', (p: { uid: string; handle: string; avatar: string | null }) => {
      sfx.turn();
      // Optimistic bump so the bell appears instantly; the fetch corrects it.
      set((s) => ({ reqCount: s.reqCount + 1, toast: `${p.handle} sana arkadaşlık isteği gönderdi 🔔` }));
      void get().refreshRequests();
    });
    socket.on('friend:accepted', (p: { uid: string; handle: string; avatar: string | null }) => {
      sfx.turn();
      set((s) => ({ friendsVersion: s.friendsVersion + 1, toast: `${p.handle} arkadaşlık isteğini kabul etti 🎉` }));
    });

    watchAuth((user) => {
      const authUser: AuthUser | null = user
        ? { uid: user.uid, name: user.displayName ?? 'Oyuncu', avatar: user.photoURL ?? null }
        : null;
      set({ authUser, ...(authUser ? {} : { reqCount: 0 }) });
      if (authUser && get().connected) void announcePresence();
      if (authUser) void get().refreshRequests();
      // Re-join with the resolved identity — but never join nameless (it would
      // grab a seat as "Oyuncu" before the name gate is answered).
      const rid = roomIdFromPath(window.location.pathname);
      if (rid && get().connected && (authUser || get().nickname.trim())) void get().joinRoom(rid);
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

if (import.meta.env.DEV) window.__store = useStore;
