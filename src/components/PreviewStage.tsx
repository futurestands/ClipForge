import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Frame,
  Maximize,
  Mic2,
  Pause,
  Play,
  Repeat2,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Project } from '../types';
import { drawFrame, preloadImages } from '../lib/exporter';
import type { FrameContext } from '../lib/exporter';
import { ASPECT_RATIO } from '../types';
import { formatTime, sceneAt, totalDuration } from '../lib/utils';
import { IconBtn } from './ui';

interface Props {
  project: Project | null;
  time: number;
  playing: boolean;
  loop: boolean;
  voiceOn: boolean;
  muted: boolean;
  safeZone: boolean;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onToggleLoop: () => void;
  onToggleVoice: () => void;
  onToggleMute: () => void;
  onToggleSafeZone: () => void;
  onSnapshot: () => void;
  onAIStudio: () => void;
}

export default function PreviewStage({
  project, time, playing, loop, voiceOn, muted, safeZone,
  onTogglePlay, onSeek, onToggleLoop, onToggleVoice, onToggleMute, onToggleSafeZone, onSnapshot, onAIStudio,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fcRef = useRef<FrameContext>({ images: [] });
  const [imgVersion, setImgVersion] = useState(0);
  const [stageSize, setStageSize] = useState({ w: 900, h: 500 });
  const total = project ? totalDuration(project.scenes) : 0;
  const artKey = project ? project.scenes.map((s) => s.art).join('|') : '';
  const ratio = project ? ASPECT_RATIO[project.aspect] : 16 / 9;
  const current = project ? sceneAt(project.scenes, time) : null;

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStageSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const availW = Math.max(120, stageSize.w - 36);
  const availH = Math.max(120, stageSize.h - 36);
  let frameW = availW;
  let frameH = frameW / ratio;
  if (frameH > availH) { frameH = availH; frameW = frameH * ratio; }

  useEffect(() => {
    if (!project) return;
    let alive = true;
    preloadImages(project).then((images) => {
      if (!alive) return;
      fcRef.current = { images };
      setImgVersion((v) => v + 1);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return;
    const w = ratio >= 1 ? 960 : Math.round(960 * ratio);
    const h = Math.round(w / ratio);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, w, h, Math.min(time, total), project, fcRef.current);
  }, [time, project, imgVersion, ratio, total]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.();
  };

  return (
    <section className="preview-area">
      <div className="preview-toolbar">
        <div className="pv-left">
          <span className="pv-label">Player</span>
          {project && <span className="top-chip">{project.aspect} · {project.resolution}</span>}
          {current?.scene && <span className="pv-scene">Scene {current.index + 1} / {project?.scenes.length} · {current.scene.beat}</span>}
        </div>
        <div className="pv-right">
          <IconBtn title="Toggle safe zone" active={safeZone} onClick={onToggleSafeZone}><Frame size={15} /></IconBtn>
          <IconBtn title="Fullscreen" onClick={toggleFullscreen}><Maximize size={15} /></IconBtn>
        </div>
      </div>

      <div className="preview-stage" ref={stageRef}>
        {!project ? (
          <div className="preview-empty">
            <div className="empty-orb"><Sparkles size={30} /></div>
            <h2>Your canvas is empty</h2>
            <p>Describe a video in one prompt and get a fully editable cut — script, storyboard, captions, motion and soundtrack.</p>
            <button type="button" className="btn btn-primary big" onClick={onAIStudio}><Sparkles size={16} /> Open AI Studio</button>
            <div className="empty-shortcuts"><span>Space</span> play · <span>S</span> split · <span>Ctrl+Z</span> undo</div>
          </div>
        ) : (
          <div className="canvas-wrap" style={{ width: frameW, height: frameH }}>
            <canvas ref={canvasRef} className="preview-canvas" />
            {safeZone && <div className="safe-zone" />}
            <div className="canvas-corner tl" />
            <div className="canvas-corner tr" />
            <div className="canvas-corner bl" />
            <div className="canvas-corner br" />
          </div>
        )}
      </div>

      <div className="player-controls">
        <div className="pc-transport">
          <IconBtn title="Go to start" onClick={() => onSeek(0)}><SkipBack size={15} /></IconBtn>
          <IconBtn title="Back 1s" onClick={() => onSeek(Math.max(0, time - 1))}><ChevronLeft size={17} /></IconBtn>
          <button type="button" className="play-btn" onClick={onTogglePlay} title="Play / Pause (Space)" disabled={!project}>
            {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          </button>
          <IconBtn title="Forward 1s" onClick={() => onSeek(Math.min(total, time + 1))}><ChevronRight size={17} /></IconBtn>
          <IconBtn title="Go to end" onClick={() => onSeek(total)}><SkipForward size={15} /></IconBtn>
        </div>

        <div className="pc-scrub">
          <span className="tc">{formatTime(time)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, total)}
            step={0.01}
            value={Math.min(time, total)}
            onChange={(e) => onSeek(Number(e.target.value))}
            disabled={!project}
            style={{ background: `linear-gradient(90deg, var(--accent) ${(time / Math.max(0.1, total)) * 100}%, #34363f ${(time / Math.max(0.1, total)) * 100}%)` }}
          />
          <span className="tc muted">{formatTime(total)}</span>
        </div>

        <div className="pc-extras">
          <IconBtn title="Loop playback" active={loop} onClick={onToggleLoop}><Repeat2 size={15} /></IconBtn>
          <IconBtn title={muted ? 'Unmute soundtrack' : 'Mute soundtrack'} active={!muted} onClick={onToggleMute}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </IconBtn>
          <IconBtn title="AI voiceover (browser speech)" active={voiceOn} onClick={onToggleVoice}><Mic2 size={15} /></IconBtn>
          <IconBtn title="Save poster frame" onClick={onSnapshot}><Camera size={15} /></IconBtn>
        </div>
      </div>
    </section>
  );
}
