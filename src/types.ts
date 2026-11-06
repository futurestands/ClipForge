export type AspectId = '16:9' | '9:16' | '1:1' | '4:3';
export type StyleId = 'cinematic' | 'anime' | 'neon' | 'watercolor' | 'threeD' | 'doc';
export type MotionId = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'drift';
export type TransitionId = 'dissolve' | 'fade' | 'slide' | 'zoom' | 'whip' | 'none';
export type MotifId = 'nature' | 'city' | 'ocean' | 'space' | 'product' | 'people' | 'abstract';
export type ResolutionId = '720p' | '1080p' | '4K';
export type StyleChoice = StyleId | 'auto';
export type TabId = 'ai' | 'models' | 'media' | 'audio' | 'text' | 'stickers' | 'effects' | 'transitions' | 'filters' | 'adjust';
export type CloudCapability = 'script' | 'image' | 'video' | 'voice';

export interface Overlay {
  id: string;
  type: 'text' | 'sticker';
  content: string;
  x: number;   // 0..1 relative to frame
  y: number;
  size: number; // px at 1080-height reference
  color: string;
}

export interface Scene {
  id: string;
  beat: string;
  duration: number;
  caption: string;
  narration: string;
  camera: string;
  motion: MotionId;
  transition: TransitionId;
  palette: string[];
  seed: number;
  art: string;
  motif: MotifId;
  speed: number;
  opacity: number;
  scale: number;
  rotate: number;
  volume: number;
  filter: string;
  effect: string;
  overlays: Overlay[];
  locked: boolean;
  /** Prompt sent to an external image model, when cloud frames are used. */
  imagePrompt?: string;
  /** URL of a generated motion clip from an external video model. */
  videoUrl?: string;
  /** Per-shot quality score from the local critic (0-100). */
  quality?: number;
  /** Where the artwork came from. */
  source?: 'procedural' | 'cloud-image' | 'upload';
}

export interface Grade {
  brightness: number; // 0.5 - 1.5
  contrast: number;
  saturation: number;
}

export interface Project {
  id: string;
  name: string;
  prompt: string;
  style: StyleId;
  aspect: AspectId;
  resolution: ResolutionId;
  fps: 24 | 30 | 60;
  voice: string;
  captions: boolean;
  soundtrack: boolean;
  watermark: boolean;
  motionIntensity: number;
  scenes: Scene[];
  bgm: string;
  script: string;
  grade: Grade;
  createdAt: number;
  /** Snapshot of the critic report at generation time. */
  quality?: QualityReport;
  /** Director-model prediction used for this cut. */
  direction?: DirectionPrediction;
}

export interface ShotScore {
  sceneId: string;
  score: number;
  relevance: number;
  variety: number;
  readability: number;
  pacing: number;
  notes: string[];
}

export interface QualityReport {
  overall: number;
  grade: 'S' | 'A' | 'B' | 'C';
  axes: { relevance: number; variety: number; coherence: number; pacing: number; continuity: number };
  shots: ShotScore[];
  suggestions: string[];
  passes: number;
}

export interface DirectionPrediction {
  style: StyleId;
  motif: MotifId;
  confidence: number;
  pacing: number;   // cuts per 10 seconds
  energy: number;   // 0..1
  shots: number;
  model: string;
}

export interface GenSettings {
  prompt: string;
  style: StyleChoice;
  aspect: AspectId;
  duration: number;
  resolution: ResolutionId;
  fps: 24 | 30 | 60;
  voice: string;
  captions: boolean;
  soundtrack: boolean;
  motionIntensity: number;
  append: boolean;
  useCloud: boolean;
  cloudScript: boolean;
  cloudImages: boolean;
  cloudVideo: boolean;
  qualityBoost: boolean;
  budgetCap: number;
}

export interface CloudModelConfig {
  scriptModel: string;
  imageModel: string;
  videoModel: string;
  voiceModel: string;
}

export interface CloudScriptScene {
  caption: string;
  narration: string;
  camera: string;
  imagePrompt?: string;
  beat?: string;
}

export interface GatewayStatus {
  online: boolean;
  providers: Record<CloudCapability, boolean>;
  labels: Record<CloudCapability, string>;
  budget: { spent: number; cap: number; calls: number };
  version: string;
}

export interface AssetItem {
  id: string;
  label: string;
  kind: TabId;
  value: string;
  preview: string;
  emoji?: string;
  meta?: string;
}

export const ASPECT_RATIO: Record<AspectId, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3,
};

export const RESOLUTION_SIZE: Record<ResolutionId, number> = {
  '720p': 720,
  '1080p': 1080,
  '4K': 2160,
};

export const DEFAULT_CLOUD_MODELS: CloudModelConfig = {
  scriptModel: 'gpt-5.1',
  imageModel: 'fal-ai/flux-2-pro',
  videoModel: 'fal-ai/veo3.1',
  voiceModel: 'eleven_multilingual_v2',
};

export const DEFAULT_SETTINGS: GenSettings = {
  prompt: '',
  style: 'auto',
  aspect: '16:9',
  duration: 15,
  resolution: '1080p',
  fps: 30,
  voice: 'en-US',
  captions: true,
  soundtrack: true,
  motionIntensity: 0.55,
  append: false,
  useCloud: true,
  cloudScript: true,
  cloudImages: true,
  cloudVideo: false,
  qualityBoost: true,
  budgetCap: 2.5,
};

export const DEFAULT_GRADE: Grade = { brightness: 1, contrast: 1, saturation: 1 };

export const STYLE_LABEL: Record<StyleId, string> = {
  cinematic: 'Cinematic',
  anime: 'Anime',
  neon: 'Neon Cyber',
  watercolor: 'Watercolor',
  threeD: '3D Render',
  doc: 'Documentary',
};

export const STYLE_PALETTE: Record<StyleId, string[]> = {
  cinematic: ['#0a1a33', '#1d4b74', '#d98a4e', '#f7d9a8'],
  anime: ['#62b8f0', '#bfe6ff', '#ff9fc0', '#fff0b8'],
  neon: ['#090520', '#43107a', '#ff3f9a', '#2ce8ff'],
  watercolor: ['#f6ead9', '#efae9b', '#9dbba9', '#cdb6dd'],
  threeD: ['#111a33', '#3f5b9c', '#8ed8ff', '#ffcfa1'],
  doc: ['#101e27', '#31505f', '#b9cfc6', '#e8d4b3'],
};
