// iOS/Chrome-on-iPhone Web Audio:
// - AudioContext must be created AND resume()d during a synchronous user gesture.
// - After that, audio can play from any callback (Promise.then, statechange, etc.).
// - Creating a NEW AudioContext every gesture is the most reliable pattern.
// - Simple oscillator graphs are safer than complex node networks on mobile.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientStarted = false;

export type AudioState = "off" | "suspended" | "running";

export function getAudioState(): AudioState {
  if (!ctx) return "off";
  if (ctx.state === "running") return "running";
  return "suspended";
}

// ─── Core: create + unlock ───────────────────────────────────────────────────

/**
 * Create/reuse the AudioContext and fully unlock it.
 * MUST be called from a synchronous user-gesture handler (click/touchend).
 * Returns a Promise that resolves once the context is confirmed "running".
 */
export function unlockAudio(): Promise<AudioContext> {
  return new Promise((resolve, reject) => {
    try {
      if (!ctx || ctx.state === "closed") {
        const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
        ctx = new Ctx();
        masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(1, 0);
        masterGain.connect(ctx.destination);
      }

      const audioCtx = ctx;

      // Play 1-sample silent buffer — canonical iOS unlock trick
      const silentBuf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
      const silentSrc = audioCtx.createBufferSource();
      silentSrc.buffer = silentBuf;
      silentSrc.connect(audioCtx.destination);
      silentSrc.start(0);

      if (audioCtx.state === "running") {
        resolve(audioCtx);
        return;
      }

      // Resume and wait until "running"
      audioCtx.resume().then(() => {
        if (audioCtx.state === "running") {
          resolve(audioCtx);
        } else {
          // statechange fallback
          const onState = () => {
            if (audioCtx.state === "running") {
              audioCtx.removeEventListener("statechange", onState);
              resolve(audioCtx);
            }
          };
          audioCtx.addEventListener("statechange", onState);
          setTimeout(() => {
            audioCtx.removeEventListener("statechange", onState);
            if (audioCtx.state === "running") resolve(audioCtx);
            else reject(new Error("AudioContext did not start"));
          }, 2000);
        }
      }).catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

function getOut(): GainNode {
  return masterGain!;
}

// ─── Synth helpers ────────────────────────────────────────────────────────────

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 784.0, 880.0];
function pickNote(seed: number): number {
  return PENTATONIC[Math.abs(seed) % PENTATONIC.length];
}

/**
 * Simple crystal tone — minimal node graph, reliable on mobile.
 * `t` must be in the future relative to audioCtx.currentTime.
 */
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

// ─── Public play functions ────────────────────────────────────────────────────
// All play functions:
// 1. Call unlockAudio() to ensure context is running
// 2. Schedule in the .then() callback — context is CONFIRMED running there,
//    so currentTime is valid and we can schedule at currentTime + small_offset.

/** Single tile paint — crystal tap. Call from pointer/touch handler. */
export function playPaintSound(color: string): void {
  try {
    const freq = pickNote(parseInt(color.replace("#", "").slice(0, 2), 16));
    if (ctx && ctx.state === "running") {
      // Fast path — context already running, play immediately
      tone(ctx, freq, 0.18, 0.7, ctx.currentTime + 0.02);
    } else {
      // Slow path — also works from pointer events (they are user gestures)
      unlockAudio().then((audioCtx) => {
        tone(audioCtx, freq, 0.18, 0.7, audioCtx.currentTime + 0.02);
      }).catch(() => { /* noop */ });
    }
  } catch { /* noop */ }
}

/** Region fill cascade. Call from pointer/touch handler. */
export function playRegionFillSound(regionSize: number): void {
  try {
    const steps = Math.min(regionSize, 8);
    if (ctx && ctx.state === "running") {
      const base = ctx.currentTime + 0.02;
      for (let i = 0; i < steps; i++) {
        tone(ctx, PENTATONIC[i % PENTATONIC.length], 0.15 - i * 0.01, 0.75, base + i * 0.055);
      }
    } else {
      unlockAudio().then((audioCtx) => {
        const base = audioCtx.currentTime + 0.02;
        for (let i = 0; i < steps; i++) {
          tone(audioCtx, PENTATONIC[i % PENTATONIC.length], 0.15 - i * 0.01, 0.75, base + i * 0.055);
        }
      }).catch(() => { /* noop */ });
    }
  } catch { /* noop */ }
}

/** Welcome chime on mode entry. Call from click handler and await. */
export function playMenuChime(): void {
  unlockAudio().then((audioCtx) => {
    const base = audioCtx.currentTime + 0.04;
    [392.0, 493.88, 587.33, 783.99].forEach((freq, i) => {
      tone(audioCtx, freq, 0.18, 1.3, base + i * 0.14);
    });
  }).catch(() => { /* noop */ });
}

/** Palette switch. */
export function playPaletteSound(): void {
  if (!ctx || ctx.state !== "running") return;
  try {
    const t = ctx.currentTime + 0.02;
    tone(ctx, 523.25, 0.13, 0.5, t);
    tone(ctx, 659.25, 0.11, 0.45, t + 0.09);
  } catch { /* noop */ }
}

/** Subtle rotation whisper. */
let lastRotSound = 0;
export function playRotateSound(): void {
  try {
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
  } catch { /* noop */ }
}

// ─── Ambient ──────────────────────────────────────────────────────────────────

function launchDrones(audioCtx: AudioContext): void {
  const t = audioCtx.currentTime + 0.05;
  const ambG = audioCtx.createGain();
  ambG.gain.setValueAtTime(0, t);
  ambG.gain.linearRampToValueAtTime(0.06, t + 5);
  ambG.connect(getOut());

  // Use audible frequencies only (avoid <80Hz — inaudible on phone speakers)
  const pairs: [number, number][] = [
    [110.0, 110.07],
    [164.81, 164.9],
    [220.0,  220.11],
    [329.63, 329.7],
  ];

  pairs.forEach(([f1, f2], i) => {
    [f1, f2].forEach((freq) => {
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      const lfo = audioCtx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.04 + i * 0.01, t);
      const lG = audioCtx.createGain();
      lG.gain.setValueAtTime(freq * 0.001, t);
      lfo.connect(lG);
      lG.connect(osc.frequency);
      lfo.start(t);
      const oG = audioCtx.createGain();
      oG.gain.setValueAtTime(0.55, t);
      osc.connect(oG);
      oG.connect(ambG);
      osc.start(t);
    });
  });
}

/** Meditative ambient pads. Call from click handler. */
export function startAmbientMusic(): void {
  if (ambientStarted) return;
  ambientStarted = true;
  unlockAudio()
    .then((audioCtx) => launchDrones(audioCtx))
    .catch(() => { ambientStarted = false; });
}

// ─── Haptic ───────────────────────────────────────────────────────────────────

export function triggerHaptic(): void {
  try { if ("vibrate" in navigator) navigator.vibrate(12); } catch { /* noop */ }
}
