import { useMemo } from "react";
import { useGameStore } from "./store/gameStore";
import Scene from "./components/Scene";
import PaletteUI from "./components/PaletteUI";
import SettingsPanel from "./components/SettingsPanel";
import ModeSelectScreen from "./components/ModeSelectScreen";
import { isWebGLAvailable } from "./utils/webgl";
import "./index.css";

function WebGLFallback() {
  return (
    <div className="webgl-fallback">
      <div className="webgl-fallback-content">
        <div className="webgl-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>
        <h2>WebGL Required</h2>
        <p>
          CubePaint требует WebGL. Откройте приложение в браузере на телефоне или компьютере.
        </p>
      </div>
    </div>
  );
}

function App() {
  const webglOk = useMemo(() => isWebGLAvailable(), []);
  const gameMode = useGameStore((s) => s.gameMode);
  const paintCount = useGameStore((s) => s.paintCount);

  if (!webglOk) return <WebGLFallback />;

  return (
    <div className="app-root">
      {gameMode === null && <ModeSelectScreen />}

      {gameMode !== null && (
        <>
          <header className="app-header">
            <div className="app-logo">
              <span className="logo-cube">⬛</span>
              <span className="logo-text">CubePaint</span>
            </div>
            <div className="app-hint">
              {gameMode === "draw" ? `${paintCount} клеток` : "Касание — регион"}
            </div>
          </header>

          <div className="canvas-container">
            <Scene />
          </div>

          <SettingsPanel />
          <PaletteUI />
        </>
      )}
    </div>
  );
}

export default App;
