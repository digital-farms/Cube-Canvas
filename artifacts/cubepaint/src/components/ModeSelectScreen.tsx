import { useGameStore } from "../store/gameStore";
import { startAmbientMusic, playMenuChime, primeAudioForGesture } from "../utils/audio";

function AnimCube({ colors }: { colors: string[] }) {
  return (
    <div className="anim-cube-wrap">
      <div className="anim-cube">
        <div className="anim-face anim-face-front">
          {colors.slice(0, 9).map((c, i) => (
            <div key={i} className="anim-cell" style={{ background: c }} />
          ))}
        </div>
        <div className="anim-face anim-face-right">
          {colors.slice(9, 18).map((c, i) => (
            <div key={i} className="anim-cell" style={{ background: c }} />
          ))}
        </div>
        <div className="anim-face anim-face-top">
          {colors.slice(18, 27).map((c, i) => (
            <div key={i} className="anim-cell" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const EMPTY_COLORS = Array(27).fill("#0d0d22");

const REPAINT_COLORS = [
  "#FF0080", "#FF8C00", "#00FF41", "#0080FF", "#FF0080", "#FFE500", "#8000FF", "#00FFFF", "#FF0080",
  "#B967FF", "#01CDFE", "#05FFA1", "#FF71CE", "#FFFB96", "#FF6B6B", "#4ECDC4", "#45B7D1", "#B967FF",
  "#FF00FF", "#CC00FF", "#9900FF", "#FF0066", "#00FFCC", "#00CCFF", "#FF3300", "#FF9900", "#FF00FF",
];

export default function ModeSelectScreen() {
  const { startGame } = useGameStore();

  const handleStart = (mode: "draw" | "repaint") => {
    playMenuChime();
    startAmbientMusic();
    startGame(mode);
  };

  return (
    <div className="mode-select">
      <div className="mode-select-bg" />

      <div className="mode-select-content">
        <div className="mode-logo">
          <span className="mode-logo-icon">⬛</span>
          <h1 className="mode-logo-title">CubePaint</h1>
        </div>
        <p className="mode-subtitle">Выбери режим</p>

        <div className="mode-cards">
          <button
            className="mode-card"
            onPointerDown={primeAudioForGesture}
            onTouchStart={primeAudioForGesture}
            onClick={() => handleStart("draw")}
          >
            <div className="mode-card-glow mode-card-glow--draw" />
            <AnimCube colors={EMPTY_COLORS} />
            <div className="mode-card-body">
              <div className="mode-card-icon">✏️</div>
              <h2 className="mode-card-title">Рисование</h2>
              <p className="mode-card-desc">
                Пустой куб — раскрашивай клетки с нуля, создавай узоры
              </p>
            </div>
            <div className="mode-card-start">Начать</div>
          </button>

          <button
            className="mode-card"
            onPointerDown={primeAudioForGesture}
            onTouchStart={primeAudioForGesture}
            onClick={() => handleStart("repaint")}
          >
            <div className="mode-card-glow mode-card-glow--repaint" />
            <AnimCube colors={REPAINT_COLORS} />
            <div className="mode-card-body">
              <div className="mode-card-icon">🎨</div>
              <h2 className="mode-card-title">Перекраска</h2>
              <p className="mode-card-desc">
                Куб залит случайными цветами — касанием перекрашивай целые регионы
              </p>
            </div>
            <div className="mode-card-start">Начать</div>
          </button>
        </div>
      </div>
    </div>
  );
}
