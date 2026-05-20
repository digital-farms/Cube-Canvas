import { useGameStore, GridSize } from "../store/gameStore";

function handleScreenshot() {
  const canvas = document.querySelector("canvas");
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = "cubepaint.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export default function SettingsPanel() {
  const {
    gridSize, setGridSize, glowIntensity, setGlowIntensity,
    autoRotate, setAutoRotate, clearAll, paintCount,
    showSettings, gameMode,
  } = useGameStore();

  if (!showSettings) return null;

  const sizes: GridSize[] = [10, 20, 40];
  const sizeLabels: Record<GridSize, string> = {
    10: "Маленький (10×10)",
    20: "Средний (20×20)",
    40: "Большой (40×40)",
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <span>Настройки</span>
        <span className="paint-count">{paintCount.toLocaleString()} клеток</span>
      </div>

      <div className="settings-section">
        <div className="settings-label">Размер куба</div>
        <div className="size-options">
          {sizes.map((size) => (
            <button
              key={size}
              className={`size-btn ${gridSize === size ? "active" : ""}`}
              onClick={() => {
                if (gridSize !== size) setGridSize(size);
              }}
            >
              {sizeLabels[size]}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-label">
          Интенсивность свечения{" "}
          <span className="value-label">{Math.round(glowIntensity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={glowIntensity}
          onChange={(e) => setGlowIntensity(parseFloat(e.target.value))}
          className="glow-slider"
        />
      </div>

      <div className="settings-section">
        <label className="toggle-row">
          <span>Авто-вращение</span>
          <div
            className={`toggle ${autoRotate ? "on" : ""}`}
            onClick={() => setAutoRotate(!autoRotate)}
          />
        </label>
      </div>

      <div className="settings-actions">
        <button className="settings-btn screenshot-btn" onClick={handleScreenshot}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Скрин
        </button>
        <button
          className="settings-btn danger-btn"
          onClick={() => clearAll()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
          {gameMode === "repaint" ? "Перемешать" : "Очистить"}
        </button>
      </div>
    </div>
  );
}
