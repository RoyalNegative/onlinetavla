// Load a local .env into process.env (dev convenience) BEFORE anything reads it.
// Must be the first import in index.ts. No-op in production, where env vars come
// from the host (e.g. Render) and no .env file exists.
try {
  process.loadEnvFile();
} catch {
  /* no local .env — fine, use the host's environment variables */
}
