'use client';
import * as THREE from 'three';
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { VFX_TEXTURES } from './VFXAssets';

const MAX_RINGS = 50;

/**
 * INNOVATION: Blue Hex Shield Dome
 */
const GroundCrackMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
    const { time, vec4, uv, texture, vertexColor, float, sin, length, smoothstep } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending; m.side = THREE.DoubleSide;
    m.vertexColors = true; m.alphaTest = 0.15;
    const t = texture(tex, uv());
    const dist = length(uv().sub(0.5));
    const pulse = float(0.8).add(float(0.5).mul(sin(time.mul(8.0).sub(dist.mul(10.0)))));
    const vc = vertexColor();
    m.colorNode = vec4(vc.rgb.mul(pulse).mul(1.2).mul(t.rgb), t.a.mul(smoothstep(float(0.5), float(0.2), dist)));
    return m;
};

const ForceFieldMat = (NodeMaterial: any, tsl: any) => {
    const { time, vec3, vec4, sin, pow, abs, dot, normalize, normalView } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending; m.side = THREE.DoubleSide;
    m.alphaTest = 0.05;
    const intensity = pow(float(1.0).sub(abs(dot(normalize(normalView), vec3(0.0, 0.0, 1.0)))), float(2.5));
    const pulse = float(0.5).add(float(0.5).mul(sin(time.mul(5.0))));
    const golden = vec3(0.98, 0.72, 0.12);
    m.colorNode = vec4(golden.mul(intensity.mul(1.5)).mul(float(0.8).add(float(0.2).mul(pulse))), intensity.mul(0.7));
    return m;
};

const _obj = new THREE.Object3D();
const _col = new THREE.Color();
const MAX_SHIELDS = 30;

import { UnitRuntimeData } from '@/src/core/domain/unit.types';
import { float } from 'three/tsl';

interface TankVFX {
    x: number; y: number; z: number; startTime: number; color: string; active: boolean;
    type: 'crack' | 'dust';
    scale: number;
}

export function TankSpellEffect({
    tankSpellsRef,
    simTimeRef,
    unitRegistry
}: {
    tankSpellsRef: React.RefObject<any[]>,
    simTimeRef: React.RefObject<number>,
    unitRegistry?: React.RefObject<UnitRuntimeData[]>
}) {
    const crackRef = useRef<THREE.InstancedMesh>(null!);
    const dustRef = useRef<THREE.InstancedMesh>(null!);
    const shieldRef = useRef<THREE.InstancedMesh>(null!);

    const vfxOrder = useRef(0);
    const pool = useRef<TankVFX[]>(Array.from({ length: 450 }, () => ({
        x: 0, y: 0, z: 0, startTime: 0, color: '#fff', active: false, type: 'crack', scale: 1
    })));
    const activeIndices = useRef<number[]>([]);

    const quadGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2), []);
    const [materials, setMaterials] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        async function loadWebGPU() {
            try {
                const tsl = await import('three/tsl');
                const { NodeMaterial } = await import('three/webgpu');

                if (!isMounted) return;

                const loaded = {
                    cMat: GroundCrackMat(NodeMaterial, tsl, VFX_TEXTURES.scorch_mewah),
                    dMat: GroundCrackMat(NodeMaterial, tsl, VFX_TEXTURES.dirt),
                    sMat: ForceFieldMat(NodeMaterial, tsl),
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
        if (!materials || !crackRef.current || !tankSpellsRef.current || !shieldRef.current) return;
        const spells = tankSpellsRef.current;
        const simTime = performance.now();
        const time = state.clock.elapsedTime;
        void simTimeRef;

        const RARITY_SCALE = { common: 0.6, elite: 0.7, epic: 0.8, legendary: 0.9 };

        let sn = 0;

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;
            const age = simTime - s.startTime;
            const isShield = s.isShield;
            const rScale = RARITY_SCALE[s.rarity as keyof typeof RARITY_SCALE] || 1.0;

            if (isShield) {
                const duration = 3500; // 3.5 seconds active ultimate shield
                const t = age / duration;
                if (t >= 1) { s.active = false; continue; }

                if (sn < MAX_SHIELDS) {
                    let sx = s.x;
                    let sy = s.y;
                    let sz = s.z;

                    // Follow owner (localPlayer or simulated battle units)
                    if (s.ownerId === "localPlayer" && typeof (window as any).localPlayerPos !== 'undefined') {
                        const lp = (window as any).localPlayerPos;
                        sx = lp.x;
                        sy = lp.y + 0.1;
                        sz = lp.z;
                    } else if (s.ownerId && unitRegistry?.current) {
                        const owner = unitRegistry.current.find(u => u.id === s.ownerId);
                        if (owner && owner.isActive && !owner.isDying) {
                            sx = owner.position[0];
                            sy = owner.position[1];
                            sz = owner.position[2];
                        }
                    }

                    _obj.position.set(sx, sy - 0.2, sz);
                    _obj.rotation.set(0, time * 0.4, 0);
                    // Rhythmic expansion on spawn, stabilize, fade on collapse
                    const scaleFactor = t < 0.08 ? (t / 0.08) * 3.0 : (t > 0.82 ? ((1.0 - t) / 0.18) * 3.0 : 3.0);
                    _obj.scale.setScalar(scaleFactor * rScale);
                    _obj.updateMatrix();
                    shieldRef.current.setMatrixAt(sn, _obj.matrix);
                    sn++;
                }
            } else {
                if (age < 50 && (s as any)._lastVFX !== s.startTime) {
                    (s as any)._lastVFX = s.startTime;
                    const p = pool.current[vfxOrder.current];
                    if (!p.active) activeIndices.current.push(vfxOrder.current);
                    vfxOrder.current = (vfxOrder.current + 1) % pool.current.length;
                    p.x = s.x; p.y = 0.05; p.z = s.z; p.startTime = simTime; p.color = '#FFD700'; p.active = true; p.type = 'crack'; p.scale = 2.8 * rScale;

                    const p2 = pool.current[vfxOrder.current];
                    if (!p2.active) activeIndices.current.push(vfxOrder.current);
                    vfxOrder.current = (vfxOrder.current + 1) % pool.current.length;
                    p2.x = s.x; p2.y = 0.1; p2.z = s.z; p2.startTime = simTime; p2.color = '#aa8866'; p2.active = true; p2.type = 'dust'; p2.scale = 3.5 * rScale;
                }
            }
        }

        const currentActive = activeIndices.current;
        let cn = 0;
        let dn = 0;
        let writeIdx = 0;

        for (let j = 0; j < currentActive.length; j++) {
            const idx = currentActive[j];
            const v = pool.current[idx];
            if (!v.active) continue;
            const age = simTime - v.startTime;

            if (v.type === 'crack') {
                const rt = age / 1500; if (rt >= 1) { v.active = false; continue; }
                if (cn < MAX_RINGS) {
                    const ease = 1.0 - Math.pow(rt, 3.0);
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(-Math.PI / 2, 0, (idx * 0.77) % 6.28);
                    _obj.scale.setScalar(v.scale * (0.8 + rt * 0.5));
                    _obj.updateMatrix();
                    crackRef.current.setMatrixAt(cn, _obj.matrix);
                    _col.set(v.color).multiplyScalar(0.8 * ease);
                    crackRef.current.setColorAt(cn, _col);
                    cn++;
                }
            } else if (v.type === 'dust') {
                const rt = age / 800; if (rt >= 1) { v.active = false; continue; }
                if (dn < MAX_RINGS) {
                    const ease = 1.0 - rt;
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(-Math.PI / 2, 0, (idx * 1.5) % 6.28);
                    _obj.scale.setScalar(v.scale * (1.0 + rt * 1.5));
                    _obj.updateMatrix();
                    dustRef.current.setMatrixAt(dn, _obj.matrix);
                    _col.set(v.color).multiplyScalar(0.3 * ease);
                    dustRef.current.setColorAt(dn, _col);
                    dn++;
                }
            }
            currentActive[writeIdx++] = idx;
        }
        currentActive.length = writeIdx;

        crackRef.current.count = cn;
        crackRef.current.instanceMatrix.needsUpdate = true;
        if (crackRef.current.instanceColor) crackRef.current.instanceColor.needsUpdate = true;

        dustRef.current.count = dn;
        dustRef.current.instanceMatrix.needsUpdate = true;
        if (dustRef.current.instanceColor) dustRef.current.instanceColor.needsUpdate = true;

        shieldRef.current.count = sn;
        shieldRef.current.instanceMatrix.needsUpdate = true;

        // ponytail: time uniforms removed — NodeMaterial reads `time` from TSL.
    });

    if (!materials) return null;

    return (
        <group>
            <instancedMesh ref={crackRef} args={[quadGeo, materials.cMat, MAX_RINGS]} frustumCulled={false} />
            <instancedMesh ref={dustRef} args={[quadGeo, materials.dMat, MAX_RINGS]} frustumCulled={false} />
            <instancedMesh ref={shieldRef} args={[sphereGeo, materials.sMat, MAX_SHIELDS]} frustumCulled={false} />
        </group>
    );
}
