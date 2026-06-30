// Optional Firebase Admin wiring. If no credentials are configured the whole
// accounts feature stays disabled and every call below becomes a safe no-op —
// the game still works fully for anonymous players.

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let firestore: Firestore | null = null;
let enabled = false;

function init(): void {
  if (getApps().length > 0) {
    enabled = true;
    firestore = getFirestore();
    return;
  }
  try {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (json) {
      initializeApp({ credential: cert(JSON.parse(json)) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({ credential: applicationDefault() });
    } else {
      console.info('[accounts] Firebase not configured — accounts disabled (anonymous play still works).');
      return;
    }
    firestore = getFirestore();
    enabled = true;
    console.info('[accounts] Firebase Admin initialised — accounts enabled.');
  } catch (e) {
    console.warn('[accounts] Firebase init failed — accounts disabled:', (e as Error).message);
    enabled = false;
    firestore = null;
  }
}

init();

export function accountsEnabled(): boolean {
  return enabled;
}

export function db(): Firestore {
  if (!firestore) throw new Error('accounts_disabled');
  return firestore;
}

export interface AuthedUser {
  uid: string;
  name: string | null;
  picture: string | null;
}

export async function verifyIdToken(idToken?: string | null): Promise<AuthedUser | null> {
  if (!enabled || !idToken) return null;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, name: decoded.name ?? null, picture: decoded.picture ?? null };
  } catch {
    return null;
  }
}
