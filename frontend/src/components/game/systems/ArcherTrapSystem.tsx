'use client';

/**
 * ArcherTrapSystem — Ankle Snare Trap Entity Renderer
 * 
 * Renders up to 3 ground traps placed by the Archer's Ankle Snare skill.
 * Each trap shows a subtle glowing glyph on the ground. When an enemy
 * walks within trigger radius, the trap activates (root + VFX burst).
 */

import * as THREE from 'three';
import { useRef, useMemo } from 'react';
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

  // Geometry: flat ring on the ground
  const geo = useMemo(() => new THREE.RingGeometry(0.6, 1.2, 24), []);

  // Material: glowing purple rune
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#8b5cf6') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.3, 0.35, r) * smoothstep(0.95, 0.85, r);
        float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
        float alpha = ring * (0.3 + 0.2 * pulse);
        // Rune pattern: radial lines
        float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
        float rune = step(0.85, abs(sin(angle * 4.0 + uTime * 0.5))) * ring;
        vec3 col = uColor * (1.0 + rune * 0.5);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);

  // Track which traps have already triggered (to avoid double-trigger)
  const triggeredRef = useRef<Set<number>>(new Set());

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const now = performance.now();
    const traps = getTrapPool();
    const enemies = unitRegistry?.current || [];

    mat.uniforms.uTime.value = state.clock.elapsedTime;

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

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_TRAPS]}
      frustumCulled={false}
      renderOrder={990}
    />
  );
}
