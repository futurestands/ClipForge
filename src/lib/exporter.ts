import type { Project, Scene } from '../types';
import { createExportAudio } from './audio';
import { sceneAt, totalDuration } from './utils';

export interface FrameContext {
  images: HTMLImageElement[];
}

export function preloadImages(project: Project): Promise<HTMLImageElement[]> {
  return Promise.all(
    project.scenes.map(
      (s) =>
        new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(img);
          img.src = s.art;
        }),
    ),
  );
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function motionParams(scene: Scene, p: number, k: number) {
  const amount = 0.05 + k * 0.16;
  switch (scene.motion) {
    case 'zoom-out': return { scale: 1 + (1 - p) * amount, dx: 0, dy: 0 };
    case 'pan-left': return { scale: 1.1, dx: 0.045 - p * 0.09, dy: 0 };
    case 'pan-right': return { scale: 1.1, dx: -0.045 + p * 0.09, dy: 0 };
    case 'drift': return { scale: 1.07, dx: Math.sin(p * Math.PI) * 0.025, dy: -p * 0.03 };
    default: return { scale: 1 + p * amount, dx: 0, dy: 0 };
  }
}

function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  scene: Scene,
  p: number,
  k: number,
  alpha: number,
  slideX = 0,
  extraScale = 1,
  opacity = 1,
) {
  if (!img.complete || !img.naturalWidth) return;
  const { scale, dx, dy } = motionParams(scene, p, k);
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * scale * extraScale * scene.scale;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const x = (w - dw) / 2 + dx * w + slideX * w;
  const y = (h - dh) / 2 + dy * h;
  ctx.save();
  ctx.globalAlpha = alpha * opacity * scene.opacity;
  if (scene.rotate) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate((scene.rotate * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
  }
  ctx.drawImage(img, x, y, dw, dh);
  ctx.restore();
}

const FILTERS: Record<string, string> = {
  none: 'none',
  vivid: 'saturate(1.45) contrast(1.08)',
  warm: 'sepia(0.28) saturate(1.2)',
  cool: 'hue-rotate(-18deg) saturate(1.1)',
  mono: 'grayscale(1) contrast(1.15)',
  faded: 'saturate(0.65) contrast(0.9) brightness(1.08)',
  noir: 'grayscale(1) contrast(1.45) brightness(0.92)',
};

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  project: Project,
  fc: FrameContext,
) {
  const { index, scene, local } = sceneAt(project.scenes, time);
  ctx.save();
  ctx.fillStyle = '#08080b';
  ctx.fillRect(0, 0, w, h);
  if (!scene) { ctx.restore(); return; }

  const k = project.motionIntensity;
  const grade = project.grade;
  const filter = FILTERS[scene.filter] || 'none';
  ctx.filter = `${filter === 'none' ? '' : `${filter} `}brightness(${grade.brightness}) contrast(${grade.contrast}) saturate(${grade.saturation})`;
  const p = Math.min(1, local / Math.max(0.01, scene.duration));
  const img = fc.images[index];
  if (img) drawImageLayer(ctx, img, w, h, scene, p, k, 1);

  const nextIdx = index + 1;
  const nextScene = project.scenes[nextIdx];
  const transLen = Math.min(0.6, scene.duration * 0.32);
  if (nextScene && local > scene.duration - transLen && fc.images[nextIdx]) {
    const t = Math.min(1, (local - (scene.duration - transLen)) / Math.max(0.01, transLen));
    switch (scene.transition) {
      case 'none':
        break;
      case 'fade':
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(0,0,0,${t})`;
        ctx.fillRect(0, 0, w, h);
        break;
      case 'slide':
        drawImageLayer(ctx, fc.images[nextIdx], w, h, nextScene, 0, k, 1, 1 - t);
        break;
      case 'zoom':
        drawImageLayer(ctx, fc.images[nextIdx], w, h, nextScene, 0, k, t, 0, 1.35 - t * 0.35);
        break;
      case 'whip':
        drawImageLayer(ctx, fc.images[nextIdx], w, h, nextScene, 0, k, t, (1 - t) * 0.35);
        ctx.fillStyle = `rgba(255,255,255,${(1 - Math.abs(t - 0.5) * 2) * 0.25})`;
        ctx.fillRect(0, 0, w, h);
        break;
      default:
        drawImageLayer(ctx, fc.images[nextIdx], w, h, nextScene, 0, k, t);
        break;
    }
  }
  ctx.filter = 'none';

  // Scene effects
  if (scene.effect === 'light-leak') {
    const g = ctx.createRadialGradient(w * 0.85, h * 0.2, 0, w * 0.85, h * 0.2, w * 0.55);
    g.addColorStop(0, 'rgba(255,168,92,0.34)');
    g.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (scene.effect === 'bokeh') {
    for (let i = 0; i < 22; i++) {
      const x = ((i * 97 + scene.seed) % 1000) / 1000 * w;
      const y = ((i * 263 + scene.seed) % 1000) / 1000 * h;
      ctx.fillStyle = `rgba(255,236,190,${0.05 + (i % 5) * 0.025})`;
      ctx.beginPath();
      ctx.arc(x, y, h * (0.008 + (i % 6) * 0.006), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (scene.effect === 'glitch') {
    for (let i = 0; i < 5; i++) {
      const y = ((i * 173 + scene.seed) % 1000) / 1000 * h;
      ctx.fillStyle = i % 2 ? 'rgba(70,230,255,0.09)' : 'rgba(255,60,140,0.09)';
      ctx.fillRect(0, y, w, h * 0.012);
    }
  } else if (scene.effect === 'grain') {
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.07})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }

  // Lower third gradient behind captions
  const lg = ctx.createLinearGradient(0, h * 0.62, 0, h);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(1, 'rgba(0,0,0,0.46)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  // Scene tag
  const tagSize = Math.max(11, Math.round(h * 0.019));
  ctx.font = `600 ${tagSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText(`AI CUT  /  SCENE ${String(index + 1).padStart(2, '0')}  ·  ${scene.beat.toUpperCase()}`, w * 0.045, h * 0.09);

  // Caption
  if (project.captions && scene.caption) {
    const fs = Math.round(h * 0.055);
    ctx.font = `800 ${fs}px "Segoe UI", Arial, sans-serif`;
    const lines = wrap(ctx, scene.caption, w * 0.82);
    const lineH = fs * 1.22;
    const totalH = lines.length * lineH;
    const cy = h * 0.8 - totalH / 2 + lineH / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      const y = cy + i * lineH;
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = h * 0.022;
      ctx.shadowOffsetY = h * 0.004;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, w / 2, y);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    });
    // accent bar
    ctx.fillStyle = '#4ee1d8';
    roundRectPath(ctx, w / 2 - fs * 0.55, cy + totalH / 2 + fs * 0.12, fs * 1.1, Math.max(3, h * 0.005), 4);
    ctx.fill();
  }

  // Overlays (text presets / stickers)
  scene.overlays.forEach((o) => {
    const size = o.size * (h / 1080);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (o.type === 'sticker') {
      ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.fillText(o.content, o.x * w, o.y * h);
    } else {
      ctx.font = `700 ${size}px "Segoe UI", Arial, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = size * 0.35;
      ctx.fillStyle = o.color;
      ctx.fillText(o.content, o.x * w, o.y * h);
      ctx.shadowBlur = 0;
    }
  });

  if (project.watermark) {
    const ws = Math.max(11, Math.round(h * 0.02));
    ctx.font = `600 ${ws}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('ClipForge AI', w * 0.97, h * 0.95);
  }
  ctx.restore();
}

export function renderPoster(project: Project, time: number): string {
  const ratio = project.aspect === '16:9' ? 16 / 9 : project.aspect === '9:16' ? 9 / 16 : project.aspect === '4:3' ? 4 / 3 : 1;
  const h = 720;
  const w = Math.round(h * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const imgs = project.scenes.map((s) => {
    const i = new Image();
    i.src = s.art;
    return i;
  });
  // Synchronous path only works for already-decoded images; retry shortly if needed.
  drawFrame(ctx, w, h, time, project, { images: imgs });
  return canvas.toDataURL('image/png');
}

export async function renderPosterAsync(project: Project, time: number): Promise<string> {
  const ratio = project.aspect === '16:9' ? 16 / 9 : project.aspect === '9:16' ? 9 / 16 : project.aspect === '4:3' ? 4 / 3 : 1;
  const h = 1080;
  const w = Math.round(h * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const images = await preloadImages(project);
  drawFrame(ctx, w, h, time, project, { images });
  return canvas.toDataURL('image/png');
}

function pickMime(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm';
}

export interface ExportConfig {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  audio: boolean;
}

/** Real-time canvas capture → WebM. The recorded file is what the preview shows. */
export async function exportWebM(project: Project, cfg: ExportConfig, onProgress: (p: number) => void): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is not supported in this browser.');
  const canvas = document.createElement('canvas');
  canvas.width = cfg.width;
  canvas.height = cfg.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  const images = await preloadImages(project);
  const stream = canvas.captureStream(cfg.fps);
  let audio: ReturnType<typeof createExportAudio> = null;
  if (cfg.audio && project.soundtrack) {
    audio = createExportAudio(project.style);
    if (audio?.track) stream.addTrack(audio.track);
  }
  const mime = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: cfg.bitrate });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const finished = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error('Recording failed.'));
  });

  const duration = totalDuration(project.scenes);
  drawFrame(ctx, cfg.width, cfg.height, 0, project, { images });
  recorder.start(200);
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const t = Math.min(elapsed, duration);
      drawFrame(ctx, cfg.width, cfg.height, t, project, { images });
      onProgress(Math.min(1, elapsed / duration));
      if (elapsed >= duration) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await finished;
  audio?.stop();
  stream.getTracks().forEach((t) => t.stop());
  return new Blob(chunks, { type: mime });
}
