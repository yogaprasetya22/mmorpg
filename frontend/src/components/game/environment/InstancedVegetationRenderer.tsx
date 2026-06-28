'use client';

/**
 * InstancedVegetationRenderer
 *
 * Renders all procedural-vegetation items using THREE.InstancedMesh,
 * grouping by model path so that N identical trees = 1 draw call.
 *
 * Key benefits vs individual GLTF renders:
 *   - 500 pine trees → 1 draw call (was 500)
 *   - GPU-instanced matrix transforms
 *   - Same interaction as before (GLTF loaded via useGLTF per path)
 */

import { useMemo, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { MapItem } from '@/src/state/useEditorStore';

// ── PER-PATH INSTANCED GROUP ─────────────────────────────────────────────────

const InstancedGroup = ({ path, items }: { path: string; items: MapItem[] }) => {
  const { scene } = useGLTF(path);

  // Find the first mesh in the loaded GLTF scene to use as instanced prototype
  const { geometry, material } = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    let mat: THREE.Material | THREE.Material[] | null = null;
    scene.traverse((child: any) => {
      if (!geo && child.isMesh && child.geometry) {
        geo = child.geometry;
        mat = child.material;
      }
    });
    return { geometry: geo, material: mat };
  }, [scene]);

  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    items.forEach((item, i) => {
      dummy.position.set(...item.pos);
      dummy.rotation.set(...item.rot);
      dummy.scale.set(...item.sca);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Per-instance color support (optional)
      if (item.color && meshRef.current.instanceColor) {
        const col = new THREE.Color(item.color);
        meshRef.current.setColorAt(i, col);
      }
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [items, dummy]);

  if (!geometry || !material) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material as THREE.Material, items.length]}
      castShadow
      receiveShadow={false}
      frustumCulled
    />
  );
};

// ── MAIN RENDERER ─────────────────────────────────────────────────────────────

interface Props {
  items: MapItem[];
}

export const InstancedVegetationRenderer = ({ items }: Props) => {
  // Group items by their model path
  const groups = useMemo(() => {
    const map = new Map<string, MapItem[]>();
    for (const item of items) {
      if (item.type !== 'procedural-vegetation') continue;
      const arr = map.get(item.path) || [];
      arr.push(item);
      map.set(item.path, arr);
    }
    return map;
  }, [items]);

  return (
    <>
      {Array.from(groups.entries()).map(([path, groupItems]) => (
        <InstancedGroup key={path} path={path} items={groupItems} />
      ))}
    </>
  );
};
