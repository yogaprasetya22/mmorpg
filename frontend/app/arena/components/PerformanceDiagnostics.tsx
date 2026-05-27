/** Performance telemetry collector and diagnostic report generator inside R3F useFrame. */
'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { PlayerNetworkState, MonsterNetworkState } from '@/src/hooks/useWebSocketGame';

interface PerformanceDiagnosticsProps {
  connectedPlayersRef: React.RefObject<PlayerNetworkState[]>;
  worldMonstersRef: React.RefObject<MonsterNetworkState[]>;
  selectedMapId: string;
  dpr: number;
  potatoMode: boolean;
}

export function PerformanceDiagnostics({
  connectedPlayersRef,
  worldMonstersRef,
  selectedMapId,
  dpr,
  potatoMode
}: PerformanceDiagnosticsProps) {
  const { gl } = useThree();
  const lastUpdate = useRef(0);
  const frameTimes = useRef<number[]>([]);
  const lastFrameTime = useRef(performance.now());

  // Performance Logger Rolling Buffers
  const sessionStartTime = useRef(new Date());
  const frameHistory = useRef<any[]>([]);
  const lagSpikes = useRef<any[]>([]);
  const totalFrames = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ';') {
        e.preventDefault();

        const glContext = gl.getContext();
        const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info');
        const gpuVendor = debugInfo ? glContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : "Unknown Vendor";
        const gpuRenderer = debugInfo ? glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Unknown Renderer";

        const mem = (performance as any).memory;
        const memoryInfo = mem ? {
          jsHeapSizeLimitMb: Math.round(mem.jsHeapSizeLimit / (1024 * 1024)),
          totalJSHeapSizeMb: Math.round(mem.totalJSHeapSize / (1024 * 1024)),
          usedJSHeapSizeMb: Math.round(mem.usedJSHeapSize / (1024 * 1024))
        } : {
          jsHeapSizeLimitMb: null,
          totalJSHeapSizeMb: null,
          usedJSHeapSizeMb: null
        };

        const deltas = frameHistory.current.map(h => h.d);
        if (deltas.length === 0) {
          alert("Mohon tunggu beberapa detik hingga data frame terisi sebelum mengunduh.");
          return;
        }

        const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const avgFps = Math.round(1000 / avgDelta) || 60;

        const sortedDeltas = deltas.slice().sort((a, b) => a - b);
        const p99 = sortedDeltas[Math.floor(sortedDeltas.length * 0.99)] || sortedDeltas[sortedDeltas.length - 1];
        const p999 = sortedDeltas[Math.floor(sortedDeltas.length * 0.999)] || sortedDeltas[sortedDeltas.length - 1];

        const maxDelta = sortedDeltas[sortedDeltas.length - 1] || 16.6;
        const minDelta = sortedDeltas[0] || 16.6;

        const report = {
          sessionInfo: {
            startTime: sessionStartTime.current.toISOString(),
            reportTime: new Date().toISOString(),
            activeMapId: selectedMapId,
            currentDpr: dpr,
            potatoModeActive: potatoMode
          },
          systemInfo: {
            userAgent: navigator.userAgent,
            devicePixelRatio: window.devicePixelRatio,
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
            gpuVendor,
            gpuRenderer,
            webglVersion: glContext.getParameter(glContext.VERSION),
            supportedExtensionsCount: glContext.getSupportedExtensions()?.length || 0
          },
          memoryInfo,
          performanceSummary: {
            averageFps: avgFps,
            minFps: Math.round(1000 / maxDelta),
            maxFps: Math.round(1000 / minDelta),
            onePercentLowFps: Math.round(1000 / p99),
            zeroOnePercentLowFps: Math.round(1000 / p999),
            totalFramesTracked: totalFrames.current,
            totalLagSpikesCount: lagSpikes.current.length
          },
          lagSpikes: lagSpikes.current,
          rollingFrameHistory: frameHistory.current
        };

        const json = JSON.stringify(report, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mmorpg_perf_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`📊 [SEAL M MMORPG PERF REPORT]\n\nLaporan performa sukses diunduh!\n\n- Rata-rata FPS: ${avgFps}\n- 1% Low (Micro-Stutters): ${Math.round(1000 / p99)} FPS\n- Total Lag Spikes Terdeteksi: ${lagSpikes.current.length}\n- Active Entities: Players: ${connectedPlayersRef.current?.length || 0}, Monsters: ${worldMonstersRef.current?.length || 0}\n\nSilakan berikan file JSON tersebut kepada developer untuk analisis mendalam!`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gl, selectedMapId, dpr, potatoMode, connectedPlayersRef, worldMonstersRef]);

  useFrame(() => {
    const now = performance.now();
    const delta = now - lastFrameTime.current;
    lastFrameTime.current = now;

    totalFrames.current++;

    frameTimes.current.push(delta);
    if (frameTimes.current.length > 30) frameTimes.current.shift();

    const fps = Math.round(1000 / delta) || 60;
    const drawCalls = gl.info.render.calls;
    const triangles = gl.info.render.triangles;
    const geometries = gl.info.memory.geometries;
    const textures = gl.info.memory.textures;

    const playersCount = connectedPlayersRef.current?.length || 0;
    const monstersCount = worldMonstersRef.current?.length || 0;

    // Track rolling frame sample (up to 50000 frames)
    const mem = (performance as any).memory;
    const currentSample = {
      f: totalFrames.current,
      d: parseFloat(delta.toFixed(2)),
      fps: fps,
      dc: drawCalls,
      tr: triangles,
      p: playersCount,
      m: monstersCount,
      mem: mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : undefined
    };

    frameHistory.current.push(currentSample);
    if (frameHistory.current.length > 50000) {
      frameHistory.current.shift();
    }

    // Detect lag spikes: frame time > 50ms = drops below 20 FPS
    // Ignore first 60 frames (1 second of load time) to avoid initial loading spike false positives
    if (delta > 50 && totalFrames.current > 60) {
      lagSpikes.current.push({
        timestamp: parseFloat((Date.now() - sessionStartTime.current.getTime()).toFixed(0)),
        frameIndex: totalFrames.current,
        durationMs: parseFloat(delta.toFixed(2)),
        instantFps: fps,
        playersCount,
        monstersCount,
        drawCalls,
        triangles,
        memoryMb: mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : null
      });

      if (lagSpikes.current.length > 200) {
        lagSpikes.current.shift();
      }
    }

    if (now - lastUpdate.current < 500) return; // Update DOM every 500ms
    lastUpdate.current = now;

    const avgDelta = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
    const smoothedFps = Math.round(1000 / avgDelta) || 60;

    // Update DOM directly for zero React overhead
    const elFps = document.getElementById("diag-fps");
    const elDraw = document.getElementById("diag-draw");
    const elTri = document.getElementById("diag-tri");
    const elGeo = document.getElementById("diag-geo");
    const elTex = document.getElementById("diag-tex");
    const elMonsters = document.getElementById("diag-monsters");
    const elPlayers = document.getElementById("diag-players");
    const elStatus = document.getElementById("diag-status");

    if (elFps) {
      elFps.innerText = `${smoothedFps} FPS`;
      if (smoothedFps < 30) {
        elFps.className = "text-red-500 font-black animate-pulse";
      } else if (smoothedFps < 50) {
        elFps.className = "text-amber-500 font-black";
      } else {
        elFps.className = "text-emerald-400 font-black";
      }
    }
    if (elDraw) {
      elDraw.innerText = drawCalls.toString();
      elDraw.className = drawCalls > 350 ? "text-red-500 font-black" : (drawCalls > 180 ? "text-amber-500 font-black" : "text-emerald-400 font-black");
    }
    if (elTri) {
      const triK = Math.round(triangles / 1000);
      elTri.innerText = `${triK}K`;
      elTri.className = triangles > 300000 ? "text-red-500 font-black" : (triangles > 150000 ? "text-amber-500 font-black" : "text-emerald-400 font-black");
    }
    if (elGeo) elGeo.innerText = geometries.toString();
    if (elTex) elTex.innerText = textures.toString();
    if (elMonsters) elMonsters.innerText = monstersCount.toString();
    if (elPlayers) elPlayers.innerText = playersCount.toString();

    if (elStatus) {
      if (smoothedFps < 45) {
        if (drawCalls > 350) {
          elStatus.innerText = "CPU: DRAW CALLS TERLALU TINGGI";
          elStatus.className = "text-red-400 font-black uppercase text-[7px] tracking-wide animate-pulse";
        } else if (triangles > 400000) {
          elStatus.innerText = "GPU: POLIGON/TRI TERLALU BANYAK";
          elStatus.className = "text-red-400 font-black uppercase text-[7px] tracking-wide animate-pulse";
        } else if (monstersCount > 80) {
          elStatus.innerText = "JS: TERLALU BANYAK ENTITY AKTIF";
          elStatus.className = "text-amber-400 font-black uppercase text-[7px] tracking-wide";
        } else {
          elStatus.innerText = "PERFORMA TURUN (LOAD TINGGI)";
          elStatus.className = "text-amber-400 font-black uppercase text-[7px] tracking-wide";
        }
      } else {
        elStatus.innerText = "PERFORMA STABIL & SEHAT";
        elStatus.className = "text-emerald-400 font-black uppercase text-[7px] tracking-wide";
      }
    }
  });

  return null;
}
