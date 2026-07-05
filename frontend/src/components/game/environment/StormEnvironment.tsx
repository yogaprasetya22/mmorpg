/**
 * StormEnvironment — Open World Edition (Physics Stabilized)
 */

'use client';

import { Component, ReactNode, useState, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Sky } from "@react-three/drei";
import { characterStatus } from "@jagres/bvhecctrl";
import * as THREE from "three";

import { useStore } from "@/src/state/useStore";
import { useEditorStore } from "@/src/features/world-editor/store/useEditorStore";
import { useVFX } from "../systems/VFXManager";
import { PainterlyWaterMaterial, API_BASE_URL } from '@jagres/shared';
import { StormTerrain } from './StormTerrain';

// Simple error boundary to prevent crash on HDR skybox loading errors
class EnvironmentErrorBoundary extends Component<{ children: ReactNode, onCatch: () => void }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onCatch(); }
  render() { return this.state.hasError ? null : this.props.children; }
}

export const StormEnvironment = ({ baseDistance = 24, potatoMode = false, debug = false, onReady }: {
  baseDistance?: number;
  potatoMode?: boolean;
  debug?: boolean;
  onReady?: () => void;
}) => {
  const [skyLoadFailed, setSkyLoadFailed] = useState(false);
  const weather = useStore(s => s.weather);
  const gameState = useStore(s => s.gameState);
  const isSetup = gameState === "SETUP";
  const { spawnVFX } = useVFX();
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();

  // Editor store
  const isEditorOpen = useEditorStore(s => s.isEditorOpen);
  const lightIntensity = useEditorStore(s => s.lightIntensity);
  const ambientIntensity = useEditorStore(s => s.ambientIntensity);
  const sunAngle = useEditorStore(s => s.sunAngle);
  const fogDensity = useEditorStore(s => s.fogDensity);
  const skyboxIntensity = useEditorStore(s => s.skyboxIntensity);
  const sky = useEditorStore(s => s.sky) || 'sunset';

  // Derived values
  const skyFile = useMemo(() => {
    if (sky === 'night') return `${API_BASE_URL}/assets/textures/skyboxes/qwantani_night_1k.hdr`;
    if (sky === 'sunset') return `${API_BASE_URL}/assets/textures/skyboxes/qwantani_sunset_1k.hdr`;
    return null;
  }, [sky]);

  const sunPosition = useMemo(() => {
    const rad = (sunAngle * Math.PI) / 180;
    return [Math.cos(rad) * 120, 80, Math.sin(rad) * 120] as [number, number, number];
  }, [sunAngle]);

  const fogColor = sky === 'night' ? "#0b0f19" : "#c8dff0";

  const resolvedBgIntensity = skyboxIntensity !== null
    ? skyboxIntensity
    : (sky === 'night' ? 0.02 : 0.15);

  useFrame(state => {
    scene.backgroundIntensity = resolvedBgIntensity;
    scene.environmentIntensity = resolvedBgIntensity;

    if (PainterlyWaterMaterial.uniforms?.time) {
      PainterlyWaterMaterial.uniforms.time.value = state.clock.elapsedTime;
    }

    if (lightRef.current) {
      if (lightRef.current.target.parent !== scene) {
        scene.add(lightRef.current.target);
      }

      let centerX = 0;
      let centerY = 0;
      let centerZ = 0;

      const isEditorOpen = useEditorStore.getState().isEditorOpen;
      if (isEditorOpen) {
        centerX = state.camera.position.x;
        centerY = Math.min(state.camera.position.y, 5);
        centerZ = state.camera.position.z;
      } else {
        const pos = useStore.getState().playerPosition;
        centerX = pos[0];
        centerY = pos[1];
        centerZ = pos[2];
      }

      const rad = (useEditorStore.getState().sunAngle * Math.PI) / 180;
      const orbitR = isEditorOpen ? 40.0 : 15.0;
      const lightH = isEditorOpen ? 80.0 : 45.0;
      const ox = Math.cos(rad) * orbitR;
      const oz = Math.sin(rad) * orbitR;
      lightRef.current.position.set(centerX + ox, centerY + lightH, centerZ + oz);
      lightRef.current.target.position.set(centerX, centerY, centerZ);
      lightRef.current.target.updateMatrixWorld();
    }

    if (isSetup || potatoMode) return;
    if (state.clock.elapsedTime % 0.25 < 0.025) {
      if (characterStatus && characterStatus.position) {
        const px = characterStatus.position.x;
        const pz = characterStatus.position.z;
        if (weather === "CLEAR") {
          spawnVFX([px + (Math.random() - 0.5) * 60, 1 + Math.random() * 5, pz + (Math.random() - 0.5) * 60], "dust-mote", "#ffffff");
        } else if (weather === "THUNDER") {
          spawnVFX([px + (Math.random() - 0.5) * 80, 0.5, pz + (Math.random() - 0.5) * 80], "environment-mist", "#a855f7");
        }
      }
    }
  });

  if (potatoMode) {
    return (
      <group>
        <color attach="background" args={["#c8d8f0"]} />
        <hemisphereLight intensity={1.5} groundColor="#556655" />
        <ambientLight intensity={0.8} />
        <StormTerrain baseDistance={baseDistance} potatoMode />
      </group>
    );
  }

  return (
    <group>
      {skyFile && !skyLoadFailed ? (
        <EnvironmentErrorBoundary onCatch={() => setSkyLoadFailed(true)}>
          <Environment
            files={skyFile}
            background
            backgroundIntensity={resolvedBgIntensity}
            blur={0}
          />
        </EnvironmentErrorBoundary>
      ) : (
        <>
          <color attach="background" args={["#a0c4ff"]} />
          <Sky sunPosition={sunPosition} />
        </>
      )}
      <ambientLight intensity={ambientIntensity ?? (sky === 'night' ? 0.15 : 0.45)} />
      <hemisphereLight
        intensity={sky === 'night' ? 0.1 : 0.4}
        color={sky === 'night' ? "#a5b4fc" : "#ffffff"}
        groundColor="#556677"
      />

      <directionalLight
        ref={lightRef}
        position={sunPosition}
        intensity={lightIntensity ?? (sky === 'night' ? 0.15 : 0.8)}
        castShadow
        shadow-mapSize-width={isEditorOpen ? 2048 : 1024}
        shadow-mapSize-height={isEditorOpen ? 2048 : 1024}
        shadow-bias={-0.0005}
        shadow-normalBias={0.06}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-camera-left={isEditorOpen ? -100 : -40}
        shadow-camera-right={isEditorOpen ? 100 : 40}
        shadow-camera-top={isEditorOpen ? 100 : 40}
        shadow-camera-bottom={isEditorOpen ? -100 : -40}
      />

      <StormTerrain
        baseDistance={baseDistance}
        debug={debug}
        onReady={onReady}
        onSculptLoaded={() => { }}
      />

      {/* WATER PLANE (NO COLLIDER) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]}>
        <planeGeometry args={[1500, 1500]} />
        <primitive object={PainterlyWaterMaterial} attach="material" transparent={true} />
      </mesh>

      {/* Exponential Fog for depth */}
      <fogExp2 attach="fog" args={[fogColor, fogDensity]} />
    </group>
  );
};
