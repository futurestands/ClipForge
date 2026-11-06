import { Check, ChevronDown, Download, ExternalLink, Redo2, Sparkles, Undo2 } from 'lucide-react';
import type { Project } from '../types';
import { totalDuration } from '../lib/utils';
import { IconBtn } from './ui';

interface Props {
  project: Project | null;
  name: string;
  onRename: (v: string) => void;
  onAIStudio: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onScript: () => void;
}

export default function TopBar({ project, name, onRename, onAIStudio, onExport, onUndo, onRedo, canUndo, canRedo, onScript }: Props) {
  const duration = project ? totalDuration(project.scenes) : 0;
  return (
    <header className="topbar">
      <div className="top-left">
        <div className="brand">
          <span className="brand-mark"><i /><i /></span>
          <span className="brand-name">ClipForge<span>AI</span></span>
        </div>
        <div className="top-sep" />
        <div className="project-meta">
          <input
            className="project-name"
            value={name}
            onChange={(e) => onRename(e.target.value)}
            spellCheck={false}
            aria-label="Project name"
          />
          <div className="project-status"><Check size={11} /> All changes saved locally</div>
        </div>
      </div>

      <div className="top-center">
        <IconBtn title="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}><Undo2 size={16} /></IconBtn>
        <IconBtn title="Redo (Ctrl+Y)" onClick={onRedo} disabled={!canRedo}><Redo2 size={16} /></IconBtn>
        <div className="top-sep" />
        <button className="top-text-btn" onClick={onScript} disabled={!project}>Script <ChevronDown size={12} /></button>
        <a className="top-text-btn project-link" href="/tea-for-two/" target="_blank" rel="noopener noreferrer"
           title="Open the generated Tea for Two project">
          Projects <ExternalLink size={12} />
        </a>
        {project && <span className="top-chip">{project.aspect} · {project.fps}fps · {duration.toFixed(1)}s</span>}
      </div>

      <div className="top-right">
        <button type="button" className="btn btn-ghost ai-top-btn" onClick={onAIStudio}>
          <Sparkles size={15} /> AI Studio
        </button>
        <button type="button" className="btn btn-primary" onClick={onExport} disabled={!project}>
          <Download size={15} /> Export
        </button>
        <div className="avatar" title="Local workspace">MJ</div>
      </div>
    </header>
  );
}
