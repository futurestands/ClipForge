import raw from './model-data.json';
import type { DirectionPrediction, MotifId, StyleChoice, StyleId } from '../../types';

/**
 * Browser inference for ClipForge Director v1.
 * This is the exact forward pass of the model trained by `npm run train`.
 * No API calls, no runtime download — 100% local and deterministic.
 */
interface ModelData {
  name: string;
  version: number;
  trainedAt: string;
  architecture: string;
  vocab: string[];
  inputDim: number;
  hidden: number;
  outDim: number;
  base: number;
  lexDim: number;
  triDim: number;
  lexicons: Record<string, string[]>;
  lexKeys: string[];
  /** Blend weight of the domain-lexicon prior over the network's motif posterior. */
  motifLambda: number;
  styleOffset: number;
  motifOffset: number;
  regOffset: number;
  styles: StyleId[];
  motifs: MotifId[];
  regMin: { pacing: number; energy: number; shots: number };
  regMax: { pacing: number; energy: number; shots: number };
  W1: number[]; b1: number[]; W2: number[]; b2: number[];
  metrics: Record<string, number>;
}

const M = raw as unknown as ModelData;
const STOP = new Set('a an the of and with about for in on at to from into over under is are was were be this that it its as by make create generate video clip film short showing show produce i want please using use seconds second minute 15 30'.split(' '));
const EMOTIONAL = /\b(epic|emotional|dramatic|calm|quiet|soft|gentle|slow|energy|hype|vibrant|majestic|nostalgic|dreamy|intense|joy|melancholy)\b/;
const TECHNICAL = /\b(drone|close.?up|aerial|handheld|tracking|35mm|ray.?traced|studio|rim light|bokeh|isometric|podium|orbit)\b/;
const VINDEX = new Map(M.vocab.map((t, i) => [t, i]));

function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
}

function stem(w: string): string {
  return w.replace(/(ingly|ing|edly|ed|ies|es|ly|ment|ness|ion|s)$/, '').slice(0, 9);
}

function numeric(text: string, toks: string[]): number[] {
  return [
    Math.min(1.5, toks.length / 22),
    /\d/.test(text) ? 1 : 0,
    /(second|seconds|minute|\bs\b)/.test(text) ? 1 : 0,
    Math.min(1.2, (toks.reduce((a, w) => a + w.length, 0) / Math.max(1, toks.length)) / 8),
    EMOTIONAL.test(text) ? 1 : 0,
    TECHNICAL.test(text) ? 1 : 0,
  ];
}

function lexFeatures(toks: string[]): number[] {
  const counts = new Array(M.lexKeys.length).fill(0) as number[];
  for (const t of toks) {
    const st = stem(t);
    if (st.length < 3) continue;
    M.lexKeys.forEach((k, i) => {
      if (M.lexicons[k].some((l) => st.startsWith(l) || (l.length >= 5 && l.startsWith(st)))) counts[i] += 1;
    });
  }
  const out: number[] = [];
  for (let i = 0; i < M.lexKeys.length; i++) {
    out.push(Math.min(1, counts[i] / 2), counts[i] > 0 ? 1 : 0);
  }
  return out;
}

/**
 * Sparse domain-lexicon evidence per motif. Mirrors `motifLexCounts` in
 * training/train.mjs exactly — the shipped ensemble must match the one that
 * produced the reported validation accuracy.
 */
function motifLexCounts(toks: string[]): number[] {
  const counts = M.motifs.map(() => 0);
  for (const t of toks) {
    const st = stem(t);
    if (st.length < 3) continue;
    M.motifs.forEach((m, i) => {
      if (M.lexicons[m].some((l) => st.startsWith(l) || (l.length >= 5 && l.startsWith(st)))) counts[i] += 1;
    });
  }
  return counts;
}

function trigramFeatures(text: string): number[] {
  const out = new Array(M.triDim).fill(0) as number[];
  const clean = ` ${text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  let n = 0;
  for (let i = 0; i < clean.length - 2; i++) {
    const g = clean.slice(i, i + 3);
    let h = 2166136261;
    for (let c = 0; c < 3; c++) { h ^= g.charCodeAt(c); h = Math.imul(h, 16777619); }
    out[(h >>> 0) % M.triDim] += 1;
    n++;
  }
  if (n) for (let i = 0; i < M.triDim; i++) out[i] = out[i] / n * 8;
  return out;
}

function vector(text: string): number[] {
  const x = new Array(M.inputDim).fill(0) as number[];
  const toks = tokens(text);
  for (const t of toks) {
    const i = VINDEX.get(t);
    if (i !== undefined) x[i] = 1;
  }
  const n = numeric(text, toks);
  for (let i = 0; i < n.length; i++) x[M.vocab.length + i] = n[i];
  const lf = lexFeatures(toks);
  for (let i = 0; i < lf.length; i++) x[M.base + i] = lf[i];
  const tf = trigramFeatures(text);
  for (let i = 0; i < tf.length; i++) x[M.base + M.lexDim + i] = tf[i];
  return x;
}

function forward(x: number[]): { h: number[]; o: number[] } {
  const h = new Array(M.hidden).fill(0) as number[];
  for (let j = 0; j < M.hidden; j++) {
    let s = M.b1[j];
    for (let i = 0; i < M.inputDim; i++) if (x[i]) s += x[i] * M.W1[i * M.hidden + j];
    h[j] = Math.tanh(s);
  }
  const o = new Array(M.outDim).fill(0) as number[];
  for (let k = 0; k < M.outDim; k++) {
    let s = M.b2[k];
    for (let j = 0; j < M.hidden; j++) s += h[j] * M.W2[j * M.outDim + k];
    o[k] = s;
  }
  return { h, o };
}

function softmax(o: number[], off: number, n: number): number[] {
  let max = -Infinity;
  for (let i = 0; i < n; i++) max = Math.max(max, o[off + i]);
  const p = new Array(n).fill(0) as number[];
  let sum = 0;
  for (let i = 0; i < n; i++) { p[i] = Math.exp(o[off + i] - max); sum += p[i]; }
  return p.map((v) => v / sum);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const denorm = (v: number, key: 'pacing' | 'energy' | 'shots') =>
  v * (M.regMax[key] - M.regMin[key]) + M.regMin[key];

export function predictDirection(prompt: string): DirectionPrediction {
  const text = prompt || 'a story worth telling';
  const { o } = forward(vector(text));
  const ps = softmax(o, M.styleOffset, M.styles.length);
  // Neural posterior + domain-lexicon prior (λ tuned on the held-out split).
  const raw = softmax(o, M.motifOffset, M.motifs.length);
  const counts = motifLexCounts(tokens(text));
  const logits = raw.map((p, i) => Math.log(p + 1e-6) + (M.motifLambda ?? 0) * counts[i]);
  const mx = Math.max(...logits);
  const ex = logits.map((v) => Math.exp(v - mx));
  const sum = ex.reduce((a, b) => a + b, 0);
  const pm = ex.map((v) => v / sum);
  const si = ps.indexOf(Math.max(...ps));
  const mi = pm.indexOf(Math.max(...pm));
  return {
    style: M.styles[si],
    motif: M.motifs[mi],
    confidence: (ps[si] + pm[mi]) / 2,
    pacing: +denorm(clamp01(o[M.regOffset]), 'pacing').toFixed(2),
    energy: +denorm(clamp01(o[M.regOffset + 1]), 'energy').toFixed(2),
    shots: Math.round(denorm(clamp01(o[M.regOffset + 2]), 'shots')),
    model: `${M.name} · local`,
  };
}

export function resolveStyle(choice: StyleChoice, prediction: DirectionPrediction): StyleId {
  return choice === 'auto' ? prediction.style : choice;
}

export const MODEL_METRICS = M.metrics;
export const MODEL_INFO = {
  name: M.name,
  architecture: M.architecture,
  trainedAt: M.trainedAt,
  parameters: M.W1.length + M.b1.length + M.W2.length + M.b2.length,
  inputDim: M.inputDim,
  motifLambda: M.motifLambda,
  rawMotifAccuracy: M.metrics.valMotifAccuracyRaw,
};
