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

interface PopAnim {
  id: number;
  t: number;
}

export default function PaintableCube() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const coreMeshRef = useRef<THREE.Mesh>(null!);
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

  const {
    gridSize, tileColors, paintTile, fillMode, glowIntensity, autoRotate,
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
      paintTile(id);
      playPaintSound(useGameStore.getState().getNextColor());
      triggerHaptic();
      popAnims.current.set(id, { id, t: 0 });
    },
    [paintTile]
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
      if (dist > 3) pointerMoved.current = true;

      if (pointerMoved.current) {
        isDragging.current = true;
        rotVel.current.y += dx * 0.004;
        rotVel.current.x += dy * 0.004;
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

    if (autoRotate && !isDragging.current) {
      rotVel.current.y += 0.003;
    }

    groupRef.current.rotation.y += rotVel.current.y;
    groupRef.current.rotation.x += rotVel.current.x;
    groupRef.current.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, groupRef.current.rotation.x));

    rotVel.current.x *= 0.92;
    rotVel.current.y *= 0.92;

    let needsMatrixUpdate = false;

    popAnims.current.forEach((anim, id) => {
      anim.t += delta * 8;
      if (anim.t >= 1) {
        meshRef.current.setMatrixAt(id, baseMatrices[id]);
        popAnims.current.delete(id);
        needsMatrixUpdate = true;
        return;
      }
      const scale = 1 + Math.sin(anim.t * Math.PI) * 0.15;
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

    if (hoveredId >= 0) {
      const m = baseMatrices[hoveredId]?.clone();
      if (m) {
        const pos = new THREE.Vector3();
        const rot = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        m.decompose(pos, rot, scl);
        scl.multiplyScalar(1.08);
        m.compose(pos, rot, scl);
        meshRef.current.setMatrixAt(hoveredId, m);
        const paintedColor = tileColors[hoveredId];
        meshRef.current.setColorAt(
          hoveredId,
          paintedColor ? tempColor.set(paintedColor).lerp(HOVER_CLR, 0.3) : HOVER_CLR.clone().multiplyScalar(0.4)
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
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.2,
        metalness: 0.1,
        envMapIntensity: 0.5,
        emissiveIntensity: glowIntensity,
      }),
    [glowIntensity]
  );

  useEffect(() => {
    material.emissiveIntensity = glowIntensity * 0.4;
    material.needsUpdate = true;
  }, [glowIntensity, material]);

  return (
    <group ref={groupRef} rotation={[0.3, 0.5, 0]}>
      <mesh ref={coreMeshRef} renderOrder={-1}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0a0a1a" roughness={0.8} metalness={0.2} />
      </mesh>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, totalTiles]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
    </group>
  );
}
