/**
 * useTerrainBrush.ts — Otak (Logic Hook) untuk fitur Terrain
 *
 * Bertanggung jawab atas:
 *   - Inisialisasi canvas painting dan sculpting
 *   - Load/save paint data & sculpt data
 *   - handlePaint: logika menggambar di canvas (paint) + sculpt Float32Array (sculpt)
 *   - Global event listeners: pointer mouse + shift key
 *   - Komit data ke store saat mouse dilepas
 *
 * Tidak boleh berisi JSX apapun — murni logika.
 */

"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { getTerrainElevation, FULL_MATERIAL_LIBRARY } from "@jagres/shared";
import { useEditorStore } from "@/src/features/world-editor/store/useEditorStore";
import { TerrainMaterial } from "../material/TerrainMaterial";
import {
    SCULPT_RES,
    SCULPT_SPEED,
    TERRAIN_SIZE,
    PAINT_RES,
    BRUSH_WORLD_RADIUS_FACTOR,
    EMPTY_TEXTURE,
} from "../constants/terrain.constants";

// ── Module-level globals (tidak hilang saat hot-reload) ──────────────────────
let globalIsSculptLoaded = false;
const globalSculptHeights = new Float32Array(SCULPT_RES * SCULPT_RES);
export let globalDirtyPaint = false;
export let globalDirtySculpt = false;

export function setGlobalDirtyPaint(v: boolean) {
    globalDirtyPaint = v;
}
export function setGlobalDirtySculpt(v: boolean) {
    globalDirtySculpt = v;
}

// ── Public types ─────────────────────────────────────────────────────────────
export interface TerrainBrushState {
    paintCanvas: HTMLCanvasElement;
    sculptCanvas: HTMLCanvasElement;
    paintTexture: THREE.CanvasTexture;
    sculptHeightsRef: React.MutableRefObject<Float32Array>;
    sculptTrigger: number;
    isSculptLoaded: boolean;
    isDrawingRef: React.MutableRefObject<boolean>;
    mousePressedRef: React.MutableRefObject<boolean>;
    isShiftPressedRef: React.MutableRefObject<boolean>;
    isOverURef: React.MutableRefObject<boolean>;
    meshRef: React.MutableRefObject<THREE.Mesh>;
    handlePaint: (
        uv: THREE.Vector2,
        isShiftPressed?: boolean,
        worldPoint?: THREE.Vector3,
    ) => void;
    handleAutoPaint: () => void;
    textures: any;
    matInfo: any;
    brushInfo: any;
    brushTex: THREE.Texture;
    splatMatInfos: any[];
    ringColor: string;
}

// ── Hook utama ───────────────────────────────────────────────────────────────
export function useTerrainBrush(
    baseDistance: number,
    onSculptLoaded?: () => void,
): TerrainBrushState {
    const {
        terrainConfig,
        terrainMaterialId,
        terrainColor,
        paintMode,
        brushSize,
        setPaintData,
        paintData,
        brushTextureId,
        brushStrength,
        brushRotation,
        brushMaskId,
        terrainMode,
        sculptTool,
        sculptData,
        setSculptData,
        activePaintLayer,
        paintLayerMaterials,
        paintLayerColors,
        flattenTargetHeight,
        sculptMaxHeight,
    } = useEditorStore();

    const matInfo = FULL_MATERIAL_LIBRARY.find(
        (m) => m.id === terrainMaterialId,
    );
    const brushInfo = FULL_MATERIAL_LIBRARY.find(
        (m) => m.id === brushTextureId,
    );

    const brushTex = useTexture(
        brushInfo?.diffuse || EMPTY_TEXTURE,
        (t: any) => {
            if (t instanceof THREE.Texture) {
                t.wrapS = t.wrapT = THREE.RepeatWrapping;
                t.anisotropy = 16;
            }
        },
    );

    // ── Canvas init ──────────────────────────────────────────────────────────
    const [paintCanvas] = useState(() => {
        const c = document.createElement("canvas");
        c.width = PAINT_RES;
        c.height = PAINT_RES;
        const ctx = c.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, PAINT_RES, PAINT_RES);
        }
        return c;
    });

    const [sculptCanvas] = useState(() => {
        const c = document.createElement("canvas");
        c.width = SCULPT_RES;
        c.height = SCULPT_RES;
        const ctx = c.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "#808080";
            ctx.fillRect(0, 0, SCULPT_RES, SCULPT_RES);
        }
        return c;
    });

    const sculptHeightsRef = useRef<Float32Array>(globalSculptHeights);
    const meshRef = useRef<THREE.Mesh>(null!);
    const [sculptTrigger, setSculptTrigger] = useState(0);
    const [isSculptLoaded, setIsSculptLoaded] = useState(globalIsSculptLoaded);
    const isDrawingRef = useRef(false);
    const mousePressedRef = useRef(false);
    const isShiftPressedRef = useRef(false);
    const isOverURef = useRef(false);

    // ── Global pointer + keyboard listeners ─────────────────────────────────
    useEffect(() => {
        const onDown = (e: PointerEvent) => {
            if (e.button === 0) mousePressedRef.current = true;
        };
        const onUp = (e: PointerEvent) => {
            if (e.button === 0) mousePressedRef.current = false;
        };
        const onMove = (e: PointerEvent) => {
            isOverURef.current =
                !!(e.target as HTMLElement).closest(
                    ".world-editor-ui, [data-leva], #leva__root",
                ) ||
                ["BUTTON", "INPUT", "SELECT", "LABEL"].includes(
                    (e.target as HTMLElement).tagName,
                );
        };
        const onKD = (e: KeyboardEvent) => {
            if (e.key === "Shift") isShiftPressedRef.current = true;
        };
        const onKU = (e: KeyboardEvent) => {
            if (e.key === "Shift") isShiftPressedRef.current = false;
        };

        window.addEventListener("pointerdown", onDown);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("keydown", onKD);
        window.addEventListener("keyup", onKU);
        return () => {
            window.removeEventListener("pointerdown", onDown);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("keydown", onKD);
            window.removeEventListener("keyup", onKU);
        };
    }, []);

    // ── Commit saat mouse dilepas (sync Float32 → Canvas → Store) ───────────
    useEffect(() => {
        const onUp = () => {
            if (!isDrawingRef.current) return;
            isDrawingRef.current = false;

            if (terrainMode === "paint") {
                setPaintData(paintCanvas.toDataURL("image/png"));
            } else if (terrainMode === "sculpt") {
                const ctx = sculptCanvas.getContext("2d");
                if (ctx) {
                    const imgData = ctx.createImageData(SCULPT_RES, SCULPT_RES);
                    const heights = sculptHeightsRef.current;
                    for (let i = 0; i < heights.length; i++) {
                        let v = Math.round(
                            (heights[i] / sculptMaxHeight) * 128 + 128,
                        );
                        v = Math.max(0, Math.min(255, v));
                        const p = i * 4;
                        imgData.data[p] =
                            imgData.data[p + 1] =
                            imgData.data[p + 2] =
                                v;
                        imgData.data[p + 3] = 255;
                    }
                    ctx.putImageData(imgData, 0, 0);
                }
                setSculptData(sculptCanvas.toDataURL("image/png"));
                setSculptTrigger((prev) => prev + 1);
            }
        };
        window.addEventListener("pointerup", onUp);
        return () => window.removeEventListener("pointerup", onUp);
    }, [terrainMode, paintCanvas, sculptCanvas, setPaintData, setSculptData, sculptMaxHeight]);

    // ── Canvas texture (painting) ────────────────────────────────────────────
    const paintTexture = useMemo(() => {
        const tex = new THREE.CanvasTexture(paintCanvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.premultiplyAlpha = false; // Prevent GPU from wiping out RGB channels when Alpha is 0
        return tex;
    }, [paintCanvas]);

    // ── Load / Clear paint data ──────────────────────────────────────────────
    useEffect(() => {
        const ctx = paintCanvas.getContext("2d");
        if (!ctx) return;
        if (!paintData) {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, PAINT_RES, PAINT_RES);
            paintTexture.needsUpdate = true;
            return;
        }
        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, PAINT_RES, PAINT_RES);
            ctx.drawImage(img, 0, 0);
            paintTexture.needsUpdate = true;
        };
        img.onerror = () => {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, PAINT_RES, PAINT_RES);
            paintTexture.needsUpdate = true;
        };
        img.src = paintData;
    }, [paintCanvas, paintTexture, paintData]);

    // ── Load / Clear sculpt data ─────────────────────────────────────────────
    useEffect(() => {
        const ctx = sculptCanvas.getContext("2d");
        if (!ctx) return;

        const finalize = () => {
            globalIsSculptLoaded = true;
            setIsSculptLoaded(true);
            onSculptLoaded?.();
        };

        if (!sculptData) {
            ctx.fillStyle = "#808080";
            ctx.fillRect(0, 0, SCULPT_RES, SCULPT_RES);
            sculptHeightsRef.current.fill(0);
            if (typeof window !== "undefined")
                (window as any).sculptHeights = sculptHeightsRef.current;
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Trigger re-render after canvas reset
            setSculptTrigger((p) => p + 1);
            finalize();
            return;
        }

        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, SCULPT_RES, SCULPT_RES);
            ctx.drawImage(img, 0, 0, SCULPT_RES, SCULPT_RES);
            const data = ctx.getImageData(0, 0, SCULPT_RES, SCULPT_RES).data;
            const heights = sculptHeightsRef.current;
            for (let i = 0; i < SCULPT_RES * SCULPT_RES; i++) {
                heights[i] = ((data[i * 4] - 128) / 128) * sculptMaxHeight;
            }
            if (typeof window !== "undefined")
                (window as any).sculptHeights = heights;
            setSculptTrigger((p) => p + 1);
            finalize();
        };
        img.onerror = () => {
            console.warn(
                "[useTerrainBrush] Failed to load sculptData, fallback to flat.",
            );
            ctx.fillStyle = "#808080";
            ctx.fillRect(0, 0, SCULPT_RES, SCULPT_RES);
            sculptHeightsRef.current.fill(0);
            setSculptTrigger((p) => p + 1);
            finalize();
        };
        img.src = sculptData;
    }, [sculptCanvas, sculptData, onSculptLoaded, sculptMaxHeight]);

    // ── handlePaint: logika menggambar di canvas (paint) + sculpt Float32 ────
    const handlePaint = useCallback(
        (
            uv: THREE.Vector2,
            isShiftPressed = false,
            worldPoint?: THREE.Vector3,
        ) => {
            if (!paintMode) return;

            if (terrainMode === "paint") {
                const ctx = paintCanvas.getContext("2d");
                if (!ctx) return;
                const x = uv.x * PAINT_RES;
                const y = (1 - uv.y) * PAINT_RES;

                const tmp = document.createElement("canvas");
                tmp.width = tmp.height = PAINT_RES;
                const tc = tmp.getContext("2d")!;
                tc.save();
                tc.clearRect(0, 0, PAINT_RES, PAINT_RES);
                tc.translate(x, y);
                tc.rotate((brushRotation * Math.PI) / 180);
                tc.globalAlpha = brushStrength;
                tc.fillStyle = tc.strokeStyle = "#ffffff";

                switch (brushMaskId) {
                    case "softCircle": {
                        const g = tc.createRadialGradient(
                            0,
                            0,
                            0,
                            0,
                            0,
                            brushSize,
                        );
                        g.addColorStop(0, "#ffffff");
                        g.addColorStop(1, "transparent");
                        tc.fillStyle = g;
                        tc.beginPath();
                        tc.arc(0, 0, brushSize, 0, Math.PI * 2);
                        tc.fill();
                        break;
                    }
                    case "hardCircle":
                        tc.beginPath();
                        tc.arc(0, 0, brushSize, 0, Math.PI * 2);
                        tc.fill();
                        break;
                    case "star": {
                        const spikes = 8;
                        const OR = brushSize,
                            IR = brushSize * 0.4;
                        let r = -Math.PI / 2;
                        const step = Math.PI / spikes;
                        tc.beginPath();
                        tc.moveTo(0, -OR);
                        for (let i = 0; i < spikes; i++) {
                            tc.lineTo(Math.cos(r) * OR, Math.sin(r) * OR);
                            r += step;
                            tc.lineTo(Math.cos(r) * IR, Math.sin(r) * IR);
                            r += step;
                        }
                        tc.closePath();
                        tc.fill();
                        break;
                    }
                    case "hexagon": {
                        tc.beginPath();
                        for (let i = 0; i < 6; i++) {
                            const a = (Math.PI / 3) * i;
                            if (i === 0)
                                tc.moveTo(
                                    Math.cos(a) * brushSize,
                                    Math.sin(a) * brushSize,
                                );
                            else
                                tc.lineTo(
                                    Math.cos(a) * brushSize,
                                    Math.sin(a) * brushSize,
                                );
                        }
                        tc.closePath();
                        tc.fill();
                        break;
                    }
                    case "starOutline":
                        tc.lineWidth = brushSize * 0.3;
                        tc.beginPath();
                        tc.arc(0, 0, brushSize * 0.7, 0, Math.PI * 2);
                        tc.stroke();
                        break;
                    case "square":
                        tc.fillRect(
                            -brushSize,
                            -brushSize,
                            brushSize * 2,
                            brushSize * 2,
                        );
                        break;
                    case "triangle":
                        tc.beginPath();
                        tc.moveTo(0, -brushSize);
                        tc.lineTo(brushSize * 0.866, brushSize * 0.5);
                        tc.lineTo(-brushSize * 0.866, brushSize * 0.5);
                        tc.closePath();
                        tc.fill();
                        break;
                }
                tc.restore();

                const bx = Math.max(0, Math.floor(x - brushSize - 2));
                const by = Math.max(0, Math.floor(y - brushSize - 2));
                const bw = Math.min(
                    PAINT_RES - bx,
                    Math.ceil(brushSize * 2 + 4),
                );
                const bh = Math.min(
                    PAINT_RES - by,
                    Math.ceil(brushSize * 2 + 4),
                );
                if (bw > 0 && bh > 0) {
                    const dest = ctx.getImageData(bx, by, bw, bh);
                    const mask = tc.getImageData(bx, by, bw, bh);
                    for (let i = 0; i < dest.data.length; i += 4) {
                        const a = mask.data[i + 3];
                        if (a === 0) continue;

                        const factor = a / 255;

                        if (activePaintLayer === 0) {
                            // Paint Layer 0 (Grass): We fade out R, G, B channels
                            dest.data[i + 0] = Math.round(
                                dest.data[i + 0] * (1 - factor),
                            );
                            dest.data[i + 1] = Math.round(
                                dest.data[i + 1] * (1 - factor),
                            );
                            dest.data[i + 2] = Math.round(
                                dest.data[i + 2] * (1 - factor),
                            );
                            // Restore alpha to 255 to fill holes
                            dest.data[i + 3] = Math.min(255, Math.round(dest.data[i + 3] + 255 * factor));
                        } else if (activePaintLayer === 4) {
                            // Paint Layer 4 (Hole): We reduce alpha to 0 to discard pixels in shader
                            dest.data[i + 3] = Math.max(0, Math.round(dest.data[i + 3] - 255 * factor));
                        } else {
                            // Paint Layer 1, 2, or 3: mapped to R, G, B channels respectively (chIdx = activePaintLayer - 1)
                            const chIdx = activePaintLayer - 1;

                            const oldVal = dest.data[i + chIdx];
                            const newVal = Math.round(
                                oldVal * (1 - factor) + 255 * factor,
                            );
                            dest.data[i + chIdx] = newVal;

                            const diff = newVal - oldVal;
                            if (diff > 0) {
                                let otherSum = 0;
                                for (let c = 0; c < 3; c++) {
                                    if (c !== chIdx)
                                        otherSum += dest.data[i + c];
                                }

                                if (otherSum > 0) {
                                    let distributed = 0;
                                    for (let c = 0; c < 3; c++) {
                                        if (c !== chIdx) {
                                            const ratio =
                                                dest.data[i + c] / otherSum;
                                            const deduction = Math.round(
                                                diff * ratio,
                                            );
                                            dest.data[i + c] = Math.max(
                                                0,
                                                dest.data[i + c] - deduction,
                                            );
                                            distributed += deduction;
                                        }
                                    }
                                    const error = diff - distributed;
                                    if (error !== 0) {
                                        for (let c = 0; c < 3; c++) {
                                            if (
                                                c !== chIdx &&
                                                dest.data[i + c] > 0
                                            ) {
                                                dest.data[i + c] = Math.max(
                                                    0,
                                                    dest.data[i + c] - error,
                                                );
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            // Restore alpha to 255 to fill holes
                            dest.data[i + 3] = Math.min(255, Math.round(dest.data[i + 3] + 255 * factor));
                        }
                    }
                    ctx.putImageData(dest, bx, by);
                }
                globalDirtyPaint = true;
            } else if (terrainMode === "sculpt") {
                const heights = sculptHeightsRef.current;
                const geo = meshRef.current?.geometry as THREE.BufferGeometry;
                if (!geo) return;

                const pos = geo.attributes.position;
                // Sumbu local vy = -worldZ karena mesh terotasi -90° pada sumbu X
                const bX = worldPoint
                    ? worldPoint.x
                    : (uv.x - 0.5) * TERRAIN_SIZE;
                const bZ = worldPoint
                    ? -worldPoint.z
                    : (uv.y - 0.5) * TERRAIN_SIZE;
                const radius = brushSize * BRUSH_WORLD_RADIUS_FACTOR;
                const radiusSq = radius * radius;
                let touched = false;

                // Optimization: Loop only over columns & rows that fall inside the brush bounding box
                const segs = Math.round(Math.sqrt(pos.count)) - 1;
                const minCol = Math.max(0, Math.floor(((bX - radius + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * segs));
                const maxCol = Math.min(segs, Math.ceil(((bX + radius + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * segs));
                const minRow = Math.max(0, Math.floor(((TERRAIN_SIZE / 2 - (bZ + radius)) / TERRAIN_SIZE) * segs));
                const maxRow = Math.min(segs, Math.ceil(((TERRAIN_SIZE / 2 - (bZ - radius)) / TERRAIN_SIZE) * segs));

                for (let r = minRow; r <= maxRow; r++) {
                    for (let c = minCol; c <= maxCol; c++) {
                        const i = r * (segs + 1) + c;
                        const vx = pos.getX(i);
                        const vy = pos.getY(i);
                        const dx = vx - bX,
                            dz = vy - bZ;
                        const dSq = dx * dx + dz * dz;
                        if (dSq > radiusSq) continue;

                        const falloff = Math.pow(1 - Math.sqrt(dSq) / radius, 3);
                        const u = (vx + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
                        const v = (vy + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
                        const px = Math.max(
                            0,
                            Math.min(
                                SCULPT_RES - 1,
                                Math.round(u * (SCULPT_RES - 1)),
                            ),
                        );
                        const py = Math.max(
                            0,
                            Math.min(
                                SCULPT_RES - 1,
                                Math.round((1 - v) * (SCULPT_RES - 1)),
                            ),
                        );
                        const idx = py * SCULPT_RES + px;

                        let h = heights[idx] || 0;
                        const str = brushStrength * SCULPT_SPEED * falloff;

                        if (sculptTool === "raise")
                            h += isShiftPressed ? -str : str;
                        else if (sculptTool === "lower")
                            h -= isShiftPressed ? -str : str;
                        else if (sculptTool === "flatten")
                            h +=
                                (flattenTargetHeight - h) *
                                (brushStrength * falloff * 0.1);
                        else if (sculptTool === "smooth") {
                            // Smooth the total height (base noise + sculpt offset) rather than just the sculpt offset h in isolation.
                            // This prevents the smoothed terrain from collapsing/denting inwards.
                            const brushPixelRadius = Math.max(2, Math.round((radius / TERRAIN_SIZE) * SCULPT_RES));
                            const kernelRadius = Math.min(8, brushPixelRadius);
                            
                            const getElevationWithSculptAtPixel = (pxCoords: number, pyCoords: number) => {
                                const uCoords = pxCoords / (SCULPT_RES - 1);
                                const vCoords = 1 - pyCoords / (SCULPT_RES - 1);
                                const wxCoords = (uCoords - 0.5) * TERRAIN_SIZE;
                                const wzCoords = (vCoords - 0.5) * TERRAIN_SIZE;
                                const base = getTerrainElevation(wxCoords, wzCoords, "STORM", baseDistance, terrainConfig, true);
                                const offset = heights[pyCoords * SCULPT_RES + pxCoords] || 0;
                                return base + offset;
                            };

                            const baseH = getTerrainElevation(vx, vy, "STORM", baseDistance, terrainConfig, true);
                            const currentTotalH = baseH + h;

                            let sum = 0;
                            let weightSum = 0;
                            for (let nx = -kernelRadius; nx <= kernelRadius; nx++) {
                                for (let ny = -kernelRadius; ny <= kernelRadius; ny++) {
                                    const distSq = nx * nx + ny * ny;
                                    if (distSq > kernelRadius * kernelRadius) continue;
                                    
                                    const npx = px + nx;
                                    const npy = py + ny;
                                    if (npx >= 0 && npx < SCULPT_RES && npy >= 0 && npy < SCULPT_RES) {
                                        const sigma = kernelRadius / 2;
                                        const weight = Math.exp(-distSq / (2 * sigma * sigma));
                                        
                                        const neighborTotalH = getElevationWithSculptAtPixel(npx, npy);
                                        sum += neighborTotalH * weight;
                                        weightSum += weight;
                                    }
                                }
                            }
                            const avgTotalH = weightSum > 0 ? sum / weightSum : currentTotalH;
                            const newTotalH = currentTotalH + (avgTotalH - currentTotalH) * (brushStrength * falloff * 0.5);
                            h = newTotalH - baseH;
                        }

                        h = Math.max(-sculptMaxHeight, Math.min(sculptMaxHeight, h));
                        heights[idx] = h;
                        pos.setZ(
                            i,
                            getTerrainElevation(
                                vx,
                                vy,
                                "STORM",
                                baseDistance,
                                terrainConfig,
                                true,
                            ) + h,
                        );
                        touched = true;
                    }
                }

                pos.needsUpdate = true;
                if (typeof window !== "undefined")
                    (window as any).sculptHeights = sculptHeightsRef.current;
                if (touched) globalDirtySculpt = true;
            }
        },
        [
            paintMode,
            terrainMode,
            sculptTool,
            brushSize,
            brushStrength,
            brushRotation,
            brushMaskId,
            paintCanvas,
            baseDistance,
            terrainConfig,
            activePaintLayer,
            flattenTargetHeight,
            sculptMaxHeight,
        ],
    );

    // ── Auto Paint Splat Mask function (Heights & Slopes based) ───────────────
    const handleAutoPaint = useCallback(() => {
        const ctx = paintCanvas.getContext("2d");
        if (!ctx) return;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 512;
        tempCanvas.height = 512;
        const tCtx = tempCanvas.getContext("2d");
        if (!tCtx) return;

        const imgData = tCtx.createImageData(512, 512);
        const heights = sculptHeightsRef.current;

        const getElevationWithSculpt = (wx: number, wz: number) => {
            const base = getTerrainElevation(wx, wz, "STORM", baseDistance, terrainConfig, true);
            const su = (wx + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
            const sv = (wz + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
            const spx = Math.max(0, Math.min(SCULPT_RES - 1, Math.round(su * (SCULPT_RES - 1))));
            const spy = Math.max(0, Math.min(SCULPT_RES - 1, Math.round((1 - sv) * (SCULPT_RES - 1))));
            const sh = heights[spy * SCULPT_RES + spx] || 0;
            return base + sh;
        };

        const RES = 512;
        const eps = 2.0;

        for (let py = 0; py < RES; py++) {
            for (let px = 0; px < RES; px++) {
                const u = px / (RES - 1);
                const v = 1 - py / (RES - 1);
                const wx = (u - 0.5) * TERRAIN_SIZE;
                const wz = (v - 0.5) * TERRAIN_SIZE;

                const totalHeight = getElevationWithSculpt(wx, wz);

                // Normal/Slope estimation
                const hL = getElevationWithSculpt(wx - eps, wz);
                const hR = getElevationWithSculpt(wx + eps, wz);
                const hD = getElevationWithSculpt(wx, wz - eps);
                const hU = getElevationWithSculpt(wx, wz + eps);
                const nx = -(hR - hL) / (2 * eps);
                const nz = -(hU - hD) / (2 * eps);
                const ny = 1.0;
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                const slopeDegrees = Math.acos(ny / len) * (180 / Math.PI);

                // Blending factors
                const stoneFactor = Math.min(1.0, Math.max(0.0, (slopeDegrees - 22) / 12)); // 22° to 34°
                const snowFactor = Math.min(1.0, Math.max(0.0, (totalHeight - 20) / 15)) * (1.0 - stoneFactor);
                const sandFactor = Math.min(1.0, Math.max(0.0, (2.0 - totalHeight) / 2.5)) * (1.0 - stoneFactor);

                const idx = (py * RES + px) * 4;
                imgData.data[idx] = Math.round(stoneFactor * 255); // R -> Layer 1 (Stone)
                imgData.data[idx + 1] = Math.round(sandFactor * 255); // G -> Layer 2 (Sand)
                imgData.data[idx + 2] = Math.round(snowFactor * 255); // B -> Layer 3 (Snow)
                imgData.data[idx + 3] = 255;
            }
        }

        tCtx.putImageData(imgData, 0, 0);
        ctx.clearRect(0, 0, PAINT_RES, PAINT_RES);
        ctx.drawImage(tempCanvas, 0, 0, PAINT_RES, PAINT_RES);

        paintTexture.needsUpdate = true;
        setPaintData(paintCanvas.toDataURL("image/png"));
    }, [paintCanvas, sculptHeightsRef, baseDistance, terrainConfig, paintTexture, setPaintData]);

    // ── Texture loading untuk splat layers ───────────────────────────────────
    const splatMatInfos = useMemo(
        () => [
            FULL_MATERIAL_LIBRARY.find((m) => m.id === paintLayerMaterials[0]),
            FULL_MATERIAL_LIBRARY.find((m) => m.id === paintLayerMaterials[1]),
            FULL_MATERIAL_LIBRARY.find((m) => m.id === paintLayerMaterials[2]),
            FULL_MATERIAL_LIBRARY.find((m) => m.id === paintLayerMaterials[3]),
        ],
        [paintLayerMaterials],
    );

    const texturePaths = useMemo(() => {
        const p: Record<string, string> = {
            map: matInfo?.diffuse || EMPTY_TEXTURE,
        };
        if (matInfo?.normal) p.normalMap = matInfo.normal;
        if (matInfo?.roughness) p.roughnessMap = matInfo.roughness;
        if (matInfo?.displacement) p.displacementMap = matInfo.displacement;
        if (splatMatInfos[0]?.diffuse) p.splat0 = splatMatInfos[0].diffuse;
        if (splatMatInfos[1]?.diffuse) p.splat1 = splatMatInfos[1].diffuse;
        if (splatMatInfos[2]?.diffuse) p.splat2 = splatMatInfos[2].diffuse;
        if (splatMatInfos[3]?.diffuse) p.splat3 = splatMatInfos[3].diffuse;
        return p;
    }, [matInfo, splatMatInfos]);

    const textures = useTexture(texturePaths as any, (tex: any) => {
        const apply = (t: THREE.Texture) => {
            if (!t) return;
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(30, 30);
            t.anisotropy = 16;
        };
        if (tex instanceof THREE.Texture) apply(tex);
        else if (tex && typeof tex === "object")
            Object.values(tex).forEach((t: any) => {
                if (t instanceof THREE.Texture) apply(t);
            });
    });

    // ── Sync uniforms saat texture / warna berubah ───────────────────────────
    useEffect(() => {
        const tex = textures as any;
        if (!TerrainMaterial.uniforms) return;

        TerrainMaterial.uniforms.uMap.value = tex?.map || null;
        TerrainMaterial.uniforms.uUseMap.value =
            tex?.map && matInfo ? 1.0 : 0.0;
        TerrainMaterial.uniforms.baseColor.value?.set(terrainColor);
        TerrainMaterial.uniforms.uPaintMap.value = paintTexture;
        TerrainMaterial.uniforms.uUsePaint.value = 1.0;

        TerrainMaterial.uniforms.uSplatCol0.value?.set(paintLayerColors[0]);
        TerrainMaterial.uniforms.uSplatCol1.value?.set(paintLayerColors[1]);
        TerrainMaterial.uniforms.uSplatCol2.value?.set(paintLayerColors[2]);
        TerrainMaterial.uniforms.uSplatCol3.value?.set(paintLayerColors[3]);

        const splatSlots = ["splat0", "splat1", "splat2", "splat3"] as const;
        splatSlots.forEach((k, i) => {
            const n = i as 0 | 1 | 2 | 3;
            TerrainMaterial.uniforms[`uSplatTex${n}`].value = tex?.[k] || null;
            TerrainMaterial.uniforms[`uUseSplat${n}`].value = tex?.[k]
                ? 1.0
                : 0.0;
        });

        TerrainMaterial.uniforms.uBrushTex.value = brushTex;
        TerrainMaterial.uniforms.uUseBrushTex.value = brushInfo ? 1.0 : 0.0;
        TerrainMaterial.needsUpdate = true;
    }, [
        textures,
        matInfo,
        terrainColor,
        paintTexture,
        brushTex,
        brushInfo,
        paintLayerColors,
        splatMatInfos,
    ]);

    // ── Ring color sesuai mode/tool aktif ────────────────────────────────────
    const ringColor = useMemo(() => {
        if (terrainMode === "paint") return "#6366f1";
        switch (sculptTool) {
            case "raise":
                return "#10b981";
            case "lower":
                return "#f43f5e";
            case "smooth":
                return "#0ea5e9";
            case "flatten":
                return "#f59e0b";
            default:
                return "#6366f1";
        }
    }, [terrainMode, sculptTool]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            (window as any).handleAutoPaint = handleAutoPaint;
        }
        return () => {
            if (typeof window !== "undefined") {
                delete (window as any).handleAutoPaint;
            }
        };
    }, [handleAutoPaint]);

    return {
        paintCanvas,
        sculptCanvas,
        paintTexture,
        sculptHeightsRef,
        sculptTrigger,
        isSculptLoaded,
        isDrawingRef,
        mousePressedRef,
        isShiftPressedRef,
        isOverURef,
        meshRef,
        handlePaint,
        handleAutoPaint,
        textures,
        matInfo,
        brushInfo,
        brushTex,
        splatMatInfos,
        ringColor,
    };
}
