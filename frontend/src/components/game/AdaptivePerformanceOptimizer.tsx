'use client';

import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * AdaptivePerformanceOptimizer - High-Fidelity Dynamic Graphics Scaling
 * Monitors FPS in real-time. If performance drops below 53 FPS consistently
 * (e.g., when running multiple side-by-side browser viewports), it dynamically
 * disables shadow maps and screen-space Bloom post-processing to restore a stable 60 FPS.
 */
export interface AdaptivePerformanceOptimizerProps {
  settingsRef: React.RefObject<any>;
  adaptivePotatoMode: boolean;
  setAdaptivePotatoMode: React.Dispatch<React.SetStateAction<boolean>>;
  isEditor?: boolean;
}

export const AdaptivePerformanceOptimizer = ({
  settingsRef,
  adaptivePotatoMode,
  setAdaptivePotatoMode,
  isEditor = false
}: AdaptivePerformanceOptimizerProps) => {
  const { gl } = useThree();
  const lastTime = useRef(performance.now());
  const frameCount = useRef(0);
  const struggleSeconds = useRef(0);
  const healthySeconds = useRef(0);

  // If we are in the editor, completely bypass auto-potato downscaling to keep shadows beautiful!
  if (isEditor) return null;

  useFrame(() => {
    const now = performance.now();
    frameCount.current++;

    if (now - lastTime.current >= 1000) {
      const fps = (frameCount.current * 1000) / (now - lastTime.current);
      frameCount.current = 0;
      lastTime.current = now;

      // Log frame diagnostics to settings for tuning
      if (settingsRef.current) {
        if (!settingsRef.current.telemetry) settingsRef.current.telemetry = {};
        settingsRef.current.telemetry.fps = Math.round(fps);
      }

      if (fps < 45) {
        struggleSeconds.current++;
        healthySeconds.current = 0;

        // After 15 seconds of sustained struggling FPS, scale down graphics properties
        if (struggleSeconds.current >= 15 && !adaptivePotatoMode) {
          console.warn(`⚠️ Adaptive Graphics: Performance drop detected (~${Math.round(fps)} FPS). Dynamic scaling active: Disabling Bloom and Shadows.`);
          setAdaptivePotatoMode(true);
          gl.shadowMap.enabled = false;
        }
      } else if (fps >= 58) {
        healthySeconds.current++;
        struggleSeconds.current = 0;

        // If performance has stabilized and is highly consistent for 8 seconds, restore higher-fidelity settings
        if (healthySeconds.current >= 8 && adaptivePotatoMode && !settingsRef.current.potatoMode) {
          console.log("✨ Adaptive Graphics: Performance stabilized. Restoring high-fidelity Bloom and Shadows.");
          setAdaptivePotatoMode(false);
          gl.shadowMap.enabled = true;
        }
      }
    }
  });

  return null;
};
