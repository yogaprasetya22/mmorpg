'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls, useAnimations, useGLTF } from '@react-three/drei';
import BVHEcctrl, { characterStatus } from 'bvhecctrl';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { MeshoptDecoder } from 'meshoptimizer';
import { useVFX } from './systems/VFXManager';
import ProjectilePool, { ProjectilePoolHandle } from './systems/ProjectilePool';
import { useStore } from '@/src/state/useStore';
import { useEditorStore } from '@/src/state/useEditorStore';
import { getTerrainElevation } from '@/src/core/utils/terrainHeight';
import { UnitRuntimeData } from '@/src/core/domain/unit.types';

// Buffer and State imports
import {
  _charPos,
  _tempFwd,
  _fwdAxis,
  charState,
} from './PlayerController.buffers';

// Standalone Hooks imports
import { usePlayerInput } from './hooks/usePlayerInput';
import { usePlayerPhysicsGating } from './hooks/usePlayerPhysicsGating';
import { usePlayerTargeting } from './hooks/usePlayerTargeting';
import { usePlayerAnimations } from './hooks/usePlayerAnimations';
import { usePlayerCamera } from './hooks/usePlayerCamera';
import { usePlayerCombat } from './hooks/usePlayerCombat';

export const keyboardMap = [
  { name: 'forward',   keys: ['ArrowUp',    'KeyW'] },
  { name: 'backward',  keys: ['ArrowDown',  'KeyS'] },
  { name: 'leftward',  keys: ['ArrowLeft',  'KeyA'] },
  { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump',      keys: ['Space'] },
  { name: 'run',       keys: ['Shift'] },
  { name: 'action1',   keys: ['KeyF', 'KeyE'] },
  { name: 'skill',     keys: ['KeyQ', 'Digit1'] },
];

export const PlayerController = ({
  modelPath = '/assets-model/Chef_Male.glb',
  playerClass = 'Warrior',
  damageQueue,
  settingsRef,
  paused = false,
  unitRegistry,
  dealPlayerDamage,
  mmSpellsRef,
  spellsRef,
  fighterSpellsRef,
  tankSpellsRef,
  assassinSpellsRef,
  simTimeRef,
  sendPlayerState,
  playerStats,
}: {
  modelPath?: string;
  playerClass?: string;
  damageQueue?: React.RefObject<any[]>;
  settingsRef: React.RefObject<any>;
  paused?: boolean;
  unitRegistry?: React.RefObject<UnitRuntimeData[]>;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean) => void;
  mmSpellsRef?: React.RefObject<any[]>;
  spellsRef?: React.RefObject<any[]>;
  fighterSpellsRef?: React.RefObject<any[]>;
  tankSpellsRef?: React.RefObject<any[]>;
  assassinSpellsRef?: React.RefObject<any[]>;
  simTimeRef?: React.RefObject<number>;
  sendPlayerState?: (state: { x: number; y: number; z: number; rotation: number; animation: string; targetId?: string }) => void;
  playerStats?: any;
}) => {
  const poolRef      = useRef<ProjectilePoolHandle>(null);
  const ecctrlRef    = useRef<any>(null);
  const characterRef = useRef<THREE.Group>(null!);
  const { camera }   = useThree();
  const syncAccumulator = useRef(0);
  const lastHpRef = useRef(1000);
  const [isSpawning, setIsSpawning] = useState(true);

  // Spawn stabilizer logic
  useEffect(() => {
    if (!paused) {
      setIsSpawning(true);
      const timer = setTimeout(() => {
        setIsSpawning(false);
        console.log("🎮 Spawn stabilization complete! Unpausing physics.");
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setIsSpawning(true);
    }
  }, [paused]);

  const activeEnv = useEditorStore((s) => s.environment);
  const terrainConfig = useEditorStore((s) => s.terrainConfig);

  const spawnPosition = useMemo(() => {
    const spawnH = getTerrainElevation(0, 0, activeEnv, 24, terrainConfig);
    return [0, spawnH + 3.0, 0] as [number, number, number];
  }, [activeEnv, terrainConfig]);

  // GLTF skeletal loading and cloning
  const { scene, animations } = useGLTF(modelPath, true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const clone = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.geometry?.computeBoundingSphere?.();
      }
    });
    return cloned;
  }, [scene]);

  const { actions }  = useAnimations(animations, characterRef);
  const activeAction = useRef<THREE.AnimationAction | null>(null);

  // Sync isEditorOpen
  const gameState = useStore(s => s.gameState);
  useEffect(() => {
    // Reset camera snap on state change
    const hasCamInitBuffer = require('./PlayerController.buffers').hasCamInit;
    hasCamInitBuffer[0] = 0;
  }, [gameState]);

  const { spawnVFX } = useVFX();
  const [, getKeys]  = useKeyboardControls();

  const isDead = playerStats && typeof playerStats.hp !== 'undefined' && playerStats.hp <= 0;

  // Initialize standalone helper hooks
  usePlayerInput(settingsRef);
  const physicsGating = usePlayerPhysicsGating(ecctrlRef);
  const targeting = usePlayerTargeting(unitRegistry);
  const animationSystem = usePlayerAnimations(actions, activeAction, playerClass);
  const cameraSystem = usePlayerCamera(camera);
  const combatSystem = usePlayerCombat({
    playerClass,
    playerStats,
    dealPlayerDamage,
    spawnVFX,
    camera,
    simTimeRef,
    mmSpellsRef,
    spellsRef,
    fighterSpellsRef,
    tankSpellsRef,
    assassinSpellsRef,
    poolRef,
    ecctrlRef,
    characterRef,
  });

  // Unified Frame-Loop Orchestrator
  useFrame((_, delta) => {
    const currentHp = playerStats && typeof playerStats.hp !== 'undefined' ? playerStats.hp : 1000;

    // Resurrection Teleport logic
    if (lastHpRef.current <= 0 && currentHp > 0) {
      if (ecctrlRef.current) {
        const env = useEditorStore.getState().environment;
        const conf = useEditorStore.getState().terrainConfig;
        const spawnH = getTerrainElevation(0, 0, env, 24, conf);
        ecctrlRef.current.group.position.set(0, spawnH + 3.0, 0);
        ecctrlRef.current.resetLinVel();
        console.log("🛡️ Player resurrected! Teleporting back to starter town center above ground height:", spawnH + 3.0);
      }
    }
    lastHpRef.current = currentHp;

    // Setup positions and world rotations
    _charPos.copy(characterStatus.position as THREE.Vector3);
    (window as any).localPlayerPos = _charPos;
    if (characterRef.current) {
      const fwd = _tempFwd.copy(_fwdAxis);
      fwd.applyQuaternion(characterRef.current.quaternion);
      if (characterRef.current.parent) {
        fwd.applyQuaternion(characterRef.current.parent.quaternion);
      }
      (window as any).localPlayerRotation = Math.atan2(fwd.x, fwd.z);
    }

    // Determine current ground elevation height
    let groundH = _charPos.y;
    if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
      const raycastH = (window as any).getGroundHeight(_charPos.x, _charPos.z, -999);
      if (raycastH !== -999) {
        groundH = raycastH;
      } else {
        const env = useEditorStore.getState().environment;
        const conf = useEditorStore.getState().terrainConfig;
        const baseDistance = (env === "STORM" || env === "RAIN" || env === "THUNDER" || env === "CLEAR") ? 45.0 : 35.0;
        groundH = getTerrainElevation(_charPos.x, _charPos.z, env, baseDistance, conf);
      }
    } else {
      const env = useEditorStore.getState().environment;
      const conf = useEditorStore.getState().terrainConfig;
      const baseDistance = (env === "STORM" || env === "RAIN" || env === "THUNDER" || env === "CLEAR") ? 45.0 : 35.0;
      groundH = getTerrainElevation(_charPos.x, _charPos.z, env, baseDistance, conf);
    }

    if (isDead) {
      if (ecctrlRef.current) {
        ecctrlRef.current.resetLinVel();
        ecctrlRef.current.setMovement?.({ joystick: { x: 0, y: 0 } });
        ecctrlRef.current.group.position.y = groundH;
      }
      charState[0] = 0;
    }

    useStore.getState().setPlayerPosition([_charPos.x, _charPos.y, _charPos.z]);

    // WebSocket state synchronization
    syncAccumulator.current += delta;
    if (syncAccumulator.current >= 0.033) {
      syncAccumulator.current = 0;
      if (sendPlayerState && characterRef.current) {
        const fwd = _tempFwd.copy(_fwdAxis);
        fwd.applyQuaternion(characterRef.current.quaternion);
        if (characterRef.current.parent) {
          fwd.applyQuaternion(characterRef.current.parent.quaternion);
        }
        const worldRot = Math.atan2(fwd.x, fwd.z);

        let anim = "Idle";
        if (charState[0] === 1) {
          anim = "Attack";
        } else if (performance.now() - ((window as any).lastSkillTime || 0) < 1000) {
          anim = "Skill";
        } else {
          const status = require('bvhecctrl').useAnimationStore.getState().animationStatus;
          const mappings = require('./hooks/usePlayerAnimations').ecctrlAnimationSet;
          anim = mappings[status] ?? "Idle";
        }

        sendPlayerState({
          x: _charPos.x,
          y: _charPos.y,
          z: _charPos.z,
          rotation: worldRot,
          animation: anim,
          targetId: anim === "Attack" || anim === "Skill" ? targeting.lastNearestTargetId.current : "",
        });
      }
    }

    // 1. Process physics gating failsafes and snappy jump gating
    const isChatFocus = !!(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'));
    physicsGating.tick(groundH, getKeys, isChatFocus);

    // 2. Perform auto-aim targeting scan
    const target = targeting.tick();

    // 3. Update combat sequences, states, cooldowns, and locks
    const keys = isChatFocus ? {} : getKeys();
    const isMovingInput = !!(keys.forward || keys.backward || keys.leftward || keys.rightward);
    combatSystem.tick(delta, keys, target, isMovingInput);

    // 4. Update camera follow positioning, collisions, and shaking
    cameraSystem.tick(delta);

    // 5. Sync mesh animation playback speeds to movements
    animationSystem.tick(delta, isDead);
  }, 1);

  return (
    <>
      <ProjectilePool 
        ref={poolRef} 
        damageQueue={damageQueue} 
        dealPlayerDamage={dealPlayerDamage}
      />

      <BVHEcctrl
        ref={ecctrlRef}
        paused={paused || isSpawning || isDead}
        position={spawnPosition}
        colliderCapsuleArgs={[0.28, 1.1, 4, 8]}
        floatCheckType="SHAPECAST"
        floatHeight={0.35}
        floatPullBackHeight={0.5}
        floatSensorRadius={0.32}
        floatSpringK={220}
        floatDampingC={40}
        maxWalkSpeed={3.5}
        maxRunSpeed={6.5}
        acceleration={45}
        deceleration={35}
        turnSpeed={22}
        jumpVel={9.5}
        gravity={24.0}
        fallGravityFactor={1.8}
        maxFallSpeed={45}
        mass={1}
        maxSlope={1.45}
        collisionCheckIteration={3}
        collisionPushBackVelocity={1.0}
        collisionPushBackDamping={0.06}
        collisionPushBackThreshold={0.01}
      >
        <group ref={characterRef} dispose={null} position={[0, -1.3, 0]}>
          <primitive object={clone} />
        </group>
      </BVHEcctrl>
    </>
  );
};
