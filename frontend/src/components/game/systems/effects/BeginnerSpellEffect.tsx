'use client';
import * as THREE from 'three';
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { SpellsRegistryRef } from './MageSpellEffect';
import { UnitRuntimeData } from "@/src/core/domain/unit.types";
import { VFX_TEXTURES } from './VFXAssets';

interface Props {
    spellsRef: SpellsRegistryRef;
    unitRegistry: React.RefObject<UnitRuntimeData[]>;
    simTimeRef: React.RefObject<number>;
}

const MAX_BULLETS = 600;

// ─── Material Factories ──────────────────────────
const SuperBulletMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
    const { time, vec3, vec4, uv, texture, vertexColor, float, sin, mix } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending; m.side = THREE.DoubleSide;
    m.vertexColors = true; m.alphaTest = 0.05;
    const t = texture(tex, uv());
    const pulse = float(0.8).add(float(0.2).mul(sin(time.mul(30.0).add(uv().x.mul(5.0)))));
    const vc = vertexColor();
    const core = mix(vc.rgb.mul(1.5), vec3(2.0), float(1.0).sub(uv().x).mul(pulse));
    m.colorNode = vec4(core.mul(t.rgb).mul(1.5), t.a);
    return m;
};

const SniperCoreMat = (NodeMaterial: any, tsl: any) => {
    const { time, vec3, vec4, uv, vertexColor, float, sin, mix, smoothstep } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending; m.side = THREE.DoubleSide;
    m.vertexColors = true; m.alphaTest = 0.05;
    const vc = vertexColor();
    const radial = float(1.0).sub(smoothstep(float(0.0), float(0.5), uv().y.sub(0.5).abs()));
    const nose = smoothstep(float(0.3), float(1.0), uv().x);
    const body = radial;
    const pulse = float(0.92).add(float(0.08).mul(sin(time.mul(40.0))));
    const col = mix(vc.rgb.mul(1.2), vec3(2.0, 2.0, 1.6), nose);
    const alpha = body.mul(pulse);
    m.colorNode = vec4(col, alpha);
    return m;
};

const SniperTrailMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
    const { time, vec4, uv, texture, vertexColor, float, sin } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending; m.side = THREE.DoubleSide;
    m.vertexColors = true; m.alphaTest = 0.01;
    const t = texture(tex, uv());
    const f = uv().x.mul(uv().x);
    const shimmer = float(0.7).add(float(0.3).mul(sin(uv().x.mul(12.0).sub(time.mul(60.0)))));
    const vc = vertexColor();
    const col = vc.rgb.mul(float(1.2).add(f.mul(0.8))).mul(shimmer);
    m.colorNode = vec4(col.mul(t.rgb), t.a.mul(f).mul(0.9));
    return m;
};

const EagleEyeMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
    const { time, vec4, uv, texture, vertexColor, float, sin } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending;
    m.vertexColors = true; m.alphaTest = 0.05;
    const t = texture(tex, uv());
    const p = float(0.5).add(float(0.5).mul(sin(time.mul(10.0))));
    const vc = vertexColor();
    m.colorNode = vec4(vc.rgb.mul(float(1.0).add(p.mul(0.5))).mul(t.rgb).mul(1.2), t.a.mul(float(0.8).add(p.mul(0.2))));
    return m;
};

const ImpactMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
    const { vec4, uv, texture, vertexColor } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending;
    m.vertexColors = true; m.alphaTest = 0.05;
    const t = texture(tex, uv());
    const vc = vertexColor();
    m.colorNode = vec4(vc.rgb.mul(t.rgb).mul(1.5), t.a);
    return m;
};

const ArcherMuzzleMat = (NodeMaterial: any, tsl: any, tex: THREE.Texture) => {
    const { vec3, vec4, uv, texture, vertexColor, float, pow, mix } = tsl;
    const m = new NodeMaterial();
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.AdditiveBlending; m.side = THREE.DoubleSide;
    m.vertexColors = true; m.alphaTest = 0.03;
    const t = texture(tex, uv());
    const cg = float(1.0).sub(uv().x.sub(0.5).abs().mul(2.0)).mul(float(1.0).sub(uv().y.sub(0.5).abs().mul(2.0)));
    const vc = vertexColor();
    const core = mix(vc.rgb.mul(2.5), vec3(3.5), pow(cg, float(3.0)));
    m.colorNode = vec4(core.mul(t.rgb).mul(1.5), t.a);
    return m;
};

// ─── Shared temp objects (zero allocation per frame) ─────────────────────────
const _obj = new THREE.Object3D();
const _trObj = new THREE.Object3D();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _trPos = new THREE.Vector3();
const _lerp = new THREE.Color();

// Arrow orientation helpers — aligns sprite along travel direction
const _worldUp = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

/**
 * Orients the arrow sprite so its X axis stretches along the travel direction,
 * Y axis stays vertical, and the face is visible from the camera.
 * Uses direct matrix manipulation (no lookAt + rotateZ hack).
 */
function setArrowTravel(
    obj: THREE.Object3D,
    px: number, py: number, pz: number,
    tx: number, ty: number, tz: number,
    scaleX: number, scaleY: number
): void {
    _fwd.set(tx - px, ty - py, tz - pz).normalize();
    _right.crossVectors(_fwd, _worldUp);
    if (_right.lengthSq() < 0.0001) {
        _right.set(1, 0, 0); // fallback for vertical travel
    }
    _right.normalize();
    _up.crossVectors(_right, _fwd).normalize();

    const m = obj.matrix.elements;
    // Column 0: X axis (right/travel direction) — scaled
    m[0] = _fwd.x * scaleX; m[1] = _fwd.y * scaleX; m[2] = _fwd.z * scaleX; m[3] = 0;
    // Column 1: Y axis (up) — scaled
    m[4] = _up.x * scaleY; m[5] = _up.y * scaleY; m[6] = _up.z * scaleY; m[7] = 0;
    // Column 2: Z axis (face normal toward camera)
    m[8] = _right.x; m[9] = _right.y; m[10] = _right.z; m[11] = 0;
    // Column 3: Position
    m[12] = px; m[13] = py; m[14] = pz; m[15] = 1;
    obj.matrixAutoUpdate = false;
    obj.matrixWorldNeedsUpdate = true;
}

interface VFXEntry {
    x: number; y: number; z: number;
    startTime: number; color: string;
    active: boolean; scale: number;
    type: 'flash' | 'hit' | 'dust' | 'simpleHit' | 'debris';
    rot: number;
    vx?: number;
    vy?: number;
    vz?: number;
}

export function BeginnerSpellEffect({ spellsRef, unitRegistry, simTimeRef }: Props) {
    // ── Refs ──────────────────────────────────────────────────────────────────
    const meshRef = useRef<THREE.InstancedMesh>(null!); // basic bullets
    const SniperCoreRef = useRef<THREE.InstancedMesh>(null!); // sniper bullet core
    const SniperTrailRef = useRef<THREE.InstancedMesh>(null!); // sniper trail streak
    const ArrowMeshRef = useRef<THREE.InstancedMesh>(null!); // archer physical arrows
    const FlashRef = useRef<THREE.InstancedMesh>(null!);
    const HitRef = useRef<THREE.InstancedMesh>(null!);
    const DustRef = useRef<THREE.InstancedMesh>(null!);
    const AuraRef = useRef<THREE.InstancedMesh>(null!);
    const SimpleHitRef = useRef<THREE.InstancedMesh>(null!);
    const DebrisRef = useRef<THREE.InstancedMesh>(null!);

    const ringIdx = useRef(0);
    const vfxPool = useRef<VFXEntry[]>(
        Array.from({ length: 600 }, () => ({ x: 0, y: 0, z: 0, startTime: 0, color: '#fff', active: false, scale: 1, type: 'flash', rot: 0 }))
    );
    const activeVfx = useRef<number[]>([]);
    const _col = useMemo(() => new THREE.Color(), []);

    // ── Geometri ──────────────────────────────────────────────────────────────
    // Peluru biasa
    const bulletGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
    // Inti peluru sniper: CylinderGeometry memanjang sepanjang Y, kita rotate via instanceMatrix
    const coreGeo = useMemo(() => {
        // Membuat capsule tipis memanjang: radius kecil, height = 1 (akan di-scale)
        const g = new THREE.CylinderGeometry(0.5, 0.3, 1, 8, 1);
        // Putar agar sumbu panjangnya = Z (arah terbang), karena lookAt() mengarahkan Z ke target
        g.rotateX(Math.PI / 2);
        return g;
    }, []);
    // Trail: plane yang akan di-scale panjang
    const trailGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const quadGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const arrowGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

    // ── Lazy Load WebGPU & TSL ──────────────────────────────────────────────
    const [materials, setMaterials] = useState<Record<string, THREE.Material> | null>(null);

    useEffect(() => {
        let isMounted = true;
        async function loadWebGPU() {
            try {
                const tsl = await import('three/tsl');
                const { NodeMaterial } = await import('three/webgpu');

                if (!isMounted) return;

                const loadedMats = {
                    bullet: SuperBulletMat(NodeMaterial, tsl, VFX_TEXTURES.bullet),
                    core: SniperCoreMat(NodeMaterial, tsl),
                    trail: SniperTrailMat(NodeMaterial, tsl, VFX_TEXTURES.bullet),
                    arrow: ArcherMuzzleMat(NodeMaterial, tsl, VFX_TEXTURES.flare),
                    flash: ImpactMat(NodeMaterial, tsl, VFX_TEXTURES.muzzles[0]),
                    hit: ImpactMat(NodeMaterial, tsl, VFX_TEXTURES.sparks[0]),
                    dust: ImpactMat(NodeMaterial, tsl, VFX_TEXTURES.smoke),
                    aura: EagleEyeMat(NodeMaterial, tsl, VFX_TEXTURES.star),
                    simpleHit: ImpactMat(NodeMaterial, tsl, VFX_TEXTURES.flare),
                };

                setMaterials(loadedMats as any);
            } catch (err) {
                console.error("Gagal memuat WebGPU materials:", err);
            }
        }
        loadWebGPU();
        return () => { isMounted = false; };
    }, []);

    // Low-poly debris: 4-sided cone is a pyramid, basic material with transparent to allow fade-out
    const debrisGeo = useMemo(() => new THREE.ConeGeometry(0.06, 0.13, 4), []);
    const debrisMat = useMemo(() => new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        toneMapped: false,
    }), []);

    useFrame((state, delta) => {
        if (!materials) return;
        const mesh = meshRef.current;
        const spells = spellsRef?.current;
        const fMesh = FlashRef.current;
        const hMesh = HitRef.current;
        const dMesh = DustRef.current;
        const aMesh = AuraRef.current;
        const coreMesh = SniperCoreRef.current;
        const trailMesh = SniperTrailRef.current;
        const arrowMesh = ArrowMeshRef.current;
        const shMesh = SimpleHitRef.current;
        const debMesh = DebrisRef.current;
        if (!mesh || !spells || !fMesh || !hMesh || !dMesh || !aMesh || !coreMesh || !trailMesh || !arrowMesh || !shMesh || !debMesh || !unitRegistry.current) return;

        const simNow = simTimeRef.current || 0;
        const time = state.clock.elapsedTime;
        const units = unitRegistry.current;

        // NERFED for low-end hardware
        const RARITY_SCALE = { common: 0.8, elite: 0.9, epic: 1.0, legendary: 1.1 };
        const RARITY_GLOW = { common: 4.0, elite: 5.0, epic: 6.0, legendary: 7.0 };

        // ── Aura bintang emas di atas MM saat ulti ────────────────────────────
        // FIX: Only scan active units via sorted buckets instead of all 1500
        let an = 0;
        const sortedUnits = (state as any).sortedActiveUnits;
        const activeUnitList = sortedUnits || units;
        const auraLimit = sortedUnits ? activeUnitList.length : units.length;
        for (let i = 0; i < auraLimit; i++) {
            const u = activeUnitList[i];
            if (u.isActive && u.unitClass === 'marksman' && u.isBuffed) {
                if (an < 50) {
                    _obj.position.set(u.position[0], u.position[1] + 2.5, u.position[2]);
                    _obj.rotation.set(0, 0, time * 2.5);
                    _obj.scale.setScalar(1.5);
                    _obj.updateMatrix();
                    aMesh.setMatrixAt(an, _obj.matrix);
                    _col.set('#ffd700').multiplyScalar(1.2);
                    aMesh.setColorAt(an, _col);
                    an++;
                }
            }
            // Dust trail saat marksman dash/roll
            if (u.isActive && u.unitClass === 'marksman' && u.isRolling) {
                if (Math.random() > 0.4) {
                    const vIdx = ringIdx.current;
                    const v = vfxPool.current[vIdx];
                    if (!v.active) activeVfx.current.push(vIdx);
                    ringIdx.current = (ringIdx.current + 1) % vfxPool.current.length;
                    v.x = u.position[0] + (Math.random() - 0.5); v.y = 0.2; v.z = u.position[2] + (Math.random() - 0.5);
                    v.startTime = performance.now(); v.color = '#fff'; v.active = true; v.scale = 1.8; v.type = 'dust'; v.rot = Math.random() * 7;
                }
            }
        }

        // Render golden star aura above local player when Eagle Eye ultimate is active!
        const isLocalPlayerMMEagleEye = (window as any).lastEagleEyeTime && (performance.now() - (window as any).lastEagleEyeTime < 6000);
        if (isLocalPlayerMMEagleEye && an < 50 && typeof (window as any).localPlayerPos !== 'undefined') {
            const lp = (window as any).localPlayerPos;
            _obj.position.set(lp.x, lp.y + 2.5, lp.z);
            _obj.rotation.set(0, 0, time * 2.5);
            _obj.scale.setScalar(1.5);
            _obj.updateMatrix();
            aMesh.setMatrixAt(an, _obj.matrix);
            _col.set('#ffd700').multiplyScalar(1.2);
            aMesh.setColorAt(an, _col);
            an++;
        }

        aMesh.count = an;
        aMesh.instanceMatrix.needsUpdate = true;
        if (aMesh.instanceColor) aMesh.instanceColor.needsUpdate = true;

        // ponytail: ShaderMaterial needed uniform update; NodeMaterial reads texture() node ref.
        // Texture swap requires recreating material for dynamic flipbook. Skip for now.
        // add when: flipbook animation needed

        // ── Render semua peluru ───────────────────────────────────────────────
        let n = 0; // basic bullet count
        let sn = 0; // sniper core count
        let tn = 0; // sniper trail count
        let arn = 0; // archer arrow count

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s || !s.active || !s.isBullet) continue;

            const r = s.rarity || 'common';
            const rScale = (RARITY_SCALE as any)[r] || 1.0;
            const rGlow = (RARITY_GLOW as any)[r] || 6.0;
            const isSniper = (s as any).isSniper;

            // Track target yang bergerak
            const targetPoolIdx = (s as any).targetPoolIdx !== undefined ? (s as any).targetPoolIdx : (s.targetId ? (parseInt(s.targetId.replace(/\D/g, '')) || 0) : undefined);
            if (targetPoolIdx !== undefined && unitRegistry.current) {
                const tar = unitRegistry.current[targetPoolIdx];
                if (tar?.isActive && tar.id === s.targetId) {
                    s.toX = tar.position[0]; s.toY = tar.position[1] + 1.2; s.toZ = tar.position[2];
                }
            }

            // --- High-Precision Client-Side Delta Movement ---
            const speed = isSniper ? ((s as any).sniperSpeed || 55.0) : ((s as any).bulletSpeed || 110.0);

            // Initialize current position if not set
            if ((s as any).curX === undefined) {
                (s as any).curX = s.fromX;
                (s as any).curY = s.fromY;
                (s as any).curZ = s.fromZ;
            }

            _from.set((s as any).curX, (s as any).curY, (s as any).curZ);
            _to.set(s.toX, s.toY, s.toZ);

            _dir.subVectors(_to, _from).normalize();
            const step = speed * delta; // Use high-precision local frame delta!
            const distToTarget = _from.distanceTo(_to);

            if (step >= distToTarget) {
                (s as any).curX = s.toX; (s as any).curY = s.toY; (s as any).curZ = s.toZ;
                (s as any).isHit = true;
            } else {
                _from.addScaledVector(_dir, step);
                (s as any).curX = _from.x; (s as any).curY = _from.y; (s as any).curZ = _from.z;
            }

            _obj.position.set((s as any).curX, (s as any).curY, (s as any).curZ);
            _obj.lookAt(s.toX, s.toY, s.toZ);

            const isFinisher = (s as any).isFinisher;
            const pClass = (s as any).playerClass || 'Marksman';

            if (isSniper) {
                if (pClass === 'Beginner') {
                    // RO Double Strafe: muzzle flash sprite stretched along travel direction
                    const w = (isFinisher ? 3.2 : 2.4) * rScale;
                    const h = (isFinisher ? 1.0 : 0.7) * rScale;
                    setArrowTravel(_obj,
                        (s as any).curX, (s as any).curY, (s as any).curZ,
                        s.toX, s.toY, s.toZ, w, h);
                    arrowMesh.setMatrixAt(arn, _obj.matrix);
                    _col.set(s.color || '#ffd700').multiplyScalar(isFinisher ? 3.5 : 2.5);
                    arrowMesh.setColorAt(arn, _col);
                    // Restore for other uses
                    _obj.matrixAutoUpdate = true;
                    arn++;
                } else {
                    // ── Inti peluru sniper: silinder tipis memanjang ──────────────
                    // Regular: (0.03, 0.03, 2.0)  |  Finisher: (0.05, 0.05, 3.0)
                    const bW = isFinisher ? 0.05 * rScale : 0.03 * rScale;
                    const bL = isFinisher ? 3.0 * rScale : 2.0 * rScale;
                    _obj.scale.set(bW, bW, bL);
                    _obj.updateMatrix();
                    coreMesh.setMatrixAt(sn, _obj.matrix);
                    _col.set(s.color || '#ffffff').multiplyScalar(isFinisher ? 2.5 : 1.5);
                    coreMesh.setColorAt(sn, _col);
                    sn++;
                }
            } else {
                // Peluru basic attack biasa - custom per class!
                if (pClass === 'Mage') {
                    // Frost/Fire Orb: diamond magic shard spinning rapidly
                    _obj.scale.set(1.1 * rScale, 1.1 * rScale, 2.0 * rScale);
                    _obj.rotateZ(time * 9.0);
                    _obj.updateMatrix();
                    mesh.setMatrixAt(n, _obj.matrix);
                    const glowMultiplier = rGlow * 1.6;
                    _col.set(s.color || '#fff').multiplyScalar(glowMultiplier * 0.15);
                    mesh.setColorAt(n, _col);
                    n++;
                } else if (pClass === 'Warrior') {
                    // Sword slash: wide flat crescent sword-wave slicing horizontal
                    _obj.scale.set(3.4 * rScale, 0.08 * rScale, 0.6 * rScale);
                    _obj.rotateY(Math.PI / 2); // perpendicular to motion
                    _obj.updateMatrix();
                    mesh.setMatrixAt(n, _obj.matrix);
                    _col.set(s.color || '#fff').multiplyScalar(rGlow * 0.15);
                    mesh.setColorAt(n, _col);
                    n++;
                } else if (pClass === 'Priest') {
                    // Holy orb: spinning golden cross prism
                    _obj.scale.set(1.4 * rScale, 1.4 * rScale, 1.4 * rScale);
                    _obj.rotateY(time * 3.0);
                    _obj.rotateZ(time * 2.0);
                    _obj.updateMatrix();
                    mesh.setMatrixAt(n, _obj.matrix);
                    const glowMultiplier = rGlow * 1.6;
                    _col.set(s.color || '#fff').multiplyScalar(glowMultiplier * 0.15);
                    mesh.setColorAt(n, _col);
                    n++;
                } else if (pClass === 'Thief') {
                    // Shadow dagger/shuriken: thin blade spinning extremely fast
                    _obj.scale.set(0.18 * rScale, 0.8 * rScale, 1.8 * rScale);
                    _obj.rotateZ(time * 26.0);
                    _obj.updateMatrix();
                    mesh.setMatrixAt(n, _obj.matrix);
                    _col.set(s.color || '#fff').multiplyScalar(rGlow * 0.15);
                    mesh.setColorAt(n, _col);
                    n++;
                } else if (pClass === 'Beginner') {
                    // Muzzle flash sprite for Archer basic attacks — along travel direction
                    const w = 2.0 * rScale;
                    const h = 0.6 * rScale;
                    setArrowTravel(_obj,
                        (s as any).curX, (s as any).curY, (s as any).curZ,
                        s.toX, s.toY, s.toZ, w, h);
                    arrowMesh.setMatrixAt(arn, _obj.matrix);
                    _col.set(s.color || '#10b981').multiplyScalar(2.5);
                    arrowMesh.setColorAt(arn, _col);
                    _obj.matrixAutoUpdate = true;
                    arn++;
                } else {
                    // Default Marksman bullet
                    _obj.scale.set(0.02 * rScale, 0.02 * rScale, 1.2 * rScale);
                    _obj.updateMatrix();
                    mesh.setMatrixAt(n, _obj.matrix);
                    _col.set(s.color || '#fff').multiplyScalar(rGlow * 0.15);
                    mesh.setColorAt(n, _col);
                    n++;
                }
            }

            // ── Jejak/lesatan di belakang peluru (Wind Trail) ──────────────────
            const needsTrail = isSniper || (pClass === 'Beginner');
            if (needsTrail && tn < 200) {
                // Panjang trail tumbuh seiring progress
                const growth = Math.min(1, (simNow - s.startTime) / 200);
                // Beginner arrows get longer, wider trails for luxurious effect
                const isArcher = pClass === 'Beginner';
                const baseTrailLen = isArcher ? (isFinisher ? 8.0 : 5.0) : (isFinisher ? 6.0 : 3.5);
                const baseTrailW = isArcher ? (isFinisher ? 0.08 : 0.05) : (isSniper ? (isFinisher ? 0.03 : 0.015) : 0.012);
                const trailLen = baseTrailLen * rScale * (0.3 + growth * 0.7);
                const trailW = baseTrailW * rScale;

                // Arah terbang: dari _from ke _to
                _dir.subVectors(_to, _from).normalize();
                // Posisi trail: tengah antara ujung ekor dan posisi peluru
                _trPos.copy(_obj.position).addScaledVector(_dir, -trailLen * 0.5);

                _trObj.position.copy(_trPos);
                _trObj.lookAt(_to);
                _trObj.scale.set(trailW, trailW, trailLen);
                _trObj.updateMatrix();
                trailMesh.setMatrixAt(tn, _trObj.matrix);

                const trailColor = isArcher ? (s.color || '#ffd700') : (isSniper ? (s.color || '#ffd700') : '#ffffff');
                _col.set(trailColor).multiplyScalar(isArcher ? (isFinisher ? 2.5 : 1.8) : (isFinisher ? 1.5 : 1.1));
                trailMesh.setColorAt(tn, _col);
                tn++;
            }

            // ── Impact explosion saat sampai di target ────────────────────────
            if ((s as any).isHit) {
                const pClass = (s as any).playerClass || 'Marksman';

                // Only spawn MM blast sparks if the character class is Marksman/Beginner or default!
                // Premium classes (Warrior, Mage, Priest, Thief) have their own highly optimized spell effects rendering their impact!
                if (pClass === 'Marksman' || pClass === 'Beginner') {
                    const isBeginner = pClass === 'Beginner';
                    const burstCount = isBeginner ? (isFinisher ? 4 : 2) : (isFinisher ? 5 : 2);
                    for (let k = 0; k < burstCount; k++) {
                        const vIdx = ringIdx.current;
                        const v = vfxPool.current[vIdx];
                        if (!v.active) activeVfx.current.push(vIdx);
                        ringIdx.current = (ringIdx.current + 1) % vfxPool.current.length;

                        // Add slight offset for dynamic burst scattering
                        v.x = s.toX + (Math.random() - 0.5) * 0.3;
                        v.y = s.toY + (Math.random() - 0.5) * 0.3;
                        v.z = s.toZ + (Math.random() - 0.5) * 0.3;
                        v.startTime = performance.now();
                        v.color = isBeginner ? (isFinisher ? '#ff8800' : '#ffcc33') : (s.color || '#fff');
                        v.active = true;
                        v.scale = isBeginner
                            ? ((isFinisher ? 2.5 : 1.2) * (0.8 + Math.random() * 0.4))
                            : ((isFinisher ? 6.5 : 3.2) * (0.8 + Math.random() * 0.4));
                        v.type = isBeginner ? 'simpleHit' : 'hit';
                        v.rot = Math.random() * Math.PI * 2;
                        (v as any).rScale = rScale * (isBeginner ? (isFinisher ? 1.8 : 1.2) : (isFinisher ? 1.8 : 0.9));
                        (v as any).rGlow = rGlow * (isBeginner ? (isFinisher ? 3.0 : 2.0) : (isFinisher ? 2.2 : 1.1));
                    }

                    if (isBeginner) {
                        // Luxurious debris: more particles, brighter colors
                        const debrisCount = (isFinisher ? 10 : 6) + Math.floor(Math.random() * 4);
                        for (let k = 0; k < debrisCount; k++) {
                            const vIdx = ringIdx.current;
                            const v = vfxPool.current[vIdx];
                            if (!v.active) activeVfx.current.push(vIdx);
                            ringIdx.current = (ringIdx.current + 1) % vfxPool.current.length;

                            v.x = s.toX;
                            v.y = s.toY;
                            v.z = s.toZ;
                            v.startTime = performance.now();
                            // Mix of gold, white, and amber debris
                            const debrisRoll = Math.random();
                            v.color = debrisRoll > 0.6 ? '#ffffff' : debrisRoll > 0.3 ? '#ffd744' : '#ff8800';
                            v.active = true;
                            v.scale = (isFinisher ? 1.0 : 0.6) + Math.random() * 1.0;
                            v.type = 'debris';
                            v.rot = Math.random() * Math.PI * 2;

                            const theta = Math.random() * Math.PI * 2;
                            const phi = Math.acos((Math.random() * 2) - 1);
                            const speed = (isFinisher ? 4.0 : 2.5) + Math.random() * 5.0;
                            v.vx = Math.sin(phi) * Math.cos(theta) * speed;
                            v.vy = Math.cos(phi) * speed + 2.0;
                            v.vz = Math.sin(phi) * Math.sin(theta) * speed;
                            (v as any).rScale = rScale * (isFinisher ? 1.5 : 1.0);
                            (v as any).rGlow = rGlow * (isFinisher ? 3.0 : 2.0);
                        }
                    }
                }

                // CLEANUP for pool reuse
                s.active = false;
                (s as any).isHit = false;
                (s as any).curX = undefined;
                (s as any).lastSimTime = undefined;
                (s as any)._tIdx = undefined;
            }
        }

        // Commit semua mesh
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        coreMesh.count = sn;
        coreMesh.instanceMatrix.needsUpdate = true;
        if (coreMesh.instanceColor) coreMesh.instanceColor.needsUpdate = true;

        trailMesh.count = tn;
        trailMesh.instanceMatrix.needsUpdate = true;
        if (trailMesh.instanceColor) trailMesh.instanceColor.needsUpdate = true;

        arrowMesh.count = arn;
        arrowMesh.instanceMatrix.needsUpdate = true;
        if (arrowMesh.instanceColor) arrowMesh.instanceColor.needsUpdate = true;

        // ponytail: time uniforms no longer needed — NodeMaterial reads `time` directly from TSL.

        // ── VFX pool: flash, dust, hit ────────────────────────────────────────
        let fn = 0; let hn = 0; let dn = 0; let shn = 0; let dn2 = 0;
        const currentVfx = activeVfx.current;
        let writeVfx = 0; // FIX: swap-remove instead of splice O(n²)
        for (let j = 0; j < currentVfx.length; j++) {
            const idx = currentVfx[j];
            const v = vfxPool.current[idx];
            if (!v.active) continue; // skip dead, don't copy to output

            const age = performance.now() - v.startTime;
            const vrScale = (v as any).rScale || 1.0;
            const vrGlow = (v as any).rGlow || 6.0;

            if (v.type === 'flash') {
                const ft = age / 120;
                if (ft >= 1) { v.active = false; continue; }
                if (fn < 100) {
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.scale.setScalar(v.scale * (1.1 - ft) * 2.5 * vrScale);
                    _obj.updateMatrix();
                    fMesh.setMatrixAt(fn, _obj.matrix);
                    _col.set(v.color).multiplyScalar(vrGlow * 0.15 * (1.0 - ft));
                    fMesh.setColorAt(fn, _col);
                    fn++;
                }
            } else if (v.type === 'dust') {
                const dt = age / 400;
                if (dt >= 1) { v.active = false; continue; }
                if (dn < 100) {
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(-Math.PI / 2, 0, v.rot);
                    _obj.scale.setScalar(v.scale * (0.5 + dt * 2.0) * (1.0 - dt));
                    _obj.updateMatrix();
                    dMesh.setMatrixAt(dn, _obj.matrix);
                    _col.set('#fff').multiplyScalar(1.0 * (1.0 - dt));
                    dMesh.setColorAt(dn, _col);
                    dn++;
                }
            } else if (v.type === 'simpleHit') {
                const ht = age / 200; // 200ms duration
                if (ht >= 1) { v.active = false; continue; }
                if (shn < 200) {
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(0, 0, v.rot);
                    const sc = v.scale * (1.0 + ht * 1.5) * (1.0 - ht) * vrScale;
                    _obj.scale.setScalar(sc);
                    _obj.updateMatrix();
                    shMesh.setMatrixAt(shn, _obj.matrix);
                    _col.set('#fff').lerp(_lerp.set(v.color), ht).multiplyScalar(vrGlow * 1.6 * (1.0 - ht));
                    shMesh.setColorAt(shn, _col);
                    shn++;
                }
            } else if (v.type === 'debris') {
                const dt = age / 450;
                if (dt >= 1) { v.active = false; continue; }
                if (dn2 < 300) {
                    const sec = age / 1000;
                    const px = v.x + (v.vx || 0) * sec;
                    const py = v.y + (v.vy || 0) * sec - 9.8 * sec * sec;
                    const pz = v.z + (v.vz || 0) * sec;

                    _obj.position.set(px, Math.max(0.1, py), pz);
                    _obj.rotation.set(v.rot + age * 0.01, v.rot + age * 0.007, 0);
                    const sc = v.scale * (1.0 - dt) * 0.8 * vrScale;
                    _obj.scale.setScalar(sc);
                    _obj.updateMatrix();
                    debMesh.setMatrixAt(dn2, _obj.matrix);
                    _col.set(v.color).multiplyScalar(vrGlow * 2.2 * (1.0 - dt));
                    debMesh.setColorAt(dn2, _col);
                    dn2++;
                }
            } else { // 'hit'
                const ht = age / 280;
                if (ht >= 1) { v.active = false; continue; }
                if (hn < 200) {
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(0, 0, v.rot + time * 5.0);
                    const sc = v.scale * (1.1 + ht * 5.0) * (1.0 - ht) * vrScale;
                    _obj.scale.setScalar(sc);
                    _obj.updateMatrix();
                    hMesh.setMatrixAt(hn, _obj.matrix);
                    _col.set('#fff').lerp(_lerp.set(v.color), ht).multiplyScalar(vrGlow * 0.15 * (1.0 - ht));
                    hMesh.setColorAt(hn, _col);
                    hn++;
                }
            }
            currentVfx[writeVfx++] = currentVfx[j]; // keep alive
        }
        currentVfx.length = writeVfx; // trim dead entries in-place (zero allocation)
        fMesh.count = fn; fMesh.instanceMatrix.needsUpdate = true; if (fMesh.instanceColor) fMesh.instanceColor.needsUpdate = true;
        hMesh.count = hn; hMesh.instanceMatrix.needsUpdate = true; if (hMesh.instanceColor) hMesh.instanceColor.needsUpdate = true;
        dMesh.count = dn; dMesh.instanceMatrix.needsUpdate = true; if (dMesh.instanceColor) dMesh.instanceColor.needsUpdate = true;
        shMesh.count = shn; shMesh.instanceMatrix.needsUpdate = true; if (shMesh.instanceColor) shMesh.instanceColor.needsUpdate = true;
        debMesh.count = dn2; debMesh.instanceMatrix.needsUpdate = true; if (debMesh.instanceColor) debMesh.instanceColor.needsUpdate = true;
    });

    if (!materials) return null;

    return (
        <group>
            {/* Basic marksman bullets */}
            <instancedMesh ref={meshRef} args={[bulletGeo, materials.bullet, MAX_BULLETS]} frustumCulled={false} />
            {/* Sniper bullet core — silinder tipis memanjang */}
            <instancedMesh ref={SniperCoreRef} args={[coreGeo, materials.core, 200]} frustumCulled={false} />
            {/* Sniper bullet trail — lesatan energi */}
            <instancedMesh ref={SniperTrailRef} args={[trailGeo, materials.trail, 200]} frustumCulled={false} />
            {/* Physical Archer arrows */}
            <instancedMesh ref={ArrowMeshRef} args={[arrowGeo, materials.arrow, MAX_BULLETS]} frustumCulled={false} />
            {/* VFX */}
            <instancedMesh ref={FlashRef} args={[quadGeo, materials.flash, 100]} frustumCulled={false} visible={false} />
            <instancedMesh ref={HitRef} args={[quadGeo, materials.hit, 200]} frustumCulled={false} />
            <instancedMesh ref={SimpleHitRef} args={[quadGeo, materials.simpleHit, 200]} frustumCulled={false} />
            <instancedMesh ref={DebrisRef} args={[debrisGeo, debrisMat, 300]} frustumCulled={false} />
            <instancedMesh ref={DustRef} args={[quadGeo, materials.dust, 100]} frustumCulled={false} />
            <instancedMesh ref={AuraRef} args={[quadGeo, materials.aura, 50]} frustumCulled={false} />
        </group>
    );
}