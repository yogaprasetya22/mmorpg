'use client';
import * as THREE from 'three';
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { VFX_TEXTURES } from './VFXAssets';

const MAX_SLASHES = 600;
const MAX_RINGS = 200;
const MAX_BURSTS = 150;

/**
 * INNOVATION: Kinetic Fracture Shader
 * Ultra-bright energy ripple with volumetric noise.
 */
const KineticFractureMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
    const { time, vec4, uv, texture, vertexColor, float, sin, length, smoothstep } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending;
    m.vertexColors = true; m.alphaTest = 0.05;
    const t = texture(tex, uv());
    const cUv = uv().sub(0.5);
    const dist = length(cUv);
    const pulse = sin(dist.mul(18.0).sub(time.mul(35.0))).mul(0.5).add(0.5);
    const vc = vertexColor();
    m.colorNode = vec4(vc.rgb.mul(pulse).mul(1.5).mul(t.rgb), t.a.mul(smoothstep(float(0.5), float(0.3), dist)));
    return m;
};

/**
 * INNOVATION: Wind Vortex Shader
 * Rotating wind swirls for the 'tebasan angin mutar' look.
 */
const WindSlashMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
    const { time, vec2, vec4, uv, texture, vertexColor, cos, sin } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending; m.side = THREE.DoubleSide;
    m.vertexColors = true; m.alphaTest = 0.05;
    const rot = time.mul(15.0);
    const c = cos(rot); const s = sin(rot);
    const rUv = vec2(uv().x.sub(0.5).mul(c).sub(uv().y.sub(0.5).mul(s)).add(0.5), uv().x.sub(0.5).mul(s).add(uv().y.sub(0.5).mul(c)).add(0.5));
    const rTex = texture(tex, rUv);
    const vc = vertexColor();
    m.colorNode = vec4(vc.rgb.mul(1.2).mul(rTex.rgb), rTex.a.mul(0.8));
    return m;
};

const _obj = new THREE.Object3D();
const _col = new THREE.Color();

interface FighterVFX {
    x: number; y: number; z: number;
    startTime: number; color: string;
    active: boolean; rot: number; scale: number;
    type: 'impact' | 'slash' | 'burst' | 'cyclone';
}

export function FighterSpellEffect({ fighterSpellsRef, simTimeRef }: { fighterSpellsRef: React.RefObject<any[]>, simTimeRef: React.RefObject<number> }) {
    const impactRef = useRef<THREE.InstancedMesh>(null!);
    const slashRef = useRef<THREE.InstancedMesh>(null!);
    const burstRef = useRef<THREE.InstancedMesh>(null!);

    const vfxOrder = useRef(0);
    const pool = useRef<FighterVFX[]>(Array.from({ length: 800 }, () => ({ x: 0, y: 0, z: 0, startTime: 0, color: '#fff', active: false, rot: 0, scale: 1, type: 'impact' })));
    const activeIndices = useRef<number[]>([]);

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
                    iMat: KineticFractureMat(NodeMaterial, tsl, VFX_TEXTURES.shockwave),
                    sMat: WindSlashMat(NodeMaterial, tsl, VFX_TEXTURES.twirl),
                    bMat: KineticFractureMat(NodeMaterial, tsl, VFX_TEXTURES.radiant),
                };

                setMaterials(loaded);
            } catch (err) {
                console.error("Gagal memuat WebGPU materials:", err);
            }
        }
        loadWebGPU();
        return () => { isMounted = false; };
    }, []);

    useFrame(() => {
        if (!materials || !impactRef.current || !fighterSpellsRef.current || !slashRef.current || !burstRef.current) return;
        const spells = fighterSpellsRef.current;
        const simTime = performance.now();
        void simTimeRef.current;

        // NERFED for 4GB RAM laptops: Reduced scale and glow multiplier to save GPU fill-rate
        const RARITY_SCALE = { common: 0.9, elite: 1.1, epic: 1.2, legendary: 1.4 };
        const RARITY_GLOW = { common: 4.0, elite: 6.0, epic: 8.0, legendary: 12.0 };

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;

            const r = s.rarity || 'common';
            const rScale = (RARITY_SCALE as any)[r] || 1.0;
            const rGlow = (RARITY_GLOW as any)[r] || 8.0;

            const age = simTime - s.startTime;
            const t = age / 400;
            if (t >= 1) { s.active = false; continue; }

            if (t < 0.05 && (s as any)._lastVFX !== s.startTime) {
                (s as any)._lastVFX = s.startTime;

                if (s.isCyclone) {
                    // Wind Vortex Trigger
                    for (let k = 0; k < 3; k++) {
                        const p = pool.current[vfxOrder.current];
                        if (!p.active) activeIndices.current.push(vfxOrder.current);
                        vfxOrder.current = (vfxOrder.current + 1) % pool.current.length;
                        p.x = s.x; p.y = 0.5 + k * 0.3; p.z = s.z; p.startTime = simTime;
                        p.color = s.color; p.active = true; p.type = 'cyclone';
                        p.rot = Math.random() * Math.PI;
                        p.scale = (2.5 + k * 0.5) * rScale;
                        (p as any).rGlow = rGlow;
                    }
                } else {
                    // Normal Strike sequence
                    const p1 = pool.current[vfxOrder.current];
                    if (!p1.active) activeIndices.current.push(vfxOrder.current);
                    vfxOrder.current = (vfxOrder.current + 1) % pool.current.length;
                    p1.x = s.x; p1.y = 0.05; p1.z = s.z; p1.startTime = simTime; p1.color = s.color || '#ff4400'; p1.active = true; p1.type = 'impact'; p1.scale = 0.8 * rScale;

                    const p2 = pool.current[vfxOrder.current];
                    if (!p2.active) activeIndices.current.push(vfxOrder.current);
                    vfxOrder.current = (vfxOrder.current + 1) % pool.current.length;
                    p2.x = s.x; p2.y = 1.0; p2.z = s.z; p2.startTime = simTime; p2.color = '#fff'; p2.active = true; p2.type = 'burst'; p2.scale = 1.5 * rScale;

                    const targetX = s.targetX ?? s.x;
                    const targetZ = s.targetZ ?? s.z;

                    // NERFED: Spark spray for Legendary strikes reduced from 3 to 1
                    const sparkCount = 1;
                    for (let k = 0; k < sparkCount; k++) {
                        const p3 = pool.current[vfxOrder.current];
                        if (!p3.active) activeIndices.current.push(vfxOrder.current);
                        vfxOrder.current = (vfxOrder.current + 1) % pool.current.length;
                        p3.x = targetX + (Math.random() - 0.5) * k; p3.y = 1.2; p3.z = targetZ + (Math.random() - 0.5) * k;
                        p3.startTime = simTime;
                        p3.color = r === 'legendary' ? '#FFD700' : s.color; p3.active = true; p3.type = 'slash';
                        p3.rot = (s.rotation || 0) + (Math.random() - 0.5) * 0.5;
                        p3.scale = 1.5 * rScale;
                        (p3 as any).rGlow = rGlow;
                    }

                    // NERFED: Removed Secondary Impact Ring for Legendary to save particles
                }
            }
        }

        let in_count = 0; let sl_count = 0; let bu_count = 0;
        const currentActive = activeIndices.current;
        let writeIdx = 0;
        for (let j = 0; j < currentActive.length; j++) {
            const idx = currentActive[j];
            const v = pool.current[idx];
            if (!v.active) continue;
            const age = simTime - v.startTime;
            if (age < 0) {
                currentActive[writeIdx++] = idx;
                continue;
            }

            if (v.type === 'impact') {
                const rt = age / 500; if (rt >= 1) { v.active = false; continue; }
                if (in_count < MAX_RINGS) {
                    const ease = 1.0 - Math.pow(rt, 3.0);
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(-Math.PI / 2, 0, 0);
                    const sc = v.scale * (0.5 + Math.pow(rt, 0.2) * 1.8);
                    _obj.scale.setScalar(sc);
                    _obj.updateMatrix();
                    impactRef.current.setMatrixAt(in_count, _obj.matrix);
                    _col.set(v.color).multiplyScalar(2.2 * ease);
                    impactRef.current.setColorAt(in_count, _col);
                    in_count++;
                }
            } else if (v.type === 'burst') {
                const bt = age / 250; if (bt >= 1) { v.active = false; continue; }
                if (bu_count < MAX_BURSTS) {
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(0, 0, age * 0.05);
                    const sc = v.scale * Math.pow(1.0 - bt, 0.5) * 2.0;
                    _obj.scale.setScalar(sc);
                    _obj.updateMatrix();
                    burstRef.current.setMatrixAt(bu_count, _obj.matrix);
                    _col.set(v.color).multiplyScalar(3.0 * (1.0 - bt));
                    burstRef.current.setColorAt(bu_count, _col);
                    bu_count++;
                }
            } else if (v.type === 'cyclone') {
                const ct = age / 600; if (ct >= 1) { v.active = false; continue; }
                if (sl_count < MAX_SLASHES) {
                    const ease = 1.0 - ct;
                    const rGlow = (v as any).rGlow || 15.0;
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(-Math.PI / 2, 0, v.rot);
                    const sc = v.scale * (1.0 + ct * 1.5);
                    _obj.scale.setScalar(sc);
                    _obj.updateMatrix();
                    slashRef.current.setMatrixAt(sl_count, _obj.matrix);
                    _col.set(v.color).multiplyScalar(rGlow * 0.15 * ease);
                    slashRef.current.setColorAt(sl_count, _col);
                    sl_count++;
                }
            } else {
                const dt = age / 300; if (dt >= 1) { v.active = false; continue; }
                if (sl_count < MAX_SLASHES) {
                    const ease = 1.0 - dt;
                    const rGlow = (v as any).rGlow || 15.0;
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(-Math.PI / 2, 0, v.rot);
                    const sc = v.scale * (1.2 + dt * 1.5);
                    _obj.scale.setScalar(sc);
                    _obj.updateMatrix();
                    slashRef.current.setMatrixAt(sl_count, _obj.matrix);
                    _col.set(v.color).multiplyScalar(rGlow * 0.15 * ease);
                    slashRef.current.setColorAt(sl_count, _col);
                    sl_count++;
                }
            }
            currentActive[writeIdx++] = idx;
        }
        currentActive.length = writeIdx;

        impactRef.current.count = in_count;
        impactRef.current.instanceMatrix.needsUpdate = true;
        if (impactRef.current.instanceColor) impactRef.current.instanceColor.needsUpdate = true;
        burstRef.current.count = bu_count;
        burstRef.current.instanceMatrix.needsUpdate = true;
        if (burstRef.current.instanceColor) burstRef.current.instanceColor.needsUpdate = true;
        slashRef.current.count = sl_count;
        slashRef.current.instanceMatrix.needsUpdate = true;
        if (slashRef.current.instanceColor) slashRef.current.instanceColor.needsUpdate = true;

        // ponytail: time uniforms removed — NodeMaterial reads `time` from TSL.
    });

    if (!materials) return null;

    return (
        <group>
            <instancedMesh ref={impactRef} args={[quadGeo, materials.iMat, MAX_RINGS]} frustumCulled={false} />
            <instancedMesh ref={burstRef} args={[quadGeo, materials.bMat, MAX_BURSTS]} frustumCulled={false} />
            <instancedMesh ref={slashRef} args={[quadGeo, materials.sMat, MAX_SLASHES]} frustumCulled={false} />
        </group>
    );
}
