import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 80;

export default function AmbientParticles() {
  const meshRef = useRef<THREE.Points>(null!);

  const { positions, velocities, phases } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const phases = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      velocities[i * 3] = (Math.random() - 0.5) * 0.004;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.002 + 0.001;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, velocities, phases };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const attr = meshRef.current.geometry.attributes.position;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3] += velocities[i * 3] + Math.sin(t * 0.3 + phases[i]) * 0.0008;
      arr[i * 3 + 1] += velocities[i * 3 + 1];
      arr[i * 3 + 2] += velocities[i * 3 + 2] + Math.cos(t * 0.2 + phases[i]) * 0.0008;

      if (arr[i * 3 + 1] > 4) arr[i * 3 + 1] = -4;
      if (Math.abs(arr[i * 3]) > 4) arr[i * 3] *= -0.98;
      if (Math.abs(arr[i * 3 + 2]) > 4) arr[i * 3 + 2] *= -0.98;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.025}
        color="#6040ff"
        transparent
        opacity={0.22}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
