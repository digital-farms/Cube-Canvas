import { useMemo } from "react";
import Scene from "./components/Scene";
import PaletteUI from "./components/PaletteUI";
import SettingsPanel from "./components/SettingsPanel";
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
          CubePaint needs WebGL to render the 3D cube.
          Please open this app in a modern browser on your phone or desktop.
        </p>
      </div>
    </div>
  );
}

function App() {
  const webglOk = useMemo(() => isWebGLAvailable(), []);

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-logo">
          <span className="logo-cube">⬛</span>
          <span className="logo-text">CubePaint</span>
        </div>
        <div className="app-hint">Drag to rotate · Tap to paint</div>
      </header>

      <div className="canvas-container">
        {webglOk ? <Scene /> : <WebGLFallback />}
      </div>

      {webglOk && (
        <>
          <SettingsPanel />
          <PaletteUI />
        </>
      )}
    </div>
  );
}

export default App;
