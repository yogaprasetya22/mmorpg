'use client';

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MapControls,
} from "@react-three/drei";
import { useControls, Leva, folder } from "leva";
import dynamic from 'next/dynamic';

const Perf = dynamic(() => import("r3f-perf").then((mod) => mod.Perf), { ssr: false });
const WorldEditor = dynamic(
  () => import("./environment/WorldEditor").then((mod) => mod.WorldEditor),
  { ssr: false }
);
const WorldEditorUI = dynamic(
  () => import("./environment/WorldEditorUI").then((mod) => mod.WorldEditorUI),
  { ssr: false }
);
import { ModularMap } from "./environment/ModularMap";

import { EnvironmentMultiGlobal } from "./environment/EnvironmentMultiGlobal";
import { MapObstacle } from "@/src/core/domain/unit.types";
import { useStore } from "@/src/state/useStore";
import { useEditorStore } from "@/src/state/useEditorStore";
import { API_BASE_URL } from "@/src/core/config";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Activity, RefreshCw } from "lucide-react";
import * as THREE from 'three';

// Imported Standalone Components
import { SceneAnalyzer } from "./SceneAnalyzer";
import { CameraOcclusionManager } from "./systems/CameraOcclusionManager";

// New performance components
import FrameSkipper from "./systems/FrameSkipper";
import { EntityUpdateSystem } from "./systems/EntityUpdateSystem";
import { EmptyDrawGuard } from "./systems/EmptyDrawGuard";
import { OptimizedPostProcessing } from "./systems/OptimizedPostProcessing";

// Arena/Multiplayer Components
import { PlayerController } from "./PlayerController";
import { RemotePlayersRenderer } from "./RemotePlayersRenderer";
import { RemoteMonstersRenderer } from "./RemoteMonstersRenderer";
import { VFXProvider } from "./systems/VFXManager";
import { DamageHUDBatcher } from "./systems/DamageHUDBatcher";
import { ArcherTrapSystem } from "./systems/ArcherTrapSystem";
import { BeginnerSpellEffect } from "./systems/effects/BeginnerSpellEffect";
import { FighterSpellEffect } from "./systems/effects/FighterSpellEffect";
import { TankSpellEffect } from "./systems/effects/TankSpellEffect";
import { AssassinSpellEffect } from "./systems/effects/AssassinSpellEffect";
import { MageSpellEffect } from "./systems/effects/MageSpellEffect";
import { ModelsPreloader } from "@/app/arena/components/ModelsPreloader";
import { FPSCounterUpdater } from "@/app/arena/components/FPSCounter";

// Monkey-patch THREE.DataTextureLoader to fix multiple bugs in Three.js core:
// 1. If onError is undefined, it attempts to execute the local error object as a function (error(error)).
// 2. If onError is defined, it runs it but does NOT return, causing a crash at `if ( texData.image !== undefined )` because texData is undefined.
if (typeof window !== 'undefined' && THREE.DataTextureLoader) {
  THREE.DataTextureLoader.prototype.load = function (url: string, onLoad?: (texture: THREE.DataTexture, texData: object) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void) {
    const scope = this;
    const texture = new THREE.DataTexture();

    const loader = new THREE.FileLoader(this.manager);
    loader.setResponseType('arraybuffer');
    loader.setRequestHeader(this.requestHeader);
    loader.setPath(this.path);
    loader.setWithCredentials(scope.withCredentials);

    loader.load(
      url,
      function (buffer: string | ArrayBuffer) {
        let texData;
        try {
          texData = (scope as any).parse(buffer);
        } catch (error) {
          if (onError !== undefined) {
            onError(error);
          } else {
            console.error("[THREE.DataTextureLoader] Parse failed:", error);
          }
          return; // Fix: Always return when parsing fails!
        }

        if (texData.image !== undefined) {
          texture.image = texData.image;
        } else if (texData.data !== undefined) {
          texture.image.width = texData.width;
          texture.image.height = texData.height;
          texture.image.data = texData.data;
        }

        texture.wrapS = texData.wrapS !== undefined ? texData.wrapS : THREE.ClampToEdgeWrapping;
        texture.wrapT = texData.wrapT !== undefined ? texData.wrapT : THREE.ClampToEdgeWrapping;

        texture.magFilter = texData.magFilter !== undefined ? texData.magFilter : THREE.LinearFilter;
        texture.minFilter = texData.minFilter !== undefined ? texData.minFilter : THREE.LinearFilter;

        texture.anisotropy = texData.anisotropy !== undefined ? texData.anisotropy : 1;

        if (texData.colorSpace !== undefined) {
          texture.colorSpace = texData.colorSpace;
        }

        if (texData.flipY !== undefined) {
          texture.flipY = texData.flipY;
        }

        if (texData.format !== undefined) {
          texture.format = texData.format;
        }

        if (texData.type !== undefined) {
          texture.type = texData.type;
        }

        if (texData.mipmaps !== undefined) {
          texture.mipmaps = texData.mipmaps;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
        }

        if (texData.mipmapCount === 1) {
          texture.minFilter = THREE.LinearFilter;
        }

        if (texData.generateMipmaps !== undefined) {
          texture.generateMipmaps = texData.generateMipmaps;
        }

        texture.needsUpdate = true;

        if (onLoad) onLoad(texture, texData);
      },
      onProgress,
      onError
    );

    return texture;
  };
}

export interface ArenaState {
  envReady: boolean;
  localPlayerModelPath: string;
  selectedCharacter: any;
  damageQueue: React.RefObject<any[]>;
  mmSpellsRef: React.RefObject<any[]>;
  spellsRef: React.RefObject<any[]>;
  fighterSpellsRef: React.RefObject<any[]>;
  tankSpellsRef: React.RefObject<any[]>;
  assassinSpellsRef: React.RefObject<any[]>;
  simTimeRef: React.RefObject<number>;
  dealPlayerDamage: (monsterId: string, damage?: number, isCrit?: boolean) => void;
  sendPlayerState: any;
  sendPlayerSkill: any;
  playerStatsRef: React.RefObject<any>;
  isAutoMode: boolean;
  activeRemotePlayers: any[];
  connectedPlayersRef: React.RefObject<any[]>;
  gameConfig: any;
  unitRegistryRef: React.RefObject<any[]>;
  worldMonstersRef: React.RefObject<any[]>;
  setModelsReady: (ready: boolean) => void;
  setEnvFinished: (finished: boolean) => void;
  spawnVFX: any;
}

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
  arenaState?: ArenaState;
}

/**
 * Fixed DPR cap — coarse pointer (mobile/tablet) = 1.25, fine = 1.5.
 * Lower fragment-shader cost than the old AdaptiveDpr monitoring loop.
 */
const MAX_DPR = typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5

export const GameCanvas = React.memo(({
  isCinematic: _isCinematic,
  debug,
  isFullscreen,
  settingsRef,
  downloadPerfLogs,
  clearVFXCache,
  isEditor = false,
  arenaState,
}: GameCanvasProps) => {
  const [dpr] = useState(MAX_DPR);
  const [envReady, setEnvReady] = useState(false); // Terrain BVH readiness gate
  const isSettingsOpen = useStore(s => s.isSettingsOpen);
  const selectedMapId = useEditorStore(s => s.selectedMapId);
  const bloomThreshold = useEditorStore(s => s.bloomThreshold);
  const bloomStrength = useEditorStore(s => s.bloomStrength);
  const bloomRadius = useEditorStore(s => s.bloomRadius);

  // Reset env gate whenever map workspace changes so character re-waits for new BVH
  useEffect(() => {
    setEnvReady(false);
  }, [selectedMapId]);

  // Sync isEditorOpen with isEditor prop — prevents editor state leak into arena
  useEffect(() => {
    useEditorStore.getState().setIsEditorOpen(isEditor);
  }, [isEditor]);

  // Helper to persist updated simulation settings directly into the GORM PostgreSQL backend
  const syncSettingsToBackend = async (updates: Partial<any>) => {
    try {
      const fullSettings = {
        ...settingsRef.current,
        ...updates
      };
      const token = typeof window !== 'undefined' ? localStorage.getItem("game_auth_token") : "";
      await fetch(`${API_BASE_URL}/api/config/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
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
    exposure: { value: 1.0, min: 0.1, max: 4.0, step: 0.1, label: "Sky Exposure" },

    sensitivity: {
      value: settingsRef.current.mouseSensitivity || 0.002, min: 0.0005, max: 0.01, step: 0.0001, label: "Mouse Sensitivity",
      onChange: (v) => { settingsRef.current.mouseSensitivity = v; }
    },
    vfxQuality: {
      value: settingsRef.current.vfxQuality || 'HIGH', options: ['LOW', 'MEDIUM', 'HIGH'], label: 'VFX Quality',
      onChange: (v) => { settingsRef.current.vfxQuality = v; }
    }
  }, { collapsed: true, render: () => debug }) as any;

  const [{ minimal, deepAnalyze }, setDiag] = useControls("Diagnostics", () => ({
    engineTime: { value: 0, label: "Engine Tick (ms)", editable: false },
    suspect: { value: "OPTIMAL", label: "Lag Suspect", editable: false },
    "Performance Tool": folder({
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
  // Memoize to preserve component identity across re-renders (prevents unmount/remount)
  const DiagnosticsBridge = useMemo(() => {
    const Bridge = () => {
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
    return Bridge;
  }, [debug, setDiag, settingsRef]);

  const VisualTuningBridge = ({ fov, fogDensity }: { fov: number, fogDensity: number }) => {
    const { camera, scene, gl } = useThree();

    // Suppress deprecation warn — PCFSoftShadowMap removed in r183+, use PCFShadowMap
    useEffect(() => {
      gl.shadowMap.type = THREE.PCFShadowMap;
    }, [gl]);

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

    return null;
  };

  const isPotato = settingsRef.current.potatoMode;

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
          shadows={{
            type: THREE.PCFShadowMap,
          }}
          dpr={[1, dpr]}
          camera={{ position: [0, 60, 120], fov: 50 }}
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
          {debug && <SceneAnalyzer />}
          {/* Phase 1: Passive frame skipper (50fps cap, doesn't break init) */}
          <FrameSkipper fps={50} />

          {/* Phase 3.2: Entity update system (imperative transform sync) */}
          <EntityUpdateSystem />

          {/* Phase 7.2: Empty draw guard (prevent WebGL/WebGPU crashes) */}
          <EmptyDrawGuard />

          <Perf
            position="bottom-right"
            minimal={minimal}
            showGraph={!minimal}
            deepAnalyze={deepAnalyze}
            className="z-[2000]"
          />

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
                requestAnimationFrame(() => {
                  setEnvReady(true);
                  if (arenaState) {
                    setTimeout(() => {
                      arenaState.setEnvFinished(true);
                    }, 600);
                  }
                });
              });
            }}
          />

          <ModularMap debug={debug} />
          {!isEditor && <CameraOcclusionManager />}
          {isEditor && <WorldEditor />}

          {arenaState && (
            <VFXProvider>
              <ModelsPreloader onReady={() => { (arenaState as any).setModelsReady(true) }} />

              <BeginnerSpellEffect spellsRef={arenaState.mmSpellsRef} unitRegistry={arenaState.unitRegistryRef} simTimeRef={arenaState.simTimeRef} />
              <FighterSpellEffect fighterSpellsRef={arenaState.fighterSpellsRef} simTimeRef={arenaState.simTimeRef} />
              <TankSpellEffect tankSpellsRef={arenaState.tankSpellsRef} simTimeRef={arenaState.simTimeRef} unitRegistry={arenaState.unitRegistryRef} />
              <AssassinSpellEffect assassinSpellsRef={arenaState.assassinSpellsRef} simTimeRef={arenaState.simTimeRef} />
              <MageSpellEffect spellsRef={arenaState.spellsRef} unitRegistry={arenaState.unitRegistryRef} simTimeRef={arenaState.simTimeRef} />

              <DamageHUDBatcher
                damageQueue={arenaState.damageQueue}
                playerStatsRef={arenaState.playerStatsRef}
              />

              <ArcherTrapSystem
                unitRegistry={arenaState.unitRegistryRef}
                dealPlayerDamage={arenaState.dealPlayerDamage}
                spawnVFX={arenaState.spawnVFX}
              />

              <PlayerController
                paused={!arenaState.envReady}
                modelPath={arenaState.localPlayerModelPath}
                playerClass={arenaState.selectedCharacter?.class || "Warrior"}
                settingsRef={settingsRef}
                damageQueue={arenaState.damageQueue}
                mmSpellsRef={arenaState.mmSpellsRef}
                spellsRef={arenaState.spellsRef}
                fighterSpellsRef={arenaState.fighterSpellsRef}
                tankSpellsRef={arenaState.tankSpellsRef}
                assassinSpellsRef={arenaState.assassinSpellsRef}
                simTimeRef={arenaState.simTimeRef}
                dealPlayerDamage={arenaState.dealPlayerDamage}
                sendPlayerState={arenaState.sendPlayerState}
                sendPlayerSkill={arenaState.sendPlayerSkill}
                playerStats={arenaState.playerStatsRef.current?.hp >= 0 ? arenaState.playerStatsRef.current : undefined}
                playerStatsRef={arenaState.playerStatsRef}
                selectedCharacter={arenaState.selectedCharacter}
                isAutoMode={arenaState.isAutoMode}
              />

              <RemotePlayersRenderer
                activeRemotePlayers={arenaState.activeRemotePlayers}
                connectedPlayersRef={arenaState.connectedPlayersRef}
                gameConfig={arenaState.gameConfig}
                mmSpellsRef={arenaState.mmSpellsRef}
                spellsRef={arenaState.spellsRef}
                fighterSpellsRef={arenaState.fighterSpellsRef}
                tankSpellsRef={arenaState.tankSpellsRef}
                assassinSpellsRef={arenaState.assassinSpellsRef}
                unitRegistry={arenaState.unitRegistryRef}
                localPlayerId={arenaState.selectedCharacter?.id}
              />

              <RemoteMonstersRenderer
                worldMonstersRef={arenaState.worldMonstersRef}
                onAttack={(monsterId) => {
                  (window as any).monsterClickedThisFrame = true;
                  (window as any).clickedTargetId = monsterId;
                  (window as any).hasAttackIntent = true;
                }}
                connectedPlayersRef={arenaState.connectedPlayersRef}
                localPlayerId={arenaState.selectedCharacter?.id}
                gameConfig={arenaState.gameConfig}
              />

              <FPSCounterUpdater />
            </VFXProvider>
          )}

          <DiagnosticsBridge />
          <VisualTuningBridge fov={fov} fogDensity={fogDensity} />

          {/* Phase 3.3: Conditional post-processing (no EffectComposer in potato mode) */}
          <OptimizedPostProcessing
            enabled={!isPotato}
            bloomThreshold={bloomThreshold ?? 1.75}
            bloomStrength={bloomStrength ?? 0.15}
            bloomRadius={bloomRadius ?? 0.25}
            exposure={exposure}
          />
        </Canvas>
      </div>
      {isEditor && <WorldEditorUI />}
    </div>
  );
});
GameCanvas.displayName = "GameCanvas";
