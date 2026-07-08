'use client';

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * OptimizedPostProcessing — WebGPU post-processing via RenderPipeline + TSL.
 */
interface OptimizedPostProcessingProps {
    enabled: boolean;
    bloomThreshold?: number;
    bloomStrength?: number;
    bloomRadius?: number;
    /** Bloom render-target scale factor (1 = full res, 0.25 = 1/4 res). Default 0.25. */
    bloomResolution?: number;
    toneMapping?: THREE.ToneMapping;
    exposure?: number;
}

export const OptimizedPostProcessing = ({
    enabled,
    bloomThreshold = 1.0,
    bloomStrength = 0.5,
    bloomRadius = 0.4,
    bloomResolution = 0.25,
    toneMapping = THREE.ACESFilmicToneMapping,
    exposure = 1.0,
}: OptimizedPostProcessingProps) => {
    const { gl, scene, camera, size } = useThree();
    const pipelineRef = useRef<any>(null);

    // Build / dispose pipeline based on `enabled`
    useEffect(() => {
        const renderer = gl as any;

        if (enabled && !pipelineRef.current) {
            renderer.autoClear = false;

            const { RenderPipeline } = require('three/webgpu');
            const { pass, blur } = require('three/tsl');

            const w = Math.max(1, Math.floor(size.width * bloomResolution));
            const h = Math.max(1, Math.floor(size.height * bloomResolution));

            const scenePass = pass(scene, camera);

            if (bloomStrength > 0) {
                const blurred = blur(scenePass, { width: w, height: h });
                const bloomed = scenePass.add(blurred.mul(bloomStrength));
                const pipeline = new RenderPipeline(renderer, bloomed);
                pipelineRef.current = pipeline;
            } else {
                const pipeline = new RenderPipeline(renderer, scenePass);
                pipelineRef.current = pipeline;
            }
        }

        // Cleanup
        if (!enabled) {
            if (pipelineRef.current) {
                pipelineRef.current.dispose();
                pipelineRef.current = null;
            }
            renderer.autoClear = true;
        }

        return () => {
            if (pipelineRef.current) {
                pipelineRef.current.dispose();
                pipelineRef.current = null;
            }
            renderer.autoClear = true;
        };
    }, [enabled, gl, scene, camera, size.width, size.height, bloomThreshold, bloomStrength, bloomRadius, toneMapping, exposure]);

    // Update tone mapping
    useEffect(() => {
        gl.toneMapping = toneMapping;
        gl.toneMappingExposure = exposure;
    }, [gl, toneMapping, exposure]);

    // Render pass — priority 1 (after default loop)
    useFrame(() => {
        // WebGPU RenderPipeline renders automatically via outputNode
    }, 1);

    return null;
};
