'use client';
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
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

// ─── Material: Peluru biasa (Marksman basic attack) ──────────────────────────
const SuperBulletMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex }, uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        varying vec3 vColor;
        void main() {
            vUv = uv; vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec2 vUv; varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            float pulse = 0.8 + 0.2 * sin(uTime * 30.0 + vUv.x * 5.0);
            vec3 core = mix(vColor * 1.5, vec3(2.0), (1.0 - vUv.x) * pulse);
            gl_FragColor = vec4(core * tex.rgb * 1.5, tex.a);
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

// ─── Material: Inti peluru sniper (silinder panjang, bersinar) ───────────────
const SniperCoreMat = () => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        void main() {
            vUv = uv; vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec2 vUv; varying vec3 vColor;
        void main() {
            // vUv.y: 0=bottom, 1=top  |  Along cylinder axis = vUv.x
            float radial = 1.0 - smoothstep(0.0, 0.5, abs(vUv.y - 0.5));
            // ujung depan peluru lebih terang
            float nose   = smoothstep(0.3, 1.0, vUv.x);
            float body   = radial;
            float pulse  = 0.92 + 0.08 * sin(uTime * 40.0);

            // Warna: tim color di badan, putih-panas di ujung
            vec3 col = mix(vColor * 1.2, vec3(2.0, 2.0, 1.6), nose);
            float alpha = body * pulse;

            gl_FragColor = vec4(col, alpha);
            if (alpha < 0.05) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

// ─── Material: Jejak/lesatan energi di belakang peluru sniper ────────────────
const SniperTrailMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex }, uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        void main() {
            vUv = uv; vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec2 vUv; varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            // vUv.x=0 = ujung ekor (transparan), vUv.x=1 = pangkal peluru (terang)
            float fade = vUv.x * vUv.x;
            // Shimmer bergerak ke arah ekor
            float shimmer = 0.7 + 0.3 * sin(vUv.x * 12.0 - uTime * 60.0);
            vec3 col = vColor * (1.2 + fade * 0.8) * shimmer;
            gl_FragColor = vec4(col * tex.rgb, tex.a * fade * 0.9);
            if (gl_FragColor.a < 0.01) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

// ─── Material: Aura bintang emas saat ulti aktif ─────────────────────────────
const EagleEyeMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex }, uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv; varying vec3 vColor;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        void main() {
            vUv = uv; vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec2 vUv; varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            float pulse = 0.5 + 0.5 * sin(uTime * 10.0);
            vec3 glow = vColor * (1.0 + pulse * 0.5);
            gl_FragColor = vec4(glow * tex.rgb * 1.2, tex.a * (0.8 + 0.2 * pulse));
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
});

// ─── Material: Impact spark & flash ──────────────────────────────────────────
const ImpactMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex } },
    vertexShader: `
        varying vec2 vUv;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        varying vec3 vColor;
        void main() {
            vUv = uv; vColor = instanceColor;
            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float sc = length(vec3(instanceMatrix[0][0], instanceMatrix[0][1], instanceMatrix[0][2]));
            mvPosition.xy += position.xy * sc;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv; varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            gl_FragColor = vec4(vColor * tex.rgb * 1.5, tex.a);
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
});


// ─── Muzzle Flash Sprite Material (replaces 3D arrow geometry) ──────────────
const ArcherMuzzleMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex } },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        void main() {
            vUv = uv;
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            // White-hot core at the center of the capsule/flare
            float centerGlow = (1.0 - abs(vUv.x - 0.5) * 2.0) * (1.0 - abs(vUv.y - 0.5) * 2.0);
            vec3 core = mix(vColor * 2.5, vec3(3.5), pow(centerGlow, 3.0));
            gl_FragColor = vec4(core * tex.rgb * 1.5, tex.a);
            if (gl_FragColor.a < 0.03) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

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

    // ── Material ──────────────────────────────────────────────────────────────
    const bulletMat = useMemo(() => SuperBulletMat(VFX_TEXTURES.bullet), []);
    const coreMat = useMemo(() => SniperCoreMat(), []);
    const trailMat = useMemo(() => SniperTrailMat(VFX_TEXTURES.bullet), []);
    const arrowMat = useMemo(() => ArcherMuzzleMat(VFX_TEXTURES.flare), []);
    const flashMat = useMemo(() => ImpactMat(VFX_TEXTURES.muzzles[0]), []);
    const hitMat = useMemo(() => ImpactMat(VFX_TEXTURES.sparks[0]), []);
    const dustMat = useMemo(() => ImpactMat(VFX_TEXTURES.smoke), []);
    const auraMat = useMemo(() => EagleEyeMat(VFX_TEXTURES.star), []);
    const simpleHitMat = useMemo(() => ImpactMat(VFX_TEXTURES.flare), []);
    
    // Low-poly debris: 4-sided cone is a pyramid, basic material with transparent to allow fade-out
    const debrisGeo = useMemo(() => new THREE.ConeGeometry(0.06, 0.13, 4), []);
    const debrisMat = useMemo(() => new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        toneMapped: false,
    }), []);

    useFrame((state, delta) => {
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

        // Animasi spark flipbook
        const sIdx = Math.floor(time * 15) % 5;
        hitMat.uniforms.tDiffuse.value = VFX_TEXTURES.sparks[sIdx];

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

        // Update time uniforms
        (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
        coreMat.uniforms.uTime.value = time;
        trailMat.uniforms.uTime.value = time;
        auraMat.uniforms.uTime.value = time;

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

    return (
        <group>
            {/* Basic marksman bullets */}
            <instancedMesh ref={meshRef} args={[bulletGeo, bulletMat, MAX_BULLETS]} frustumCulled={false} />
            {/* Sniper bullet core — silinder tipis memanjang */}
            <instancedMesh ref={SniperCoreRef} args={[coreGeo, coreMat, 200]} frustumCulled={false} />
            {/* Sniper bullet trail — lesatan energi */}
            <instancedMesh ref={SniperTrailRef} args={[trailGeo, trailMat, 200]} frustumCulled={false} />
            {/* Physical Archer arrows */}
            <instancedMesh ref={ArrowMeshRef} args={[arrowGeo, arrowMat, MAX_BULLETS]} frustumCulled={false} />
            {/* VFX */}
            <instancedMesh ref={FlashRef} args={[quadGeo, flashMat, 100]} frustumCulled={false} visible={false} />
            <instancedMesh ref={HitRef} args={[quadGeo, hitMat, 200]} frustumCulled={false} />
            <instancedMesh ref={SimpleHitRef} args={[quadGeo, simpleHitMat, 200]} frustumCulled={false} />
            <instancedMesh ref={DebrisRef} args={[debrisGeo, debrisMat, 300]} frustumCulled={false} />
            <instancedMesh ref={DustRef} args={[quadGeo, dustMat, 100]} frustumCulled={false} />
            <instancedMesh ref={AuraRef} args={[quadGeo, auraMat, 50]} frustumCulled={false} />
        </group>
    );
}