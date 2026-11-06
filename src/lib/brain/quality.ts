import type { MotionId, Project, QualityReport, Scene, ShotScore, StyleId, MotifId } from '../../types';
import { clamp } from '../utils';

const STOP = new Set('a an the of and with about for in on at to from into over under is are was were be this that it its as by make create generate video clip film short showing show please using use seconds second minute'.split(' '));

const STYLE_LOOK: Record<StyleId, string> = {
  cinematic: 'anamorphic 35mm film still, shallow depth of field, natural film grain, dramatic chiaroscuro lighting',
  anime: 'hand-painted anime key visual, crisp linework, saturated cel colours, dramatic speed lines',
  neon: 'cyberpunk neon lighting, wet reflective surfaces, magenta and cyan rim light, high contrast',
  watercolor: 'soft watercolor on cold-press paper, bleeding pigment edges, pastel washes, gentle light',
  threeD: 'ray-traced 3D render, glossy PBR materials, studio softbox lighting, global illumination',
  doc: 'observational documentary frame, available light, natural colour, subtle handheld texture',
};

const MOTIF_LOOK: Record<MotifId, string> = {
  nature: 'layered mountain silhouettes, atmospheric haze, foreground foliage',
  city: 'dense skyline, lit windows, perspective streets, bokeh traffic lights',
  ocean: 'rolling surf, horizon glow, reflective water, sea mist',
  space: 'star field, planetary body, nebula glow, deep-space scale',
  product: 'minimal studio podium, hero object centred, rim light, clean negative space',
  people: 'human silhouettes, backlit rim light, candid composition',
  abstract: 'geometric forms, soft gradient fields, floating particles',
};

export function promptKeywords(prompt: string): string[] {
  const words = prompt.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  const unique: string[] = [];
  words.forEach((w) => { if (!unique.includes(w)) unique.push(w); });
  return unique.slice(0, 10);
}

export function buildImagePrompt(scene: Scene, project: Project, index: number): string {
  const safe = project.prompt.replace(/\s+/g, ' ').trim();
  return [
    safe,
    `— shot ${index + 1} of ${project.scenes.length}, ${scene.beat.toLowerCase()} beat, ${scene.camera.toLowerCase()}`,
    STYLE_LOOK[project.style],
    MOTIF_LOOK[scene.motif],
    `palette ${scene.palette.join(', ')}`,
    `emotional tone ${scene.narration.replace(/^[^.!?]+[.!?]?\s*/, '').slice(0, 60)}`,
    'single cinematic still frame, ultra detailed, no text, no watermark, no logo',
  ].join('. ');
}

export function bpmFromBgm(bgm: string): number {
  const m = bgm.match(/(\d{2,3})\s*BPM/i);
  return m ? Number(m[1]) : 90;
}

export function scoreProject(project: Project): QualityReport {
  const keywords = promptKeywords(project.prompt);
  const bpm = bpmFromBgm(project.bgm);
  const beat = 60 / bpm;
  const shots: ShotScore[] = project.scenes.map((s, i) => {
    // Deliberately excludes imagePrompt: it contains the verbatim prompt, so
    // including it would make every shot trivially "relevant" and defeat the critic.
    const blob = `${s.caption} ${s.narration} ${s.camera} ${s.motif}`.toLowerCase();
    const hits = keywords.filter((k) => blob.includes(k)).length;
    const relevance = keywords.length ? clamp((hits / Math.min(4, keywords.length)) * 100, 0, 100) : 70;
    const prev = project.scenes[i - 1];
    const next = project.scenes[i + 1];
    let variety = 100;
    if (prev && prev.motion === s.motion) variety -= 22;
    if (prev && prev.palette[2] === s.palette[2]) variety -= 12;
    if (next && next.camera === s.camera) variety -= 16;
    if (prev && prev.motif === s.motif && project.scenes.length > 3) variety -= 6;
    variety = clamp(variety, 0, 100);
    const words = s.caption.trim().split(/\s+/).length;
    const readability = clamp(100 - Math.max(0, s.caption.length - 38) * 2.2 - Math.max(0, words - 6) * 7, 0, 100);
    const beatError = Math.abs(s.duration / beat - Math.round(s.duration / beat));
    const pacing = clamp(100 - beatError * 45 - (s.duration < 1.2 || s.duration > 6 ? 25 : 0), 0, 100);
    const notes: string[] = [];
    if (relevance < 55) notes.push('Weak prompt grounding');
    if (variety < 70) notes.push('Repetitive motion or colour');
    if (readability < 70) notes.push('Caption too long');
    if (pacing < 70) notes.push('Cut is off the musical beat');
    const score = Math.round(relevance * 0.32 + variety * 0.24 + readability * 0.2 + pacing * 0.24);
    return { sceneId: s.id, score, relevance: Math.round(relevance), variety: Math.round(variety), readability: Math.round(readability), pacing: Math.round(pacing), notes };
  });

  const avg = (key: keyof Pick<ShotScore, 'relevance' | 'variety' | 'readability' | 'pacing'>) =>
    shots.length ? shots.reduce((a, s) => a + s[key], 0) / shots.length : 0;
  const axes = {
    relevance: Math.round(avg('relevance')),
    variety: Math.round(avg('variety')),
    coherence: Math.round(clamp(100 - Math.abs(project.scenes.length - 5) * 6, 40, 100)),
    pacing: Math.round(avg('pacing')),
    continuity: Math.round(clamp(100 - new Set(project.scenes.map((s) => s.motif)).size * 4, 55, 100)),
  };
  const overall = Math.round(axes.relevance * 0.26 + axes.variety * 0.22 + axes.coherence * 0.14 + axes.pacing * 0.2 + axes.continuity * 0.18);
  const suggestions: string[] = [];
  if (axes.relevance < 70) suggestions.push('Ground captions and narration in the exact words of your prompt.');
  if (axes.variety < 78) suggestions.push('Vary camera motion and colour between consecutive shots.');
  if (axes.pacing < 78) suggestions.push(`Snap cut points to the ${bpm} BPM beat (${beat.toFixed(2)}s).`);
  if (axes.coherence < 80) suggestions.push('Use 4–6 shots for a short-form narrative arc.');
  if (!suggestions.length) suggestions.push('Cut is balanced — ready to export.');
  const grade: QualityReport['grade'] = overall >= 90 ? 'S' : overall >= 80 ? 'A' : overall >= 68 ? 'B' : 'C';
  return { overall, grade, axes, shots, suggestions, passes: 0 };
}

const MOTION_CYCLE: MotionId[] = ['zoom-in', 'drift', 'pan-right', 'zoom-out', 'pan-left'];

/** Self-critique loop: iteratively fixes weak shots until the score stops improving. */
export function improveProject(project: Project, maxPasses = 3): { project: Project; report: QualityReport } {
  let current = project;
  let report = scoreProject(current);
  let passes = 0;
  const keywords = promptKeywords(project.prompt);
  const bpm = bpmFromBgm(project.bgm);
  const beat = 60 / bpm;
  const total = current.scenes.reduce((a, s) => a + s.duration, 0);

  for (let pass = 0; pass < maxPasses; pass++) {
    const kw = keywords[pass % Math.max(1, keywords.length)] ?? 'story';
    let scenes = current.scenes.map((s, i) => {
      const shot = report.shots[i];
      const next: Scene = { ...s };
      const blob = `${s.caption} ${s.narration}`.toLowerCase();
      if (shot.relevance < 70 && !blob.includes(kw)) {
        const title = kw.charAt(0).toUpperCase() + kw.slice(1);
        next.caption = `${title} · ${s.caption}`.slice(0, 42).trim();
        next.narration = `${s.narration} The frame keeps returning to ${kw}.`;
      }
      if (shot.readability < 75) {
        next.caption = next.caption.split(/\s+/).slice(0, 6).join(' ').toUpperCase();
      }
      if (shot.variety < 80 && i > 0 && next.motion === current.scenes[i - 1].motion) {
        next.motion = MOTION_CYCLE[(i + pass) % MOTION_CYCLE.length];
      }
      return next;
    });

    // Beat-align durations, then rescale back to the requested length.
    if (report.axes.pacing < 92) {
      const aligned = scenes.map((s) => Math.max(1.2, Math.round(s.duration / beat) * beat));
      const sum = aligned.reduce((a, b) => a + b, 0);
      scenes = scenes.map((s, i) => ({ ...s, duration: Math.round((aligned[i] / sum) * total * 10) / 10 }));
    }

    const candidate: Project = { ...current, scenes };
    const candidateReport = scoreProject(candidate);
    if (candidateReport.overall <= report.overall && pass > 0) break;
    current = candidate;
    report = candidateReport;
    passes = pass + 1;
  }
  report = { ...report, passes };
  return { project: { ...current, scenes: current.scenes.map((s, i) => ({ ...s, quality: report.shots[i]?.score ?? s.quality })) }, report };
}
