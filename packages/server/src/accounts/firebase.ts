// Optional Firebase Admin wiring. If no credentials are configured the whole
// accounts feature stays disabled and every call below becomes a safe no-op —
// the game still works fully for anonymous players.

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let firestore: Firestore | null = null;
let enabled = false;
let initReason: string | null = null;

function init(): void {
  if (getApps().length > 0) {
    enabled = true;
    firestore = getFirestore();
    return;
  }
  // `initReason` is a coarse, safe-to-expose code; raw errors stay in the logs.
  try {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (json) {
      let cred: { private_key?: string };
      try {
        cred = JSON.parse(json);
      } catch (e) {
        initReason = 'invalid_service_account_json';
        console.warn('[accounts] FIREBASE_SERVICE_ACCOUNT is not valid JSON:', (e as Error).message);
        return;
      }
      // Some env stores double-escape the newlines in the PEM private key.
      if (typeof cred.private_key === 'string') cred.private_key = cred.private_key.replace(/\\n/g, '\n');
      try {
        initializeApp({ credential: cert(cred as Parameters<typeof cert>[0]) });
      } catch (e) {
        initReason = 'invalid_service_account';
        console.warn('[accounts] service account rejected:', (e as Error).message);
        return;
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({ credential: applicationDefault() });
    } else {
      initReason = 'not_configured';
      console.info('[accounts] Firebase not configured — accounts disabled (anonymous play still works).');
      return;
    }
    firestore = getFirestore();
    enabled = true;
    console.info('[accounts] Firebase Admin initialised — accounts enabled.');
  } catch (e) {
    initReason = 'init_failed';
    console.warn('[accounts] Firebase init failed — accounts disabled:', (e as Error).message);
    enabled = false;
    firestore = null;
  }
}

init();

export function accountsEnabled(): boolean {
  return enabled;
}

/** Why accounts are off (for diagnostics). Null when enabled. */
export function accountsReason(): string | null {
  return enabled ? null : initReason;
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
