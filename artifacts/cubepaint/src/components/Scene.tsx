import { useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import PaintableCube from "./PaintableCube";
import AmbientParticles from "./AmbientParticles";
import { useGameStore } from "../store/gameStore";
import { paintEvent } from "../utils/paintEvents";

// ── Reactive point light — smoothly chases last paint color ──────────────────
function ReactiveLight() {
  const lightRef = useRef<THREE.PointLight>(null!);
  const currentColor = useRef(new THREE.Color("#8000ff"));

  useFrame((_, delta) => {
    if (!lightRef.current) return;

    // Age advances, intensity fades after paint
    paintEvent.age = Math.min(paintEvent.age + delta * 1.2, 5);

    // Smoothly lerp color toward last painted color
    currentColor.current.lerp(paintEvent.color, Math.min(1, 4 * delta));
    lightRef.current.color.copy(currentColor.current);

    // Bright flash then settle to ambient glow
    const burst = Math.max(0, 1 - paintEvent.age * 1.1);
    lightRef.current.intensity = 0.4 + burst * 3.2;
  });

  return (
    <pointLight
      ref={lightRef}
      position={[0, 0, 2.5]}
      distance={7}
      decay={2}
    />
  );
}

// ── Slowly drifting nebula cloud (large transparent points) ─────────────────
function NebulaCloud() {
  const ref = useRef<THREE.Points>(null!);
  const geo = useMemo(() => {
    const N = 120;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const palette = [
      [0.5, 0.1, 1.0], [0.1, 0.4, 1.0], [1.0, 0.1, 0.6],
      [0.1, 1.0, 0.8], [0.8, 0.1, 1.0],
    ];
    for (let i = 0; i < N; i++) {
      const r = 2.5 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.04;
    ref.current.rotation.y = t;
    ref.current.rotation.x = t * 0.3;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        size={0.22}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.18}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function Scene() {
  const glowIntensity = useGameStore((s) => s.glowIntensity);

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 2.2], fov: 50 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      style={{ background: "#070714" }}
    >
      <color attach="background" args={["#070714"]} />
      <fog attach="fog" args={["#070714", 8, 20]} />

      <ambientLight intensity={0.22} color="#7070cc" />
      <directionalLight position={[3, 3, 3]} intensity={0.45} color="#ffffff" />
      <directionalLight position={[-3, -1, -2]} intensity={0.18} color="#4040ff" />
      <pointLight position={[0, 3, 0]} intensity={0.7} color="#ff40ff" distance={8} />
      <pointLight position={[0, -3, 0]} intensity={0.45} color="#4080ff" distance={8} />
      <pointLight position={[3, 0, 0]} intensity={0.35} color="#ff8040" distance={8} />
      <pointLight position={[-3, 0, 0]} intensity={0.35} color="#40ffff" distance={8} />

      {/* Reactive light — chases last paint color */}
      <ReactiveLight />

      <Stars
        radius={20}
        depth={20}
        count={900}
        factor={1.1}
        saturation={0.9}
        fade
        speed={0.35}
      />

      <NebulaCloud />
      <AmbientParticles />
      <PaintableCube />

      <EffectComposer>
        <Bloom
          intensity={glowIntensity * 2.0}
          luminanceThreshold={0.08}
          luminanceSmoothing={0.85}
          radius={0.9}
        />
      </EffectComposer>
    </Canvas>
  );
}
