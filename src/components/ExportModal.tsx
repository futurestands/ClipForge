import { useState } from 'react';
import { Check, Download, FileText, Film, Image as ImageIcon, Loader2, Music2, Subtitles, X } from 'lucide-react';
import type { Project, ResolutionId } from '../types';
import { ASPECT_RATIO, RESOLUTION_SIZE } from '../types';
import { exportWebM, renderPosterAsync } from '../lib/exporter';
import { downloadBlob, downloadText, srtFromScenes, totalDuration } from '../lib/utils';
import { Badge, Segmented, Toggle } from './ui';

interface Props {
  project: Project;
  onClose: () => void;
  onToast: (msg: string) => void;
  onToggleCaptions: () => void;
  previewTime: number;
}

const QUALITY = {
  standard: { label: 'Standard', bitrate: 4_000_000 },
  high: { label: 'High', bitrate: 8_000_000 },
  ultra: { label: 'Ultra', bitrate: 16_000_000 },
};
type QualityId = keyof typeof QUALITY;

export default function ExportModal({ project, onClose, onToast, onToggleCaptions, previewTime }: Props) {
  const [res, setRes] = useState<ResolutionId>(project.resolution);
  const [fps, setFps] = useState<24 | 30 | 60>(project.fps);
  const [quality, setQuality] = useState<QualityId>('high');
  const [audio, setAudio] = useState(project.soundtrack);
  const [watermark, setWatermark] = useState(project.watermark);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const ratio = ASPECT_RATIO[project.aspect];
  const h = RESOLUTION_SIZE[res];
  const w = Math.round(h * ratio);
  const duration = totalDuration(project.scenes);
  const bytes = QUALITY[quality].bitrate * duration / 8;
  const estimate = bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
  const slug = project.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'ai-video';

  const doExport = async () => {
    if (busy) return;
    setBusy(true);
    setDone(false);
    setProgress(0);
    try {
      const exportProject: Project = { ...project, watermark, soundtrack: audio, fps, resolution: res };
      const blob = await exportWebM(
        exportProject,
        { width: w, height: h, fps, bitrate: QUALITY[quality].bitrate, audio },
        (p) => setProgress(p),
      );
      downloadBlob(blob, `${slug}.webm`);
      setDone(true);
      onToast(`Video exported · ${slug}.webm`);
    } catch (err) {
      onToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const savePoster = async () => {
    const url = await renderPosterAsync(project, previewTime);
    const blob = await (await fetch(url)).blob();
    downloadBlob(blob, `${slug}-poster.png`);
    onToast('Poster frame saved');
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal export-modal">
        <div className="modal-head">
          <div>
            <div className="modal-title"><Film size={17} /> Export video</div>
            <div className="modal-sub">{project.name}</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}><X size={17} /></button>
        </div>

        <div className="export-body">
          <div className="export-left">
            <div className="export-poster" style={{ backgroundImage: `url(${project.scenes[0]?.art})`, aspectRatio: `${ratio}` }}>
              <span className="export-poster-tag">{project.aspect} · {w}×{h}</span>
            </div>
            <div className="export-summary">
              <div><span>Scenes</span><b>{project.scenes.length}</b></div>
              <div><span>Duration</span><b>{duration.toFixed(1)}s</b></div>
              <div><span>Frame rate</span><b>{fps} fps</b></div>
              <div><span>Est. size</span><b>~{estimate}</b></div>
            </div>
          </div>

          <div className="export-right">
            <div className="export-field">
              <label>Resolution</label>
              <Segmented<ResolutionId>
                compact
                value={res}
                onChange={setRes}
                options={[{ value: '720p', label: '720p' }, { value: '1080p', label: '1080p' }, { value: '4K', label: '4K' }]}
              />
              <small>{w} × {h} px · {project.aspect}</small>
            </div>
            <div className="export-field">
              <label>Frame rate</label>
              <Segmented
                compact
                value={String(fps)}
                onChange={(v) => setFps(Number(v) as 24 | 30 | 60)}
                options={[{ value: '24', label: '24' }, { value: '30', label: '30' }, { value: '60', label: '60' }]}
              />
            </div>
            <div className="export-field">
              <label>Quality</label>
              <Segmented<QualityId>
                compact
                value={quality}
                onChange={setQuality}
                options={[{ value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }, { value: 'ultra', label: 'Ultra' }]}
              />
            </div>
            <div className="export-toggles">
              <Toggle label="Include soundtrack" desc="Procedural ambient score" checked={audio} onChange={setAudio} />
              <Toggle label="Watermark" desc="ClipForge AI mark" checked={watermark} onChange={setWatermark} />
              <Toggle label="Burn-in captions" desc="Subtitle text baked into the video" checked={project.captions} onChange={onToggleCaptions} />
            </div>

            {busy && (
              <div className="export-progress">
                <div className="gen-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                <div className="export-progress-label"><Loader2 size={13} className="spin" /> Rendering {Math.round(progress * 100)}% · real time, {duration.toFixed(0)}s</div>
              </div>
            )}
            {done && <div className="export-done"><Check size={14} /> Video rendered and downloaded.</div>}

            <button type="button" className="btn btn-primary full big" onClick={doExport} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
              {busy ? 'Rendering your video…' : 'Export video (.webm)'}
            </button>
            <div className="export-note">Rendered locally in your browser via canvas capture. MP4 needs a transcoder; WebM plays in Chrome, Edge and Firefox.</div>
          </div>
        </div>

        <div className="export-extras">
          <span className="extras-label">Also export</span>
          <button type="button" className="mini-btn" onClick={() => { downloadText(srtFromScenes(project.scenes), `${slug}.srt`, 'application/x-subrip'); onToast('Subtitles saved'); }}>
            <Subtitles size={13} /> Subtitles .srt
          </button>
          <button type="button" className="mini-btn" onClick={() => { downloadText(project.script, `${slug}-script.txt`); onToast('Script saved'); }}>
            <FileText size={13} /> Script .txt
          </button>
          <button type="button" className="mini-btn" onClick={savePoster}>
            <ImageIcon size={13} /> Poster .png
          </button>
          <span className="extras-spacer" />
          <Badge tone="accent"><Music2 size={10} /> {project.bgm}</Badge>
        </div>
      </div>
    </div>
  );
}
