import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, Brain, Check, Cloud, CloudOff, Cpu, FileText,
  Film, Image as ImageIcon, KeyRound, Loader2, Mic, RefreshCw, RotateCcw, Server, Sparkles,
  Wand2, Zap,
} from 'lucide-react';
import type { CloudCapability, CloudModelConfig, DirectionPrediction, GenSettings, Project } from '../types';
import { DEFAULT_CLOUD_MODELS, STYLE_LABEL } from '../types';
import { MODEL_INFO, MODEL_METRICS, predictDirection } from '../lib/brain/director';
import type { GatewaySnapshot } from '../lib/gateway';
import { saveKeys, saveModels, setBudget, type RuntimeKeys } from '../lib/gateway';
import { Badge, PanelHeader, SectionTitle, Slider, Toggle } from './ui';

interface Props {
  settings: GenSettings;
  onSettings: (patch: Partial<GenSettings>) => void;
  gateway: GatewaySnapshot;
  onRefresh: () => void;
  project: Project | null;
  onSelfCritique: () => void;
  onToast: (msg: string) => void;
}

const CAP_ICON: Record<CloudCapability, typeof FileText> = {
  script: FileText,
  image: ImageIcon,
  video: Film,
  voice: Mic,
};

const CAP_LABEL: Record<CloudCapability, string> = {
  script: 'Script / shot list',
  image: 'Keyframe images',
  video: 'Motion clips',
  voice: 'Voiceover',
};

const AXIS_LABEL: Record<string, string> = {
  relevance: 'Prompt relevance',
  variety: 'Shot variety',
  coherence: 'Narrative arc',
  pacing: 'Beat alignment',
  continuity: 'Visual continuity',
};

export default function ModelPanel({
  settings, onSettings, gateway, onRefresh, project, onSelfCritique, onToast,
}: Props) {
  const [models, setModels] = useState<CloudModelConfig>(gateway.defaults?.scriptModel ? gateway.defaults : DEFAULT_CLOUD_MODELS);
  const [keys, setKeys] = useState<RuntimeKeys>({ OPENAI_API_KEY: '', FAL_KEY: '', ELEVENLABS_API_KEY: '', OPENAI_BASE_URL: '' });
  const [busy, setBusy] = useState<'keys' | 'models' | 'budget' | null>(null);
  const [probe, setProbe] = useState('');
  const [prediction, setPrediction] = useState<DirectionPrediction | null>(null);

  useEffect(() => {
    if (gateway.defaults?.scriptModel) setModels(gateway.defaults);
  }, [gateway]);

  const applyKeys = async () => {
    setBusy('keys');
    const next = await saveKeys(keys);
    setBusy(null);
    if (next) {
      setKeys({ OPENAI_API_KEY: '', FAL_KEY: '', ELEVENLABS_API_KEY: '', OPENAI_BASE_URL: '' });
      onToast('Provider keys applied to the local gateway');
      onRefresh();
    } else onToast('Could not reach the model gateway');
  };

  const applyModels = async () => {
    setBusy('models');
    const ok = await saveModels(models);
    setBusy(null);
    onToast(ok ? 'Model routing saved' : 'Could not reach the model gateway');
    if (ok) onRefresh();
  };

  const quality = project?.quality;
  const spentPct = Math.min(100, (gateway.budget.spent / Math.max(0.01, gateway.budget.cap)) * 100);

  return (
    <div className="side-panel model-panel">
      <PanelHeader
        title="Model Studio"
        subtitle="Frontier routing · in-house brain · critic"
        action={
          <Badge tone={gateway.online ? 'accent' : 'warn'}>
            {gateway.online ? <Cloud size={10} /> : <CloudOff size={10} />}
            {gateway.online ? 'GATEWAY ON' : 'OFFLINE'}
          </Badge>
        }
      />

      <div className="panel-scroll">
        {/* ---------------- gateway ---------------- */}
        <div className="ms-card">
          <div className="ms-card-head">
            <div className="ms-card-title"><Server size={14} /> Model gateway</div>
            <button type="button" className="ms-icon-btn" title="Refresh status" onClick={onRefresh}><RefreshCw size={13} /></button>
          </div>
          <div className="ms-status-line">
            <span className={`ms-dot ${gateway.online ? 'on' : 'off'}`} />
            <span>{gateway.online ? `Local gateway v${gateway.version} · http://127.0.0.1:4173` : 'Not running — everything falls back to local models'}</span>
          </div>
          {!gateway.online && (
            <div className="ms-note warn">
              <AlertTriangle size={13} /> Start it with <code>npm run serve</code>, or run the Vite dev server alongside <code>npm run gateway</code>.
            </div>
          )}
          <div className="ms-provider-list">
            {(Object.keys(CAP_LABEL) as CloudCapability[]).map((cap) => {
              const Icon = CAP_ICON[cap];
              const on = gateway.providers[cap];
              return (
                <div className="ms-provider" key={cap}>
                  <Icon size={13} />
                  <span className="ms-provider-name">{CAP_LABEL[cap]}</span>
                  <span className={`ms-dot ${on ? 'on' : 'off'}`} />
                  <span className={`ms-provider-state ${on ? 'on' : ''}`}>{on ? 'key ready' : 'local only'}</span>
                </div>
              );
            })}
          </div>
          <div className="ms-note">Keys are never required. With none configured, Director v1, procedural art, the ambient score and the critic all run in your browser — offline.</div>
        </div>

        {/* ---------------- budget ---------------- */}
        <SectionTitle action={<span className="muted-small">{gateway.budget.calls} calls</span>}>Spend guard</SectionTitle>
        <div className="ms-card">
          <div className="ms-budget-head">
            <span><strong>${gateway.budget.spent.toFixed(3)}</strong> of ${gateway.budget.cap.toFixed(2)}</span>
            <button type="button" className="ms-icon-btn" title="Reset ledger" onClick={async () => { await setBudget(settings.budgetCap, true); onRefresh(); onToast('Cost ledger reset'); }}><RotateCcw size={12} /></button>
          </div>
          <div className="ms-bar"><i style={{ width: `${spentPct}%` }} /></div>
          <Slider value={settings.budgetCap} min={0} max={10} step={0.5} onChange={(v) => onSettings({ budgetCap: v })} display={`$${settings.budgetCap.toFixed(2)}`} />
          <div className="ms-note">Hard cap for a generation session. The gateway refuses any call that would exceed it; estimates only, no billing is performed here.</div>
          {gateway.recent.length > 0 && (
            <div className="ms-ledger">
              {gateway.recent.slice(0, 4).map((e, i) => (
                <div key={`${e.at}-${i}`}><span>{e.capability} · {e.model}</span><span>${e.cost.toFixed(3)}</span></div>
              ))}
            </div>
          )}
        </div>

        {/* ---------------- in-house model ---------------- */}
        <div className="ms-card model-hero">
          <div className="ms-card-head">
            <div className="ms-card-title"><Brain size={14} /> {MODEL_INFO.name}</div>
            <Badge tone="accent"><Cpu size={10} /> TRAINED LOCALLY</Badge>
          </div>
          <div className="ms-note">{MODEL_INFO.architecture}. {MODEL_INFO.parameters.toLocaleString()} weights, {MODEL_INFO.inputDim} input features. Runs entirely in the browser — no download, no API.</div>
          <div className="ms-metrics">
            <div className="ms-metric"><span>Style accuracy</span><strong>{(MODEL_METRICS.valStyleAccuracy * 100).toFixed(1)}%</strong><small>held-out</small></div>
            <div className="ms-metric"><span>Motif accuracy</span><strong>{(MODEL_METRICS.valMotifAccuracy * 100).toFixed(1)}%</strong><small>ensemble · neural {(MODEL_METRICS.valMotifAccuracyRaw * 100).toFixed(1)}%</small></div>
            <div className="ms-metric"><span>Regression MAE</span><strong>{MODEL_METRICS.valMAE.toFixed(3)}</strong><small>3 targets</small></div>
            <div className="ms-metric"><span>Train examples</span><strong>{MODEL_METRICS.examples}</strong><small>{MODEL_METRICS.epochs} epochs</small></div>
          </div>
          <div className="ms-note">Motif uses a neural posterior blended with a domain-lexicon prior (λ={MODEL_INFO.motifLambda}); both accuracies are measured on the same held-out seed groups.</div>
          <div className="ms-probe">
            <input
              className="ms-input"
              value={probe}
              onChange={(e) => setProbe(e.target.value)}
              placeholder="Test a prompt, e.g. neon rainy Tokyo alley…"
              onKeyDown={(e) => { if (e.key === 'Enter') setPrediction(predictDirection(probe || settings.prompt)); }}
            />
            <button type="button" className="ms-btn primary" onClick={() => setPrediction(predictDirection(probe || settings.prompt))}>
              <Zap size={12} /> Analyze
            </button>
          </div>
          {prediction && (
            <div className="ms-chips">
              <span className="ms-chip accent">style · {STYLE_LABEL[prediction.style]}</span>
              <span className="ms-chip">motif · {prediction.motif}</span>
              <span className="ms-chip">pacing · {prediction.pacing}/10s</span>
              <span className="ms-chip">energy · {prediction.energy}</span>
              <span className="ms-chip">shots · {prediction.shots}</span>
              <span className="ms-chip">confidence · {(prediction.confidence * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>

        {/* ---------------- critic ---------------- */}
        <SectionTitle action={quality && <span className="muted-small">{quality.passes} passes</span>}>Quality critic</SectionTitle>
        {quality ? (
          <div className="ms-card">
            <div className="ms-grade-row">
              <div className={`ms-grade grade-${quality.grade}`}>{quality.grade}</div>
              <div>
                <div className="ms-grade-score">{quality.overall}<span>/100</span></div>
                <div className="ms-note">Self-critiqued cut · {quality.shots.length} shots scored</div>
              </div>
            </div>
            <div className="ms-axes">
              {(Object.entries(quality.axes) as [string, number][]).map(([k, v]) => (
                <div className="ms-axis" key={k}>
                  <span>{AXIS_LABEL[k] ?? k}</span>
                  <div className="ms-bar"><i style={{ width: `${v}%` }} /></div>
                  <b>{v}</b>
                </div>
              ))}
            </div>
            <div className="ms-shot-scores">
              {quality.shots.map((s, i) => (
                <div key={s.sceneId} title={`Shot ${i + 1}: relevance ${s.relevance}, variety ${s.variety}, readability ${s.readability}, pacing ${s.pacing}${s.notes.length ? ` — ${s.notes.join(', ')}` : ''}`}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <i style={{ height: `${Math.max(8, s.score)}%` }} />
                </div>
              ))}
            </div>
            <div className="ms-suggest">
              {quality.suggestions.map((s) => <div key={s}><Activity size={11} /> {s}</div>)}
            </div>
            <button type="button" className="ms-btn full" onClick={onSelfCritique}><Wand2 size={12} /> Run self-critique on current cut</button>
          </div>
        ) : (
          <div className="ms-card"><div className="ms-note">Generate a video from a prompt — the critic scores every shot on relevance, variety, readability, beat alignment and continuity, then rewrites the weak ones.</div></div>
        )}

        {/* ---------------- frontier models ---------------- */}
        <SectionTitle action={<span className="muted-small">optional</span>}>Frontier model routing</SectionTitle>
        <div className="ms-card">
          {gateway.models.length === 0 && <div className="ms-note">Model catalog loads from the gateway. Without it the app still generates locally.</div>}
          {gateway.models.map((m) => {
            const Icon = CAP_ICON[m.capability];
            const field = ({ script: 'scriptModel', image: 'imageModel', video: 'videoModel', voice: 'voiceModel' } as const)[m.capability];
            return (
              <div className="ms-model-row" key={m.capability}>
                <div className="ms-model-top">
                  <Icon size={13} />
                  <span className="ms-model-label">{m.label}</span>
                  <span className="ms-model-provider">{m.provider}</span>
                  <span className="ms-model-cost">~${m.cost.toFixed(2)}</span>
                </div>
                <input
                  className="ms-input mono"
                  value={models[field]}
                  onChange={(e) => setModels((v) => ({ ...v, [field]: e.target.value }))}
                  spellCheck={false}
                  aria-label={`${m.capability} model id`}
                />
                <div className="ms-model-detail">{m.detail}</div>
                <div className="ms-model-detail dim">{m.contract}</div>
                {m.alternatives?.length > 0 && (
                  <div className="ms-alt">also: {m.alternatives.join(' · ')}</div>
                )}
              </div>
            );
          })}
          <button type="button" className="ms-btn full primary" disabled={busy === 'models' || !gateway.online} onClick={applyModels}>
            {busy === 'models' ? <Loader2 size={12} className="spin" /> : <Check size={12} />} Save model routing
          </button>
        </div>

        {/* ---------------- keys ---------------- */}
        <SectionTitle>Provider keys</SectionTitle>
        <div className="ms-card">
          <div className="ms-note"><KeyRound size={12} /> Held in gateway memory only — never written to disk or sent anywhere except the provider you choose. Environment variables work too.</div>
          {([
            ['OPENAI_API_KEY', 'OpenAI / OpenRouter key', 'sk-…'],
            ['FAL_KEY', 'fal.ai key (image + video)', 'key_id:secret'],
            ['ELEVENLABS_API_KEY', 'ElevenLabs key', 'xi-…'],
            ['OPENAI_BASE_URL', 'Custom LLM base URL (optional)', 'https://openrouter.ai/api/v1'],
          ] as [keyof RuntimeKeys, string, string][]).map(([field, label, placeholder]) => (
            <div className="ms-key-field" key={field}>
              <label>{label}</label>
              <input
                className="ms-input"
                type={field === 'OPENAI_BASE_URL' ? 'text' : 'password'}
                value={keys[field] ?? ''}
                placeholder={gateway.providers[(field === 'FAL_KEY' ? 'image' : field === 'ELEVENLABS_API_KEY' ? 'voice' : 'script') as CloudCapability] ? 'configured — leave blank to keep' : placeholder}
                onChange={(e) => setKeys((v) => ({ ...v, [field]: e.target.value }))}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ))}
          <button type="button" className="ms-btn full" disabled={busy === 'keys' || !gateway.online} onClick={applyKeys}>
            {busy === 'keys' ? <Loader2 size={12} className="spin" /> : <ArrowUpRight size={12} />} Apply keys to gateway
          </button>
        </div>

        {/* ---------------- generation switches ---------------- */}
        <SectionTitle>Generation pipeline</SectionTitle>
        <div className="ms-card">
          <Toggle label="Use frontier models" desc="When keys exist; otherwise fall back locally" checked={settings.useCloud} onChange={(v) => onSettings({ useCloud: v })} />
          <Toggle label="LLM script & shot list" desc="Structured scene copy from the frontier LLM" checked={settings.cloudScript} onChange={(v) => onSettings({ cloudScript: v })} />
          <Toggle label="Generated keyframes" desc="Replace procedural art with model imagery" checked={settings.cloudImages} onChange={(v) => onSettings({ cloudImages: v })} />
          <Toggle label="Generated motion clip" desc="Slow + costly; used for the hero shot" checked={settings.cloudVideo} onChange={(v) => onSettings({ cloudVideo: v })} />
          <Toggle label="Quality self-critique" desc="Iteratively rewrite weak shots & align to BPM" checked={settings.qualityBoost} onChange={(v) => onSettings({ qualityBoost: v })} />
          <div className="ms-note"><Sparkles size={12} /> Director v1 always decides style, motif, pacing, energy and shot count — cloud models only fill in copy and pixels.</div>
        </div>

        <div className="ms-footer">ClipForge AI · local-first by design</div>
      </div>
    </div>
  );
}
