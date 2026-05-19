import { useRef, useMemo, useEffect, useCallback, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import { DEFAULT_TILE_COLOR } from "../utils/colors";
import { playPaintSound, triggerHaptic } from "../utils/audio";

const FACE_CONFIGS = [
  { center: [0, 0, 0.5002] as const, euler: [0, 0, 0] as const, right: [1, 0, 0] as const, up: [0, 1, 0] as const },
  { center: [0, 0, -0.5002] as const, euler: [0, Math.PI, 0] as const, right: [-1, 0, 0] as const, up: [0, 1, 0] as const },
  { center: [0.5002, 0, 0] as const, euler: [0, Math.PI / 2, 0] as const, right: [0, 0, -1] as const, up: [0, 1, 0] as const },
  { center: [-0.5002, 0, 0] as const, euler: [0, -Math.PI / 2, 0] as const, right: [0, 0, 1] as const, up: [0, 1, 0] as const },
  { center: [0, 0.5002, 0] as const, euler: [-Math.PI / 2, 0, 0] as const, right: [1, 0, 0] as const, up: [0, 0, -1] as const },
  { center: [0, -0.5002, 0] as const, euler: [Math.PI / 2, 0, 0] as const, right: [1, 0, 0] as const, up: [0, 0, 1] as const },
];

const UNPAINTED_COLOR = new THREE.Color(DEFAULT_TILE_COLOR);
const GLOW_BLACK = new THREE.Color(0, 0, 0);
const HOVER_BOOST = new THREE.Color("#ffffff");
const tmpColor = new THREE.Color();

function getNeighbors(id: number, N: number): number[] {
  const face = Math.floor(id / (N * N));
  const local = id % (N * N);
  const row = Math.floor(local / N);
  const col = local % N;
  const base = face * N * N;
  const r: number[] = [];
  if (row > 0) r.push(base + (row - 1) * N + col);
  if (row < N - 1) r.push(base + (row + 1) * N + col);
  if (col > 0) r.push(base + row * N + (col - 1));
  if (col < N - 1) r.push(base + row * N + (col + 1));
  return r;
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

interface PopAnim { id: number; t: number }

export default function PaintableCube() {
  const tilesRef = useRef<THREE.InstancedMesh>(null!);
  const glowRef = useRef<THREE.InstancedMesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);

  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndcPt = useMemo(() => new THREE.Vector2(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const [hoveredId, setHoveredId] = useState(-1);
  const popAnims = useRef<Map<number, PopAnim>>(new Map());
  const isDragging = useRef(false);
  const pointerDown = useRef(false);
  const pointerMoved = useRef(false);
  const lastPainted = useRef(-1);
  const lastPointer = useRef({ x: 0, y: 0 });
  const targetRot = useRef({ x: 0.3, y: 0.5 });
  const currentRot = useRef({ x: 0.3, y: 0.5 });
  const rotVel = useRef({ x: 0, y: 0 });

  const { gridSize, tileColors, paintTile, paintRegion, fillMode, regionPaintMode, glowIntensity, autoRotate } =
    useGameStore();
  const N = gridSize;
  const totalTiles = 6 * N * N;

  // Pre-compute base matrices once per gridSize
  const baseMatrices = useMemo(() => {
    const step = 1 / N;
    const tileSize = step * 0.88;
    const out: THREE.Matrix4[] = [];
    for (let face = 0; face < 6; face++) {
      const cfg = FACE_CONFIGS[face];
      for (let row = 0; row < N; row++) {
        for (let col = 0; col < N; col++) {
          const u = (col + 0.5) / N - 0.5;
          const v = (row + 0.5) / N - 0.5;
          dummy.position.set(
            cfg.center[0] + u * cfg.right[0] + v * cfg.up[0],
            cfg.center[1] + u * cfg.right[1] + v * cfg.up[1],
            cfg.center[2] + u * cfg.right[2] + v * cfg.up[2],
          );
          dummy.rotation.set(cfg.euler[0], cfg.euler[1], cfg.euler[2]);
          dummy.scale.set(tileSize, tileSize, 1);
          dummy.updateMatrix();
          out.push(dummy.matrix.clone());
        }
      }
    }
    return out;
  }, [N, dummy]);

  // Plain tile material — NO vertexColors, standard instance color path
  const tileMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.1 }),
    []
  );

  // Glow layer: MeshBasicMaterial with additive blending
  // Black tiles are invisible, painted tiles emit their color
  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    []
  );

  const planeGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Initialise matrices + colors when grid changes
  useEffect(() => {
    if (!tilesRef.current || !glowRef.current) return;
    const tm = tilesRef.current;
    const gm = glowRef.current;
    for (let i = 0; i < totalTiles; i++) {
      tm.setMatrixAt(i, baseMatrices[i]);
      tm.setColorAt(i, UNPAINTED_COLOR);
      gm.setMatrixAt(i, baseMatrices[i]);
      gm.setColorAt(i, GLOW_BLACK);
    }
    tm.instanceMatrix.needsUpdate = true;
    gm.instanceMatrix.needsUpdate = true;
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
    if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
  }, [baseMatrices, totalTiles]);

  // Sync colors when tileColors store changes
  useEffect(() => {
    if (!tilesRef.current || !glowRef.current) return;
    const tm = tilesRef.current;
    const gm = glowRef.current;
    for (let i = 0; i < totalTiles; i++) {
      const hex = tileColors[i];
      if (hex) {
        tm.setColorAt(i, tmpColor.set(hex));
        // Glow layer uses a brightened version of the color
        gm.setColorAt(i, tmpColor.set(hex).multiplyScalar(glowIntensity * 1.2));
      } else {
        tm.setColorAt(i, UNPAINTED_COLOR);
        gm.setColorAt(i, GLOW_BLACK);
      }
    }
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
    if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
  }, [tileColors, totalTiles, glowIntensity]);

  // Update glow intensity live without recomputing all colors
  useEffect(() => {
    if (!glowRef.current) return;
    const gm = glowRef.current;
    for (let i = 0; i < totalTiles; i++) {
      const hex = tileColors[i];
      gm.setColorAt(i, hex ? tmpColor.set(hex).multiplyScalar(glowIntensity * 1.2) : GLOW_BLACK);
    }
    if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
  }, [glowIntensity]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickInstance = useCallback(
    (clientX: number, clientY: number): number => {
      const rect = gl.domElement.getBoundingClientRect();
      ndcPt.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndcPt.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndcPt, camera);
      const hits = raycaster.intersectObject(tilesRef.current);
      return hits.length > 0 && hits[0].instanceId !== undefined ? hits[0].instanceId : -1;
    },
    [camera, gl, ndcPt, raycaster]
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

    const onDown = (e: PointerEvent) => {
      pointerDown.current = true;
      pointerMoved.current = false;
      isDragging.current = false;
      lastPainted.current = -1;
      lastPointer.current = { x: e.clientX, y: e.clientY };
    };

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;

      if (!pointerDown.current) {
        setHoveredId(pickInstance(e.clientX, e.clientY));
        return;
      }

      if (Math.hypot(dx, dy) > 8) pointerMoved.current = true;

      if (pointerMoved.current) {
        isDragging.current = true;
        const s = 0.0018;
        const max = 0.04;
        rotVel.current.y = Math.max(-max, Math.min(max, rotVel.current.y + dx * s));
        rotVel.current.x = Math.max(-max, Math.min(max, rotVel.current.x + dy * s));
        lastPointer.current = { x: e.clientX, y: e.clientY };
      }

      if (fillMode && isDragging.current) {
        doPaint(pickInstance(e.clientX, e.clientY));
      }
    };

    const onUp = (e: PointerEvent) => {
      // Paint on click (no significant drag)
      if (!pointerMoved.current) {
        doPaint(pickInstance(e.clientX, e.clientY));
      }
      pointerDown.current = false;
      isDragging.current = false;
      lastPainted.current = -1;
    };

    const onLeave = () => {
      setHoveredId(-1);
      pointerDown.current = false;
      isDragging.current = false;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, pickInstance, doPaint, fillMode]);

  useFrame((_, delta) => {
    if (!groupRef.current || !tilesRef.current) return;

    if (autoRotate && !isDragging.current) rotVel.current.y += 0.0015;

    targetRot.current.y += rotVel.current.y;
    targetRot.current.x = Math.max(-1.4, Math.min(1.4, targetRot.current.x + rotVel.current.x));

    const decay = isDragging.current ? 0.6 : 0.95;
    rotVel.current.x *= decay;
    rotVel.current.y *= decay;

    const lerp = Math.min(1, 10 * delta);
    currentRot.current.x += (targetRot.current.x - currentRot.current.x) * lerp;
    currentRot.current.y += (targetRot.current.y - currentRot.current.y) * lerp;

    groupRef.current.rotation.x = currentRot.current.x;
    groupRef.current.rotation.y = currentRot.current.y;

    let matDirty = false;

    // Pop animation
    popAnims.current.forEach((anim, id) => {
      anim.t += delta * 7;
      if (anim.t >= 1) {
        tilesRef.current.setMatrixAt(id, baseMatrices[id]);
        glowRef.current.setMatrixAt(id, baseMatrices[id]);
        popAnims.current.delete(id);
        matDirty = true;
        return;
      }
      const sc = 1 + Math.sin(anim.t * Math.PI) * 0.2;
      const m = baseMatrices[id].clone();
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      m.decompose(p, q, s);
      s.multiplyScalar(sc);
      m.compose(p, q, s);
      tilesRef.current.setMatrixAt(id, m);
      glowRef.current.setMatrixAt(id, m);
      matDirty = true;
    });

    // Hover highlight
    if (hoveredId >= 0 && baseMatrices[hoveredId]) {
      const m = baseMatrices[hoveredId].clone();
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      m.decompose(p, q, s);
      s.multiplyScalar(1.1);
      m.compose(p, q, s);
      tilesRef.current.setMatrixAt(hoveredId, m);
      const hex = tileColors[hoveredId];
      tilesRef.current.setColorAt(
        hoveredId,
        hex ? tmpColor.set(hex).lerp(HOVER_BOOST, 0.35) : tmpColor.set(0.3, 0.3, 0.3)
      );
      matDirty = true;
      if (tilesRef.current.instanceColor) tilesRef.current.instanceColor.needsUpdate = true;
    }

    if (matDirty) {
      tilesRef.current.instanceMatrix.needsUpdate = true;
      glowRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Core cube body */}
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#080818" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Tile layer — receives clicks for raycasting */}
      <instancedMesh
        ref={tilesRef}
        args={[planeGeo, tileMat, totalTiles]}
        frustumCulled={false}
      />

      {/* Additive glow layer — sits slightly above tiles */}
      <instancedMesh
        ref={glowRef}
        args={[planeGeo, glowMat, totalTiles]}
        frustumCulled={false}
        renderOrder={1}
      />
    </group>
  );
}
