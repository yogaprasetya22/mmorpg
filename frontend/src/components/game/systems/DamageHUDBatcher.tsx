'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVFX } from './VFXManager';

/**
 * DamageHUDBatcher — Ragnarok Style (v18 — TSL NodeMaterial)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * VISUAL SYSTEM
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 1. NO COIN BACKGROUND:
 *    Only pure text numbers are rendered.
 *
 * 2. TUNED RETRO SIZE:
 *    The size of the numbers has been reduced to fit the screen neatly
 *    (Crit scale = 1.8, Normal scale = 1.25) so they don't cover the entire screen.
 *
 * 3. 2D RETRO COMIC CRIT STAR:
 *    Instead of mathematical glowing 3D stars, we now draw a layered comic-style
 *    explosion star directly onto a 2D Canvas texture using Nearest-Neighbor scaling.
 *    It is static (no saw-blade rotation) and moves/shrinks perfectly in sync.
 *
 * 4. PERSPECTIVE STACKING ("jatuh ke belakang"):
 *    Rapid consecutive hits push older hits backward (into -Z depth), upward,
 *    and reduce their opacity, creating a receding 3D stack.
 *
 * MIGRATION: digitMat & starMat use THREE.NodeMaterial + TSL attribute nodes.
 * This makes them compatible with both WebGL and WebGPU renderers.
 * Custom instance attributes (aCharIdx, aOpacity, aCrit, aCol) read via TSL
 * `attribute()`, eliminating the need for GLSL string uniforms.
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const MAX_EVENTS = 96;
const STRIDE = 9;
const MAX_INST = MAX_EVENTS * STRIDE;

const ATLAS_COLS = 6;
const ATLAS_ROWS = 4; // Expanded to support alphabetic characters cleanly

// Perspective stack tuning — optimized for max ASPD (9 hits/sec)
const CLUSTER_RADIUS = 1.8;
const LIFE_DURATION = 1.6;

// ─── ZERO-ALLOC HELPERS ──────────────────────────────────────────────────────
const _dummy = new THREE.Object3D();
const _v3 = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _hide = new THREE.Matrix4().makeScale(0, 0, 0);
const _dbuf = new Uint8Array(8);

// ─── COLORS ──────────────────────────────────────────────────────────────────
const C_CRIT_DIGIT = new THREE.Color('#ffea00');
const C_NORMAL_DIGIT = new THREE.Color('#ffffff');
const C_MAGIC_DIGIT = new THREE.Color('#00e5ff');
const C_HEAL_DIGIT = new THREE.Color('#33ff66');
const C_DEBUFF_DIGIT = new THREE.Color('#00e5ff');
const C_MISS_DIGIT = new THREE.Color('#90a4ae');

const IDX_PLUS = 10;
const IDX_MINUS = 11;

// ─── ATLAS ────────────────────────────────────────────────────────────────────
function buildAtlas(): THREE.CanvasTexture {
    const S = 128;
    const cvs = document.createElement('canvas');
    cvs.width = S * ATLAS_COLS;
    cvs.height = S * ATLAS_ROWS;
    const ctx = cvs.getContext('2d')!;

    const chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', 'M', 'I', 'S', 'L', 'U', 'C', 'K', 'Y'];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    chars.forEach((ch, i) => {
        const col = i % ATLAS_COLS;
        const row = Math.floor(i / ATLAS_COLS);
        const cx = col * S + S / 2;
        const cy = row * S + S / 2;

        ctx.font = 'normal 56px "Press Start 2P", monospace';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 18;
        ctx.strokeText(ch, cx, cy);

        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ch, cx, cy);
    });

    const tex = new THREE.CanvasTexture(cvs);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    return tex;
}

// ─── Material Factories ──────────────────────────────────────────────────────
const buildDigitMat = (NodeMaterial: any, tsl: any, atlas: THREE.Texture) => {
    const { texture, uv, vec2, vec3, vec4, time, attribute, float, greaterThan, smoothstep, mix, select, pow, floor, mod } = tsl;
    const mat = new NodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;

    // Reference the instance attributes by name
    // Wrap with float/vec3 for proper TSL type compatibility
    const aIdx = float(attribute('aCharIdx', 'float'));
    const aOp = float(attribute('aOpacity', 'float'));
    const aC = float(attribute('aCrit', 'float'));
    const col3 = vec3(attribute('aCol', 'vec3'));

    // Atlas UV calculation from character index
    const colIdx = mod(aIdx, float(ATLAS_COLS));
    const rowIdx = floor(aIdx.div(float(ATLAS_COLS)));
    const atlasUv = vec2(
        colIdx.add(uv().x).div(float(ATLAS_COLS)),
        float(1.0).sub(rowIdx.add(1.0).sub(uv().y).div(float(ATLAS_ROWS)))
    );

    const atlasTex = texture(atlas, atlasUv);
    const texCol = vec4(atlasTex.r, atlasTex.g, atlasTex.b, atlasTex.a);

    // Crit shine sweep effect
    const sweepExpr = uv().x.mul(1.2).add(uv().y.mul(0.4)).sub(time.mul(4.0));
    const sweep = mod(sweepExpr, float(2.0));
    const shine = smoothstep(float(0), float(0.18), sweep).mul(smoothstep(float(0.45), float(0.18), sweep));
    const topGlow = pow(float(1.0).sub(uv().y), float(4.0)).mul(float(0.45));
    const sparkle = shine.mul(0.65).add(topGlow).mul(texCol.a);

    // Crit color: mix normal with bright white-gold
    const critColor = mix(texCol.rgb.mul(col3), vec3(1.0, 0.98, 0.75), sparkle);
    const normalColor = texCol.rgb.mul(col3);

    // Choose based on aCrit flag
    const finalRgb = select(greaterThan(aC, float(0.5)), critColor, normalColor);

    // If aC > 0.5 (crit), add sparkle, else use normal
    mat.colorNode = vec4(finalRgb, texCol.a.mul(aOp));
    return mat;
};

const buildStarMat = (NodeMaterial: any, tsl: any, starTex: THREE.Texture) => {
    const { texture, uv, vec4, attribute, float } = tsl;
    const mat = new NodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;

    const aOp = float(attribute('aOpacity', 'float'));
    const starTexNode = texture(starTex, uv());

    mat.colorNode = vec4(starTexNode.rgb, starTexNode.a.mul(aOp));
    return mat;
};

// ─── AUTHENTIC 2D CRIT STAR TEXTURE ──────────────────────────────────────────
function buildStarTexture(): THREE.CanvasTexture {
    const S = 256;
    const cvs = document.createElement('canvas');
    cvs.width = S;
    cvs.height = S;
    const ctx = cvs.getContext('2d')!;

    const cx = S / 2;
    const cy = S / 2;

    const points = 10;
    const outerR = 108;
    const innerR = 48;

    const radiiPattern = [1.0, 0.85, 1.1, 0.9, 1.05, 0.95, 1.15, 0.88, 1.0, 0.92];

    ctx.lineJoin = 'miter';
    ctx.miterLimit = 3;

    // 1. Draw outer black outline (thick stroke + fill)
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const isOuter = i % 2 === 0;
        let r = isOuter ? outerR : innerR;
        if (isOuter) r *= radiiPattern[(i / 2) % radiiPattern.length];
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#1e0000';
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.fillStyle = '#1e0000';
    ctx.fill();

    // 2. Draw vibrant red layer
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const isOuter = i % 2 === 0;
        let r = (isOuter ? outerR : innerR) - 6;
        if (isOuter) r *= radiiPattern[(i / 2) % radiiPattern.length];
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#e84118';
    ctx.fill();

    // 3. Draw bright orange middle layer
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const isOuter = i % 2 === 0;
        let r = (isOuter ? outerR * 0.72 : innerR * 0.85);
        if (isOuter) r *= radiiPattern[(i / 2) % radiiPattern.length];
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#f0932b';
    ctx.fill();

    // 4. Draw creamy yellow core
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const isOuter = i % 2 === 0;
        let r = (isOuter ? outerR * 0.42 : innerR * 0.6);
        if (isOuter) r *= radiiPattern[(i / 2) % radiiPattern.length];
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#fbc531';
    ctx.fill();

    const tex = new THREE.CanvasTexture(cvs);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

// ─── EVENT STRUCT ─────────────────────────────────────────────────────────────
interface Evt {
    alive: boolean;
    startTime: number;
    duration: number;
    spawnX: number; spawnY: number; spawnZ: number;
    isCrit: boolean;
    isMagic: boolean;
    isHeal: boolean;
    isDebuff: boolean;
    numChars: number;
    charIdx: Uint8Array;
    digitColor: THREE.Color;
    clusterX: number; clusterY: number; clusterZ: number;
    depthIdx: number;
    vx: number;
    vy: number;
    grav: number;
}

function makeEvt(): Evt {
    return {
        alive: false, startTime: 0, duration: LIFE_DURATION,
        spawnX: 0, spawnY: 0, spawnZ: 0,
        isCrit: false, isMagic: false, isHeal: false, isDebuff: false,
        numChars: 0, charIdx: new Uint8Array(STRIDE),
        digitColor: new THREE.Color('#ffffff'),
        clusterX: 0, clusterY: 0, clusterZ: 0,
        depthIdx: 0,
        vx: 0,
        vy: 0,
        grav: 15.0,
    };
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export function DamageHUDBatcher({
    damageQueue,
    playerStatsRef
}: {
    damageQueue: React.RefObject<any[]>,
    playerStatsRef?: React.RefObject<any>
}) {
    const digitMeshRef = useRef<THREE.InstancedMesh>(null!);
    const starMeshRef = useRef<THREE.InstancedMesh>(null!);
    const { spawnVFX } = useVFX();

    // Pools
    const evts = useMemo(() => Array.from({ length: MAX_EVENTS }, makeEvt), []);
    const evtPtr = useRef(0);

    // ── Pre-allocated instance data arrays ─────────────────────────────────
    const aCharIdx = useMemo(() => new Float32Array(MAX_INST), []);
    const aOpacity = useMemo(() => new Float32Array(MAX_INST), []);
    const aCrit = useMemo(() => new Float32Array(MAX_INST), []);
    const aCol = useMemo(() => new Float32Array(MAX_INST * 3), []);
    const sOpacity = useMemo(() => new Float32Array(MAX_EVENTS), []);

    const atlas = useMemo(() => buildAtlas(), []);
    const starTex = useMemo(() => buildStarTexture(), []);

    // ── Lazy Load WebGPU & TSL ───────────────────────────────────────────────
    const [materials, setMaterials] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        async function loadWebGPU() {
            try {
                const tsl = await import('three/tsl');
                const { NodeMaterial } = await import('three/webgpu');

                if (!isMounted) return;

                const loaded = {
                    digitMat: buildDigitMat(NodeMaterial, tsl, atlas),
                    starMat: buildStarMat(NodeMaterial, tsl, starTex),
                };

                setMaterials(loaded);
            } catch (err) {
                console.error("Gagal memuat WebGPU materials di DamageHUDBatcher:", err);
            }
        }
        loadWebGPU();
        return () => { isMounted = false; };
    }, [atlas, starTex]);

    // ── Geometry with inline instance attributes ───────────────────────────
    const digitGeo = useMemo(() => {
        const g = new THREE.PlaneGeometry(1, 1);
        g.setAttribute('aCharIdx', new THREE.InstancedBufferAttribute(aCharIdx, 1));
        g.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(aOpacity, 1));
        g.setAttribute('aCrit', new THREE.InstancedBufferAttribute(aCrit, 1));
        g.setAttribute('aCol', new THREE.InstancedBufferAttribute(aCol, 3));
        return g;
    }, [aCharIdx, aOpacity, aCrit, aCol]);

    const starGeo = useMemo(() => {
        const g = new THREE.PlaneGeometry(1, 1);
        g.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(sOpacity, 1));
        return g;
    }, [sOpacity]);

    const hadActive = useRef(false);

    useEffect(() => {
        if (typeof document !== 'undefined' && document.fonts) {
            document.fonts.ready.then(() => {
                const newCvs = buildAtlas().image as HTMLCanvasElement;
                if (atlas) {
                    atlas.image = newCvs;
                    atlas.needsUpdate = true;
                }
            });
        }
    }, [atlas]);

    // Init instance matrices to hidden
    useEffect(() => {
        const dm = digitMeshRef.current;
        if (dm) {
            for (let i = 0; i < MAX_INST; i++) dm.setMatrixAt(i, _hide);
            dm.instanceMatrix.needsUpdate = true;
        }
        const sm = starMeshRef.current;
        if (sm) {
            for (let i = 0; i < MAX_EVENTS; i++) sm.setMatrixAt(i, _hide);
            sm.instanceMatrix.needsUpdate = true;
        }
    }, []);

    useFrame((state) => {
        if (!materials) return;
        const now = state.clock.elapsedTime;
        const dm = digitMeshRef.current;
        const sm = starMeshRef.current;
        if (!dm) return;

        // ── SPAWN ─────────────────────────────────────────────────────────────
        if (damageQueue.current && damageQueue.current.length > 0) {
            if (damageQueue.current.length > 1) {
                damageQueue.current.sort((a, b) => (b.isCrit ? 1 : 0) - (a.isCrit ? 1 : 0));
            }

            while (damageQueue.current.length > 0) {
                const ev = damageQueue.current.shift()!;

                if (!ev || !Array.isArray(ev.position) || !Number.isFinite(ev.position[0])) continue;

                const isMiss = !!ev.isMiss;
                const isCrit = !isMiss && !!ev.isCrit;
                const isMagic = !isMiss && (!!ev.isMagic || ev.color === '#00e5ff');
                const isHeal = !isMiss && !!ev.isHeal;
                const isDebuff = !isMiss && ev.value < 0;

                let totalChars = 0;
                let SW = isCrit ? 0.85 : 0.72;
                let GAP = isCrit ? 0.60 : 0.48;

                const px = ev.position[0], py = ev.position[1], pz = ev.position[2];
                let clusterX = px, clusterY = py, clusterZ = pz;

                for (let ei = 0; ei < MAX_EVENTS; ei++) {
                    const e = evts[ei];
                    if (!e.alive) continue;
                    const dx = e.clusterX - px, dz = e.clusterZ - pz;
                    if (dx * dx + dz * dz < CLUSTER_RADIUS * CLUSTER_RADIUS) {
                        clusterX = e.clusterX;
                        clusterY = e.clusterY;
                        clusterZ = e.clusterZ;
                        e.depthIdx = Math.min(e.depthIdx + 1, 6);
                    }
                }

                const ei = evtPtr.current;
                evtPtr.current = (evtPtr.current + 1) % MAX_EVENTS;
                const e = evts[ei];

                if (e.alive) {
                    const base = ei * STRIDE;
                    for (let s = 0; s < e.numChars; s++) {
                        dm.setMatrixAt(base + s, _hide);
                        aOpacity[base + s] = 0;
                    }
                    if (sm) {
                        sm.setMatrixAt(ei, _hide);
                        sOpacity[ei] = 0;
                    }
                }

                if (isMiss) {
                    e.charIdx[0] = 12;
                    e.charIdx[1] = 13;
                    e.charIdx[2] = 14;
                    e.charIdx[3] = 14;
                    totalChars = 4;
                    SW = 0.58;
                    GAP = 0.38;
                } else {
                    let rawVal = ev.value;
                    if (!Number.isFinite(rawVal)) rawVal = 0;
                    let val = Math.abs(Math.round(rawVal));
                    let dc = 0;
                    if (val === 0) { _dbuf[0] = 0; dc = 1; }
                    else { while (val > 0 && dc < 8) { _dbuf[dc++] = val % 10; val = (val / 10) | 0; } }

                    const hasSign = isHeal || isDebuff;
                    totalChars = dc + (hasSign ? 1 : 0);

                    let ci = 0;
                    if (hasSign) { e.charIdx[ci++] = isHeal ? IDX_PLUS : IDX_MINUS; }
                    for (let d = 0; d < dc; d++) {
                        e.charIdx[ci++] = _dbuf[dc - 1 - d];
                    }
                }

                const totalW = totalChars * GAP;

                if (isMiss) e.digitColor.copy(C_MISS_DIGIT);
                else if (isHeal) e.digitColor.copy(C_HEAL_DIGIT);
                else if (isDebuff) e.digitColor.copy(C_DEBUFF_DIGIT);
                else if (isCrit) e.digitColor.copy(C_CRIT_DIGIT);
                else if (isMagic) e.digitColor.copy(C_MAGIC_DIGIT);
                else e.digitColor.copy(C_NORMAL_DIGIT);

                const yOff = 2.2;

                e.alive = true;
                e.startTime = now;
                e.spawnX = px; e.spawnY = py + yOff; e.spawnZ = pz;
                e.clusterX = clusterX; e.clusterY = clusterY; e.clusterZ = clusterZ;
                e.depthIdx = 0;
                e.isCrit = isCrit;
                e.isMagic = isMagic;
                e.isHeal = isHeal;
                e.isDebuff = isDebuff;
                e.numChars = totalChars;

                const direction = (evtPtr.current % 2 === 0) ? 1 : -1;

                if (isCrit) {
                    e.vx = direction * (2.0 + Math.random() * 2.5) + (Math.random() - 0.5) * 0.8;
                    e.vy = 12.0 + Math.random() * 4.0;
                    e.grav = 24.0;
                    e.duration = 0.85;

                    if (typeof (window as any).cameraShake === 'function') {
                        (window as any).cameraShake(0.18);
                    }
                } else if (isMiss) {
                    e.vx = direction * (1.2 + Math.random() * 0.8);
                    e.vy = 4.0 + Math.random() * 1.0;
                    e.grav = 14.0;
                    e.duration = 0.90;
                } else if (isHeal) {
                    e.vx = (Math.random() - 0.5) * 1.5;
                    e.vy = 5.0 + Math.random() * 1.5;
                    e.grav = 10.0;
                    e.duration = 0.95;
                } else {
                    e.vx = direction * (3.2 + Math.random() * 2.2) + (Math.random() - 0.5) * 1.0;
                    e.vy = 9.0 + Math.random() * 4.0;
                    e.grav = 24.0;
                    e.duration = 0.70;
                }

                (e as any)._totalW = totalW;
                (e as any)._GAP = GAP;
                (e as any)._SW = SW;

                if (isCrit && sm) {
                    spawnVFX(ev.position, 'critical-hit', '#ffcc00');
                    spawnVFX(ev.position, 'shockwave', '#ff4400');
                }
            }
        }

        // ── CAMERA BASIS ──────────────────────────────────────────────────────
        const camQ = state.camera.quaternion;
        _right.set(1, 0, 0).applyQuaternion(camQ);
        _up.set(0, 1, 0).applyQuaternion(camQ);
        state.camera.getWorldDirection(_camDir);

        // ── ANIMATE DIGITS & STAR BURSTS ──────────────────────────────────────
        let anyActive = false;

        for (let ei = 0; ei < MAX_EVENTS; ei++) {
            const e = evts[ei];
            const base = ei * STRIDE;

            if (!e.alive) continue;

            const t = now - e.startTime;
            const tn = t / e.duration;

            if (tn >= 1.0) {
                e.alive = false;
                for (let s = 0; s < e.numChars; s++) {
                    dm.setMatrixAt(base + s, _hide);
                    aOpacity[base + s] = 0;
                }
                if (sm) {
                    sm.setMatrixAt(ei, _hide);
                    sOpacity[ei] = 0;
                }
                continue;
            }

            anyActive = true;

            const di = e.depthIdx;

            let scaleMultiplier = 1.0;
            if (e.isCrit) {
                if (tn < 0.15) {
                    const ratio = tn / 0.15;
                    const ease = 1.0 - Math.pow(1.0 - ratio, 3);
                    scaleMultiplier = THREE.MathUtils.lerp(1.45, 1.0, ease);
                } else {
                    scaleMultiplier = THREE.MathUtils.lerp(1.0, 0.6, (tn - 0.15) / 0.85);
                }
            } else {
                if (tn < 0.12) {
                    const ratio = tn / 0.12;
                    const ease = 1.0 - Math.pow(1.0 - ratio, 3);
                    scaleMultiplier = THREE.MathUtils.lerp(1.25, 1.0, ease);
                } else {
                    scaleMultiplier = THREE.MathUtils.lerp(1.0, 0.7, (tn - 0.12) / 0.88);
                }
            }

            const stats = playerStatsRef?.current || {};
            const cRate = stats.c_rate || 0;
            const baseScale = e.isCrit
                ? Math.min(2.8, 1.7 + (cRate / 100.0) * 0.7)
                : 1.00;
            const totalScale = baseScale * scaleMultiplier;

            const offsetX = e.vx * t;
            const offsetY = e.vy * t - 0.5 * e.grav * t * t;

            const wx = e.spawnX + _camDir.x * di * 0.18;
            const wy = e.spawnY + _camDir.y * di * 0.18;
            const wz = e.spawnZ + _camDir.z * di * 0.18;

            const opacity = tn > 0.65 ? (1.0 - tn) / 0.35 : 1.0;

            if (opacity < 0.02) {
                for (let c = 0; c < e.numChars; c++) aOpacity[base + c] = 0;
                if (sm) sOpacity[ei] = 0;
                continue;
            }

            let jx = 0.0, jy = 0.0;
            if (e.isCrit && di === 0 && t < 0.10) {
                const j = (1.0 - t / 0.10) * 0.25;
                jx = (Math.random() - 0.5) * j;
                jy = (Math.random() - 0.5) * j;
            }

            // ── Animate Star ──────────────────────────────────────────────────
            if (e.isCrit && sm) {
                const starBaseScale = totalScale * 1.85;
                const scaleX = starBaseScale * (1.15 + (e.numChars - 1) * 0.35);
                const scaleY = starBaseScale * 1.05;

                _v3.set(wx + _camDir.x * 0.05, wy + _camDir.y * 0.05, wz + _camDir.z * 0.05)
                    .addScaledVector(_right, offsetX + jx)
                    .addScaledVector(_up, offsetY + jy);

                _dummy.position.copy(_v3);
                _dummy.quaternion.copy(camQ);
                _dummy.scale.set(scaleX, scaleY, 1.0);
                _dummy.updateMatrix();
                sm.setMatrixAt(ei, _dummy.matrix);
                sOpacity[ei] = opacity;
            } else if (sm) {
                sm.setMatrixAt(ei, _hide);
                sOpacity[ei] = 0;
            }

            // ── Digits ────────────────────────────────────────────────────────
            const GAP = (e as any)._GAP ?? 0.6;
            const SW = (e as any)._SW ?? 0.75;
            const totalW = (e as any)._totalW ?? (e.numChars * GAP);

            let baseR: number, baseG: number, baseB: number;
            if (e.isCrit && di === 0 && t < 0.07 && Math.floor(t * 40) % 2 === 0) {
                baseR = 1.0; baseG = 1.0; baseB = 1.0;
            } else {
                baseR = e.digitColor.r; baseG = e.digitColor.g; baseB = e.digitColor.b;
            }

            for (let c = 0; c < e.numChars; c++) {
                const si = base + c;
                const lx = (c * GAP) - totalW * 0.5 + GAP * 0.5;

                _v3.set(wx, wy, wz)
                    .addScaledVector(_right, lx * totalScale + offsetX + jx)
                    .addScaledVector(_up, offsetY + jy);

                _dummy.position.copy(_v3);
                _dummy.quaternion.copy(camQ);
                _dummy.scale.setScalar(totalScale * SW);
                _dummy.updateMatrix();
                dm.setMatrixAt(si, _dummy.matrix);

                aOpacity[si] = opacity;
                aCharIdx[si] = e.charIdx[c];
                aCrit[si] = (e.isCrit && di === 0) ? 1.0 : 0.0;
                aCol[si * 3] = baseR;
                aCol[si * 3 + 1] = baseG;
                aCol[si * 3 + 2] = baseB;
            }

            for (let c = e.numChars; c < STRIDE; c++) {
                aOpacity[base + c] = 0;
                dm.setMatrixAt(base + c, _hide);
            }
        }

        if (anyActive || hadActive.current) {
            dm.instanceMatrix.needsUpdate = true;
            (dm.geometry.attributes.aCharIdx as THREE.InstancedBufferAttribute).needsUpdate = true;
            (dm.geometry.attributes.aOpacity as THREE.InstancedBufferAttribute).needsUpdate = true;
            (dm.geometry.attributes.aCrit as THREE.InstancedBufferAttribute).needsUpdate = true;
            (dm.geometry.attributes.aCol as THREE.InstancedBufferAttribute).needsUpdate = true;

            if (sm) {
                sm.instanceMatrix.needsUpdate = true;
                (sm.geometry.attributes.aOpacity as THREE.InstancedBufferAttribute).needsUpdate = true;
            }
        }
        hadActive.current = anyActive;
    });

    if (!materials) return null;

    return (
        <>
            <instancedMesh
                ref={starMeshRef}
                args={[starGeo, materials.starMat, MAX_EVENTS]}
                frustumCulled={false}
                renderOrder={997}
            />
            <instancedMesh
                ref={digitMeshRef}
                args={[digitGeo, materials.digitMat, MAX_INST]}
                frustumCulled={false}
                renderOrder={999}
            />
        </>
    );
}
