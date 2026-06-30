// REST API for account perks. All endpoints degrade gracefully when accounts
// are disabled (empty leaderboard, 401 on authed routes).

import { Router, type Request, type Response } from 'express';
import { accountsEnabled, verifyIdToken } from './firebase';
import {
  ensureProfile,
  getLeaderboard,
  getMatchHistory,
  getProfile,
  updateProfile,
} from './store';

async function uidFrom(req: Request): Promise<string | null> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const user = await verifyIdToken(token);
  return user?.uid ?? null;
}

export function accountsRouter(): Router {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json({ accountsEnabled: accountsEnabled() });
  });

  router.get('/leaderboard', async (_req, res) => {
    res.json({ entries: await getLeaderboard(50) });
  });

  router.get('/me', async (req: Request, res: Response) => {
    const uid = await uidFrom(req);
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    const user = await verifyIdToken(req.headers.authorization?.slice(7));
    const profile = await ensureProfile(uid, user?.name ?? 'Oyuncu', user?.picture ?? null);
    return res.json({ profile });
  });

  router.post('/me', async (req: Request, res: Response) => {
    const uid = await uidFrom(req);
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    await updateProfile(uid, { handle: req.body?.handle, avatar: req.body?.avatar });
    return res.json({ profile: await getProfile(uid) });
  });

  router.get('/me/matches', async (req: Request, res: Response) => {
    const uid = await uidFrom(req);
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    return res.json({ matches: await getMatchHistory(uid, 20) });
  });

  return router;
}
