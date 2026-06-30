'use client';

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer as ThreeEffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * OptimizedPostProcessing — conditional bloom + tone mapping.
 *
 * Key difference from old SafePostProcessing:
 * - When `enabled=false` (potato mode), uses direct `gl.render()` — zero overhead.
 * - When `enabled=true`, uses EffectComposer as before.
 * - EffectComposer is lazily created on first enable, disposed on disable.
 *
 * Benefit: Potato mode skips ~2ms of post-processing per frame AND avoids
 * allocating render targets until they're actually needed.
 */
interface OptimizedPostProcessingProps {
    enabled: boolean;
    bloomThreshold?: number;
    bloomStrength?: number;
    bloomRadius?: number;
    toneMapping?: THREE.ToneMapping;
    exposure?: number;
}

export const OptimizedPostProcessing = ({
    enabled,
    bloomThreshold = 1.0,
    bloomStrength = 0.5,
    bloomRadius = 0.4,
    toneMapping = THREE.ACESFilmicToneMapping,
    exposure = 1.0,
}: OptimizedPostProcessingProps) => {
    const { gl, scene, camera, size } = useThree();
    const composerRef = useRef<ThreeEffectComposer | null>(null);
    const bloomPassRef = useRef<UnrealBloomPass | null>(null);
    const prevEnabledRef = useRef(false);

    // Build / dispose composer based on `enabled`
    useEffect(() => {
        if (enabled && !composerRef.current) {
            // Build composer
            gl.autoClear = false;

            const composer = new ThreeEffectComposer(gl);
            composer.setSize(size.width, size.height);
            composer.setPixelRatio(Math.min(gl.getPixelRatio(), 2));

            const renderPass = new RenderPass(scene, camera);
            composer.addPass(renderPass);

            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(size.width, size.height),
                bloomStrength,
                bloomRadius,
                bloomThreshold,
            );
            composer.addPass(bloomPass);
            bloomPassRef.current = bloomPass;

            const outputPass = new OutputPass();
            composer.addPass(outputPass);

            gl.toneMapping = toneMapping;
            gl.toneMappingExposure = exposure;

            composerRef.current = composer;
        }

        if (!enabled && composerRef.current) {
            // Dispose composer
            composerRef.current.passes.forEach((pass) => {
                if ('dispose' in pass && typeof pass.dispose === 'function') {
                    (pass as any).dispose();
                }
            });
            composerRef.current.dispose();
            composerRef.current = null;
            bloomPassRef.current = null;
            gl.autoClear = true;
        }

        prevEnabledRef.current = enabled;

        return () => {
            if (composerRef.current) {
                composerRef.current.passes.forEach((pass) => {
                    if ('dispose' in pass && typeof pass.dispose === 'function') {
                        (pass as any).dispose();
                    }
                });
                composerRef.current.dispose();
                composerRef.current = null;
                bloomPassRef.current = null;
                gl.autoClear = true;
            }
        };
    }, [enabled, gl, scene, camera, size.width, size.height, bloomThreshold, bloomStrength, bloomRadius, toneMapping, exposure]);

    // Update bloom params reactively
    useEffect(() => {
        if (bloomPassRef.current) {
            bloomPassRef.current.threshold = bloomThreshold;
            bloomPassRef.current.strength = bloomStrength;
            bloomPassRef.current.radius = bloomRadius;
        }
    }, [bloomThreshold, bloomStrength, bloomRadius]);

    // Update tone mapping
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

    // Render pass — only when composer active (bloom enabled)
    // When disabled, R3F's default loop handles rendering.
    useFrame(() => {
        if (composerRef.current) {
            composerRef.current.render();
        }
        // else: let R3F default loop handle it (priority 1 runs after default 0)
    }, 1);

    return null;
};
