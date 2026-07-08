'use client';
import * as THREE from 'three';
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { MAGE_PROJECTILE_TIME_MS } from "@/src/core/logic/combat/constants";
import { UnitRuntimeData, UnitRarity } from "@/src/core/domain/unit.types";
import { VFX_TEXTURES } from './VFXAssets';

export interface SpellEntry {
  fromX: number; fromY: number; fromZ: number;
  toX: number; toY: number; toZ: number;
  progress: number;
  startTime: number;
  active: boolean;
  color?: string;
  targetId?: string;
  isBullet?: boolean;
  isMeteor?: boolean; // New: vertical falling projectile
  rarity?: UnitRarity;
}
export type SpellsRegistryRef = React.RefObject<SpellEntry[]>;

// ─── Innovation: Fresnel Ice Material ────────────────────────────────────────
const IceShardMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
  const { time, vec3, vec4, uv, texture, vertexColor, float, sin, pow, dot, normalize, cameraPosition, normalWorld, positionWorld, max, smoothstep } = tsl;
  const m = new NodeMaterial();
  m.transparent = true; m.depthWrite = true;
  m.blending = THREE.AdditiveBlending;
  m.vertexColors = true; m.alphaTest = 0.1;
  const t = texture(tex, uv());
  const viewDir = normalize(cameraPosition.sub(positionWorld));
  const fresnel = pow(float(1.0).sub(max(dot(viewDir, normalWorld), float(0.0))), float(3.0));
  const vc = vertexColor();
  const iceBase = vc.rgb.mul(1.5);
  const glow = iceBase.add(vec3(1.0).mul(fresnel).mul(2.0));
  const pulse = float(0.8).add(float(0.2).mul(sin(time.mul(8.0))));
  const core = smoothstep(float(0.4), float(0.6), fresnel);
  m.colorNode = vec4(glow.mul(pulse).add(vec3(0.5).mul(core)), t.a.mul(0.9));
  return m;
};

// ─── Ground Frost Material ───────────────────────────────────────────────────
const GroundMagicMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
  const { time, vec4, uv, texture, vertexColor, float, sin, length } = tsl;
  const m = new NodeMaterial();
  m.transparent = true; m.depthWrite = false;
  m.blending = THREE.AdditiveBlending;
  m.vertexColors = true; m.alphaTest = 0.01;
  const t = texture(tex, uv());
  const dist = length(uv().sub(0.5));
  const pulse = float(0.8).add(float(0.2).mul(sin(time.mul(5.0).add(dist.mul(3.0)))));
  const vc = vertexColor();
  m.colorNode = vec4(vc.rgb.mul(t.rgb).mul(1.2).mul(pulse), t.a);
  return m;
};

const _obj = new THREE.Object3D();
const MAX_ORB_INSTANCES = 800;

interface ImpactEntry { x: number; y: number; z: number; startTime: number; color: string; active: boolean; type: 'sigil' | 'embers' | 'charge' | 'splinter'; rot: number; vx?: number; vy?: number; vz?: number; }

export function MageSpellEffect({ spellsRef, unitRegistry, simTimeRef }: { spellsRef: SpellsRegistryRef; unitRegistry: React.RefObject<UnitRuntimeData[]>; simTimeRef: React.RefObject<number>; }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const groundRef = useRef<THREE.InstancedMesh>(null!);
  const chargeRef = useRef<THREE.InstancedMesh>(null!);
  const impactRef = useRef<THREE.InstancedMesh>(null!);
  const impactIdx = useRef(0);
  const impacts = useRef<ImpactEntry[]>(Array.from({ length: 250 }, () => ({ x: 0, y: 0, z: 0, startTime: 0, color: '#fff', active: false, type: 'sigil', rot: 0 })));
  const activeImpacts = useRef<number[]>([]);
  const _c = useMemo(() => new THREE.Color(), []);
  // FIX #2: Single frame counter — moved inside main useFrame (no extra useFrame)
  const frameCountRef = useRef(0);

  // INNOVATION: 3D Diamond Shard Geometry
  const shardGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0, 0.4, 1.8, 4);
    geo.rotateX(Math.PI / 2); // Align with Z axis for direction
    return geo;
  }, []);

  const quadGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const [materials, setMaterials] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadWebGPU() {
      try {
        const tsl = await import('three/tsl');
        const { NodeMaterial } = await import('three/webgpu');

        if (!isMounted) return;

        const loaded = {
          iceMat: IceShardMat(NodeMaterial, tsl, VFX_TEXTURES.magic[2]),
          bottomMat: GroundMagicMat(NodeMaterial, tsl, VFX_TEXTURES.magic[0]),
          impMat: GroundMagicMat(NodeMaterial, tsl, VFX_TEXTURES.magic[4]),
        };

        setMaterials(loaded);
      } catch (err) {
        console.error("Gagal memuat WebGPU materials:", err);
      }
    }
    loadWebGPU();
    return () => { isMounted = false; };
  }, []);

  useFrame((state) => {
    if (!materials) return;
    // FIX #2: Increment here, not in a separate useFrame
    frameCountRef.current++;
    const mesh = meshRef.current;
    const grd = groundRef.current;
    const crg = chargeRef.current;
    const imp = impactRef.current;
    const spells = spellsRef?.current;
    if (!mesh || !grd || !imp || !crg || !spells) return;

    const simNow = performance.now();
    void simTimeRef.current;
    const time = state.clock.elapsedTime;

    // ponytail: texture flipbook logic skip or manual node replace
    // add when: texture swap dynamic node updates needed

    let oi = 0; let gi = 0; let ci = 0; let ii = 0;

    // NERFED for 4GB RAM laptops: Reduced scale and glow
    const RARITY_SCALE = { common: 0.8, elite: 1.0, epic: 1.1, legendary: 1.3 };
    const RARITY_GLOW = { common: 2.0, elite: 3.5, epic: 5.0, legendary: 8.0 };

    for (let i = 0; i < spells.length; i++) {
      const s = spells[i];
      if (!s || !s.active || s.isBullet) continue;

      const r = s.rarity || 'common';
      const rScale = (RARITY_SCALE as any)[r] || 1.0;
      const rGlow = (RARITY_GLOW as any)[r] || 4.0;

      if (s.targetId && unitRegistry.current) {
        const tIdx = (s as any)._tIdx ??= parseInt(s.targetId.replace(/\D/g, '')) || 0;
        const tar = unitRegistry.current[tIdx];
        if (tar?.isActive && tar.id === s.targetId) {
          s.toX = tar.position[0]; s.toY = tar.position[1] + 1.2; s.toZ = tar.position[2];
        }
      }

      if ((s as any)._charged !== s.startTime) {
        (s as any)._charged = s.startTime;
        const eIdx = impactIdx.current;
        const e = impacts.current[eIdx];
        if (!e.active) activeImpacts.current.push(eIdx);
        impactIdx.current = (impactIdx.current + 1) % impacts.current.length;
        e.x = s.fromX; e.y = 0.1; e.z = s.fromZ; e.startTime = simNow; e.color = s.color || '#fff'; e.active = true; e.type = 'charge'; e.rot = Math.random() * 7;
        (e as any).rScale = rScale; (e as any).rGlow = rGlow;
      }

      const dur = s.isMeteor ? (600 + Math.random() * 400) : (MAGE_PROJECTILE_TIME_MS || 450);
      const t = Math.min(1, (simNow - s.startTime) / dur);
      if (t < 0) continue;

      let px, py, pz;
      if (s.isMeteor) {
        px = s.fromX + (s.toX - s.fromX) * t;
        pz = s.fromZ + (s.toZ - s.fromZ) * t;
        py = s.fromY - (s.fromY - s.toY) * Math.pow(t, 1.5);
      } else {
        px = s.fromX + (s.toX - s.fromX) * t;
        pz = s.fromZ + (s.toZ - s.fromZ) * t;
        py = s.fromY + (s.toY - s.fromY) * t + Math.sin(t * Math.PI) * 2.0;
      }

      if (oi < MAX_ORB_INSTANCES) {
        _obj.position.set(px, py, pz);

        // 3D Directional Shard Visual
        const headScale = s.isMeteor ? (0.7 * rScale) : (0.9 * rScale);
        _obj.scale.set(headScale, headScale, headScale * 1.5);

        if (s.isMeteor) {
          _obj.lookAt(px, py - 5, pz);
          _obj.rotateZ(time * 10.0);
        } else {
          _obj.lookAt(s.toX, s.toY, s.toZ);
          _obj.rotateZ(time * 5.0);
        }

        _obj.updateMatrix();
        mesh.setMatrixAt(oi, _obj.matrix);

        _c.set(s.color || '#44aaff');
        _c.multiplyScalar(rGlow * 0.15 * (s.isMeteor ? 1.5 : 1.0));
        mesh.setColorAt(oi, _c);
        oi++;

        // INNOVATION: Frost Trail (Embers)
        if (t > 0.1 && t < 0.95 && frameCountRef.current % 2 === 0) {
          const eIdx = impactIdx.current;
          const e = impacts.current[eIdx];
          if (!e.active) activeImpacts.current.push(eIdx);
          impactIdx.current = (impactIdx.current + 1) % impacts.current.length;
          e.x = px + (Math.random() - 0.5) * 0.3;
          e.y = py + (Math.random() - 0.5) * 0.3;
          e.z = pz + (Math.random() - 0.5) * 0.3;
          e.startTime = simNow;
          e.color = '#ffffff';
          e.active = true;
          e.type = 'embers' as any;
          e.rot = Math.random() * 7;
          (e as any).rScale = 0.25 * rScale;
          (e as any).rGlow = 2.0;
        }
      }

      if (gi < 60) {
        _obj.position.set(px, 0.12, pz);
        _obj.rotation.set(-Math.PI / 2, 0, time * 2.0);
        _obj.scale.setScalar(s.isMeteor ? (2.5 * rScale * t) : (1.5 * (1.1 - t) * rScale));
        _obj.updateMatrix();
        grd.setMatrixAt(gi, _obj.matrix);
        _c.set(s.color || '#fff').multiplyScalar(0.25 * rScale);
        grd.setColorAt(gi, _c);
        gi++;
      }

      if (t >= 0.99) {
        // NERFED: shatter count reduced
        const shatterCount = s.isMeteor ? 3 : 1;
        for (let k = 0; k < shatterCount; k++) {
          const eIdx = impactIdx.current;
          const e = impacts.current[eIdx];
          if (!e.active) activeImpacts.current.push(eIdx);
          impactIdx.current = (impactIdx.current + 1) % impacts.current.length;
          e.x = s.toX; e.y = 0.5; e.z = s.toZ;
          e.startTime = simNow;
          e.color = s.color || '#00ffff';
          e.active = true;
          e.type = 'splinter' as any;
          e.rot = Math.random() * Math.PI * 2;
          e.vx = (Math.random() - 0.5) * 0.05;
          e.vy = 0.05 + Math.random() * 0.1;
          e.vz = (Math.random() - 0.5) * 0.05;
          (e as any).rScale = 0.3 * rScale;
          (e as any).rGlow = rGlow;
        }

        const eIdx = impactIdx.current;
        const e = impacts.current[eIdx];
        if (!e.active) activeImpacts.current.push(eIdx);
        impactIdx.current = (impactIdx.current + 1) % impacts.current.length;
        e.x = s.toX; e.y = 1.2; e.z = s.toZ; e.startTime = simNow;
        e.color = s.color || '#00ffff';
        e.active = true; e.type = 'sigil'; e.rot = Math.random() * 7;
        (e as any).rScale = rScale * (s.isMeteor ? 1.5 : 1.0);
        (e as any).rGlow = rGlow * (s.isMeteor ? 2.5 : 1.0);
        s.active = false;
      }
    }

    mesh.count = oi;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    grd.count = gi;
    grd.instanceMatrix.needsUpdate = true;
    if (grd.instanceColor) grd.instanceColor.needsUpdate = true;

    // ponytail: time uniforms removed — NodeMaterial reads `time` from TSL.

    const currentImpacts = activeImpacts.current;
    // FIX #3: Swap-remove O(1) instead of splice O(n²)
    let writeIdx = 0;
    for (let j = 0; j < currentImpacts.length; j++) {
      const idx = currentImpacts[j];
      const e = impacts.current[idx];
      if (!e.active) continue; // skip dead, don't copy to output

      const age = simNow - e.startTime;
      const erScale = (e as any).rScale || 1.0;
      const erGlow = (e as any).rGlow || 4.0;

      if (e.type === 'charge') {
        const t = age / 400;
        if (t >= 1) { e.active = false; continue; }
        if (ci < 80) {
          _obj.position.set(e.x, 0.1, e.z);
          _obj.rotation.set(-Math.PI / 2, 0, time * 5.0);
          _obj.scale.setScalar((0.5 + t * 2.5) * (1.0 - t) * erScale);
          _obj.updateMatrix();
          crg.setMatrixAt(ci, _obj.matrix);
          _c.set(e.color).multiplyScalar(erGlow * 0.15 * (1.0 - t));
          crg.setColorAt(ci, _c);
          ci++;
        }
      } else if (e.type === 'splinter') {
        const t = age / 500;
        if (t >= 1) { e.active = false; continue; }
        if (oi < MAX_ORB_INSTANCES) {
          const tSim = age * 0.01;
          const px = e.x + (e.vx || 0) * age;
          const py = e.y + (e.vy || 0) * age - 0.5 * 0.001 * age * age;
          const pz = e.z + (e.vz || 0) * age;

          _obj.position.set(px, Math.max(0.1, py), pz);
          _obj.rotation.set(e.rot + tSim, e.rot * 0.5, tSim * 2.0);
          _obj.scale.setScalar(erScale * (1.0 - t));
          _obj.updateMatrix();
          mesh.setMatrixAt(oi, _obj.matrix);
          _c.set(e.color).multiplyScalar(erGlow * 0.15 * (1.0 - t));
          mesh.setColorAt(oi, _c);
          oi++;
        }
      } else if (e.type === 'embers') {
        const t = age / 600;
        if (t >= 1) { e.active = false; continue; }
        if (ii < 250) {
          const fade = 1.0 - t;
          _obj.position.set(e.x, e.y, e.z);
          _obj.quaternion.copy(state.camera.quaternion);
          _obj.scale.setScalar(erScale * fade);
          _obj.updateMatrix();
          imp.setMatrixAt(ii, _obj.matrix);
          _c.set(e.color).multiplyScalar(erGlow * fade * 0.5);
          imp.setColorAt(ii, _c);
          ii++;
        }
      } else {
        const t = age / 500;
        if (t >= 1) { e.active = false; continue; }
        if (ii < 250) {
          const easeOut = Math.sqrt(t);
          const fade = 1.0 - t;
          _obj.position.set(e.x, 0.15, e.z);
          _obj.rotation.set(-Math.PI / 2, 0, e.rot + time * 2.0);
          _obj.scale.setScalar((2.5 + easeOut * 10.0) * erScale);
          _obj.updateMatrix();
          imp.setMatrixAt(ii, _obj.matrix);
          _c.set(e.color).multiplyScalar(erGlow * fade * 0.25);
          imp.setColorAt(ii, _c);
          ii++;
        }
      }
      currentImpacts[writeIdx++] = currentImpacts[j]; // swap-remove: keep alive entries
    }
    currentImpacts.length = writeIdx; // trim in-place, zero allocation

    mesh.count = oi;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    imp.count = ii;
    imp.instanceMatrix.needsUpdate = true;
    if (imp.instanceColor) imp.instanceColor.needsUpdate = true;
    crg.count = ci;
    crg.instanceMatrix.needsUpdate = true;
    if (crg.instanceColor) crg.instanceColor.needsUpdate = true;
  });

  // FIX #2: REMOVED separate useFrame for frameCountRef — merged into main useFrame above

  if (!materials) return null;

  return (
    <group>
      <instancedMesh ref={meshRef} args={[shardGeo, materials.iceMat, MAX_ORB_INSTANCES]} frustumCulled={false} />
      <instancedMesh ref={groundRef} args={[quadGeo, materials.bottomMat, 60]} frustumCulled={false} />
      <instancedMesh ref={chargeRef} args={[quadGeo, materials.bottomMat, 80]} frustumCulled={false} />
      <instancedMesh ref={impactRef} args={[quadGeo, materials.impMat, 250]} frustumCulled={false} />
    </group>
  );
}
