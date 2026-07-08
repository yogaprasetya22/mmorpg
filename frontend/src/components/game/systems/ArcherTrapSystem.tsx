'use client';

/**
 * ArcherTrapSystem — Ankle Snare Trap Entity Renderer
 * * Renders up to 3 ground traps placed by the Archer's Ankle Snare skill.
 * Each trap shows a subtle glowing glyph on the ground. When an enemy
 * walks within trigger radius, the trap activates (root + VFX burst).
 */

import * as THREE from 'three';
import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { getTrapPool } from '@/src/core/combat/archerSkills';

const MAX_TRAPS = 3;
const TRAP_LIFETIME_MS = 15000;
const _dummy = new THREE.Object3D();

export function ArcherTrapSystem({
  unitRegistry,
  spawnVFX,
}: {
  unitRegistry?: React.RefObject<any[]>;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean, isMagic?: boolean, customColor?: string) => void;
  spawnVFX?: (pos: [number, number, number], type: string, color: string) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  // 1. Siapkan state untuk material
  const [trapMaterial, setTrapMaterial] = useState<THREE.Material | null>(null);

  // 2. Geometry tetap menggunakan useMemo karena synchronous dan aman
  const geo = useMemo(() => new THREE.RingGeometry(0.6, 1.2, 24), []);

  // 3. Lazy Load TSL dan bangun NodeMaterial di client-side
  useEffect(() => {
    let isMounted = true;

    async function loadMaterial() {
      const tsl = await import('three/tsl');
      const { NodeMaterial } = await import('three/webgpu');

      const { time, vec2, vec3, vec4, uv, length, smoothstep, sin, atan, abs, sub, float, step } = tsl;

      const m = new NodeMaterial();
      m.transparent = true;
      m.depthWrite = false;
      m.side = THREE.DoubleSide;

      const uColor = vec3(139 / 255, 92 / 255, 246 / 255); // '#8b5cf6'
      const vUv = uv();
      const center = vec2(0.5);
      const r = length(sub(vUv, center)).mul(2.0);
      const ring = smoothstep(float(0.3), float(0.35), r).mul(smoothstep(float(0.95), float(0.85), r));
      const pulse = float(0.5).add(float(0.5).mul(sin(time.mul(3.0))));
      const alphaVal = ring.mul(float(0.3).add(float(0.2).mul(pulse)));

      // Rune pattern: radial lines
      const angle = atan(sub(vUv.y, float(0.5)), sub(vUv.x, float(0.5)));
      const rune = step(float(0.85), abs(sin(angle.mul(4.0).add(time.mul(0.5))))).mul(ring);
      const col = uColor.mul(float(1.0).add(rune.mul(0.5)));

      m.colorNode = vec4(col, alphaVal);

      // Hanya set state jika komponen belum di-unmount
      if (isMounted) {
        setTrapMaterial(m);
      }
    }

    loadMaterial();

    return () => {
      isMounted = false;
    };
  }, []);

  // Track which traps have already triggered
  const triggeredRef = useRef<Set<number>>(new Set());

  useFrame(() => {
    const mesh = meshRef.current;
    // Pastikan mesh sudah ada (akan null jika material belum siap)
    if (!mesh) return;

    const now = performance.now();
    const traps = getTrapPool();
    const enemies = unitRegistry?.current || [];

    let instanceCount = 0;

    for (let i = 0; i < MAX_TRAPS; i++) {
      const trap = traps[i];

      // Expire old traps
      if (trap.active && now - trap.createTime > TRAP_LIFETIME_MS) {
        trap.active = false;
        triggeredRef.current.delete(i);
      }

      if (!trap.active) {
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      // Check if enemy triggered this trap
      if (!triggeredRef.current.has(i)) {
        for (const enemy of enemies) {
          if (enemy.type !== 'enemy' || !enemy.isActive || enemy.isDying) continue;
          const dx = enemy.position[0] - trap.x;
          const dz = enemy.position[2] - trap.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < trap.triggerRadius * trap.triggerRadius) {
            // TRIGGERED!
            triggeredRef.current.add(i);
            trap.active = false;

            // Root the enemy for 3 seconds
            (enemy as any).debuff = 'snare';
            (enemy as any).debuffUntil = now + trap.rootDurationMs;

            // VFX burst
            if (spawnVFX) {
              spawnVFX([trap.x, trap.y + 0.5, trap.z], 'magic', '#8b5cf6');
            }

            console.log(`🪤 Ankle Snare triggered! Rooted ${enemy.name || enemy.id} for ${trap.rootDurationMs / 1000}s`);
            break;
          }
        }
      }

      // Render trap glyph
      if (trap.active) {
        _dummy.position.set(trap.x, trap.y + 0.02, trap.z);
        _dummy.rotation.set(-Math.PI / 2, 0, 0);
        const age = (now - trap.createTime) / TRAP_LIFETIME_MS;
        const fade = age > 0.8 ? (1.0 - age) / 0.2 : 1.0; // Fade in last 20%
        _dummy.scale.setScalar(fade);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
        instanceCount++;
      } else {
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  // Tahan render InstancedMesh sampai material selesai dimuat secara dinamis
  if (!trapMaterial) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, trapMaterial, MAX_TRAPS]}
      frustumCulled={false}
      renderOrder={990}
    />
  );
}