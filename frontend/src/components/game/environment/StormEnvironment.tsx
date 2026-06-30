/**
 * StormEnvironment — Open World Edition (Physics Stabilized)
 */

import { Component, ReactNode, useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, useTexture, Sky } from "@react-three/drei";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { StaticCollider, characterStatus } from "bvhecctrl";

import * as THREE from "three";
import { useStore } from "@/src/state/useStore";
import { useEditorStore } from "@/src/state/useEditorStore";
import { useVFX } from "../systems/VFXManager";
import { registerCollider, unregisterCollider } from "@/src/core/utils/globalRaycaster";
import { getTerrainElevation, FULL_MATERIAL_LIBRARY, PainterlyShaderUtils, PainterlyWaterMaterial, API_BASE_URL } from '@jagres/shared';

// Add BVH support to THREE with any cast to avoid lint errors
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

const TerrainMaterial = new THREE.MeshStandardMaterial({
  roughness: 0.85,
  metalness: 0.15,
}) as any;

TerrainMaterial.uniforms = {
  baseColor: { value: new THREE.Color("#3d5c36") },
  peakColor: { value: new THREE.Color("#95b58b") },
  rockColor: { value: new THREE.Color("#5a5e52") },
  uMap: { value: null },
  uUseMap: { value: 0.0 },
  // Multi-layer Splat: 4 RGBA channels → 4 material textures
  uPaintMap: { value: null }, // RGBA splat control map
  uUsePaint: { value: 0.0 },
  uSplatTex0: { value: null }, // Layer 0 texture (grass)
  uSplatTex1: { value: null }, // Layer 1 texture (rock)
  uSplatTex2: { value: null }, // Layer 2 texture (dirt)
  uSplatTex3: { value: null }, // Layer 3 texture (snow/path)
  uSplatCol0: { value: new THREE.Color('#3d5c36') },
  uSplatCol1: { value: new THREE.Color('#7c6a4a') },
  uSplatCol2: { value: new THREE.Color('#5a4d3a') },
  uSplatCol3: { value: new THREE.Color('#e8e0d0') },
  uUseSplat0: { value: 0.0 },
  uUseSplat1: { value: 0.0 },
  uUseSplat2: { value: 0.0 },
  uUseSplat3: { value: 0.0 },
  // Legacy brush texture (kept for blueprint compatibility)
  uBrushTex: { value: null },
  uUseBrushTex: { value: 0.0 },
};

TerrainMaterial.onBeforeCompile = (shader: any) => {
  Object.assign(shader.uniforms, TerrainMaterial.uniforms);

  shader.vertexShader = `
    varying float vElevation;
    varying vec2 vTerrainUv;
    ${shader.vertexShader}
  `.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    vTerrainUv = uv;
    vElevation = position.z;
    `
  );

  shader.fragmentShader = `
    varying float vElevation;
    varying vec2 vTerrainUv;
    uniform vec3 baseColor;
    uniform vec3 peakColor;
    uniform vec3 rockColor;
    uniform sampler2D uMap;
    uniform float uUseMap;
    // Splat map (RGBA channels = 4 layers)
    uniform sampler2D uPaintMap;
    uniform float uUsePaint;
    uniform sampler2D uSplatTex0;
    uniform sampler2D uSplatTex1;
    uniform sampler2D uSplatTex2;
    uniform sampler2D uSplatTex3;
    uniform vec3 uSplatCol0;
    uniform vec3 uSplatCol1;
    uniform vec3 uSplatCol2;
    uniform vec3 uSplatCol3;
    uniform float uUseSplat0;
    uniform float uUseSplat1;
    uniform float uUseSplat2;
    uniform float uUseSplat3;
    uniform sampler2D uBrushTex;
    uniform float uUseBrushTex;
    
    ${PainterlyShaderUtils.brushstrokeNoise}
    ${PainterlyShaderUtils.toonMix}
    ${shader.fragmentShader}
  `.replace(
    'vec4 diffuseColor = vec4( diffuse, opacity );',
    `
    float strokes = brushstrokes(vTerrainUv * 80.0, 0.35);
    float t = smoothstep(0.0, 35.0, vElevation) + strokes * 0.08;
    vec3 mountainColor = toonMix(baseColor, peakColor, t * 1.5);

    float rockMask = smoothstep(22.0, 35.0, vElevation);
    mountainColor = mix(mountainColor, rockColor, rockMask * 0.6);

    // Base texture on floor area (0–15m elevation)
    vec3 floorTex = texture2D(uMap, vTerrainUv * 30.0).rgb;
    float floorMask = smoothstep(12.0, 5.0, vElevation);
    vec3 finalColor = mix(mountainColor, floorTex, floorMask * uUseMap);

    // ─── MULTI-LAYER SPLAT PAINT ───
    // Each RGBA channel in uPaintMap controls one material layer
    vec4 splat = texture2D(uPaintMap, vTerrainUv);

    // Layer 0 (R channel): grass / base color
    vec3 splatBase0 = uUseSplat0 > 0.5
      ? texture2D(uSplatTex0, vTerrainUv * 30.0).rgb
      : uSplatCol0;
    finalColor = mix(finalColor, splatBase0, splat.r * uUsePaint);

    // Layer 1 (G channel): rock / stone
    vec3 splatBase1 = uUseSplat1 > 0.5
      ? texture2D(uSplatTex1, vTerrainUv * 30.0).rgb
      : uSplatCol1;
    finalColor = mix(finalColor, splatBase1, splat.g * uUsePaint);

    // Layer 2 (B channel): dirt / sand
    vec3 splatBase2 = uUseSplat2 > 0.5
      ? texture2D(uSplatTex2, vTerrainUv * 30.0).rgb
      : uSplatCol2;
    finalColor = mix(finalColor, splatBase2, splat.b * uUsePaint);

    // Layer 3 (A channel): snow / path overlay
    vec3 splatBase3 = uUseSplat3 > 0.5
      ? texture2D(uSplatTex3, vTerrainUv * 30.0).rgb
      : uSplatCol3;
    finalColor = mix(finalColor, splatBase3, splat.a * uUsePaint);

    // Road / path subtle lane (cosmetic)
    float road = smoothstep(6.0, 3.0, abs(vTerrainUv.x - 0.5) * 150.0);
    finalColor = mix(finalColor, vec3(0.5, 0.45, 0.4), road * 0.4 * floorMask);

    vec4 diffuseColor = vec4( finalColor, opacity );
    `
  );
};

let globalIsSculptLoaded = false;
const SCULPT_RES = 512; // Upgraded from 256 for smoother hills
const globalSculptHeights = new Float32Array(SCULPT_RES * SCULPT_RES);

const TERRAIN_SIZE = 1500;
const GROUND_Y = -0.3;
const EMPTY_TEXTURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

// Module-level dirty flags to ensure they are never lost in hot-reloads or closures
let globalDirtyPaint = false;
let globalDirtySculpt = false;

const Terrain = ({ baseDistance, potatoMode, debug, onReady, onSculptLoaded }: {
  baseDistance: number;
  potatoMode?: boolean;
  debug?: boolean;
  onReady?: () => void;
  onSculptLoaded?: () => void;
}) => {
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
    brushHoverPos,
    isEditorOpen,
    // Multi-layer splat
    activePaintLayer,
    paintLayerMaterials,
    paintLayerColors,
    // Flatten exact height
    flattenTargetHeight,
  } = useEditorStore();

  const ringColor = useMemo(() => {
    if (terrainMode === 'paint') return '#6366f1'; // Glowing Indigo
    switch (sculptTool) {
      case 'raise': return '#10b981'; // Glowing Emerald
      case 'lower': return '#f43f5e'; // Glowing Rose
      case 'smooth': return '#0ea5e9'; // Glowing Sky Blue
      case 'flatten': return '#f59e0b'; // Glowing Amber
      default: return '#6366f1';
    }
  }, [terrainMode, sculptTool]);

  const matInfo = FULL_MATERIAL_LIBRARY.find(m => m.id === terrainMaterialId);
  const brushInfo = FULL_MATERIAL_LIBRARY.find(m => m.id === brushTextureId);

  // Load Brush Texture
  const brushTex = useTexture(brushInfo?.diffuse || EMPTY_TEXTURE, (t: any) => {
    if (t instanceof THREE.Texture) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 16;
    }
  });

  // Initialize Painting Canvas
  const [paintCanvas] = useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    return canvas;
  });

  // Initialize Sculpting Canvas — 512×512 for smooth hills (upgraded from 256)
  const [sculptCanvas] = useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SCULPT_RES;
    canvas.height = SCULPT_RES;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#808080'; // Middle-gray = 0 offset
      ctx.fillRect(0, 0, SCULPT_RES, SCULPT_RES);
    }
    return canvas;
  });

  const sculptHeightsRef = useRef<Float32Array>(globalSculptHeights);
  const [sculptTrigger, setSculptTrigger] = useState(0);
  const [isSculptLoaded, setIsSculptLoaded] = useState(globalIsSculptLoaded);
  const isDrawingRef = useRef(false);
  const lastPaintTimeRef = useRef(0);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;

        // Commit final state to store once drawing stroke has finished!
        if (terrainMode === 'paint') {
          const dataUrl = paintCanvas.toDataURL('image/png');
          setPaintData(dataUrl);
        } else if (terrainMode === 'sculpt') {
          const dataUrl = sculptCanvas.toDataURL('image/png');
          setSculptData(dataUrl);
          setSculptTrigger(prev => prev + 1);
        }
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [terrainMode, paintCanvas, sculptCanvas, setPaintData, setSculptData]);

  const paintTexture = useMemo(() => {
    const tex = new THREE.CanvasTexture(paintCanvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [paintCanvas]);

  // Load / Clear paint data
  useEffect(() => {
    const ctx = paintCanvas.getContext('2d');
    if (!ctx) return;

    if (!paintData) {
      // Clear canvas if no data
      ctx.clearRect(0, 0, 1024, 1024);
      paintTexture.needsUpdate = true;
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0);
      paintTexture.needsUpdate = true;
    };
    img.onerror = (e) => {
      console.warn("[StormEnvironment] Failed to load paintData image:", e);
      ctx.clearRect(0, 0, 1024, 1024);
      paintTexture.needsUpdate = true;
    };
    img.src = paintData;
  }, [paintCanvas, paintTexture, paintData]);

  // Load / Clear sculpt data
  useEffect(() => {
    const ctx = sculptCanvas.getContext('2d');
    if (!ctx) return;

    if (!sculptData) {
      // Upgrade: clear to SCULPT_RES x SCULPT_RES
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, SCULPT_RES, SCULPT_RES);

      const heights = sculptHeightsRef.current;
      heights.fill(0);
      if (typeof window !== 'undefined') {
        (window as any).sculptHeights = heights;
      }
      setSculptTrigger(prev => prev + 1);
      globalIsSculptLoaded = true;
      setIsSculptLoaded(true);
      onSculptLoaded?.();
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, SCULPT_RES, SCULPT_RES);
      ctx.drawImage(img, 0, 0, SCULPT_RES, SCULPT_RES);

      // Update heights cache from 512x512 canvas
      const imgData = ctx.getImageData(0, 0, SCULPT_RES, SCULPT_RES).data;
      const heights = sculptHeightsRef.current;
      for (let i = 0; i < SCULPT_RES * SCULPT_RES; i++) {
        const rValue = imgData[i * 4];
        heights[i] = ((rValue - 128) / 128) * 35; // maxDisplacement = 35 meters
      }
      if (typeof window !== 'undefined') {
        (window as any).sculptHeights = heights;
      }
      setSculptTrigger(prev => prev + 1);
      globalIsSculptLoaded = true;
      setIsSculptLoaded(true);
      onSculptLoaded?.();
    };
    img.onerror = (e) => {
      console.warn("[StormEnvironment] Failed to load sculptData image, falling back to flat terrain:", e);
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, SCULPT_RES, SCULPT_RES);
      const heights = sculptHeightsRef.current;
      heights.fill(0);
      if (typeof window !== 'undefined') {
        (window as any).sculptHeights = heights;
      }
      setSculptTrigger(prev => prev + 1);
      globalIsSculptLoaded = true;
      setIsSculptLoaded(true);
      onSculptLoaded?.();
    };
    img.src = sculptData;
  }, [sculptCanvas, sculptData]);

  const handlePaint = useCallback((uv: THREE.Vector2, isShiftPressed: boolean = false) => {
    if (!paintMode) return;

    if (terrainMode === 'paint') {
      const ctx = paintCanvas.getContext('2d');
      if (ctx) {
        const x = uv.x * 1024;
        const y = (1 - uv.y) * 1024;

        // Determine which RGBA channel to write to based on activePaintLayer
        const ch = [
          [1, 0, 0, 0], // R
          [0, 1, 0, 0], // G
          [0, 0, 1, 0], // B
          [0, 0, 0, 1], // A
        ][activePaintLayer] || [1, 0, 0, 0];

        // Draw the brush shape to a temporary offscreen canvas (grayscale)
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = 1024;
        tmpCanvas.height = 1024;
        const tmpCtx = tmpCanvas.getContext('2d')!;
        tmpCtx.save();
        tmpCtx.clearRect(0, 0, 1024, 1024);
        tmpCtx.translate(x, y);
        tmpCtx.rotate((brushRotation * Math.PI) / 180);
        tmpCtx.globalAlpha = brushStrength;
        tmpCtx.fillStyle = '#ffffff';
        tmpCtx.strokeStyle = '#ffffff';

        switch (brushMaskId) {
          case 'softCircle': {
            const grad = tmpCtx.createRadialGradient(0, 0, 0, 0, 0, brushSize);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, 'transparent');
            tmpCtx.fillStyle = grad;
            tmpCtx.beginPath();
            tmpCtx.arc(0, 0, brushSize, 0, Math.PI * 2);
            tmpCtx.fill();
            break;
          }
          case 'hardCircle':
            tmpCtx.beginPath();
            tmpCtx.arc(0, 0, brushSize, 0, Math.PI * 2);
            tmpCtx.fill();
            break;
          case 'star': {
            tmpCtx.beginPath();
            const spikes = 8;
            const outerRadius = brushSize;
            const innerRadius = brushSize * 0.4;
            let r = -Math.PI / 2;
            const angleStep = Math.PI / spikes;
            tmpCtx.moveTo(0, -outerRadius);
            for (let i = 0; i < spikes; i++) {
              tmpCtx.lineTo(Math.cos(r) * outerRadius, Math.sin(r) * outerRadius);
              r += angleStep;
              tmpCtx.lineTo(Math.cos(r) * innerRadius, Math.sin(r) * innerRadius);
              r += angleStep;
            }
            tmpCtx.closePath();
            tmpCtx.fill();
            break;
          }
          case 'hexagon': {
            tmpCtx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i;
              const sx = Math.cos(angle) * brushSize;
              const sy = Math.sin(angle) * brushSize;
              if (i === 0) tmpCtx.moveTo(sx, sy);
              else tmpCtx.lineTo(sx, sy);
            }
            tmpCtx.closePath();
            tmpCtx.fill();
            break;
          }
          case 'starOutline': {
            tmpCtx.lineWidth = brushSize * 0.3;
            tmpCtx.beginPath();
            tmpCtx.arc(0, 0, brushSize * 0.7, 0, Math.PI * 2);
            tmpCtx.stroke();
            break;
          }
          case 'square':
            tmpCtx.fillRect(-brushSize, -brushSize, brushSize * 2, brushSize * 2);
            break;
        }
        tmpCtx.restore();

        // Composite the grayscale mask into the correct RGBA channel
        // Read current canvas pixels in the bounding area, update target channel, write back
        const bx = Math.max(0, Math.floor(x - brushSize - 2));
        const by = Math.max(0, Math.floor(y - brushSize - 2));
        const bw = Math.min(1024 - bx, Math.ceil(brushSize * 2 + 4));
        const bh = Math.min(1024 - by, Math.ceil(brushSize * 2 + 4));

        if (bw > 0 && bh > 0) {
          const destData = ctx.getImageData(bx, by, bw, bh);
          const maskData = tmpCtx.getImageData(bx, by, bw, bh);
          const dest = destData.data;
          const mask = maskData.data;
          for (let i = 0; i < dest.length; i += 4) {
            const maskAlpha = mask[i + 3] / 255; // alpha of the drawn brush shape
            // ch = [1,0,0,0] for R, [0,1,0,0] for G, [0,0,1,0] for B, [0,0,0,1] for A
            // Mix existing channel with new paint value
            dest[i + 0] = Math.round(dest[i + 0] * (1 - ch[0] * maskAlpha) + 255 * ch[0] * maskAlpha);
            dest[i + 1] = Math.round(dest[i + 1] * (1 - ch[1] * maskAlpha) + 255 * ch[1] * maskAlpha);
            dest[i + 2] = Math.round(dest[i + 2] * (1 - ch[2] * maskAlpha) + 255 * ch[2] * maskAlpha);
            dest[i + 3] = Math.round(dest[i + 3] * (1 - ch[3] * maskAlpha) + 255 * ch[3] * maskAlpha);
          }
          ctx.putImageData(destData, bx, by);
        }

        // Mark dirty — GPU upload batched to once per useFrame
        globalDirtyPaint = true;
      }
    } else if (terrainMode === 'sculpt') {
      const ctx = sculptCanvas.getContext('2d');
      if (ctx) {
        const x = uv.x * SCULPT_RES;
        const y = (1 - uv.y) * SCULPT_RES;
        const scaledBrushSize = brushSize * (SCULPT_RES / 1024);

        if (sculptTool === 'smooth') {
          const r = Math.ceil(scaledBrushSize);
          const startX = Math.max(0, Math.floor(x - r));
          const startY = Math.max(0, Math.floor(y - r));
          const width = Math.min(SCULPT_RES - startX, Math.ceil(r * 2));
          const height = Math.min(SCULPT_RES - startY, Math.ceil(r * 2));

          if (width > 0 && height > 0) {
            const imgData = ctx.getImageData(startX, startY, width, height);
            const data = imgData.data;
            const originalData = new Uint8ClampedArray(data);

            for (let dy = 0; dy < height; dy++) {
              for (let dx = 0; dx < width; dx++) {
                const px = startX + dx;
                const py = startY + dy;
                const dist = Math.hypot(px - x, py - y);
                if (dist <= scaledBrushSize) {
                  let sum = 0;
                  let count = 0;
                  for (let ny = -2; ny <= 2; ny++) {
                    for (let nx = -2; nx <= 2; nx++) {
                      const gX = Math.max(0, Math.min(width - 1, dx + nx));
                      const gY = Math.max(0, Math.min(height - 1, dy + ny));
                      const idx = (gY * width + gX) * 4;
                      sum += originalData[idx];
                      count++;
                    }
                  }
                  const avg = Math.round(sum / count);
                  const destIdx = (dy * width + dx) * 4;
                  const factor = brushStrength;
                  data[destIdx] = Math.round(originalData[destIdx] * (1 - factor) + avg * factor);
                  data[destIdx + 1] = data[destIdx];
                  data[destIdx + 2] = data[destIdx];
                }
              }
            }
            ctx.putImageData(imgData, startX, startY);
          }
        } else {
          ctx.save();
          ctx.globalAlpha = brushStrength;
          ctx.translate(x, y);
          ctx.rotate((brushRotation * Math.PI) / 180);

          let color: string;
          if (sculptTool === 'flatten') {
            // Flatten to exact height: convert target height to grayscale value
            const targetGray = Math.round(((flattenTargetHeight / 35) * 128) + 128);
            const clampedGray = Math.max(0, Math.min(255, targetGray));
            const hex = clampedGray.toString(16).padStart(2, '0');
            color = `#${hex}${hex}${hex}`;
          } else {
            color =
              (sculptTool === 'raise' && !isShiftPressed) || (sculptTool === 'lower' && isShiftPressed) ? '#ffffff' :
                (sculptTool === 'lower' && !isShiftPressed) || (sculptTool === 'raise' && isShiftPressed) ? '#000000' :
                  '#808080';
          }

          ctx.fillStyle = color;
          ctx.strokeStyle = color;

          switch (brushMaskId) {
            case 'softCircle': {
              const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, scaledBrushSize);
              grad.addColorStop(0, color);
              grad.addColorStop(1, 'transparent');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(0, 0, scaledBrushSize, 0, Math.PI * 2);
              ctx.fill();
              break;
            }
            case 'hardCircle':
              ctx.beginPath();
              ctx.arc(0, 0, scaledBrushSize, 0, Math.PI * 2);
              ctx.fill();
              break;
            case 'star': {
              ctx.beginPath();
              const spikes = 8;
              const outerRadius = scaledBrushSize;
              const innerRadius = scaledBrushSize * 0.4;
              let r = -Math.PI / 2;
              const angleStep = Math.PI / spikes;
              ctx.moveTo(0, -outerRadius);
              for (let i = 0; i < spikes; i++) {
                ctx.lineTo(Math.cos(r) * outerRadius, Math.sin(r) * outerRadius);
                r += angleStep;
                ctx.lineTo(Math.cos(r) * innerRadius, Math.sin(r) * innerRadius);
                r += angleStep;
              }
              ctx.closePath();
              ctx.fill();
              break;
            }
            case 'hexagon': {
              ctx.beginPath();
              for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const sx = Math.cos(angle) * scaledBrushSize;
                const sy = Math.sin(angle) * scaledBrushSize;
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
              }
              ctx.closePath();
              ctx.fill();
              break;
            }
            case 'starOutline': {
              ctx.strokeStyle = color;
              ctx.lineWidth = scaledBrushSize * 0.3;
              ctx.beginPath();
              ctx.arc(0, 0, scaledBrushSize * 0.7, 0, Math.PI * 2);
              ctx.stroke();
              break;
            }
            case 'square':
              ctx.fillRect(-scaledBrushSize, -scaledBrushSize, scaledBrushSize * 2, scaledBrushSize * 2);
              break;
            default:
              break;
          }

          ctx.restore();
        }

        // Update heights array ONLY for the affected bounding box
        const r = Math.ceil(scaledBrushSize);
        const startX = Math.max(0, Math.floor(x - r - 2));
        const startY = Math.max(0, Math.floor(y - r - 2));
        const bw = Math.min(SCULPT_RES - startX, Math.ceil(r * 2 + 4));
        const bh = Math.min(SCULPT_RES - startY, Math.ceil(r * 2 + 4));

        if (bw > 0 && bh > 0) {
          const imgData = ctx.getImageData(startX, startY, bw, bh).data;
          const heights = sculptHeightsRef.current;
          for (let dy = 0; dy < bh; dy++) {
            for (let dx = 0; dx < bw; dx++) {
              const px = startX + dx;
              const py = startY + dy;
              const idx = py * SCULPT_RES + px;
              const rValue = imgData[(dy * bw + dx) * 4];
              heights[idx] = ((rValue - 128) / 128) * 35;
            }
          }
        }

        if (typeof window !== 'undefined') {
          (window as any).sculptHeights = sculptHeightsRef.current;
        }

        // ── Incremental vertex update: only vertices within brush world-radius ──
        const geo = meshRef.current?.geometry as THREE.BufferGeometry;
        if (geo) {
          const pos = geo.attributes.position;
          const heights = sculptHeightsRef.current;
          // Convert UV brush position back to world coords
          const worldBrushX = (uv.x - 0.5) * TERRAIN_SIZE;
          const worldBrushZ = ((1 - uv.y) - 0.5) * TERRAIN_SIZE;
          const worldBrushRadius = brushSize * (TERRAIN_SIZE / 1024) * 1.5; // slightly larger to catch edge verts
          const worldRadiusSq = worldBrushRadius * worldBrushRadius;
          const modifiedIndices: number[] = [];

          for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i); // Y in local plane = world Z (plane is rotated)
            const dx = vx - worldBrushX;
            const dz = vy - worldBrushZ;
            if (dx * dx + dz * dz > worldRadiusSq) continue;

            const procElevation = getTerrainElevation(vx, vy, "STORM", baseDistance, terrainConfig, true);
            const u = (vx + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
            const v = (vy + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
            const px = Math.max(0, Math.min(SCULPT_RES - 1, Math.round(u * (SCULPT_RES - 1))));
            const py = Math.max(0, Math.min(SCULPT_RES - 1, Math.round((1 - v) * (SCULPT_RES - 1))));
            const idx = py * SCULPT_RES + px;
            const sculptOffset = heights[idx] || 0;
            pos.setZ(i, procElevation + sculptOffset);
            modifiedIndices.push(i);
          }
          pos.needsUpdate = true;

          // Flag for batch update in useFrame instead of doing it immediately
          if (modifiedIndices.length > 0) {
            globalDirtySculpt = true;
          }
        }
      }
    }
  }, [
    paintMode,
    terrainMode,
    sculptTool,
    brushSize,
    brushStrength,
    brushRotation,
    brushMaskId,
    paintCanvas,
    sculptCanvas,
    baseDistance,
    terrainConfig,
    activePaintLayer,
    paintLayerColors,
    flattenTargetHeight,
  ]);

  // Load textures for all 4 paint layers
  const splatMatInfos = useMemo(() => [
    FULL_MATERIAL_LIBRARY.find(m => m.id === paintLayerMaterials[0]),
    FULL_MATERIAL_LIBRARY.find(m => m.id === paintLayerMaterials[1]),
    FULL_MATERIAL_LIBRARY.find(m => m.id === paintLayerMaterials[2]),
    FULL_MATERIAL_LIBRARY.find(m => m.id === paintLayerMaterials[3]),
  ], [paintLayerMaterials]);

  // Safely construct texture paths to avoid 'undefined' or empty string loading
  const texturePaths = useMemo(() => {
    const p: Record<string, string> = { map: matInfo?.diffuse || EMPTY_TEXTURE };
    if (matInfo?.normal) p.normalMap = matInfo.normal;
    if (matInfo?.roughness) p.roughnessMap = matInfo.roughness;
    if (matInfo?.displacement) p.displacementMap = matInfo.displacement;

    // Add splat layer textures if defined
    if (splatMatInfos[0]?.diffuse) p.splat0 = splatMatInfos[0].diffuse;
    if (splatMatInfos[1]?.diffuse) p.splat1 = splatMatInfos[1].diffuse;
    if (splatMatInfos[2]?.diffuse) p.splat2 = splatMatInfos[2].diffuse;
    if (splatMatInfos[3]?.diffuse) p.splat3 = splatMatInfos[3].diffuse;

    return p;
  }, [matInfo, splatMatInfos]);

  // Load textures if selected
  const textures = useTexture(texturePaths as any, (tex: any) => {
    const applySettings = (t: THREE.Texture) => {
      if (!t) return;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(30, 30);
      t.anisotropy = 16;
    };

    if (tex instanceof THREE.Texture) {
      applySettings(tex);
    } else if (tex && typeof tex === 'object') {
      Object.values(tex).forEach((t: any) => {
        if (t instanceof THREE.Texture) applySettings(t);
      });
    }
  });

  // Update uniforms when textures or colors load
  useEffect(() => {
    const tex = textures as any;
    if (!TerrainMaterial.uniforms) return;

    // Base terrain texture
    if (tex?.map) {
      TerrainMaterial.uniforms.uMap.value = tex.map;
      TerrainMaterial.uniforms.uUseMap.value = matInfo ? 1.0 : 0.0;
    } else {
      TerrainMaterial.uniforms.uUseMap.value = 0.0;
    }

    TerrainMaterial.uniforms.baseColor.value?.set(terrainColor);
    TerrainMaterial.uniforms.uPaintMap.value = paintTexture;
    TerrainMaterial.uniforms.uUsePaint.value = 1.0;

    // Multi-layer splat colors
    TerrainMaterial.uniforms.uSplatCol0.value?.set(paintLayerColors[0]);
    TerrainMaterial.uniforms.uSplatCol1.value?.set(paintLayerColors[1]);
    TerrainMaterial.uniforms.uSplatCol2.value?.set(paintLayerColors[2]);
    TerrainMaterial.uniforms.uSplatCol3.value?.set(paintLayerColors[3]);

    // Multi-layer splat textures (if material selected for that layer)
    if (tex?.splat0) {
      TerrainMaterial.uniforms.uSplatTex0.value = tex.splat0;
      TerrainMaterial.uniforms.uUseSplat0.value = 1.0;
    } else {
      TerrainMaterial.uniforms.uSplatTex0.value = null;
      TerrainMaterial.uniforms.uUseSplat0.value = 0.0;
    }
    if (tex?.splat1) {
      TerrainMaterial.uniforms.uSplatTex1.value = tex.splat1;
      TerrainMaterial.uniforms.uUseSplat1.value = 1.0;
    } else {
      TerrainMaterial.uniforms.uSplatTex1.value = null;
      TerrainMaterial.uniforms.uUseSplat1.value = 0.0;
    }
    if (tex?.splat2) {
      TerrainMaterial.uniforms.uSplatTex2.value = tex.splat2;
      TerrainMaterial.uniforms.uUseSplat2.value = 1.0;
    } else {
      TerrainMaterial.uniforms.uSplatTex2.value = null;
      TerrainMaterial.uniforms.uUseSplat2.value = 0.0;
    }
    if (tex?.splat3) {
      TerrainMaterial.uniforms.uSplatTex3.value = tex.splat3;
      TerrainMaterial.uniforms.uUseSplat3.value = 1.0;
    } else {
      TerrainMaterial.uniforms.uSplatTex3.value = null;
      TerrainMaterial.uniforms.uUseSplat3.value = 0.0;
    }

    // Legacy brush texture
    TerrainMaterial.uniforms.uBrushTex.value = brushTex;
    TerrainMaterial.uniforms.uUseBrushTex.value = brushInfo ? 1.0 : 0.0;

    TerrainMaterial.needsUpdate = true;
  }, [textures, matInfo, terrainColor, paintTexture, brushTex, brushInfo, paintLayerColors, paintLayerMaterials, splatMatInfos]);

  // Dirty-flag paint GPU upload — batched to once per useFrame
  useFrame(() => {
    if (globalDirtyPaint) {
      paintTexture.needsUpdate = true;
      globalDirtyPaint = false;
    }

    // Batch normal recomputation and BVH refitting to max once per frame
    if (globalDirtySculpt) {
      const geo = meshRef.current?.geometry as THREE.BufferGeometry;
      if (geo) {
        geo.computeVertexNormals();

        // Async BVH refit
        const boundsTree = (geo as any).boundsTree;
        if (boundsTree) {
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => boundsTree.refit(), { timeout: 200 });
          } else {
            setTimeout(() => boundsTree.refit(), 0);
          }
        }
      }
      globalDirtySculpt = false;
    }
  });

  const terrainGeo = useMemo(() => {
    const segs = potatoMode ? 64 : 128;
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
    const pos = geo.attributes.position;
    const heights = sculptHeightsRef.current;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const procElevation = getTerrainElevation(x, y, "STORM", baseDistance, terrainConfig, true);
      const u = (x + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
      const v = (y + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
      const px = Math.max(0, Math.min(SCULPT_RES - 1, Math.round(u * (SCULPT_RES - 1))));
      const py = Math.max(0, Math.min(SCULPT_RES - 1, Math.round((1 - v) * (SCULPT_RES - 1))));
      const idx = py * SCULPT_RES + px;
      const sculptOffset = heights[idx] || 0;
      pos.setZ(i, procElevation + sculptOffset);
    }
    geo.computeVertexNormals();
    (geo as any).computeBoundsTree({ maxDepth: 64, maxLeafSize: 5 });
    return geo;
  }, [baseDistance, potatoMode, terrainConfig, sculptTrigger]);

  // Signal parent that terrain BVH is ready (1 frame after mount)
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady?.());
    return () => cancelAnimationFrame(id);
  }, [terrainGeo, onReady]);

  const meshRef = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    if (meshRef.current) {
      registerCollider(meshRef.current);
      return () => unregisterCollider(meshRef.current);
    }
  }, [terrainGeo]);

  if (!isSculptLoaded) return null;

  return (
    <>
      <StaticCollider
        key={`terrain-sc-${sculptTrigger}`}
        debug={debug}
        restitution={0}
        friction={1}
        BVHOptions={{
          strategy: 1, // SAH
          maxDepth: 64,
          maxLeafSize: 5,
          verbose: false
        } as any}
      >
        <mesh
          ref={meshRef}
          name="terrain"
          geometry={terrainGeo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, GROUND_Y, 0]}
          receiveShadow={!potatoMode || isEditorOpen}
          onPointerDown={(e: any) => {
            if (paintMode && e.button === 0) {
              e.stopPropagation();
              isDrawingRef.current = true;
              if (e.uv) handlePaint(e.uv, e.shiftKey);
              lastPaintTimeRef.current = performance.now();
            }
          }}
          onPointerMove={(e: any) => {
            if (paintMode) {
              e.stopPropagation();
              if (e.buttons === 1) {
                isDrawingRef.current = true;
                const now = performance.now();
                if (now - lastPaintTimeRef.current > 16) { // throttle to ~60hz
                  if (e.uv) handlePaint(e.uv, e.shiftKey);
                  lastPaintTimeRef.current = now;
                }
              }
            }
          }}
        >
          <primitive object={TerrainMaterial} attach="material" wireframe={debug} />
        </mesh>
      </StaticCollider>

      {paintMode && brushHoverPos && (() => {
        // Build terrain-projected brush circle outline
        // brushSize in canvas pixels, converted to world-unit radius
        const worldRadius = brushSize * (1500 / 1024);
        const SEGS = 64;
        const cx = brushHoverPos[0];
        const cz = brushHoverPos[2];
        const pts = new Float32Array((SEGS + 1) * 3);
        for (let i = 0; i <= SEGS; i++) {
          const angle = (i / SEGS) * Math.PI * 2;
          const wx = cx + Math.cos(angle) * worldRadius;
          const wz = cz + Math.sin(angle) * worldRadius;
          let wy = getTerrainElevation(wx, wz, "STORM" as any, baseDistance, terrainConfig);
          if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
            const h = (window as any).getGroundHeight(wx, wz, -9999);
            if (h !== -9999) wy = h;
          }
          pts[i * 3 + 0] = wx;
          pts[i * 3 + 1] = wy + 0.35;
          pts[i * 3 + 2] = wz;
        }
        return (
          <lineLoop>
            <bufferGeometry>
              <float32BufferAttribute attach="attributes-position" args={[pts, 3]} />
            </bufferGeometry>
            <lineBasicMaterial
              color={ringColor}
              linewidth={2}
              transparent
              opacity={0.9}
              depthWrite={false}
            />
          </lineLoop>
        );
      })()}
    </>
  );
};






interface ErrorBoundaryProps {
  children: ReactNode;
  onCatch: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class EnvironmentErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error) {
    this.props.onCatch(error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export const StormEnvironment = ({ baseDistance = 24, potatoMode = false, debug = false, onReady }: {
  baseDistance?: number;
  potatoMode?: boolean;
  debug?: boolean;
  onReady?: () => void;
}) => {
  // ── ALL hooks must be unconditionally at the top (React Rules of Hooks) ──
  const [skyLoadFailed, setSkyLoadFailed] = useState(false);
  const weather = useStore(s => s.weather);
  const gameState = useStore(s => s.gameState);
  const isSetup = gameState === "SETUP";
  const { spawnVFX } = useVFX();
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();

  // Editor store — specific selectors to minimise re-renders
  const isEditorOpen = useEditorStore(s => s.isEditorOpen);
  const lightIntensity = useEditorStore(s => s.lightIntensity);
  const ambientIntensity = useEditorStore(s => s.ambientIntensity);
  const sunAngle = useEditorStore(s => s.sunAngle);
  const fogDensity = useEditorStore(s => s.fogDensity);
  const skyboxIntensity = useEditorStore(s => s.skyboxIntensity);
  const sky = useEditorStore(s => s.sky) || 'sunset';

  // Derived values (memo hooks must also be unconditional)
  const skyFile = useMemo(() => {
    if (sky === 'night') return `${API_BASE_URL}/assets/textures/skyboxes/qwantani_night_1k.hdr`;
    if (sky === 'sunset') return `${API_BASE_URL}/assets/textures/skyboxes/qwantani_sunset_1k.hdr`;
    return null;
  }, [sky]);

  const sunPosition = useMemo(() => {
    const rad = (sunAngle * Math.PI) / 180;
    return [Math.cos(rad) * 120, 80, Math.sin(rad) * 120] as [number, number, number];
  }, [sunAngle]);

  const fogColor = sky === 'night' ? "#0b0f19" : "#c8dff0";

  // Resolved background intensity (used both in JSX and useFrame)
  const resolvedBgIntensity = skyboxIntensity !== null
    ? skyboxIntensity
    : (sky === 'night' ? 0.02 : 0.15);

  useFrame(state => {
    // Sync scene background intensity to editor value every frame imperatively
    // NOTE: Do NOT set scene.environment = null here — it fights Drei's Environment
    //       component and causes the "Cannot commit the same tree" R3F crash.
    scene.backgroundIntensity = resolvedBgIntensity;
    scene.environmentIntensity = resolvedBgIntensity;

    if (PainterlyWaterMaterial.uniforms?.time) {
      PainterlyWaterMaterial.uniforms.time.value = state.clock.elapsedTime;
    }

    if (lightRef.current) {
      if (lightRef.current.target.parent !== scene) {
        scene.add(lightRef.current.target);
      }

      let centerX = 0;
      let centerY = 0;
      let centerZ = 0;

      const isEditorOpen = useEditorStore.getState().isEditorOpen;
      if (isEditorOpen) {
        centerX = state.camera.position.x;
        // Anchor shadow camera target to ground level so the frustum covers
        // the terrain properly regardless of how high the editor camera is.
        centerY = Math.min(state.camera.position.y, 5);
        centerZ = state.camera.position.z;
      } else {
        const pos = useStore.getState().playerPosition;
        centerX = pos[0];
        centerY = pos[1];
        centerZ = pos[2];
      }

      const rad = (useEditorStore.getState().sunAngle * Math.PI) / 180;
      // Increase light orbit radius in editor for wider shadow coverage angle
      const orbitR = isEditorOpen ? 40.0 : 15.0;
      const lightH = isEditorOpen ? 80.0 : 45.0;
      const ox = Math.cos(rad) * orbitR;
      const oz = Math.sin(rad) * orbitR;
      lightRef.current.position.set(centerX + ox, centerY + lightH, centerZ + oz);
      lightRef.current.target.position.set(centerX, centerY, centerZ);
      lightRef.current.target.updateMatrixWorld();
    }

    if (isSetup || potatoMode) return;
    if (state.clock.elapsedTime % 0.25 < 0.025) {
      if (characterStatus && characterStatus.position) {
        const px = characterStatus.position.x;
        const pz = characterStatus.position.z;
        if (weather === "CLEAR") {
          spawnVFX([px + (Math.random() - 0.5) * 60, 1 + Math.random() * 5, pz + (Math.random() - 0.5) * 60], "dust-mote", "#ffffff");
        } else if (weather === "THUNDER") {
          spawnVFX([px + (Math.random() - 0.5) * 80, 0.5, pz + (Math.random() - 0.5) * 80], "environment-mist", "#a855f7");
        }
      }
    }
  });

  // ── Conditional early return — all hooks are already registered above ──
  if (potatoMode) {
    return (
      <group>
        <color attach="background" args={["#c8d8f0"]} />
        <hemisphereLight intensity={1.5} groundColor="#556655" />
        <ambientLight intensity={0.8} />
        <Terrain baseDistance={baseDistance} potatoMode />
      </group>
    );
  }

  return (
    <group>
      {skyFile && !skyLoadFailed ? (
        <EnvironmentErrorBoundary onCatch={() => setSkyLoadFailed(true)}>
          <Environment
            files={skyFile}
            background
            backgroundIntensity={resolvedBgIntensity}
            blur={0}
          />
        </EnvironmentErrorBoundary>
      ) : (
        <>
          <color attach="background" args={["#a0c4ff"]} />
          <Sky sunPosition={sunPosition} />
        </>
      )}
      <ambientLight intensity={ambientIntensity ?? (sky === 'night' ? 0.15 : 0.45)} />
      <hemisphereLight
        intensity={sky === 'night' ? 0.1 : 0.4}
        color={sky === 'night' ? "#a5b4fc" : "#ffffff"}
        groundColor="#556677"
      />

      <directionalLight
        ref={lightRef}
        position={sunPosition}
        intensity={lightIntensity ?? (sky === 'night' ? 0.15 : 0.8)}

        castShadow
        shadow-mapSize-width={isEditorOpen ? 4096 : 2048}
        shadow-mapSize-height={isEditorOpen ? 4096 : 2048}
        shadow-bias={isEditorOpen ? -0.001 : -0.0005}
        shadow-normalBias={isEditorOpen ? 0.15 : 0.06}

        shadow-camera-near={isEditorOpen ? 1 : 0.5}
        shadow-camera-far={isEditorOpen ? 500 : 200}
        shadow-camera-left={isEditorOpen ? -150 : -60}
        shadow-camera-right={isEditorOpen ? 150 : 60}
        shadow-camera-top={isEditorOpen ? 150 : 60}
        shadow-camera-bottom={isEditorOpen ? -150 : -60}
      />

      <Terrain
        baseDistance={baseDistance}
        debug={debug}
        onReady={onReady}
        onSculptLoaded={() => { }}
      />

      {/* WATER PLANE (NO COLLIDER) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]}>
        <planeGeometry args={[1500, 1500]} />
        <primitive object={PainterlyWaterMaterial} attach="material" />
      </mesh>

      {/* Exponential Fog for depth */}
      <fogExp2 attach="fog" args={[fogColor, fogDensity]} />
    </group>
  );
};
