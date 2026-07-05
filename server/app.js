/**
 * Hono App — shared between Node.js (local dev) and Cloudflare Workers (production).
 *
 * On Cloudflare, env bindings (e.g. CORS_ORIGINS) are passed via `app.fetch(request, env)`.
 * On Node.js, `process.env` is passed as the env by server/index.js.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import aiProxy from './routes/ai-proxy.js';

const app = new Hono();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Pre-build CORS middleware once per origin-config. The middleware factory is
// cheap but avoiding per-request allocation is still good practice.
// On Cloudflare, env is per-request (bindings); we cache by JSON.stringify of config.
const corsCache = new Map();

function getCorsMiddleware(env) {
  const originsRaw = env?.CORS_ORIGINS;
  // If no whitelist configured, allow all (dev default).
  if (!originsRaw) return cors({ origin: '*' });

  const cacheKey = originsRaw;
  let middleware = corsCache.get(cacheKey);
  if (!middleware) {
    const origins = originsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    middleware = cors({ origin: origins.length ? origins : '*' });
    corsCache.set(cacheKey, middleware);
  }
  return middleware;
}

app.use('*', async (c, next) => {
  return getCorsMiddleware(c.env)(c, next);
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.route('/api/ai', aiProxy);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;
