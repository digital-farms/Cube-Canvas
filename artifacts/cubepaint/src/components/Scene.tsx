import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import PaintableCube from "./PaintableCube";
import AmbientParticles from "./AmbientParticles";
import { useGameStore } from "../store/gameStore";

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

      <ambientLight intensity={0.25} color="#7070cc" />
      <directionalLight position={[3, 3, 3]} intensity={0.5} color="#ffffff" />
      <directionalLight position={[-3, -1, -2]} intensity={0.2} color="#4040ff" />
      <pointLight position={[0, 3, 0]} intensity={0.8} color="#ff40ff" distance={8} />
      <pointLight position={[0, -3, 0]} intensity={0.5} color="#4080ff" distance={8} />
      <pointLight position={[3, 0, 0]} intensity={0.4} color="#ff8040" distance={8} />
      <pointLight position={[-3, 0, 0]} intensity={0.4} color="#40ffff" distance={8} />

      <Stars
        radius={20}
        depth={20}
        count={800}
        factor={1}
        saturation={0.8}
        fade
        speed={0.3}
      />

      <AmbientParticles />
      <PaintableCube />

      <EffectComposer>
        <Bloom
          intensity={glowIntensity * 1.8}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          radius={0.85}
        />
      </EffectComposer>
    </Canvas>
  );
}
