/**
 * ClipForge AI — local model gateway.
 *
 * Zero dependencies, pure Node. Jobs:
 *   1. Serve the built SPA (dist/) so the app runs from one command.
 *   2. Expose a small, provider-agnostic HTTP API for frontier models.
 *   3. Enforce a hard spend cap and keep an in-memory cost ledger.
 *   4. NEVER fail the app: any provider error returns { ok:false, reason }
 *      so the browser can fall back to the local Director v1 pipeline.
 *
 * Keys can come from the environment OR be pasted at runtime via POST /api/keys.
 * Runtime keys live only in process memory and are never written to disk.
 *
 * Run: npm run gateway   (or npm run serve = build + gateway)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const VERSION = '1.0.0';

/* ------------------------------------------------------------------ *
 * Model catalog. These are the best-in-class targets identified during
 * research; every one is optional and the app works with none of them.
 * `contract` documents the exact upstream API this gateway speaks.
 * ------------------------------------------------------------------ */
const CATALOG = [
  {
    capability: 'script', id: 'gpt-5.1', label: 'GPT-5.1', provider: 'OpenAI / OpenRouter',
    env: 'OPENAI_API_KEY', cost: 0.06, tier: 'frontier',
    detail: 'Long-context shot-list reasoning with strict JSON output.',
    contract: 'POST {base}/chat/completions · OpenAI-compatible',
    alternatives: ['claude-opus-4-5', 'gemini-3-pro', 'gpt-5.2'],
  },
  {
    capability: 'image', id: 'fal-ai/flux-2-pro', label: 'FLUX.2 Pro', provider: 'fal.ai',
    env: 'FAL_KEY', cost: 0.05, tier: 'frontier',
    detail: 'Photoreal, prompt-faithful keyframes with strong typography control.',
    contract: 'POST https://fal.run/{model}',
    alternatives: ['fal-ai/nano-banana-pro', 'fal-ai/imagen4-ultra', 'fal-ai/qwen-image'],
  },
  {
    capability: 'video', id: 'fal-ai/veo3.1', label: 'Veo 3.1', provider: 'fal.ai',
    env: 'FAL_KEY', cost: 0.5, tier: 'frontier',
    detail: 'Native motion clips with synced audio; used for hero shots.',
    contract: 'POST https://queue.fal.run/{model} + status polling',
    alternatives: ['fal-ai/kling-3.0', 'fal-ai/seedance-2.0', 'fal-ai/wan-2.2'],
  },
  {
    capability: 'voice', id: 'eleven_multilingual_v2', label: 'ElevenLabs v2', provider: 'ElevenLabs',
    env: 'ELEVENLABS_API_KEY', cost: 0.02, tier: 'frontier',
    detail: 'Natural multilingual narration for the voiceover track.',
    contract: 'POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
    alternatives: ['eleven_turbo_v2_5', 'eleven_flash_v2_5'],
  },
];

const DEFAULT_MODELS = {
  scriptModel: 'gpt-5.1',
  imageModel: 'fal-ai/flux-2-pro',
  videoModel: 'fal-ai/veo3.1',
  voiceModel: 'eleven_multilingual_v2',
};

/* ------------------------------------------------------------------ *
 * State: runtime keys, base URLs, budget ledger.
 * ------------------------------------------------------------------ */
const runtimeKeys = {};
const runtimeBases = {};
let models = { ...DEFAULT_MODELS };
const ledger = { spent: 0, calls: 0, cap: 2.5, entries: [] };

const keyFor = (name) => runtimeKeys[name] || process.env[name] || '';
const baseFor = (name, fallback) => runtimeBases[name] || process.env[name] || fallback;

const PROVIDER_ENV = {
  script: 'OPENAI_API_KEY',
  image: 'FAL_KEY',
  video: 'FAL_KEY',
  voice: 'ELEVENLABS_API_KEY',
};

const PROVIDER_LABEL = {
  script: 'OpenAI-compatible LLM',
  image: 'fal.ai image models',
  video: 'fal.ai video models',
  voice: 'ElevenLabs TTS',
};

function providerState() {
  const providers = {};
  const labels = {};
  for (const cap of Object.keys(PROVIDER_ENV)) {
    const env = PROVIDER_ENV[cap];
    const present = !!keyFor(env);
    providers[cap] = present;
    labels[cap] = present ? `${PROVIDER_LABEL[cap]} · ${keyFor(env).slice(0, 3)}••••` : `No ${env} — local fallback`;
  }
  return { providers, labels };
}

function status() {
  const { providers, labels } = providerState();
  return {
    online: true,
    providers,
    labels,
    budget: { spent: +ledger.spent.toFixed(4), cap: ledger.cap, calls: ledger.calls },
    version: VERSION,
    models: CATALOG,
    defaults: models,
    recent: ledger.entries.slice(-6).reverse(),
  };
}

function charge(capability, model, cost) {
  ledger.spent += cost;
  ledger.calls += 1;
  ledger.entries.push({ at: Date.now(), capability, model, cost: +cost.toFixed(4) });
}

function guard(capability, model, cost, cap) {
  if (cap !== undefined) ledger.cap = Math.max(0, Number(cap) || 0);
  if (!keyFor(PROVIDER_ENV[capability])) return { ok: false, reason: `No ${PROVIDER_ENV[capability]} configured` };
  if (ledger.spent + cost > ledger.cap) {
    return { ok: false, reason: `Budget cap $${ledger.cap.toFixed(2)} reached ($${ledger.spent.toFixed(2)} spent)` };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * HTTP helpers
 * ------------------------------------------------------------------ */
function send(res, code, body, type = 'application/json; charset=utf-8') {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 2_000_000) { reject(new Error('Body too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

async function fetchWithTimeout(url, opts = {}, ms = 30000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function jsonOrError(resp) {
  const text = await resp.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* non-JSON upstream */ }
  if (!resp.ok) throw new Error(data?.error?.message || data?.detail || data?.message || `HTTP ${resp.status}`);
  return data;
}

/** Convert a remote image/audio URL into a data URL so the canvas stays CORS-safe. */
async function asDataUrl(url, mime, timeout = 30000) {
  const r = await fetchWithTimeout(url, {}, timeout);
  if (!r.ok) throw new Error(`Media download HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || mime;
  return `data:${ct};base64,${buf.toString('base64')}`;
}

/* ------------------------------------------------------------------ *
 * Provider adapters
 * ------------------------------------------------------------------ */
const SCRIPT_SYSTEM = `You are the storyboard brain of a short-form video editor. Return STRICT JSON only, no markdown, no commentary.
Schema: {"scenes":[{"beat":string,"caption":string,"narration":string,"camera":string,"imagePrompt":string}]}
Rules:
- caption: max 6 words, ALL CAPS, punchy, readable over video.
- narration: one spoken sentence, max 18 words, grounded in the user's literal words.
- camera: a concrete camera move (e.g. "slow dolly push-in").
- imagePrompt: a richly detailed single-frame visual description, no text/watermarks.
- Follow the given shot count exactly. Beat arc: Hook, Setup, Story..., Climax, Outro.
- Never invent a logo, brand name, or on-screen text other than the caption.`;

async function callScript(body) {
  const model = models.scriptModel || DEFAULT_MODELS.scriptModel;
  const cost = 0.06;
  const ok = guard('script', model, cost, body.cap);
  if (!ok.ok) return ok;
  const base = baseFor('OPENAI_BASE_URL', baseFor('LLM_BASE_URL', 'https://api.openai.com/v1')).replace(/\/$/, '');
  const target = `${base}/chat/completions`;
  try {
    const data = await jsonOrError(await fetchWithTimeout(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${keyFor('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SCRIPT_SYSTEM },
          { role: 'user', content: `Prompt: ${body.prompt}\nVisual style: ${body.style}\nShot count: ${body.count}\nTotal duration: ${body.duration}s` },
        ],
      }),
    }, 45000));
    let parsed = data.choices?.[0]?.message?.content;
    if (typeof parsed !== 'string') throw new Error('Empty completion');
    parsed = parsed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const obj = JSON.parse(parsed);
    const scenes = (Array.isArray(obj.scenes) ? obj.scenes : obj.shots || [])
      .slice(0, 8)
      .map((s) => ({
        beat: typeof s.beat === 'string' ? s.beat.slice(0, 24) : undefined,
        caption: String(s.caption ?? '').slice(0, 48),
        narration: String(s.narration ?? '').slice(0, 220),
        camera: String(s.camera ?? '').slice(0, 64),
        imagePrompt: String(s.imagePrompt ?? s.visual ?? '').slice(0, 600),
      }))
      .filter((s) => s.caption || s.narration);
    if (scenes.length < 2) throw new Error('Model returned too few scenes');
    charge('script', model, cost);
    return { ok: true, scenes, model, cost };
  } catch (err) {
    return { ok: false, reason: `Script model unavailable: ${err.message}` };
  }
}

async function callImage(body) {
  const model = models.imageModel || DEFAULT_MODELS.imageModel;
  const prompts = (Array.isArray(body.prompts) ? body.prompts : []).slice(0, 8).map(String);
  if (!prompts.length) return { ok: false, reason: 'No image prompts supplied' };
  const perImage = 0.05;
  const cost = perImage * prompts.length;
  const ok = guard('image', model, cost, body.cap);
  if (!ok.ok) return ok;
  const images = new Array(prompts.length).fill(null);
  let done = 0;
  try {
    // Small concurrency pool: fal.run is synchronous per request.
    const queue = prompts.map((prompt, i) => ({ prompt, i }));
    const worker = async () => {
      while (queue.length) {
        const job = queue.shift();
        if (!job) return;
        try {
          const data = await jsonOrError(await fetchWithTimeout(`https://fal.run/${model}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Key ${keyFor('FAL_KEY')}` },
            body: JSON.stringify({
              prompt: job.prompt,
              image_size: body.aspect === '9:16' ? 'portrait_4_3' : body.aspect === '1:1' ? 'square_hd' : 'landscape_16_9',
              num_images: 1,
              output_format: 'jpeg',
            }),
          }, 60000));
          const url = data.images?.[0]?.url || data.image?.url;
          if (url) images[job.i] = await asDataUrl(url, 'image/jpeg');
        } catch { /* one frame failed; keep the procedural fallback for this shot */ }
        done++;
      }
    };
    await Promise.all([worker(), worker()]);
    if (!images.some(Boolean)) throw new Error('All image requests failed');
    charge('image', model, perImage * done);
    return { ok: true, images, model, cost: +(perImage * done).toFixed(4) };
  } catch (err) {
    return { ok: false, reason: `Image model unavailable: ${err.message}` };
  }
}

async function callVideo(body) {
  const model = models.videoModel || DEFAULT_MODELS.videoModel;
  const cost = 0.5;
  const ok = guard('video', model, cost, body.cap);
  if (!ok.ok) return ok;
  try {
    const submit = await jsonOrError(await fetchWithTimeout(`https://queue.fal.run/${model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${keyFor('FAL_KEY')}` },
      body: JSON.stringify({
        prompt: String(body.prompt || '').slice(0, 1200),
        aspect_ratio: body.aspect === '9:16' ? '9:16' : '16:9',
        duration: '5s',
        generate_audio: false,
      }),
    }, 30000));
    const id = submit.request_id;
    if (!id) throw new Error('No request id from video queue');
    const statusBase = `https://queue.fal.run/${model}/requests/${id}`;
    const deadline = Date.now() + 90000;
    let url = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const st = await jsonOrError(await fetchWithTimeout(`${statusBase}/status`, {
        headers: { Authorization: `Key ${keyFor('FAL_KEY')}` },
      }, 20000));
      if (st.status === 'COMPLETED') break;
      if (st.status === 'FAILED' || st.status === 'CANCELLED') throw new Error(`Video job ${st.status.toLowerCase()}`);
    }
    const result = await jsonOrError(await fetchWithTimeout(statusBase, {
      headers: { Authorization: `Key ${keyFor('FAL_KEY')}` },
    }, 20000));
    url = result.video?.url || result.output?.video?.url || null;
    if (!url) throw new Error('Video job produced no URL');
    charge('video', model, cost);
    return { ok: true, videoUrl: url, model, cost };
  } catch (err) {
    return { ok: false, reason: `Video model unavailable: ${err.message}` };
  }
}

async function callVoice(body) {
  const voice = models.voiceModel || DEFAULT_MODELS.voiceModel;
  const cost = 0.02;
  const ok = guard('voice', voice, cost, body.cap);
  if (!ok.ok) return ok;
  try {
    const r = await fetchWithTimeout(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': keyFor('ELEVENLABS_API_KEY'),
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: String(body.text || '').slice(0, 500),
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    }, 45000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    charge('voice', voice, cost);
    return { ok: true, audio: `data:audio/mpeg;base64,${buf.toString('base64')}`, model: voice, cost };
  } catch (err) {
    return { ok: false, reason: `Voice model unavailable: ${err.message}` };
  }
}

/* ------------------------------------------------------------------ *
 * Static SPA hosting
 * ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  if (rel.includes('..')) return send(res, 403, { error: 'Forbidden' });
  let file = path.join(DIST, rel);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    return send(res, 404, `<!doctype html><title>ClipForge AI</title><h2>Build the app first</h2><p>Run <code>npm run serve</code> (build + gateway) or <code>npm run build</code>.</p>`, 'text/html; charset=utf-8');
  }
  const ext = path.extname(file).toLowerCase();
  send(res, 200, fs.readFileSync(file), MIME[ext] || 'application/octet-stream');
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  try {
    if (!p.startsWith('/api/')) return serveStatic(req, res, p);

    if (p === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, version: VERSION });
    if (p === '/api/status' && req.method === 'GET') return send(res, 200, status());
    if (p === '/api/models' && req.method === 'GET') return send(res, 200, { models: CATALOG });

    if (p === '/api/keys' && req.method === 'POST') {
      const body = await readBody(req);
      const allowed = ['OPENAI_API_KEY', 'FAL_KEY', 'ELEVENLABS_API_KEY'];
      for (const k of allowed) {
        if (typeof body[k] === 'string') {
          if (body[k]) runtimeKeys[k] = body[k];
          else delete runtimeKeys[k];
        }
      }
      for (const k of ['OPENAI_BASE_URL', 'LLM_BASE_URL', 'FAL_BASE_URL']) {
        if (typeof body[k] === 'string') {
          if (body[k]) runtimeBases[k] = body[k];
          else delete runtimeBases[k];
        }
      }
      return send(res, 200, { ok: true, ...status() });
    }

    if (p === '/api/models' && req.method === 'POST') {
      const body = await readBody(req);
      for (const k of Object.keys(DEFAULT_MODELS)) {
        if (typeof body[k] === 'string' && body[k].trim()) models[k] = body[k].trim().slice(0, 120);
      }
      return send(res, 200, { ok: true, defaults: models });
    }

    if (p === '/api/budget' && req.method === 'POST') {
      const body = await readBody(req);
      if (typeof body.cap === 'number') ledger.cap = Math.max(0, Math.min(100, body.cap));
      if (body.reset) { ledger.spent = 0; ledger.calls = 0; ledger.entries = []; }
      return send(res, 200, { ok: true, budget: status().budget });
    }

    if (p === '/api/script' && req.method === 'POST') return send(res, 200, await callScript(await readBody(req)));
    if (p === '/api/image' && req.method === 'POST') return send(res, 200, await callImage(await readBody(req)));
    if (p === '/api/video' && req.method === 'POST') return send(res, 200, await callVideo(await readBody(req)));
    if (p === '/api/voice' && req.method === 'POST') return send(res, 200, await callVoice(await readBody(req)));

    if (p === '/api/fallback' && req.method === 'GET') {
      const { providers } = providerState();
      return send(res, 200, {
        ok: true,
        message: 'Director v1, procedural art, ambient score and the critic all run 100% locally — no keys required.',
        providers,
      });
    }

    return send(res, 404, { error: 'Unknown endpoint' });
  } catch (err) {
    return send(res, 400, { ok: false, reason: err.message || 'Bad request' });
  }
});

server.listen(PORT, HOST, () => {
  const { providers } = providerState();
  console.log(`\n  ClipForge AI · model gateway v${VERSION}`);
  console.log(`  http://${HOST}:${PORT}`);
  console.log(`  providers: ${Object.entries(providers).map(([k, v]) => `${k}=${v ? 'key' : 'local'}`).join('  ')}`);
  console.log(`  budget cap: $${ledger.cap.toFixed(2)} · static: ${DIST}\n`);
});
