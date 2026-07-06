'use client';

import { Canvas, useThree } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";
import {
  MapControls,
} from "@react-three/drei";
import dynamic from 'next/dynamic';
const WorldEditor = dynamic(
  () => import("@/src/features/world-editor/ui/WorldEditor").then((mod) => mod.WorldEditor),
  { ssr: false }
);
const WorldEditorUI = dynamic(
  () => import("@/src/features/world-editor/ui/WorldEditorUI").then((mod) => mod.WorldEditorUI),
  { ssr: false }
);
import { ModularMap } from "./environment/ModularMap";

import { EnvironmentMultiGlobal } from "./environment/EnvironmentMultiGlobal";
import { MapObstacle } from "@/src/core/domain/unit.types";
import { useStore } from "@/src/state/useStore";
import { useEditorStore } from "@/src/features/world-editor/store/useEditorStore";
import React, { useState, useEffect } from "react";
import * as THREE from 'three';

// Imported Standalone Components
import { CameraOcclusionManager } from "./systems/CameraOcclusionManager";

// New performance components
import { EntityUpdateSystem } from "./systems/EntityUpdateSystem";
import { EmptyDrawGuard } from "./systems/EmptyDrawGuard";
import { OptimizedPostProcessing } from "./systems/OptimizedPostProcessing";

// Arena/Multiplayer Components
import { PlayerController } from "@/src/entities/player/ui/PlayerController";
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
  void downloadPerfLogs;
  void clearVFXCache;
  void isSettingsOpen;
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

  const fov = 50;
  const fogDensity = 0.002;
  const exposure = 1.0;
  const isPotato = !!settingsRef.current.potatoMode;

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

  return (
    <div className={`w-full h-full overflow-hidden relative bg-slate-950 flex flex-col select-none touch-none ${isFullscreen ? '' : 'rounded-2xl border border-white/10 shadow-2xl'}`}>
      <div className="flex-grow w-full relative h-full">
        <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-[10px] text-white backdrop-blur-md border border-white/10 pointer-events-none">
          DPR: {(dpr || 1).toFixed(2)}
        </div>

        <Canvas
          shadows={{
            type: THREE.PCFShadowMap,
          }}
          dpr={[1, dpr]}
          camera={{ position: [0, 60, 120], fov: 50 }}
          gl={async ({ canvas }: any) => {
            const renderer = new WebGPURenderer({
              canvas,
              antialias: true,
              powerPreference: "high-performance",
              logarithmicDepthBuffer: false,
              stencil: false,
              depth: true,
              alpha: false,
            });
            await renderer.init();
            return renderer as any;
          }}
          className="select-none touch-none w-full h-full"
        >
          {/* Phase 3.2: Entity update system (imperative transform sync) */}
          <EntityUpdateSystem />

          {/* Phase 7.2: Empty draw guard (prevent WebGL/WebGPU crashes) */}
          <EmptyDrawGuard />

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
