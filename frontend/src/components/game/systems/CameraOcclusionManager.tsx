'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/src/state/useStore';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export interface CameraOcclusionConfig {
  maskRadius?: number;
  nearConeRadius?: number;
  nearClipDistance?: number;
  coneFalloff?: number;
  playerHeightOffset?: number;
  /** How often (ms) to scan the scene for new meshes that need patching. */
  rescanIntervalMs?: number;
  excludedNames?: string[];
  /** Max number of NEW materials to actually shader-patch per frame. Patching
   *  sets `needsUpdate = true`, which forces a shader recompile on the next
   *  render — recompiling dozens of already-rendered materials in the same
   *  frame (e.g. right after a new area streams in) is a common source of a
   *  visible hitch. This budget spreads that cost across several frames
   *  instead of paying it all at once. */
  materialPatchBudgetPerFrame?: number;
  /** 'solid' fully discards every pixel inside the cutout radius, so the
   *  object is genuinely invisible there. 'stipple' keeps the old 2x2
   *  checkerboard dissolve look (half the pixels discarded) if you ever
   *  want that dithered look back for a different effect. */
  cutoutStyle?: 'solid' | 'stipple';
}

const DEFAULT_CONFIG: Required<CameraOcclusionConfig> = {
  maskRadius: 1.5,
  nearConeRadius: 4.5,
  nearClipDistance: 2.5,
  coneFalloff: 0.9,
  playerHeightOffset: 1.0,
  rescanIntervalMs: 1000,
  excludedNames: ['terrain', 'player', 'water'],
  materialPatchBudgetPerFrame: 4,
  cutoutStyle: 'solid',
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
// The actual shader injection. This is the part that's "expensive" in the
// sense that it forces a recompile — callers should budget how many of
// these happen per frame (see the queue in the component below).
// ---------------------------------------------------------------------------
function applyOcclusionShaderPatch(
  material: THREE.Material,
  uniforms: OcclusionUniforms,
  cutoutStyle: 'solid' | 'stipple'
): void {
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

    const stippleHelper =
      cutoutStyle === 'stipple'
        ? `
       // 2x2 checkerboard dissolve — half the pixels in-radius are discarded
       // instead of all of them, giving a dithered "hologram" look.
       float occlusionStipple(vec2 fragCoord) {
         vec2 p = fragCoord / 2.0;
         return fract((floor(p.x) + floor(p.y)) / 2.0);
       }`
        : '';

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
        ${stippleHelper}`
    );

    const discardCondition =
      cutoutStyle === 'stipple' ? 'occlusionStipple(gl_FragCoord.xy) == 0.0' : 'true';

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>

        vec3 pa = vHoloWorldPos - uCamPos;
        vec3 ba = uPlayerPos - uCamPos;
        float baSq = max(dot(ba, ba), 1e-5);

        float hRaw = dot(pa, ba) / baSq;
        float h = clamp(hRaw, 0.0, 1.0);
        float distToCam = length(pa);

        if (hRaw < uConeFalloff) {
          float targetRadius = mix(uNearConeRadius, sqrt(uMaskRadiusSq), h);
          vec3 perp = pa - (ba * h);
          float distSq = dot(perp, perp);

          if (distSq < targetRadius * targetRadius || distToCam < uNearClipDistance) {
            if (${discardCondition}) discard;
          }
        }
       `
    );
  };

  material.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Object/material filtering
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
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats.filter((m: any) => !m.userData?.excludeFromOcclusionCutout);
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
    []
  );

  const claimedMaterials = useRef<WeakSet<THREE.Material>>(new WeakSet());
  const pendingPatchQueue = useRef<THREE.Material[]>([]);
  const playerPosScratch = useRef(new THREE.Vector3());
  const elapsedSinceLastScan = useRef(0);

  const scanAndQueueNewMaterials = () => {
    scene.traverse((child) => {
      if (shouldExcludeObject(child, excludedNames)) return;
      for (const material of collectMaterials(child)) {
        if (!claimedMaterials.current.has(material)) {
          claimedMaterials.current.add(material);
          pendingPatchQueue.current.push(material);
        }
      }
    });
  };

  useEffect(() => {
    scanAndQueueNewMaterials();
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

    let patchedThisFrame = 0;
    while (
      pendingPatchQueue.current.length > 0 &&
      patchedThisFrame < config.materialPatchBudgetPerFrame
    ) {
      const material = pendingPatchQueue.current.shift()!;
      applyOcclusionShaderPatch(material, uniforms, config.cutoutStyle);
      patchedThisFrame++;
    }

    elapsedSinceLastScan.current += delta * 1000;
    if (elapsedSinceLastScan.current >= config.rescanIntervalMs) {
      elapsedSinceLastScan.current = 0;
      scanAndQueueNewMaterials();
    }
  });

  return null;
};

/**
 * IF STILL HITCHING AFTER THIS:
 * - Lower `materialPatchBudgetPerFrame` further (e.g. to 1-2) if a single
 *   area transition still streams in more new materials than the budget
 *   can smooth out within an acceptable window.
 * - Confirm with the browser performance profiler (Chrome DevTools
 *   Performance tab, or `renderer.info.programs`) that recompiles are
 *   actually clustering around the hitch — if they aren't, the freeze is
 *   coming from somewhere else (asset decode, GC from an unrelated
 *   allocation spike, etc.) and this queue won't fix it.
 * - scene.traverse() itself still walks the full graph every
 *   `rescanIntervalMs`. For a very large open world, patching materials at
 *   asset-instantiation time (wherever trees/props/monsters are created)
 *   removes the scan and this queue entirely.
 */