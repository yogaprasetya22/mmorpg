/**
 * TerrainMaterial.ts — Material (Constants/Singleton) untuk fitur Terrain
 *
 * Berisi definisi custom MeshStandardMaterial dengan:
 *   - Triplanar texture sampling (menghilangkan UV stretch di tebing curam)
 *   - Multi-layer splat painting (4 RGBA channel)
 *   - Painterly toon shading (brushstroke noise + toon mix)
 *
 * Diekstrak dari StormTerrain.tsx agar tidak mencampur shader dengan
 * logika React hooks.
 */

import * as THREE from "three";
import { PainterlyShaderUtils } from "@jagres/shared";

export const TerrainMaterial = new THREE.MeshStandardMaterial({
  roughness: 0.85,
  metalness: 0.15,
}) as any;

TerrainMaterial.uniforms = {
  baseColor:    { value: new THREE.Color("#3d5c36") },
  peakColor:    { value: new THREE.Color("#95b58b") },
  rockColor:    { value: new THREE.Color("#5a5e52") },
  uMap:         { value: null },
  uUseMap:      { value: 0.0 },
  // Multi-layer Splat: 4 RGBA channels → 4 material textures
  uPaintMap:    { value: null }, // RGBA splat control map
  uUsePaint:    { value: 0.0 },
  uSplatTex0:   { value: null }, // Layer 0 (grass)
  uSplatTex1:   { value: null }, // Layer 1 (rock)
  uSplatTex2:   { value: null }, // Layer 2 (dirt)
  uSplatTex3:   { value: null }, // Layer 3 (snow/path)
  uSplatCol0:   { value: new THREE.Color("#3d5c36") },
  uSplatCol1:   { value: new THREE.Color("#7c6a4a") },
  uSplatCol2:   { value: new THREE.Color("#5a4d3a") },
  uSplatCol3:   { value: new THREE.Color("#e8e0d0") },
  uUseSplat0:   { value: 0.0 },
  uUseSplat1:   { value: 0.0 },
  uUseSplat2:   { value: 0.0 },
  uUseSplat3:   { value: 0.0 },
  // Legacy brush texture (kept for blueprint compatibility)
  uBrushTex:    { value: null },
  uUseBrushTex: { value: 0.0 },
};

TerrainMaterial.onBeforeCompile = (shader: any) => {
  Object.assign(shader.uniforms, TerrainMaterial.uniforms);

  // ── Vertex Shader: Pass elevation, UV, dan world position ke fragment ──
  shader.vertexShader = `
    varying float vElevation;
    varying vec2 vTerrainUv;
    varying vec3 vWorldPosition;
    ${shader.vertexShader}
  `.replace(
    "#include <begin_vertex>",
    `
    #include <begin_vertex>
    vTerrainUv = uv;
    vElevation = position.z;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    `
  );

  // ── Fragment Shader: Triplanar + Splat Paint + Painterly Style ──
  shader.fragmentShader = `
    varying float vElevation;
    varying vec2 vTerrainUv;
    varying vec3 vWorldPosition;
    uniform vec3 baseColor;
    uniform vec3 peakColor;
    uniform vec3 rockColor;
    uniform sampler2D uMap;
    uniform float uUseMap;
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

    vec3 sampleTriplanar(sampler2D tex, vec3 pos, vec3 blend, float scale) {
      vec3 x = texture2D(tex, pos.zy * scale).rgb;
      vec3 y = texture2D(tex, pos.xz * scale).rgb;
      vec3 z = texture2D(tex, pos.xy * scale).rgb;
      return x * blend.x + y * blend.y + z * blend.z;
    }

    ${shader.fragmentShader}
  `.replace(
    "vec4 diffuseColor = vec4( diffuse, opacity );",
    `
    // ─── TRIPLANAR TEXTURE SAMPLING ───
    vec3 _triplanarNorm = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
    vec3 _triplanarBlend = abs(_triplanarNorm);
    _triplanarBlend = pow(_triplanarBlend, vec3(4.0));
    _triplanarBlend /= dot(_triplanarBlend, vec3(1.0));

    float strokes = brushstrokes(vWorldPosition.xz * 0.053, 0.35);
    float t = smoothstep(0.0, 35.0, vElevation) + strokes * 0.08;
    vec3 mountainColor = toonMix(baseColor, peakColor, t * 1.5);

    float rockMask = smoothstep(22.0, 35.0, vElevation);
    mountainColor = mix(mountainColor, rockColor, rockMask * 0.6);

    // Terrain 1500m; 30 tiles = 0.02 world-scale
    const float _TEX_SCALE = 0.02;

    vec3 floorTex = sampleTriplanar(uMap, vWorldPosition, _triplanarBlend, _TEX_SCALE);
    float floorMask = smoothstep(12.0, 5.0, vElevation);
    vec3 finalColor = mix(mountainColor, floorTex, floorMask * uUseMap);

    // ─── MULTI-LAYER SPLAT PAINT ───
    vec4 splat = texture2D(uPaintMap, vTerrainUv);

    vec3 splatBase0 = uUseSplat0 > 0.5
      ? sampleTriplanar(uSplatTex0, vWorldPosition, _triplanarBlend, _TEX_SCALE)
      : uSplatCol0;
    float splat0Factor = max(0.0, 1.0 - (splat.r + splat.g + splat.b));
    finalColor = mix(finalColor, splatBase0, splat0Factor * uUsePaint);

    vec3 splatBase1 = uUseSplat1 > 0.5
      ? sampleTriplanar(uSplatTex1, vWorldPosition, _triplanarBlend, _TEX_SCALE)
      : uSplatCol1;
    finalColor = mix(finalColor, splatBase1, splat.r * uUsePaint);

    vec3 splatBase2 = uUseSplat2 > 0.5
      ? sampleTriplanar(uSplatTex2, vWorldPosition, _triplanarBlend, _TEX_SCALE)
      : uSplatCol2;
    finalColor = mix(finalColor, splatBase2, splat.g * uUsePaint);

    vec3 splatBase3 = uUseSplat3 > 0.5
      ? sampleTriplanar(uSplatTex3, vWorldPosition, _triplanarBlend, _TEX_SCALE)
      : uSplatCol3;
    finalColor = mix(finalColor, splatBase3, splat.b * uUsePaint);

    // Road / path subtle cosmetic lane
    float road = smoothstep(6.0, 3.0, abs(vWorldPosition.x) * 0.2);
    finalColor = mix(finalColor, vec3(0.5, 0.45, 0.4), road * 0.4 * floorMask);

    vec4 diffuseColor = vec4( finalColor, opacity );
    `
  );
};
