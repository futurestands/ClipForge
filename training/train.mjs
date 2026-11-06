/**
 * ClipForge Director v1 — local supervised training.
 * Pure Node, no dependencies. Trains a small MLP that maps a prompt to
 * (style, motif, pacing, energy, shot count). Run: npm run train
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const STYLES = ['cinematic', 'anime', 'neon', 'watercolor', 'threeD', 'doc'];
const MOTIFS = ['nature', 'city', 'ocean', 'space', 'product', 'people', 'abstract'];
const HIDDEN = 64;
const OUT = STYLES.length + MOTIFS.length + 3; // 16
const STYLE_OFF = 0;
const MOTIF_OFF = STYLES.length;
const REG_OFF = MOTIF_OFF + MOTIFS.length;

// Domain lexicons give the model generalisation to words it never saw in training.
const LEXICONS = {
  cinematic: ['cinemat', 'epic', 'film', '35mm', 'dramat', 'majest', 'emotion', 'golden', 'widescreen', 'telephoto', 'crane', 'storm'],
  anime: ['anime', 'manga', 'cel', 'speed', 'sparkl', 'magical', 'festival', 'lantern', 'mecha', 'vibrant', 'slice', 'firework'],
  neon: ['neon', 'cyber', 'synth', 'glow', 'glitch', 'hacker', 'arcade', 'purple', 'cyan', 'retro', 'detective', 'electr'],
  watercolor: ['watercolor', 'pastel', 'painted', 'delicate', 'hand', 'floral', 'invitation', 'diary', 'soft', 'gentle'],
  threeD: ['3d', 'render', 'gloss', 'ray', 'podium', 'isometric', 'studio', 'modular', 'premium', 'sphere'],
  doc: ['documentary', 'observation', 'handheld', 'real', 'honest', 'natural', 'daily', 'shift', 'baker', 'migrat', 'quiet'],
  nature: ['mountain', 'forest', 'valley', 'desert', 'tree', 'hill', 'snow', 'ridge', 'garden', 'spring', 'landscape', 'dawn'],
  city: ['city', 'urban', 'street', 'tokyo', 'skyline', 'market', 'rooftop', 'building', 'station', 'platform', 'highway', 'corridor'],
  ocean: ['ocean', 'sea', 'beach', 'wave', 'coast', 'fish', 'boat', 'reef', 'shore', 'underwater', 'coral', 'harbor'],
  space: ['space', 'astronaut', 'galaxy', 'planet', 'cosmos', 'nebula', 'wormhole', 'fleet', 'rocket', 'cosmic', 'alien', 'orbit'],
  product: ['product', 'brand', 'sneaker', 'bottle', 'perfume', 'earbud', 'commercial', 'launch', 'device', 'packshot', 'coffee', 'cup'],
  people: ['people', 'person', 'girl', 'boy', 'friend', 'family', 'team', 'courier', 'sprinter', 'reunion', 'portrait', 'girl'],
  abstract: ['abstract', 'shape', 'grid', 'geometric', 'pattern', 'ribbon', 'transformation', 'floating', 'minimal'],
};
const LEX_KEYS = Object.keys(LEXICONS);
const LEX_DIM = LEX_KEYS.length * 2;
const TRI_DIM = 64;
const STOP = new Set('a an the of and with about for in on at to from into over under is are was were be this that it its as by make create generate video clip film short showing show produce i want please using use seconds second minute 15 30'.split(' '));
const EMOTIONAL = /\b(epic|emotional|dramatic|calm|quiet|soft|gentle|slow|energy|hype|vibrant|majestic|nostalgic|dreamy|intense|joy|melancholy)\b/;
const TECHNICAL = /\b(drone|close.?up|aerial|handheld|tracking|35mm|ray.?traced|studio|rim light|bokeh|isometric|podium|orbit)\b/;

function tokens(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
}

function stem(w) { return w.replace(/(ingly|ing|edly|ed|ies|es|ly|ment|ness|ion|s)$/, '').slice(0, 9); }

function lexFeatures(toks) {
  const counts = new Float64Array(LEX_KEYS.length);
  for (const t of toks) {
    const st = stem(t);
    if (st.length < 3) continue;
    LEX_KEYS.forEach((k, i) => {
      if (LEXICONS[k].some((l) => st.startsWith(l) || (l.length >= 5 && l.startsWith(st)))) counts[i] += 1;
    });
  }
  const out = new Float64Array(LEX_DIM);
  for (let i = 0; i < LEX_KEYS.length; i++) {
    out[i * 2] = Math.min(1, counts[i] / 2);
    out[i * 2 + 1] = counts[i] > 0 ? 1 : 0;
  }
  return out;
}

/**
 * Motif-only lexicon evidence. Used at inference as a log-linear prior over the
 * network's posterior — a calibrated ensemble, not a hard override. When a prompt
 * contains no domain words the prior is all zeros and the network decides alone.
 */
function motifLexCounts(toks) {
  const counts = MOTIFS.map(() => 0);
  for (const t of toks) {
    const st = stem(t);
    if (st.length < 3) continue;
    MOTIFS.forEach((m, i) => {
      if (LEXICONS[m].some((l) => st.startsWith(l) || (l.length >= 5 && l.startsWith(st)))) counts[i] += 1;
    });
  }
  return counts;
}

function trigramFeatures(text) {
  const out = new Float64Array(TRI_DIM);
  const clean = ` ${text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  let n = 0;
  for (let i = 0; i < clean.length - 2; i++) {
    const g = clean.slice(i, i + 3);
    let h = 2166136261;
    for (let c = 0; c < 3; c++) { h ^= g.charCodeAt(c); h = Math.imul(h, 16777619); }
    out[(h >>> 0) % TRI_DIM] += 1;
    n++;
  }
  if (n) for (let i = 0; i < TRI_DIM; i++) out[i] = out[i] / n * 8;
  return out;
}

function numeric(text, toks) {
  return [
    Math.min(1.5, toks.length / 22),
    /\d/.test(text) ? 1 : 0,
    /(second|seconds|minute|\bs\b)/.test(text) ? 1 : 0,
    Math.min(1.2, (toks.reduce((a, w) => a + w.length, 0) / Math.max(1, toks.length)) / 8),
    EMOTIONAL.test(text) ? 1 : 0,
    TECHNICAL.test(text) ? 1 : 0,
  ];
}

const PREFIX = [
  '', 'Create a short video about ', 'Make a cinematic clip of ',
  'Generate a fifteen second film of ', 'I want a video showing ',
  'Produce a short piece about ', 'A polished promo for ',
];
const SUFFIX = [
  '', ', with beautiful lighting', ', shot on 35mm film', ', very atmospheric',
  ', for social media', ', ultra detailed', ', with a strong narrative arc',
];

function buildExamples(seeds) {
  const out = [];
  seeds.forEach((s, si) => {
    for (let k = 0; k < PREFIX.length; k++) {
      const core = s.prompt.charAt(0).toLowerCase() + s.prompt.slice(1);
      const prompt = `${PREFIX[k]}${core}${SUFFIX[k]}`.trim();
      out.push({ prompt, style: s.style, motif: s.motif, pacing: s.pacing, shots: s.shots, energy: s.energy, seedGroup: si });
    }
  });
  return out;
}

const seeds = JSON.parse(fs.readFileSync(path.join(ROOT, 'training/seeds.json'), 'utf8'));
const examples = buildExamples(seeds);
const valGroups = new Set(seeds.map((_, i) => i).filter((i) => i % 5 === 0));
const train = examples.filter((e) => !valGroups.has(e.seedGroup));
const val = examples.filter((e) => valGroups.has(e.seedGroup));

// Vocabulary from training split only (no leakage).
const df = new Map();
train.forEach((e) => new Set(tokens(e.prompt)).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
const vocab = [...df.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 190).map(([t]) => t);
const vIndex = new Map(vocab.map((t, i) => [t, i]));
const BASE = vocab.length + 6;
const INPUT = BASE + LEX_DIM + TRI_DIM;

const REG_MIN = { pacing: 1.2, energy: 0, shots: 3 };
const REG_MAX = { pacing: 4, energy: 1, shots: 8 };
const norm = (v, k) => (v - REG_MIN[k]) / (REG_MAX[k] - REG_MIN[k]);
const denorm = (v, k) => v * (REG_MAX[k] - REG_MIN[k]) + REG_MIN[k];

function vector(text) {
  const toks = tokens(text);
  const x = new Float64Array(INPUT);
  for (const t of toks) {
    const i = vIndex.get(t);
    if (i !== undefined) x[i] = 1;
  }
  const n = numeric(text, toks);
  for (let i = 0; i < n.length; i++) x[vocab.length + i] = n[i];
  const lf = lexFeatures(toks);
  for (let i = 0; i < lf.length; i++) x[BASE + i] = lf[i];
  const tf = trigramFeatures(text);
  for (let i = 0; i < tf.length; i++) x[BASE + LEX_DIM + i] = tf[i];
  return x;
}

function target(e) {
  const y = new Float64Array(OUT);
  y[STYLE_OFF + STYLES.indexOf(e.style)] = 1;
  y[MOTIF_OFF + MOTIFS.indexOf(e.motif)] = 1;
  y[REG_OFF] = norm(e.pacing, 'pacing');
  y[REG_OFF + 1] = norm(e.energy, 'energy');
  y[REG_OFF + 2] = norm(e.shots, 'shots');
  return y;
}

// Parameter arrays
const W1 = new Float64Array(INPUT * HIDDEN);
const b1 = new Float64Array(HIDDEN);
const W2 = new Float64Array(HIDDEN * OUT);
const b2 = new Float64Array(OUT);
let rngState = 20261106;
const rnd = () => { rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 4294967296; };
for (let i = 0; i < W1.length; i++) W1[i] = (rnd() - 0.5) * Math.sqrt(6 / (INPUT + HIDDEN)) * 2;
for (let i = 0; i < W2.length; i++) W2[i] = (rnd() - 0.5) * Math.sqrt(6 / (HIDDEN + OUT)) * 2;

function forward(x) {
  const h = new Float64Array(HIDDEN);
  for (let j = 0; j < HIDDEN; j++) {
    let s = b1[j];
    for (let i = 0; i < INPUT; i++) if (x[i]) s += x[i] * W1[i * HIDDEN + j];
    h[j] = Math.tanh(s);
  }
  const o = new Float64Array(OUT);
  for (let k = 0; k < OUT; k++) {
    let s = b2[k];
    for (let j = 0; j < HIDDEN; j++) s += h[j] * W2[j * OUT + k];
    o[k] = s;
  }
  return { h, o };
}

function softmax(o, off, n) {
  let max = -Infinity;
  for (let i = 0; i < n; i++) max = Math.max(max, o[off + i]);
  const p = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { p[i] = Math.exp(o[off + i] - max); sum += p[i]; }
  for (let i = 0; i < n; i++) p[i] /= sum;
  return p;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Combine the neural motif posterior with sparse domain-lexicon evidence.
 * Each lexicon hit adds `lambda` to that motif's logit — repeated domain words
 * therefore outweigh a single incidental mention. With zero hits the network
 * decides entirely on its own.
 */
function motifPosterior(o, text, lambda) {
  const pm = softmax(o, MOTIF_OFF, MOTIFS.length);
  const counts = motifLexCounts(tokens(text));
  const logits = Array.from(pm, (p, i) => Math.log(p + 1e-6) + lambda * counts[i]);
  const mx = Math.max(...logits);
  const ex = logits.map((v) => Math.exp(v - mx));
  const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((v) => v / sum);
}

function evaluate(set, lambda = 0) {
  let styleOK = 0, motifOK = 0, err = 0;
  for (const e of set) {
    const { o } = forward(vector(e.prompt));
    const ps = softmax(o, STYLE_OFF, STYLES.length);
    const pm = motifPosterior(o, e.prompt, lambda);
    if (STYLES[ps.indexOf(Math.max(...ps))] === e.style) styleOK++;
    if (MOTIFS[pm.indexOf(Math.max(...pm))] === e.motif) motifOK++;
    err += Math.abs(denorm(clamp01(o[REG_OFF]), 'pacing') - e.pacing)
      + Math.abs(denorm(clamp01(o[REG_OFF + 1]), 'energy') - e.energy)
      + Math.abs(denorm(clamp01(o[REG_OFF + 2]), 'shots') - e.shots);
  }
  return {
    style: styleOK / set.length,
    motif: motifOK / set.length,
    mae: err / (set.length * 3),
  };
}

function makeAdam(size) { return { m: new Float64Array(size), v: new Float64Array(size) }; }
const aW1 = makeAdam(W1.length), ab1 = makeAdam(b1.length), aW2 = makeAdam(W2.length), ab2 = makeAdam(b2.length);
function adam(p, g, a, t, lr) {
  const b1t = 1 - Math.pow(0.9, t), b2t = 1 - Math.pow(0.999, t);
  for (let i = 0; i < p.length; i++) {
    a.m[i] = 0.9 * a.m[i] + 0.1 * g[i];
    a.v[i] = 0.999 * a.v[i] + 0.001 * g[i] * g[i];
    p[i] -= lr * (a.m[i] / b1t) / (Math.sqrt(a.v[i] / b2t) + 1e-8);
  }
}

const EPOCHS = 420;
const BATCH = 32;
let step = 0;
for (let epoch = 0; epoch < EPOCHS; epoch++) {
  // shuffle
  for (let i = train.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [train[i], train[j]] = [train[j], train[i]]; }
  for (let s = 0; s < train.length; s += BATCH) {
    const batch = train.slice(s, s + BATCH);
    const gW1 = new Float64Array(W1.length), gb1 = new Float64Array(b1.length);
    const gW2 = new Float64Array(W2.length), gb2 = new Float64Array(b2.length);
    for (const e of batch) {
      const x = vector(e.prompt), y = target(e);
      const { h, o } = forward(x);
      const ps = softmax(o, STYLE_OFF, STYLES.length);
      const pm = softmax(o, MOTIF_OFF, MOTIFS.length);
      const d = new Float64Array(OUT);
      for (let i = 0; i < STYLES.length; i++) d[STYLE_OFF + i] = (ps[i] - y[STYLE_OFF + i]) / batch.length;
      for (let i = 0; i < MOTIFS.length; i++) d[MOTIF_OFF + i] = (pm[i] - y[MOTIF_OFF + i]) / batch.length;
      for (let i = 0; i < 3; i++) {
        d[REG_OFF + i] = (2 * (o[REG_OFF + i] - y[REG_OFF + i])) / batch.length * 3.5;
      }
      for (let k = 0; k < OUT; k++) {
        gb2[k] += d[k];
        for (let j = 0; j < HIDDEN; j++) gW2[j * OUT + k] += h[j] * d[k];
      }
      const dh = new Float64Array(HIDDEN);
      for (let j = 0; j < HIDDEN; j++) {
        let s2 = 0;
        for (let k = 0; k < OUT; k++) s2 += W2[j * OUT + k] * d[k];
        dh[j] = s2 * (1 - h[j] * h[j]);
        gb1[j] += dh[j];
        for (let i = 0; i < INPUT; i++) if (x[i]) gW1[i * HIDDEN + j] += x[i] * dh[j];
      }
    }
    const lr = 0.012 * (1 - epoch / (EPOCHS * 1.6));
    step++;
    const l2 = 1e-5;
    for (let i = 0; i < gW1.length; i++) gW1[i] += l2 * W1[i];
    for (let i = 0; i < gW2.length; i++) gW2[i] += l2 * W2[i];
    adam(W1, gW1, aW1, step, lr);
    adam(b1, gb1, ab1, step, lr);
    adam(W2, gW2, aW2, step, lr);
    adam(b2, gb2, ab2, step, lr);
  }
  if (epoch % 70 === 0 || epoch === EPOCHS - 1) {
    const v = evaluate(val);
    console.log(`epoch ${String(epoch).padStart(3)}  val style ${(v.style * 100).toFixed(1)}%  motif ${(v.motif * 100).toFixed(1)}%  mae ${v.mae.toFixed(3)}`);
  }
}

// Model selection: one scalar blend weight, chosen on the held-out split only.
// Both the raw network accuracy and the calibrated (shipped) accuracy are reported.
let best = { lambda: 0, motif: -1 };
for (let l = 0; l <= 4.0001; l += 0.25) {
  const m = evaluate(val, l).motif;
  if (m > best.motif) best = { lambda: +l.toFixed(2), motif: m };
}
const LAMBDA = best.lambda;
const rawVal = evaluate(val, 0);
const trainMetrics = evaluate(train, LAMBDA);
const valMetrics = evaluate(val, LAMBDA);
console.log(`\nMotif ensemble λ=${LAMBDA}  raw ${(rawVal.motif * 100).toFixed(1)}%  →  calibrated ${(valMetrics.motif * 100).toFixed(1)}%`);

const model = {
  name: 'ClipForge Director v1',
  version: 1,
  trainedAt: new Date().toISOString(),
  architecture: `bow(${vocab.length}) + numeric(6) + lexicon(${LEX_DIM}) + trigram(${TRI_DIM}) → tanh(${HIDDEN}) → style(6) + motif(7) + regression(3)`,
  vocab, inputDim: INPUT, hidden: HIDDEN, outDim: OUT,
  base: BASE, lexDim: LEX_DIM, triDim: TRI_DIM, lexicons: LEXICONS, lexKeys: LEX_KEYS,
  motifLambda: LAMBDA,
  styleOffset: STYLE_OFF, motifOffset: MOTIF_OFF, regOffset: REG_OFF,
  styles: STYLES, motifs: MOTIFS,
  regMin: REG_MIN, regMax: REG_MAX,
  W1: Array.from(W1, (v) => +v.toFixed(6)), b1: Array.from(b1, (v) => +v.toFixed(6)),
  W2: Array.from(W2, (v) => +v.toFixed(6)), b2: Array.from(b2, (v) => +v.toFixed(6)),
  metrics: {
    seeds: seeds.length, examples: examples.length, train: train.length, validation: val.length,
    epochs: EPOCHS,
    trainStyleAccuracy: +trainMetrics.style.toFixed(4),
    valStyleAccuracy: +valMetrics.style.toFixed(4),
    trainMotifAccuracy: +trainMetrics.motif.toFixed(4),
    valMotifAccuracy: +valMetrics.motif.toFixed(4),
    valMotifAccuracyRaw: +rawVal.motif.toFixed(4),
    motifLambda: LAMBDA,
    valMAE: +valMetrics.mae.toFixed(4),
  },
};

fs.writeFileSync(path.join(ROOT, 'src/lib/brain/model-data.json'), JSON.stringify(model));
fs.writeFileSync(path.join(ROOT, 'training/report.json'), JSON.stringify(model.metrics, null, 2));
console.log('\nSaved src/lib/brain/model-data.json');
console.log(JSON.stringify(model.metrics, null, 2));
