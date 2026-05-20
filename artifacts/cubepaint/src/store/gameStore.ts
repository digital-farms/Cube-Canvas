import { create } from "zustand";
import { PALETTES } from "../utils/colors";

export type GridSize = 10 | 20 | 40;
export type PaletteName = keyof typeof PALETTES;
export type GameMode = "draw" | "repaint" | null;

interface GameState {
  gameMode: GameMode;
  gridSize: GridSize;
  tileColors: Record<number, string>;
  selectedColor: string;
  paletteName: PaletteName;
  glowIntensity: number;
  autoRotate: boolean;
  showSettings: boolean;
  paintCount: number;

  startGame: (mode: "draw" | "repaint") => void;
  backToMenu: () => void;
  paintTile: (instanceId: number) => void;
  paintRegion: (ids: number[]) => void;
  preFill: () => void;
  setSelectedColor: (color: string) => void;
  setPalette: (name: PaletteName) => void;
  setGridSize: (size: GridSize) => void;
  setGlowIntensity: (v: number) => void;
  setAutoRotate: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  clearAll: () => void;
  getNextColor: () => string;
}

function buildPreFill(gridSize: GridSize, paletteName: PaletteName): Record<number, string> {
  const palette = PALETTES[paletteName];
  const total = 6 * gridSize * gridSize;
  const colors: Record<number, string> = {};
  for (let i = 0; i < total; i++) {
    colors[i] = palette[Math.floor(Math.random() * palette.length)];
  }
  return colors;
}

export const useGameStore = create<GameState>((set, get) => ({
  gameMode: null,
  gridSize: 10,
  tileColors: {},
  selectedColor: PALETTES.neon[0],
  paletteName: "neon",
  glowIntensity: 0.65,
  autoRotate: false,
  showSettings: false,
  paintCount: 0,

  startGame: (mode) => {
    const { gridSize, paletteName } = get();
    if (mode === "repaint") {
      const colors = buildPreFill(gridSize, paletteName);
      set({ gameMode: mode, tileColors: colors, paintCount: Object.keys(colors).length });
    } else {
      set({ gameMode: mode, tileColors: {}, paintCount: 0 });
    }
  },

  backToMenu: () => set({ gameMode: null, tileColors: {}, paintCount: 0 }),

  paintTile: (id) => {
    const { selectedColor, tileColors } = get();
    if (tileColors[id] === selectedColor) return;
    set((s) => ({
      tileColors: { ...s.tileColors, [id]: selectedColor },
      paintCount: s.paintCount + 1,
    }));
  },

  paintRegion: (ids) => {
    const { selectedColor } = get();
    const patch: Record<number, string> = {};
    for (const id of ids) patch[id] = selectedColor;
    set((s) => ({
      tileColors: { ...s.tileColors, ...patch },
      paintCount: s.paintCount + ids.length,
    }));
  },

  preFill: () => {
    const { gridSize, paletteName } = get();
    const colors = buildPreFill(gridSize, paletteName);
    set({ tileColors: colors, paintCount: Object.keys(colors).length });
  },

  setSelectedColor: (color) => set({ selectedColor: color }),

  setPalette: (name) => {
    const { gameMode, gridSize } = get();
    const newColor = PALETTES[name][0];
    if (gameMode === "repaint") {
      const colors = buildPreFill(gridSize, name);
      set({ paletteName: name, selectedColor: newColor, tileColors: colors });
    } else {
      set({ paletteName: name, selectedColor: newColor });
    }
  },

  setGridSize: (size) => {
    const { gameMode, paletteName } = get();
    if (gameMode === "repaint") {
      const colors = buildPreFill(size, paletteName);
      set({ gridSize: size, tileColors: colors, paintCount: Object.keys(colors).length });
    } else {
      set({ gridSize: size, tileColors: {}, paintCount: 0 });
    }
  },

  setGlowIntensity: (v) => set({ glowIntensity: v }),
  setAutoRotate: (v) => set({ autoRotate: v }),
  setShowSettings: (v) => set({ showSettings: v }),

  clearAll: () => {
    const { gameMode, gridSize, paletteName } = get();
    if (gameMode === "repaint") {
      const colors = buildPreFill(gridSize, paletteName);
      set({ tileColors: colors, paintCount: Object.keys(colors).length });
    } else {
      set({ tileColors: {}, paintCount: 0 });
    }
  },

  getNextColor: () => get().selectedColor,
}));
