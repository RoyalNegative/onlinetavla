// Secret Hitler table. Handles everything from the lobby (gather 5-10 friends
// via link, host starts) through nominations, JA!/NEIN! votes, policy cards,
// presidential powers, to the final role reveal. The side panel stays minimal —
// this component IS the game.

import { useEffect, useState } from 'react';
import type { SHAction, SHLogEntry, SHPolicy, SHView } from '@tavla/engine';
import type { PlayerInfo } from '../protocol';

interface Props {
  view: SHView;
  players: PlayerInfo[];
  youSeat: number | null;
  roomId: string;
  onAction: (a: SHAction) => void;
  onRematch: () => void;
  rematch: { votes: number; needed: number };
}

const LIB = '#60a5fa'; // liberal blue
const FAS = '#f87171'; // fascist red

const POWER_ICON: Record<string, string> = { peek: '🔮', investigate: '🔍', special: '🗳️', execute: '💀' };
const POWER_NAME: Record<string, string> = {
  peek: 'Kehanet: desteden 3 kart gör',
  investigate: 'Soruşturma: bir oyuncunun parti kartını gör',
  special: 'Özel seçim: sıradaki başkanı sen seç',
  execute: 'İnfaz: bir oyuncuyu öldür',
};

export function SecretHitlerBoard({ view, players, youSeat, roomId, onAction, onRematch, rematch }: Props) {
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Oyuncu ${seat + 1}`;

  if (view.phase === 'lobby') {
    return <Lobby players={players} youSeat={youSeat} roomId={roomId} onAction={onAction} />;
  }

  return (
    <div className="space-y-3">
      <Tracks view={view} />
      <Table view={view} youSeat={youSeat} nameOf={nameOf} onAction={onAction} players={players} />
      <ActionArea view={view} youSeat={youSeat} nameOf={nameOf} onAction={onAction} onRematch={onRematch} rematch={rematch} />
      {view.lastVote && view.phase !== 'over' && <VoteBanner view={view} nameOf={nameOf} />}
      <GameLog log={view.log} nameOf={nameOf} />
    </div>
  );
}

// ---- lobby ----

function Lobby({ players, youSeat, roomId, onAction }: { players: PlayerInfo[]; youSeat: number | null; roomId: string; onAction: (a: SHAction) => void }) {
  const url = `${window.location.origin}/r/${roomId}`;
  const [copied, setCopied] = useState(false);
  const isHost = youSeat === 0;
  const n = players.length;
  const ready = n >= 5;

  return (
    <div className="card space-y-4 p-5">
      <div className="text-center">
        <div className="text-4xl">🕵️</div>
        <h2 className="mt-1 font-display text-xl font-bold">Secret Hitler — Lobi</h2>
        <p className="mt-1 text-sm text-white/50">5-10 oyuncu gerekli. Linki ekibe gönder, herkes gelince başlat.</p>
      </div>

      <div className="flex gap-2">
        <input readOnly value={url} className="input py-2 text-sm" onFocus={(e) => e.target.select()} />
        <button
          className="btn-primary shrink-0 px-3"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? '✓' : 'Kopyala'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 10 }, (_, i) => {
          const p = players.find((x) => x.seat === i);
          return (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${p ? 'bg-white/10' : 'border border-dashed border-white/10 bg-transparent text-white/25'}`}
            >
              {p ? (
                <>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.connected ? '#34d399' : '#f87171' }} />
                  <span className="min-w-0 truncate font-semibold">{p.name}</span>
                  {i === 0 && <span className="ml-auto shrink-0 text-xs" title="Kurucu">👑</span>}
                  {p.seat === youSeat && <span className="shrink-0 rounded bg-white/10 px-1 text-[10px] font-bold text-white/60">SEN</span>}
                </>
              ) : (
                <span>{i + 1}. koltuk</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <p className="mb-2 text-sm text-white/60">
          <b className={ready ? 'text-emerald-400' : 'text-amber-glow'}>{n}/10</b> oyuncu {!ready && `— en az ${5 - n} kişi daha`}
        </p>
        {isHost ? (
          <button className="btn-primary w-full py-3 disabled:opacity-40" disabled={!ready} onClick={() => onAction({ type: 'start' })}>
            ▸ Oyunu başlat ({n} oyuncu)
          </button>
        ) : (
          <p className="text-xs text-white/40">Kurucunun başlatması bekleniyor…</p>
        )}
      </div>

      <div className="rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-white/50">
        <b className="text-white/70">Nasıl oynanır?</b> Liberaller çoğunlukta ama kimin kim olduğunu bilmiyor; faşistler birbirini tanıyor
        ve Hitler'i gizlice iktidara taşımaya çalışıyor. Her tur bir başkan şansölye aday gösterir, herkes oylar; seçilen hükûmet gizli
        politika kartlarından birini yürürlüğe koyar. <span style={{ color: LIB }}>5 liberal politika</span> ya da Hitler'in infazı
        liberalleri; <span style={{ color: FAS }}>6 faşist politika</span> ya da 3 faşist politikadan sonra Hitler'in şansölye seçilmesi
        faşistleri kazandırır.
      </div>
    </div>
  );
}

// ---- policy tracks ----

function Tracks({ view }: { view: SHView }) {
  return (
    <div className="card space-y-3 p-4">
      <TrackRow
        label="Liberal"
        color={LIB}
        total={5}
        filled={view.liberalEnacted}
        slots={Array.from({ length: 5 }, () => null)}
      />
      <TrackRow label="Faşist" color={FAS} total={6} filled={view.fascistEnacted} slots={view.powers} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
        <div className="flex items-center gap-2">
          <span>Seçim sayacı:</span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-full"
              style={{ background: i < view.electionTracker ? '#f5b14c' : 'rgba(255,255,255,0.12)' }}
            />
          ))}
          <span className="text-white/30">3 başarısız seçim → üstteki kart kendiliğinden yürürlüğe girer</span>
        </div>
        <span>
          🂠 Deste {view.deckCount} · Iskarta {view.discardCount}
        </span>
      </div>
    </div>
  );
}

function TrackRow({ label, color, total, filled, slots }: { label: string; color: string; total: number; filled: number; slots: (string | null)[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-bold" style={{ color }}>
        {label}
      </span>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className="grid h-11 flex-1 place-items-center rounded-md text-lg font-black"
            style={{
              background: i < filled ? color : 'rgba(255,255,255,0.05)',
              color: i < filled ? '#101418' : 'rgba(255,255,255,0.25)',
              boxShadow: i < filled ? `0 0 12px ${color}55` : undefined,
            }}
            title={slots[i] ? POWER_NAME[slots[i]!] : undefined}
          >
            {i < filled ? (label === 'Liberal' ? '🕊️' : '☠️') : slots[i] ? POWER_ICON[slots[i]!] : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- player table ----

function Table({
  view,
  youSeat,
  nameOf,
  onAction,
  players,
}: {
  view: SHView;
  youSeat: number | null;
  nameOf: (s: number) => string;
  onAction: (a: SHAction) => void;
  players: PlayerInfo[];
}) {
  const iAmPresident = youSeat !== null && youSeat === view.presidentSeat;
  const picking =
    iAmPresident &&
    (view.phase === 'nominate' || ((view.phase === 'power-investigate' || view.phase === 'power-special' || view.phase === 'power-execute') && !view.powerPicked));
  const targets = view.phase === 'nominate' ? view.eligibleChancellors : view.eligibleTargets;

  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: view.seats }, (_, seat) => {
          const dead = !view.alive[seat];
          const clickable = picking && targets.includes(seat);
          const role = view.roles[seat];
          const connected = players.find((p) => p.seat === seat)?.connected ?? false;
          return (
            <button
              key={seat}
              disabled={!clickable}
              onClick={() => onAction(view.phase === 'nominate' ? { type: 'nominate', target: seat } : { type: 'power', target: seat })}
              className={`relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                dead
                  ? 'bg-white/[0.03] opacity-45'
                  : clickable
                    ? 'cursor-pointer bg-amber-glow/15 ring-2 ring-amber-glow/60 hover:bg-amber-glow/25'
                    : 'bg-white/5'
              } ${seat === youSeat ? 'ring-1 ring-white/20' : ''}`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dead ? '#6b7280' : connected ? '#34d399' : '#f87171' }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm font-semibold">
                  <span className="min-w-0 truncate">{nameOf(seat)}</span>
                  {seat === view.presidentSeat && !dead && <span title="Başkan">👑</span>}
                  {seat === view.chancellorSeat && <span title="Şansölye">🎩</span>}
                  {seat === view.nomineeSeat && <span title="Şansölye adayı">🤝</span>}
                  {dead && <span title="İnfaz edildi">💀</span>}
                </div>
                <div className="text-[10px] text-white/40">
                  {role ? (
                    <span style={{ color: role === 'liberal' ? LIB : FAS }} className="font-bold">
                      {role === 'liberal' ? 'LİBERAL' : role === 'fascist' ? 'FAŞİST' : 'HİTLER'}
                    </span>
                  ) : view.phase === 'vote' ? (
                    view.votedSeats[seat] ? '✓ oy verdi' : dead ? '' : 'oy bekleniyor…'
                  ) : (
                    seat === youSeat ? 'sen' : ' '
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- phase actions ----

function ActionArea({
  view,
  youSeat,
  nameOf,
  onAction,
  onRematch,
  rematch,
}: {
  view: SHView;
  youSeat: number | null;
  nameOf: (s: number) => string;
  onAction: (a: SHAction) => void;
  onRematch: () => void;
  rematch: { votes: number; needed: number };
}) {
  const [sel, setSel] = useState<number | null>(null);
  const me = youSeat;
  const iAmPresident = me !== null && me === view.presidentSeat;
  const iAmChancellor = me !== null && me === view.chancellorSeat;
  const amAlive = me !== null && view.alive[me];

  // Reset the card selection whenever the decision changes.
  useEffect(() => setSel(null), [view.phase, view.moveSeq]);

  if (view.phase === 'over') {
    const libWin = view.winner === 'liberal';
    const reason =
      view.winReason === 'liberal-policies'
        ? '5 liberal politika yürürlüğe girdi'
        : view.winReason === 'hitler-killed'
          ? 'Hitler infaz edildi'
          : view.winReason === 'fascist-policies'
            ? '6 faşist politika yürürlüğe girdi'
            : 'Hitler şansölye seçildi';
    return (
      <div className="card p-5 text-center" style={{ boxShadow: `0 0 40px ${libWin ? LIB : FAS}33` }}>
        <div className="text-4xl">{libWin ? '🕊️' : '☠️'}</div>
        <p className="mt-1 text-xl font-black" style={{ color: libWin ? LIB : FAS }}>
          {libWin ? 'LİBERALLER KAZANDI' : 'FAŞİSTLER KAZANDI'}
        </p>
        <p className="mt-1 text-sm text-white/50">{reason}</p>
        <button className="btn-primary mt-4 w-full" onClick={onRematch}>
          🔁 Tekrar oyna {rematch.votes > 0 && `(${rematch.votes}/${rematch.needed})`}
        </button>
      </div>
    );
  }

  const banner = (text: string, sub?: string) => (
    <div className="card p-4 text-center">
      <p className="font-semibold">{text}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
    </div>
  );

  switch (view.phase) {
    case 'nominate':
      return iAmPresident
        ? banner('👑 Başkansın — yukarıdan bir şansölye adayı seç', 'Vurgulu oyuncular aday gösterilebilir')
        : banner(`👑 ${nameOf(view.presidentSeat)} şansölye adayını seçiyor…`);

    case 'vote': {
      if (!amAlive) return banner('Ölüler oy kullanamaz 💀');
      const voted = me !== null && view.votedSeats[me];
      const waiting = view.votedSeats.filter((v, i) => view.alive[i] && !v).length;
      if (voted) return banner(`Oyun alındı ✓ — ${waiting} oyuncu bekleniyor`, `Hükûmet: 👑 ${nameOf(view.presidentSeat)} + 🎩 ${nameOf(view.nomineeSeat!)}`);
      return (
        <div className="card p-4 text-center">
          <p className="mb-3 text-sm">
            Hükûmet oylaması: <b>👑 {nameOf(view.presidentSeat)}</b> + <b>🎩 {nameOf(view.nomineeSeat!)}</b>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              className="rounded-xl py-4 text-xl font-black text-ink-900 transition hover:brightness-110"
              style={{ background: '#34d399' }}
              onClick={() => onAction({ type: 'vote', ja: true })}
            >
              JA! <span className="text-sm font-semibold">(evet)</span>
            </button>
            <button
              className="rounded-xl py-4 text-xl font-black text-ink-900 transition hover:brightness-110"
              style={{ background: FAS }}
              onClick={() => onAction({ type: 'vote', ja: false })}
            >
              NEIN! <span className="text-sm font-semibold">(hayır)</span>
            </button>
          </div>
        </div>
      );
    }

    case 'president-discard':
    case 'chancellor-enact': {
      const mine = view.phase === 'president-discard' ? iAmPresident : iAmChancellor;
      if (!mine || !view.hand) {
        return view.phase === 'president-discard'
          ? banner(`👑 ${nameOf(view.presidentSeat)} bir kartı eliyor…`, '3 karttan 1 tanesini atacak')
          : banner(`🎩 ${nameOf(view.chancellorSeat!)} politikayı seçiyor…`, '2 karttan 1 tanesini yürürlüğe koyacak');
      }
      const discarding = view.phase === 'president-discard';
      return (
        <div className="card p-4 text-center">
          <p className="mb-3 text-sm font-semibold">
            {discarding ? '👑 Bir kartı seç ve AT — kalan ikisi şansölyeye gider' : '🎩 Bir kartı seç ve YÜRÜRLÜĞE KOY'}
          </p>
          <div className="flex justify-center gap-3">
            {view.hand.map((p, i) => (
              <PolicyCard key={i} policy={p} selected={sel === i} onClick={() => setSel(sel === i ? null : i)} />
            ))}
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <button
              className="btn-primary px-6 disabled:opacity-40"
              disabled={sel === null}
              onClick={() => sel !== null && onAction(discarding ? { type: 'discard', index: sel } : { type: 'enact', index: sel })}
            >
              {discarding ? '🗑️ Bu kartı at' : '✔️ Yürürlüğe koy'}
            </button>
            {!discarding && view.vetoUnlocked && !view.vetoRequested && (
              <button className="btn-ghost px-4" onClick={() => onAction({ type: 'veto' })} title="İkiniz de kabul ederse iki kart da çöpe gider">
                ✋ Veto öner
              </button>
            )}
          </div>
          {!discarding && view.vetoRequested && <p className="mt-2 text-xs text-rose-300">Veto reddedildi — bir kart yürürlüğe koymak zorundasın.</p>}
        </div>
      );
    }

    case 'veto-decision':
      return iAmPresident ? (
        <div className="card p-4 text-center">
          <p className="mb-3 text-sm font-semibold">🎩 Şansölye veto istiyor — iki kartı da çöpe atmayı kabul ediyor musun?</p>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-primary py-3" onClick={() => onAction({ type: 'veto-decision', accept: true })}>
              Kabul — kartları at
            </button>
            <button className="btn-ghost py-3" onClick={() => onAction({ type: 'veto-decision', accept: false })}>
              Reddet — mecbur koysun
            </button>
          </div>
          <p className="mt-2 text-xs text-white/40">Kabul edersen seçim sayacı 1 artar.</p>
        </div>
      ) : (
        banner(`✋ ${nameOf(view.chancellorSeat!)} veto önerdi — başkan karar veriyor…`)
      );

    case 'power-peek':
      return iAmPresident && view.peek ? (
        <div className="card p-4 text-center">
          <p className="mb-3 text-sm font-semibold">🔮 Destenin en üstündeki 3 kart (üstteki solda) — sadece sen görüyorsun</p>
          <div className="flex justify-center gap-3">
            {view.peek.map((p, i) => (
              <PolicyCard key={i} policy={p} />
            ))}
          </div>
          <button className="btn-primary mt-3 px-6" onClick={() => onAction({ type: 'continue' })}>
            Gördüm, devam
          </button>
        </div>
      ) : (
        banner(`🔮 ${nameOf(view.presidentSeat)} destenin üstüne bakıyor…`)
      );

    case 'power-investigate': {
      if (!iAmPresident) return banner(`🔍 ${nameOf(view.presidentSeat)} birini soruşturuyor…`);
      if (!view.powerPicked) return banner('🔍 Soruşturma yetkin var — yukarıdan bir oyuncu seç', 'Parti üyelik kartını sadece sen göreceksin');
      const last = view.investigations[view.investigations.length - 1];
      return (
        <div className="card p-4 text-center">
          <p className="text-sm font-semibold">
            🔍 <b>{nameOf(last.target)}</b> parti kartı:{' '}
            <span className="text-lg font-black" style={{ color: last.party === 'liberal' ? LIB : FAS }}>
              {last.party === 'liberal' ? 'LİBERAL' : 'FAŞİST'}
            </span>
          </p>
          <p className="mt-1 text-xs text-white/40">Bu bilgi sadece sende — paylaşıp paylaşmamak (ya da yalan söylemek) sana kalmış 😏</p>
          <button className="btn-primary mt-3 px-6" onClick={() => onAction({ type: 'continue' })}>
            Devam
          </button>
        </div>
      );
    }

    case 'power-special':
      return iAmPresident
        ? banner('🗳️ Özel seçim — yukarıdan sıradaki başkanı seç', 'Sonraki turda sıra normal düzenine döner')
        : banner(`🗳️ ${nameOf(view.presidentSeat)} sıradaki başkanı seçiyor…`);

    case 'power-execute':
      return iAmPresident
        ? banner('💀 İnfaz yetkin var — yukarıdan bir oyuncu seç', 'Dikkat: Hitler’i vurursan liberaller anında kazanır')
        : banner(`💀 ${nameOf(view.presidentSeat)} birini infaz edecek…`);

    default:
      return null;
  }
}

function PolicyCard({ policy, selected, onClick }: { policy: SHPolicy; selected?: boolean; onClick?: () => void }) {
  const lib = policy === 'liberal';
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`h-28 w-20 rounded-xl border-2 text-center transition ${onClick ? 'cursor-pointer hover:scale-105' : ''} ${
        selected ? 'scale-105 ring-4 ring-amber-glow' : ''
      }`}
      style={{ background: lib ? '#12324f' : '#4f1a12', borderColor: lib ? LIB : FAS }}
    >
      <div className="mt-3 text-2xl">{lib ? '🕊️' : '☠️'}</div>
      <div className="mt-1 text-[11px] font-black" style={{ color: lib ? LIB : FAS }}>
        {lib ? 'LİBERAL' : 'FAŞİST'}
      </div>
    </button>
  );
}

// ---- vote reveal ----

function VoteBanner({ view, nameOf }: { view: SHView; nameOf: (s: number) => string }) {
  const lv = view.lastVote!;
  return (
    <div className="card p-3">
      <p className="mb-2 text-xs text-white/50">
        Son oylama — 👑 {nameOf(lv.president)} + 🎩 {nameOf(lv.chancellor)}:{' '}
        <b className={lv.passed ? 'text-emerald-400' : 'text-rose-400'}>{lv.passed ? 'SEÇİLDİ' : 'REDDEDİLDİ'}</b>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {lv.votes.map((v, seat) =>
          v === null ? null : (
            <span
              key={seat}
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: v ? '#34d39922' : '#f8717122', color: v ? '#34d399' : '#f87171' }}
            >
              {nameOf(seat)}: {v ? 'JA' : 'NEIN'}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

// ---- public log ----

function GameLog({ log, nameOf }: { log: SHLogEntry[]; nameOf: (s: number) => string }) {
  const [open, setOpen] = useState(false);
  if (log.length === 0) return null;
  const line = (e: SHLogEntry): string => {
    switch (e.t) {
      case 'start':
        return `Oyun ${e.n} oyuncuyla başladı`;
      case 'nominate':
        return `👑 ${nameOf(e.p)}, 🎩 ${nameOf(e.c)}'i aday gösterdi`;
      case 'election':
        return `Oylama ${e.ja}-${e.nein}: ${nameOf(e.p)} + ${nameOf(e.c)} ${e.passed ? 'seçildi ✓' : 'reddedildi ✗'}`;
      case 'policy':
        return `${e.policy === 'liberal' ? '🕊️ Liberal' : '☠️ Faşist'} politika yürürlüğe girdi${e.chaos ? ' (kaos!)' : ''}`;
      case 'peek':
        return `🔮 ${nameOf(e.p)} destenin üstündeki 3 karta baktı`;
      case 'investigate':
        return `🔍 ${nameOf(e.p)}, ${nameOf(e.target)}'i soruşturdu`;
      case 'special':
        return `🗳️ ${nameOf(e.p)} özel seçimle ${nameOf(e.target)}'i başkan yaptı`;
      case 'execute':
        return `💀 ${nameOf(e.p)}, ${nameOf(e.target)}'i infaz etti`;
      case 'veto-request':
        return `✋ ${nameOf(e.c)} veto önerdi`;
      case 'veto':
        return `Veto ${e.accepted ? 'kabul edildi' : 'reddedildi'}`;
      case 'win':
        return e.team === 'liberal' ? '🕊️ Liberaller kazandı!' : '☠️ Faşistler kazandı!';
    }
  };
  const shown = open ? [...log].reverse() : [...log].slice(-3).reverse();
  return (
    <div className="card p-3">
      <button className="flex w-full items-center justify-between text-xs font-semibold text-white/50" onClick={() => setOpen(!open)}>
        <span>📜 Olay akışı</span>
        <span>{open ? '▲' : `▼ (${log.length})`}</span>
      </button>
      <ul className="mt-2 space-y-1 text-xs text-white/60">
        {shown.map((e, i) => (
          <li key={log.length - i}>{line(e)}</li>
        ))}
      </ul>
    </div>
  );
}

// ---- secret role card (rendered in the side panel) ----

export function SecretRolePanel({ view, nameOf }: { view: SHView; nameOf: (s: number) => string }) {
  const [show, setShow] = useState(false);
  if (!view.yourRole || view.phase === 'lobby') return null;
  const role = view.yourRole;
  const lib = role === 'liberal';
  const teammates =
    view.phase === 'over'
      ? []
      : view.roles.map((r, seat) => ({ r, seat })).filter(({ r, seat }) => r !== null && seat !== view.youSeat);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">🎭 Gizli rolün</p>
        <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setShow(!show)}>
          {show ? 'Gizle' : 'Göster'}
        </button>
      </div>
      {show && (
        <div className="mt-3 rounded-xl p-3 text-center" style={{ background: lib ? '#12324f' : '#4f1a12' }}>
          <div className="text-3xl">{role === 'liberal' ? '🕊️' : role === 'fascist' ? '🐍' : '💀'}</div>
          <p className="text-lg font-black" style={{ color: lib ? LIB : FAS }}>
            {role === 'liberal' ? 'LİBERAL' : role === 'fascist' ? 'FAŞİST' : 'HİTLER'}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-white/50">
            {role === 'liberal'
              ? '5 liberal politika geçir ya da Hitler’i buldurt. Kimseye güvenme.'
              : role === 'fascist'
                ? 'Hitler’i koru, kaosu büyüt. Ekibin aşağıda.'
                : 'Kimliğini gizle. 3 faşist politikadan sonra şansölye seçilirsen kazanırsın.'}
          </p>
          {teammates.length > 0 && (
            <div className="mt-2 border-t border-white/10 pt-2 text-left text-[11px]">
              {teammates.map(({ r, seat }) => (
                <p key={seat} className="text-white/70">
                  {r === 'hitler' ? '💀' : '🐍'} {nameOf(seat)} — {r === 'hitler' ? 'HİTLER' : 'faşist'}
                </p>
              ))}
            </div>
          )}
          {view.investigations.length > 0 && (
            <div className="mt-2 border-t border-white/10 pt-2 text-left text-[11px]">
              {view.investigations.map((inv, i) => (
                <p key={i} className="text-white/70">
                  🔍 {nameOf(inv.target)} — <span style={{ color: inv.party === 'liberal' ? LIB : FAS }}>{inv.party === 'liberal' ? 'liberal' : 'faşist'}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
