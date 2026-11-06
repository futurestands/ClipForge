import { Check, Copy, Download, FileText, X } from 'lucide-react';
import { useState } from 'react';
import type { Project } from '../types';
import { downloadText } from '../lib/utils';

interface Props {
  project: Project;
  onClose: () => void;
}

export default function ScriptModal({ project, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const slug = project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(project.script);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = project.script;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal script-modal">
        <div className="modal-head">
          <div>
            <div className="modal-title"><FileText size={17} /> AI script & shot list</div>
            <div className="modal-sub">{project.scenes.length} scenes · generated from your prompt</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="script-body">
          <div className="script-prompt"><span>PROMPT</span>{project.prompt}</div>
          <div className="script-scenes">
            {project.scenes.map((s, i) => (
              <div key={s.id} className="script-scene">
                <div className="script-thumb" style={{ backgroundImage: `url(${s.art})` }}><span>{String(i + 1).padStart(2, '0')}</span></div>
                <div className="script-scene-body">
                  <div className="script-scene-head">{s.beat} · {s.duration.toFixed(1)}s · {s.camera}</div>
                  <div className="script-caption">{s.caption}</div>
                  <div className="script-narration">{s.narration}</div>
                </div>
              </div>
            ))}
          </div>
          <pre className="script-raw">{project.script}</pre>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy script'}</button>
          <button type="button" className="btn btn-primary" onClick={() => downloadText(project.script, `${slug}-script.txt`)}><Download size={14} /> Download .txt</button>
        </div>
      </div>
    </div>
  );
}
