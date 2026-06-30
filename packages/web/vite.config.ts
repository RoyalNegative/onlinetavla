import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev we proxy the API and the Socket.IO websocket to the game server so the
// client talks to a single origin (no CORS, same code path as production).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/socket.io': { target: 'http://localhost:8787', ws: true },
    },
  },
});
