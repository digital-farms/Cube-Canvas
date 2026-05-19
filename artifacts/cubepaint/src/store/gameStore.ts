import { create } from "zustand";
import { PALETTES } from "../utils/colors";

export type GridSize = 10 | 20 | 40;
export type PaletteName = keyof typeof PALETTES;

interface GameState {
  gridSize: GridSize;
  tileColors: Record<number, string>;
  selectedColor: string;
  paletteName: PaletteName;
  fillMode: boolean;
  randomColorMode: boolean;
  regionPaintMode: boolean;
  glowIntensity: number;
  autoRotate: boolean;
  showSettings: boolean;
  paintCount: number;

  setGridSize: (size: GridSize) => void;
  paintTile: (instanceId: number) => void;
  paintRegion: (ids: number[]) => void;
  preFill: () => void;
  setSelectedColor: (color: string) => void;
  setPalette: (name: PaletteName) => void;
  setFillMode: (v: boolean) => void;
  setRandomColorMode: (v: boolean) => void;
  setRegionPaintMode: (v: boolean) => void;
  setGlowIntensity: (v: number) => void;
  setAutoRotate: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  clearAll: () => void;
  getNextColor: () => string;
}

export const useGameStore = create<GameState>((set, get) => ({
  gridSize: 10,
  tileColors: {},
  selectedColor: PALETTES.neon[0],
  paletteName: "neon",
  fillMode: false,
  randomColorMode: false,
  regionPaintMode: false,
  glowIntensity: 0.6,
  autoRotate: false,
  showSettings: false,
  paintCount: 0,

  setGridSize: (size) => set({ gridSize: size, tileColors: {}, paintCount: 0 }),

  paintTile: (instanceId) => {
    const { randomColorMode, selectedColor, paletteName, tileColors } = get();
    const palette = PALETTES[paletteName];
    const color = randomColorMode
      ? palette[Math.floor(Math.random() * palette.length)]
      : selectedColor;
    if (tileColors[instanceId] === color) return;
    set((state) => ({
      tileColors: { ...state.tileColors, [instanceId]: color },
      paintCount: state.paintCount + 1,
    }));
  },

  paintRegion: (ids) => {
    const { randomColorMode, selectedColor, paletteName } = get();
    const palette = PALETTES[paletteName];
    const color = randomColorMode
      ? palette[Math.floor(Math.random() * palette.length)]
      : selectedColor;
    const patch: Record<number, string> = {};
    for (const id of ids) patch[id] = color;
    set((state) => ({
      tileColors: { ...state.tileColors, ...patch },
      paintCount: state.paintCount + ids.length,
    }));
  },

  preFill: () => {
    const { gridSize, paletteName } = get();
    const palette = PALETTES[paletteName];
    const total = 6 * gridSize * gridSize;
    const colors: Record<number, string> = {};
    for (let i = 0; i < total; i++) {
      colors[i] = palette[Math.floor(Math.random() * palette.length)];
    }
    set({ tileColors: colors, paintCount: total });
  },

  setSelectedColor: (color) => set({ selectedColor: color }),
  setPalette: (name) =>
    set({ paletteName: name, selectedColor: PALETTES[name][0] }),
  setFillMode: (v) => set({ fillMode: v }),
  setRandomColorMode: (v) => set({ randomColorMode: v }),
  setRegionPaintMode: (v) => set({ regionPaintMode: v }),
  setGlowIntensity: (v) => set({ glowIntensity: v }),
  setAutoRotate: (v) => set({ autoRotate: v }),
  setShowSettings: (v) => set({ showSettings: v }),

  clearAll: () => set({ tileColors: {}, paintCount: 0 }),

  getNextColor: () => {
    const { randomColorMode, selectedColor, paletteName } = get();
    const palette = PALETTES[paletteName];
    return randomColorMode
      ? palette[Math.floor(Math.random() * palette.length)]
      : selectedColor;
  },
}));
