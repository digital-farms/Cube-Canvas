// ─── AudioContext management ────────────────────────────────────────────────
//
// iOS Safari is the strictest browser for Web Audio:
//   1. AudioContext must be created AND unlocked during a user gesture.
//   2. Even then, it can start "suspended" on older iOS.
//   3. A silent buffer start + resume() call is required to fully unlock it.
//
// Rule: NEVER call getCtx() outside a user-gesture handler.
// All exported play* functions + startAmbientMusic must be called from clicks/taps.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientStarted = false;
let ctxUnlocked = false;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1, 0);
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

/**
 * Must be called synchronously inside a user-gesture handler (click/touchstart).
 * Creates and unlocks the AudioContext for iOS Safari.
 */
function unlock(): void {
  const audioCtx = getCtx();
  if (ctxUnlocked && audioCtx.state === "running") return;

  // Step 1: call resume() — iOS needs this even if state looks "running"
  audioCtx.resume().catch(() => {/* noop */});

  // Step 2: play a 1-sample silent buffer — the canonical iOS unlock trick
  try {
    const buf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
  } catch { /* noop */ }

  ctxUnlocked = true;
}

function out(): GainNode {
  getCtx();
  return masterGain!;
}

// Safe start time: a small offset so notes schedule after context is running
function now(): number {
  return getCtx().currentTime + 0.04;
}

// ─── Reverb / room tail ─────────────────────────────────────────────────────

function createReverb(audioCtx: AudioContext, dest: AudioNode): GainNode {
  const wet = audioCtx.createGain();
  wet.gain.setValueAtTime(0.18, audioCtx.currentTime);
  const d1 = audioCtx.createDelay(0.5);
  d1.delayTime.setValueAtTime(0.08, audioCtx.currentTime);
  const d2 = audioCtx.createDelay(0.5);
  d2.delayTime.setValueAtTime(0.15, audioCtx.currentTime);
  const fb = audioCtx.createGain();
  fb.gain.setValueAtTime(0.22, audioCtx.currentTime);
  wet.connect(d1);
  wet.connect(d2);
  d1.connect(fb);
  d2.connect(fb);
  fb.connect(d1);
  fb.connect(dest);
  return wet;
}

// ─── Pentatonic scale ────────────────────────────────────────────────────────

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 784.0, 880.0];
function pickNote(seed: number): number {
  return PENTATONIC[Math.abs(seed) % PENTATONIC.length];
}

// ─── Low-level tone synthesiser ─────────────────────────────────────────────

function crystalNote(freq: number, vol: number, decay: number, t: number): void {
  const audioCtx = getCtx();
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

  const o1 = audioCtx.createOscillator();
  o1.type = "sine";
  o1.frequency.setValueAtTime(freq, t);
  o1.frequency.exponentialRampToValueAtTime(freq * 0.97, t + decay);

  const o2 = audioCtx.createOscillator();
  o2.type = "triangle";
  o2.frequency.setValueAtTime(freq * 2.01, t);
  const g2 = audioCtx.createGain();
  g2.gain.setValueAtTime(vol * 0.28, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.45);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(4000, t);
  filter.Q.setValueAtTime(0.5, t);

  const reverb = createReverb(audioCtx, out());

  o1.connect(filter);
  o2.connect(g2);
  g2.connect(filter);
  filter.connect(g);
  g.connect(out());
  g.connect(reverb);

  o1.start(t);
  o2.start(t);
  o1.stop(t + decay + 0.15);
  o2.stop(t + decay + 0.15);
}

// ─── Public play functions ───────────────────────────────────────────────────

/** Soft single-tile paint sound. Must be called from a user-gesture handler. */
export function playPaintSound(color: string): void {
  try {
    unlock();
    const t = now();
    const hash = parseInt(color.replace("#", "").slice(0, 2), 16);
    const freq = pickNote(hash);
    crystalNote(freq, 0.12, 0.6, t);
  } catch { /* silent fail */ }
}

/** Satisfying cascade for region fill. Must be called from a user-gesture handler. */
export function playRegionFillSound(regionSize: number): void {
  try {
    unlock();
    const t = now();
    const steps = Math.min(regionSize, 9);
    for (let i = 0; i < steps; i++) {
      const freq = PENTATONIC[i % PENTATONIC.length];
      crystalNote(freq, 0.1 - i * 0.008, 0.65, t + i * 0.05);
    }
  } catch { /* silent fail */ }
}

/** Welcome chime when entering a mode. */
export function playMenuChime(): void {
  try {
    unlock();
    const t = now();
    [392.0, 493.88, 587.33, 783.99].forEach((freq, i) => {
      crystalNote(freq, 0.13, 1.1, t + i * 0.12);
    });
  } catch { /* silent fail */ }
}

/** Gentle palette switch sound. */
export function playPaletteSound(): void {
  try {
    unlock();
    const t = now();
    crystalNote(523.25, 0.1, 0.45, t);
    crystalNote(659.25, 0.08, 0.4, t + 0.08);
  } catch { /* silent fail */ }
}

/** Subtle rotation whisper (noise burst). */
let lastRotSound = 0;
export function playRotateSound(): void {
  try {
    const ms = Date.now();
    if (ms - lastRotSound < 350) return;
    lastRotSound = ms;
    if (!ctxUnlocked) return; // don't create context for rotation alone
    const audioCtx = getCtx();
    const t = audioCtx.currentTime + 0.02;
    const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.09), audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
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
  } catch { /* silent fail */ }
}

// ─── Ambient drone ───────────────────────────────────────────────────────────

function launchDrones(audioCtx: AudioContext): void {
  const t = audioCtx.currentTime + 0.05;

  const ambGain = audioCtx.createGain();
  ambGain.gain.setValueAtTime(0, t);
  ambGain.gain.linearRampToValueAtTime(0.05, t + 4);
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
    g.gain.setValueAtTime(0.024 - i * 0.006, t);
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

/**
 * Deep ambient drone. Must be called from a user-gesture handler.
 * Waits for AudioContext to be fully running before launching oscillators.
 */
export function startAmbientMusic(): void {
  if (ambientStarted) return;
  ambientStarted = true;
  try {
    unlock();
    const audioCtx = getCtx();
    if (audioCtx.state === "running") {
      launchDrones(audioCtx);
    } else {
      audioCtx.resume()
        .then(() => launchDrones(audioCtx))
        .catch(() => { ambientStarted = false; });
    }
  } catch { ambientStarted = false; }
}

// ─── Haptic ──────────────────────────────────────────────────────────────────

export function triggerHaptic(): void {
  try {
    if ("vibrate" in navigator) navigator.vibrate(12);
  } catch { /* noop */ }
}
