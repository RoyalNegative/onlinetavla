// Crypto-backed RNG for the engine. Dice are rolled on the server only.

import { webcrypto } from 'node:crypto';
import { makeCryptoRng, type Rng } from '@tavla/engine';

export const cryptoRng: Rng = makeCryptoRng(() => {
  const buf = new Uint32Array(1);
  webcrypto.getRandomValues(buf);
  return buf[0];
});
