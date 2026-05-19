let audioCtx: AudioContext | null = null;
let ambientGainNode: GainNode | null = null;
let ambientStarted = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playPaintSound(color: string): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

    const hex = color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const freq = 220 + (r / 255) * 440;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.05);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
  }
}

export function startAmbientMusic(): void {
  if (ambientStarted) return;
  ambientStarted = true;
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

    ambientGainNode = ctx.createGain();
    ambientGainNode.gain.setValueAtTime(0.04, ctx.currentTime);
    ambientGainNode.connect(ctx.destination);

    const notes = [55, 82.5, 110, 146.8, 220];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.05 + i * 0.02, ctx.currentTime);
      lfoGain.gain.setValueAtTime(freq * 0.002, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(ambientGainNode!);

      osc.start();
      lfo.start();
    });
  } catch {
  }
}

export function stopAmbientMusic(): void {
  if (ambientGainNode) {
    try {
      const ctx = getAudioContext();
      ambientGainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    } catch {
    }
    ambientStarted = false;
  }
}

export function triggerHaptic(): void {
  if ("vibrate" in navigator) {
    navigator.vibrate(15);
  }
}
