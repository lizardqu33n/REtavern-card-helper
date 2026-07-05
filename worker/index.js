/**
 * Cloudflare Worker entry — delegates all requests to the Hono app.
 *
 * Static assets are served by Cloudflare's Static Assets binding configured
 * in wrangler.toml. The `run_worker_first = ["/api/*"]` setting ensures only
 * /api/* requests invoke this Worker; all other requests go directly to assets.
 *
 * For defense-in-depth (in case run_worker_first is ever changed), non-/api
 * requests are forwarded to the ASSETS binding as a fallback.
 */
import app from '../server/app.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API requests → Hono app
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env);
    }

    // Everything else → static assets (SPA fallback handled by not_found_handling)
    return env.ASSETS.fetch(request);
  },
};
