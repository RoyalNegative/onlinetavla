// Live opponent cursor: broadcast your pointer position over the board (as a
// fraction of the board container) and draw everyone else's back. It's pure
// flourish — the overlay is click-through — but seeing the rival's pointer hover
// over a piece or a column makes a move feel like it's happening across the table.
//
// The two seats of a duel look at the same board from opposite sides, so a peer
// in a "flipped" game (tavla/dama/mangala) is mirrored 180° into our view;
// 4'ü bağla isn't flipped, so it maps straight through. Amiral (two separate
// grids) and Secret Hitler (no shared board) opt out.

import { useEffect, useState, type RefObject } from 'react';
import { socket } from '../lib/socket';

const CURSOR_GAMES = new Set(['tavla', 'dama', 'mangala', 'dortlu']);
const MIRROR_180 = new Set(['tavla', 'dama', 'mangala']);
const SEND_EVERY_MS = 45;
const STALE_MS = 4000;

interface Peer {
  x: number;
  y: number;
  seat: number | null;
  name: string;
  t: number;
}

interface PeerMsg {
  id: string;
  x: number;
  y: number;
  seat: number | null;
  name: string;
}

// Which of the two board orientations a seat looks at (0 = white's view).
function orientation(gameId: string, seat: number | null): 0 | 1 {
  return MIRROR_180.has(gameId) && seat === 1 ? 1 : 0;
}

export function PeerCursors({
  containerRef,
  gameId,
  youSeat,
  roomId,
}: {
  containerRef: RefObject<HTMLElement | null>;
  gameId: string;
  youSeat: number | null;
  roomId: string;
}) {
  const enabled = CURSOR_GAMES.has(gameId);
  const [peers, setPeers] = useState<Record<string, Peer>>({});

  // Broadcast our own pointer, throttled, in board-container fractions.
  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    let lastSent = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;
    let pending: { x: number; y: number } | null = null;

    const flush = () => {
      if (!pending) return;
      lastSent = Date.now();
      socket.emit('cursor:move', pending);
      pending = null;
    };
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pending = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
      const wait = SEND_EVERY_MS - (Date.now() - lastSent);
      if (wait <= 0) flush();
      else if (!trailing) trailing = setTimeout(() => { trailing = null; flush(); }, wait);
    };
    const onLeave = () => {
      pending = null;
      socket.emit('cursor:leave');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (trailing) clearTimeout(trailing);
      socket.emit('cursor:leave');
    };
  }, [enabled, containerRef, roomId, gameId]);

  // Receive peers.
  useEffect(() => {
    if (!enabled) return;
    const onPeer = (p: PeerMsg) => setPeers((prev) => ({ ...prev, [p.id]: { x: p.x, y: p.y, seat: p.seat, name: p.name, t: Date.now() } }));
    const onGone = (p: { id: string }) =>
      setPeers((prev) => {
        if (!(p.id in prev)) return prev;
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
    socket.on('cursor:peer', onPeer);
    socket.on('cursor:gone', onGone);
    return () => {
      socket.off('cursor:peer', onPeer);
      socket.off('cursor:gone', onGone);
    };
  }, [enabled]);

  // Drop cursors that stopped moving (covers missed leave/disconnect events).
  useEffect(() => {
    const t = setInterval(
      () =>
        setPeers((prev) => {
          const now = Date.now();
          let changed = false;
          const next: Record<string, Peer> = {};
          for (const [k, v] of Object.entries(prev)) {
            if (now - v.t < STALE_MS) next[k] = v;
            else changed = true;
          }
          return changed ? next : prev;
        }),
      1500,
    );
    return () => clearInterval(t);
  }, []);

  // A room switch should not carry old cursors over.
  useEffect(() => setPeers({}), [roomId]);

  if (!enabled) return null;
  const myOri = orientation(gameId, youSeat);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {Object.entries(peers).map(([id, p]) => {
        let { x, y } = p;
        if (orientation(gameId, p.seat) !== myOri) {
          x = 1 - x;
          y = 1 - y;
        }
        if (x < 0 || x > 1 || y < 0 || y > 1) return null;
        return <Cursor key={id} x={x} y={y} name={p.name} seat={p.seat} />;
      })}
    </div>
  );
}

function Cursor({ x, y, name, seat }: { x: number; y: number; name: string; seat: number | null }) {
  const color = seat === 1 ? '#f5b14c' : '#38bdf8';
  return (
    <div
      className="absolute will-change-transform"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, transition: 'left 90ms linear, top 90ms linear' }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow" style={{ transform: 'translate(-2px,-1px)' }}>
        <path d="M5 3 L5 20 L9.5 15.5 L12.5 21.5 L15 20.3 L12 14.5 L18 14.5 Z" fill={color} stroke="#0c1118" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span
        className="absolute left-4 top-4 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold text-ink-900 shadow"
        style={{ background: color }}
      >
        {name}
      </span>
    </div>
  );
}
