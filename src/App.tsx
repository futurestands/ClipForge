import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Keyboard, X } from 'lucide-react';
import type { AssetItem, CloudScriptScene, GenSettings, Grade, Overlay, Project, Scene, TabId } from './types';
import { DEFAULT_SETTINGS } from './types';
import {
  clamp, downloadBlob, sceneAt, sleep, totalDuration, uid,
} from './lib/utils';
import { renderSceneArt } from './lib/art';
import {
  planShotCount, projectFromSettings, rerenderScene, rewriteScene, uploadedScene,
} from './lib/promptEngine';
import { predictDirection } from './lib/brain/director';
import { improveProject } from './lib/brain/quality';
import {
  applyCloudFrames, applyCloudVideo, cloudImages, cloudScript, cloudVideo,
  fetchStatus, OFFLINE_STATUS, setBudget, type GatewaySnapshot,
} from './lib/gateway';
import { renderPosterAsync } from './lib/exporter';
import { startPreviewAudio } from './lib/audio';
import TopBar from './components/TopBar';
import LeftRail from './components/LeftRail';
import AIPanel from './components/AIPanel';
import ModelPanel from './components/ModelPanel';
import AssetPanel from './components/AssetPanel';
import PreviewStage from './components/PreviewStage';
import Inspector from './components/Inspector';
import Timeline from './components/Timeline';
import ExportModal from './components/ExportModal';
import ScriptModal from './components/ScriptModal';

const GEN_STEPS = [
  'Director v1 reads the prompt',
  'Writing script & narration',
  'Composing scene artwork',
  'Building timeline & soundtrack',
  'Critic reviews the cut',
];

interface GenState { step: number; label: string; progress: number }

export default function App() {
  const [settings, setSettings] = useState<GenSettings>(DEFAULT_SETTINGS);
  const [project, setProject] = useState<Project | null>(null);
  const projectRef = useRef<Project | null>(null);
  const [draftName, setDraftName] = useState('');
  const [tab, setTab] = useState<TabId>('ai');
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [safeZone, setSafeZone] = useState(false);
  const [zoom, setZoom] = useState(64);
  const [snap, setSnap] = useState(true);
  const [gen, setGen] = useState<GenState | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gateway, setGateway] = useState<GatewaySnapshot>(OFFLINE_STATUS);

  const histRef = useRef<Project[]>([]);
  const futureRef = useRef<Project[]>([]);
  const [, setHistTick] = useState(0);
  const spokenRef = useRef<string>('');

  const showToast = useCallback((msg: string) => setToast(msg), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const refreshGateway = useCallback(async () => {
    setGateway(await fetchStatus());
  }, []);

  // Poll the optional local gateway; a missing gateway is a normal offline state.
  useEffect(() => {
    refreshGateway();
    const id = setInterval(refreshGateway, 20000);
    return () => clearInterval(id);
  }, [refreshGateway]);

  const pushHistory = useCallback((p: Project) => {
    histRef.current = [...histRef.current.slice(-29), p];
    futureRef.current = [];
    setHistTick((t) => t + 1);
  }, []);

  const commit = useCallback((fn: (p: Project) => Project) => {
    const p = projectRef.current;
    if (!p) return;
    pushHistory(p);
    const next = fn(p);
    projectRef.current = next;
    setProject(next);
  }, [pushHistory]);

  const undo = useCallback(() => {
    const h = histRef.current;
    if (!h.length) return;
    const prev = h[h.length - 1];
    histRef.current = h.slice(0, -1);
    if (projectRef.current) futureRef.current = [projectRef.current, ...futureRef.current].slice(0, 30);
    projectRef.current = prev;
    setProject(prev);
    setHistTick((t) => t + 1);
    showToast('Undo');
  }, [showToast]);

  const redo = useCallback(() => {
    const f = futureRef.current;
    if (!f.length) return;
    const next = f[0];
    futureRef.current = f.slice(1);
    if (projectRef.current) histRef.current = [...histRef.current, projectRef.current];
    projectRef.current = next;
    setProject(next);
    setHistTick((t) => t + 1);
    showToast('Redo');
  }, [showToast]);

  // keep playhead inside the project
  useEffect(() => {
    if (project) setTime((t) => Math.min(t, Math.max(0, totalDuration(project.scenes))));
  }, [project]);

  // playback clock
  useEffect(() => {
    if (!playing || !project) return;
    let raf = 0;
    let last = performance.now();
    const total = totalDuration(project.scenes);
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const nt = t + dt;
        if (nt >= total) {
          if (loop) return 0;
          setPlaying(false);
          return total;
        }
        return nt;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, project, loop]);

  // ambient soundtrack during preview
  useEffect(() => {
    if (!playing || !project || !project.soundtrack || muted) return;
    const stop = startPreviewAudio(project.style);
    return () => stop();
  }, [playing, project?.style, project?.soundtrack, project?.id, muted]);

  // optional browser voiceover, one line per scene
  useEffect(() => {
    if (!project || !playing || !voiceOn || project.voice === 'off' || muted || !('speechSynthesis' in window)) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      spokenRef.current = '';
      return;
    }
    const cur = sceneAt(project.scenes, time);
    if (cur.scene && spokenRef.current !== cur.scene.id) {
      spokenRef.current = cur.scene.id;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(cur.scene.narration);
        u.lang = project.voice;
        u.rate = 0.98;
        window.speechSynthesis.speak(u);
      } catch { /* speech not available */ }
    }
  }, [time, playing, voiceOn, project, muted]);

  const patchScene = useCallback((id: string, patch: Partial<Scene>) => {
    commit((p) => ({
      ...p,
      scenes: p.scenes.map((s) => {
        if (s.id !== id || (s.locked && patch.locked === undefined)) return s;
        let next: Scene = { ...s, ...patch };
        if (patch.speed !== undefined && patch.speed !== s.speed) {
          next.duration = clamp(Math.round((s.duration * s.speed / patch.speed) * 10) / 10, 0.5, 20);
        }
        if (patch.palette || patch.motif) {
          next.art = renderSceneArt(next, p.aspect, p.style);
        }
        return next;
      }),
    }));
  }, [commit]);

  const patchProject = useCallback((patch: Partial<Project>) => {
    commit((p) => ({ ...p, ...patch }));
  }, [commit]);

  const patchGrade = useCallback((patch: Partial<Grade>) => {
    commit((p) => ({ ...p, grade: { ...p.grade, ...patch } }));
  }, [commit]);

  const selectScene = useCallback((id: string) => {
    setSelectedSceneId(id);
    const p = projectRef.current;
    if (!p) return;
    let acc = 0;
    for (const s of p.scenes) {
      if (s.id === id) { setTime(acc); break; }
      acc += s.duration;
    }
  }, []);

  const splitAtPlayhead = useCallback(() => {
    const p = projectRef.current;
    if (!p) return;
    const { index, scene, start, local } = sceneAt(p.scenes, time);
    if (!scene) return;
    if (local < 0.35 || scene.duration - local < 0.35) {
      showToast('Move the playhead into the middle of a clip to split it');
      return;
    }
    const second: Scene = {
      ...scene,
      id: uid('scene'),
      duration: Math.round((scene.duration - local) * 10) / 10,
      overlays: scene.overlays.map((o) => ({ ...o, id: uid('ov') })),
    };
    commit((cur) => ({
      ...cur,
      scenes: cur.scenes.flatMap((s, i) =>
        i === index
          ? [{ ...s, duration: Math.round(local * 10) / 10 }, second]
          : [s],
      ),
    }));
    setSelectedSceneId(second.id);
    setTime(start + local);
    showToast('Clip split at playhead');
  }, [time, commit, showToast]);

  const deleteScene = useCallback((id: string) => {
    const p = projectRef.current;
    if (!p) return;
    if (p.scenes.length <= 1) { showToast('A project needs at least one clip'); return; }
    commit((cur) => ({ ...cur, scenes: cur.scenes.filter((s) => s.id !== id) }));
    setSelectedSceneId(null);
    showToast('Clip deleted');
  }, [commit, showToast]);

  const duplicateScene = useCallback((id: string) => {
    commit((p) => {
      const i = p.scenes.findIndex((s) => s.id === id);
      if (i < 0) return p;
      const copy: Scene = {
        ...p.scenes[i],
        id: uid('scene'),
        seed: (p.scenes[i].seed + 7717) >>> 0,
        overlays: p.scenes[i].overlays.map((o) => ({ ...o, id: uid('ov') })),
      };
      const scenes = [...p.scenes];
      scenes.splice(i + 1, 0, copy);
      return { ...p, scenes };
    });
    showToast('Clip duplicated');
  }, [commit, showToast]);

  const reorderScenes = useCallback((from: number, to: number) => {
    commit((p) => {
      const scenes = [...p.scenes];
      const [moved] = scenes.splice(from, 1);
      scenes.splice(to, 0, moved);
      return { ...p, scenes };
    });
  }, [commit]);

  const resizeScene = useCallback((id: string, duration: number) => {
    patchScene(id, { duration: Math.round(duration * 10) / 10 });
  }, [patchScene]);

  const regenerateScene = useCallback((id: string) => {
    commit((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === id ? rerenderScene(s, p) : s)) }));
    showToast('Scene artwork regenerated');
  }, [commit, showToast]);

  const rewriteSceneText = useCallback((id: string) => {
    commit((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === id ? rewriteScene(s, p) : s)) }));
    showToast('Scene rewritten by the prompt engine');
  }, [commit, showToast]);

  const selfCritique = useCallback(() => {
    const p = projectRef.current;
    if (!p) { showToast('Generate a cut first'); return; }
    const improved = improveProject(p, 3);
    commit(() => ({ ...improved.project, quality: improved.report }));
    showToast(`Critic: ${improved.report.passes} passes · grade ${improved.report.grade} · ${improved.report.overall}/100`);
  }, [commit, showToast]);

  const removeOverlay = useCallback((overlayId: string) => {
    const id = selectedSceneId;
    if (!id) return;
    commit((p) => ({
      ...p,
      scenes: p.scenes.map((s) => (s.id === id ? { ...s, overlays: s.overlays.filter((o) => o.id !== overlayId) } : s)),
    }));
  }, [selectedSceneId, commit]);

  const applyAsset = useCallback((asset: AssetItem) => {
    const id = selectedSceneId;
    if (!id) { showToast('Select a clip on the timeline first'); return; }
    if (asset.kind === 'audio') {
      patchProject({ bgm: asset.value });
      showToast(`Soundtrack: ${asset.label}`);
      return;
    }
    if (asset.kind === 'text' || asset.kind === 'stickers') {
      const overlay: Overlay = {
        id: uid('ov'),
        type: asset.kind === 'text' ? 'text' : 'sticker',
        content: asset.value,
        x: asset.kind === 'text' ? 0.5 : 0.8,
        y: asset.kind === 'text' ? 0.24 : 0.32,
        size: asset.kind === 'text' ? 68 : 120,
        color: '#ffffff',
      };
      commit((p) => ({
        ...p,
        scenes: p.scenes.map((s) => (s.id === id ? { ...s, overlays: [...s.overlays, overlay] } : s)),
      }));
      showToast(`${asset.label} added to clip`);
      return;
    }
    if (asset.kind === 'effects') patchScene(id, { effect: asset.value });
    if (asset.kind === 'transitions') patchScene(id, { transition: asset.value as Scene['transition'] });
    if (asset.kind === 'filters') patchScene(id, { filter: asset.value });
    showToast(`${asset.label} applied`);
  }, [selectedSceneId, patchProject, patchScene, commit, showToast]);

  const uploadFiles = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    const reads = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => new Promise<{ url: string; name: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ url: String(reader.result), name: f.name });
        reader.onerror = () => resolve({ url: '', name: f.name });
        reader.readAsDataURL(f);
      }));
    const loaded = (await Promise.all(reads)).filter((r) => r.url);
    if (!loaded.length) { showToast('No readable images found'); return; }
    const p = projectRef.current;
    if (!p) {
      showToast('Generate a project first, then import media');
      return;
    }
    const newScenes = loaded.map((r) => uploadedScene(r.url, r.name, p));
    commit((cur) => ({ ...cur, scenes: [...cur.scenes, ...newScenes] }));
    setSelectedSceneId(newScenes[newScenes.length - 1].id);
    showToast(`${newScenes.length} image${newScenes.length > 1 ? 's' : ''} added to timeline`);
  }, [commit, showToast]);

  const snapshot = useCallback(async () => {
    const p = projectRef.current;
    if (!p) return;
    try {
      const url = await renderPosterAsync(p, time);
      const blob = await (await fetch(url)).blob();
      downloadBlob(blob, 'clipforge-poster.png');
      showToast('Poster frame saved');
    } catch { showToast('Could not save the frame'); }
  }, [time, showToast]);

  const openAIStudio = useCallback(() => {
    setTab('ai');
    setTimeout(() => document.getElementById('ai-prompt')?.focus(), 60);
  }, []);

  const handleGenerate = useCallback(async () => {
    const prompt = settings.prompt.trim();
    if (!prompt || gen) return;
    setPlaying(false);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    // 1. Always run the in-house director first — cloud models only augment it.
    const direction = predictDirection(prompt);
    const style = settings.style === 'auto' ? direction.style : settings.style;
    const cloudOn = settings.useCloud && gateway.online;
    const fallbacks: string[] = [];
    if (cloudOn) await setBudget(settings.budgetCap);

    let scriptScenes: CloudScriptScene[] | undefined;
    let scriptSource: string | undefined;
    let generated: Project | null = null;

    for (let i = 0; i < GEN_STEPS.length; i++) {
      setGen({ step: i, label: GEN_STEPS[i], progress: i / GEN_STEPS.length });
      await sleep(200);

      // 2. Optional frontier LLM writes the shot list.
      if (i === 0 && cloudOn && settings.cloudScript && gateway.providers.script) {
        const r = await cloudScript({
          prompt, style, count: planShotCount(settings, direction), duration: settings.duration,
          cap: settings.budgetCap,
        });
        if (r.ok && r.data?.scenes.length) {
          scriptScenes = r.data.scenes;
          scriptSource = `${r.data.model} · frontier LLM`;
        } else if (r.reason) fallbacks.push('script');
      }

      // 3. Local generation (procedural art + critic), then optional cloud pixels.
      if (i === 2) {
        generated = projectFromSettings({ ...settings, prompt }, projectRef.current, {
          direction, scriptScenes, scriptSource, qualityBoost: settings.qualityBoost,
        });
        if (draftName && !settings.append) generated.name = draftName;

        if (cloudOn && settings.cloudImages && gateway.providers.image) {
          const r = await cloudImages({
            prompts: generated.scenes.map((s) => s.imagePrompt || prompt),
            aspect: settings.aspect,
            cap: settings.budgetCap,
          });
          if (r.ok && r.data?.images.some(Boolean)) generated = applyCloudFrames(generated, r.data.images);
          else fallbacks.push('images');
        }
        if (cloudOn && settings.cloudVideo && gateway.providers.video) {
          const r = await cloudVideo({
            prompt: generated.scenes[0]?.imagePrompt || prompt,
            aspect: settings.aspect,
            cap: settings.budgetCap,
          });
          if (r.ok && r.data?.videoUrl) generated = applyCloudVideo(generated, r.data.videoUrl);
          else fallbacks.push('video');
        }
      }

      if (i === 3 && generated) {
        const previous = projectRef.current;
        if (previous) pushHistory(previous);
        else { histRef.current = []; futureRef.current = []; setHistTick((t) => t + 1); }
        projectRef.current = generated;
        setProject(generated);
        const targetIndex = settings.append && previous ? previous.scenes.length : 0;
        const first = generated.scenes[targetIndex];
        setSelectedSceneId(first?.id ?? generated.scenes[0]?.id ?? null);
        let start = 0;
        for (let j = 0; j < targetIndex; j++) start += generated.scenes[j].duration;
        setTime(start);
      }

      if (i === GEN_STEPS.length - 1) refreshGateway();
    }

    setGen(null);
    setSettings((s) => ({ ...s, append: false }));
    setPlaying(true);
    const q = generated?.quality;
    const tail = fallbacks.length ? ` · local fallback (${fallbacks.join(', ')})` : '';
    showToast(`Generated ${generated?.scenes.length ?? 0} scenes · ${style}${q ? ` · ${q.grade} ${q.overall}/100` : ''}${tail}`);
  }, [settings, gen, draftName, gateway, pushHistory, refreshGateway, showToast]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') { e.preventDefault(); if (project) setPlaying((p) => !p); }
      else if (e.key === 'ArrowLeft') setTime((t) => Math.max(0, t - (e.shiftKey ? 1 : 0.2)));
      else if (e.key === 'ArrowRight') setTime((t) => Math.min(project ? totalDuration(project.scenes) : 0, t + (e.shiftKey ? 1 : 0.2)));
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'd' && selectedSceneId) { e.preventDefault(); duplicateScene(selectedSceneId); }
      else if (k === 's' && selectedSceneId) splitAtPlayhead();
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSceneId) { e.preventDefault(); deleteScene(selectedSceneId); }
      else if (e.key === 'Escape') { setExportOpen(false); setScriptOpen(false); setShortcutsOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, selectedSceneId, undo, redo, duplicateScene, splitAtPlayhead, deleteScene]);

  const selectedScene = project?.scenes.find((s) => s.id === selectedSceneId) ?? null;

  return (
    <div className="app">
      <TopBar
        project={project}
        name={project?.name || draftName || 'Untitled project'}
        onRename={(v) => { if (project) patchProject({ name: v }); else setDraftName(v); }}
        onAIStudio={openAIStudio}
        onExport={() => setExportOpen(true)}
        onUndo={undo}
        onRedo={redo}
        canUndo={histRef.current.length > 0}
        canRedo={futureRef.current.length > 0}
        onScript={() => setScriptOpen(true)}
      />

      <div className="workbench">
        <LeftRail tab={tab} onTab={setTab} onShortcuts={() => setShortcutsOpen(true)} />
        {tab === 'ai' ? (
          <AIPanel
            settings={settings}
            onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            onGenerate={handleGenerate}
            generation={gen}
            project={project}
            selectedSceneId={selectedSceneId}
            onSelectScene={selectScene}
            onOpenScript={() => setScriptOpen(true)}
            onRegenerateScene={regenerateScene}
            onRewriteScene={rewriteSceneText}
            onOpenExport={() => setExportOpen(true)}
          />
        ) : tab === 'models' ? (
          <ModelPanel
            settings={settings}
            onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            gateway={gateway}
            onRefresh={refreshGateway}
            project={project}
            onSelfCritique={selfCritique}
            onToast={showToast}
          />
        ) : (
          <AssetPanel
            tab={tab}
            project={project}
            selectedSceneId={selectedSceneId}
            onApply={applyAsset}
            onUpload={uploadFiles}
            onSelectScene={selectScene}
            onGrade={patchGrade}
            onRemoveOverlay={removeOverlay}
          />
        )}

        <PreviewStage
          project={project}
          time={time}
          playing={playing}
          loop={loop}
          voiceOn={voiceOn}
          muted={muted}
          safeZone={safeZone}
          onTogglePlay={() => setPlaying((p) => !p)}
          onSeek={(t) => setTime(clamp(t, 0, project ? totalDuration(project.scenes) : 0))}
          onToggleLoop={() => setLoop((v) => !v)}
          onToggleVoice={() => setVoiceOn((v) => !v)}
          onToggleMute={() => setMuted((v) => !v)}
          onToggleSafeZone={() => setSafeZone((v) => !v)}
          onSnapshot={snapshot}
          onAIStudio={openAIStudio}
        />

        <Inspector
          project={project}
          scene={selectedScene}
          onPatch={patchScene}
          onProjectPatch={patchProject}
          onRegenerate={regenerateScene}
          onRewrite={rewriteSceneText}
          onDuplicate={duplicateScene}
          onDelete={deleteScene}
          onRemoveOverlay={removeOverlay}
        />
      </div>

      <Timeline
        project={project}
        time={time}
        selectedSceneId={selectedSceneId}
        zoom={zoom}
        onZoom={setZoom}
        onSeek={(t) => setTime(clamp(t, 0, project ? totalDuration(project.scenes) : 0))}
        onSelect={selectScene}
        onResize={resizeScene}
        onReorder={reorderScenes}
        onSplit={splitAtPlayhead}
        onDelete={deleteScene}
        onDuplicate={duplicateScene}
        snap={snap}
        onToggleSnap={() => setSnap((v) => !v)}
        onOpenAI={openAIStudio}
        onOpenExport={() => setExportOpen(true)}
      />

      {exportOpen && project && (
        <ExportModal
          project={project}
          previewTime={time}
          onClose={() => setExportOpen(false)}
          onToast={showToast}
          onToggleCaptions={() => patchProject({ captions: !project.captions })}
        />
      )}
      {scriptOpen && project && <ScriptModal project={project} onClose={() => setScriptOpen(false)} />}
      {shortcutsOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShortcutsOpen(false); }}>
          <div className="modal shortcuts-modal">
            <div className="modal-head">
              <div><div className="modal-title"><Keyboard size={17} /> Keyboard shortcuts</div><div className="modal-sub">Move faster in the editor</div></div>
              <button type="button" className="modal-close" onClick={() => setShortcutsOpen(false)}><X size={17} /></button>
            </div>
            <div className="shortcut-list">
              {[
                ['Space', 'Play / pause'],
                ['← / →', 'Step 0.2s (Shift = 1s)'],
                ['S', 'Split clip at playhead'],
                ['Delete', 'Delete selected clip'],
                ['Ctrl + Z', 'Undo'],
                ['Ctrl + Y', 'Redo'],
                ['Ctrl + D', 'Duplicate clip'],
                ['Esc', 'Close dialogs'],
              ].map(([k, v]) => <div key={k}><kbd>{k}</kbd><span>{v}</span></div>)}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={14} /> {toast}</div>}
    </div>
  );
}
