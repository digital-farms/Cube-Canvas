import * as THREE from "three";

/** Shared paint state read by ReactiveLight in useFrame (no React re-render cost). */
export const paintEvent = {
  color: new THREE.Color("#8000ff"),
  age: 99,  // seconds since last paint — high = no recent paint
};

/** DOM element for CSS flash. */
let _flashEl: HTMLElement | null = null;
let _flashTimer: ReturnType<typeof setTimeout> | null = null;

export function registerFlashEl(el: HTMLElement | null): void {
  _flashEl = el;
}

/** Call from any paint event — fires CSS flash + updates reactive light color. */
export function triggerPaintFlash(color: string, intensity = 0.18): void {
  paintEvent.color.set(color);
  paintEvent.age = 0;

  const el = _flashEl;
  if (!el) return;
  if (_flashTimer) clearTimeout(_flashTimer);
  const safeIntensity = Math.max(0.04, Math.min(0.28, intensity));
  el.style.setProperty("--pf-color", color);
  el.style.setProperty("--pf-intensity", String(safeIntensity));
  el.classList.remove("pf-active");
  void el.offsetWidth; // force reflow
  el.classList.add("pf-active");
  _flashTimer = setTimeout(() => el.classList.remove("pf-active"), 650);
}
