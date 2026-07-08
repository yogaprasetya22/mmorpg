'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface SafePostProcessingProps {
  bloomStrength?: number;
  toneMapping?: THREE.ToneMapping;
  exposure?: number;
}

export const SafePostProcessing = ({
  bloomStrength = 0.5,
  toneMapping = THREE.ACESFilmicToneMapping,
  exposure = 1.0,
}: SafePostProcessingProps) => {
  const { gl, scene, camera, size } = useThree();
  const pipelineRef = useRef<any>(null);

  useEffect(() => {
    const renderer = gl as any;
    renderer.autoClear = false;

    const { RenderPipeline } = require('three/webgpu');
    const { pass, blur } = require('three/tsl');

    const scenePass = pass(scene, camera);
    let outputNode = scenePass;

    if (bloomStrength > 0) {
      const w = Math.max(1, Math.floor(size.width * 0.25));
      const h = Math.max(1, Math.floor(size.height * 0.25));
      const blurred = blur(scenePass, { width: w, height: h });
      outputNode = scenePass.add(blurred.mul(bloomStrength));
    }

    const pipeline = new RenderPipeline(renderer, outputNode);
    pipelineRef.current = pipeline;

    return () => {
      if (pipelineRef.current) {
        pipelineRef.current.dispose();
        pipelineRef.current = null;
      }
      renderer.autoClear = true;
    };
  }, [gl, scene, camera]);

  useEffect(() => {
    gl.toneMapping = toneMapping;
    gl.toneMappingExposure = exposure;
  }, [gl, toneMapping, exposure]);

  return null;
};
