import type { AssetItem, TabId } from '../types';

export const ASSETS: Partial<Record<TabId, AssetItem[]>> = {
  audio: [
    { id: 'a1', label: 'Cinematic Drones', kind: 'audio', value: 'Cinematic Drones · 82 BPM · A minor', preview: 'linear-gradient(135deg,#1b2a4a,#6c5b95)', meta: '2:14' },
    { id: 'a2', label: 'Synthwave Pulse', kind: 'audio', value: 'Synthwave Pulse · 110 BPM · F minor', preview: 'linear-gradient(135deg,#3b0d63,#ff3ea5)', meta: '1:48' },
    { id: 'a3', label: 'Warm Piano', kind: 'audio', value: 'Warm Piano & Strings · 68 BPM · G major', preview: 'linear-gradient(135deg,#e5b48a,#9db7a6)', meta: '2:32' },
    { id: 'a4', label: 'Lo-Fi Morning', kind: 'audio', value: 'Lo-Fi Morning · 86 BPM · C major', preview: 'linear-gradient(135deg,#5c6b73,#d9c3a5)', meta: '3:01' },
    { id: 'a5', label: 'Epic Rise', kind: 'audio', value: 'Epic Rise · 96 BPM · D minor', preview: 'linear-gradient(135deg,#2b1b3d,#e0663f)', meta: '1:22' },
    { id: 'a6', label: 'Ambient Field', kind: 'audio', value: 'Ambient Field Recordings · 72 BPM', preview: 'linear-gradient(135deg,#20343a,#a8c3b4)', meta: '4:05' },
  ],
  text: [
    { id: 't1', label: 'Bold Title', kind: 'text', value: 'BIG IDEA', preview: 'linear-gradient(135deg,#111,#444)', meta: 'Uppercase' },
    { id: 't2', label: 'Minimal Caption', kind: 'text', value: 'a quiet moment', preview: 'linear-gradient(135deg,#2a2a2a,#555)', meta: 'Light' },
    { id: 't3', label: 'Neon Glow', kind: 'text', value: 'AFTER DARK', preview: 'linear-gradient(135deg,#3b0d63,#22e6ff)', meta: 'Neon' },
    { id: 't4', label: 'Callout', kind: 'text', value: 'NEW · LIMITED', preview: 'linear-gradient(135deg,#8b2e2e,#ffb36b)', meta: 'Badge' },
    { id: 't5', label: 'Quote', kind: 'text', value: '“stay curious”', preview: 'linear-gradient(135deg,#26343f,#a8b8c4)', meta: 'Serif-ish' },
    { id: 't6', label: 'Location', kind: 'text', value: 'TOKYO · 23:41', preview: 'linear-gradient(135deg,#12203a,#4f7ac0)', meta: 'Mono' },
    { id: 't7', label: 'Price Tag', kind: 'text', value: '¥ 299', preview: 'linear-gradient(135deg,#3d2b12,#e7bd6a)', meta: 'Accent' },
    { id: 't8', label: 'Subscribe', kind: 'text', value: 'FOLLOW FOR MORE', preview: 'linear-gradient(135deg,#0d3b33,#4ee1d8)', meta: 'CTA' },
  ],
  stickers: [
    { id: 's1', label: 'Sparkles', kind: 'stickers', value: '✨', preview: 'linear-gradient(135deg,#3a2b5c,#7d6cff)', emoji: '✨' },
    { id: 's2', label: 'Fire', kind: 'stickers', value: '🔥', preview: 'linear-gradient(135deg,#5c2412,#ff8a3d)', emoji: '🔥' },
    { id: 's3', label: 'Heart', kind: 'stickers', value: '💜', preview: 'linear-gradient(135deg,#3b1b4d,#c86bff)', emoji: '💜' },
    { id: 's4', label: 'Star', kind: 'stickers', value: '⭐', preview: 'linear-gradient(135deg,#4a3a12,#ffd35c)', emoji: '⭐' },
    { id: 's5', label: 'Camera', kind: 'stickers', value: '🎬', preview: 'linear-gradient(135deg,#17303b,#4ee1d8)', emoji: '🎬' },
    { id: 's6', label: 'Bolt', kind: 'stickers', value: '⚡', preview: 'linear-gradient(135deg,#3b2f0d,#ffe066)', emoji: '⚡' },
    { id: 's7', label: 'Rocket', kind: 'stickers', value: '🚀', preview: 'linear-gradient(135deg,#17213d,#6d9bff)', emoji: '🚀' },
    { id: 's8', label: 'Wave', kind: 'stickers', value: '🌊', preview: 'linear-gradient(135deg,#0e3b4a,#39d6ff)', emoji: '🌊' },
  ],
  effects: [
    { id: 'e0', label: 'None', kind: 'effects', value: 'none', preview: 'linear-gradient(135deg,#222,#333)', meta: 'Off' },
    { id: 'e1', label: 'Light Leak', kind: 'effects', value: 'light-leak', preview: 'linear-gradient(135deg,#7a3b12,#ffd08a)', meta: 'Warm' },
    { id: 'e2', label: 'Bokeh', kind: 'effects', value: 'bokeh', preview: 'linear-gradient(135deg,#1b2c3a,#c8e0a0)', meta: 'Dreamy' },
    { id: 'e3', label: 'Glitch', kind: 'effects', value: 'glitch', preview: 'linear-gradient(135deg,#2b0e3d,#22e6ff)', meta: 'Digital' },
    { id: 'e4', label: 'Film Grain', kind: 'effects', value: 'grain', preview: 'linear-gradient(135deg,#3a3733,#8a8276)', meta: 'Analog' },
  ],
  transitions: [
    { id: 'tr0', label: 'Dissolve', kind: 'transitions', value: 'dissolve', preview: 'linear-gradient(135deg,#1d3a5c,#8ec5ff)', meta: '0.6s' },
    { id: 'tr1', label: 'Fade', kind: 'transitions', value: 'fade', preview: 'linear-gradient(135deg,#111,#555)', meta: '0.6s' },
    { id: 'tr2', label: 'Slide', kind: 'transitions', value: 'slide', preview: 'linear-gradient(135deg,#2b4b3a,#7ee0a0)', meta: '0.6s' },
    { id: 'tr3', label: 'Zoom', kind: 'transitions', value: 'zoom', preview: 'linear-gradient(135deg,#4a2450,#ff8ad0)', meta: '0.6s' },
    { id: 'tr4', label: 'Whip', kind: 'transitions', value: 'whip', preview: 'linear-gradient(135deg,#43301a,#ffd166)', meta: '0.6s' },
    { id: 'tr5', label: 'None', kind: 'transitions', value: 'none', preview: 'linear-gradient(135deg,#222,#333)', meta: 'Cut' },
  ],
  filters: [
    { id: 'f0', label: 'Original', kind: 'filters', value: 'none', preview: 'linear-gradient(135deg,#3a4a5c,#c3d3e0)' },
    { id: 'f1', label: 'Vivid', kind: 'filters', value: 'vivid', preview: 'linear-gradient(135deg,#0c6b5b,#ffd166)' },
    { id: 'f2', label: 'Warm', kind: 'filters', value: 'warm', preview: 'linear-gradient(135deg,#8a4a1e,#f4c58a)' },
    { id: 'f3', label: 'Cool', kind: 'filters', value: 'cool', preview: 'linear-gradient(135deg,#164a6b,#9fe0ff)' },
    { id: 'f4', label: 'Mono', kind: 'filters', value: 'mono', preview: 'linear-gradient(135deg,#111,#bbb)' },
    { id: 'f5', label: 'Faded', kind: 'filters', value: 'faded', preview: 'linear-gradient(135deg,#7b8a86,#dcd3c3)' },
    { id: 'f6', label: 'Noir', kind: 'filters', value: 'noir', preview: 'linear-gradient(135deg,#000,#4a4a4a)' },
  ],
};

export const VOICES = [
  { id: 'off', label: 'No voiceover' },
  { id: 'en-US', label: 'Narrator · English (US)' },
  { id: 'en-GB', label: 'Narrator · English (UK)' },
  { id: 'zh-CN', label: '旁白 · 普通话' },
  { id: 'ja-JP', label: 'ナレーション · 日本語' },
  { id: 'es-ES', label: 'Narrador · Español' },
];
