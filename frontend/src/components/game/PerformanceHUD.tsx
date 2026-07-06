'use client';

/**
 * PerformanceHUD — Real-time in-game performance monitoring overlay.
 *
 * Displays:
 * - FPS (current + average frame time)
 * - Draw calls & triangles (WebGL renderer info)
 * - Remote player count
 * - Remote monster count
 *
 * Always visible — profiling mode. Zero React re-renders after mount —
 * all DOM updates happen via direct element references in useFrame.
 */

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PlayerNetworkState } from '@/src/hooks/useWebSocketGame';

interface PerformanceHUDProps {
  connectedPlayersRef?: React.RefObject<PlayerNetworkState[]>;
  worldMonstersRef?: React.RefObject<any[]>;
}

export const PerformanceHUD = ({ connectedPlayersRef, worldMonstersRef }: PerformanceHUDProps) => {
  const { gl } = useThree();

  // Direct DOM element references — updated imperatively, no React re-renders
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fpsEl = useRef<HTMLElement | null>(null);
  const frameEl = useRef<HTMLElement | null>(null);
  const drawEl = useRef<HTMLElement | null>(null);
  const triEl = useRef<HTMLElement | null>(null);
  const playerEl = useRef<HTMLElement | null>(null);
  const monsterEl = useRef<HTMLElement | null>(null);

  // Frame tracking — lazy init to avoid impure calls during render
  const frameTimes = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(null!);
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef<number>(null!);
  // Track peak render stats within the update window (gl.info resets per frame,
  // and post-processing may overwrite values, so we capture the max seen).
  const peakDrawCalls = useRef(0);
  const peakTriangles = useRef(0);
  // Long-task tracking (PerformanceObserver feeds getLongTaskStats, polled every 500ms)
  const longTaskEl = useRef<HTMLElement | null>(null);
  const stddevEl = useRef<HTMLElement | null>(null);

  // Mount the HUD DOM once, outside React's tree
  useEffect(() => {
    const wrapper = document.createElement('div');
    wrapper.id = 'perf-hud-portal';
    wrapper.innerHTML = `
      <div style="position:fixed;top:8px;left:8px;z-index:9999;background:rgba(0,0,0,0.78);color:#0f0;font-family:'Press Start 2P',monospace;font-size:10px;line-height:1.7;padding:8px 12px;border-radius:6px;border:1px solid rgba(0,255,0,0.3);pointer-events:none;user-select:none;backdrop-filter:blur(4px);">
        <div style="color:#0f0;margin-bottom:4px;font-size:11px;">⚡ PERF HUD</div>
        <div>FPS: <span id="perf-fps" style="color:#fff;">--</span></div>
        <div>Frame: <span id="perf-frame" style="color:#fff;">--</span></div>
        <div>σdt: <span id="perf-stddev" style="color:#a78bfa;">--</span></div>
        <div>Draws: <span id="perf-draws" style="color:#fff;">--</span></div>
        <div>Tris: <span id="perf-tris" style="color:#fff;">--</span></div>
        <div style="margin-top:4px;border-top:1px solid rgba(0,255,0,0.2);padding-top:4px;">
          <div>Players: <span id="perf-players" style="color:#0ff;">--</span></div>
          <div>Monsters: <span id="perf-monsters" style="color:#f80;">--</span></div>
          <div>LongTasks: <span id="perf-longtasks" style="color:#f87171;">--</span></div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);

    // Cache DOM references for direct updates
    containerRef.current = wrapper.firstElementChild as HTMLDivElement;
    fpsEl.current = document.getElementById('perf-fps');
    frameEl.current = document.getElementById('perf-frame');
    drawEl.current = document.getElementById('perf-draws');
    triEl.current = document.getElementById('perf-tris');
    playerEl.current = document.getElementById('perf-players');
    monsterEl.current = document.getElementById('perf-monsters');
    longTaskEl.current = document.getElementById('perf-longtasks');
    stddevEl.current = document.getElementById('perf-stddev');

    // Lazy-init timing refs inside effect (not during render)
    if (lastFrameTime.current === null) lastFrameTime.current = performance.now();
    if (lastFpsUpdate.current === null) lastFpsUpdate.current = performance.now();
    return () => {
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };
  }, []);

  // Update HUD values at ~2Hz from useFrame (no React re-renders)
  useFrame(() => {
    const now = performance.now();
    const delta = now - lastFrameTime.current;
    lastFrameTime.current = now;
    frameCount.current++;

    frameTimes.current.push(delta);
    if (frameTimes.current.length > 60) frameTimes.current.shift();

    // Capture peak render stats every frame (gl.info resets each frame,
    // and post-processing may overwrite, so we track the maximum seen).
    const info = gl.info;
    if (info.render.calls > peakDrawCalls.current) peakDrawCalls.current = info.render.calls;
    if (info.render.triangles > peakTriangles.current) peakTriangles.current = info.render.triangles;

    // Update DOM at ~2Hz
    if (now - lastFpsUpdate.current >= 500) {
      const elapsed = (now - lastFpsUpdate.current) / 1000;
      const fps = Math.round(frameCount.current / elapsed);
      const avgFrame = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;

      if (fpsEl.current) fpsEl.current.textContent = `${fps}`;
      if (frameEl.current) frameEl.current.textContent = `${avgFrame.toFixed(1)}ms`;
      if (drawEl.current) drawEl.current.textContent = `${peakDrawCalls.current}`;
      if (triEl.current) triEl.current.textContent = `${(peakTriangles.current / 1000).toFixed(1)}k`;
      // Frame time stddev (jitter indicator)
      const mean = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
      const variance = frameTimes.current.reduce((s, v) => s + (v - mean) ** 2, 0) / frameTimes.current.length;
      const stddev = Math.sqrt(variance);

      if (playerEl.current) playerEl.current.textContent = `${connectedPlayersRef?.current?.length ?? 0}`;
      if (monsterEl.current) monsterEl.current.textContent = `${worldMonstersRef?.current?.length ?? 0}`;
      if (stddevEl.current) stddevEl.current.textContent = `${stddev.toFixed(1)}ms`;

      frameCount.current = 0;
      peakDrawCalls.current = 0;
      peakTriangles.current = 0;
      // Poll long-task stats from the PerformanceObserver detector
      let longTaskText = 'N/A';
      try {
        const stats = (window as any).__longTaskStats;
        if (stats) {
          longTaskText = `c:${stats.count} tot:${stats.totalMs.toFixed(0)}ms`;
        }
      } catch (_) { }

      if (longTaskEl.current) longTaskEl.current.textContent = longTaskText;

      lastFpsUpdate.current = now;
    }
  });

  return null; // No JSX rendered — HUD lives in DOM portal
};
