// Transient chat bubbles: the opponent's messages pop up along the right edge
// of the board for a few seconds, so you catch them without looking away
// from it (on phones the chat panel is below the fold entirely). Renders
// inside the board column, which is position:relative.

import { useEffect, useRef, useState } from 'react';
import type { ChatMessageDTO } from '../protocol';

const SHOW_MS = 4600; // bubble lifetime
const LEAVE_MS = 350; // fade-out duration before removal
const MAX_BUBBLES = 4;

interface Bubble {
  msg: ChatMessageDTO;
  leaving: boolean;
}

export function ChatBubbles({ messages, selfName }: { messages: ChatMessageDTO[]; selfName: string }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    // First snapshot is room history (rejoin, refresh) — mark it seen silently.
    if (!seen.current) {
      seen.current = new Set(messages.map((m) => m.id));
      return;
    }
    const fresh = messages.filter(
      (m) => !seen.current!.has(m.id) && m.kind !== 'system' && m.from !== selfName,
    );
    for (const m of messages) seen.current.add(m.id);
    if (fresh.length === 0) return;

    setBubbles((b) => [...b, ...fresh.map((msg) => ({ msg, leaving: false }))].slice(-MAX_BUBBLES));
    for (const msg of fresh) {
      timers.current.push(
        window.setTimeout(() => {
          setBubbles((b) => b.map((x) => (x.msg.id === msg.id ? { ...x, leaving: true } : x)));
        }, SHOW_MS),
        window.setTimeout(() => {
          setBubbles((b) => b.filter((x) => x.msg.id !== msg.id));
        }, SHOW_MS + LEAVE_MS),
      );
    }
  }, [messages, selfName]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (bubbles.length === 0) return null;

  return (
    <div
      data-bubbles
      className="pointer-events-none absolute right-1 top-1/2 z-40 flex w-[min(64vw,240px)] -translate-y-1/2 flex-col items-end gap-2"
    >
      {bubbles.map(({ msg, leaving }) => (
        <div
          key={msg.id}
          className={`max-w-full animate-fade-up rounded-2xl rounded-br-sm border border-white/10 bg-ink-700/95 px-3.5 py-2.5 shadow-xl backdrop-blur transition-all duration-300 ${
            leaving ? 'translate-x-3 opacity-0' : 'opacity-100'
          }`}
        >
          <p className="text-[11px] font-semibold text-amber-glow/90">{msg.from}</p>
          <p className={`break-words ${msg.kind === 'emoji' ? 'text-3xl leading-tight' : 'text-sm text-white/90'}`}>{msg.text}</p>
        </div>
      ))}
    </div>
  );
}
