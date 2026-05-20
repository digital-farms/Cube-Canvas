// ─── iOS Safari / Chrome-on-iOS notes ───────────────────────────────────────
//
// iOS rules for Web Audio:
//  1. AudioContext must be created AND resumed inside a synchronous user-gesture
//     handler (click / touchend). React's onClick satisfies this.
//  2. After resume(), the context may still be "suspended" for a short time.
//     Scheduling notes at currentTime + X while suspended → X is in the past
//     when the context finally starts running → notes are silently dropped.
//  3. Solution: call whenRunning() which waits for "running" state via
//     statechange event, then schedules with currentTime + small safe offset.
//  4. After the first unlock, audio can play from any callback (no gesture
//     required) as long as the context stays running.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientStarted = false;

// ─── Context management ──────────────────────────────────────────────────────

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1, 0);
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function out(): GainNode {
  return masterGain!;
}

/**
 * Call synchronously from a user-gesture handler.
 * Resumes the context and plays a 1-sample silent buffer — the canonical iOS
 * unlock. After this, iOS allows further audio even outside gesture handlers.
 */
function unlock(): void {
  const audioCtx = getCtx();
  audioCtx.resume().catch(() => {});

  // Silent buffer: required for iOS Safari to fully unlock the context
  try {
    const buf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
  } catch { /* noop */ }
}

/**
 * Runs `fn` as soon as the AudioContext is in "running" state.
 * If it's already running, calls immediately. Otherwise waits for
 * statechange (with a 300ms timeout fallback).
 */
function whenRunning(fn: () => void): void {
  const audioCtx = getCtx();

  if (audioCtx.state === "running") {
    fn();
    return;
  }

  let done = false;

  const handler = () => {
    if (done) return;
    if (audioCtx.state === "running") {
      done = true;
      audioCtx.removeEventListener("statechange", handler);
      fn();
    }
  };

  audioCtx.addEventListener("statechange", handler);

  // Fallback: if statechange never fires but context is running within 500ms
  setTimeout(() => {
    if (done) return;
    done = true;
    audioCtx.removeEventListener("statechange", handler);
    if (audioCtx.state === "running") fn();
  }, 500);
}

// ─── Pentatonic scale ────────────────────────────────────────────────────────

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 784.0, 880.0];
function pickNote(seed: number): number {
  return PENTATONIC[Math.abs(seed) % PENTATONIC.length];
}

// ─── Low-level synth ─────────────────────────────────────────────────────────

function crystalNote(audioCtx: AudioContext, freq: number, vol: number, decay: number, tOffset: number): void {
  const t = audioCtx.currentTime + tOffset;

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

  const o1 = audioCtx.createOscillator();
  o1.type = "sine";
  o1.frequency.setValueAtTime(freq, t);
  o1.frequency.exponentialRampToValueAtTime(freq * 0.972, t + decay);

  const o2 = audioCtx.createOscillator();
  o2.type = "triangle";
  o2.frequency.setValueAtTime(freq * 2.01, t);
  const g2 = audioCtx.createGain();
  g2.gain.setValueAtTime(vol * 0.25, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.4);

  // Simple 1-tap delay for room feel (no feedback loop — safer on mobile)
  const delay = audioCtx.createDelay(0.5);
  delay.delayTime.setValueAtTime(0.11, t);
  const delayGain = audioCtx.createGain();
  delayGain.gain.setValueAtTime(0.14, t);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(5000, t);

  o1.connect(filter);
  o2.connect(g2);
  g2.connect(filter);
  filter.connect(g);
  g.connect(out());
  g.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(out());

  o1.start(t);
  o2.start(t);
  o1.stop(t + decay + 0.2);
  o2.stop(t + decay + 0.2);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Single tile paint — ASMR crystal tap. Call from pointer/touch handler. */
export function playPaintSound(color: string): void {
  try {
    unlock();
    const hash = parseInt(color.replace("#", "").slice(0, 2), 16);
    const freq = pickNote(hash);
    whenRunning(() => {
      crystalNote(getCtx(), freq, 0.13, 0.65, 0.02);
    });
  } catch { /* noop */ }
}

/** Region fill cascade. Call from pointer/touch handler. */
export function playRegionFillSound(regionSize: number): void {
  try {
    unlock();
    const steps = Math.min(regionSize, 9);
    whenRunning(() => {
      const audioCtx = getCtx();
      for (let i = 0; i < steps; i++) {
        crystalNote(audioCtx, PENTATONIC[i % PENTATONIC.length], 0.11 - i * 0.008, 0.7, 0.02 + i * 0.05);
      }
    });
  } catch { /* noop */ }
}

/** Welcome chime on mode select. Call from click handler. */
export function playMenuChime(): void {
  try {
    unlock();
    whenRunning(() => {
      const audioCtx = getCtx();
      [392.0, 493.88, 587.33, 783.99].forEach((freq, i) => {
        crystalNote(audioCtx, freq, 0.14, 1.2, 0.02 + i * 0.13);
      });
    });
  } catch { /* noop */ }
}

/** Palette switch sound. */
export function playPaletteSound(): void {
  try {
    unlock();
    whenRunning(() => {
      const audioCtx = getCtx();
      crystalNote(audioCtx, 523.25, 0.11, 0.5, 0.02);
      crystalNote(audioCtx, 659.25, 0.09, 0.45, 0.1);
    });
  } catch { /* noop */ }
}

/** Subtle rotation whisper — only plays if context already running. */
let lastRotSound = 0;
export function playRotateSound(): void {
  try {
    const ms = Date.now();
    if (ms - lastRotSound < 350) return;
    lastRotSound = ms;
    if (!ctx || ctx.state !== "running") return;
    const audioCtx = ctx;
    const t = audioCtx.currentTime + 0.02;
    const sampleLen = Math.floor(audioCtx.sampleRate * 0.09);
    const buf = audioCtx.createBuffer(1, sampleLen, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < sampleLen; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(0.35, t);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.022, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(filter);
    filter.connect(g);
    g.connect(out());
    src.start(t);
    src.stop(t + 0.12);
  } catch { /* noop */ }
}

// ─── Ambient drone ───────────────────────────────────────────────────────────

function launchDrones(audioCtx: AudioContext): void {
  const t = audioCtx.currentTime + 0.05;

  const ambGain = audioCtx.createGain();
  ambGain.gain.setValueAtTime(0, t);
  ambGain.gain.linearRampToValueAtTime(0.055, t + 5);
  ambGain.connect(out());

  const dronePairs: [number, number][] = [
    [55.0,   55.06],
    [82.41,  82.50],
    [110.0,  110.08],
    [164.81, 164.92],
    [220.0,  220.11],
  ];

  dronePairs.forEach(([f1, f2], i) => {
    [f1, f2].forEach((freq) => {
      const osc = audioCtx.createOscillator();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, t);

      const lfo = audioCtx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.03 + i * 0.008, t);
      const lfoG = audioCtx.createGain();
      lfoG.gain.setValueAtTime(freq * 0.0013, t);
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      lfo.start(t);

      const trem = audioCtx.createOscillator();
      trem.type = "sine";
      trem.frequency.setValueAtTime(0.07 + i * 0.015, t);
      const tremG = audioCtx.createGain();
      tremG.gain.setValueAtTime(0.014, t);
      trem.connect(tremG);

      const oscG = audioCtx.createGain();
      oscG.gain.setValueAtTime(0.7, t);
      tremG.connect(oscG.gain);
      trem.start(t);

      osc.connect(oscG);
      oscG.connect(ambGain);
      osc.start(t);
    });
  });

  [880, 1108.7, 1318.5].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.026 - i * 0.006, t);
    const lfo = audioCtx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.04 + i * 0.02, t);
    const lg = audioCtx.createGain();
    lg.gain.setValueAtTime(0.009, t);
    lfo.connect(lg);
    lg.connect(g.gain);
    lfo.start(t);
    osc.connect(g);
    g.connect(ambGain);
    osc.start(t);
  });
}

/** Meditative ambient pads. Must be called from a user-gesture handler. */
export function startAmbientMusic(): void {
  if (ambientStarted) return;
  ambientStarted = true;
  try {
    unlock();
    whenRunning(() => launchDrones(getCtx()));
  } catch { ambientStarted = false; }
}

// ─── Haptic ──────────────────────────────────────────────────────────────────

export function triggerHaptic(): void {
  try {
    if ("vibrate" in navigator) navigator.vibrate(12);
  } catch { /* noop */ }
}
