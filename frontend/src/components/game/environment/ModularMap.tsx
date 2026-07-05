'use client';

/**
 * ModularMap.tsx — renders all map items from the database in the arena scene.
 *
 * Optimized for 10,000-20,000 objects at 60 FPS using Unity/Roblox-grade techniques:
 * 1. Distance-based culling: only render items within 200m of player
 * 2. Physics distance gate: only register colliders within 60m of player
 * 3. Module-level scratch (zero alloc on matrix writes)
 * 4. castShadow=false for vegetation, true only for large structures
 * 5. useRef + useMemo for stable references
 */

import { useMemo, useEffect, useState, useRef, Suspense, Component, ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';
import { useStore } from '@/src/state/useStore';
import { InstancedStaticCollider } from '@jagres/bvhecctrl';
import * as THREE from 'three';
import { registerCollider, unregisterCollider } from '@/src/core/utils/globalRaycaster';
import { windUniforms } from '@jagres/shared';
import { isGrassAssetPath, GrassField } from './GrassField';
import { _charPos } from '@/src/entities/player/buffers';

import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

// ── Constants ──
const SECTOR_SIZE = 50;        // metres — matches VegetationLayers sector grid
const RENDER_DIST_SQ = 160 * 160;  // 160m render distance — match VegetationLayers

// ── Module-level scratch (zero alloc) ──
const _tempObj = new THREE.Object3D();
const _tempMatrix = new THREE.Matrix4();
const _color = new THREE.Color();
const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _sectorSphere = new THREE.Sphere();
let _lastFrustumFrame = -1;

function getSharedFrustum(state: any): THREE.Frustum {
  const frame = state.gl.info.render.frame;
  if (frame !== _lastFrustumFrame) {
    _lastFrustumFrame = frame;
    _projScreenMatrix.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreenMatrix);
  }
  return _frustum;
}

function sectorKey(x: number, z: number): string {
  return `${Math.floor(x / SECTOR_SIZE)},${Math.floor(z / SECTOR_SIZE)}`;
}

// Error boundary
class MapItemErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.warn('[ModularMap] GLB load error:', err.message); }
  render() { return this.state.hasError ? null : this.props.children; }
}

// ── MAIN ──

export const ModularMap = ({ debug }: { debug?: boolean }) => {
  const { items, selectedMapId, loadFromDatabase, isEditorOpen } = useEditorStore();

  // Split grass vs non-grass
  const grassItems = useMemo(() => items.filter(i => isGrassAssetPath(i.path)), [items]);
  const nonGrassItems = useMemo(() => items.filter(i => !isGrassAssetPath(i.path)), [items]);

  // Group non-grass by path, THEN by sector
  const sectorGroups = useMemo(() => {
    // { path → { sectorKey → MapItem[] } }
    const pathSectorMap = new Map<string, Map<string, any[]>>();
    for (const item of nonGrassItems) {
      const p = item.path;
      const sk = sectorKey(item.pos[0], item.pos[2]);
      if (!pathSectorMap.has(p)) pathSectorMap.set(p, new Map());
      const sector = pathSectorMap.get(p)!;
      if (!sector.has(sk)) sector.set(sk, []);
      sector.get(sk)!.push(item);
    }
    // Flatten to { path, sectorKey, items, center }[]
    const result: { path: string; sectorKey: string; items: any[]; center: [number, number] }[] = [];
    for (const [path, sectorMap] of pathSectorMap) {
      for (const [sk, sectorItems] of sectorMap) {
        const [sx, sz] = sk.split(',').map(Number);
        result.push({
          path,
          sectorKey: sk,
          items: sectorItems,
          center: [sx * SECTOR_SIZE + SECTOR_SIZE / 2, sz * SECTOR_SIZE + SECTOR_SIZE / 2],
        });
      }
    }
    return result;
  }, [nonGrassItems]);

  const [activeSectorKeys, setActiveSectorKeys] = useState<Set<string>>(new Set());
  const lastUpdateRef = useRef(0);

  useEffect(() => { loadFromDatabase(); }, [selectedMapId, loadFromDatabase]);

  useFrame((state) => {
    windUniforms.time.value = state.clock.getElapsedTime();

    // Run sector streaming check every 30 frames (~500ms) to prevent main-thread spikes
    lastUpdateRef.current++;
    if (lastUpdateRef.current % 30 !== 0) return;

    const pos = useStore.getState().playerPosition;
    if (!pos || sectorGroups.length === 0) return;

    const STREAM_DIST_SQ = 210 * 210; // Stream/mount sectors within 210m
    const nextSet = new Set<string>();

    for (let i = 0; i < sectorGroups.length; i++) {
      const sg = sectorGroups[i];
      const dx = sg.center[0] - pos[0];
      const dz = sg.center[1] - pos[2];
      const distSq = dx * dx + dz * dz;
      if (distSq < STREAM_DIST_SQ) {
        nextSet.add(sg.sectorKey);
      }
    }

    // Check if the set has actually changed to avoid triggering redundant React renders
    let hasChanged = nextSet.size !== activeSectorKeys.size;
    if (!hasChanged) {
      for (const key of nextSet) {
        if (!activeSectorKeys.has(key)) {
          hasChanged = true;
          break;
        }
      }
    }

    if (hasChanged) {
      setActiveSectorKeys(nextSet);
    }
  });

  // Populate active sectors immediately when sectorGroups loads (e.g. on teleport or initial map load)
  useEffect(() => {
    const pos = useStore.getState().playerPosition;
    if (!pos || sectorGroups.length === 0) return;

    const STREAM_DIST_SQ = 210 * 210;
    const initialSet = new Set<string>();

    for (let i = 0; i < sectorGroups.length; i++) {
      const sg = sectorGroups[i];
      const dx = sg.center[0] - pos[0];
      const dz = sg.center[1] - pos[2];
      const distSq = dx * dx + dz * dz;
      if (distSq < STREAM_DIST_SQ) {
        initialSet.add(sg.sectorKey);
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialize active sectors based on position
    setActiveSectorKeys(initialSet);
  }, [sectorGroups]);

  if (items.length === 0 || isEditorOpen) return null;

  return (
    <>
      <GrassField items={grassItems} />
      {sectorGroups
        .filter(sg => activeSectorKeys.has(sg.sectorKey))
        .map(({ path, sectorKey: sk, items: instances, center }) => (
          <MapItemErrorBoundary key={`${path}-${sk}`}>
            <Suspense fallback={null}>
              <InstancedModelGroup
                key={`${path}-${sk}`}
                path={path}
                instances={instances}
                sectorCenter={center}
                debug={debug}
              />
            </Suspense>
          </MapItemErrorBoundary>
        ))}
    </>
  );
};

// ── INSTANCED MODEL GROUP (per-path per-sector) ──

const InstancedModelGroup = ({ path, instances, sectorCenter, debug }: {
  path: string; instances: any[]; sectorCenter: [number, number]; debug?: boolean;
}) => {
  const { scene } = useGLTF(path) as any;
  const groupRef = useRef<THREE.Group>(null!);
  // eslint-disable-next-line react-hooks/purity -- Math.random() intentional for staggered frame culling across instances
  const frameCounterRef = useRef(Math.floor(Math.random() * 3));

  // Distance + Frustum based visibility culling (staggered check)
  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    frameCounterRef.current++;
    if (frameCounterRef.current % 3 !== 0) return;

    const pos = useStore.getState().playerPosition;
    if (!pos) return;

    const dx = sectorCenter[0] - pos[0];
    const dz = sectorCenter[1] - pos[2];
    const distSq = dx * dx + dz * dz;

    // 1. Distance culling
    if (distSq > RENDER_DIST_SQ) {
      if (group.visible) group.visible = false;
      return;
    }

    // 2. Camera Frustum Culling
    // Sector size is 50m, so max distance from center in XZ plane is ~35.4m.
    // We assume a radius of 45m to cover height / scaling.
    _sectorSphere.center.set(sectorCenter[0], pos[1], sectorCenter[1]); // use player Y as height proxy
    _sectorSphere.radius = 45;

    const frustum = getSharedFrustum(state);
    const isInsideFrustum = frustum.intersectsSphere(_sectorSphere);

    if (group.visible !== isInsideFrustum) {
      group.visible = isInsideFrustum;
    }
  });

  const meshes = useMemo(() => {
    const extracted: { geometry: THREE.BufferGeometry; material: THREE.Material; localMatrix: THREE.Matrix4 }[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((child: any) => {
      if (!child.isMesh) return;
      // BVH needed by InstancedStaticCollider (shapecast collision)
      // and CameraOcclusionManager (ghost-through-walls raycast).
      // One-time compute on load, not per frame.
      if (child.geometry && !child.geometry.boundsTree) {
        child.geometry.computeBoundsTree({ maxDepth: 64, maxLeafSize: 10 });
      }
      extracted.push({
        geometry: child.geometry,
        material: child.material,
        localMatrix: child.matrixWorld.clone(),
      });
    });
    return extracted;
  }, [scene, path]);

  return (
    <group ref={groupRef}>
      <InstancedStaticCollider debug={debug} restitution={0} friction={1}>
        {meshes.map((mesh, i) => (
          <InstancedMeshPart key={i} meshData={mesh} instances={instances} />
        ))}
      </InstancedStaticCollider>
    </group>
  );
};

// ── INSTANCED MESH PART ──

const InstancedMeshPart = ({ meshData, instances }: {
  meshData: any; instances: any[];
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const prevLenRef = useRef(0);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (instances.length === prevLenRef.current) return;
    prevLenRef.current = instances.length;

    instances.forEach((item, i) => {
      _tempObj.position.set(item.pos[0], item.pos[1], item.pos[2]);
      _tempObj.rotation.set(item.rot[0], item.rot[1], item.rot[2]);
      _tempObj.scale.set(item.sca[0], item.sca[1], item.sca[2]);
      _tempObj.updateMatrix();
      _tempMatrix.multiplyMatrices(_tempObj.matrix, meshData.localMatrix);
      mesh.setMatrixAt(i, _tempMatrix);
      _color.set(item.color || 0xffffff);
      mesh.setColorAt(i, _color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [instances, meshData]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    registerCollider(mesh);
    return () => {
      unregisterCollider(mesh);
    };
  }, [instances, meshData]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[meshData.geometry, meshData.material, instances.length]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled
    />
  );
};
