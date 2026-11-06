/**
 * ClipForge Companion — live API contract probe + fixture generator.
 *
 * Zero dependencies, pure Node 18+. Talks to the real local gateway and writes
 * the exact JSON responses into test/fixtures/, which the Dart unit tests parse
 * with the very same fromJson() code the app uses at runtime. That gives us a
 * real end-to-end contract check even when no Flutter SDK is available.
 *
 * Usage:  node tool/contract_probe.mjs [http://127.0.0.1:4173]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'test', 'fixtures');
const BASE = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');

const checks = [];
const ok = (label, pass, extra = '') => {
  checks.push({ label, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
};

const asJson = async (res) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`Non-JSON response: ${text.slice(0, 120)}`); }
};

const get = async (p) => asJson(await fetch(`${BASE}${p}`));
const post = async (p, body) => asJson(await fetch(`${BASE}${p}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}));

function save(name, value) {
  fs.writeFileSync(path.join(FIXTURES, name), `${JSON.stringify(value, null, 2)}\n`);
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string';

async function main() {
  fs.mkdirSync(FIXTURES, { recursive: true });

  /* ---------------- GET endpoints ---------------- */
  const health = await get('/api/health');
  save('health.json', health);
  ok('GET /api/health', health.ok === true && isStr(health.version), `v${health.version}`);

  const status = await get('/api/status');
  save('status.json', status);
  const statusShape =
    status.online === true &&
    isObj(status.providers) &&
    ['script', 'image', 'video', 'voice'].every((k) => typeof status.providers[k] === 'boolean') &&
    isObj(status.labels) &&
    ['script', 'image', 'video', 'voice'].every((k) => isStr(status.labels[k])) &&
    isObj(status.budget) &&
    isNum(status.budget.spent) && isNum(status.budget.cap) && isNum(status.budget.calls) &&
    isStr(status.version) &&
    Array.isArray(status.models) && status.models.length > 0 &&
    isObj(status.defaults) &&
    ['scriptModel', 'imageModel', 'videoModel', 'voiceModel'].every((k) => isStr(status.defaults[k])) &&
    Array.isArray(status.recent);
  ok('GET /api/status — full shape', statusShape, `${status.models.length} catalog models, ${status.recent.length} ledger rows`);

  const catalog = status.models[0];
  const catalogShape =
    ['capability', 'id', 'label', 'provider', 'env', 'tier', 'detail', 'contract'].every((k) => isStr(catalog[k])) &&
    isNum(catalog.cost) && Array.isArray(catalog.alternatives);
  ok('GET /api/status — catalog model shape', catalogShape, `${catalog.id} (${catalog.capability})`);

  const models = await get('/api/models');
  save('models.json', models);
  ok('GET /api/models', Array.isArray(models.models) && models.models.length === status.models.length);

  const fallback = await get('/api/fallback');
  save('fallback.json', fallback);
  ok('GET /api/fallback', fallback.ok === true && isStr(fallback.message) && isObj(fallback.providers));

  /* ---------------- POST endpoints (fail-soft, no keys) ---------------- */
  const script = await post('/api/script', {
    prompt: 'A lone astronaut watching a sunrise over an alien ocean',
    style: 'cinematic', count: 5, duration: 15, cap: 2.5,
  });
  save('script_no_key.json', script);
  ok('POST /api/script fails soft without keys',
    script.ok === false && isStr(script.reason), script.reason);

  const image = await post('/api/image', { prompts: ['alien ocean sunrise'], aspect: '16:9', cap: 2.5 });
  save('image_no_key.json', image);
  ok('POST /api/image fails soft without keys', image.ok === false && isStr(image.reason), image.reason);

  const video = await post('/api/video', { prompt: 'ocean sunrise', aspect: '16:9', cap: 2.5 });
  save('video_no_key.json', video);
  ok('POST /api/video fails soft without keys', video.ok === false && isStr(video.reason), video.reason);

  const voice = await post('/api/voice', { text: 'A new horizon.', cap: 2.5 });
  save('voice_no_key.json', voice);
  ok('POST /api/voice fails soft without keys', voice.ok === false && isStr(voice.reason), voice.reason);

  const keys = await post('/api/keys', {
    OPENAI_API_KEY: '', FAL_KEY: '', ELEVENLABS_API_KEY: '',
    OPENAI_BASE_URL: '', LLM_BASE_URL: '', FAL_BASE_URL: '',
  });
  save('keys_response.json', keys);
  ok('POST /api/keys returns full status', keys.ok === true && isObj(keys.providers) && isObj(keys.budget));

  const budget = await post('/api/budget', { cap: 2.5 });
  save('budget.json', budget);
  ok('POST /api/budget', budget.ok === true && isObj(budget.budget) && isNum(budget.budget.cap));

  const defaults = await post('/api/models', {
    scriptModel: 'gpt-5.1',
    imageModel: 'fal-ai/flux-2-pro',
    videoModel: 'fal-ai/veo3.1',
    voiceModel: 'eleven_multilingual_v2',
  });
  save('models_response.json', defaults);
  ok('POST /api/models', defaults.ok === true && isObj(defaults.defaults) && defaults.defaults.scriptModel === 'gpt-5.1');

  /* ---------------- unknown endpoint ---------------- */
  const missing = await fetch(`${BASE}/api/does-not-exist`);
  ok('Unknown endpoint returns 404 JSON', missing.status === 404 && (await asJson(missing)).error === 'Unknown endpoint');

  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} contract checks passed`);
  console.log(`Fixtures written to ${FIXTURES}`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`Contract probe failed: ${err.message}`);
  console.error(`Is the gateway running at ${BASE}? (npm run gateway)`);
  process.exitCode = 1;
});
