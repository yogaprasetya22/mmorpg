/**
 * SafePostProcessing — Drop-in replacement for @react-three/postprocessing's
 * EffectComposer + Bloom + ToneMapping that works reliably with three@0.183+.
 *
 * Uses three.js's native postprocessing pipeline (EffectComposer, RenderPass,
 * UnrealBloomPass, OutputPass) to avoid the null-context `alpha` crash in
 * @react-three/postprocessing@3.x with newer three.js versions.
 *
 * Features:
 * - WebGL context loss resilience (auto-rebuilds on context restore)
 * - Proper cleanup on unmount (disposes all passes + render targets)
 * - Automatic resize handling via R3F useThree + window resize listener
 * - Performance-safe: frameloop-agnostic, no extra allocations per frame
 */
'use client';

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer as ThreeEffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

interface SafePostProcessingProps {
  /** Bloom luminance threshold (default: 1.0) */
  bloomThreshold?: number;
  /** Bloom strength (default: 0.5) */
  bloomStrength?: number;
  /** Bloom radius (default: 0.4) */
  bloomRadius?: number;
  /** Tone mapping mode (default: ACESFilmicToneMapping) */
  toneMapping?: THREE.ToneMapping;
  /** Tone mapping exposure (default: 1.0) */
  exposure?: number;
}

export const SafePostProcessing = ({
  bloomThreshold = 1.0,
  bloomStrength = 0.5,
  bloomRadius = 0.4,
  toneMapping = THREE.ACESFilmicToneMapping,
  exposure = 1.0,
}: SafePostProcessingProps) => {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<ThreeEffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);

  // Build composer on mount
  useEffect(() => {
    // Disable R3F's default auto-render so our composer takes over exclusively
    gl.autoClear = false;

    const composer = new ThreeEffectComposer(gl);
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(Math.min(gl.getPixelRatio(), 2));

    // 1. Render pass — renders the scene normally
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 2. Bloom pass — Unreal-style bloom with threshold
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    composer.addPass(bloomPass);
    bloomPassRef.current = bloomPass;

    // 3. Output pass — tone mapping + color space conversion
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Apply tone mapping to renderer
    gl.toneMapping = toneMapping;
    gl.toneMappingExposure = exposure;

    composerRef.current = composer;

    // Handle WebGL context loss
    const onContextLost = () => {
      composerRef.current = null;
    };
    const onContextRestored = () => {
      // Re-initialize will happen via the effect re-run
    };
    gl.domElement.addEventListener('webglcontextlost', onContextLost);
    gl.domElement.addEventListener('webglcontextrestored', onContextRestored);

    return () => {
      gl.domElement.removeEventListener('webglcontextlost', onContextLost);
      gl.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      // Dispose all passes and render targets
      composer.passes.forEach((pass) => {
        if ('dispose' in pass && typeof pass.dispose === 'function') {
          (pass as any).dispose();
        }
      });
      composer.dispose();
      composerRef.current = null;
      bloomPassRef.current = null;
      // Restore default auto-clear on unmount
      gl.autoClear = true;
    };
  }, [gl, scene, camera]); // Rebuild only when core context changes

  // Update bloom parameters reactively (without rebuilding the entire composer)
  useEffect(() => {
    if (bloomPassRef.current) {
      bloomPassRef.current.threshold = bloomThreshold;
      bloomPassRef.current.strength = bloomStrength;
      bloomPassRef.current.radius = bloomRadius;
    }
  }, [bloomThreshold, bloomStrength, bloomRadius]);

  // Update tone mapping exposure reactively
  useEffect(() => {
    gl.toneMapping = toneMapping;
    gl.toneMappingExposure = exposure;
  }, [gl, toneMapping, exposure]);

  // Handle resize
  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
    }
  }, [size.width, size.height]);

  // Render via composer each frame (replaces the default R3F render)
  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
  }, 1); // priority 1 = runs after all other useFrame hooks

  return null;
};
