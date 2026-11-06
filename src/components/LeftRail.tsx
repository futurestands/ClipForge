import {
  Aperture,
  BrainCircuit,
  ImagePlus,
  MoveHorizontal,
  Music2,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Type,
  Wand2,
  Keyboard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TabId } from '../types';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'ai', label: 'AI Video', icon: Sparkles },
  { id: 'models', label: 'Models', icon: BrainCircuit },
  { id: 'media', label: 'Media', icon: ImagePlus },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'stickers', label: 'Stickers', icon: Smile },
  { id: 'effects', label: 'Effects', icon: Wand2 },
  { id: 'transitions', label: 'Transitions', icon: MoveHorizontal },
  { id: 'filters', label: 'Filters', icon: Aperture },
  { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
];

export default function LeftRail({ tab, onTab, onShortcuts }: { tab: TabId; onTab: (t: TabId) => void; onShortcuts: () => void }) {
  return (
    <nav className="left-rail">
      <div className="rail-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              type="button"
              key={t.id}
              className={`rail-tab${tab === t.id ? ' active' : ''}${t.id === 'ai' ? ' ai' : ''}`}
              onClick={() => onTab(t.id)}
              title={t.label}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="rail-help" onClick={onShortcuts} title="Keyboard shortcuts">
        <Keyboard size={17} />
      </button>
    </nav>
  );
}
