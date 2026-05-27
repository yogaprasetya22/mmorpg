'use client';

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MapControls,
  PerformanceMonitor,
  AdaptiveEvents,
  AdaptiveDpr,
} from "@react-three/drei";
import { useControls, Leva, folder } from "leva";
import dynamic from 'next/dynamic';

const Perf = dynamic(() => import("r3f-perf").then((mod) => mod.Perf), { ssr: false });

import { EnvironmentMultiGlobal } from "./environment/EnvironmentMultiGlobal";

import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";

import { MapObstacle } from "@/src/core/domain/unit.types";

import { useStore } from "@/src/state/useStore";
import { useEditorStore } from "@/src/state/useEditorStore";
import { API_BASE_URL } from "@/src/core/config";
import React, { useState, useRef, useEffect } from "react";
import { Activity, RefreshCw } from "lucide-react";
import * as THREE from 'three';
import { WorldEditor } from "./environment/WorldEditor";
import { WorldEditorUI } from "./environment/WorldEditorUI";
import { ModularMap } from "./environment/ModularMap";

/**
 * SceneAnalyzer - Diagnostic Tool
 * Scans the scene and logs heavy-hitting meshes and texture counts.
 */
const SceneAnalyzer = () => {
  const { scene, gl } = useThree();
  const lastLog = useRef(0);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastLog.current < 5) return; // Run every 5 seconds
    lastLog.current = now;

    let totalTriangles = 0;
    const meshes: any[] = [];
    const textures = new Set();

    scene.traverse((node: any) => {
      if (node.isMesh || node.isInstancedMesh) {
        const geometry = node.geometry;
        if (geometry) {
          const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
          const triangles = (count / 3) * (node.isInstancedMesh ? node.count : 1);
          totalTriangles += triangles;
          meshes.push({
            name: node.name || node.type,
            triangles: Math.round(triangles),
            isInstanced: !!node.isInstancedMesh
          });
        }

        const scanMaterial = (mat: any) => {
          if (!mat) return;
          if (Array.isArray(mat)) {
            mat.forEach(scanMaterial);
            return;
          }
          Object.values(mat).forEach(val => {
            if (val && (val as any).isTexture) textures.add((val as any).uuid);
          });
        };
        scanMaterial(node.material);
      }
    });

    meshes.sort((a, b) => b.triangles - a.triangles);

    console.log("%c--- 3D SCENE HEAVY HITTER REPORT ---", "color: #ff00ff; font-weight: bold; font-size: 14px;");
    console.log(`Total Triangles: ~${(totalTriangles / 1000000).toFixed(2)}M`);
    console.log(`Unique Textures: ${textures.size}`);
    console.log("Top 10 Heavy Meshes:", meshes.slice(0, 10));
    console.log(`GPU Memory: ~${(gl.info.memory.geometries + gl.info.memory.textures)} objects in GPU`);
    console.log("--------------------------------------");
  });

  return null;
};

/**
 * AdaptivePerformanceOptimizer - High-Fidelity Dynamic Graphics Scaling
 * Monitors FPS in real-time. If performance drops below 53 FPS consistently
 * (e.g., when running multiple side-by-side browser viewports), it dynamically
 * disables shadow maps and screen-space Bloom post-processing to restore a stable 60 FPS.
 */
interface AdaptivePerformanceOptimizerProps {
  settingsRef: React.RefObject<any>;
  adaptivePotatoMode: boolean;
  setAdaptivePotatoMode: React.Dispatch<React.SetStateAction<boolean>>;
  isEditor?: boolean;
}

const AdaptivePerformanceOptimizer = ({
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

interface GameCanvasProps {
  isCinematic: boolean;
  setMapObstacles: (obs: MapObstacle[]) => void;
  mapObstacles: MapObstacle[];
  debug: boolean;
  isFullscreen?: boolean;
  settingsRef: React.RefObject<any>;
  downloadPerfLogs?: () => void;
  clearVFXCache?: () => void;
  isEditor?: boolean;
}

export const GameCanvas = React.memo(({
  isCinematic: _isCinematic,
  debug,
  isFullscreen,
  settingsRef,
  downloadPerfLogs,
  clearVFXCache,
  isEditor = false,
}: GameCanvasProps) => {
  const [dpr, setDpr] = useState(1.0);
  const [envReady, setEnvReady] = useState(false); // Terrain BVH readiness gate
  const [adaptivePotatoMode, setAdaptivePotatoMode] = useState(false);
  const isSettingsOpen = useStore(s => s.isSettingsOpen);
  const selectedMapId = useEditorStore(s => s.selectedMapId);

  // Reset env gate whenever map workspace changes so character re-waits for new BVH
  useEffect(() => {
    setEnvReady(false);
  }, [selectedMapId]);

  // Sync isEditorOpen in the editor store automatically when mounting the editor canvas
  useEffect(() => {
    if (isEditor) {
      useEditorStore.getState().setIsEditorOpen(true);
    }
  }, [isEditor]);

  // Helper to persist updated simulation settings directly into the GORM PostgreSQL backend
  const syncSettingsToBackend = async (updates: Partial<any>) => {
    try {
      const fullSettings = {
        ...settingsRef.current,
        ...updates
      };
      await fetch(`${API_BASE_URL}/api/config/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullSettings)
      });
    } catch (e) {
      console.warn("Failed to sync simulation settings to backend database:", e);
    }
  };

  const { fov, fogDensity, exposure } = useControls("World Tuning", {
    potato: {
      value: !!settingsRef.current.potatoMode, label: "Potato Mode (Extreme FPS)",
      onChange: (v) => {
        settingsRef.current.potatoMode = v;
        syncSettingsToBackend({ potatoMode: v });
      }
    },
    fov: { value: 50, min: 30, max: 90, step: 1, label: "Field of View (FOV)" },
    fogDensity: { value: 0.002, min: 0, max: 0.05, step: 0.0001, label: "Fog Density" },
    fogNear: { value: 60, min: 10, max: 300, step: 5, label: "Fog Near" },
    fogFar: { value: 450, min: 100, max: 1000, step: 10, label: "Fog Far" },
    exposure: { value: 2.0, min: 0.1, max: 4.0, step: 0.1, label: "Sky Exposure" },

    sensitivity: { 
      value: settingsRef.current.mouseSensitivity || 0.002, min: 0.0005, max: 0.01, step: 0.0001, label: "Mouse Sensitivity",
      onChange: (v) => { settingsRef.current.mouseSensitivity = v; }
    },
    vfxQuality: {
      value: settingsRef.current.vfxQuality || 'HIGH', options: ['LOW', 'MEDIUM', 'HIGH'], label: 'VFX Quality',
      onChange: (v) => { settingsRef.current.vfxQuality = v; }
    }
  }, { collapsed: true, render: () => debug }) as any;

  const [{ perfPosition, minimal, deepAnalyze, showPerf }, setDiag] = useControls("Diagnostics", () => ({
    engineTime: { value: 0, label: "Engine Tick (ms)", editable: false },
    suspect: { value: "OPTIMAL", label: "Lag Suspect", editable: false },
    "Performance Tool": folder({
      showPerf: { value: false, label: "Show R3F-Perf" },
      perfPosition: {
        value: "top-right",
        options: ["top-right", "top-left", "bottom-right", "bottom-left"],
        label: "Monitor Position"
      },
      minimal: { value: false, label: "Minimal Stats" },
      deepAnalyze: { value: false, label: "Deep Memory Profile" }
    })
  }), { collapsed: true, render: () => debug });

  // Fix: Move useFrame inside a child component that sits inside <Canvas>
  const DiagnosticsBridge = () => {
    const lastUpdate = useRef(0);
    useFrame((state) => {
      if (!debug) return; // Skip updating Leva diagnostics if debug panel is closed to prevent culling warnings
      
      const now = state.clock.elapsedTime * 1000;
      if (now - lastUpdate.current > 1000) {
        lastUpdate.current = now;
        if (settingsRef.current.telemetry) {
          const { engineMs, bottleneck } = settingsRef.current.telemetry;
          setDiag({ 
            engineTime: typeof engineMs === 'number' ? engineMs : 0, 
            suspect: bottleneck || "OPTIMAL" 
          });
        }
      }
    });
    return null;
  };

  const VisualTuningBridge = ({ fov, fogDensity, exposure }: { fov: number, fogDensity: number, exposure: number }) => {
    const { camera, scene, gl } = useThree();

    useEffect(() => {
      if (camera && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        (camera as THREE.PerspectiveCamera).fov = (fov as number);
        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
      }
    }, [camera, fov]);

    useEffect(() => {
      if (scene.fog) {
        (scene.fog as any).density = fogDensity;
      }
    }, [scene, fogDensity]);

    useEffect(() => {
      gl.toneMappingExposure = exposure;
    }, [gl, exposure]);

    return null;
  };

  return (
    <div className={`w-full h-full overflow-hidden relative bg-slate-950 flex flex-col select-none touch-none ${isFullscreen ? '' : 'rounded-2xl border border-white/10 shadow-2xl'}`}>

      {/* Engine Bridge: Leva Console (Bottom Left) */}
      <div className={`absolute bottom-6 left-6 z-[1200] w-80 transition-all duration-300 shadow-2xl ${!isSettingsOpen ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 pointer-events-auto translate-y-0'}`}>
        <Leva
          hidden={!isSettingsOpen}
          theme={{
            colors: { accent1: '#6366f1', accent2: '#4f46e5', accent3: '#4338ca', elevation1: '#09090bee', elevation2: '#18181bee', elevation3: '#27272aee' },
            radii: { xs: '8px', sm: '12px', lg: '20px' }
          }}
          fill
          flat
          titleBar={{ title: "Supreme Engine Tuning", drag: false }}
        />

        {/* Performance Downloader */}
        {downloadPerfLogs && (
          <button
            onClick={downloadPerfLogs}
            title="Download Performance Analysis Report"
            className="mt-4 w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center gap-3 text-indigo-400 hover:text-indigo-300 transition-all group"
          >
            <Activity className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Download Performance Report</span>
          </button>
        )}

        {clearVFXCache && (
          <button
            onClick={clearVFXCache}
            className="mt-2 w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-2xl flex items-center justify-center gap-3 text-rose-400 hover:text-rose-300 transition-all group"
          >
            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Clear VFX Cache</span>
          </button>
        )}
      </div>
      
      <div className="flex-grow w-full relative h-full">
        <Leva 
          hidden={!debug} 
          theme={{
            colors: { accent1: '#6366f1' },
            sizes: { rootWidth: '320px' }
          }} 
          fill
          flat
        />

        <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-[10px] text-white backdrop-blur-md border border-white/10 pointer-events-none">
          DPR: {(dpr || 1).toFixed(2)}
        </div>

        <Canvas
          shadows="soft"
          dpr={dpr}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: false,
            stencil: false,
            depth: true,
            alpha: false,
            failIfMajorPerformanceCaveat: false,
            precision: "mediump",
          }}
          className="select-none touch-none w-full h-full"
        >
          <SceneAnalyzer />
          <AdaptivePerformanceOptimizer
            settingsRef={settingsRef}
            adaptivePotatoMode={adaptivePotatoMode}
            setAdaptivePotatoMode={setAdaptivePotatoMode}
            isEditor={isEditor}
          />
          <PerformanceMonitor onIncline={() => setDpr(Math.min(dpr + 0.05, 0.9))} onDecline={() => setDpr(Math.max(dpr - 0.05, 0.6))} />

          <AdaptiveEvents />
          <AdaptiveDpr pixelated={true} />

          {(showPerf || isEditor) && (
            <Perf
              position={isEditor ? "bottom-right" : perfPosition}
              minimal={minimal}
              showGraph={!minimal}
              deepAnalyze={deepAnalyze}
              className="z-[2000]"
            />
          )}

          {(isEditor || (!isFullscreen && !envReady)) && (
            <MapControls
              enableDamping={true}
              dampingFactor={0.05}
              screenSpacePanning={true}
              minDistance={1}
              maxDistance={800}
              maxPolarAngle={Math.PI / 2.1}
              minPolarAngle={0}
              mouseButtons={{
                LEFT: null as any,
                MIDDLE: THREE.MOUSE.ROTATE,
                RIGHT: THREE.MOUSE.PAN
              }}
              makeDefault
            />
          )}

          <EnvironmentMultiGlobal
            settingsRef={settingsRef}
            debug={debug}
            onReady={() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => setEnvReady(true));
              });
            }}
          />

          <ModularMap debug={debug} />
          {isEditor && <WorldEditor />}

          <DiagnosticsBridge />
          <VisualTuningBridge fov={fov} fogDensity={fogDensity} exposure={exposure} />



          {!settingsRef.current.potatoMode && !adaptivePotatoMode && (
            <EffectComposer enableNormalPass={false} multisampling={0}>
              <Bloom luminanceThreshold={1.0} mipmapBlur intensity={0.5} radius={0.4} />
              <ToneMapping adaptive={false} />
            </EffectComposer>
          )}
        </Canvas>
      </div>
      {isEditor && <WorldEditorUI />}
    </div>
  );
});
GameCanvas.displayName = "GameCanvas";
