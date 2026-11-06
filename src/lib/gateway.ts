import type {
  AspectId, CloudCapability, CloudModelConfig, CloudScriptScene, GatewayStatus, Project, Scene,
} from '../types';

/**
 * Browser client for the local model gateway.
 * Every function fails soft: if the gateway is not running or a provider is
 * missing, callers receive a well-formed "unavailable" result and the app
 * continues with its entirely local generation pipeline.
 */

export interface CatalogModel {
  capability: CloudCapability;
  id: string;
  label: string;
  provider: string;
  env: string;
  cost: number;
  tier: string;
  detail: string;
  contract: string;
  alternatives: string[];
}

export interface LedgerEntry {
  at: number;
  capability: CloudCapability;
  model: string;
  cost: number;
}

export interface GatewaySnapshot extends GatewayStatus {
  models: CatalogModel[];
  defaults: CloudModelConfig;
  recent: LedgerEntry[];
}

export interface ModelResult<T> {
  ok: boolean;
  reason?: string;
  data?: T;
  cost?: number;
  model?: string;
}

export const OFFLINE_STATUS: GatewaySnapshot = {
  online: false,
  providers: { script: false, image: false, video: false, voice: false },
  labels: {
    script: 'Gateway offline — local writer',
    image: 'Gateway offline — procedural art',
    video: 'Gateway offline — procedural motion',
    voice: 'Gateway offline — browser voice',
  },
  budget: { spent: 0, cap: 2.5, calls: 0 },
  version: '—',
  models: [],
  defaults: { scriptModel: '', imageModel: '', videoModel: '', voiceModel: '' },
  recent: [],
};

async function request<T>(path: string, body?: unknown, timeoutMs = 20000): Promise<T | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(path, body === undefined
      ? { signal: ac.signal, cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ac.signal,
        });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchStatus(): Promise<GatewaySnapshot> {
  const s = await request<GatewaySnapshot>('/api/status', undefined, 3500);
  if (!s || !s.online) return OFFLINE_STATUS;
  return {
    ...OFFLINE_STATUS,
    ...s,
    models: Array.isArray(s.models) ? s.models : [],
    recent: Array.isArray(s.recent) ? s.recent : [],
  };
}

export interface RuntimeKeys {
  OPENAI_API_KEY?: string;
  FAL_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  OPENAI_BASE_URL?: string;
}

export async function saveKeys(keys: RuntimeKeys): Promise<GatewaySnapshot | null> {
  const s = await request<GatewaySnapshot & { ok: boolean }>('/api/keys', keys, 8000);
  return s?.ok ? s : null;
}

export async function saveModels(models: CloudModelConfig): Promise<boolean> {
  const r = await request<{ ok: boolean }>('/api/models', models, 8000);
  return !!r?.ok;
}

export async function setBudget(cap: number, reset = false): Promise<boolean> {
  const r = await request<{ ok: boolean }>('/api/budget', { cap, reset }, 8000);
  return !!r?.ok;
}

interface ScriptResult { scenes: CloudScriptScene[]; model: string; cost: number }
interface ImageResult { images: (string | null)[]; model: string; cost: number }
interface VideoResult { videoUrl: string; model: string; cost: number }
interface VoiceResult { audio: string; model: string; cost: number }

function fail<T>(reason: string): ModelResult<T> {
  return { ok: false, reason };
}

export async function cloudScript(args: {
  prompt: string;
  style: string;
  count: number;
  duration: number;
  cap: number;
}): Promise<ModelResult<ScriptResult>> {
  const r = await request<{ ok: boolean; reason?: string } & Partial<ScriptResult>>('/api/script', args, 50000);
  if (!r) return fail('Gateway not reachable');
  if (!r.ok) return fail(r.reason || 'Script model failed');
  return { ok: true, data: { scenes: r.scenes || [], model: r.model || 'cloud', cost: r.cost || 0 }, cost: r.cost, model: r.model };
}

export async function cloudImages(args: {
  prompts: string[];
  aspect: AspectId;
  cap: number;
}): Promise<ModelResult<ImageResult>> {
  const r = await request<{ ok: boolean; reason?: string } & Partial<ImageResult>>('/api/image', args, 130000);
  if (!r) return fail('Gateway not reachable');
  if (!r.ok) return fail(r.reason || 'Image model failed');
  return { ok: true, data: { images: r.images || [], model: r.model || 'cloud', cost: r.cost || 0 }, cost: r.cost, model: r.model };
}

export async function cloudVideo(args: {
  prompt: string;
  aspect: AspectId;
  cap: number;
}): Promise<ModelResult<VideoResult>> {
  const r = await request<{ ok: boolean; reason?: string } & Partial<VideoResult>>('/api/video', args, 130000);
  if (!r) return fail('Gateway not reachable');
  if (!r.ok) return fail(r.reason || 'Video model failed');
  return { ok: true, data: { videoUrl: r.videoUrl || '', model: r.model || 'cloud', cost: r.cost || 0 }, cost: r.cost, model: r.model };
}

export async function cloudVoice(args: { text: string; cap: number }): Promise<ModelResult<VoiceResult>> {
  const r = await request<{ ok: boolean; reason?: string } & Partial<VoiceResult>>('/api/voice', args, 50000);
  if (!r) return fail('Gateway not reachable');
  if (!r.ok) return fail(r.reason || 'Voice model failed');
  return { ok: true, data: { audio: r.audio || '', model: r.model || 'cloud', cost: r.cost || 0 }, cost: r.cost, model: r.model };
}

/** Replace scene artwork with generated keyframes, keeping procedural art for any failed shot. */
export function applyCloudFrames(project: Project, images: (string | null)[]): Project {
  return {
    ...project,
    scenes: project.scenes.map((s: Scene, i: number) => {
      const url = images[i];
      if (!url) return s;
      return { ...s, art: url, source: 'cloud-image' as const };
    }),
  };
}

export function applyCloudVideo(project: Project, videoUrl: string): Project {
  return { ...project, scenes: project.scenes.map((s, i) => (i === 0 ? { ...s, videoUrl } : s)) };
}
