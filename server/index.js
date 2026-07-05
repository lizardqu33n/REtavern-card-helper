/**
 * Local development server — Node.js entry for the Hono app.
 *
 * Runs on port 3001 locally. Vite dev server proxies /api/* here.
 * On Cloudflare, this file is NOT used — worker/index.js is the entry point.
 *
 * `process.env` is passed as the Hono env so that CORS_ORIGINS etc. work
 * the same way as Cloudflare bindings (accessed via c.env in the app).
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import app from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Serve static files from dist/ (for `npm start` local production testing).
// Skip /api/* so API routes are always handled by Hono, not static fallback.
const distPath = join(__dirname, '..', 'dist');
const staticMiddleware = serveStatic({ root: distPath });
const spaFallback = serveStatic({ path: join(distPath, 'index.html') });

app.use('/*', async (c, next) => {
  if (c.req.path.startsWith('/api/')) {
    await next();
    return;
  }
  await staticMiddleware(c, next);
});

// SPA fallback: serve index.html for non-matching non-API routes
app.get('/*', async (c, next) => {
  if (c.req.path.startsWith('/api/')) {
    await next();
    return;
  }
  await spaFallback(c, next);
});

serve(
  {
    fetch: (request, env, executionCtx) =>
      app.fetch(request, process.env, executionCtx),
    port: Number(PORT),
    hostname: HOST,
  },
  (info) => {
    console.log(`[Server] Running on http://${HOST}:${info.port}`);
  },
);
