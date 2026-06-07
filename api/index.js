/**
 * Vercel Serverless Entry — wraps the Express app for Vercel's runtime.
 * All /api/* requests are routed here.
 */
import app from '../server/index.js';

export default app;
