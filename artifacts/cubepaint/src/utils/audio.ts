let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientStarted = false;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1, ctx.currentTime);
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function out(): GainNode {
  getCtx();
  return masterGain!;
}

// Soft reverb-like tail using two delayed copies
function createReverb(audioCtx: AudioContext, dest: AudioNode): GainNode {
  const wet = audioCtx.createGain();
  wet.gain.setValueAtTime(0.18, audioCtx.currentTime);
  const delay1 = audioCtx.createDelay(0.5);
  delay1.delayTime.setValueAtTime(0.08, audioCtx.currentTime);
  const delay2 = audioCtx.createDelay(0.5);
  delay2.delayTime.setValueAtTime(0.15, audioCtx.currentTime);
  const fb = audioCtx.createGain();
  fb.gain.setValueAtTime(0.25, audioCtx.currentTime);
  wet.connect(delay1);
  wet.connect(delay2);
  delay1.connect(fb);
  delay2.connect(fb);
  fb.connect(delay1);
  fb.connect(dest);
  return wet;
}

// Single crystal-bowl note
function crystalNote(freq: number, vol: number, decay: number, t: number): void {
  const audioCtx = getCtx();
  const dest = out();

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

  const o1 = audioCtx.createOscillator();
  o1.type = "sine";
  o1.frequency.setValueAtTime(freq, t);
  o1.frequency.exponentialRampToValueAtTime(freq * 0.97, t + decay);

  // Harmonic overlay (softens the tone)
  const o2 = audioCtx.createOscillator();
  o2.type = "triangle";
  o2.frequency.setValueAtTime(freq * 2.01, t);
  const g2 = audioCtx.createGain();
  g2.gain.setValueAtTime(vol * 0.3, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.5);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3500, t);
  filter.Q.setValueAtTime(0.5, t);

  const reverb = createReverb(audioCtx, dest);

  o1.connect(filter);
  o2.connect(g2);
  g2.connect(filter);
  filter.connect(g);
  g.connect(dest);
  g.connect(reverb);

  o1.start(t);
  o2.start(t);
  o1.stop(t + decay + 0.1);
  o2.stop(t + decay + 0.1);
}

// Pentatonic scale frequencies for pleasing sounds
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 784.0, 880.0];

function pickNote(seed: number): number {
  return PENTATONIC[Math.abs(seed) % PENTATONIC.length];
}

// ─── Public API ────────────────────────────────────────────────────────────

/** Soft single-tile paint sound — ASMR crystal tap */
export function playPaintSound(color: string): void {
  try {
    const audioCtx = getCtx();
    const t = audioCtx.currentTime;
    const hash = parseInt(color.replace("#", "").slice(0, 2), 16);
    const freq = pickNote(hash);
    crystalNote(freq, 0.055, 0.55, t);
  } catch { /* silent fail */ }
}

/** Satisfying cascade for region fill */
export function playRegionFillSound(regionSize: number): void {
  try {
    const audioCtx = getCtx();
    const t = audioCtx.currentTime;
    const steps = Math.min(regionSize, 8);
    for (let i = 0; i < steps; i++) {
      const freq = PENTATONIC[i % PENTATONIC.length];
      crystalNote(freq, 0.04 - i * 0.003, 0.6, t + i * 0.045);
    }
  } catch { /* silent fail */ }
}

/** Soft chime for menu / mode select */
export function playMenuChime(): void {
  try {
    const audioCtx = getCtx();
    const t = audioCtx.currentTime;
    // Ascending triad
    [392.0, 493.88, 587.33, 783.99].forEach((freq, i) => {
      crystalNote(freq, 0.06, 0.9, t + i * 0.1);
    });
  } catch { /* silent fail */ }
}

/** Gentle palette switch sound */
export function playPaletteSound(): void {
  try {
    const audioCtx = getCtx();
    const t = audioCtx.currentTime;
    crystalNote(523.25, 0.05, 0.4, t);
    crystalNote(659.25, 0.04, 0.35, t + 0.07);
  } catch { /* silent fail */ }
}

/** Subtle soft rotation whisper (noise burst) */
let lastRotSound = 0;
export function playRotateSound(): void {
  try {
    const now = Date.now();
    if (now - lastRotSound < 300) return;
    lastRotSound = now;
    const audioCtx = getCtx();
    const t = audioCtx.currentTime;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(0.3, t);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.018, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(filter);
    filter.connect(g);
    g.connect(out());
    src.start(t);
    src.stop(t + 0.1);
  } catch { /* silent fail */ }
}

/** Deep ambient drone — meditative ASMR pads */
export function startAmbientMusic(): void {
  if (ambientStarted) return;
  ambientStarted = true;
  try {
    const audioCtx = getCtx();
    const t = audioCtx.currentTime;

    const ambGain = audioCtx.createGain();
    ambGain.gain.setValueAtTime(0, t);
    ambGain.gain.linearRampToValueAtTime(0.032, t + 3);
    ambGain.connect(out());

    // Low drone layers — slightly detuned for warmth
    const dronePairs: [number, number][] = [
      [55.0, 55.05],    // Sub bass A1
      [82.41, 82.48],   // E2
      [110.0, 110.07],  // A2
      [164.81, 164.9],  // E3
      [220.0, 220.1],   // A3
    ];

    dronePairs.forEach(([f1, f2], i) => {
      [f1, f2].forEach((freq) => {
        const osc = audioCtx.createOscillator();
        osc.type = i === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, t);

        // Slow breathing LFO
        const lfo = audioCtx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.03 + i * 0.008, t);
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.setValueAtTime(freq * 0.0012, t);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(t);

        // Volume LFO (subtle tremolo)
        const trem = audioCtx.createOscillator();
        trem.type = "sine";
        trem.frequency.setValueAtTime(0.07 + i * 0.015, t);
        const tremGain = audioCtx.createGain();
        tremGain.gain.setValueAtTime(0.012, t);
        trem.connect(tremGain);

        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(0.7, t);
        tremGain.connect(oscGain.gain);
        trem.start(t);

        osc.connect(oscGain);
        oscGain.connect(ambGain);
        osc.start(t);
      });
    });

    // High shimmer — faint upper harmonics
    [880, 1108.7, 1318.5].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.018 - i * 0.005, t);
      const lfo = audioCtx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.04 + i * 0.02, t);
      const lg = audioCtx.createGain();
      lg.gain.setValueAtTime(0.008, t);
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start(t);
      osc.connect(g);
      g.connect(ambGain);
      osc.start(t);
    });
  } catch { /* silent fail */ }
}

export function triggerHaptic(): void {
  try {
    if ("vibrate" in navigator) navigator.vibrate(12);
  } catch { /* silent fail */ }
}
