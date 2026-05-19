import { useState, useCallback } from "react";
import { useGameStore } from "../store/gameStore";
import { PALETTES, PALETTE_LABELS, PaletteName } from "../utils/colors";
import { startAmbientMusic } from "../utils/audio";

export default function PaletteUI() {
  const {
    selectedColor, setSelectedColor, paletteName, setPalette,
    fillMode, setFillMode, randomColorMode, setRandomColorMode,
    regionPaintMode, setRegionPaintMode, preFill,
    setShowSettings, showSettings,
  } = useGameStore();

  const [showPalettePicker, setShowPalettePicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleColorClick = useCallback((color: string) => {
    startAmbientMusic();
    setSelectedColor(color);
    setShowColorPicker(false);
  }, [setSelectedColor]);

  const palette = PALETTES[paletteName as PaletteName];
  const paletteNames = Object.keys(PALETTES) as PaletteName[];

  return (
    <div className="palette-ui">
      {showPalettePicker && (
        <div className="palette-popup">
          <div className="palette-popup-title">Выбрать палитру</div>
          {paletteNames.map((name) => (
            <button
              key={name}
              className={`palette-option ${name === paletteName ? "active" : ""}`}
              onClick={() => {
                setPalette(name);
                setShowPalettePicker(false);
              }}
            >
              <div className="palette-swatches">
                {PALETTES[name].slice(0, 6).map((c) => (
                  <div key={c} className="palette-swatch-mini" style={{ background: c }} />
                ))}
              </div>
              <span>{PALETTE_LABELS[name]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="palette-bar">
        {/* Palette switcher */}
        <button
          className="palette-palette-btn"
          onClick={() => {
            startAmbientMusic();
            setShowPalettePicker((v) => !v);
            setShowColorPicker(false);
          }}
          title="Сменить палитру"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="10" r="3" />
            <circle cx="6.5" cy="16" r="2.5" />
            <circle cx="17.5" cy="16" r="2.5" />
          </svg>
        </button>

        {/* Color swatches */}
        <div className="palette-colors">
          {palette.map((color) => (
            <button
              key={color}
              className={`color-swatch ${selectedColor === color && !randomColorMode ? "selected" : ""}`}
              style={{ background: color }}
              onClick={() => {
                setRandomColorMode(false);
                handleColorClick(color);
              }}
            />
          ))}
          <button
            className={`color-swatch custom-color ${showColorPicker ? "selected" : ""}`}
            onClick={() => setShowColorPicker((v) => !v)}
            title="Свой цвет"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {showColorPicker && (
            <input
              type="color"
              className="hidden-color-picker"
              value={selectedColor}
              onChange={(e) => {
                setRandomColorMode(false);
                handleColorClick(e.target.value);
              }}
              autoFocus
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="palette-actions">
          {/* Pre-fill cube */}
          <button
            className="action-btn"
            onClick={() => {
              startAmbientMusic();
              preFill();
            }}
            title="Случайное заполнение куба"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>

          {/* Region paint mode */}
          <button
            className={`action-btn ${regionPaintMode ? "active" : ""}`}
            onClick={() => {
              startAmbientMusic();
              setRegionPaintMode(!regionPaintMode);
              if (!regionPaintMode) {
                setFillMode(false);
              }
            }}
            title="Закраска региона одним касанием"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z" />
            </svg>
          </button>

          {/* Random color */}
          <button
            className={`action-btn ${randomColorMode ? "active" : ""}`}
            onClick={() => {
              startAmbientMusic();
              setRandomColorMode(!randomColorMode);
            }}
            title="Случайный цвет"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
            </svg>
          </button>

          {/* Fill drag mode */}
          <button
            className={`action-btn ${fillMode ? "active" : ""}`}
            onClick={() => {
              startAmbientMusic();
              setFillMode(!fillMode);
              if (!fillMode) setRegionPaintMode(false);
            }}
            title="Рисовать при перемещении"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 3a3 3 0 0 0-3 3l-7 7 2 2 7-7a3 3 0 0 0 3-3V3z" />
              <path d="M5 12L3 21l9-2" />
            </svg>
          </button>

          {/* Settings */}
          <button
            className={`action-btn ${showSettings ? "active" : ""}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Настройки"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="selected-color-preview">
        <div
          className="color-indicator"
          style={{
            background: randomColorMode
              ? "linear-gradient(135deg, #ff0080, #00ffff, #ff8800)"
              : selectedColor,
          }}
        />
        <span className="color-label">
          {randomColorMode ? "RANDOM" : selectedColor.toUpperCase()}
        </span>
        {regionPaintMode && <span className="mode-badge region-badge">РЕГИОН</span>}
        {fillMode && !regionPaintMode && <span className="mode-badge">FILL</span>}
      </div>
    </div>
  );
}
