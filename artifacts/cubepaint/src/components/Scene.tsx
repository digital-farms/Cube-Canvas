import { Canvas } from "@react-three/fiber";
import { Environment, Stars } from "@react-three/drei";
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

      <ambientLight intensity={0.3} color="#8080ff" />
      <directionalLight position={[3, 3, 3]} intensity={0.6} color="#ffffff" />
      <directionalLight position={[-3, -1, -2]} intensity={0.3} color="#4040ff" />
      <pointLight position={[0, 3, 0]} intensity={1.2} color="#ff40ff" distance={8} />
      <pointLight position={[0, -3, 0]} intensity={0.8} color="#4080ff" distance={8} />
      <pointLight position={[3, 0, 0]} intensity={0.6} color="#ff8040" distance={8} />
      <pointLight position={[-3, 0, 0]} intensity={0.6} color="#40ffff" distance={8} />

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
          intensity={glowIntensity * 1.2}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.8}
          radius={0.8}
        />
      </EffectComposer>
    </Canvas>
  );
}
