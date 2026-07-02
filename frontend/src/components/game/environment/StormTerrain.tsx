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

import { useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { StaticCollider } from 'bvhecctrl';
import * as THREE from 'three';

import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';
import { registerCollider, unregisterCollider } from '@/src/core/utils/globalRaycaster';
import { getTerrainElevation } from '@jagres/shared';

import { TerrainMaterial } from '@/src/features/terrain/material/TerrainMaterial';
import { useTerrainBrush, globalDirtyPaint, globalDirtySculpt, setGlobalDirtyPaint, setGlobalDirtySculpt } from '@/src/features/terrain/hooks/useTerrainBrush';
import { TERRAIN_SIZE, GROUND_Y, SCULPT_RES, BRUSH_WORLD_RADIUS_FACTOR } from '@/src/features/terrain/constants/terrain.constants';

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
  const { terrainConfig, brushSize, paintMode, brushHoverPos, isEditorOpen } = useEditorStore();

  const {
    paintTexture, sculptHeightsRef, sculptTrigger, isSculptLoaded,
    isDrawingRef, mousePressedRef, isShiftPressedRef, isOverURef,
    meshRef, handlePaint, ringColor,
  } = useTerrainBrush(baseDistance, onSculptLoaded);

  // ── Terrain geometry ───────────────────────────────────────────────────────
  const terrainGeo = useMemo(() => {
    const segs = potatoMode ? 64 : 128;
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
    const pos = geo.attributes.position;
    const heights = sculptHeightsRef.current;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const elev = getTerrainElevation(x, y, 'STORM', baseDistance, terrainConfig, true);
      const u  = (x + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
      const v  = (y + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
      const px = Math.max(0, Math.min(SCULPT_RES - 1, Math.round(u * (SCULPT_RES - 1))));
      const py = Math.max(0, Math.min(SCULPT_RES - 1, Math.round((1 - v) * (SCULPT_RES - 1))));
      pos.setZ(i, elev + (heights[py * SCULPT_RES + px] || 0));
    }
    geo.computeVertexNormals();
    (geo as any).computeBoundsTree({ maxDepth: 64, maxLeafSize: 5 });
    return geo;
  }, [baseDistance, potatoMode, terrainConfig, sculptTrigger]);

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
      state.raycaster.setFromCamera(state.mouse, state.camera);
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
        key={`terrain-sc-${sculptTrigger}`}
        debug={debug}
        restitution={0}
        friction={1}
        BVHOptions={{ strategy: 1, maxDepth: 64, maxLeafSize: 5, verbose: false } as any}
      >
        <mesh
          ref={meshRef}
          name="terrain"
          geometry={terrainGeo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, GROUND_Y, 0]}
          receiveShadow={!potatoMode || isEditorOpen}
          onPointerDown={(e: any) => {
            if (paintMode && e.button === 0) e.stopPropagation();
          }}
        >
          <primitive object={TerrainMaterial} attach="material" wireframe={debug} />
        </mesh>
      </StaticCollider>

      {/* ── Ring brush: lingkaran penanda radius kuas ── */}
      {paintMode && brushHoverPos && (() => {
        const R    = brushSize * BRUSH_WORLD_RADIUS_FACTOR;
        const SEGS = 64;
        const cx   = brushHoverPos[0];
        const cz   = brushHoverPos[2];
        const pts  = new Float32Array((SEGS + 1) * 3);

        for (let i = 0; i <= SEGS; i++) {
          const a  = (i / SEGS) * Math.PI * 2;
          const wx = cx + Math.cos(a) * R;
          const wz = cz + Math.sin(a) * R;
          let   wy = getTerrainElevation(wx, wz, 'STORM' as any, baseDistance, terrainConfig);
          if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
            const h = (window as any).getGroundHeight(wx, wz, -9999);
            if (h !== -9999) wy = h;
          }
          pts[i * 3] = wx; pts[i * 3 + 1] = wy + 0.35; pts[i * 3 + 2] = wz;
        }

        return (
          <lineLoop>
            <bufferGeometry>
              <float32BufferAttribute attach="attributes-position" args={[pts, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={ringColor} linewidth={2} transparent opacity={0.9} depthWrite={false} />
          </lineLoop>
        );
      })()}
    </>
  );
};
