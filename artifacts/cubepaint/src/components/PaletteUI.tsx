import { useState, useCallback } from "react";
import { useGameStore } from "../store/gameStore";
import { PALETTES, PALETTE_LABELS, PaletteName } from "../utils/colors";
import { playPaletteSound, unlockAudio, getAudioState } from "../utils/audio";

export default function PaletteUI() {
  const {
    selectedColor, setSelectedColor, paletteName, setPalette,
    showSettings, setShowSettings, backToMenu,
  } = useGameStore();

  const [showPicker, setShowPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [audioState, setAudioState] = useState(getAudioState);

  const handleSoundToggle = useCallback(() => {
    unlockAudio()
      .then(() => setAudioState("running"))
      .catch(() => setAudioState(getAudioState()));
  }, []);

  const palette = PALETTES[paletteName as PaletteName];
  const paletteNames = Object.keys(PALETTES) as PaletteName[];

  return (
    <div className="palette-ui">
      {showPicker && (
        <div className="palette-popup">
          <div className="palette-popup-title">Палитра</div>
          {paletteNames.map((name) => (
            <button
              key={name}
              className={`palette-option ${name === paletteName ? "active" : ""}`}
              onClick={() => {
                setPalette(name);
                playPaletteSound();
                setShowPicker(false);
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
        {/* Back to menu */}
        <button
          className="palette-palette-btn"
          title="В меню"
          onClick={() => backToMenu()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        {/* Sound toggle — explicit unlock for iOS */}
        <button
          className={`palette-palette-btn sound-btn ${audioState === "running" ? "sound-on" : "sound-off"}`}
          title={audioState === "running" ? "Звук включён" : "Включить звук"}
          onClick={handleSoundToggle}
        >
          {audioState === "running" ? "🔊" : "🔇"}
        </button>

        {/* Palette switcher */}
        <button
          className="palette-palette-btn"
          title="Сменить палитру"
          onClick={() => { setShowPicker((v) => !v); setShowColorPicker(false); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              className={`color-swatch ${selectedColor === color ? "selected" : ""}`}
              style={{ background: color }}
              onClick={() => { setSelectedColor(color); setShowColorPicker(false); }}
            />
          ))}

          {/* Custom color */}
          <button
            className={`color-swatch custom-color ${showColorPicker ? "selected" : ""}`}
            title="Свой цвет"
            onClick={() => setShowColorPicker((v) => !v)}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {showColorPicker && (
            <input
              type="color"
              className="hidden-color-picker"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              autoFocus
            />
          )}
        </div>

        {/* Settings */}
        <button
          className={`palette-palette-btn ${showSettings ? "active" : ""}`}
          title="Настройки"
          onClick={() => setShowSettings(!showSettings)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <div className="selected-color-preview">
        <div className="color-indicator" style={{ background: selectedColor }} />
        <span className="color-label">{selectedColor.toUpperCase()}</span>
      </div>
    </div>
  );
}
