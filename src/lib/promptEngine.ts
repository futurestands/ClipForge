import type {
  CloudScriptScene, DirectionPrediction, GenSettings, MotifId, MotionId, Project, Scene, StyleId, TransitionId,
} from '../types';
import { DEFAULT_GRADE, STYLE_PALETTE } from '../types';
import { detectMotif, renderSceneArt } from './art';
import { predictDirection, resolveStyle } from './brain/director';
import { buildImagePrompt, improveProject, scoreProject } from './brain/quality';
import { clamp, hashString, uid } from './utils';

/** Motifs that depict a concrete named scene and must drive every shot. */
const LITERAL_MOTIFS = new Set<MotifId>(['tea']);

/**
 * Extra inputs supplied by the Model Studio / cloud gateway.
 * Everything is optional: with no arguments the engine is 100% local and offline.
 */
export interface GenerateOptions {
  /** Pre-computed director prediction (lets the UI show it before generating). */
  direction?: DirectionPrediction;
  /** Scene copy written by a frontier LLM; overrides the template text when present. */
  scriptScenes?: CloudScriptScene[];
  /** Run the local self-critique loop on the finished cut. */
  qualityBoost?: boolean;
  /** Label shown in the shot list for provenance. */
  scriptSource?: string;
}

export const INSPIRATIONS = [
  'A cinematic 15-second video about a lone astronaut watching a sunrise over an alien ocean',
  'Neon cyberpunk city at midnight, rain on the streets, a courier racing through the crowd',
  'A calm watercolor story about a small coffee brand and slow mornings',
  '3D product launch for a futuristic wireless earbud, floating over a glass podium',
  'Documentary style: a mountain village waking up at dawn, mist over the valley',
  'Anime opening for a story about friendship, summer trains and paper planes',
];

interface StyleMeta {
  cameras: string[];
  motions: MotionId[];
  transitions: TransitionId[];
  bgm: string;
  mood: string;
}

const META: Record<StyleId, StyleMeta> = {
  cinematic: {
    cameras: ['Slow dolly push-in', 'Wide establishing shot', 'Orbit around subject', 'Low-angle tracking', 'Telephoto close-up', 'Crane reveal'],
    motions: ['zoom-in', 'drift', 'pan-right', 'zoom-out'],
    transitions: ['dissolve', 'fade', 'slide', 'zoom'],
    bgm: 'Cinematic Drones · 82 BPM · A minor',
    mood: 'widescreen, atmospheric, filmic',
  },
  anime: {
    cameras: ['Dynamic speed-line pan', 'Low-angle hero shot', 'Soft focus close-up', 'Skyward tilt', 'Whip pan'],
    motions: ['pan-left', 'pan-right', 'zoom-in', 'drift'],
    transitions: ['whip', 'slide', 'fade', 'dissolve'],
    bgm: 'J-Pop Instrumental · 128 BPM · C major',
    mood: 'vibrant, hand-drawn, expressive',
  },
  neon: {
    cameras: ['Neon-lit tracking shot', 'Reflective low angle', 'Drone descent', 'Glitch cut-in', 'Fisheye close-up'],
    motions: ['zoom-in', 'drift', 'pan-left', 'zoom-out'],
    transitions: ['whip', 'zoom', 'dissolve', 'fade'],
    bgm: 'Synthwave Pulse · 110 BPM · F minor',
    mood: 'electric, high-contrast, retro-future',
  },
  watercolor: {
    cameras: ['Gentle parallax drift', 'Soft top-down', 'Slow bloom reveal', 'Paper-texture push-in'],
    motions: ['drift', 'zoom-in', 'pan-right', 'zoom-out'],
    transitions: ['dissolve', 'fade', 'dissolve', 'none'],
    bgm: 'Warm Piano & Strings · 68 BPM · G major',
    mood: 'soft, handmade, nostalgic',
  },
  threeD: {
    cameras: ['Studio orbit', 'Macro product sweep', 'Top-down rotation', 'Hero low angle', 'Depth-of-field rack'],
    motions: ['zoom-in', 'drift', 'pan-left', 'zoom-out'],
    transitions: ['zoom', 'dissolve', 'slide', 'fade'],
    bgm: 'Minimal Electronic · 96 BPM · D minor',
    mood: 'clean, glossy, ray-traced',
  },
  doc: {
    cameras: ['Handheld observational', 'Static wide', 'Slow gimbal walk', 'Natural-light close-up'],
    motions: ['drift', 'pan-right', 'zoom-in', 'pan-left'],
    transitions: ['fade', 'dissolve', 'none', 'fade'],
    bgm: 'Ambient Field Recordings · 72 BPM · neutral',
    mood: 'natural, honest, unpolished',
  },
};

const VARIANTS: Record<StyleId, string[][]> = {
  cinematic: [STYLE_PALETTE.cinematic, ['#0b1226', '#2a3d6b', '#a05b7a', '#ffd6b0'], ['#071d1c', '#1f5b53', '#d79a52', '#f4e2b8']],
  anime: [STYLE_PALETTE.anime, ['#8fd0ff', '#dff3ff', '#ff8fb1', '#ffe9a8'], ['#5f8fe0', '#a9c8ff', '#ffc36e', '#fff2cf']],
  neon: [STYLE_PALETTE.neon, ['#08061c', '#2b0f6b', '#8b5cff', '#39ffd0'], ['#120520', '#5a0a3c', '#ff5b5b', '#ffd166']],
  watercolor: [STYLE_PALETTE.watercolor, ['#f7eede', '#e5a6a0', '#a8c3b4', '#c9b1dc'], ['#f3e3cf', '#d9b48a', '#a6b9c9', '#e7c2b8']],
  threeD: [STYLE_PALETTE.threeD, ['#0e1526', '#394a86', '#a7e0ff', '#ffb3c1'], ['#101820', '#2e5d63', '#9ff0d8', '#ffd8a8']],
  doc: [STYLE_PALETTE.doc, ['#101c20', '#3c514c', '#b5c9b2', '#e3cba6'], ['#151d26', '#42566b', '#c3d0d6', '#e8d6bd']],
};

const STOPWORDS = new Set([
  'the', 'and', 'with', 'that', 'this', 'from', 'about', 'into', 'over', 'under', 'for', 'are', 'was', 'were',
  'make', 'create', 'generate', 'video', 'clip', 'seconds', 'second', 'style', 'cinematic', 'please', 'show',
  'shot', 'scene', 'using', 'where', 'while', 'then', 'some', 'very', 'look', 'like', 'feel', 'their', 'they',
  'through', 'after', 'before', 'between', 'small', 'large', 'short', 'long', 'want', 'need', 'give', 'also',
]);

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function analyse(prompt: string) {
  const raw = prompt.trim().replace(/\s+/g, ' ') || 'A story worth telling';
  const seed = hashString(raw.toLowerCase());
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const unique: string[] = [];
  words.forEach((w) => { if (!unique.includes(w)) unique.push(w); });
  const kws = (unique.length ? unique : ['story', 'moment', 'light', 'motion', 'detail']).slice(0, 8);
  const subject = raw.length > 76 ? `${raw.slice(0, 73).trim()}…` : raw;
  const short = titleCase(kws.slice(0, 3).join(' ')) || 'New Story';
  return { seed, kws, subject, short };
}

const BEATS = ['Hook', 'Setup', 'Story', 'Story', 'Climax', 'Outro'];

const NARRATION: Record<string, string[]> = {
  Hook: [
    'It begins with {subject}.',
    'Everything starts with a single moment — {subject}.',
    'Look closer. {subject} is not what it seems.',
    'There is a story hiding inside {subject}.',
  ],
  Setup: [
    'At first, all you notice is {kw1}, quiet and unassuming.',
    'The camera settles in, and {kw2} slowly comes into focus.',
    'We follow the light as it finds its way across {kw1}.',
    'Before anything else, there is the simple rhythm of {kw2}.',
  ],
  Story: [
    'Then {kw2} begins to move, and the whole frame changes with it.',
    'Layer by layer, {kw1} turns into something bigger than itself.',
    'Every detail of {kw3} has been waiting for this exact second.',
    'The pace lifts. {kw2} pulls us further into the frame.',
    'Nothing is rushed — {kw1} is allowed to breathe here.',
  ],
  Climax: [
    'And then, all at once, {kw2} opens up in front of us.',
    'This is the moment the whole story was building toward.',
    'Light, motion and {kw1} finally collide.',
    'Hold on to this frame — {kw3} will never look the same.',
  ],
  Outro: [
    'In the end, {subject} is really about the way it makes you feel.',
    'A last look at {kw1}, and the story stays with you.',
    'Some moments do not need an ending. This is one of them.',
    'Fade out on {kw2}. The rest is yours to imagine.',
  ],
};

const CAPTIONS: Record<string, string[]> = {
  Hook: ['IT STARTS HERE', 'LOOK CLOSER', '{kw1}, REIMAGINED', 'ONE MOMENT CHANGES IT ALL'],
  Setup: ['THE BEGINNING', 'A QUIET START', 'MEET {kw1}', 'SETTING THE SCENE'],
  Story: ['EVERY DETAIL MATTERS', '{kw2} IN MOTION', 'BUILT FROM LIGHT', 'GO DEEPER', 'FEEL THE RHYTHM'],
  Climax: ['THIS IS THE MOMENT', 'ALL AT ONCE', '{kw1} UNLEASHED', 'THE BIG REVEAL'],
  Outro: ['STAY WITH IT', '{kw2}, ALWAYS', 'UNTIL NEXT TIME', 'THE END IS YOURS'],
};

function pick<T>(arr: T[], n: number): T {
  return arr[Math.abs(n) % arr.length];
}

function fill(tpl: string, kws: string[], subject: string): string {
  return tpl
    .replace(/\{kw1\}/g, kws[0] || 'the moment')
    .replace(/\{kw2\}/g, kws[1] || 'the story')
    .replace(/\{kw3\}/g, kws[2] || 'the light')
    .replace(/\{subject\}/g, subject);
}

function beatFor(index: number, count: number): string {
  if (index === 0) return 'Hook';
  if (index === count - 1) return 'Outro';
  if (index === count - 2 && count >= 4) return 'Climax';
  if (index === 1) return 'Setup';
  return 'Story';
}

function durations(count: number, total: number, seed: number, energy: number): number[] {
  // High-energy cuts get punchier, more uneven shot lengths; calm cuts breathe evenly.
  const spread = 0.18 + energy * 0.5;
  const weights = Array.from({ length: count }, (_, i) =>
    1 + Math.sin(i * 2.4 + (seed % 17)) * spread * (0.6 + (((seed >> (i % 12)) % 10) / 10)),
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.round((w / sum) * total * 10) / 10);
}

interface SceneContext {
  count: number;
  settings: GenSettings;
  a: ReturnType<typeof analyse>;
  style: StyleId;
  direction: DirectionPrediction;
  promptMotif: MotifId;
  scriptScenes?: CloudScriptScene[];
}

function makeScene(index: number, duration: number, ctx: SceneContext): Scene {
  const { settings, a, style, direction, scriptScenes } = ctx;
  const meta = META[style];
  const beat = scriptScenes?.[index]?.beat || beatFor(index, ctx.count);
  const seed = (a.seed + index * 7919 + Math.round(settings.duration * 13)) >>> 0;
  const cloud = scriptScenes?.[index];

  const caption = cloud?.caption?.trim()
    ? cloud.caption.trim().slice(0, 48)
    : fill(pick(CAPTIONS[beat] ?? CAPTIONS.Story, seed >> 3), a.kws.map(titleCase), a.subject);
  const narration = cloud?.narration?.trim()
    ? cloud.narration.trim().slice(0, 220)
    : fill(pick(NARRATION[beat] ?? NARRATION.Story, seed + index), a.kws, a.subject);

  // The director predicts the dominant motif. A keyword-detected accent motif is
  // woven into some shots so the cut stays grounded in the literal prompt without
  // losing visual continuity. Literal scene motifs are the exception: when the
  // prompt names a concrete action/setting (e.g. serving tea in a kitchen),
  // blending it into only a couple of shots leaves the rest abstract, so every
  // shot uses that motif and varies its framing instead.
  const accent = ctx.promptMotif !== direction.motif &&
    (index % 3 === 2 || (direction.confidence < 0.5 && index % 2 === 1));
  const motif: MotifId = LITERAL_MOTIFS.has(ctx.promptMotif)
    ? ctx.promptMotif
    : accent ? ctx.promptMotif : direction.motif;

  const scene: Scene = {
    id: uid('scene'),
    beat,
    duration,
    caption,
    narration,
    camera: cloud?.camera?.trim() ? cloud.camera.trim().slice(0, 64) : pick(meta.cameras, seed + index * 3),
    motion: pick(meta.motions, seed + index),
    transition: pick(meta.transitions, seed + index * 5),
    palette: pick(VARIANTS[style], seed + index * 2),
    seed,
    art: '',
    motif,
    speed: 1,
    opacity: 1,
    scale: 1,
    rotate: 0,
    volume: 0.8,
    filter: 'none',
    effect: 'none',
    overlays: [],
    locked: false,
    source: 'procedural',
  };
  scene.art = renderSceneArt(scene, settings.aspect, style);
  return scene;
}

function buildScript(p: Project, settings: GenSettings, direction: DirectionPrediction, scriptSource: string): string {
  const meta = META[p.style];
  return [
    `TITLE: ${p.name.replace(/ — AI Cut$/, '')}`,
    `PROMPT: ${p.prompt}`,
    `STYLE: ${p.style} · ${meta.mood}`,
    `DIRECTION: ${direction.model} → ${direction.style}/${direction.motif} · ${direction.pacing} cuts/10s · energy ${direction.energy} · ${direction.shots} shots · confidence ${(direction.confidence * 100).toFixed(0)}%`,
    `SCRIPT: ${scriptSource}`,
    `FORMAT: ${p.aspect} · ${p.fps}fps · ${settings.resolution} · ${p.scenes.reduce((a, s) => a + s.duration, 0).toFixed(1)}s`,
    `MUSIC: ${p.bgm}`,
    '',
    ...p.scenes.map((s, i) =>
      `[SCENE ${i + 1} · ${s.beat.toUpperCase()} · ${s.duration.toFixed(1)}s]\n` +
      `CAMERA       ${s.camera}\n` +
      `VISUAL       ${s.motif} / ${s.palette[2]}\n` +
      `ON-SCREEN    ${s.caption}\n` +
      `VOICEOVER    ${s.narration}\n` +
      `IMAGE PROMPT ${s.imagePrompt ?? '—'}\n` +
      `OUTRO        ${s.transition} → next scene`,
    ),
  ].join('\n\n');
}

/** How many shots Director v1 + the requested duration should produce. */
export function planShotCount(settings: GenSettings, direction: DirectionPrediction): number {
  const requested = clamp(Math.round(settings.duration / 3), 3, 8);
  const pacingTarget = clamp(Math.round((settings.duration / 10) * clamp(direction.pacing, 1, 8)), 3, 8);
  const modelShots = clamp(direction.shots || requested, 3, 8);
  return clamp(Math.round(requested * 0.4 + pacingTarget * 0.3 + modelShots * 0.3), 3, 8);
}

/**
 * The core prompt → editable project pipeline.
 * Director v1 decides style / motif / pacing / energy / shot count, the local
 * template writer (or a cloud LLM) writes the copy, procedural art renders every
 * frame, and the critic optionally runs improvement passes before returning.
 */
export function generateProject(settings: GenSettings, options: GenerateOptions = {}): Project {
  const a = analyse(settings.prompt);
  const direction = options.direction ?? predictDirection(settings.prompt);
  const style = resolveStyle(settings.style, direction);
  const meta = META[style];
  const count = planShotCount(settings, direction);

  const ds = durations(count, settings.duration, a.seed, clamp(direction.energy, 0, 1));
  const ctx: SceneContext = {
    count,
    settings,
    a,
    style,
    direction,
    promptMotif: detectMotif(settings.prompt),
    scriptScenes: options.scriptScenes,
  };
  const scenes = ds.map((d, i) => makeScene(i, d, ctx));
  const scriptSource = options.scriptSource ?? 'ClipForge local writer + Director v1';

  const draft: Project = {
    id: uid('project'),
    name: `${a.short} — AI Cut`,
    prompt: a.subject,
    style,
    aspect: settings.aspect,
    resolution: settings.resolution,
    fps: settings.fps,
    voice: settings.voice,
    captions: settings.captions,
    soundtrack: settings.soundtrack,
    watermark: false,
    motionIntensity: settings.motionIntensity,
    scenes,
    bgm: meta.bgm,
    script: '',
    grade: { ...DEFAULT_GRADE },
    createdAt: Date.now(),
    direction,
  };

  // Attach model-ready image prompts (used by the cloud image adapter).
  const withPrompts: Project = {
    ...draft,
    scenes: draft.scenes.map((s, i) => ({ ...s, imagePrompt: buildImagePrompt(s, draft, i) })),
  };

  let final: Project;
  if (options.qualityBoost !== false) {
    const improved = improveProject(withPrompts, 3);
    final = { ...improved.project, quality: improved.report };
  } else {
    final = { ...withPrompts, quality: scoreProject(withPrompts) };
  }
  return { ...final, script: buildScript(final, settings, direction, scriptSource) };
}

export function rewriteScene(scene: Scene, project: Project): Scene {
  const a = analyse(`${project.prompt} ${scene.beat} ${Date.now()}`);
  const beat = BEATS.includes(scene.beat) ? scene.beat : 'Story';
  const seed = (a.seed + scene.seed) >>> 0;
  const next: Scene = {
    ...scene,
    seed,
    caption: fill(pick(CAPTIONS[beat], seed >> 2), a.kws.map(titleCase), a.subject),
    narration: fill(pick(NARRATION[beat], seed + 3), a.kws, a.subject),
    camera: pick(META[project.style].cameras, seed),
    motion: pick(META[project.style].motions, seed >> 4),
    palette: pick(VARIANTS[project.style], seed + 1),
  };
  next.art = renderSceneArt(next, project.aspect, project.style);
  next.imagePrompt = buildImagePrompt(next, project, 0);
  return next;
}

export function rerenderScene(scene: Scene, project: Project): Scene {
  const next = { ...scene, seed: (scene.seed * 1664525 + 1013904223) >>> 0 };
  next.art = renderSceneArt(next, project.aspect, project.style);
  return next;
}

export function uploadedScene(dataUrl: string, label: string, project: Project): Scene {
  const scene: Scene = {
    id: uid('scene'),
    beat: 'Story',
    duration: 3,
    caption: label.replace(/\.[^.]+$/, '').toUpperCase().slice(0, 40) || 'IMPORTED CLIP',
    narration: 'An imported clip added to the story.',
    camera: 'Imported media',
    motion: 'zoom-in',
    transition: 'dissolve',
    palette: VARIANTS[project.style][0],
    seed: hashString(label),
    art: dataUrl,
    motif: 'abstract',
    speed: 1,
    opacity: 1,
    scale: 1,
    rotate: 0,
    volume: 0.8,
    filter: 'none',
    effect: 'none',
    overlays: [],
    locked: false,
    source: 'upload',
  };
  return scene;
}

export function projectFromSettings(settings: GenSettings, base?: Project | null, options: GenerateOptions = {}): Project {
  const generated = generateProject(settings, options);
  if (settings.append && base) {
    const merged: Project = {
      ...base,
      scenes: [...base.scenes, ...generated.scenes],
      script: `${base.script}\n\n--- APPENDED GENERATION ---\n\n${generated.script}`,
      createdAt: Date.now(),
      direction: generated.direction,
      quality: generated.quality,
    };
    return merged;
  }
  return generated;
}
