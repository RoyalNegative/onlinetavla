// Chat + quick emoji bar.

import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessageDTO } from '../protocol';

const EMOJIS = ['👍', '😂', '🎲', '🔥', '😱', '🤝', '😎', '😭'];

export function Chat({
  messages,
  onSend,
}: {
  messages: ChatMessageDTO[];
  onSend: (text: string, kind?: 'chat' | 'emoji') => void;
}) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pin to the bottom whenever messages change (runs before paint, so the new
  // message's height is already laid out).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t, 'chat');
    setText('');
  }

  return (
    <div className="card flex min-h-0 flex-1 flex-col p-3">
      {/* Fixed height: new messages scroll inside instead of growing the card
          and pushing the emoji bar / input down. */}
      <div
        ref={scrollRef}
        className="scroll-thin mb-2 space-y-1.5 overflow-y-auto pr-1"
        style={{ height: 220 }}
      >
        {messages.length === 0 && <p className="px-1 text-xs text-white/30">Sohbet burada…</p>}
        {messages.map((m) =>
          m.kind === 'system' ? (
            <p key={m.id} className="text-center text-[11px] italic text-white/30">— {m.text} —</p>
          ) : (
            <div key={m.id} className="text-sm">
              <span className="font-semibold text-amber-glow/90">{m.from}: </span>
              <span className={m.kind === 'emoji' ? 'text-xl' : 'text-white/85'}>{m.text}</span>
            </div>
          ),
        )}
      </div>

      {/* Single row: buttons share the width equally so all emojis always fit. */}
      <div className="mb-2 flex gap-1">
        {EMOJIS.map((e) => (
          <button
            key={e}
            className="min-w-0 flex-1 rounded-lg bg-white/5 py-1 text-center text-lg transition hover:bg-white/10"
            onClick={() => onSend(e, 'emoji')}
          >
            {e}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
          placeholder="Mesaj yaz…"
          className="input py-2"
        />
        <button type="submit" className="btn-ghost px-3">
          Gönder
        </button>
      </form>
    </div>
  );
}
