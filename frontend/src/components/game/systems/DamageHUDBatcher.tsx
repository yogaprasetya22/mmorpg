'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVFX } from './VFXManager';

/**
 * DamageHUDBatcher — Ragnarok Style (v17 — Authentic 2D Crit Star Sprites)
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
 *    - Thick dark crimson border
 *    - Vibrant orange-red outer body
 *    - Golden orange inner layer
 *    - Creamy yellow retro core
 *    - Uneven hand-drawn cartoon spikes (10 points)
 *    It is static (no saw-blade rotation) and moves/shrinks perfectly in sync.
 *
 * 4. PERSPECTIVE STACKING ("jatuh ke belakang"):
 *    Rapid consecutive hits push older hits backward (into -Z depth), upward,
 *    and reduce their opacity, creating a receding 3D stack.
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const MAX_EVENTS = 96;
const STRIDE     = 9;
const MAX_INST   = MAX_EVENTS * STRIDE;

const ATLAS_COLS = 6;
const ATLAS_ROWS = 4; // Expanded to support alphabetic characters cleanly

// Perspective stack tuning — optimized for max ASPD (9 hits/sec)
const CLUSTER_RADIUS = 1.8;   // world units: hits within this radius join one cluster
const LIFE_DURATION  = 1.2;   // fast turnover — numbers disappear quickly making room for new hits

// ─── ZERO-ALLOC HELPERS ──────────────────────────────────────────────────────
const _dummy = new THREE.Object3D();
const _v3    = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up    = new THREE.Vector3();
const _hide  = new THREE.Matrix4().makeScale(0, 0, 0);
const _dbuf  = new Uint8Array(8);

// ─── COLORS ──────────────────────────────────────────────────────────────────
const C_CRIT_DIGIT   = new THREE.Color('#ffea00'); // Neon yellow/gold for crits
const C_NORMAL_DIGIT = new THREE.Color('#ffffff'); // Pure white for normal physical hits
const C_MAGIC_DIGIT  = new THREE.Color('#00e5ff'); // Electric cyan for magic/skills
const C_HEAL_DIGIT   = new THREE.Color('#33ff66'); // Lime green for heals
const C_DEBUFF_DIGIT = new THREE.Color('#00e5ff'); // Cyan for debuffs/negatives
const C_MISS_DIGIT   = new THREE.Color('#90a4ae'); // Light slate grey for misses

const IDX_PLUS  = 10;
const IDX_MINUS = 11;

// ─── ATLAS (digits only, white fill, thick black outline, Press Start 2P) ────
function buildAtlas(): THREE.CanvasTexture {
    const S   = 128;
    const cvs = document.createElement('canvas');
    cvs.width  = S * ATLAS_COLS;
    cvs.height = S * ATLAS_ROWS;
    const ctx  = cvs.getContext('2d')!;

    const chars = ['0','1','2','3','4','5','6','7','8','9','+','-','M','I','S','L','U','C','K','Y'];
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    chars.forEach((ch, i) => {
        const col = i % ATLAS_COLS;
        const row = Math.floor(i / ATLAS_COLS);
        const cx  = col * S + S / 2;
        const cy  = row * S + S / 2;

        ctx.font       = 'normal 56px "Press Start 2P", monospace';
        ctx.lineJoin   = 'round';
        ctx.miterLimit = 2;

        // Massive thick black outline for blocky pixel art/arcade feel
        ctx.shadowColor   = 'rgba(0,0,0,0.95)';
        ctx.shadowBlur    = 8;
        ctx.shadowOffsetY = 4;
        ctx.strokeStyle   = '#000000';
        ctx.lineWidth     = 18;
        ctx.strokeText(ch, cx, cy);

        // Fill with white (colors applied via instanced color attributes)
        ctx.shadowColor = 'transparent';
        ctx.fillStyle   = '#ffffff';
        ctx.fillText(ch, cx, cy);
    });

    const tex     = new THREE.CanvasTexture(cvs);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    return tex;
}

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

    // Stylized asymmetrical radii pattern to give a hand-drawn cartoon/RO feel
    const radiiPattern = [1.0, 0.85, 1.1, 0.9, 1.05, 0.95, 1.15, 0.88, 1.0, 0.92];

    ctx.lineJoin = 'miter';
    ctx.miterLimit = 3;

    // 1. Draw outer black outline (thick stroke + fill)
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const isOuter = i % 2 === 0;
        let r = isOuter ? outerR : innerR;
        if (isOuter) {
            r *= radiiPattern[(i / 2) % radiiPattern.length];
        }
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#1e0000'; // Very dark, near-black crimson outline
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.fillStyle = '#1e0000';
    ctx.fill();

    // 2. Draw vibrant red layer (slightly smaller)
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const isOuter = i % 2 === 0;
        let r = (isOuter ? outerR : innerR) - 6;
        if (isOuter) {
            r *= radiiPattern[(i / 2) % radiiPattern.length];
        }
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#e84118'; // Bright crimson red (Ragnarok Online style)
    ctx.fill();

    // 3. Draw bright orange middle layer
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const isOuter = i % 2 === 0;
        let r = (isOuter ? outerR * 0.72 : innerR * 0.85);
        if (isOuter) {
            r *= radiiPattern[(i / 2) % radiiPattern.length];
        }
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#f0932b'; // Rich golden orange
    ctx.fill();

    // 4. Draw creamy yellow core
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const isOuter = i % 2 === 0;
        let r = (isOuter ? outerR * 0.42 : innerR * 0.6);
        if (isOuter) {
            r *= radiiPattern[(i / 2) % radiiPattern.length];
        }
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#fbc531'; // Bright retro yellow core
    ctx.fill();

    const tex = new THREE.CanvasTexture(cvs);
    tex.minFilter = THREE.NearestFilter; // Crisp pixel art edges
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

// ─── EVENT STRUCT ─────────────────────────────────────────────────────────────
interface Evt {
    alive:      boolean;
    startTime:  number;
    duration:   number;
    spawnX:     number; spawnY: number; spawnZ: number;
    isCrit:     boolean;
    isMagic:    boolean;
    isHeal:     boolean;
    isDebuff:   boolean;
    numChars:   number;
    charIdx:    Uint8Array;
    digitColor: THREE.Color;
    clusterX:   number; clusterY: number; clusterZ: number;
    depthIdx:   number;
    vx:         number;
    vy:         number;
    grav:       number;
}

function makeEvt(): Evt {
    return {
        alive: false, startTime: 0, duration: LIFE_DURATION,
        spawnX:0, spawnY:0, spawnZ:0,
        isCrit:false, isMagic:false, isHeal:false, isDebuff:false,
        numChars:0, charIdx: new Uint8Array(STRIDE),
        digitColor: new THREE.Color('#ffffff'),
        clusterX:0, clusterY:0, clusterZ:0,
        depthIdx:0,
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
    const starMeshRef  = useRef<THREE.InstancedMesh>(null!);
    const { spawnVFX } = useVFX();

    // Pools
    const evts    = useMemo(() => Array.from({ length: MAX_EVENTS }, makeEvt), []);
    const evtPtr  = useRef(0);

    const atlas      = useMemo(() => buildAtlas(), []);
    const digitGeo   = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const starGeo    = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const starTex    = useMemo(() => buildStarTexture(), []);
    const uTime      = useMemo(() => ({ value: 0 }), []);

    // ── DIGIT SHADER ──────────────────────────────────────────────────────────
    const digitMat = useMemo(() => new THREE.ShaderMaterial({
        uniforms: { uAtlas: { value: atlas }, uTime },
        vertexShader: `
            attribute float aCharIdx;
            attribute float aOpacity;
            attribute float aCrit;
            attribute vec3  aCol;
            varying vec2  vUv;
            varying float vOp;
            varying float vCrit;
            varying vec3  vCol;
            void main() {
                float c = mod(aCharIdx, ${ATLAS_COLS}.0);
                float r = floor(aCharIdx / ${ATLAS_COLS}.0);
                vUv  = vec2(
                    (c + uv.x) / ${ATLAS_COLS}.0,
                    1.0 - (r + 1.0 - uv.y) / ${ATLAS_ROWS}.0
                );
                vOp  = aOpacity;
                vCrit = aCrit;
                vCol  = aCol;
                gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D uAtlas;
            uniform float     uTime;
            varying vec2  vUv;
            varying float vOp;
            varying float vCrit;
            varying vec3  vCol;
            void main() {
                vec4 t = texture2D(uAtlas, vUv);
                if (t.a < 0.05) discard;
                vec3 c = t.rgb * vCol;
                if(vCrit > 0.5){
                    float sweep = mod(vUv.x*1.2 + vUv.y*0.4 - uTime*4.0, 2.0);
                    float shine = smoothstep(0.0,0.18,sweep)*smoothstep(0.45,0.18,sweep);
                    float top   = pow(1.0-vUv.y, 4.0)*0.45;
                    c = mix(c, vec3(1.0,0.98,0.75), (shine*0.65+top)*t.a);
                }
                gl_FragColor = vec4(c, t.a * vOp);
            }
        `,
        transparent:true, depthTest:true, depthWrite:false, side:THREE.DoubleSide,
    }), [atlas, uTime]);

    // ── STAR SHADER ───────────────────────────────────────────────────────────
    const starMat = useMemo(() => new THREE.ShaderMaterial({
        uniforms: { uStarTex: { value: starTex } },
        vertexShader: `
            attribute float aOpacity;
            varying float vOp;
            varying vec2  vUv;
            void main(){
                vOp = aOpacity;
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D uStarTex;
            varying float vOp;
            varying vec2  vUv;
            void main(){
                vec4 tex = texture2D(uStarTex, vUv);
                if (tex.a < 0.05) discard;
                gl_FragColor = vec4(tex.rgb, tex.a * vOp);
            }
        `,
        transparent:true, depthTest:true, depthWrite:false, side:THREE.DoubleSide,
    }), [starTex]);

    // Per-instance digit buffers
    const aCharIdx = useMemo(() => new Float32Array(MAX_INST), []);
    const aOpacity = useMemo(() => new Float32Array(MAX_INST), []);
    const aCrit    = useMemo(() => new Float32Array(MAX_INST), []);
    const aCol     = useMemo(() => new Float32Array(MAX_INST * 3), []);

    // Per-instance star buffers (mapped 1-to-1 with events to track movement/scaling)
    const sOpacity = useMemo(() => new Float32Array(MAX_EVENTS), []);

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

    useEffect(() => {
        const dm = digitMeshRef.current;
        if (dm) {
            for (let i = 0; i < MAX_INST; i++) dm.setMatrixAt(i, _hide);
            dm.geometry.setAttribute('aCharIdx', new THREE.InstancedBufferAttribute(aCharIdx, 1));
            dm.geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(aOpacity, 1));
            dm.geometry.setAttribute('aCrit',    new THREE.InstancedBufferAttribute(aCrit,    1));
            dm.geometry.setAttribute('aCol',     new THREE.InstancedBufferAttribute(aCol,     3));
            dm.instanceMatrix.needsUpdate = true;
        }
        const sm = starMeshRef.current;
        if (sm) {
            for (let i = 0; i < MAX_EVENTS; i++) sm.setMatrixAt(i, _hide);
            sm.geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(sOpacity, 1));
            sm.instanceMatrix.needsUpdate = true;
        }
    }, [aCharIdx, aOpacity, aCrit, aCol, sOpacity]);

    useFrame((state) => {
        const now = state.clock.elapsedTime;
        const dm  = digitMeshRef.current;
        const sm  = starMeshRef.current;
        if (!dm || !dm.geometry.attributes.aCharIdx) return;

        uTime.value = now;

        // ── SPAWN ─────────────────────────────────────────────────────────────
        if (damageQueue.current && damageQueue.current.length > 0) {
            if (damageQueue.current.length > 1) {
                damageQueue.current.sort((a, b) => (b.isCrit ? 1 : 0) - (a.isCrit ? 1 : 0));
            }

            while (damageQueue.current.length > 0) {
                const ev = damageQueue.current.shift()!;
                if (!ev.isCrit && damageQueue.current.length > 80) continue;

                const isMiss   = !!ev.isMiss;
                const isCrit   = !isMiss && !!ev.isCrit;
                const isMagic  = !isMiss && (!!ev.isMagic || ev.color === '#00e5ff');
                const isHeal   = !isMiss && !!ev.isHeal;
                const isDebuff = !isMiss && ev.value < 0;

                let totalChars = 0;
                let SW  = isCrit ? 0.85 : 0.72;
                let GAP = isCrit ? 0.60 : 0.48;

                // ── Cluster check ─────────────────────────────────────────────
                const px = ev.position[0], py = ev.position[1], pz = ev.position[2];
                let clusterX = px, clusterY = py, clusterZ = pz;

                for (let ei = 0; ei < MAX_EVENTS; ei++) {
                    const e = evts[ei];
                    if (!e.alive) continue;
                    const dx = e.clusterX - px, dz = e.clusterZ - pz;
                    if (dx*dx + dz*dz < CLUSTER_RADIUS * CLUSTER_RADIUS) {
                        clusterX = e.clusterX;
                        clusterY = e.clusterY;
                        clusterZ = e.clusterZ;
                        e.depthIdx++;
                    }
                }

                const ei  = evtPtr.current;
                evtPtr.current = (evtPtr.current + 1) % MAX_EVENTS;
                const e   = evts[ei];

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
                    // Render "MISS" (M=12, I=13, S=14, S=14)
                    e.charIdx[0] = 12;
                    e.charIdx[1] = 13;
                    e.charIdx[2] = 14;
                    e.charIdx[3] = 14;
                    totalChars = 4;
                    SW = 0.58;
                    GAP = 0.38;
                } else {
                    let val = Math.abs(Math.round(ev.value));
                    let dc  = 0;
                    if (val === 0) { _dbuf[0] = 0; dc = 1; }
                    else { while (val > 0 && dc < 8) { _dbuf[dc++] = val % 10; val = (val / 10) | 0; } }

                    const hasSign = isHeal || isDebuff;
                    totalChars = dc + (hasSign ? 1 : 0);

                    let ci    = 0;
                    if (hasSign) { e.charIdx[ci++] = isHeal ? IDX_PLUS : IDX_MINUS; }
                    for (let d = 0; d < dc; d++) {
                        e.charIdx[ci++] = _dbuf[dc - 1 - d];
                    }
                }

                const totalW = totalChars * GAP;

                // Digit color
                if      (isMiss)   e.digitColor.copy(C_MISS_DIGIT);
                else if (isHeal)   e.digitColor.copy(C_HEAL_DIGIT);
                else if (isDebuff) e.digitColor.copy(C_DEBUFF_DIGIT);
                else if (isCrit)   e.digitColor.copy(C_CRIT_DIGIT);
                else if (isMagic)  e.digitColor.copy(C_MAGIC_DIGIT);
                else               e.digitColor.copy(C_NORMAL_DIGIT);

                const yOff = 2.2;

                e.alive      = true;
                e.startTime  = now;
                e.spawnX     = px; e.spawnY = py + yOff; e.spawnZ = pz;
                e.clusterX   = clusterX; e.clusterY = clusterY; e.clusterZ = clusterZ;
                e.depthIdx   = 0;
                e.isCrit     = isCrit;
                e.isMagic    = isMagic;
                e.isHeal     = isHeal;
                e.isDebuff   = isDebuff;
                e.numChars   = totalChars;

                // Alternate spray direction based on current event index
                const direction = (evtPtr.current % 2 === 0) ? 1 : -1;

                if (isCrit) {
                    // Critical hit: snappy vertical jump, moderate horizontal spray, optimized for high ASPD (7+ hits/sec)
                    e.vx = direction * (2.0 + Math.random() * 2.5) + (Math.random() - 0.5) * 0.8;
                    e.vy = 12.0 + Math.random() * 4.0;
                    e.grav = 32.0;
                    e.duration = 0.45; // faster fade out to prevent screen clutter at high frequencies

                    if (typeof (window as any).cameraShake === 'function') {
                        (window as any).cameraShake(0.18);
                    }
                } else if (isMiss) {
                    // Miss: slides slowly to the side
                    e.vx = direction * (1.2 + Math.random() * 0.8);
                    e.vy = 4.0 + Math.random() * 1.0;
                    e.grav = 14.0;
                    e.duration = 0.55;
                } else if (isHeal) {
                    // Heal: floats straight up, gentle drift
                    e.vx = (Math.random() - 0.5) * 1.5;
                    e.vy = 5.0 + Math.random() * 1.5;
                    e.grav = 10.0;
                    e.duration = 0.60;
                } else {
                    // Normal hit / Magic: spray wide in a fountain
                    e.vx = direction * (3.2 + Math.random() * 2.2) + (Math.random() - 0.5) * 1.0;
                    e.vy = 9.0 + Math.random() * 4.0;
                    e.grav = 34.0;
                    e.duration = 0.35; // clean and fast turnover
                }

                (e as any)._totalW = totalW;
                (e as any)._GAP    = GAP;
                (e as any)._SW     = SW;

                // Spawning Star burst
                if (isCrit && sm) {
                    spawnVFX(ev.position, 'critical-hit', '#ffcc00');
                    spawnVFX(ev.position, 'shockwave',    '#ff4400');
                }
            }
        }

        // ── CAMERA BASIS ──────────────────────────────────────────────────────
        const camQ = state.camera.quaternion;
        _right.set(1,0,0).applyQuaternion(camQ);
        _up.set(0,1,0).applyQuaternion(camQ);
        state.camera.getWorldDirection(_camDir);

        // ── ANIMATE DIGITS & STAR BURSTS ──────────────────────────────────────
        let anyActive = false;

        for (let ei = 0; ei < MAX_EVENTS; ei++) {
            const e    = evts[ei];
            const base = ei * STRIDE;

            if (!e.alive) {
                continue;
            }

            const t  = now - e.startTime;
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

            const di   = e.depthIdx;

            // Snappy pop-in and slow-shrink scale curve animation
            let scaleMultiplier = 1.0;
            if (e.isCrit) {
                if (tn < 0.15) {
                    const ratio = tn / 0.15;
                    const ease = 1.0 - Math.pow(1.0 - ratio, 3); // cubic ease out
                    scaleMultiplier = THREE.MathUtils.lerp(1.45, 1.0, ease);
                } else {
                    scaleMultiplier = THREE.MathUtils.lerp(1.0, 0.6, (tn - 0.15) / 0.85);
                }
            } else {
                if (tn < 0.12) {
                    const ratio = tn / 0.12;
                    const ease = 1.0 - Math.pow(1.0 - ratio, 3); // cubic ease out
                    scaleMultiplier = THREE.MathUtils.lerp(1.25, 1.0, ease);
                } else {
                    scaleMultiplier = THREE.MathUtils.lerp(1.0, 0.7, (tn - 0.12) / 0.88);
                }
            }

            // Size: balanced for Crit, 1.0 for Normal (punchy, readable!)
            const stats = playerStatsRef?.current || {};
            const cRate = stats.c_rate || 0;
            const baseScale = e.isCrit 
                ? Math.min(2.8, 1.7 + (cRate / 100.0) * 0.7) 
                : 1.00;
            const totalScale = baseScale * scaleMultiplier;

            // Physical trajectory offsets
            const offsetX = e.vx * t;
            const offsetY = e.vy * t - 0.5 * e.grav * t * t;

            // Push older hits further away from the camera to layer newer hits on top
            const wx = e.spawnX + _camDir.x * di * 0.18;
            const wy = e.spawnY + _camDir.y * di * 0.18;
            const wz = e.spawnZ + _camDir.z * di * 0.18;

            // Opacity: stays full opacity until 50% life, then fades out in the last 50%
            const opacity = tn > 0.5 ? (1.0 - tn) / 0.5 : 1.0;

            if (opacity < 0.02) continue;

            // Crit jitter on newest digit only (first ~0.10s) — punchier shake
            let jx = 0.0, jy = 0.0;
            if (e.isCrit && di === 0 && t < 0.10) {
                const j = (1.0 - t / 0.10) * 0.25;
                jx = (Math.random() - 0.5) * j;
                jy = (Math.random() - 0.5) * j;
            }

            // ── Animate Star Background (1-to-1 matching this event) ──────────
            if (e.isCrit && sm) {
                // Background star matches totalScale exactly with extra padding (larger multipliers)
                const starBaseScale = totalScale * 1.85;
                const scaleX = starBaseScale * (1.15 + (e.numChars - 1) * 0.35);
                const scaleY = starBaseScale * 1.05;

                // Push background star slightly further away from camera relative to its digits (0.05 units)
                _v3.set(wx + _camDir.x * 0.05, wy + _camDir.y * 0.05, wz + _camDir.z * 0.05)
                   .addScaledVector(_right, offsetX + jx)
                   .addScaledVector(_up,    offsetY + jy);

                _dummy.position.copy(_v3);
                _dummy.quaternion.copy(camQ); // Keep static rotation (comic/RO style, no saw-blade spinning)
                _dummy.scale.set(scaleX, scaleY, 1.0);
                _dummy.updateMatrix();
                sm.setMatrixAt(ei, _dummy.matrix);
                sOpacity[ei] = opacity;
            } else if (sm) {
                sm.setMatrixAt(ei, _hide);
                sOpacity[ei] = 0;
            }

            // ── Digits ────────────────────────────────────────────────────────
            const GAP    = (e as any)._GAP    ?? 0.6;
            const SW     = (e as any)._SW     ?? 0.75;
            const totalW = (e as any)._totalW ?? (e.numChars * GAP);

            // Color: crit flashes white on impact frame
            let baseR: number, baseG: number, baseB: number;
            if (e.isCrit && di === 0 && t < 0.07 && Math.floor(t * 40) % 2 === 0) {
                baseR = 1.0; baseG = 1.0; baseB = 1.0;
            } else {
                baseR = e.digitColor.r; baseG = e.digitColor.g; baseB = e.digitColor.b;
            }

            for (let c = 0; c < e.numChars; c++) {
                const si   = base + c;
                const lx   = (c * GAP) - totalW * 0.5 + GAP * 0.5;

                _v3.set(wx, wy, wz)
                   .addScaledVector(_right, lx * totalScale + offsetX + jx)
                   .addScaledVector(_up,    offsetY + jy);

                _dummy.position.copy(_v3);
                _dummy.quaternion.copy(camQ);
                _dummy.scale.setScalar(totalScale * SW);
                _dummy.updateMatrix();
                dm.setMatrixAt(si, _dummy.matrix);

                aOpacity[si] = opacity;
                aCharIdx[si] = e.charIdx[c];
                aCrit[si]    = (e.isCrit && di === 0) ? 1.0 : 0.0;
                aCol[si*3]   = baseR;
                aCol[si*3+1] = baseG;
                aCol[si*3+2] = baseB;
            }

            // Hide unused digit slots
            for (let c = e.numChars; c < STRIDE; c++) {
                aOpacity[base + c] = 0;
                dm.setMatrixAt(base + c, _hide);
            }
        }

        if (anyActive || hadActive.current) {
            dm.instanceMatrix.needsUpdate = true;
            (dm.geometry.attributes.aCharIdx as THREE.InstancedBufferAttribute).needsUpdate = true;
            (dm.geometry.attributes.aOpacity as THREE.InstancedBufferAttribute).needsUpdate = true;
            (dm.geometry.attributes.aCrit    as THREE.InstancedBufferAttribute).needsUpdate = true;
            (dm.geometry.attributes.aCol     as THREE.InstancedBufferAttribute).needsUpdate = true;

            if (sm) {
                sm.instanceMatrix.needsUpdate = true;
                (sm.geometry.attributes.aOpacity as THREE.InstancedBufferAttribute).needsUpdate = true;
            }
        }
        hadActive.current = anyActive;
    });

    return (
        <>
            {/* Crit star — behind everything, mapped 1-to-1 to each event */}
            <instancedMesh
                ref={starMeshRef}
                args={[starGeo, starMat, MAX_EVENTS]}
                frustumCulled={false}
                renderOrder={997}
            />
            {/* Digit numbers — on top */}
            <instancedMesh
                ref={digitMeshRef}
                args={[digitGeo, digitMat, MAX_INST]}
                frustumCulled={false}
                renderOrder={999}
            />
        </>
    );
}