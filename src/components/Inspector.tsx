import { useState } from 'react';
import { Copy, Image as ImageIcon, Lock, Sparkles, Trash2, Unlock, Wand2 } from 'lucide-react';
import type { Grade, MotionId, Project, Scene, TransitionId } from '../types';
import { VOICES } from '../lib/assets';
import { Field, PanelHeader, SectionTitle, Segmented, Slider, Toggle } from './ui';

interface Props {
  project: Project | null;
  scene: Scene | null;
  onPatch: (id: string, patch: Partial<Scene>) => void;
  onProjectPatch: (patch: Partial<Project>) => void;
  onRegenerate: (id: string) => void;
  onRewrite: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRemoveOverlay: (id: string) => void;
}

type Tab = 'video' | 'ai' | 'audio';

export default function Inspector({
  project, scene, onPatch, onProjectPatch, onRegenerate, onRewrite, onDuplicate, onDelete, onRemoveOverlay,
}: Props) {
  const [tab, setTab] = useState<Tab>('ai');
  const patch = (p: Partial<Scene>) => { if (scene) onPatch(scene.id, p); };

  return (
    <aside className="inspector">
      <PanelHeader title="Properties" subtitle={scene ? `Clip · ${scene.beat}` : 'No clip selected'} />
      {!scene || !project ? (
        <div className="inspector-empty">
          <div className="inspector-empty-icon"><Wand2 size={22} /></div>
          <p>Select a clip on the timeline to edit its text, motion, timing and AI-generated artwork.</p>
        </div>
      ) : (
        <>
          <div className="inspector-tabs">
            <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}><Sparkles size={13} /> AI Scene</button>
            <button className={tab === 'video' ? 'active' : ''} onClick={() => setTab('video')}>Video</button>
            <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}>Audio</button>
          </div>
          <div className="panel-scroll inspector-scroll">
            <div className="inspector-clip-head">
              <div className="inspector-thumb" style={{ backgroundImage: `url(${scene.art})` }} />
              <div>
                <div className="inspector-clip-title">{scene.caption || 'Untitled scene'}</div>
                <div className="inspector-clip-meta">{scene.duration.toFixed(1)}s · {scene.camera}</div>
              </div>
            </div>

            {tab === 'ai' && (
              <>
                <SectionTitle>AI script</SectionTitle>
                <Field label="On-screen caption">
                  <input className="input" value={scene.caption} onChange={(e) => patch({ caption: e.target.value })} />
                </Field>
                <Field label="Voiceover line">
                  <textarea className="input area" rows={3} value={scene.narration} onChange={(e) => patch({ narration: e.target.value })} />
                </Field>
                <Field label="Camera direction">
                  <input className="input" value={scene.camera} onChange={(e) => patch({ camera: e.target.value })} />
                </Field>
                <div className="ai-btn-row">
                  <button type="button" className="btn btn-ghost" onClick={() => onRewrite(scene.id)}><Sparkles size={13} /> Rewrite with AI</button>
                  <button type="button" className="btn btn-ghost" onClick={() => onRegenerate(scene.id)}><ImageIcon size={13} /> New artwork</button>
                </div>

                <SectionTitle>Scene recipe</SectionTitle>
                <Field label="Visual motif">
                  <select className="select" value={scene.motif} onChange={(e) => patch({ motif: e.target.value as Scene['motif'] })}>
                    {['abstract', 'nature', 'city', 'ocean', 'space', 'product', 'people'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Colour palette" hint="click to edit">
                  <div className="palette-row">
                    {scene.palette.map((col, i) => (
                      <label key={i} className="swatch" style={{ background: col }} title={col}>
                        <input
                          type="color"
                          value={col}
                          onChange={(e) => {
                            const next = [...scene.palette];
                            next[i] = e.target.value;
                            patch({ palette: next });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </Field>
                <div className="hint-box">Changing motif or palette re-renders this scene's procedural artwork instantly.</div>
              </>
            )}

            {tab === 'video' && (
              <>
                <SectionTitle>Transform</SectionTitle>
                <Field label="Duration" hint={`${scene.duration.toFixed(1)}s`}>
                  <Slider value={scene.duration} min={0.5} max={12} step={0.1} onChange={(v) => patch({ duration: v })} display={`${scene.duration.toFixed(1)}s`} />
                </Field>
                <Field label="Scale" hint={`${Math.round(scene.scale * 100)}%`}>
                  <Slider value={scene.scale} min={0.5} max={2} step={0.01} onChange={(v) => patch({ scale: v })} display={`${Math.round(scene.scale * 100)}%`} />
                </Field>
                <Field label="Rotation" hint={`${scene.rotate}°`}>
                  <Slider value={scene.rotate} min={-45} max={45} step={1} onChange={(v) => patch({ rotate: v })} display={`${scene.rotate}°`} />
                </Field>
                <Field label="Opacity" hint={`${Math.round(scene.opacity * 100)}%`}>
                  <Slider value={scene.opacity} min={0.2} max={1} step={0.01} onChange={(v) => patch({ opacity: v })} display={`${Math.round(scene.opacity * 100)}%`} />
                </Field>
                <Field label="Playback speed" hint={`${scene.speed.toFixed(2)}×`}>
                  <Slider value={scene.speed} min={0.5} max={2} step={0.05} onChange={(v) => patch({ speed: v })} display={`${scene.speed.toFixed(2)}×`} />
                </Field>

                <SectionTitle>Motion & look</SectionTitle>
                <Field label="Camera motion">
                  <Segmented<MotionId>
                    compact
                    value={scene.motion}
                    onChange={(v) => patch({ motion: v })}
                    options={[
                      { value: 'zoom-in', label: 'Push' },
                      { value: 'zoom-out', label: 'Pull' },
                      { value: 'drift', label: 'Drift' },
                    ]}
                  />
                </Field>
                <div className="field">
                  <div className="field-label">Pan direction</div>
                  <Segmented<MotionId>
                    compact
                    value={scene.motion}
                    onChange={(v) => patch({ motion: v })}
                    options={[{ value: 'pan-left', label: '← Left' }, { value: 'pan-right', label: 'Right →' }]}
                  />
                </div>
                <Field label="Exit transition">
                  <select className="select" value={scene.transition} onChange={(e) => patch({ transition: e.target.value as TransitionId })}>
                    {['dissolve', 'fade', 'slide', 'zoom', 'whip', 'none'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Filter">
                  <select className="select" value={scene.filter} onChange={(e) => patch({ filter: e.target.value })}>
                    {['none', 'vivid', 'warm', 'cool', 'mono', 'faded', 'noir'].map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Effect">
                  <select className="select" value={scene.effect} onChange={(e) => patch({ effect: e.target.value })}>
                    {['none', 'light-leak', 'bokeh', 'glitch', 'grain'].map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Toggle label="Lock clip" desc="Prevent accidental edits" checked={scene.locked} onChange={(v) => patch({ locked: v })} />
                <button type="button" className="btn btn-ghost full" onClick={() => onPatch(scene.id, { locked: !scene.locked })}>
                  {scene.locked ? <Lock size={13} /> : <Unlock size={13} />} {scene.locked ? 'Unlock' : 'Lock'} clip
                </button>
              </>
            )}

            {tab === 'audio' && (
              <>
                <SectionTitle>Clip audio</SectionTitle>
                <Field label="Clip volume" hint={`${Math.round(scene.volume * 100)}%`}>
                  <Slider value={scene.volume} min={0} max={1} step={0.01} onChange={(v) => patch({ volume: v })} display={`${Math.round(scene.volume * 100)}%`} />
                </Field>
                <SectionTitle>Project audio</SectionTitle>
                <div className="bgm-current">♪ <span>{project.bgm}</span></div>
                <Field label="AI voiceover">
                  <select className="select" value={project.voice} onChange={(e) => onProjectPatch({ voice: e.target.value })}>
                    {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </Field>
                <Toggle label="Soundtrack" desc="Include ambient score on export" checked={project.soundtrack} onChange={(v) => onProjectPatch({ soundtrack: v })} />
                <Toggle label="Auto captions" desc="Burn in subtitle text" checked={project.captions} onChange={(v) => onProjectPatch({ captions: v })} />
                <Toggle label="Watermark" desc="Small ClipForge AI mark" checked={project.watermark} onChange={(v) => onProjectPatch({ watermark: v })} />
                <div className="hint-box">Enable the mic button under the player to hear the generated narration read aloud in your browser.</div>
              </>
            )}

            {scene.overlays.length > 0 && (
              <>
                <SectionTitle>Overlays</SectionTitle>
                <div className="overlay-list">
                  {scene.overlays.map((o) => (
                    <div key={o.id} className="overlay-item">
                      <span>{o.content}</span>
                      <button type="button" title="Remove" onClick={() => onRemoveOverlay(o.id)}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="inspector-actions">
              <button type="button" className="btn btn-ghost" onClick={() => onDuplicate(scene.id)}><Copy size={13} /> Duplicate</button>
              <button type="button" className="btn btn-danger" onClick={() => onDelete(scene.id)}><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
