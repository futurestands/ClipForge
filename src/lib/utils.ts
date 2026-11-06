import type { Scene } from '../types';

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatTime(t: number): string {
  const sec = Math.max(0, t);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function formatClock(t: number): string {
  const sec = Math.max(0, Math.floor(t));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

export function totalDuration(scenes: Scene[]): number {
  return scenes.reduce((a, s) => a + s.duration, 0);
}

export function sceneAt(scenes: Scene[], time: number): { index: number; scene: Scene | null; start: number; local: number } {
  let acc = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (time < acc + s.duration || i === scenes.length - 1) {
      return { index: i, scene: s, start: acc, local: Math.max(0, time - acc) };
    }
    acc += s.duration;
  }
  return { index: -1, scene: null, start: 0, local: 0 };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadText(text: string, filename: string, type = 'text/plain') {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}

function srtTime(t: number): string {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mm).padStart(3, '0')}`;
}

export function srtFromScenes(scenes: Scene[]): string {
  let acc = 0;
  return scenes
    .map((s, i) => {
      const line = `${i + 1}\n${srtTime(acc)} --> ${srtTime(acc + s.duration)}\n${s.caption}\n`;
      acc += s.duration;
      return line;
    })
    .join('\n');
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
