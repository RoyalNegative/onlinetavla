import { clsx, type ClassValue } from 'clsx';

/**
 * Join conditional class lists.
 *
 * Deliberately clsx-only: `tailwind-merge` would also let a later class win
 * over an earlier one in the same group, but it costs ~8.6 kB gzip — more than
 * every icon in the app put together — and nothing here relies on that. The
 * tradeoff is that callers passing an override through `className` must not
 * repeat a utility the base already sets (e.g. don't pass `h-10` to something
 * whose base is `h-9`); change the base or add a variant instead.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
