import type { StyleId } from '../types';

// Gentle procedural ambient bed: a slow chord progression with filtered harmonics.
const CHORDS: Record<StyleId, number[][]> = {
  cinematic: [[110, 164.81, 220, 329.63], [98, 146.83, 196, 293.66], [87.31, 130.81, 174.61, 261.63]],
  anime: [[261.63, 329.63, 392, 523.25], [293.66, 369.99, 440, 587.33], [220, 277.18, 329.63, 440]],
  neon: [[110, 164.81, 207.65, 311.13], [98, 146.83, 185, 277.18], [123.47, 185, 233.08, 349.23]],
  watercolor: [[196, 246.94, 293.66, 392], [174.61, 220, 261.63, 349.23], [164.81, 207.65, 246.94, 329.63]],
  threeD: [[130.81, 196, 261.63, 392], [116.54, 174.61, 233.08, 349.23], [146.83, 220, 293.66, 440]],
  doc: [[146.83, 220, 293.66], [130.81, 196, 261.63], [110, 164.81, 220]],
};

interface Built {
  stop: () => void;
}

function build(ctx: AudioContext, output: AudioNode, style: StyleId, level: number): Built {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(level, ctx.currentTime + 0.9);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = style === 'neon' ? 1400 : 900;
  filter.Q.value = 0.4;
  filter.connect(master);
  master.connect(output);

  const oscillators: OscillatorNode[] = [];
  const lfos: OscillatorNode[] = [];
  const chords = CHORDS[style];
  const chordLen = 5.2;

  chords.forEach((chord, ci) => {
    chord.forEach((freq, ni) => {
      const osc = ctx.createOscillator();
      osc.type = ni % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (ni - 1.5) * 4;

      const g = ctx.createGain();
      const start = ctx.currentTime + ci * chordLen;
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.setValueAtTime(0.0001, Math.max(0, start - 0.01));
      g.gain.linearRampToValueAtTime(0.16 / chord.length, start + 0.9);
      g.gain.setValueAtTime(0.16 / chord.length, start + chordLen - 1.1);
      g.gain.linearRampToValueAtTime(0.0001, start + chordLen);

      // slow tremolo so the pad breathes
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.09 + ni * 0.035;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.03;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);

      osc.connect(g);
      g.connect(filter);
      osc.start();
      lfo.start();
      oscillators.push(osc);
      lfos.push(lfo);
    });
  });

  // airy noise sweep
  const noiseLen = 2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.25;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 700;
  nf.Q.value = 0.7;
  const ng = ctx.createGain();
  ng.gain.value = 0.014;
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(master);
  noise.start();

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      const all = [...oscillators, ...lfos, noise];
      setTimeout(() => {
        all.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
      }, 450);
    },
  };
}

export function startPreviewAudio(style: StyleId): () => void {
  try {
    const ctx = new AudioContext();
    const amb = build(ctx, ctx.destination, style, 0.075);
    return () => { amb.stop(); setTimeout(() => { void ctx.close(); }, 600); };
  } catch {
    return () => undefined;
  }
}

export function createExportAudio(style: StyleId): { track: MediaStreamTrack; stop: () => void } | null {
  try {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const amb = build(ctx, dest, style, 0.12);
    return {
      track: dest.stream.getAudioTracks()[0],
      stop: () => { amb.stop(); setTimeout(() => { void ctx.close(); }, 600); },
    };
  } catch {
    return null;
  }
}
