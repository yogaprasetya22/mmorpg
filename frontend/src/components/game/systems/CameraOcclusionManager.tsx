'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/src/state/useStore';

// ---------------------------------------------------------------------------
// Config — every magic number from the original file now lives here instead
// of being buried inline in GLSL string templates.
// ---------------------------------------------------------------------------
export interface CameraOcclusionConfig {
  /** Radius of the cutout right around the player (meters). */
  maskRadius?: number;
  /** Radius of the cutout right at the camera lens (meters). Bigger than
   *  maskRadius so objects hugging the lens still get punched through. */
  nearConeRadius?: number;
  /** Anything closer to the camera than this is force-discarded regardless
   *  of the cone test — prevents near-plane clipping artifacts. */
  nearClipDistance?: number;
  /** Normalized camera->player distance (0..1) below which the cutout is
   *  active. Above this (i.e. behind the player) objects stay solid. */
  coneFalloff?: number;
  /** Vertical offset applied to the tracked player position, e.g. to target
   *  chest height instead of the feet/origin. */
  playerHeightOffset?: number;
  /** How often (ms) to rescan the scene for new meshes that need patching.
   *  Lower = new objects get occlusion sooner, at the cost of more
   *  frequent scene.traverse calls. */
  rescanIntervalMs?: number;
  /** Object names to always skip. Matched against Object3D.name. */
  excludedNames?: string[];
}

const DEFAULT_CONFIG: Required<CameraOcclusionConfig> = {
  maskRadius: 1.5,
  nearConeRadius: 4.5,
  nearClipDistance: 2.5,
  coneFalloff: 0.9,
  playerHeightOffset: 1.0,
  rescanIntervalMs: 1000,
  excludedNames: ['terrain', 'player', 'water'],
};

interface OcclusionUniforms {
  uPlayerPos: { value: THREE.Vector3 };
  uCamPos: { value: THREE.Vector3 };
  uMaskRadiusSq: { value: number };
  uNearConeRadius: { value: number };
  uNearClipDistance: { value: number };
  uConeFalloff: { value: number };
}

// ---------------------------------------------------------------------------
// Shader patch — pulled out of the component so it's a pure, testable
// function: (material, uniforms) -> mutates material.onBeforeCompile.
//
// Same technique as the original (onBeforeCompile injection into the
// built-in ShaderChunk hooks), just with the constants replaced by
// uniforms so config changes don't require a shader recompile.
// ---------------------------------------------------------------------------
function patchMaterialForOcclusionCutout(
  material: THREE.Material,
  uniforms: OcclusionUniforms,
  patched: WeakSet<THREE.Material>
): void {
  if (patched.has(material)) return;
  patched.add(material);

  const originalOnBeforeCompile = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    originalOnBeforeCompile?.call(material, shader, renderer);

    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vHoloWorldPos;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>

       vec4 tempWorldPos = vec4( transformed, 1.0 );
       #ifdef USE_INSTANCING
          tempWorldPos = instanceMatrix * tempWorldPos;
       #endif
       tempWorldPos = modelMatrix * tempWorldPos;
       vHoloWorldPos = tempWorldPos.xyz;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform vec3 uPlayerPos;
       uniform vec3 uCamPos;
       uniform float uMaskRadiusSq;
       uniform float uNearConeRadius;
       uniform float uNearClipDistance;
       uniform float uConeFalloff;
       varying vec3 vHoloWorldPos;

       // 2x2 checkerboard stipple so the cutout reads as a dissolve rather
       // than a hard-edged hole.
       float occlusionStipple(vec2 fragCoord) {
         vec2 p = fragCoord / 2.0;
         return fract((floor(p.x) + floor(p.y)) / 2.0);
       }`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>

       vec3 pa = vHoloWorldPos - uCamPos;
       vec3 ba = uPlayerPos - uCamPos;
       float baSq = max(dot(ba, ba), 1e-5);

       // Normalized position along the camera->player segment:
       // 0.0 = at the camera lens, 1.0 = at the player.
       float hRaw = dot(pa, ba) / baSq;
       float h = clamp(hRaw, 0.0, 1.0);
       float distToCam = length(pa);

       // Only cut out between the camera and the player (hRaw < coneFalloff).
       // Objects beyond the player (hRaw >= coneFalloff) stay solid.
       if (hRaw < uConeFalloff) {
         // Cone effect: cutout radius is wide near the camera (so objects
         // hugging the lens still get punched through) and narrows down
         // to maskRadius near the player.
         float targetRadius = mix(uNearConeRadius, sqrt(uMaskRadiusSq), h);

         vec3 perp = pa - (ba * h);
         float distSq = dot(perp, perp);

         if (distSq < targetRadius * targetRadius || distToCam < uNearClipDistance) {
           if (occlusionStipple(gl_FragCoord.xy) == 0.0) discard;
         }
       }
      `
    );
  };

  material.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Object filtering — name-based exclusion kept for backwards compatibility,
// plus an opt-in userData flag so callers aren't forced to rely on magic
// string names as the scene grows.
// ---------------------------------------------------------------------------
function shouldExcludeObject(object: THREE.Object3D, excludedNames: Set<string>): boolean {
  if (excludedNames.has(object.name)) return true;
  if (object.userData?.excludeFromOcclusionCutout === true) return true;
  return false;
}

function collectMaterials(object: THREE.Object3D): THREE.Material[] {
  const mesh = object as THREE.Mesh;
  if (!(mesh as any).isMesh && !(mesh as any).isInstancedMesh) return [];
  if (!mesh.material) return [];
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const CameraOcclusionManager = (props: CameraOcclusionConfig = {}) => {
  const config = { ...DEFAULT_CONFIG, ...props };
  const { camera, scene } = useThree();

  const excludedNames = useMemo(() => new Set(config.excludedNames), [config.excludedNames]);

  const uniforms = useMemo<OcclusionUniforms>(
    () => ({
      uPlayerPos: { value: new THREE.Vector3() },
      uCamPos: { value: new THREE.Vector3() },
      uMaskRadiusSq: { value: config.maskRadius * config.maskRadius },
      uNearConeRadius: { value: config.nearConeRadius },
      uNearClipDistance: { value: config.nearClipDistance },
      uConeFalloff: { value: config.coneFalloff },
    }),
    // Deliberately created once. If you need these to react to live config
    // changes, update `.value` on the existing uniforms instead of
    // recreating this object (recreating would desync already-patched
    // materials, which hold a reference to the original uniform objects).
    []
  );

  const patchedMaterials = useRef<WeakSet<THREE.Material>>(new WeakSet());
  const playerPosScratch = useRef(new THREE.Vector3());
  const elapsedSinceLastScan = useRef(0);

  const scanAndPatchScene = () => {
    scene.traverse((child) => {
      if (shouldExcludeObject(child, excludedNames)) return;
      for (const material of collectMaterials(child)) {
        patchMaterialForOcclusionCutout(material, uniforms, patchedMaterials.current);
      }
    });
  };

  // Patch whatever's already in the scene on mount.
  useEffect(() => {
    scanAndPatchScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useFrame((_, delta) => {
    const playerPosArr = useStore.getState().playerPosition;
    if (playerPosArr) {
      playerPosScratch.current.set(
        playerPosArr[0],
        playerPosArr[1] + config.playerHeightOffset,
        playerPosArr[2]
      );
      uniforms.uPlayerPos.value.copy(playerPosScratch.current);
      uniforms.uCamPos.value.copy(camera.position);
    }

    // Time-based rescan instead of a frame-count modulo, so the interval
    // stays correct regardless of actual frame rate (the original `% 60`
    // approach assumed a steady 60fps and would drift on slower devices).
    elapsedSinceLastScan.current += delta * 1000;
    if (elapsedSinceLastScan.current >= config.rescanIntervalMs) {
      elapsedSinceLastScan.current = 0;
      scanAndPatchScene();
    }
  });

  return null;
};

/**
 * KNOWN LIMITATIONS (carried over from the original design, documented so
 * they're a conscious tradeoff rather than a surprise):
 *
 * - New objects wait up to `rescanIntervalMs` before getting the occlusion
 *   patch. If you spawn something that must be occluded immediately (e.g.
 *   a projectile that can pass between camera and player), call
 *   `patchMaterialForOcclusionCutout` on it directly at spawn time instead
 *   of waiting for the next scan — that function is exported-shape but
 *   currently module-private; hoist it out if you need that hook.
 * - There's no unpatch/revert path. If this manager unmounts mid-session,
 *   already-patched materials keep their onBeforeCompile override. Three.js
 *   doesn't expose a clean way to revert a shader patch short of disposing
 *   and recreating the material, which is out of scope here.
 * - This still calls scene.traverse() on every scan, same as the original.
 *   For very large scenes, consider patching materials at asset-load time
 *   (wherever your trees/props/monsters are instantiated) instead of
 *   discovering them via periodic traversal — that removes the scan
 *   entirely and the occlusion patch is applied the instant the object is
 *   created.
 */