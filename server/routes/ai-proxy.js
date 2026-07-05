/**
 * AI API Proxy Route — OpenAI-compatible
 *
 * POST /api/ai/models       - List available models from the user's API endpoint
 * POST /api/ai/chat         - Proxy a chat completion request (non-streaming)
 * POST /api/ai/chat/stream  - Proxy a chat completion request (SSE streaming)
 *
 * Both endpoints accept a full API URL from the frontend (already normalized).
 * The backend acts purely as a CORS proxy — no keys are stored server-side.
 *
 * This module runs on both Cloudflare Workers (Web APIs) and Node.js (@hono/node-server).
 */
import { Hono } from 'hono';
import { stream } from 'hono/streaming';

const router = new Hono();

const MODEL_LIST_TIMEOUT_MS = 15_000;
const CHAT_TIMEOUT_BASE_MS = 120_000;
const STREAM_TIMEOUT_BASE_MS = 180_000;
const CHAT_TIMEOUT_MAX_MS = 10 * 60_000;
const STREAM_TIMEOUT_MAX_MS = 20 * 60_000;

function timeoutForTokens(maxTokens, baseMs, maxMs) {
  const tokenBudget = Number.isFinite(Number(maxTokens)) ? Number(maxTokens) : 2000;
  const scaledMs = Math.ceil(tokenBudget * 90);
  return Math.min(Math.max(baseMs, scaledMs), maxMs);
}

/**
 * fetch with timeout — aborts if the upstream doesn't respond within timeoutMs.
 * The timeout covers time-to-first-byte only; streaming continues without timeout.
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Build upstream request headers. Trims the key and adds OpenRouter-specific headers. */
function buildUpstreamHeaders(apiKey, upstreamUrl) {
  const key = (apiKey || '').trim();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  // OpenRouter recommends these headers for model ranking and identification.
  if (upstreamUrl.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = 'https://tavern-card-helper.tavern-helper.workers.dev';
    headers['X-Title'] = 'Tavern Card Helper';
  }
  return headers;
}

/** Validate that OpenRouter always has a non-empty API key. */
function validateOpenRouterKey(apiKey, upstreamUrl) {
  const key = (apiKey || '').trim();
  if (upstreamUrl.includes('openrouter.ai') && !key) {
    return { ok: false, error: '使用 OpenRouter 必须填写 API 密钥，请先在设置中保存 Key' };
  }
  return { ok: true, key };
}

// ─── POST /models ─────────────────────────────────────────────────────────────
// Fetch available models from the user's OpenAI-compatible endpoint.
// Body: { apiUrl, apiKey } — apiUrl is already the /models endpoint
// Returns: { models: [{ id, owned_by }] }
//
// Streams the upstream response and extracts model IDs via regex scanning
// to avoid a single large JSON.parse() that could exceed Cloudflare's 10ms
// CPU limit when the upstream returns thousands of models.
router.post('/models', async (c) => {
  try {
    const { apiUrl, apiKey } = await c.req.json();

    if (!apiUrl) {
      return c.json({ error: '请填写 API 地址' }, 400);
    }

    const validation = validateOpenRouterKey(apiKey, apiUrl);
    if (!validation.ok) {
      return c.json({ error: validation.error }, 400);
    }

    const response = await fetchWithTimeout(apiUrl, {
      method: 'GET',
      headers: buildUpstreamHeaders(validation.key, apiUrl),
    }, MODEL_LIST_TIMEOUT_MS);

    if (!response.ok) {
      const errorText = await response.text();
      return c.json({
        error: `API 返回错误 ${response.status}`,
        details: errorText,
      }, response.status);
    }

    if (!response.body) {
      return c.json({ error: 'API 未返回响应体' }, 502);
    }

    // Stream the upstream body and accumulate text in chunks. After each chunk,
    // scan for "id":"..." patterns. This spreads CPU work across event-loop
    // ticks (between awaits), staying within the per-request CPU sub-limit.
    const models = [];
    const seenIds = new Set();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalBytes = 0;

    // Matches "id":"model-name" (with optional whitespace, standard JSON escapes)
    const idPattern = /"id"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        totalBytes += chunk.length;

        // Scan buffer for model IDs. Keep last 64 bytes as carry-over to handle
        // patterns split across chunks.
        let match;
        while ((match = idPattern.exec(buffer)) !== null) {
          const id = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
          if (!seenIds.has(id)) {
            seenIds.add(id);
            models.push({ id, owned_by: '' });
          }
        }

        // Trim processed portion but keep a small tail for cross-chunk patterns
        if (buffer.length > 64) {
          buffer = buffer.slice(-64);
        }
        // Reset regex lastIndex to start of remaining buffer
        idPattern.lastIndex = 0;

        // Safety cap: stop after 50MB to prevent runaway memory
        if (totalBytes > 50_000_000) break;
      }
    } finally {
      reader.releaseLock();
    }

    // Final scan on remaining buffer
    let match;
    while ((match = idPattern.exec(buffer)) !== null) {
      const id = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      if (!seenIds.has(id)) {
        seenIds.add(id);
        models.push({ id, owned_by: '' });
      }
    }

    return c.json({ models });
  } catch (err) {
    if (err.name === 'AbortError') {
      return c.json({ error: '请求超时，请检查 API 地址是否正确' }, 504);
    }
    console.error('[Models Error]', err.message);
    return c.json({ error: '获取模型列表失败', details: err.message }, 500);
  }
});

// ─── POST /chat ───────────────────────────────────────────────────────────────
// Proxy an OpenAI-compatible chat completion request (non-streaming).
// Body: { messages, apiUrl, apiKey, model, temperature, max_tokens }
router.post('/chat', async (c) => {
  try {
    const { messages, apiUrl, apiKey, model, temperature, max_tokens } = await c.req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: '缺少 messages 数组' }, 400);
    }
    if (!apiUrl) {
      return c.json({ error: '请填写 API 地址' }, 400);
    }

    const validation = validateOpenRouterKey(apiKey, apiUrl);
    if (!validation.ok) {
      return c.json({ error: validation.error }, 400);
    }

    const requestBody = {
      model: model || 'gpt-3.5-turbo',
      messages,
      temperature: temperature ?? 0.8,
      max_tokens: max_tokens ?? 8000,
    };

    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: buildUpstreamHeaders(validation.key, apiUrl),
      body: JSON.stringify(requestBody),
    }, timeoutForTokens(max_tokens, CHAT_TIMEOUT_BASE_MS, CHAT_TIMEOUT_MAX_MS));

    if (!response.ok) {
      const errorText = await response.text();
      return c.json({
        error: `AI API 返回错误 ${response.status}`,
        details: errorText,
      }, response.status);
    }

    const data = await response.json();
    return c.json(data);
  } catch (err) {
    if (err.name === 'AbortError') {
      return c.json({ error: 'AI API 请求超时' }, 504);
    }
    console.error('[AI Proxy Error]', err.message);
    return c.json({ error: 'AI 代理请求失败', details: err.message }, 500);
  }
});

// ─── POST /chat/stream ────────────────────────────────────────────────────────
// Streaming chat completion via Server-Sent Events.
// Same body as /chat, returns SSE stream with { choices: [{ delta: { content } }] }
//
// The upstream SSE stream is piped directly to the client as a ReadableStream.
// This is efficient on Cloudflare Workers — no buffering, no CPU-intensive parsing.
router.post('/chat/stream', async (c) => {
  try {
    const { messages, apiUrl, apiKey, model, temperature, max_tokens } = await c.req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: '缺少 messages 数组' }, 400);
    }
    if (!apiUrl) {
      return c.json({ error: '请填写 API 地址' }, 400);
    }

    const validation = validateOpenRouterKey(apiKey, apiUrl);
    if (!validation.ok) {
      return c.json({ error: validation.error }, 400);
    }

    const requestBody = {
      model: model || 'gpt-3.5-turbo',
      messages,
      temperature: temperature ?? 0.8,
      max_tokens: max_tokens ?? 8000,
      stream: true,
    };

    const requestInit = {
      method: 'POST',
      headers: buildUpstreamHeaders(validation.key, apiUrl),
      body: JSON.stringify(requestBody),
    };
    const timeoutMs = timeoutForTokens(max_tokens, STREAM_TIMEOUT_BASE_MS, STREAM_TIMEOUT_MAX_MS);

    // SSE headers — set before stream() returns the Response.
    // Content-Encoding: Identity is required for Cloudflare Workers (see Hono docs).
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('Content-Encoding', 'Identity');

    const encoder = new TextEncoder();
    const HEARTBEAT_INTERVAL_MS = 10_000;
    const heartbeatBytes = encoder.encode(': heartbeat\n\n');

    // Use Hono's official stream() helper — it correctly flushes chunks on
    // both @hono/node-server (fixing the buffering truncation) and
    // Cloudflare Workers. Manual ReadableStream was buffered by node-server.
    return stream(c, async (stream) => {
      // Initial heartbeat so the client sees activity immediately.
      await stream.write(heartbeatBytes);

      try {
        const response = await fetchWithTimeout(apiUrl, requestInit, timeoutMs);

        if (!response.ok) {
          const errorText = await response.text();
          const errPayload = JSON.stringify({
            error: `AI API 返回错误 ${response.status}`,
            details: errorText,
          });
          await stream.write(encoder.encode(`data: ${errPayload}\n\n`));
          return;
        }

        if (!response.body) {
          await stream.write(encoder.encode('data: {"error":"AI API 未返回流式响应体"}\n\n'));
          return;
        }

        // Pipe upstream chunks with heartbeat keep-alive via Promise.race.
        // The read promise is reused across races so we don't accumulate
        // pending reads. Heartbeats reset intermediary idle timers during
        // upstream "thinking" pauses.
        const reader = response.body.getReader();
        let readPromise = reader.read();

        while (true) {
          const raced = await Promise.race([
            readPromise.then((r) => ({ ...r, isData: true })),
            new Promise((resolve) =>
              setTimeout(() => resolve({ isData: false }), HEARTBEAT_INTERVAL_MS)
            ),
          ]);

          if (raced.isData) {
            if (raced.done) break;
            await stream.write(raced.value);
            // Start the next read; the sleep promise is discarded by GC.
            readPromise = reader.read();
          } else {
            // Heartbeat tick — keeps the connection alive.
            await stream.write(heartbeatBytes);
            // readPromise is still pending; the next race reuses it.
          }
        }
      } catch (err) {
        const msg = err.name === 'AbortError'
          ? 'AI API 请求超时'
          : `AI 代理流式请求失败：${err.message}`;
        const errPayload = JSON.stringify({ error: msg });
        try {
          await stream.write(encoder.encode(`data: ${errPayload}\n\n`));
        } catch {}
      }
    }, (err) => {
      console.error('[AI Stream Proxy Error]', err.message);
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return c.json({ error: 'AI API 请求超时' }, 504);
    }
    console.error('[AI Stream Proxy Error]', err.message);
    return c.json({ error: 'AI 代理流式请求失败', details: err.message }, 500);
  }
});

export default router;
