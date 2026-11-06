import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Captions, Clapperboard, Copy, Download, Magnet, Music2, Plus, Scissors, Sparkles, Trash2, ZoomIn, ZoomOut,
} from 'lucide-react';
import type { Project } from '../types';
import { clamp, formatClock, totalDuration } from '../lib/utils';
import { IconBtn } from './ui';

interface Props {
  project: Project | null;
  time: number;
  selectedSceneId: string | null;
  zoom: number;
  onZoom: (v: number) => void;
  onSeek: (t: number) => void;
  onSelect: (id: string) => void;
  onResize: (id: string, duration: number) => void;
  onReorder: (from: number, to: number) => void;
  onSplit: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  snap: boolean;
  onToggleSnap: () => void;
  onOpenAI: () => void;
  onOpenExport: () => void;
}

const RULER_H = 28;
const VIDEO_H = 78;
const CAPTION_H = 36;
const AUDIO_H = 38;

interface Drag {
  kind: 'resize' | 'move' | 'playhead';
  id?: string;
  index?: number;
  startX: number;
  curX: number;
  origDuration: number;
  px: number;
  avg: number;
}

export default function Timeline({
  project, time, selectedSceneId, zoom, onZoom, onSeek, onSelect, onResize, onReorder,
  onSplit, onDelete, onDuplicate, snap, onToggleSnap, onOpenAI, onOpenExport,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [, setTick] = useState(0);
  const cbRef = useRef({ onResize, onReorder, onSeek });
  cbRef.current = { onResize, onReorder, onSeek };

  const total = project ? totalDuration(project.scenes) : 0;
  const contentWidth = Math.max(900, (total + 3) * zoom);
  const avg = project && project.scenes.length ? (total / project.scenes.length) * zoom : 100;

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = { ...d, curX: e.clientX };
      if (d.kind === 'playhead') {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) cbRef.current.onSeek(clamp((e.clientX - rect.left) / d.px, 0, total + 2));
      }
      setTick((t) => t + 1);
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      if (d.kind === 'resize' && d.id) {
        cbRef.current.onResize(d.id, clamp(d.origDuration + dx / d.px, 0.5, 12));
      } else if (d.kind === 'move' && d.index !== undefined && Math.abs(dx) > 6) {
        const target = clamp(d.index + Math.round(dx / Math.max(40, d.avg)), 0, (project?.scenes.length ?? 1) - 1);
        if (target !== d.index) cbRef.current.onReorder(d.index, target);
      } else if (d.kind === 'playhead') {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) cbRef.current.onSeek(clamp((e.clientX - rect.left) / d.px, 0, total));
      }
      dragRef.current = null;
      setTick((t) => t + 1);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [total, project?.scenes.length]);

  const startRuler = (e: ReactPointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t = clamp((e.clientX - rect.left) / zoom, 0, total);
    onSeek(t);
    dragRef.current = { kind: 'playhead', startX: e.clientX, curX: e.clientX, origDuration: 0, px: zoom, avg };
  };

  const startClip = (e: ReactPointerEvent, id: string, index: number, duration: number) => {
    e.stopPropagation();
    onSelect(id);
    const target = e.target as HTMLElement;
    const isHandle = target.classList.contains('clip-handle');
    dragRef.current = {
      kind: isHandle ? 'resize' : 'move',
      id,
      index,
      startX: e.clientX,
      curX: e.clientX,
      origDuration: duration,
      px: zoom,
      avg,
    };
  };

  const drag = dragRef.current;
  const ticks: number[] = [];
  for (let t = 0; t <= Math.ceil(total) + 2; t++) ticks.push(t);
  const labelEvery = zoom < 45 ? 10 : 5;

  let acc = 0;
  const positioned = project?.scenes.map((s, i) => {
    const start = acc;
    acc += s.duration;
    return { scene: s, index: i, start };
  }) ?? [];

  return (
    <section className="timeline">
      <div className="tl-toolbar">
        <div className="tl-toolbar-left">
          <span className="tl-title">Timeline</span>
          <span className="tl-duration">{formatClock(total)} total</span>
        </div>
        <div className="tl-toolbar-center">
          <IconBtn title="Zoom out" onClick={() => onZoom(clamp(zoom - 12, 28, 150))}><ZoomOut size={15} /></IconBtn>
          <input
            className="tl-zoom"
            type="range"
            min={28}
            max={150}
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
          />
          <IconBtn title="Zoom in" onClick={() => onZoom(clamp(zoom + 12, 28, 150))}><ZoomIn size={15} /></IconBtn>
        </div>
        <div className="tl-toolbar-right">
          <IconBtn title="Snapping" active={snap} onClick={onToggleSnap}><Magnet size={15} /></IconBtn>
          <div className="tl-sep" />
          <button type="button" className="mini-btn" disabled={!selectedSceneId} onClick={onSplit}><Scissors size={13} /> Split <kbd>S</kbd></button>
          <IconBtn title="Duplicate clip (Ctrl+D)" disabled={!selectedSceneId} onClick={() => selectedSceneId && onDuplicate(selectedSceneId)}><Copy size={15} /></IconBtn>
          <IconBtn title="Delete clip (Del)" disabled={!selectedSceneId} onClick={() => selectedSceneId && onDelete(selectedSceneId)}><Trash2 size={15} /></IconBtn>
          <div className="tl-sep" />
          <button type="button" className="mini-btn accent" onClick={onOpenAI}><Sparkles size={13} /> New AI cut</button>
          <button type="button" className="mini-btn" onClick={onOpenExport} disabled={!project}><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="tl-body">
        <div className="tl-labels">
          <div className="tl-label ruler-label" style={{ height: RULER_H }} />
          <div className="tl-label" style={{ height: VIDEO_H }}><Clapperboard size={14} /><span>Video</span><Plus size={12} className="label-plus" /></div>
          <div className="tl-label" style={{ height: CAPTION_H }}><Captions size={14} /><span>Text</span></div>
          <div className="tl-label" style={{ height: AUDIO_H }}><Music2 size={14} /><span>Audio</span></div>
        </div>

        <div className="tl-scroll">
          <div className="tl-canvas" ref={canvasRef} style={{ width: contentWidth }}>
            <div className="tl-ruler" style={{ height: RULER_H }} onPointerDown={startRuler}>
              {ticks.map((t) => (
                <div key={t} className={`tl-tick${t % labelEvery === 0 ? ' major' : ''}`} style={{ left: t * zoom }}>
                  {t % labelEvery === 0 && <span>{formatClock(t)}</span>}
                </div>
              ))}
            </div>

            <div className="tl-track video-track" style={{ height: VIDEO_H }}>
              {positioned.map(({ scene, index, start }) => {
                const isDragging = drag?.kind === 'resize' && drag.id === scene.id;
                const moving = drag?.kind === 'move' && drag.index === index;
                const duration = isDragging ? clamp(drag.origDuration + (drag.curX - drag.startX) / drag.px, 0.5, 12) : scene.duration;
                return (
                  <div
                    key={scene.id}
                    className={`clip${selectedSceneId === scene.id ? ' selected' : ''}${scene.locked ? ' locked' : ''}`}
                    style={{
                      left: start * zoom,
                      width: Math.max(24, duration * zoom),
                      transform: moving ? `translateX(${drag!.curX - drag!.startX}px)` : undefined,
                      zIndex: moving ? 8 : undefined,
                    }}
                    onPointerDown={(e) => startClip(e, scene.id, index, scene.duration)}
                    title={`${scene.caption} · ${scene.camera}`}
                  >
                    <div className="clip-bg" style={{ backgroundImage: `url(${scene.art})` }} />
                    <div className="clip-top">
                      <span className="clip-index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="clip-name">{scene.caption}</span>
                    </div>
                    <div className="clip-bottom">
                      <span>{scene.motion}</span><span>{duration.toFixed(1)}s</span>
                    </div>
                    {scene.transition !== 'none' && <span className="clip-transition" title={`${scene.transition} transition`} />}
                    <span className="clip-handle" />
                  </div>
                );
              })}
              {!project && <div className="tl-empty">No clips yet — open AI Studio to generate a video from a prompt.</div>}
            </div>

            <div className="tl-track caption-track" style={{ height: CAPTION_H }}>
              {positioned.map(({ scene, start, index }) => (
                <button
                  key={scene.id}
                  type="button"
                  className={`caption-clip${selectedSceneId === scene.id ? ' selected' : ''}`}
                  style={{ left: start * zoom, width: Math.max(24, scene.duration * zoom) }}
                  onClick={() => onSelect(scene.id)}
                  title={scene.caption}
                >
                  <span className="cc-dot" />{scene.caption || `Scene ${index + 1}`}
                </button>
              ))}
            </div>

            <div className="tl-track audio-track" style={{ height: AUDIO_H }}>
              {project && (
                <div className="bgm-clip" style={{ width: Math.max(24, total * zoom) }}>
                  <span className="wave" /> {project.bgm}
                </div>
              )}
              {positioned.map(({ scene, start }) => (
                <div key={scene.id} className="voice-clip" style={{ left: start * zoom, width: Math.max(24, scene.duration * zoom) }} title={scene.narration}>
                  {scene.narration.slice(0, 22)}
                </div>
              ))}
            </div>

            <div className="tl-playhead" style={{ left: time * zoom }}>
              <span className="playhead-cap" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
