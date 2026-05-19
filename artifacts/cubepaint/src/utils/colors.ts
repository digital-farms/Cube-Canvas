export const PALETTES = {
  neon: [
    "#FF0080", "#FF8C00", "#FFE500", "#00FF41",
    "#00FFFF", "#0080FF", "#8000FF", "#FF00FF",
  ],
  pastel: [
    "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9",
    "#BAE1FF", "#E8BAFF", "#FFB3E6", "#B3F0FF",
  ],
  vaporwave: [
    "#FF71CE", "#01CDFE", "#05FFA1", "#B967FF",
    "#FFFB96", "#FF6B6B", "#4ECDC4", "#45B7D1",
  ],
  monochrome: [
    "#FFFFFF", "#E0E0E0", "#BDBDBD", "#9E9E9E",
    "#757575", "#616161", "#424242", "#212121",
  ],
  synthwave: [
    "#FF00FF", "#CC00FF", "#9900FF", "#FF0066",
    "#FF3300", "#FF9900", "#00FFCC", "#00CCFF",
  ],
} as const;

export type PaletteName = keyof typeof PALETTES;

export const PALETTE_LABELS: Record<PaletteName, string> = {
  neon: "Neon",
  pastel: "Pastel",
  vaporwave: "Vaporwave",
  monochrome: "Mono",
  synthwave: "Synthwave",
};

export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

export const DEFAULT_TILE_COLOR = "#1a1a2e";
export const HOVER_COLOR = "#ffffff";
