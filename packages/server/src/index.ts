// Server bootstrap: Express (health + accounts REST + static web build) and
// Socket.IO (the realtime game) on a single HTTP server — one origin, one URL.

import './loadenv'; // must run before modules that read process.env (firebase)
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { accountsRouter } from './accounts/routes';
import { RoomManager } from './rooms';
import { attachSockets } from './socket';

const PORT = Number(process.env.PORT) || 8787;
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

const app = express();
app.use(express.json());

// Permissive CORS for the API (dev runs the client on a different port).
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/api', accountsRouter());

// Serve the built client in production (single origin).
const hasBuild = existsSync(webDist);
if (hasBuild) {
  // `extensions: ['html']` lets static SEO pages (e.g. public/nasil-oynanir.html)
  // resolve at clean, extensionless URLs like /nasil-oynanir before the SPA fallback.
  app.use(express.static(webDist, { extensions: ['html'] }));
  app.get('*', (_req, res) => res.sendFile(fileURLToPath(new URL('../../web/dist/index.html', import.meta.url))));
} else {
  app.get('/', (_req, res) =>
    res.type('text').send('Tavla server is running. Build the web client (npm run build) or use the Vite dev server.'),
  );
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

const rooms = new RoomManager();
attachSockets(io, rooms);

httpServer.listen(PORT, () => {
  console.log(`[tavla] server listening on http://localhost:${PORT}`);
  console.log(`[tavla] serving web build: ${hasBuild ? 'yes' : 'no (dev mode)'}`);
});
