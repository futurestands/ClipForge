import type { AspectId, MotifId, Scene, StyleId } from '../types';
import { ASPECT_RATIO, STYLE_PALETTE } from '../types';
import { mulberry32 } from './utils';

type RNG = () => number;

interface Ctx {
  c: CanvasRenderingContext2D;
  w: number;
  h: number;
  seed: number;
  rng: RNG;
  palette: string[];
  r: (a: number, b: number) => number;
}

function fillLinear(g: Ctx, stops: [number, string][], vertical = true) {
  const grad = g.c.createLinearGradient(0, 0, vertical ? 0 : g.w, vertical ? g.h : 0);
  stops.forEach(([p, col]) => grad.addColorStop(p, col));
  g.c.fillStyle = grad;
  g.c.fillRect(0, 0, g.w, g.h);
}

function glow(g: Ctx, x: number, y: number, r: number, color: string, alpha = 0.65) {
  const grad = g.c.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, hexAlpha(color, alpha));
  grad.addColorStop(0.45, hexAlpha(color, alpha * 0.35));
  grad.addColorStop(1, hexAlpha(color, 0));
  g.c.save();
  g.c.globalCompositeOperation = 'screen';
  g.c.fillStyle = grad;
  g.c.fillRect(x - r, y - r, r * 2, r * 2);
  g.c.restore();
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

function tint(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const n = parseInt(full, 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (n & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function polygon(g: Ctx, points: [number, number][], color: string) {
  const c = g.c;
  c.beginPath();
  c.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => c.lineTo(x, y));
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

function mountains(g: Ctx, baseY: number, amp: number, color: string, steps = 9) {
  const pts: [number, number][] = [[0, g.h]];
  pts.push([0, baseY + g.r(-amp * 0.2, amp * 0.2)]);
  for (let i = 0; i <= steps; i++) {
    const x = (g.w / steps) * i;
    const y = baseY - Math.abs(Math.sin(i * 1.7 + g.rng() * 2)) * amp - g.r(-amp * 0.25, amp * 0.25);
    pts.push([x, y]);
  }
  pts.push([g.w, g.h]);
  polygon(g, pts, color);
}

function trees(g: Ctx, y: number, color: string, count: number) {
  const c = g.c;
  c.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = g.r(0, g.w);
    const hgt = g.r(g.h * 0.04, g.h * 0.15);
    const wd = hgt * 0.35;
    c.beginPath();
    c.moveTo(x, y - hgt);
    c.lineTo(x + wd, y);
    c.lineTo(x - wd, y);
    c.closePath();
    c.fill();
  }
}

function clouds(g: Ctx, color: string, count: number) {
  const c = g.c;
  c.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = g.r(0, g.w);
    const y = g.r(g.h * 0.06, g.h * 0.45);
    const w = g.r(g.w * 0.1, g.w * 0.3);
    const h = w * 0.12;
    c.beginPath();
    c.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    c.ellipse(x - w * 0.35, y - h * 0.35, w * 0.4, h * 0.9, 0, 0, Math.PI * 2);
    c.ellipse(x + w * 0.3, y - h * 0.3, w * 0.45, h, 0, 0, Math.PI * 2);
    c.fill();
  }
}

function stars(g: Ctx, count: number) {
  const c = g.c;
  for (let i = 0; i < count; i++) {
    const x = g.r(0, g.w);
    const y = g.r(0, g.h * 0.85);
    const s = g.r(0.4, 2.2);
    c.fillStyle = `rgba(255,255,255,${g.r(0.15, 0.9)})`;
    c.beginPath();
    c.arc(x, y, s, 0, Math.PI * 2);
    c.fill();
  }
}

function drawNature(g: Ctx) {
  const [dark, mid, warm, light] = g.palette;
  fillLinear(g, [[0, dark], [0.5, mid], [1, warm]]);
  glow(g, g.w * 0.72, g.h * 0.3, g.h * 0.42, light, 0.55);
  glow(g, g.w * 0.7, g.h * 0.34, g.h * 0.1, '#ffffff', 0.5);
  clouds(g, hexAlpha(light, 0.16), 5);
  mountains(g, g.h * 0.66, g.h * 0.2, hexAlpha(dark, 0.55), 8);
  mountains(g, g.h * 0.78, g.h * 0.15, hexAlpha(dark, 0.78), 10);
  // lake reflection
  const c = g.c;
  const refl = c.createLinearGradient(0, g.h * 0.78, 0, g.h);
  refl.addColorStop(0, hexAlpha(warm, 0.35));
  refl.addColorStop(1, hexAlpha(dark, 0.9));
  c.fillStyle = refl;
  c.fillRect(0, g.h * 0.78, g.w, g.h * 0.22);
  c.strokeStyle = hexAlpha(light, 0.16);
  for (let i = 0; i < 26; i++) {
    const y = g.h * 0.79 + (i / 26) * g.h * 0.2;
    c.lineWidth = g.r(0.6, 2);
    c.beginPath();
    c.moveTo(g.r(0, g.w), y);
    c.lineTo(g.r(0, g.w), y + 1);
    c.stroke();
  }
  trees(g, g.h * 0.8, hexAlpha(dark, 0.9), 14);
}

function drawCity(g: Ctx) {
  const [dark, mid, hot, cool] = g.palette;
  fillLinear(g, [[0, dark], [0.55, mid], [1, hot]]);
  glow(g, g.w * 0.3, g.h * 0.52, g.h * 0.5, cool, 0.35);
  const c = g.c;
  const horizon = g.h * 0.72;
  for (let layer = 0; layer < 3; layer++) {
    const alpha = 0.35 + layer * 0.25;
    let x = -20;
    while (x < g.w + 20) {
      const bw = g.r(g.w * 0.035, g.w * 0.1);
      const bh = g.r(g.h * 0.12, g.h * (0.28 + layer * 0.08));
      c.fillStyle = hexAlpha(dark, alpha);
      c.fillRect(x, horizon - bh, bw, bh + g.h * 0.2);
      if (layer === 2) {
        c.fillStyle = hexAlpha(cool, 0.45);
        for (let wy = horizon - bh + 8; wy < horizon - 6; wy += 11) {
          for (let wx = x + 5; wx < x + bw - 5; wx += 9) {
            if (g.rng() > 0.62) c.fillRect(wx, wy, 3, 4);
          }
        }
      }
      x += bw + g.r(2, 10);
    }
  }
  // road with perspective
  polygon(g, [[g.w * 0.42, horizon], [g.w * 0.58, horizon], [g.w, g.h], [0, g.h]], hexAlpha(dark, 0.85));
  c.strokeStyle = hexAlpha(hot, 0.5);
  c.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const t = i / 9;
    c.beginPath();
    c.moveTo(g.w * (0.5 - t * 0.06), g.h);
    c.lineTo(g.w * (0.5 - t * 0.02), horizon);
    c.stroke();
  }
  glow(g, g.w * 0.5, horizon, g.h * 0.18, cool, 0.3);
}

function drawOcean(g: Ctx) {
  const [dark, mid, warm, light] = g.palette;
  fillLinear(g, [[0, dark], [0.42, mid], [0.56, warm], [1, light]]);
  glow(g, g.w * 0.62, g.h * 0.44, g.h * 0.32, light, 0.55);
  const c = g.c;
  for (let i = 0; i < 16; i++) {
    const y = g.h * 0.55 + (i / 16) * g.h * 0.45;
    const amp = (i / 16) * g.h * 0.035 + 2;
    c.beginPath();
    c.moveTo(0, y);
    for (let x = 0; x <= g.w; x += 14) {
      c.lineTo(x, y + Math.sin(x * 0.012 + i * 1.4) * amp);
    }
    c.lineTo(g.w, g.h);
    c.lineTo(0, g.h);
    c.closePath();
    c.fillStyle = hexAlpha(i % 2 ? dark : mid, 0.1 + (i / 16) * 0.25);
    c.fill();
    c.strokeStyle = hexAlpha(light, 0.08 + (i / 16) * 0.12);
    c.lineWidth = 1.2;
    c.stroke();
  }
  clouds(g, hexAlpha(light, 0.1), 3);
}

function drawSpace(g: Ctx) {
  const [dark, mid, hot, cool] = g.palette;
  fillLinear(g, [[0, dark], [1, tint(dark, 18)]]);
  glow(g, g.w * 0.25, g.h * 0.3, g.h * 0.55, hot, 0.28);
  glow(g, g.w * 0.8, g.h * 0.7, g.h * 0.5, cool, 0.25);
  stars(g, 260);
  const c = g.c;
  const px = g.w * 0.68;
  const py = g.h * 0.42;
  const pr = Math.min(g.w, g.h) * 0.19;
  glow(g, px, py, pr * 2.1, cool, 0.5);
  const pg = c.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
  pg.addColorStop(0, tint(mid, 60));
  pg.addColorStop(0.6, mid);
  pg.addColorStop(1, dark);
  c.fillStyle = pg;
  c.beginPath();
  c.arc(px, py, pr, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.translate(px, py);
  c.rotate(-0.35);
  c.strokeStyle = hexAlpha(hot, 0.55);
  c.lineWidth = pr * 0.09;
  c.beginPath();
  c.ellipse(0, 0, pr * 1.65, pr * 0.34, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}

function drawProduct(g: Ctx) {
  const [dark, mid, hot, cool] = g.palette;
  fillLinear(g, [[0, tint(dark, 20)], [0.6, dark], [1, mid]]);
  glow(g, g.w * 0.5, g.h * 0.42, g.h * 0.5, hot, 0.2);
  glow(g, g.w * 0.28, g.h * 0.3, g.h * 0.4, cool, 0.22);
  const c = g.c;
  const cx = g.w * 0.5;
  const cy = g.h * 0.52;
  const r = Math.min(g.w, g.h) * 0.2;
  // podium
  c.fillStyle = hexAlpha(dark, 0.75);
  c.beginPath();
  c.ellipse(cx, g.h * 0.72, r * 1.9, r * 0.42, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = hexAlpha(mid, 0.55);
  c.fillRect(cx - r * 1.5, g.h * 0.72, r * 3, g.h * 0.06);
  // hero object
  const og = c.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.05, cx, cy, r * 1.1);
  og.addColorStop(0, tint(cool, 55));
  og.addColorStop(0.5, cool);
  og.addColorStop(1, dark);
  c.fillStyle = og;
  c.beginPath();
  c.moveTo(cx, cy - r);
  c.bezierCurveTo(cx + r, cy - r, cx + r, cy + r, cx, cy + r);
  c.bezierCurveTo(cx - r, cy + r, cx - r, cy - r, cx, cy - r);
  c.fill();
  c.strokeStyle = hexAlpha('#ffffff', 0.35);
  c.lineWidth = 2;
  c.stroke();
  // reflection
  c.save();
  c.globalAlpha = 0.18;
  c.translate(0, g.h * 1.45);
  c.scale(1, -1);
  c.fillStyle = cool;
  c.beginPath();
  c.ellipse(cx, cy, r * 0.7, r, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawPeople(g: Ctx) {
  const [dark, mid, hot, cool] = g.palette;
  fillLinear(g, [[0, dark], [0.7, mid], [1, hot]]);
  glow(g, g.w * 0.5, g.h * 0.36, g.h * 0.62, cool, 0.42);
  const c = g.c;
  const base = g.h * 0.95;
  const figures = [
    { x: g.w * 0.38, s: 1 },
    { x: g.w * 0.52, s: 0.82 },
    { x: g.w * 0.64, s: 0.66 },
  ];
  figures.forEach((f) => {
    const h = g.h * 0.55 * f.s;
    const headR = h * 0.11;
    c.fillStyle = hexAlpha(dark, 0.92);
    c.beginPath();
    c.arc(f.x, base - h + headR, headR, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(f.x - headR * 1.5, base);
    c.quadraticCurveTo(f.x - headR * 1.2, base - h * 0.55, f.x, base - h * 0.55);
    c.quadraticCurveTo(f.x + headR * 1.2, base - h * 0.55, f.x + headR * 1.5, base);
    c.closePath();
    c.fill();
    c.strokeStyle = hexAlpha(cool, 0.4);
    c.lineWidth = 2.5;
    c.stroke();
  });
  for (let i = 0; i < 30; i++) {
    c.fillStyle = hexAlpha(cool, g.r(0.05, 0.25));
    c.beginPath();
    c.arc(g.r(0, g.w), g.r(0, g.h), g.r(2, 14), 0, Math.PI * 2);
    c.fill();
  }
}

/* ------------------------------------------------------------------ *
 * Tea / kitchen motif. The generic `people` motif only draws three
 * anonymous arches, which cannot depict a named domestic action. This
 * motif draws a literal, readable scene instead: four deterministic
 * framings (wide two-shot, hands + cup, the couple, the pour) give each
 * shot in the cut a distinct place in the storyboard.
 * ------------------------------------------------------------------ */

const INK = '#3a2a22';
const CERAMIC = '#fff6e6';
const GOLD = '#ffcf85';
const SKIN = '#d9a377';

function rounded(g: Ctx, x: number, y: number, w: number, h: number, r: number, color: string | CanvasGradient) {
  const c = g.c;
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

function steam(g: Ctx, x: number, y: number, len: number, alpha = 0.6) {
  const c = g.c;
  c.save();
  c.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const ox = x + i * len * 0.12;
    c.beginPath();
    c.moveTo(ox, y);
    c.bezierCurveTo(ox - len * 0.18, y - len * 0.3, ox + len * 0.2, y - len * 0.65, ox + i * len * 0.04, y - len);
    c.strokeStyle = `rgba(255,255,255,${alpha * (i === 0 ? 1 : 0.6)})`;
    c.lineWidth = Math.max(2, len * 0.05);
    c.stroke();
  }
  c.restore();
}

function teacup(g: Ctx, x: number, y: number, s: number) {
  const c = g.c;
  c.fillStyle = hexAlpha(INK, 0.18);
  c.beginPath(); c.ellipse(x, y + s * 0.46, s * 1.02, s * 0.24, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = CERAMIC;
  c.beginPath(); c.ellipse(x, y + s * 0.4, s * 0.9, s * 0.2, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = CERAMIC;
  c.lineWidth = s * 0.13;
  c.beginPath(); c.arc(x + s * 0.56, y, s * 0.26, -Math.PI / 2, Math.PI / 2); c.stroke();
  c.fillStyle = CERAMIC;
  c.beginPath();
  c.moveTo(x - s * 0.55, y - s * 0.3);
  c.lineTo(x + s * 0.55, y - s * 0.3);
  c.quadraticCurveTo(x + s * 0.48, y + s * 0.33, x, y + s * 0.33);
  c.quadraticCurveTo(x - s * 0.48, y + s * 0.33, x - s * 0.55, y - s * 0.3);
  c.closePath(); c.fill();
  c.fillStyle = '#a9622f';
  c.beginPath(); c.ellipse(x, y - s * 0.3, s * 0.55, s * 0.13, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hexAlpha('#ffffff', 0.85);
  c.lineWidth = Math.max(1.5, s * 0.035);
  c.beginPath(); c.ellipse(x, y - s * 0.3, s * 0.55, s * 0.13, 0, 0, Math.PI * 2); c.stroke();
}

function teapot(g: Ctx, x: number, y: number, s: number) {
  const c = g.c;
  c.fillStyle = hexAlpha(INK, 0.16);
  c.beginPath(); c.ellipse(x, y + s * 0.48, s * 0.78, s * 0.14, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = CERAMIC;
  c.beginPath(); c.ellipse(x, y, s * 0.62, s * 0.46, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = hexAlpha(INK, 0.18);
  c.beginPath(); c.ellipse(x, y - s * 0.44, s * 0.36, s * 0.1, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = CERAMIC;
  c.beginPath(); c.arc(x, y - s * 0.54, s * 0.1, 0, Math.PI * 2); c.fill();
  c.strokeStyle = CERAMIC;
  c.lineCap = 'round';
  c.lineWidth = s * 0.15;
  c.beginPath();
  c.moveTo(x - s * 0.55, y - s * 0.08);
  c.quadraticCurveTo(x - s * 1.0, y - s * 0.14, x - s * 1.12, y + s * 0.1);
  c.stroke();
  c.lineWidth = s * 0.12;
  c.beginPath(); c.arc(x + s * 0.64, y - s * 0.05, s * 0.27, -Math.PI / 2, Math.PI / 2); c.stroke();
}

function figure(g: Ctx, x: number, base: number, h: number, opts: { arm?: 'offer' | 'receive'; smile?: boolean } = {}) {
  const c = g.c;
  const headR = h * 0.115;
  const headY = base - h + headR;
  c.fillStyle = INK;
  c.beginPath();
  c.moveTo(x - headR * 1.85, base);
  c.quadraticCurveTo(x - headR * 1.7, base - h * 0.5, x - headR * 0.8, base - h * 0.62);
  c.lineTo(x + headR * 0.8, base - h * 0.62);
  c.quadraticCurveTo(x + headR * 1.7, base - h * 0.5, x + headR * 1.85, base);
  c.closePath(); c.fill();
  c.beginPath(); c.arc(x, headY, headR, 0, Math.PI * 2); c.fill();
  // warm rim light from the window
  c.strokeStyle = hexAlpha(GOLD, 0.8);
  c.lineWidth = Math.max(2, headR * 0.12);
  c.beginPath(); c.arc(x, headY, headR * 1.02, Math.PI * 1.05, Math.PI * 1.9); c.stroke();
  if (opts.smile) {
    c.strokeStyle = hexAlpha(CERAMIC, 0.9);
    c.lineWidth = Math.max(1.5, headR * 0.09);
    c.beginPath(); c.arc(x + headR * 0.1, headY + headR * 0.08, headR * 0.42, 0.2, Math.PI - 0.2); c.stroke();
  }
  if (opts.arm) {
    const dir = opts.arm === 'offer' ? 1 : -1;
    const sy = base - h * 0.52;
    c.strokeStyle = INK;
    c.lineCap = 'round';
    c.lineWidth = headR * 0.62;
    c.beginPath();
    c.moveTo(x + dir * headR * 1.2, sy);
    c.quadraticCurveTo(x + dir * headR * 2.6, sy + h * 0.1, x + dir * headR * 3.3, sy + h * 0.02);
    c.stroke();
  }
}

function kitchenWindow(g: Ctx, x: number, y: number, w: number, h: number) {
  const c = g.c;
  const wg = c.createLinearGradient(x, y, x, y + h);
  wg.addColorStop(0, hexAlpha('#fff6df', 0.95));
  wg.addColorStop(1, hexAlpha(GOLD, 0.75));
  rounded(g, x, y, w, h, w * 0.02, wg);
  // light spilling across the room
  c.save();
  c.globalCompositeOperation = 'screen';
  polygon(g, [[x, y + h * 0.85], [x + w, y + h * 0.85], [x + w * 2.1, g.h], [x - w * 0.6, g.h]], hexAlpha(GOLD, 0.14));
  c.restore();
  // mullions
  c.strokeStyle = hexAlpha(INK, 0.5);
  c.lineWidth = Math.max(3, w * 0.018);
  c.beginPath();
  c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h);
  c.moveTo(x, y + h * 0.5); c.lineTo(x + w, y + h * 0.5);
  c.stroke();
  c.strokeRect(x, y, w, h);
  // soft foliage outside
  for (let i = 0; i < 9; i++) {
    c.fillStyle = hexAlpha('#8aa87c', 0.18);
    c.beginPath();
    c.ellipse(g.r(x, x + w), g.r(y + h * 0.6, y + h), g.r(w * 0.05, w * 0.14), g.r(h * 0.04, h * 0.1), 0, 0, Math.PI * 2);
    c.fill();
  }
}

function drawTea(g: Ctx) {
  const [dark, mid, hot] = g.palette;
  const c = g.c;
  // A well-mixed hash of the scene seed, not the first RNG draw: mulberry32's
  // first output clusters for seeds spaced 7919 apart, which used to repeat the
  // same framing in consecutive shots.
  const frame = (Math.imul(g.seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0) % 4;

  // Warm kitchen wash, independent of the (sometimes pastel) style palette.
  fillLinear(g, [[0, hexAlpha(mid, 0.5)], [0.55, hot], [1, dark]]);
  glow(g, g.w * 0.24, g.h * 0.28, g.h * 0.8, GOLD, 0.5);

  if (frame === 0) {
    // WIDE — sunlit kitchen, two figures, he offers the cup.
    kitchenWindow(g, g.w * 0.06, g.h * 0.08, g.w * 0.31, g.h * 0.52);
    const tableY = g.h * 0.75;
    figure(g, g.w * 0.4, tableY + g.h * 0.05, g.h * 0.58, { arm: 'offer' });
    figure(g, g.w * 0.73, tableY + g.h * 0.05, g.h * 0.5, { smile: true });
    c.fillStyle = hexAlpha(INK, 0.62);
    c.fillRect(0, tableY, g.w, g.h - tableY);
    rounded(g, 0, tableY - g.h * 0.025, g.w, g.h * 0.035, 5, hexAlpha('#a06c40', 0.95));
    teapot(g, g.w * 0.17, tableY - g.h * 0.09, g.h * 0.11);
    teacup(g, g.w * 0.55, tableY - g.h * 0.055, g.h * 0.13);
    steam(g, g.w * 0.55, tableY - g.h * 0.15, g.h * 0.24);
    // pendant lamp
    c.strokeStyle = hexAlpha(INK, 0.5);
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(g.w * 0.88, 0); c.lineTo(g.w * 0.88, g.h * 0.16); c.stroke();
    c.fillStyle = hexAlpha(INK, 0.7);
    c.beginPath(); c.ellipse(g.w * 0.88, g.h * 0.19, g.w * 0.045, g.h * 0.035, 0, 0, Math.PI * 2); c.fill();
    glow(g, g.w * 0.88, g.h * 0.22, g.h * 0.28, GOLD, 0.4);
  } else if (frame === 1) {
    // CLOSE-UP — his hands offer the saucer, hers receive it, steam in the light.
    kitchenWindow(g, g.w * 0.58, g.h * 0.02, g.w * 0.36, g.h * 0.42);
    const cupY = g.h * 0.66;
    const s = g.h * 0.19;
    const tableY = g.h * 0.84;
    c.fillStyle = hexAlpha(INK, 0.5);
    c.fillRect(0, tableY, g.w, g.h - tableY);
    rounded(g, 0, tableY - g.h * 0.02, g.w, g.h * 0.03, 5, hexAlpha('#a06c40', 0.95));
    // Sleeves reaching in from both sides of frame.
    c.strokeStyle = hexAlpha(INK, 0.88);
    c.lineCap = 'round';
    c.lineWidth = g.h * 0.075;
    c.beginPath();
    c.moveTo(-g.w * 0.02, g.h * 0.99);
    c.quadraticCurveTo(g.w * 0.16, g.h * 0.86, g.w * 0.39, cupY + s * 0.4);
    c.stroke();
    c.beginPath();
    c.moveTo(g.w * 1.02, g.h * 0.99);
    c.quadraticCurveTo(g.w * 0.84, g.h * 0.89, g.w * 0.61, cupY + s * 0.44);
    c.stroke();
    // Palms under the saucer.
    c.fillStyle = SKIN;
    c.beginPath(); c.ellipse(g.w * 0.39, cupY + s * 0.36, s * 0.42, s * 0.19, -0.22, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(g.w * 0.61, cupY + s * 0.4, s * 0.42, s * 0.19, 0.22, 0, Math.PI * 2); c.fill();
    teacup(g, g.w * 0.5, cupY, s);
    steam(g, g.w * 0.5, cupY - s * 0.36, g.h * 0.4, 0.72);
  } else if (frame === 2) {
    // TWO-SHOT — the couple, her quiet smile, the cup between them.
    kitchenWindow(g, g.w * 0.02, g.h * 0.04, g.w * 0.26, g.h * 0.46);
    glow(g, g.w * 0.78, g.h * 0.3, g.h * 0.6, GOLD, 0.35);
    figure(g, g.w * 0.31, g.h * 1.14, g.h * 1.02, { arm: 'offer' });
    figure(g, g.w * 0.69, g.h * 1.14, g.h * 0.95, { smile: true });
    teacup(g, g.w * 0.5, g.h * 0.9, g.h * 0.1);
    steam(g, g.w * 0.5, g.h * 0.83, g.h * 0.3, 0.45);
  } else {
    // DETAIL — tea poured from the pot into the cup.
    kitchenWindow(g, g.w * 0.6, g.h * 0.04, g.w * 0.34, g.h * 0.44);
    const tableY = g.h * 0.78;
    const px = g.w * 0.52;
    const py = g.h * 0.34;
    const s = g.h * 0.17;
    teapot(g, px, py, s);
    const spoutX = px - s * 1.12;
    const spoutY = py + s * 0.1;
    const cupX = spoutX - g.w * 0.02;
    const cupY = tableY - g.h * 0.07;
    c.strokeStyle = hexAlpha('#c98545', 0.9);
    c.lineWidth = Math.max(3, s * 0.075);
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(spoutX, spoutY);
    c.quadraticCurveTo(spoutX - s * 0.1, (spoutY + cupY) / 2, cupX, cupY - g.h * 0.02);
    c.stroke();
    c.fillStyle = hexAlpha(INK, 0.62);
    c.fillRect(0, tableY, g.w, g.h - tableY);
    rounded(g, 0, tableY - g.h * 0.025, g.w, g.h * 0.035, 5, hexAlpha('#a06c40', 0.95));
    teacup(g, cupX, cupY, g.h * 0.14);
    steam(g, cupX, cupY - g.h * 0.15, g.h * 0.22, 0.5);
  }

  // Warm bokeh dust in the window light.
  for (let i = 0; i < 24; i++) {
    c.fillStyle = hexAlpha(GOLD, g.r(0.06, 0.28));
    c.beginPath();
    c.arc(g.r(0, g.w), g.r(0, g.h), g.r(2, 11), 0, Math.PI * 2);
    c.fill();
  }
}

function drawAbstract(g: Ctx) {
  const [dark, mid, hot, cool] = g.palette;
  fillLinear(g, [[0, dark], [1, mid]]);
  const c = g.c;
  for (let i = 0; i < 16; i++) {
    const x = g.r(0, g.w);
    const y = g.r(0, g.h);
    const r = g.r(g.h * 0.08, g.h * 0.45);
    glow(g, x, y, r, i % 2 ? hot : cool, 0.16);
  }
  c.save();
  c.globalCompositeOperation = 'screen';
  for (let i = 0; i < 7; i++) {
    c.strokeStyle = hexAlpha(i % 2 ? cool : hot, 0.25);
    c.lineWidth = g.r(1, 4);
    c.beginPath();
    c.arc(g.w * 0.5, g.h * 0.5, g.r(g.h * 0.12, g.h * 0.6), g.r(0, 6), g.r(1, 5));
    c.stroke();
  }
  c.restore();
  for (let i = 0; i < 26; i++) {
    c.fillStyle = hexAlpha('#ffffff', g.r(0.08, 0.4));
    const s = g.r(2, 7);
    c.fillRect(g.r(0, g.w), g.r(0, g.h), s, s);
  }
}

function styleFinish(g: Ctx, style: StyleId) {
  const c = g.c;
  const [dark, mid, hot, cool] = g.palette;
  if (style === 'anime') {
    clouds(g, hexAlpha('#ffffff', 0.5), 4);
    c.save();
    c.globalCompositeOperation = 'screen';
    c.strokeStyle = hexAlpha('#ffffff', 0.18);
    c.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const y = g.r(0, g.h);
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(g.w, y - g.r(0, 40));
      c.stroke();
    }
    c.restore();
    for (let i = 0; i < 40; i++) {
      const x = g.r(0, g.w);
      const y = g.r(0, g.h);
      const s = g.r(2, 7);
      c.fillStyle = hexAlpha('#fff6c9', 0.75);
      c.beginPath();
      c.moveTo(x, y - s);
      c.lineTo(x + s * 0.3, y);
      c.lineTo(x, y + s);
      c.lineTo(x - s * 0.3, y);
      c.fill();
    }
  } else if (style === 'neon') {
    c.save();
    c.globalCompositeOperation = 'screen';
    c.strokeStyle = hexAlpha(cool, 0.22);
    c.lineWidth = 1.5;
    const horizon = g.h * 0.62;
    for (let i = -12; i <= 12; i++) {
      c.beginPath();
      c.moveTo(g.w * 0.5 + i * 12, horizon);
      c.lineTo(g.w * 0.5 + i * g.w * 0.12, g.h);
      c.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const y = horizon + Math.pow(i / 12, 2) * (g.h - horizon);
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(g.w, y);
      c.stroke();
    }
    c.restore();
    glow(g, g.w * 0.5, horizon, g.h * 0.3, hot, 0.3);
    c.fillStyle = hexAlpha('#000000', 0.04);
    for (let y = 0; y < g.h; y += 4) c.fillRect(0, y, g.w, 1);
  } else if (style === 'watercolor') {
    c.save();
    c.globalAlpha = 0.2;
    c.filter = 'blur(26px)';
    for (let i = 0; i < 12; i++) {
      c.fillStyle = i % 2 ? hot : cool;
      c.beginPath();
      c.ellipse(g.r(0, g.w), g.r(0, g.h), g.r(g.w * 0.08, g.w * 0.28), g.r(g.h * 0.05, g.h * 0.2), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    c.fillStyle = hexAlpha('#ffffff', 0.2);
    c.fillRect(0, 0, g.w, g.h);
  } else if (style === 'threeD') {
    for (let i = 0; i < 3; i++) {
      const x = g.r(g.w * 0.1, g.w * 0.9);
      const y = g.r(g.h * 0.15, g.h * 0.8);
      const r = g.r(g.h * 0.04, g.h * 0.1);
      glow(g, x, y, r * 2, cool, 0.25);
      const sg = c.createRadialGradient(x - r * 0.4, y - r * 0.5, 1, x, y, r);
      sg.addColorStop(0, '#ffffff');
      sg.addColorStop(0.3, tint(cool, 30));
      sg.addColorStop(1, dark);
      c.fillStyle = sg;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  } else if (style === 'doc') {
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = hexAlpha(mid, 0.18);
    c.fillRect(0, 0, g.w, g.h);
    c.restore();
    glow(g, g.w * 0.2, g.h * 0.2, g.h * 0.4, '#ffffff', 0.12);
  } else {
    // cinematic: anamorphic streak + haze
    c.save();
    c.globalCompositeOperation = 'screen';
    const streak = c.createLinearGradient(0, g.h * 0.38, 0, g.h * 0.48);
    streak.addColorStop(0, hexAlpha(cool, 0));
    streak.addColorStop(0.5, hexAlpha(cool, 0.13));
    streak.addColorStop(1, hexAlpha(cool, 0));
    c.fillStyle = streak;
    c.fillRect(0, g.h * 0.38, g.w, g.h * 0.1);
    c.restore();
  }
  // film grain
  c.save();
  for (let i = 0; i < 2400; i++) {
    c.fillStyle = `rgba(255,255,255,${g.r(0, 0.055)})`;
    c.fillRect(g.r(0, g.w), g.r(0, g.h), 1.2, 1.2);
  }
  c.restore();
  // vignette
  const vg = c.createRadialGradient(g.w / 2, g.h / 2, Math.min(g.w, g.h) * 0.25, g.w / 2, g.h / 2, Math.max(g.w, g.h) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  c.fillStyle = vg;
  c.fillRect(0, 0, g.w, g.h);
}

/** Deterministic, procedural still frame for a scene. Returns a PNG data URL. */
export function renderSceneArt(scene: Pick<Scene, 'seed' | 'palette' | 'motif'>, aspect: AspectId, style: StyleId): string {
  const ratio = ASPECT_RATIO[aspect];
  const w = 960;
  const h = Math.round(960 / ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) return '';
  const rng = mulberry32(scene.seed);
  const base = STYLE_PALETTE[style];
  const palette = scene.palette?.length === 4 ? scene.palette : base;
  const g: Ctx = { c, w, h, seed: scene.seed, rng, palette, r: (a, b) => a + rng() * (b - a) };
  switch (scene.motif) {
    case 'nature': drawNature(g); break;
    case 'city': drawCity(g); break;
    case 'ocean': drawOcean(g); break;
    case 'space': drawSpace(g); break;
    case 'product': drawProduct(g); break;
    case 'people': drawPeople(g); break;
    case 'tea': drawTea(g); break;
    default: drawAbstract(g); break;
  }
  styleFinish(g, style);
  return canvas.toDataURL('image/jpeg', 0.86);
}

export function detectMotif(prompt: string): MotifId {
  const p = prompt.toLowerCase();
  const rules: [MotifId, RegExp][] = [
    // Literal domestic scenes must win before the generic people/abstract rules.
    // \b avoids matching "tea" inside "steam".
    ['tea', /\btea\b|teacup|teapot|saucer|kitchen|breakfast|pouring|coffee|cup of/],
    ['space', /space|galaxy|planet|cosmos|astronaut|star|universe|nebula|sci-?fi|future|rocket/],
    ['ocean', /ocean|sea|beach|wave|surf|water|island|coast|sailing|marine/],
    ['city', /city|urban|street|tokyo|new york|skyline|night life|traffic|building|neon|cyber|metropolis/],
    ['nature', /mountain|forest|nature|sunset|sunrise|valley|landscape|desert|river|tree|wild|snow|hiking/],
    ['product', /product|brand|launch|commercial|sneaker|bottle|phone|watch|perfume|advert|packshot|gadget/],
    ['people', /people|person|portrait|dancer|team|family|friend|human|silhouette|athlete|couple/],
  ];
  for (const [id, re] of rules) if (re.test(p)) return id;
  return 'abstract';
}

export function stylePreview(style: StyleId): string {
  const [a, b, c, d] = STYLE_PALETTE[style];
  return `linear-gradient(135deg, ${a} 0%, ${b} 45%, ${c} 78%, ${d} 100%)`;
}
