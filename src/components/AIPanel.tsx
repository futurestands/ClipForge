import { useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BrainCircuit,
  Check,
  ChevronDown,
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Loader2,
  Monitor,
  RectangleHorizontal,
  RefreshCw,
  Shuffle,
  Smartphone,
  Sparkles,
  Square,
  WandSparkles,
} from 'lucide-react';
import type { AspectId, GenSettings, Project, StyleChoice } from '../types';
import { STYLE_LABEL } from '../types';
import { stylePreview } from '../lib/art';
import { predictDirection } from '../lib/brain/director';
import { INSPIRATIONS } from '../lib/promptEngine';
import { VOICES } from '../lib/assets';
import { totalDuration } from '../lib/utils';
import { Badge, Field, PanelHeader, SectionTitle, Segmented, Slider, Toggle } from './ui';

interface Props {
  settings: GenSettings;
  onSettings: (patch: Partial<GenSettings>) => void;
  onGenerate: () => void;
  generation: { step: number; label: string; progress: number } | null;
  project: Project | null;
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
  onOpenScript: () => void;
  onRegenerateScene: (id: string) => void;
  onRewriteScene: (id: string) => void;
  onOpenExport: () => void;
}

const STYLES: StyleChoice[] = ['auto', 'cinematic', 'anime', 'neon', 'watercolor', 'threeD', 'doc'];
const STYLE_CHOICE_LABEL: Record<StyleChoice, string> = { auto: 'Auto · Director', ...STYLE_LABEL };
const AUTO_PREVIEW = 'linear-gradient(135deg, #12233a 0%, #4b3a8f 45%, #16857c 100%)';
const STEPS = ['Director v1 reads the prompt', 'Writing script & narration', 'Composing scene artwork', 'Building timeline & soundtrack', 'Critic reviews the cut'];

export default function AIPanel({
  settings,
  onSettings,
  onGenerate,
  generation,
  project,
  selectedSceneId,
  onSelectScene,
  onOpenScript,
  onRegenerateScene,
  onRewriteScene,
  onOpenExport,
}: Props) {
  const [advanced, setAdvanced] = useState(false);
  const [morePrompts, setMorePrompts] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<GenSettings>) => onSettings(patch);
  const jumpToStoryboard = () => scrollRef.current?.querySelector('.storyboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const direction = useMemo(
    () => predictDirection(settings.prompt || 'a story worth telling'),
    [settings.prompt],
  );

  return (
    <div className="side-panel ai-panel">
      <PanelHeader
        title="AI Video Generator"
        subtitle="Prompt → script → storyboard → timeline"
        action={<Badge tone="accent"><Sparkles size={10} /> BETA</Badge>}
      />

      <div className="panel-scroll" ref={scrollRef}>
        <div className="ai-hero">
          <div className="ai-hero-icon"><WandSparkles size={20} /></div>
          <div>
            <div className="ai-hero-title">Describe your video</div>
            <div className="ai-hero-sub">One prompt. A complete, editable cut.</div>
          </div>
        </div>

        <Field label="Your prompt" hint={`${settings.prompt.length}/400`}>
          <div className="prompt-box">
            <textarea
              id="ai-prompt"
              value={settings.prompt}
              maxLength={400}
              onChange={(e) => set({ prompt: e.target.value })}
              placeholder="e.g. A cinematic 15s video about a lone astronaut watching a sunrise over an alien ocean…"
              spellCheck={false}
            />
            <button
              type="button"
              className="prompt-shuffle"
              title="Surprise me"
              onClick={() => set({ prompt: INSPIRATIONS[Math.floor(Math.random() * INSPIRATIONS.length)] })}
            >
              <Shuffle size={14} />
            </button>
          </div>
        </Field>

        <div className="chips">
          {(morePrompts ? INSPIRATIONS : INSPIRATIONS.slice(0, 3)).map((p) => (
            <button key={p} type="button" className="chip" onClick={() => set({ prompt: p })} title={p}>
              {p.length > 34 ? `${p.slice(0, 33)}…` : p}
            </button>
          ))}
          <button type="button" className="chip chip-more" onClick={() => setMorePrompts(!morePrompts)}>
            {morePrompts ? 'Less' : 'More'} <ChevronDown size={11} className={morePrompts ? 'flip' : ''} />
          </button>
        </div>

        <SectionTitle action={<span className="muted-small">Director v1</span>}>Visual style</SectionTitle>
        <div className="style-grid">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              className={`style-tile${settings.style === s ? ' active' : ''}${s === 'auto' ? ' auto' : ''}`}
              onClick={() => set({ style: s })}
              style={{ background: s === 'auto' ? AUTO_PREVIEW : stylePreview(s) }}
            >
              <span className="style-tile-overlay" />
              <span className="style-tile-label">{STYLE_CHOICE_LABEL[s]}</span>
              {settings.style === s && <span className="style-check"><Check size={11} /></span>}
            </button>
          ))}
        </div>
        <div className="director-hint">
          <BrainCircuit size={13} />
          <span>
            Predicts <b>{STYLE_LABEL[settings.style === 'auto' ? direction.style : settings.style]}</b> · {direction.motif} · {direction.shots} shots · energy {direction.energy}
            {settings.style === 'auto' && <em> (auto)</em>}
          </span>
        </div>

        <Field label="Aspect ratio">
          <Segmented<AspectId>
            value={settings.aspect}
            onChange={(v) => set({ aspect: v })}
            options={[
              { value: '16:9', label: '16:9', icon: <RectangleHorizontal size={13} /> },
              { value: '9:16', label: '9:16', icon: <Smartphone size={13} /> },
              { value: '1:1', label: '1:1', icon: <Square size={13} /> },
              { value: '4:3', label: '4:3', icon: <Monitor size={13} /> },
            ]}
          />
        </Field>

        <Field label="Duration" hint={`${settings.duration}s`}>
          <Slider value={settings.duration} min={6} max={45} step={1} onChange={(v) => set({ duration: v })} display={`${settings.duration}s`} />
        </Field>

        <button type="button" className="advanced-toggle" onClick={() => setAdvanced(!advanced)}>
          <span>Advanced settings</span>
          <ChevronDown size={14} className={advanced ? 'flip' : ''} />
        </button>

        {advanced && (
          <div className="advanced-body">
            <Field label="Resolution">
              <Segmented
                value={settings.resolution}
                onChange={(v) => set({ resolution: v })}
                compact
                options={[{ value: '720p', label: '720p' }, { value: '1080p', label: '1080p' }, { value: '4K', label: '4K' }]}
              />
            </Field>
            <Field label="Frame rate">
              <Segmented
                value={String(settings.fps)}
                onChange={(v) => set({ fps: Number(v) as 24 | 30 | 60 })}
                compact
                options={[{ value: '24', label: '24' }, { value: '30', label: '30' }, { value: '60', label: '60' }]}
              />
            </Field>
            <Field label="AI voiceover">
              <select className="select" value={settings.voice} onChange={(e) => set({ voice: e.target.value })}>
                {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Camera motion" hint={`${Math.round(settings.motionIntensity * 100)}%`}>
              <Slider value={settings.motionIntensity} min={0} max={1} step={0.05} onChange={(v) => set({ motionIntensity: v })} display={`${Math.round(settings.motionIntensity * 100)}%`} />
            </Field>
            <Toggle label="Auto captions" desc="Burn subtitle text into the cut" checked={settings.captions} onChange={(v) => set({ captions: v })} />
            <Toggle label="AI soundtrack" desc="Procedural ambient score" checked={settings.soundtrack} onChange={(v) => set({ soundtrack: v })} />
            {project && (
              <Toggle label="Append to timeline" desc="Keep existing clips" checked={settings.append} onChange={(v) => set({ append: v })} />
            )}
          </div>
        )}

        {project && !generation && (
          <>
            <div className="ai-result-head">
              <SectionTitle action={<span className="muted-small">{project.scenes.length} scenes · {totalDuration(project.scenes).toFixed(1)}s</span>}>
                Storyboard {project.quality && <span className={`quality-pill grade-${project.quality.grade}`}>{project.quality.grade} · {project.quality.overall}</span>}
              </SectionTitle>
              <div className="ai-result-actions">
                <button type="button" className="mini-btn" onClick={onOpenScript}><FileText size={12} /> Script</button>
                <button type="button" className="mini-btn" onClick={onOpenExport}><Clapperboard size={12} /> Export</button>
              </div>
            </div>
            <div className="storyboard">
              {project.scenes.map((scene, i) => (
                <div
                  key={scene.id}
                  className={`scene-card${selectedSceneId === scene.id ? ' active' : ''}`}
                  onClick={() => onSelectScene(scene.id)}
                >
                  <div className="scene-thumb" style={{ backgroundImage: `url(${scene.art})` }}>
                    <span className="scene-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="scene-dur">{scene.duration.toFixed(1)}s</span>
                  </div>
                  <div className="scene-info">
                    <div className="scene-beat">{scene.beat} · {scene.motif}</div>
                    <div className="scene-caption">{scene.caption}</div>
                    <div className="scene-camera">{scene.camera}</div>
                    <div className="scene-card-btns">
                      <button type="button" title="Rewrite text with AI" onClick={(e) => { e.stopPropagation(); onRewriteScene(scene.id); }}>
                        <Sparkles size={11} /> Rewrite
                      </button>
                      <button type="button" title="Regenerate artwork" onClick={(e) => { e.stopPropagation(); onRegenerateScene(scene.id); }}>
                        <ImageIcon size={11} /> Regen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="ai-footnote">
              <RefreshCw size={12} /> Every scene is editable — text, timing, motion, filters and overlays.
            </div>
          </>
        )}
      </div>

      <div className="ai-sticky-footer">
        {generation && (
          <div className="gen-progress">
            <div className="gen-bar"><i style={{ width: `${Math.round(generation.progress * 100)}%` }} /></div>
            {STEPS.map((s, i) => (
              <div key={s} className={`gen-step${i < generation.step ? ' done' : ''}${i === generation.step ? ' current' : ''}`}>
                {i < generation.step ? <Check size={12} /> : i === generation.step ? <Loader2 size={12} className="spin" /> : <span className="gen-dot" />}
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
        {project && !generation && (
          <button type="button" className="storyboard-jump" onClick={jumpToStoryboard}>
            <Clapperboard size={12} /> View {project.scenes.length}-scene storyboard <ChevronDown size={12} />
          </button>
        )}
        <button type="button" className="generate-btn" onClick={onGenerate} disabled={!settings.prompt.trim() || !!generation}>
          {generation ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />}
          <span>{generation ? 'Generating your video…' : 'Generate video from prompt'}</span>
          {!generation && <ArrowUpRight size={16} />}
        </button>
      </div>
    </div>
  );
}
