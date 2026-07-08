'use client';

/**
 * Shared HP bar plane meshes with shared geometry & material instances.
 *
 * Instead of each entity creating its own PlaneGeometry + MeshBasicMaterial
 * (causing N×3 geometry uploads and N×3 material instances on the GPU),
 * this module shares a single geometry and material across ALL HP bars.
 *
 * This reduces:
 * - GPU geometry buffer uploads (from N×3 to 3 total)
 * - Material uniform state changes during render
 * - GC pressure from geometry/material disposal on unmount
 */

import { forwardRef } from 'react';
import * as THREE from 'three';

// ─── Shared Geometries (created once, never disposed while module lives) ──────
const SHARED_BG_GEOMETRY = new THREE.PlaneGeometry(1.24, 0.16);
const SHARED_TRACK_GEOMETRY = new THREE.PlaneGeometry(1.2, 0.12);
const SHARED_FILL_GEOMETRY = new THREE.PlaneGeometry(1.2, 0.12);

// ─── Shared Materials (toneMapped=false to render correctly over 3D scene) ───
const SHARED_BG_MATERIAL = new THREE.MeshBasicMaterial({ color: '#09090b', toneMapped: false });
const SHARED_TRACK_MATERIAL = new THREE.MeshBasicMaterial({ color: '#27272a', toneMapped: false });

// Per-type fill materials (shared across all entities of the same type)
const FILL_MATERIALS: Record<string, THREE.MeshBasicMaterial> = {
  monster: new THREE.MeshBasicMaterial({ color: '#f43f5e', toneMapped: false }),
  boss: new THREE.MeshBasicMaterial({ color: '#ef4444', toneMapped: false }),
  player: new THREE.MeshBasicMaterial({ color: '#10b981', toneMapped: false }),
};

/**
 * Pre-warm: force Three.js to compile these materials/shaders at startup
 * rather than on first entity render (avoids frame hitch).
 */
export function prewarmHpBarMaterials(renderer: any) {
  const dummyScene = new THREE.Scene();
  const dummyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bg = new THREE.Mesh(SHARED_BG_GEOMETRY, SHARED_BG_MATERIAL);
  const track = new THREE.Mesh(SHARED_TRACK_GEOMETRY, SHARED_TRACK_MATERIAL);
  const fill = new THREE.Mesh(SHARED_FILL_GEOMETRY, FILL_MATERIALS.monster);
  bg.position.set(-10, -10, 0);
  track.position.set(-10, -10, 0);
  fill.position.set(-10, -10, 0);
  dummyScene.add(bg, track, fill);
  renderer.compile(dummyScene, dummyCam);
  dummyScene.remove(bg, track, fill);
}

export type HpBarType = 'monster' | 'boss' | 'player';

interface HpBarPlanesProps {
  type: HpBarType;
  /** Ref forwarded to the fill mesh for per-frame scale/position updates */
  fillRef?: React.Ref<THREE.Mesh>;
}

/**
 * Three HP bar planes (background, track, fill) using shared geometry & materials.
 * Drop-in replacement for the 3 individual <mesh> elements inside Billboard.
 */
export const HpBarPlanes = forwardRef<THREE.Group, HpBarPlanesProps>(
  ({ type, fillRef }, ref) => {
    const fillMat = FILL_MATERIALS[type] || FILL_MATERIALS.monster;

    return (
      <group ref={ref}>
        {/* Background border */}
        <mesh
          geometry={SHARED_BG_GEOMETRY}
          material={SHARED_BG_MATERIAL}
          position={[0, 0, -0.001]}
        />
        {/* Track (gray bar showing depleted HP area) */}
        <mesh
          geometry={SHARED_TRACK_GEOMETRY}
          material={SHARED_TRACK_MATERIAL}
          position={[0, 0, 0]}
        />
        {/* Fill (colored bar showing current HP, scaled per-instance) */}
        <mesh
          ref={fillRef}
          geometry={SHARED_FILL_GEOMETRY}
          material={fillMat}
          position={[0, 0, 0.002]}
        />
      </group>
    );
  }
);

HpBarPlanes.displayName = 'HpBarPlanes';
