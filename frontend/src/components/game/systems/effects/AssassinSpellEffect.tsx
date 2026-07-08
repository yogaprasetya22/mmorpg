'use client';
/**
 * AssassinSpellEffect — Redesigned
 * Modern crit flash: sharp star burst + ripple, no heavy streak computation.
 * Billboard quad, faces camera, 1 draw call.
 */
import * as THREE from 'three';
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

const MAX_FLASHES = 150;

import { VFX_TEXTURES } from './VFXAssets';

const ShadowBurstMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
    const { vec3, vec4, uv, texture, vertexColor, float, length, smoothstep, mix } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending;
    m.vertexColors = true; m.alphaTest = 0.05;
    const t = texture(tex, uv());
    const dist = length(uv().sub(0.5));
    const vc = vertexColor();
    const shadow = mix(vc.rgb.mul(0.2), vec3(1.0), t.r);
    m.colorNode = vec4(shadow.mul(1.5).mul(t.rgb), t.a.mul(smoothstep(float(0.5), float(0.2), dist)));
    return m;
};

// ─── Luxurious Lethal Scratch Material ───────────────────────────────────────
const LuxuriousCritMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
    const { vec3, vec4, uv, texture, vertexColor, float, pow, mix } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending;
    m.vertexColors = true; m.alphaTest = 0.04;
    const t = texture(tex, uv());
    const bright = pow(t.r, float(2.5)).mul(1.2);
    const vc = vertexColor();
    const finalCol = mix(vc.rgb.mul(1.5), vec3(2.0), bright);
    m.colorNode = vec4(finalCol.mul(t.rgb), t.a.mul(0.95));
    return m;
};

export function AssassinSpellEffect({ assassinSpellsRef, simTimeRef }: { assassinSpellsRef: React.RefObject<any[]>, simTimeRef: React.RefObject<number> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const sparkRef = useRef<THREE.InstancedMesh>(null!);
    const burstRef = useRef<THREE.InstancedMesh>(null!);
    const _obj = useMemo(() => new THREE.Object3D(), []);
    const _col = useMemo(() => new THREE.Color(), []);

    const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const [materials, setMaterials] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        async function loadWebGPU() {
            try {
                const tsl = await import('three/tsl');
                const { NodeMaterial } = await import('three/webgpu');

                if (!isMounted) return;

                const loaded = {
                    mat: LuxuriousCritMat(NodeMaterial, tsl, VFX_TEXTURES.slashes[0]),
                    sMat: LuxuriousCritMat(NodeMaterial, tsl, VFX_TEXTURES.critical),
                    bMat: ShadowBurstMat(NodeMaterial, tsl, VFX_TEXTURES.twirl),
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
        if (!materials || !meshRef.current || !assassinSpellsRef.current || !sparkRef.current || !burstRef.current) return;
        const spells = assassinSpellsRef.current;
        const simTime = performance.now();
        void simTimeRef.current;
        const elapsed = state.clock.elapsedTime;
        const mesh = meshRef.current;
        const sMesh = sparkRef.current;
        const bMesh = burstRef.current;

        // ponytail: flipbook requires texture uniform update — NodeMaterial uses static texture() ref.
        // add when: animated sprite flipbook needed

        let n = 0; let sn = 0; let bn = 0;

        // NERFED for low-end hardware
        const RARITY_SCALE = { common: 0.8, elite: 1.0, epic: 1.1, legendary: 1.2 };
        const RARITY_GLOW = { common: 4.0, elite: 5.0, epic: 6.0, legendary: 7.0 };

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;

            const r = s.rarity || 'common';
            const rScale = (RARITY_SCALE as any)[r] || 1.0;
            const rGlow = (RARITY_GLOW as any)[r] || 5.0;

            const age = simTime - s.startTime;
            const isTeleport = (s as any).isTeleport;
            const duration = isTeleport ? 800 : 250;
            const t = age / duration;
            if (t >= 1) { s.active = false; continue; }

            const ease = 1 - t;

            if (isTeleport) {
                // Shadow Burst Arrival (Innovation)
                if (bn < 50) {
                    _obj.position.set(s.x, s.y + 0.5, s.z);
                    _obj.quaternion.copy(state.camera.quaternion);
                    _obj.rotateZ(t * -4.0);
                    _obj.scale.setScalar((4.0 + t * 8.0) * ease * rScale);
                    _obj.updateMatrix();
                    bMesh.setMatrixAt(bn, _obj.matrix);
                    _col.set('#4400ff').multiplyScalar(ease * rGlow * 0.2);
                    bMesh.setColorAt(bn, _col);
                    bn++;
                }
            } else {
                // NERFED Layer 1: The Scratches (Regular Attack) - Reduced to 1 scratch for non-teleport
                for (let k = 0; k < 1; k++) {
                    if (n >= MAX_FLASHES) break;
                    _obj.position.set(s.x, s.y + k * 0.1, s.z);
                    _obj.quaternion.copy(state.camera.quaternion);
                    _obj.rotateZ(i * 1.57 + k * 0.8 + elapsed * 0.5);
                    const sc = (1.0 + t * 3.0) * ease * 1.8 * rScale;
                    _obj.scale.setScalar(sc);
                    _obj.updateMatrix();
                    mesh.setMatrixAt(n, _obj.matrix);
                    _col.set(s.color || '#FFFF00').multiplyScalar(ease * rGlow * 0.15);
                    mesh.setColorAt(n, _col);
                    n++;
                }

                // Layer 2: The Critical Star Spark
                if (sn < 100) {
                    _obj.position.set(s.x, s.y + 0.5, s.z);
                    _obj.quaternion.copy(state.camera.quaternion);
                    _obj.rotateZ(t * 8.0);
                    _obj.scale.setScalar((2.0 + t * 5.0) * ease * 2.0 * rScale);
                    _obj.updateMatrix();
                    sMesh.setMatrixAt(sn, _obj.matrix);
                    _col.set('#ffffff').multiplyScalar(ease * rGlow * 0.1);
                    sMesh.setColorAt(sn, _col);
                    sn++;
                }
            }
        }

        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        sMesh.count = sn;
        sMesh.instanceMatrix.needsUpdate = true;
        if (sMesh.instanceColor) sMesh.instanceColor.needsUpdate = true;

        bMesh.count = bn;
        bMesh.instanceMatrix.needsUpdate = true;
        if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;

        // ponytail: time uniforms removed — NodeMaterial reads `time` from TSL.
    });

    if (!materials) return null;

    return (
        <group>
            <instancedMesh ref={meshRef} args={[geo, materials.mat, MAX_FLASHES]} frustumCulled={false} />
            <instancedMesh ref={sparkRef} args={[geo, materials.sMat, 100]} frustumCulled={false} />
            <instancedMesh ref={burstRef} args={[geo, materials.bMat, 50]} frustumCulled={false} />
        </group>
    );
}
