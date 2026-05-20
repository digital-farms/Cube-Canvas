import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import { DEFAULT_TILE_COLOR } from "../utils/colors";
import { playPaintSound, playRegionFillSound, triggerHaptic } from "../utils/audio";
import { triggerPaintFlash } from "../utils/paintEvents";

const FACE_CONFIGS = [
  { center: [0, 0, 0.5002] as const, euler: [0, 0, 0] as const, right: [1, 0, 0] as const, up: [0, 1, 0] as const },
  { center: [0, 0, -0.5002] as const, euler: [0, Math.PI, 0] as const, right: [-1, 0, 0] as const, up: [0, 1, 0] as const },
  { center: [0.5002, 0, 0] as const, euler: [0, Math.PI / 2, 0] as const, right: [0, 0, -1] as const, up: [0, 1, 0] as const },
  { center: [-0.5002, 0, 0] as const, euler: [0, -Math.PI / 2, 0] as const, right: [0, 0, 1] as const, up: [0, 1, 0] as const },
  { center: [0, 0.5002, 0] as const, euler: [-Math.PI / 2, 0, 0] as const, right: [1, 0, 0] as const, up: [0, 0, -1] as const },
  { center: [0, -0.5002, 0] as const, euler: [Math.PI / 2, 0, 0] as const, right: [1, 0, 0] as const, up: [0, 0, 1] as const },
];

const FACE_NORMALS = [
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
];

const UNPAINTED_COLOR = new THREE.Color(DEFAULT_TILE_COLOR);
const GLOW_BLACK = new THREE.Color(0, 0, 0);
const HOVER_BOOST = new THREE.Color("#ffffff");
const tmpColor = new THREE.Color();
const tmpVec3 = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();

const MAX_PARTICLES = 220;

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
  r: number; g: number; b: number;
  size: number;
}

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

// Snappy spring-pop: grows quickly then bounces back with slight overshoot
function springPop(t: number): number {
  if (t <= 0) return 1;
  if (t >= 1) return 1;
  if (t < 0.28) return 1 + (t / 0.28) * 0.42;     // fast grow → 1.42x
  if (t < 0.55) return 1 + (1 - (t - 0.28) / 0.27) * 0.42; // shrink back
  if (t < 0.72) return 1 - (t - 0.55) / 0.17 * 0.06;         // slight undershoot
  return 1 - (1 - (t - 0.72) / 0.28) * 0.06;                  // settle
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

  const hoveredId = useRef(-1);
  const popAnims = useRef<Map<number, PopAnim>>(new Map());
  const rippleAnims = useRef<Map<number, { t: number; color: string }>>(new Map());
  const isDragging = useRef(false);
  const pointerDown = useRef(false);
  const pointerMoved = useRef(false);
  const lastPainted = useRef(-1);
  const lastPointer = useRef({ x: 0, y: 0 });
  const targetRot = useRef({ x: 0.3, y: 0.5 });
  const currentRot = useRef({ x: 0.3, y: 0.5 });
  const rotVel = useRef({ x: 0, y: 0 });

  // ── Particles ────────────────────────────────────────────────────────────────
  const pGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_PARTICLES * 3);
    const col = new Float32Array(MAX_PARTICLES * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  }, []);

  const pPos = useMemo(() => pGeo.attributes.position.array as Float32Array, [pGeo]);
  const pCol = useMemo(() => pGeo.attributes.color.array as Float32Array, [pGeo]);
  const particles = useRef<Particle[]>([]);

  const { gridSize, tileColors, paintTile, paintRegion, gameMode, glowIntensity, autoRotate } =
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

  const tileMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.1 }),
    []
  );

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

  // Particle material — additive blending, bright sparkles
  const pMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.038,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  // Init matrices + colors when grid changes
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

  // Sync colors when tileColors changes
  useEffect(() => {
    if (!tilesRef.current || !glowRef.current) return;
    const tm = tilesRef.current;
    const gm = glowRef.current;
    for (let i = 0; i < totalTiles; i++) {
      const hex = tileColors[i];
      if (hex) {
        tm.setColorAt(i, tmpColor.set(hex));
        gm.setColorAt(i, tmpColor.set(hex).multiplyScalar(glowIntensity * 1.2));
      } else {
        tm.setColorAt(i, UNPAINTED_COLOR);
        gm.setColorAt(i, GLOW_BLACK);
      }
    }
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
    if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
  }, [tileColors, totalTiles, glowIntensity]);

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

  // Spawn burst particles at a tile position (cube-local space)
  const spawnBurst = useCallback(
    (tileId: number, color: string, count: number) => {
      if (!baseMatrices[tileId]) return;
      baseMatrices[tileId].decompose(tmpVec3, tmpQuat, tmpScale);
      const px = tmpVec3.x;
      const py = tmpVec3.y;
      const pz = tmpVec3.z;
      const faceIdx = Math.min(5, Math.floor(tileId / (N * N)));
      const norm = FACE_NORMALS[faceIdx];
      const c = tmpColor.set(color);

      for (let i = 0; i < count; i++) {
        if (particles.current.length >= MAX_PARTICLES) particles.current.splice(0, 8);
        const speed = 1.0 + Math.random() * 1.8;
        const spread = 0.8;
        particles.current.push({
          x: px, y: py, z: pz,
          vx: (norm.x + (Math.random() - 0.5) * spread) * speed,
          vy: (norm.y + (Math.random() - 0.5) * spread) * speed,
          vz: (norm.z + (Math.random() - 0.5) * spread) * speed,
          life: 0.45 + Math.random() * 0.4,
          maxLife: 0.45 + Math.random() * 0.4,
          r: c.r, g: c.g, b: c.b,
          size: 0.025 + Math.random() * 0.03,
        });
      }
    },
    [baseMatrices, N]
  );

  // Add ripple to neighbors of painted tiles
  const addRipple = useCallback(
    (tileIds: number[], color: string, limit = 20) => {
      let added = 0;
      for (const id of tileIds) {
        if (added >= limit) break;
        for (const nid of getNeighbors(id, N)) {
          if (added >= limit) break;
          if (!rippleAnims.current.has(nid)) {
            rippleAnims.current.set(nid, { t: 0, color });
            added++;
          }
        }
      }
    },
    [N]
  );

  const doPaint = useCallback(
    (id: number) => {
      if (id < 0 || id === lastPainted.current) return;
      lastPainted.current = id;
      const state = useGameStore.getState();

      if (state.gameMode === "repaint") {
        const tileColor = state.tileColors[id] ?? DEFAULT_TILE_COLOR;
        const region = getConnectedRegion(id, tileColor, state.tileColors, state.gridSize);
        if (region.length > 0) {
          paintRegion(region);
          playRegionFillSound(region.length);
          triggerHaptic();
          triggerPaintFlash(state.selectedColor);
          // Particles: burst from center few tiles of region
          const sample = region.slice(0, Math.min(6, region.length));
          sample.forEach((rid) => spawnBurst(rid, state.selectedColor, 4));
          region.forEach((rid) => popAnims.current.set(rid, { id: rid, t: 0 }));
          addRipple(region.slice(0, 10), state.selectedColor, 30);
        }
      } else {
        paintTile(id);
        playPaintSound(state.selectedColor);
        triggerHaptic();
        triggerPaintFlash(state.selectedColor);
        spawnBurst(id, state.selectedColor, 10);
        popAnims.current.set(id, { id, t: 0 });
        addRipple([id], state.selectedColor, 8);
      }
    },
    [paintTile, paintRegion, spawnBurst, addRipple]
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
        hoveredId.current = pickInstance(e.clientX, e.clientY);
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

      if (useGameStore.getState().gameMode === "draw" && isDragging.current) {
        doPaint(pickInstance(e.clientX, e.clientY));
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!pointerMoved.current) {
        doPaint(pickInstance(e.clientX, e.clientY));
      }
      pointerDown.current = false;
      isDragging.current = false;
      lastPainted.current = -1;
    };

    const onLeave = () => {
      hoveredId.current = -1;
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
  }, [gl, pickInstance, doPaint]);

  useFrame((_, delta) => {
    if (!groupRef.current || !tilesRef.current) return;

    // ── Rotation ──────────────────────────────────────────────────────────────
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
    let glowDirty = false;
    const store = useGameStore.getState();

    // ── Pop animations ────────────────────────────────────────────────────────
    popAnims.current.forEach((anim, id) => {
      anim.t += delta * 6.5;
      if (anim.t >= 1) {
        tilesRef.current.setMatrixAt(id, baseMatrices[id]);
        glowRef.current.setMatrixAt(id, baseMatrices[id]);
        popAnims.current.delete(id);
        matDirty = true;
        return;
      }
      const sc = springPop(anim.t);
      const m = baseMatrices[id].clone();
      m.decompose(tmpVec3, tmpQuat, tmpScale);
      tmpScale.multiplyScalar(sc);
      m.compose(tmpVec3, tmpQuat, tmpScale);
      tilesRef.current.setMatrixAt(id, m);
      glowRef.current.setMatrixAt(id, m);
      matDirty = true;
    });

    // ── Ripple glow to neighbors ──────────────────────────────────────────────
    rippleAnims.current.forEach((anim, id) => {
      anim.t += delta * 3.5;
      if (anim.t >= 1) {
        rippleAnims.current.delete(id);
        // restore base glow color
        const hex = store.tileColors[id];
        glowRef.current.setColorAt(
          id,
          hex ? tmpColor.set(hex).multiplyScalar(store.glowIntensity * 1.2) : GLOW_BLACK
        );
        glowDirty = true;
        return;
      }
      const boost = Math.sin(anim.t * Math.PI) * 2.8;
      const hex = store.tileColors[id] ?? anim.color;
      glowRef.current.setColorAt(id, tmpColor.set(hex).multiplyScalar(store.glowIntensity * 1.2 + boost));
      glowDirty = true;
    });

    // ── Hover highlight ───────────────────────────────────────────────────────
    const hid = hoveredId.current;
    if (hid >= 0 && baseMatrices[hid] && !popAnims.current.has(hid)) {
      const m = baseMatrices[hid].clone();
      m.decompose(tmpVec3, tmpQuat, tmpScale);
      tmpScale.multiplyScalar(1.12);
      m.compose(tmpVec3, tmpQuat, tmpScale);
      tilesRef.current.setMatrixAt(hid, m);
      const hex = store.tileColors[hid];
      tilesRef.current.setColorAt(
        hid,
        hex ? tmpColor.set(hex).lerp(HOVER_BOOST, 0.4) : tmpColor.set(0.28, 0.28, 0.28)
      );
      matDirty = true;
      if (tilesRef.current.instanceColor) tilesRef.current.instanceColor.needsUpdate = true;
    }

    if (matDirty) {
      tilesRef.current.instanceMatrix.needsUpdate = true;
      glowRef.current.instanceMatrix.needsUpdate = true;
    }
    if (glowDirty && glowRef.current.instanceColor) {
      glowRef.current.instanceColor.needsUpdate = true;
    }

    // ── Particle system ───────────────────────────────────────────────────────
    const live = particles.current;
    const dt = Math.min(delta, 0.05);

    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life -= dt;
      if (p.life <= 0) { live.splice(i, 1); continue; }
      const drag = Math.max(0, 1 - 3.5 * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.vz *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }

    // Write to buffers — brighten with additive blending for bloom
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i < live.length) {
        const p = live[i];
        const t = p.life / p.maxLife; // 1→0
        const bright = t * t * 2.5;
        pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
        pCol[i * 3] = p.r * bright; pCol[i * 3 + 1] = p.g * bright; pCol[i * 3 + 2] = p.b * bright;
      } else {
        pPos[i * 3] = 0; pPos[i * 3 + 1] = 0; pPos[i * 3 + 2] = 0;
        pCol[i * 3] = 0; pCol[i * 3 + 1] = 0; pCol[i * 3 + 2] = 0;
      }
    }

    (pGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (pGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      {/* Core cube body */}
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#080818" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Tile layer */}
      <instancedMesh
        ref={tilesRef}
        args={[planeGeo, tileMat, totalTiles]}
        frustumCulled={false}
      />

      {/* Additive glow layer */}
      <instancedMesh
        ref={glowRef}
        args={[planeGeo, glowMat, totalTiles]}
        frustumCulled={false}
        renderOrder={1}
      />

      {/* Paint burst particles — child of group, rotate with cube */}
      <points geometry={pGeo} material={pMat} frustumCulled={false} renderOrder={2} />
    </group>
  );
}
