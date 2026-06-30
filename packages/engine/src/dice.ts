// Dice rolling. The RNG is injectable so games are deterministic in tests and
// so the *server* (never the client) is the source of randomness in production.

export type Rng = () => number; // returns a float in [0, 1)

/** Default RNG. On the server this is replaced with a crypto-backed one. */
export const mathRng: Rng = () => Math.random();

export function rollDie(rng: Rng): number {
  return 1 + Math.floor(rng() * 6);
}

/** Roll two dice; doubles expand to four moves. */
export function rollDice(rng: Rng): number[] {
  const a = rollDie(rng);
  const b = rollDie(rng);
  return a === b ? [a, a, a, a] : [a, b];
}

/**
 * A crypto-backed RNG factory for the server. Falls back to Math.random if the
 * Web Crypto API is unavailable. Kept here (pure) so the engine has no Node deps;
 * the server passes `cryptoRng` in.
 */
export function makeCryptoRng(getRandomU32: () => number): Rng {
  return () => getRandomU32() / 0x100000000;
}
