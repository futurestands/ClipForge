import { useRef, useState, type ReactNode } from 'react';
import { Check, ImagePlus, RotateCcw, Search, UploadCloud, Volume2, X } from 'lucide-react';
import type { AssetItem, Grade, Project, TabId } from '../types';
import { ASSETS } from '../lib/assets';
import { PanelHeader, SectionTitle, Slider } from './ui';

interface Props {
  tab: TabId;
  project: Project | null;
  selectedSceneId: string | null;
  onApply: (asset: AssetItem) => void;
  onUpload: (files: FileList | null) => void;
  onSelectScene: (id: string) => void;
  onGrade: (patch: Partial<Grade>) => void;
  onRemoveOverlay: (id: string) => void;
}

const TITLES: Record<TabId, { title: string; sub: string }> = {
  ai: { title: 'AI Video', sub: '' },
  models: { title: 'Model Studio', sub: 'Frontier routing and in-house models' },
  media: { title: 'Media', sub: 'Import or reuse generated scenes' },
  audio: { title: 'Audio', sub: 'Soundtrack for the whole cut' },
  text: { title: 'Text', sub: 'Adds an overlay to the selected scene' },
  stickers: { title: 'Stickers', sub: 'Adds a sticker to the selected scene' },
  effects: { title: 'Effects', sub: 'Applies to the selected scene' },
  transitions: { title: 'Transitions', sub: 'Exit transition of the selected scene' },
  filters: { title: 'Filters', sub: 'Colour grade of the selected scene' },
  adjust: { title: 'Adjust', sub: 'Global colour correction' },
};

export default function AssetPanel({ tab, project, selectedSceneId, onApply, onUpload, onSelectScene, onGrade, onRemoveOverlay }: Props) {
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = project?.scenes.find((s) => s.id === selectedSceneId) ?? null;
  const items = (ASSETS[tab] ?? []).filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  const isActive = (a: AssetItem) => {
    if (!selected) return false;
    if (tab === 'filters') return selected.filter === a.value;
    if (tab === 'effects') return selected.effect === a.value;
    if (tab === 'transitions') return selected.transition === a.value;
    if (tab === 'audio') return project?.bgm === a.value;
    return false;
  };

  return (
    <div className="side-panel">
      <PanelHeader title={TITLES[tab].title} subtitle={TITLES[tab].sub} />
      <div className="panel-scroll">
        {tab === 'media' && (
          <>
            <div
              className={`dropzone${dragging ? ' dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); onUpload(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
            >
              <UploadCloud size={26} />
              <div className="drop-title">Drop images here</div>
              <div className="drop-sub">or click to browse · JPG / PNG / WEBP</div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onUpload(e.target.files)} />
            </div>
            <SectionTitle action={<span className="muted-small">{project?.scenes.length ?? 0} clips</span>}>Project media</SectionTitle>
            {!project && <div className="empty-note">Generate a video from a prompt and its scenes will appear here.</div>}
            <div className="media-grid">
              {project?.scenes.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={`media-tile${selectedSceneId === s.id ? ' active' : ''}`}
                  style={{ backgroundImage: `url(${s.art})` }}
                  onClick={() => onSelectScene(s.id)}
                  title={s.caption}
                >
                  <span className="media-tile-num">{i + 1}</span>
                  <span className="media-tile-label">{s.duration.toFixed(1)}s</span>
                </button>
              ))}
            </div>
            {selected && selected.overlays.length > 0 && (
              <>
                <SectionTitle>Overlays on this clip</SectionTitle>
                <div className="overlay-list">
                  {selected.overlays.map((o) => (
                    <div key={o.id} className="overlay-item">
                      <span>{o.content}</span>
                      <button type="button" onClick={() => onRemoveOverlay(o.id)} title="Remove"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="hint-box"><ImagePlus size={14} /> Imported images are inserted as new clips at the end of the timeline.</div>
          </>
        )}

        {tab === 'adjust' && (
          <>
            <div className="adjust-preview" style={{ backgroundImage: selected ? `url(${selected.art})` : undefined }} />
            <FieldBlock label="Brightness">
              <Slider value={project?.grade.brightness ?? 1} min={0.5} max={1.5} step={0.01} onChange={(v) => onGrade({ brightness: v })} display={`${Math.round((project?.grade.brightness ?? 1) * 100)}%`} />
            </FieldBlock>
            <FieldBlock label="Contrast">
              <Slider value={project?.grade.contrast ?? 1} min={0.5} max={1.6} step={0.01} onChange={(v) => onGrade({ contrast: v })} display={`${Math.round((project?.grade.contrast ?? 1) * 100)}%`} />
            </FieldBlock>
            <FieldBlock label="Saturation">
              <Slider value={project?.grade.saturation ?? 1} min={0} max={2} step={0.01} onChange={(v) => onGrade({ saturation: v })} display={`${Math.round((project?.grade.saturation ?? 1) * 100)}%`} />
            </FieldBlock>
            <button type="button" className="btn btn-ghost full" onClick={() => onGrade({ brightness: 1, contrast: 1, saturation: 1 })}>
              <RotateCcw size={13} /> Reset adjustments
            </button>
            <div className="hint-box">Adjustments are applied to every scene and are baked into the exported video.</div>
          </>
        )}

        {tab !== 'media' && tab !== 'adjust' && (
          <>
            <div className="search-box">
              <Search size={13} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${TITLES[tab].title.toLowerCase()}`} />
            </div>
            {!selected && <div className="empty-note">Select a clip on the timeline first to apply {TITLES[tab].title.toLowerCase()}.</div>}
            {tab === 'audio' && (
              <div className="bgm-current"><Volume2 size={14} /><span>{project?.bgm ?? 'No soundtrack yet'}</span></div>
            )}
            <div className={`asset-grid ${tab === 'text' || tab === 'audio' ? 'wide' : ''}`}>
              {items.map((a) => (
                <button key={a.id} type="button" className={`asset-tile${isActive(a) ? ' active' : ''}`} onClick={() => onApply(a)} title={a.label}>
                  <div className="asset-preview" style={{ background: a.preview }}>
                    {a.emoji ? <span className="asset-emoji">{a.emoji}</span> : tab === 'text' ? <span className="asset-text-sample">{a.value}</span> : null}
                    {isActive(a) && <span className="asset-check"><Check size={11} /></span>}
                  </div>
                  <div className="asset-label">{a.label}</div>
                  {a.meta && <div className="asset-meta">{a.meta}</div>}
                </button>
              ))}
            </div>
            {items.length === 0 && <div className="empty-note">Nothing matched “{query}”.</div>}
          </>
        )}
      </div>
    </div>
  );
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><div className="field-label">{label}</div>{children}</div>;
}
