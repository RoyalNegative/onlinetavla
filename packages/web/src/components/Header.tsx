import type { ReactNode } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Wordmark } from './GameGlyph';
import { cn } from '../lib/cn';
import { navigate } from '../router';
import { useStore } from '../store';
import { Auth } from './Auth';

export function Header({ right, title }: { right?: ReactNode; title?: string }) {
  const soundOn = useStore((s) => s.soundOn);
  const toggleSound = useStore((s) => s.toggleSound);
  return (
    // Sticky with a blurred, hairline-bottomed bar: the page scrolls under a
    // fixed piece of furniture instead of the header just floating away.
    <header className="sticky top-0 z-30 border-b border-cream/[0.07] bg-ink-900/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="group flex items-center gap-2.5 text-cream transition-opacity hover:opacity-80"
        >
          <Wordmark size={24} className="shrink-0" />
          <span className="font-display text-[19px] font-semibold tracking-[-0.02em] sm:text-[21px]">
            Tavla<span className="text-accent">.</span>
          </span>
          {title && title !== 'Tavla' && (
            <>
              <span aria-hidden className="hidden h-4 w-px bg-cream/15 sm:block" />
              <span className="hidden text-sm text-cream/45 sm:block">{title}</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {right}
          <IconButton
            onClick={toggleSound}
            label={soundOn ? 'Sesi kapat' : 'Sesi aç'}
            active={soundOn}
          >
            {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </IconButton>
          <Auth />
        </div>
      </div>
    </header>
  );
}

/** Square icon control — the header's only button shape, so the bar stays even. */
export function IconButton({
  children,
  onClick,
  label,
  active = true,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-[10px] border border-transparent transition-all duration-200 ease-out',
        'hover:border-cream/12 hover:bg-cream/[0.06]',
        active ? 'text-cream/70 hover:text-cream' : 'text-cream/35 hover:text-cream/70',
        className,
      )}
    >
      {children}
    </button>
  );
}
