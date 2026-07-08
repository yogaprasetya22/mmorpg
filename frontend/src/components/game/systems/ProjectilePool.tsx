'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVFX } from './VFXManager';
import { VFX_TEXTURES } from './effects/VFXAssets';
import { UnitRuntimeData } from '@/src/core/domain/unit.types';

const MAX_BULLETS = 100;
const BULLET_SPEED = 2.2;
const BULLET_LIFETIME = 2.5;
const MAX_PARTICLES = 300;

// Travel-aligned orientation helpers for arrow sprites
const _ppWorldUp = new THREE.Vector3(0, 1, 0);
const _ppFwd = new THREE.Vector3();
const _ppRight = new THREE.Vector3();
const _ppUp = new THREE.Vector3();

function setArrowTravelPool(
  obj: THREE.Object3D,
  px: number, py: number, pz: number,
  dx: number, dy: number, dz: number,
  scaleX: number, scaleY: number
): void {
  _ppFwd.set(dx, dy, dz).normalize();
  _ppRight.crossVectors(_ppFwd, _ppWorldUp);
  if (_ppRight.lengthSq() < 0.0001) _ppRight.set(1, 0, 0);
  _ppRight.normalize();
  _ppUp.crossVectors(_ppRight, _ppFwd).normalize();

  const m = obj.matrix.elements;
  m[0] = _ppFwd.x * scaleX; m[1] = _ppFwd.y * scaleX; m[2] = _ppFwd.z * scaleX; m[3] = 0;
  m[4] = _ppUp.x * scaleY; m[5] = _ppUp.y * scaleY; m[6] = _ppUp.z * scaleY; m[7] = 0;
  m[8] = _ppRight.x; m[9] = _ppRight.y; m[10] = _ppRight.z; m[11] = 0;
  m[12] = px; m[13] = py; m[14] = pz; m[15] = 1;
  obj.matrixAutoUpdate = false;
  obj.matrixWorldNeedsUpdate = true;
}

// ─── Custom Shaders for Premium VFX (Refactored for Lazy Loading) ────────────

const CoreShaderMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
  const { uv, texture, vertexColor, vec4 } = tsl;
  const m = new NodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  m.blending = THREE.AdditiveBlending;
  m.side = THREE.DoubleSide;
  m.vertexColors = true;
  m.alphaTest = 0.02;

  const texNode = texture(tex, uv());
  const vc = vertexColor();
  m.colorNode = vec4(vc.rgb.mul(3.5).mul(texNode.rgb), texNode.a);
  return m as THREE.Material;
};

const TrailShaderMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
  const { time, vec2, vec4, uv, texture, vertexColor, float } = tsl;
  const m = new NodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  m.blending = THREE.AdditiveBlending;
  m.side = THREE.DoubleSide;
  m.vertexColors = true;
  m.alphaTest = 0.02;

  const texNode = texture(tex, vec2(uv().x.sub(time.mul(4.0)), uv().y));
  const fade = uv().x.mul(uv().x);
  const vc = vertexColor();
  const col = vc.rgb.mul(texNode.rgb).mul(float(1.5).add(fade.mul(1.5)));
  m.colorNode = vec4(col, texNode.a.mul(fade).mul(0.95));
  return m as THREE.Material;
};

const ParticleShaderMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
  const { uv, texture, vertexColor, vec4 } = tsl;
  const m = new NodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  m.blending = THREE.AdditiveBlending;
  m.vertexColors = true;
  m.alphaTest = 0.02;

  const texNode = texture(tex, uv());
  const vc = vertexColor();
  m.colorNode = vec4(vc.rgb.mul(texNode.rgb).mul(2.5), texNode.a);
  return m as THREE.Material;
};

// ─── Projectile Types Config ────────────────────────────────────────────────

interface ProjectileConfig {
  color: string;
  coreSize: [number, number];
  trailSize: [number, number];
  sparkColor: string;
  sparkCount: number;
}

const PROJECTILE_CONFIGS: Record<string, ProjectileConfig> = {
  arrow: { color: '#ffd700', coreSize: [0.5, 0.25], trailSize: [2.5, 0.25], sparkColor: '#ffea55', sparkCount: 1 },
  fire: { color: '#ff4500', coreSize: [0.45, 0.45], trailSize: [2.0, 0.45], sparkColor: '#ffa500', sparkCount: 2 },
  ice: { color: '#00ffff', coreSize: [0.35, 0.35], trailSize: [1.8, 0.3], sparkColor: '#b0ffff', sparkCount: 1 },
  magic: { color: '#d100d1', coreSize: [0.4, 0.4], trailSize: [2.2, 0.35], sparkColor: '#ff66ff', sparkCount: 2 },
  holy: { color: '#ffffcc', coreSize: [0.45, 0.45], trailSize: [2.4, 0.3], sparkColor: '#ffffff', sparkCount: 1 }
};

export interface ProjectilePoolHandle {
  fire: (origin: THREE.Vector3, direction: THREE.Vector3, options?: {
    color?: string; speed?: number; type?: 'arrow' | 'fire' | 'ice' | 'magic' | 'holy'; targetId?: string;
  }) => void;
}

interface ProjectilePoolProps {
  damageQueue?: React.RefObject<any[]>;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean) => void;
  playerClass?: string;
  unitRegistry?: React.RefObject<UnitRuntimeData[]>;
}

const ProjectilePool = forwardRef<ProjectilePoolHandle, ProjectilePoolProps>((props, ref) => {
  const coreMeshRef = useRef<THREE.InstancedMesh>(null!);
  const trailMeshRef = useRef<THREE.InstancedMesh>(null!);
  const particleMeshRef = useRef<THREE.InstancedMesh>(null!);

  const { scene } = useThree();
  const { spawnVFX } = useVFX();

  // State untuk menyimpan material yang di-load secara dinamis
  const [materials, setMaterials] = useState<{
    coreMat: THREE.Material,
    trailMat: THREE.Material,
    sparkMat: THREE.Material
  } | null>(null);

  // Lazy Load WebGPU dan TSL
  useEffect(() => {
    let isMounted = true;
    async function initMaterials() {
      try {
        const tsl = await import('three/tsl');
        const { NodeMaterial } = await import('three/webgpu');

        if (!isMounted) return;

        setMaterials({
          coreMat: CoreShaderMat(NodeMaterial, tsl, VFX_TEXTURES.flare),
          trailMat: TrailShaderMat(NodeMaterial, tsl, VFX_TEXTURES.bullet),
          sparkMat: ParticleShaderMat(NodeMaterial, tsl, VFX_TEXTURES.star),
        });
      } catch (err) {
        console.error("Gagal memuat material ProjectilePool:", err);
      }
    }
    initMaterials();
    return () => { isMounted = false; };
  }, []);

  const pool = useMemo(() => Array.from({ length: MAX_BULLETS }, () => ({
    active: false, position: new THREE.Vector3(), direction: new THREE.Vector3(),
    life: 0, type: 'arrow' as 'arrow' | 'fire' | 'ice' | 'magic' | 'holy', color: '#ffd700', speed: BULLET_SPEED, targetId: null as string | null
  })), []);

  const particles = useMemo(() => Array.from({ length: MAX_PARTICLES }, () => ({
    active: false, position: new THREE.Vector3(), velocity: new THREE.Vector3(),
    color: new THREE.Color(), life: 0.0, scale: 0.0
  })), []);

  const particlePtr = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const _vMove = useMemo(() => new THREE.Vector3(), []);
  const _target = useMemo(() => new THREE.Vector3(), []);
  const _ppColor = useMemo(() => new THREE.Color(), []);
  const _ppTrPos = useMemo(() => new THREE.Vector3(), []);

  const spawnSpark = (pos: THREE.Vector3, dir: THREE.Vector3, colorStr: string) => {
    const p = particles[particlePtr.current];
    p.active = true;
    p.position.copy(pos);
    p.velocity.copy(dir).multiplyScalar(-1.5 - Math.random() * 2.0);
    p.velocity.x += (Math.random() - 0.5) * 1.5;
    p.velocity.y += (Math.random() - 0.5) * 1.5;
    p.velocity.z += (Math.random() - 0.5) * 1.5;
    p.color.set(colorStr);
    p.life = 1.0;
    p.scale = 0.08 + Math.random() * 0.12;
    particlePtr.current = (particlePtr.current + 1) % MAX_PARTICLES;
  };

  useImperativeHandle(ref, () => ({
    fire: (origin, direction, options) => {
      const b = pool.find(bullet => !bullet.active);
      if (b) {
        b.active = true;
        b.position.copy(origin);
        b.direction.copy(direction).normalize();
        b.life = BULLET_LIFETIME;

        let type: 'arrow' | 'fire' | 'ice' | 'magic' | 'holy' = 'arrow';
        if (options?.type) {
          type = options.type;
        } else {
          const pClass = props.playerClass || 'Beginner';
          if (pClass === 'Beginner') type = 'arrow';
          else if (pClass === 'Mage') type = 'magic';
          else if (pClass === 'Priest') type = 'holy';
          else if (pClass === 'Warrior') type = 'fire';
          else if (pClass === 'Thief') type = 'magic';
        }

        b.type = type;
        const config = PROJECTILE_CONFIGS[type];
        b.color = options?.color || config.color;
        b.speed = options?.speed || BULLET_SPEED;
        b.targetId = options?.targetId || null;
      }
    }
  }));

  useFrame((_state, delta) => {
    // Tahan kalkulasi physics & render jika material belum siap dimuat
    if (!materials || !coreMeshRef.current || !trailMeshRef.current || !particleMeshRef.current) return;

    for (let i = 0; i < MAX_BULLETS; i++) {
      const b = pool[i];
      if (!b.active) {
        dummy.position.set(0, -1000, 0);
        dummy.updateMatrix();
        coreMeshRef.current.setMatrixAt(i, dummy.matrix);
        trailMeshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      if (b.targetId && props.unitRegistry?.current) {
        const target = props.unitRegistry.current.find(u => u.id === b.targetId);
        if (target && target.isActive && !target.isDying) {
          _target.set(target.position[0], target.position[1] + 1.2, target.position[2]);
          b.direction.subVectors(_target, b.position).normalize();
        }
      }

      const stepDist = b.speed * (delta * 60);
      _vMove.copy(b.direction).multiplyScalar(stepDist);

      raycaster.set(b.position, b.direction);
      raycaster.far = _vMove.length() * 1.5;

      const intersects = raycaster.intersectObjects(scene.children, true);
      let hitDetected = false;
      let hitPoint = b.position;
      let targetId: string | null = null;

      if (intersects.length > 0) {
        const hit = intersects[0];
        let curr: THREE.Object3D | null = hit.object;
        while (curr) {
          if (curr.userData?.onHit && curr.userData?.unitId) {
            targetId = curr.userData.unitId;
            curr.userData.onHit();
            break;
          }
          curr = curr.parent;
        }

        if (targetId) {
          hitDetected = true;
          hitPoint = hit.point;
        }
      }

      if (hitDetected && targetId) {
        const config = PROJECTILE_CONFIGS[b.type];
        spawnVFX([hitPoint.x, hitPoint.y, hitPoint.z], 'spark', config.color);

        const damage = 1200 + Math.random() * 2500;
        const isCrit = Math.random() > 0.8;

        if (props.dealPlayerDamage) {
          props.dealPlayerDamage(targetId, damage, isCrit);
        } else if (props.damageQueue?.current) {
          props.damageQueue.current.push({
            value: damage, position: [hitPoint.x, hitPoint.y, hitPoint.z],
            isCrit, isMagic: b.type !== 'arrow', color: isCrit ? '#ff4400' : '#ffaa00'
          });
        }
        b.active = false;
      } else {
        b.position.add(_vMove);
        b.life -= delta;
        if (b.life <= 0) b.active = false;
      }

      if (b.active) {
        const config = PROJECTILE_CONFIGS[b.type];

        for (let s = 0; s < config.sparkCount; s++) {
          spawnSpark(b.position, b.direction, config.sparkColor);
        }

        dummy.matrixAutoUpdate = true;
        dummy.position.copy(b.position);
        dummy.lookAt(_state.camera.position);
        dummy.scale.set(config.coreSize[0], config.coreSize[1], 1.0);
        dummy.updateMatrix();
        coreMeshRef.current.setMatrixAt(i, dummy.matrix);
        _ppColor.set(b.color).multiplyScalar(3.0);
        coreMeshRef.current.setColorAt(i, _ppColor);

        const trailLen = config.trailSize[0];
        const trailW = config.trailSize[1];
        _ppTrPos.copy(b.position).addScaledVector(b.direction, -trailLen * 0.5);
        setArrowTravelPool(dummy,
          _ppTrPos.x, _ppTrPos.y, _ppTrPos.z,
          b.direction.x, b.direction.y, b.direction.z,
          trailLen, trailW
        );
        trailMeshRef.current.setMatrixAt(i, dummy.matrix);
        _ppColor.set(b.color).multiplyScalar(2.0);
        trailMeshRef.current.setColorAt(i, _ppColor);
      }
    }

    coreMeshRef.current.instanceMatrix.needsUpdate = true;
    if (coreMeshRef.current.instanceColor) coreMeshRef.current.instanceColor.needsUpdate = true;
    trailMeshRef.current.instanceMatrix.needsUpdate = true;
    if (trailMeshRef.current.instanceColor) trailMeshRef.current.instanceColor.needsUpdate = true;

    dummy.matrixAutoUpdate = true;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (!p.active) {
        dummy.position.set(0, -1000, 0);
        dummy.updateMatrix();
        particleMeshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      p.position.addScaledVector(p.velocity, delta);
      p.velocity.y -= 1.5 * delta;
      p.life -= delta * 3.0;

      if (p.life <= 0) {
        p.active = false;
        dummy.position.set(0, -1000, 0);
        dummy.updateMatrix();
        particleMeshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      dummy.position.copy(p.position);
      dummy.lookAt(_state.camera.position);
      const sc = p.scale * p.life;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      particleMeshRef.current.setMatrixAt(i, dummy.matrix);

      _ppColor.copy(p.color).multiplyScalar(p.life * 2.5);
      particleMeshRef.current.setColorAt(i, _ppColor);
    }

    particleMeshRef.current.instanceMatrix.needsUpdate = true;
    if (particleMeshRef.current.instanceColor) particleMeshRef.current.instanceColor.needsUpdate = true;
  });

  const geom = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Tahan render jika material belum siap (Mencegah WebGPURenderer backend error)
  if (!materials) return null;

  return (
    <group>
      <instancedMesh ref={coreMeshRef} args={[geom, materials.coreMat, MAX_BULLETS]} frustumCulled={false} />
      <instancedMesh ref={trailMeshRef} args={[geom, materials.trailMat, MAX_BULLETS]} frustumCulled={false} />
      <instancedMesh ref={particleMeshRef} args={[geom, materials.sparkMat, MAX_PARTICLES]} frustumCulled={false} />
    </group>
  );
});

export default ProjectilePool;
