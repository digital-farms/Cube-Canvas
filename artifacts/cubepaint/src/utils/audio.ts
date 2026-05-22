let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

export type AudioState = "off" | "suspended" | "running";

export function getAudioState(): AudioState {
  if (!ctx) return "off";
  return ctx.state === "running" ? "running" : "suspended";
}

function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.86, ctx.currentTime);
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function playSilentUnlockTick(audioCtx: AudioContext): void {
  const silentBuf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
  const silentSrc = audioCtx.createBufferSource();
  silentSrc.buffer = silentBuf;
  silentSrc.connect(audioCtx.destination);
  silentSrc.start(0);

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.00001, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.03);
}

export function unlockAudio(): Promise<AudioContext> {
  try {
    const audioCtx = getAudioContext();
    playSilentUnlockTick(audioCtx);

    if (audioCtx.state === "running") {
      return Promise.resolve(audioCtx);
    }

    return new Promise((resolve, reject) => {
      const done = window.setTimeout(() => {
        audioCtx.removeEventListener("statechange", onState);
        if (audioCtx.state === "running") resolve(audioCtx);
        else reject(new Error("AudioContext did not start"));
      }, 1200);

      const onState = () => {
      if (audioCtx.state === "running") {
          window.clearTimeout(done);
          audioCtx.removeEventListener("statechange", onState);
        resolve(audioCtx);
      }
      };

      audioCtx.addEventListener("statechange", onState);
      audioCtx.resume().then(onState).catch(reject);
    });
  } catch (e) {
    return Promise.reject(e);
  }
}

function getOut(): GainNode {
  return masterGain!;
}

function withAudio(play: (audioCtx: AudioContext, t: number) => void): void {
  try {
    const audioCtx = getAudioContext();
    if (audioCtx.state === "running") {
      play(audioCtx, audioCtx.currentTime + 0.012);
      return;
    }

    playSilentUnlockTick(audioCtx);
    play(audioCtx, audioCtx.currentTime + 0.06);
    void audioCtx.resume();
  } catch { /* noop */ }
}

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 784.0, 880.0];

function pickNote(seed: number): number {
  return PENTATONIC[Math.abs(seed) % PENTATONIC.length];
}

function tone(audioCtx: AudioContext, freq: number, vol: number, duration: number, t: number): void {
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.96, t + duration);

  const harm = audioCtx.createOscillator();
  harm.type = "triangle";
  harm.frequency.setValueAtTime(freq * 2, t);

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  const hg = audioCtx.createGain();
  hg.gain.setValueAtTime(vol * 0.2, t);
  hg.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.4);

  osc.connect(g);
  harm.connect(hg);
  hg.connect(g);
  g.connect(getOut());

  osc.start(t);
  harm.start(t);
  osc.stop(t + duration + 0.05);
  harm.stop(t + duration + 0.05);
}

export function playPaintSound(color: string): void {
  withAudio((audioCtx, t) => {
    const freq = pickNote(parseInt(color.replace("#", "").slice(0, 2), 16));
    tone(audioCtx, freq, 0.18, 0.7, t);
  });
}

export function playRegionFillSound(regionSize: number): void {
  withAudio((audioCtx, t) => {
    const steps = Math.min(regionSize, 8);
    for (let i = 0; i < steps; i++) {
      tone(audioCtx, PENTATONIC[i % PENTATONIC.length], 0.15 - i * 0.01, 0.75, t + i * 0.055);
    }
  });
}

export function playMenuChime(): void {
  withAudio((audioCtx, t) => {
    [392.0, 493.88, 587.33, 783.99].forEach((freq, i) => {
      tone(audioCtx, freq, 0.18, 1.3, t + 0.03 + i * 0.14);
    });
  });
}

export function playPaletteSound(): void {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.012;
  tone(ctx, 523.25, 0.13, 0.5, t);
  tone(ctx, 659.25, 0.11, 0.45, t + 0.09);
}

let lastRotSound = 0;
export function playRotateSound(): void {
  if (!ctx || ctx.state !== "running") return;
  const ms = Date.now();
  if (ms - lastRotSound < 350) return;
  lastRotSound = ms;

  const audioCtx = ctx;
  const t = audioCtx.currentTime + 0.02;
  const len = Math.floor(audioCtx.sampleRate * 0.08);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.45;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const filt = audioCtx.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.setValueAtTime(1500, t);
  filt.Q.setValueAtTime(0.4, t);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.025, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  src.connect(filt);
  filt.connect(g);
  g.connect(getOut());
  src.start(t);
  src.stop(t + 0.1);
}

export function startAmbientMusic(): void {
  // Intentionally silent: the app keeps a spacious background and only plays
  // short tactile sounds on user actions.
  unlockAudio().catch(() => { /* noop */ });
}

export function triggerHaptic(): void {
  try { if ("vibrate" in navigator) navigator.vibrate(10); } catch { /* noop */ }
}
