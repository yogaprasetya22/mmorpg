/** FPS counter updater (R3F useFrame emitter) and FPS badge DOM display. */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/** Emits a custom DOM event 'fps-update' every 1s with the current FPS count. Renders nothing. */
export const FPSCounterUpdater = () => {
  // eslint-disable-next-line react-hooks/purity -- Lazy init with performance.now() is intentional for frame timing
  const lastTime = useRef(performance.now());
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    if (now >= lastTime.current + 1000) {
      const calculatedFps = Math.round((frameCount.current * 1000) / (now - lastTime.current));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fps-update', { detail: calculatedFps }));
      }
      frameCount.current = 0;
      lastTime.current = now;
    }
  });

  return null;
};

/** Listens to 'fps-update' events and displays a colored FPS badge. */
export const FPSBadge = () => {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    const handler = (e: Event) => {
      setFps((e as CustomEvent).detail);
    };
    window.addEventListener('fps-update', handler);
    return () => window.removeEventListener('fps-update', handler);
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${fps >= 55 ? "bg-emerald-400 animate-pulse" : fps >= 30 ? "bg-amber-400" : "bg-red-400"}`} />
      <span className={`text-[10px] font-black ${fps >= 55 ? "text-emerald-400" : fps >= 30 ? "text-amber-400" : "text-red-400"}`}>{fps} FPS</span>
    </div>
  );
};
