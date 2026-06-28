'use client';

import { useMemo, useEffect, useRef, Suspense, Component, ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useEditorStore } from '@/src/state/useEditorStore';
import { InstancedStaticCollider } from 'bvhecctrl';
import * as THREE from 'three';
import { registerCollider, unregisterCollider } from '@/src/core/utils/globalRaycaster';
import { windUniforms } from '@/src/core/utils/wind';
import { isGrassAssetPath, GrassField } from './GrassField';

import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Add BVH support to THREE with type safety bypass for prototype augmentation
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

// Module-level scratch objects (zero alloc)
const _tempObj = new THREE.Object3D();
const _tempMatrix = new THREE.Matrix4();
const _color = new THREE.Color();

// Simple error boundary to silently swallow GLB loading failures
class MapItemErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.warn('[ModularMap] GLB load error:', err.message); }
  render() { return this.state.hasError ? null : this.props.children; }
}

export const ModularMap = ({ debug }: { debug?: boolean }) => {
  const { items, selectedMapId, loadFromDatabase, isEditorOpen } = useEditorStore();

  useEffect(() => {
    loadFromDatabase();
  }, [selectedMapId, loadFromDatabase]);

  useFrame((state) => {
    windUniforms.time.value = state.clock.getElapsedTime();
  });

  // Split: grass goes to GrassField, non-grass stays with colliders
  const grassItems = useMemo(() => items.filter(i => isGrassAssetPath(i.path)), [items]);
  const nonGrassItems = useMemo(() => items.filter(i => !isGrassAssetPath(i.path)), [items]);

  // Group non-grass items by path for instanced rendering
  const nonGrassGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    nonGrassItems.forEach((item) => {
      if (!groups[item.path]) groups[item.path] = [];
      groups[item.path].push(item);
    });
    return groups;
  }, [nonGrassItems]);

  if (items.length === 0 || isEditorOpen) return null;

  return (
    <>
      {/* Grass items — no collider, with wind sway */}
      <GrassField items={grassItems} />

      {/* Non-grass items — with collider, no wind sway */}
      {Object.entries(nonGrassGroups).map(([path, instances]) => (
        <MapItemErrorBoundary key={`err-${path}`}>
          <Suspense fallback={null}>
            <InstancedModelGroup
              key={`group-${path}-${instances.length}`}
              path={path}
              instances={instances}
              debug={debug}
            />
          </Suspense>
        </MapItemErrorBoundary>
      ))}
    </>
  );
};

const InstancedModelGroup = ({ path, instances, debug }: { path: string, instances: any[], debug?: boolean }) => {
  const { scene } = useGLTF(path) as any;

  const meshes = useMemo(() => {
    const extracted: { geometry: THREE.BufferGeometry, material: THREE.Material, localMatrix: THREE.Matrix4 }[] = [];

    scene.updateMatrixWorld(true);

    scene.traverse((child: any) => {
      if (!child.isMesh) return;
      // BVH for physics collision
      if (child.geometry && !child.geometry.boundsTree) {
        child.geometry.computeBoundsTree({ maxDepth: 64, maxLeafSize: 10 });
      }

      const mat = child.material.clone();
      extracted.push({
        geometry: child.geometry,
        material: mat,
        localMatrix: child.matrixWorld.clone()
      });
    });
    return extracted;
  }, [scene, path]);

  return (
    <InstancedStaticCollider
      debug={debug}
      restitution={0}
      friction={1}
    >
      {meshes.map((mesh, index) => (
        <InstancedMeshPart
          key={index}
          meshData={mesh}
          instances={instances}
        />
      ))}
    </InstancedStaticCollider>
  );
};

const InstancedMeshPart = ({ meshData, instances }: { meshData: any, instances: any[] }) => {
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

      if (item.color) {
        _color.set(item.color);
        mesh.setColorAt(i, _color);
      } else {
        _color.set(0xffffff);
        mesh.setColorAt(i, _color);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [instances, meshData]);

  // Register in global colliders for X-Ray camera occlusion raycasting
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    registerCollider(mesh);
    return () => unregisterCollider(mesh);
  }, [instances, meshData]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[meshData.geometry, meshData.material, instances.length]}
      castShadow
      receiveShadow={false}
      frustumCulled
    />
  );
};
