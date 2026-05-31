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
const MAX_EVENTS = 24;
const STRIDE     = 9;
const MAX_INST   = MAX_EVENTS * STRIDE;

const ATLAS_COLS = 6;
const ATLAS_ROWS = 2;

// Perspective stack tuning
const DEPTH_SCALE    = 0.82;  // each depth level shrinks to this fraction
const DEPTH_Y        = 0.55;  // world units upward per depth level
const CLUSTER_RADIUS = 1.8;   // world units: hits within this radius join one cluster
const LIFE_DURATION  = 1.6;   // seconds

// ─── ZERO-ALLOC HELPERS ──────────────────────────────────────────────────────
const _dummy = new THREE.Object3D();
const _v3    = new THREE.Vector3();
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

const IDX_PLUS  = 10;
const IDX_MINUS = 11;

// ─── ATLAS (digits only, white fill, thick black outline, Press Start 2P) ────
function buildAtlas(): THREE.CanvasTexture {
    const S   = 128;
    const cvs = document.createElement('canvas');
    cvs.width  = S * ATLAS_COLS;
    cvs.height = S * ATLAS_ROWS;
    const ctx  = cvs.getContext('2d')!;

    const chars = ['0','1','2','3','4','5','6','7','8','9','+','-'];
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
    };
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export function DamageHUDBatcher({ damageQueue }: { damageQueue: React.RefObject<any[]> }) {
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
        transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide,
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
        transparent:true, depthTest:false, depthWrite:false, side:THREE.DoubleSide,
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
            damageQueue.current.sort((a, b) => (b.isCrit ? 1 : 0) - (a.isCrit ? 1 : 0));

            while (damageQueue.current.length > 0) {
                const ev = damageQueue.current.shift()!;
                if (!ev.isCrit && damageQueue.current.length > 20) continue;

                const isCrit   = !!ev.isCrit;
                const isMagic  = !!ev.isMagic || ev.color === '#00e5ff';
                const isHeal   = !!ev.isHeal;
                const isDebuff = ev.value < 0;

                let val = Math.abs(Math.round(ev.value));
                let dc  = 0;
                if (val === 0) { _dbuf[0] = 0; dc = 1; }
                else { while (val > 0 && dc < 8) { _dbuf[dc++] = val % 10; val = (val / 10) | 0; } }

                const hasSign    = isHeal || isDebuff;
                const totalChars = dc + (hasSign ? 1 : 0);

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

                // Spacing configurations
                const SW  = isCrit ? 0.9 : 0.75;
                const GAP = isCrit ? 0.75 : 0.6;
                let ci    = 0;
                if (hasSign) { e.charIdx[ci++] = isHeal ? IDX_PLUS : IDX_MINUS; }
                for (let d = 0; d < dc; d++) {
                    e.charIdx[ci++] = _dbuf[dc - 1 - d];
                }
                const totalW = totalChars * GAP;

                // Digit color
                if      (isHeal)   e.digitColor.copy(C_HEAL_DIGIT);
                else if (isDebuff) e.digitColor.copy(C_DEBUFF_DIGIT);
                else if (isCrit)   e.digitColor.copy(C_CRIT_DIGIT);
                else if (isMagic)  e.digitColor.copy(C_MAGIC_DIGIT);
                else               e.digitColor.copy(C_NORMAL_DIGIT);

                const yOff = 2.2;

                e.alive      = true;
                e.startTime  = now;
                e.duration   = LIFE_DURATION;
                e.spawnX     = px; e.spawnY = py + yOff; e.spawnZ = pz;
                e.clusterX   = clusterX; e.clusterY = clusterY; e.clusterZ = clusterZ;
                e.depthIdx   = 0;
                e.isCrit     = isCrit;
                e.isMagic    = isMagic;
                e.isHeal     = isHeal;
                e.isDebuff   = isDebuff;
                e.numChars   = totalChars;

                (e as any)._totalW = totalW;
                (e as any)._GAP    = GAP;
                (e as any)._SW     = SW;

                // Spawning Star burst
                if (isCrit && sm) {
                    spawnVFX(ev.position, 'critical-hit', '#ffcc00');
                    spawnVFX(ev.position, 'shockwave',    '#ff4400');
                }

                break;
            }
        }

        // ── CAMERA BASIS ──────────────────────────────────────────────────────
        const camQ = state.camera.quaternion;
        _right.set(1,0,0).applyQuaternion(camQ);
        _up.set(0,1,0).applyQuaternion(camQ);

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
            const dsc  = Math.pow(DEPTH_SCALE, di); 
            const dyUp = di * DEPTH_Y;               

            // Front pop-in animation (only depthIdx=0, only first ~0.12s)
            let popExtra = 0.0;
            if (di === 0 && t < 0.12) {
                popExtra = t < 0.06
                    ? (1.0 - t / 0.06) * (e.isCrit ? 0.4 : 0.2)
                    : 0.0;
            }

            // Ideal retro size: 2.4 for Crit, 1.25 for Normal (punchy crits!)
            const baseScale = e.isCrit ? 2.4 : 1.25;
            const totalScale = (baseScale + popExtra) * dsc;

            const yFloat = di === 0 ? t * 0.4 : 0.0;

            // World position
            const wx = e.spawnX;
            const wy = e.spawnY + dyUp + yFloat;
            const wz = e.spawnZ;

            const depthFade  = Math.pow(0.80, di);
            const lifeFade   = tn < 0.06 && di === 0 ? tn / 0.06
                             : tn > 0.65 ? 1.0 - (tn - 0.65) / 0.35
                             : 1.0;
            const opacity    = lifeFade * depthFade;

            if (opacity < 0.02) continue;

            // Crit jitter on newest digit only (first ~0.15s)
            let jx = 0.0, jy = 0.0;
            if (e.isCrit && di === 0 && t < 0.15) {
                const j = (1.0 - t / 0.15) * 0.12;
                jx = (Math.random() - 0.5) * j;
                jy = (Math.random() - 0.5) * j;
            }

            // ── Animate Star Background (1-to-1 matching this event) ──────────
            if (e.isCrit && sm) {
                let starSc;
                if      (t < 0.04) starSc = t/0.04 * 3.2;
                else if (t < 0.10) starSc = 3.2 - (t-0.04)/0.06 * 0.8;
                else if (t < 0.22) starSc = 2.4 + (t-0.10)/0.12 * 0.3;
                else               starSc = 2.7 - (tn-0.22/0.75)/(0.78) * 0.6;
                starSc = Math.max(starSc, 1.4);

                _v3.set(wx, wy, wz)
                   .addScaledVector(_right, jx)
                   .addScaledVector(_up,    jy);

                const sc = totalScale * starSc;
                const starOp = opacity * (tn > 0.65 ? (1.0 - (tn - 0.65) / 0.35) : 1.0);

                _dummy.position.copy(_v3);
                _dummy.quaternion.copy(camQ); // Keep static rotation (comic/RO style, no saw-blade spinning)
                _dummy.scale.setScalar(sc);
                _dummy.updateMatrix();
                sm.setMatrixAt(ei, _dummy.matrix);
                sOpacity[ei] = starOp;
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
                   .addScaledVector(_right, lx * totalScale + jx)
                   .addScaledVector(_up,    jy);

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