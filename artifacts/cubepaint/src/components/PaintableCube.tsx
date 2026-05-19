import { useRef, useMemo, useEffect, useCallback, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import { DEFAULT_TILE_COLOR } from "../utils/colors";
import { playPaintSound, triggerHaptic } from "../utils/audio";

const FACE_CONFIGS = [
  { center: [0, 0, 0.5001] as const, euler: [0, 0, 0] as const, right: [1, 0, 0] as const, up: [0, 1, 0] as const },
  { center: [0, 0, -0.5001] as const, euler: [0, Math.PI, 0] as const, right: [-1, 0, 0] as const, up: [0, 1, 0] as const },
  { center: [0.5001, 0, 0] as const, euler: [0, Math.PI / 2, 0] as const, right: [0, 0, -1] as const, up: [0, 1, 0] as const },
  { center: [-0.5001, 0, 0] as const, euler: [0, -Math.PI / 2, 0] as const, right: [0, 0, 1] as const, up: [0, 1, 0] as const },
  { center: [0, 0.5001, 0] as const, euler: [-Math.PI / 2, 0, 0] as const, right: [1, 0, 0] as const, up: [0, 0, -1] as const },
  { center: [0, -0.5001, 0] as const, euler: [Math.PI / 2, 0, 0] as const, right: [1, 0, 0] as const, up: [0, 0, 1] as const },
];

const UNPAINTED = new THREE.Color(DEFAULT_TILE_COLOR);
const HOVER_CLR = new THREE.Color("#ffffff");

function getNeighbors(id: number, N: number): number[] {
  const face = Math.floor(id / (N * N));
  const local = id % (N * N);
  const row = Math.floor(local / N);
  const col = local % N;
  const base = face * N * N;
  const result: number[] = [];
  if (row > 0) result.push(base + (row - 1) * N + col);
  if (row < N - 1) result.push(base + (row + 1) * N + col);
  if (col > 0) result.push(base + row * N + (col - 1));
  if (col < N - 1) result.push(base + row * N + (col + 1));
  return result;
}

function getConnectedRegion(
  startId: number,
  targetColor: string,
  tileColors: Record<number, string>,
  N: number
): number[] {
  const visited = new Set<number>();
  const queue = [startId];
  const result: number[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    const c = tileColors[curr] ?? DEFAULT_TILE_COLOR;
    if (c !== targetColor) continue;
    result.push(curr);
    for (const n of getNeighbors(curr, N)) {
      if (!visited.has(n)) queue.push(n);
    }
  }
  return result;
}

interface PopAnim {
  id: number;
  t: number;
}

export default function PaintableCube() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  const [hoveredId, setHoveredId] = useState<number>(-1);
  const popAnims = useRef<Map<number, PopAnim>>(new Map());
  const isDragging = useRef(false);
  const lastPainted = useRef(-1);
  const pointerDown = useRef(false);
  const pointerMoved = useRef(false);
  const glowUniformRef = useRef<{ value: number }>({ value: 0.6 });

  const {
    gridSize, tileColors, paintTile, paintRegion, fillMode,
    regionPaintMode, glowIntensity, autoRotate,
  } = useGameStore();

  const totalTiles = 6 * gridSize * gridSize;

  const baseMatrices = useMemo(() => {
    const N = gridSize;
    const step = 1 / N;
    const tileSize = step * 0.88;
    const matrices: THREE.Matrix4[] = [];
    for (let face = 0; face < 6; face++) {
      const cfg = FACE_CONFIGS[face];
      for (let row = 0; row < N; row++) {
        for (let col = 0; col < N; col++) {
          const u = (col + 0.5) / N - 0.5;
          const v = (row + 0.5) / N - 0.5;
          const x = cfg.center[0] + u * cfg.right[0] + v * cfg.up[0];
          const y = cfg.center[1] + u * cfg.right[1] + v * cfg.up[1];
          const z = cfg.center[2] + u * cfg.right[2] + v * cfg.up[2];
          dummy.position.set(x, y, z);
          dummy.rotation.set(cfg.euler[0], cfg.euler[1], cfg.euler[2]);
          dummy.scale.set(tileSize, tileSize, 1);
          dummy.updateMatrix();
          matrices.push(dummy.matrix.clone());
        }
      }
    }
    return matrices;
  }, [gridSize, dummy]);

  // Material with per-instance emissive glow via shader injection
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.25,
      metalness: 0.1,
      vertexColors: true,
    });

    const glowRef = glowUniformRef.current;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.glowStrength = glowRef;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += vColor.rgb * glowStrength;`
      );
    };

    return mat;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    glowUniformRef.current.value = glowIntensity * 0.8;
  }, [glowIntensity]);

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    for (let i = 0; i < totalTiles; i++) {
      mesh.setMatrixAt(i, baseMatrices[i]);
      mesh.setColorAt(i, UNPAINTED);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [baseMatrices, totalTiles]);

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    for (let i = 0; i < totalTiles; i++) {
      const hex = tileColors[i];
      mesh.setColorAt(i, hex ? tempColor.set(hex) : UNPAINTED);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [tileColors, totalTiles, tempColor]);

  const groupRef = useRef<THREE.Group>(null!);
  // Separate target rotation and current rotation for smooth interpolation
  const targetRot = useRef({ x: 0.3, y: 0.5 });
  const currentRot = useRef({ x: 0.3, y: 0.5 });
  const rotVel = useRef({ x: 0, y: 0 });
  const lastPointer = useRef({ x: 0, y: 0 });

  const getInstanceFromEvent = useCallback(
    (clientX: number, clientY: number): number => {
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(meshRef.current);
      if (hits.length > 0 && hits[0].instanceId !== undefined) {
        return hits[0].instanceId;
      }
      return -1;
    },
    [camera, gl, pointer, raycaster]
  );

  const doPaint = useCallback(
    (id: number) => {
      if (id < 0 || id === lastPainted.current) return;
      lastPainted.current = id;

      const state = useGameStore.getState();

      if (state.regionPaintMode) {
        const tileColor = state.tileColors[id] ?? DEFAULT_TILE_COLOR;
        const region = getConnectedRegion(id, tileColor, state.tileColors, state.gridSize);
        if (region.length > 0) {
          paintRegion(region);
          playPaintSound(state.getNextColor());
          triggerHaptic();
          region.forEach((rid) => popAnims.current.set(rid, { id: rid, t: 0 }));
        }
      } else {
        paintTile(id);
        playPaintSound(state.getNextColor());
        triggerHaptic();
        popAnims.current.set(id, { id, t: 0 });
      }
    },
    [paintTile, paintRegion]
  );

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      pointerDown.current = true;
      pointerMoved.current = false;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      lastPainted.current = -1;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown.current) {
        const id = getInstanceFromEvent(e.clientX, e.clientY);
        setHoveredId(id);
        return;
      }
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 4) pointerMoved.current = true;

      if (pointerMoved.current) {
        isDragging.current = true;
        // Gentle sensitivity + velocity clamping for smooth rotation
        const sensitivity = 0.0018;
        rotVel.current.y += dx * sensitivity;
        rotVel.current.x += dy * sensitivity;
        const maxVel = 0.035;
        rotVel.current.x = Math.max(-maxVel, Math.min(maxVel, rotVel.current.x));
        rotVel.current.y = Math.max(-maxVel, Math.min(maxVel, rotVel.current.y));
        lastPointer.current = { x: e.clientX, y: e.clientY };
      }

      if (fillMode && isDragging.current) {
        const id = getInstanceFromEvent(e.clientX, e.clientY);
        if (id >= 0) doPaint(id);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerMoved.current || !isDragging.current) {
        const id = getInstanceFromEvent(e.clientX, e.clientY);
        if (id >= 0) doPaint(id);
      }
      pointerDown.current = false;
      isDragging.current = false;
      lastPainted.current = -1;
    };

    const onPointerLeave = () => {
      setHoveredId(-1);
      pointerDown.current = false;
      isDragging.current = false;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [gl, getInstanceFromEvent, doPaint, fillMode]);

  useFrame((_, delta) => {
    if (!groupRef.current || !meshRef.current) return;

    // Auto-rotate: gentle continuous velocity
    if (autoRotate && !isDragging.current) {
      rotVel.current.y += 0.0015;
    }

    // Apply velocity to target rotation
    targetRot.current.y += rotVel.current.y;
    targetRot.current.x += rotVel.current.x;
    targetRot.current.x = Math.max(-1.4, Math.min(1.4, targetRot.current.x));

    // Smooth inertia decay — higher value = longer glide
    const decay = isDragging.current ? 0.7 : 0.94;
    rotVel.current.x *= decay;
    rotVel.current.y *= decay;

    // Smooth interpolation from current to target (feel of weight/inertia)
    const lerp = Math.min(1, 12 * delta);
    currentRot.current.x += (targetRot.current.x - currentRot.current.x) * lerp;
    currentRot.current.y += (targetRot.current.y - currentRot.current.y) * lerp;

    groupRef.current.rotation.x = currentRot.current.x;
    groupRef.current.rotation.y = currentRot.current.y;

    // Pop animations
    let needsMatrixUpdate = false;
    popAnims.current.forEach((anim, id) => {
      anim.t += delta * 7;
      if (anim.t >= 1) {
        meshRef.current.setMatrixAt(id, baseMatrices[id]);
        popAnims.current.delete(id);
        needsMatrixUpdate = true;
        return;
      }
      const scale = 1 + Math.sin(anim.t * Math.PI) * 0.18;
      const m = baseMatrices[id].clone();
      const pos = new THREE.Vector3();
      const rot = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      m.decompose(pos, rot, scl);
      scl.multiplyScalar(scale);
      m.compose(pos, rot, scl);
      meshRef.current.setMatrixAt(id, m);
      needsMatrixUpdate = true;
    });

    // Hover highlight
    if (hoveredId >= 0) {
      const m = baseMatrices[hoveredId]?.clone();
      if (m) {
        const pos = new THREE.Vector3();
        const rot = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        m.decompose(pos, rot, scl);
        scl.multiplyScalar(1.1);
        m.compose(pos, rot, scl);
        meshRef.current.setMatrixAt(hoveredId, m);
        const paintedColor = tileColors[hoveredId];
        meshRef.current.setColorAt(
          hoveredId,
          paintedColor
            ? tempColor.set(paintedColor).lerp(HOVER_CLR, 0.4)
            : HOVER_CLR.clone().multiplyScalar(0.35)
        );
        needsMatrixUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (needsMatrixUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  return (
    <group ref={groupRef} rotation={[0.3, 0.5, 0]}>
      <mesh renderOrder={-1}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#080818" roughness={0.9} metalness={0.1} />
      </mesh>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, totalTiles]}
        frustumCulled={false}
      />
    </group>
  );
}
