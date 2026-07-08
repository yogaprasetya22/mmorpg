'use client';

/**
 * StormTerrain.tsx — Tampilan (View) untuk fitur Terrain
 *
 * Hanya berisi kode visual Three.js:
 *   - Mesh terrain dengan StaticCollider BVH
 *   - Ring brush (lingkaran penanda kuas)
 *   - useFrame: raycast brush + dirty flag GPU flush
 *
 * Semua logika sudah dipindahkan ke:
 *   - hooks/useTerrainBrush.ts (paint + sculpt logic)
 *   - material/TerrainMaterial.ts (shader)
 *   - constants/terrain.constants.ts (nilai tetap)
 */

import { useMemo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { editorPointerRefs } from '@/src/features/world-editor/core/editorPointerRefs';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { StaticCollider } from '@jagres/bvhecctrl';
import * as THREE from 'three';

import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';
import { registerCollider, unregisterCollider } from '@/src/core/utils/globalRaycaster';
import { getTerrainElevation } from '@jagres/shared';

import { TerrainMaterial } from '@/src/features/terrain/material/TerrainMaterial';
import { useTerrainBrush, globalDirtyPaint, globalDirtySculpt, setGlobalDirtyPaint, setGlobalDirtySculpt } from '@/src/features/terrain/hooks/useTerrainBrush';
import { TERRAIN_SIZE, GROUND_Y, SCULPT_RES } from '@/src/features/terrain/constants/terrain.constants';

// BVH support — hanya didaftarkan sekali (idempotent)
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

// ── Props ─────────────────────────────────────────────────────────────────────
interface StormTerrainProps {
  baseDistance: number;
  potatoMode?: boolean;
  debug?: boolean;
  onReady?: () => void;
  onSculptLoaded?: () => void;
}

// ── Komponen View ─────────────────────────────────────────────────────────────
export const StormTerrain = ({
  baseDistance,
  potatoMode,
  debug,
  onReady,
  onSculptLoaded,
}: StormTerrainProps) => {
  const { terrainConfig, paintMode, isEditorOpen, terrainWireframe } = useEditorStore();

  const {
    paintTexture, sculptHeightsRef, sculptTrigger, isSculptLoaded,
    isDrawingRef, mousePressedRef, isShiftPressedRef, isOverURef,
    meshRef, handlePaint,
  } = useTerrainBrush(baseDistance, onSculptLoaded);

  const physicsMeshRef = useRef<THREE.Mesh>(null!);

  // ── Physics geometry (128 segments for perfect collision parity) ──
  const physicsGeo = useMemo(() => {
    const segs = potatoMode ? 64 : 128;
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
    const pos = geo.attributes.position;
    const heights = sculptHeightsRef.current;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const elev = getTerrainElevation(x, y, 'STORM', baseDistance, terrainConfig, true);
      const u = (x + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
      const v = (y + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
      const px = Math.max(0, Math.min(SCULPT_RES - 1, Math.round(u * (SCULPT_RES - 1))));
      const py = Math.max(0, Math.min(SCULPT_RES - 1, Math.round((1 - v) * (SCULPT_RES - 1))));
      pos.setZ(i, elev + (heights[py * SCULPT_RES + px] || 0));
    }
    geo.computeVertexNormals();
    (geo as any).computeBoundsTree({ maxDepth: 32, maxLeafSize: 10 });
    return geo;
  }, [baseDistance, potatoMode, terrainConfig]);

  // ── Visual geometry (128 segments for perfect collision parity) ──
  const terrainGeo = useMemo(() => {
    const segs = potatoMode ? 64 : 128;
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
    const pos = geo.attributes.position;
    const heights = sculptHeightsRef.current;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const elev = getTerrainElevation(x, y, 'STORM', baseDistance, terrainConfig, true);
      const u = (x + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
      const v = (y + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
      const px = Math.max(0, Math.min(SCULPT_RES - 1, Math.round(u * (SCULPT_RES - 1))));
      const py = Math.max(0, Math.min(SCULPT_RES - 1, Math.round((1 - v) * (SCULPT_RES - 1))));
      pos.setZ(i, elev + (heights[py * SCULPT_RES + px] || 0));
    }
    geo.computeVertexNormals();
    (geo as any).computeBoundsTree({ maxDepth: 64, maxLeafSize: 5 });
    return geo;
  }, [baseDistance, potatoMode, terrainConfig]);

  // Update both visual & physics mesh heights when sculptTrigger fires (e.g. load/reset/flatten)
  useEffect(() => {
    const heights = sculptHeightsRef.current;
    if (!isSculptLoaded) return;

    // 1. Update visual mesh
    if (meshRef.current) {
      const geo = meshRef.current.geometry;
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const elev = getTerrainElevation(x, y, 'STORM', baseDistance, terrainConfig, true);
        const u = (x + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
        const v = (y + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
        const px = Math.max(0, Math.min(SCULPT_RES - 1, Math.round(u * (SCULPT_RES - 1))));
        const py = Math.max(0, Math.min(SCULPT_RES - 1, Math.round((1 - v) * (SCULPT_RES - 1))));
        pos.setZ(i, elev + (heights[py * SCULPT_RES + px] || 0));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      const bt = (geo as any).boundsTree;
      if (bt) bt.refit();
    }

    // 2. Update physics mesh
    if (physicsMeshRef.current) {
      const geo = physicsMeshRef.current.geometry;
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const elev = getTerrainElevation(x, y, 'STORM', baseDistance, terrainConfig, true);
        const u = (x + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
        const v = (y + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
        const px = Math.max(0, Math.min(SCULPT_RES - 1, Math.round(u * (SCULPT_RES - 1))));
        const py = Math.max(0, Math.min(SCULPT_RES - 1, Math.round((1 - v) * (SCULPT_RES - 1))));
        pos.setZ(i, elev + (heights[py * SCULPT_RES + px] || 0));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      const bt = (geo as any).boundsTree;
      if (bt) bt.refit();
    }
  }, [sculptTrigger, baseDistance, terrainConfig, isSculptLoaded]);

  // Signal parent terrain siap dipakai
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady?.());
    return () => cancelAnimationFrame(id);
  }, [terrainGeo, onReady]);

  // Daftarkan mesh ke global raycaster (collision)
  useEffect(() => {
    if (meshRef.current) {
      registerCollider(meshRef.current);
      return () => unregisterCollider(meshRef.current);
    }
  }, [terrainGeo]);

  // ── Frame loop: brush raycast + GPU dirty flush ───────────────────────────
  useFrame((state) => {
    // Brush aktif saat tombol kiri ditekan dan kursor tidak di atas UI
    if (paintMode && mousePressedRef.current && !isOverURef.current) {
      state.raycaster.setFromCamera(state.pointer, state.camera);
      const hits = state.raycaster.intersectObject(meshRef.current);
      if (hits.length > 0 && hits[0].uv) {
        isDrawingRef.current = true;
        handlePaint(hits[0].uv, isShiftPressedRef.current, hits[0].point);
      }
    }

    // Flush dirty flags ke GPU (hanya satu kali per frame)
    if (globalDirtyPaint) {
      paintTexture.needsUpdate = true;
      setGlobalDirtyPaint(false);
    }
    if (globalDirtySculpt) {
      const geo = meshRef.current?.geometry as THREE.BufferGeometry;
      if (geo) {
        geo.computeVertexNormals();
        const bt = (geo as any).boundsTree;
        if (bt) {
          if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(() => bt.refit(), { timeout: 200 });
          else setTimeout(() => bt.refit(), 0);
        }
      }
      setGlobalDirtySculpt(false);
    }
  });

  if (!isSculptLoaded) return null;

  return (
    <>
      {/* ── Terrain mesh dengan physics collider ── */}
      <StaticCollider
        key={`terrain-collider-key-${isSculptLoaded}-${sculptTrigger}`}
        bvhName="terrain"
        debug={debug}
        restitution={0}
        friction={1}
        BVHOptions={{ strategy: 1, maxDepth: 32, maxLeafSize: 10, verbose: false } as any}
      >
        <mesh
          ref={physicsMeshRef}
          name="terrain-collider"
          geometry={physicsGeo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, GROUND_Y, 0]}
        >
          <meshBasicMaterial visible={false} />
        </mesh>
      </StaticCollider>

      <mesh
        ref={meshRef}
        name="terrain"
        geometry={terrainGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, GROUND_Y, 0]}
        receiveShadow={!potatoMode || isEditorOpen}
        onPointerDown={(e: any) => {
          if (paintMode && e.button === 0) { e.stopPropagation(); return; }
          // Delegate to WorldEditor via module-level refs (WebGPU-safe)
          if (e.intersections?.[0]?.point) {
            editorPointerRefs.onTerrainPointerDown?.(e.intersections[0].point, e.button, e);
          }
        }}
        onPointerUp={(e: any) => {
          if (e.intersections?.[0]?.point) {
            editorPointerRefs.onTerrainPointerUp?.(e.intersections[0].point, e.button, e);
          }
        }}
        onPointerMove={(e: any) => {
          if (e.intersections?.[0]?.point) {
            editorPointerRefs.onTerrainPointerMove?.(e.intersections[0].point, e);
          }
        }}
      >
        <primitive object={TerrainMaterial} attach="material" wireframe={debug || terrainWireframe} />
      </mesh>

      <mesh
        name="editor-catchall"
        geometry={terrainGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, GROUND_Y, 0]}
        visible={false}
        onPointerDown={(e: any) => {
          // Catch clicks that miss all EditorItem children fall through to terrain
          if (e.intersections?.[0]?.point && (e as any).eventObject?.name !== 'terrain') {
            editorPointerRefs.onTerrainPointerDown?.(e.intersections[0].point, e.button, e);
          }
        }}
      >
        <meshBasicMaterial visible={false} depthWrite={false} />
      </mesh>
    </>
  );
};
