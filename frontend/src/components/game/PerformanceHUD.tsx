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
 * Toggle with F3 key. Zero React re-renders after mount —
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
  const visibleRef = useRef(true);

  // Frame tracking — lazy init to avoid impure calls during render
  const frameTimes = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(null!);
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef<number>(null!);
  // Track peak render stats within the update window (gl.info resets per frame,
  // and post-processing may overwrite values, so we capture the max seen).
  const peakDrawCalls = useRef(0);
  const peakTriangles = useRef(0);

  // Mount the HUD DOM once, outside React's tree
  useEffect(() => {
    const wrapper = document.createElement('div');
    wrapper.id = 'perf-hud-portal';
    wrapper.innerHTML = `
      <div style="position:fixed;top:8px;left:8px;z-index:9999;background:rgba(0,0,0,0.78);color:#0f0;font-family:'Press Start 2P',monospace;font-size:10px;line-height:1.7;padding:8px 12px;border-radius:6px;border:1px solid rgba(0,255,0,0.3);pointer-events:none;user-select:none;backdrop-filter:blur(4px);">
        <div style="color:#0f0;margin-bottom:4px;font-size:11px;">⚡ PERF HUD <span style="color:#666;font-size:8px;">[F3]</span></div>
        <div>FPS: <span id="perf-fps" style="color:#fff;">--</span></div>
        <div>Frame: <span id="perf-frame" style="color:#fff;">--</span></div>
        <div>Draws: <span id="perf-draws" style="color:#fff;">--</span></div>
        <div>Tris: <span id="perf-tris" style="color:#fff;">--</span></div>
        <div style="margin-top:4px;border-top:1px solid rgba(0,255,0,0.2);padding-top:4px;">
          <div>Players: <span id="perf-players" style="color:#0ff;">--</span></div>
          <div>Monsters: <span id="perf-monsters" style="color:#f80;">--</span></div>
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
      if (playerEl.current) playerEl.current.textContent = `${connectedPlayersRef?.current?.length ?? 0}`;
      if (monsterEl.current) monsterEl.current.textContent = `${worldMonstersRef?.current?.length ?? 0}`;

      frameCount.current = 0;
      peakDrawCalls.current = 0;
      peakTriangles.current = 0;
      lastFpsUpdate.current = now;
    }
  });

  // Toggle visibility with F3
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        visibleRef.current = !visibleRef.current;
        if (containerRef.current) {
          containerRef.current.style.display = visibleRef.current ? 'block' : 'none';
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return null; // No JSX rendered — HUD lives in DOM portal
};
