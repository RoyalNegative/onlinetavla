// REST API for account perks. All endpoints degrade gracefully when accounts
// are disabled (empty leaderboard, 401 on authed routes).

import { Router, type Request, type Response } from 'express';
import { games } from '@tavla/engine';
import { accountsEnabled, accountsReason, verifyIdToken } from './firebase';
import { isOnline } from './presence';
import {
  addFriend,
  addFriendByUid,
  ensureProfile,
  getLeaderboard,
  getMatchHistory,
  getProfile,
  getRank,
  joinTournament,
  listFriendRequests,
  listFriends,
  removeFriend,
  respondFriendRequest,
  tournamentStandings,
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
    res.json({ accountsEnabled: accountsEnabled(), reason: accountsReason() });
  });

  router.get('/leaderboard', async (_req, res) => {
    res.json({ entries: await getLeaderboard(50) });
  });

  router.get('/me', async (req: Request, res: Response) => {
    const uid = await uidFrom(req);
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    const user = await verifyIdToken(req.headers.authorization?.slice(7));
    const profile = await ensureProfile(uid, user?.name ?? 'Oyuncu', user?.picture ?? null);
    const rank = await getRank(uid);
    return res.json({ profile, rank });
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

  // ---- Friends ----
  router.get('/friends', async (req: Request, res: Response) => {
    const uid = await uidFrom(req);
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    const friends = await listFriends(uid);
    return res.json({ friends: friends.map((f) => ({ ...f, online: isOnline(f.uid) })) });
  });

  // Request by handle (typed in the modal) or by uid (one tap on an opponent
  // in-room). Adds are consensual: the target gets a request to accept — unless
  // they already requested you, which counts as mutual consent.
  router.post('/friends', async (req: Request, res: Response) => {
    const uid = await uidFrom(req);
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    const handle = typeof req.body?.handle === 'string' ? req.body.handle : '';
    const targetUid = typeof req.body?.uid === 'string' ? req.body.uid : '';
    if (!handle.trim() && !targetUid) return res.status(400).json({ error: 'handle_required' });
    const result = handle.trim() ? await addFriend(uid, handle) : await addFriendByUid(uid, targetUid);
    if ('error' in result) return res.status(404).json({ error: result.error });
    if ('requested' in result) return res.json({ requested: true });
    return res.json({ friend: { ...result.friend, online: isOnline(result.friend.uid) } });
  });

  // ---- Friend requests (the notification inbox) ----
  router.get('/friends/requests', async (req: Request, res: Response) => {
    const uid = await uidFrom(req);
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    return res.json({ requests: await listFriendRequests(uid) });
  });

  router.post('/friends/requests/:uid', async (req: Request, res: Response) => {
    const uid = await uidFrom(req);
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    const accept = req.body?.accept === true;
    const result = await respondFriendRequest(uid, String(req.params.uid), accept);
    if ('error' in result) return res.status(404).json({ error: result.error });
    if ('friend' in result) return res.json({ friend: { ...result.friend, online: isOnline(result.friend.uid) } });
    return res.json({ ok: true });
  });

  router.delete('/friends/:uid', async (req: Request, res: Response) => {
    const uid = await uidFrom(req);
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    await removeFriend(uid, String(req.params.uid));
    return res.json({ ok: true });
  });

  // ---- Tournaments (daily, per game) ----
  router.get('/tournaments', async (req: Request, res: Response) => {
    const gameId = typeof req.query.gameId === 'string' && req.query.gameId in games ? req.query.gameId : 'tavla';
    const { meta, standings } = await tournamentStandings(gameId);
    const uid = await uidFrom(req);
    const joined = uid ? standings.some((s) => s.uid === uid) : false;
    return res.json({ meta, standings, joined });
  });

  router.post('/tournaments/join', async (req: Request, res: Response) => {
    const uid = await uidFrom(req);
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    const gameId = typeof req.body?.gameId === 'string' && req.body.gameId in games ? (req.body.gameId as string) : 'tavla';
    const profile = await ensureProfile(uid, 'Oyuncu', null);
    const result = await joinTournament(uid, gameId, profile.handle, profile.avatar);
    if ('error' in result) return res.status(400).json({ error: result.error });
    return res.json({ meta: result });
  });

  return router;
}
