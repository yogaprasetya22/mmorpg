'use client';

/**
 * PlayerController — MMORPG Edition (Auto-Aim)
 *
 * Architecture:
 * - Auto-aim: Scans unitRegistry each frame for nearest enemy → auto-fire
 * - Mouse/wheel only for camera control (no click-to-attack)
 * - Animation transitions driven by BVHEcctrl's animationStatus global
 * - Single, prioritised useFrame (priority=-1) handles camera + combat
 * - No useState, no useRef for per-frame values (all in ECS)
 */

import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls, useAnimations, useGLTF } from '@react-three/drei';
import BVHEcctrl, { useAnimationStore, characterStatus } from 'bvhecctrl';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { MeshoptDecoder } from 'meshoptimizer';
import { useVFX } from './systems/VFXManager';
import ProjectilePool, { ProjectilePoolHandle } from './systems/ProjectilePool';
import { useStore } from '@/src/state/useStore';
import { useEditorStore } from '@/src/state/useEditorStore';
import { getTerrainElevation } from '@/src/core/utils/terrainHeight';
import { UnitRuntimeData } from '@/src/core/domain/unit.types';
import {
  executeClassAttack,
  executeClassSkill,
  CombatExecutionContext
} from '@/src/core/combat/ClassCombatEngine';

// ─── ANIMATION MAPS ──────────────────────────────────────────────────────────
const animationSet = {
  idle:  'Idle',
  walk:  'Walk',
  run:   'Run',
  jump:  'Jump',
  shoot: 'Shoot_OneHanded',
};

const ecctrlAnimationSet: Record<string, string> = {
  IDLE:       animationSet.idle,
  WALK:       animationSet.walk,
  RUN:        animationSet.run,
  JUMP_START: animationSet.jump,
  JUMP_IDLE:  animationSet.jump,
  JUMP_FALL:  animationSet.jump,
  JUMP_LAND:  animationSet.idle,
};

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

// ─── ZERO-ALLOC MATH OBJECTS (module-level = never GC'd) ─────────────────────
const _charPos    = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _lookAt     = new THREE.Vector3();
const _camTarget  = new THREE.Vector3();
const _camDir     = new THREE.Vector3();
const _originVec  = new THREE.Vector3();
const _fwdVec     = new THREE.Vector3();
const _fwdAxis        = new THREE.Vector3(0, 0, 1);
const _tempFwd        = new THREE.Vector3();
const _shoulderOffsetVec = new THREE.Vector3();

// Snappy Jump Gating Math Objects
const _velVec          = new THREE.Vector3();
const _downRayOrigin   = new THREE.Vector3();
const _downRayDir      = new THREE.Vector3(0, -1, 0);
const _downRaycaster   = new THREE.Raycaster();


// ─── ECS BUFFERS (TypedArrays — same-frame, no GC) ───────────────────────────
// Camera state
const camYaw        = new Float32Array(1);   // radians
const camPitch      = new Float32Array([0.3]);
const camZoom       = new Float32Array([5.0]);
const camZoomTarget = new Float32Array([5.0]);
const camPosX       = new Float32Array(1);
const camPosY       = new Float32Array(1);
const camPosZ       = new Float32Array(1);
const lookAtX       = new Float32Array(1);
const lookAtY       = new Float32Array(1);
const lookAtZ       = new Float32Array(1);
const hasCamInit    = new Uint8Array(1);     // 0=false, 1=true

// Input state (written by DOM events, read by useFrame)
const isRightClick  = new Uint8Array(1);
const isLeftClick   = new Uint8Array(1);

// Auto-aim state
const autoFireTimer  = new Float64Array(1);   // last auto-fire time (ms)
const aimTargetX     = new Float32Array(1);
const aimTargetY     = new Float32Array(1);
const aimTargetZ     = new Float32Array(1);
const hasTarget      = new Uint8Array(1);     // 0=no target, 1=has target

// Constants
const ZOOM_MIN   = 1.5;
const ZOOM_MAX   = 20.0;
const ZOOM_LERP  = 8.0;
const EYE_HEIGHT = 1.4; // Slightly lower for better center framing
const SHOULDER_OFFSET = 0.0; // Perfectly centered horizontally
// AUTO_FIRE_RATE is now DYNAMIC — derived from attackDuration (ASPD) inside useFrame
const AUTO_AIM_RADIUS = 40.0;  // world units detection radius (MM Role)
const AUTO_AIM_RSQ    = AUTO_AIM_RADIUS * AUTO_AIM_RADIUS;

// Camera Collision Check
const _rayDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

// ─── MMORPG STATE MACHINE ────────────────────────────────────────────────────
const charState = new Uint8Array(1);     // 0=NORMAL, 1=ATTACKING, 2=CHASING
const attackTimer = new Float64Array(1); // Time spent in attack animation
// ATTACK_DURATION has been dynamized based on dynamic ASPD formula
const _chaseDir = new THREE.Vector3();
const _camProjDir = new THREE.Vector3();
const _camRightDir = new THREE.Vector3();


export const PlayerController = (props: {
  paused?: boolean;
  modelPath?: string;
  playerClass?: string;
  damageQueue?: React.RefObject<any[]>;
  settingsRef: React.RefObject<any>;
  unitRegistry?: React.RefObject<UnitRuntimeData[]>;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean, isMagic?: boolean, customColor?: string) => void;
  mmSpellsRef?: React.RefObject<any[]>;
  spellsRef?: React.RefObject<any[]>;
  fighterSpellsRef?: React.RefObject<any[]>;
  tankSpellsRef?: React.RefObject<any[]>;
  assassinSpellsRef?: React.RefObject<any[]>;
  simTimeRef?: React.RefObject<number>;
  sendPlayerState?: (state: { x: number; y: number; z: number; rotation: number; animation: string; targetId?: string }) => void;
  playerStats?: any;
  playerStatsRef?: React.RefObject<any>;
}) => {
  const {
    paused = false,
    modelPath = '/assets-model/Chef_Male.glb',
    playerClass = 'Warrior',
    damageQueue,
    settingsRef,
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
    playerStatsRef,
  } = props as any;
  const poolRef      = useRef<ProjectilePoolHandle>(null);
  const ecctrlRef    = useRef<any>(null);
  const characterRef = useRef<THREE.Group>(null!);
  const { camera }   = useThree();
  const spellsPtr       = useRef(0);
  const mmSpellPtr      = useRef(0);
  const fighterSpellPtr = useRef(0);
  const tankSpellPtr    = useRef(0);
  const assassinSpellPtr = useRef(0);
  const syncAccumulator = useRef(0);
  const lastHpRef = useRef(1000);
  const lastNearestTargetId = useRef<string>("");
  const [isTargetingAoE, setIsTargetingAoE] = useState(false);
  const aoeTargetPos = useRef(new THREE.Vector3());
  const [isSpawning, setIsSpawning] = useState(true);

  // Reset spawn stabilizer when unpaused (e.g. when loading screen fades out)
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

  // ─── AoE Targeting Mouse Handler ───
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!isTargetingAoE) return;

      if (e.button === 0) { // Left-click: CAST!
        e.preventDefault();
        e.stopPropagation();
        (window as any).triggerAoECast = true;
      } else if (e.button === 2) { // Right-click: CANCEL!
        e.preventDefault();
        e.stopPropagation();
        setIsTargetingAoE(false);
      }
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [isTargetingAoE]);

  const activeEnv = useEditorStore((s) => s.environment);
  const terrainConfig = useEditorStore((s) => s.terrainConfig);

  const spawnPosition = useMemo(() => {
    const spawnH = getTerrainElevation(0, 0, activeEnv, 24, terrainConfig);
    return [0, spawnH + 3.0, 0] as [number, number, number];
  }, [activeEnv, terrainConfig]);

  // ─── ASSET LOADING ────────────────────────────────────────────────────────
  const { scene, animations } = useGLTF(modelPath, true, true, (l: any) => (l as any).setMeshoptDecoder(MeshoptDecoder)) as any;
  const clone = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        // High fidelity shadows for local player character
        child.castShadow = true;
        child.receiveShadow = true;
        child.geometry?.computeBoundingSphere?.();
        // Disable heavy skinned mesh raycasting on complex skeleton
        child.raycast = () => {};
      }
    });
    return cloned;
  }, [scene]);
  const { actions }           = useAnimations(animations, characterRef);
  const activeAction          = useRef<THREE.AnimationAction | null>(null);

  // --- RESET CAMERA ON GAME START ---
  const gameState = useStore(s => s.gameState);
  useEffect(() => {
    hasCamInit[0] = 0; // Force camera snap on game state change (Play/Setup)
  }, [gameState]);

  // ─── ANIMATION SYNC — Frame-Loop Synchronizer ─────────────────────────────
  // OPTIMIZATION: The old approach used a useEffect subscribed to useAnimationStore.
  // This added 1-2 frame scheduling latency (~16-33ms) — especially visible on JUMP.
  // Fix: Poll useAnimationStore.getState() directly inside useFrame so the animation
  // transition fires on the EXACT same frame that physics detects the jump start.
  // prevAnimStatus tracks the last seen status so we only crossfade on actual changes.
  const prevAnimStatus = useRef<string>("");

  // ─── DOM EVENT LISTENERS (write to ECS buffers, not React state) ──────────
  useEffect(() => {
    // Mouse look (right-drag)
    const onMouseMove = (e: MouseEvent) => {
      if (!isRightClick[0]) return;
      const s = settingsRef.current?.mouseSensitivity ?? 0.002;
      camYaw[0]   -= e.movementX * s;
      camPitch[0] -= e.movementY * s;
      camPitch[0]  = Math.max(-0.4, Math.min(1.1, camPitch[0]));
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Only clear target or trigger if clicked INSIDE the 3D Canvas itself (not on UI buttons / HUD)
        const isCanvas = e.target && (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
        if (isCanvas) {
          isLeftClick[0] = 1;
          // Clear target if clicked on empty ground/space (not on a monster)
          setTimeout(() => {
            if (!(window as any).monsterClickedThisFrame) {
              (window as any).clickedTargetId = null;
              (window as any).hasAttackIntent = false;
            }
            (window as any).monsterClickedThisFrame = false;
          }, 30);
        }
      }
      if (e.button === 2) isRightClick[0] = 1;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isLeftClick[0] = 0;
      if (e.button === 2) isRightClick[0] = 0;
    };
    const preventContext = (e: MouseEvent) => { if (e.button === 2) e.preventDefault(); };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        (window as any).clickedTargetId = null;
        (window as any).pendingSkillExecution = false;
      }
    };

    // Zoom (mouse wheel)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camZoomTarget[0] = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX,
        camZoomTarget[0] + e.deltaY * 0.01 * 2.0
      ));
    };

    // Pointer lock: when locked treat any movement as camera look
    const onPointerLockMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      const s = settingsRef.current?.mouseSensitivity ?? 0.002;
      camYaw[0]   -= e.movementX * s;
      camPitch[0] -= e.movementY * s;
      camPitch[0]  = Math.max(-0.4, Math.min(1.1, camPitch[0]));
    };

    document.addEventListener('mousemove',   onMouseMove);
    document.addEventListener('mousemove',   onPointerLockMove);
    document.addEventListener('mousedown',   onMouseDown);
    document.addEventListener('mouseup',     onMouseUp);
    document.addEventListener('keydown',     onKeyDown);
    document.addEventListener('contextmenu', preventContext);
    window.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      document.removeEventListener('mousemove',   onMouseMove);
      document.removeEventListener('mousemove',   onPointerLockMove);
      document.removeEventListener('mousedown',   onMouseDown);
      document.removeEventListener('mouseup',     onMouseUp);
      document.removeEventListener('keydown',     onKeyDown);
      document.removeEventListener('contextmenu', preventContext);
      window.removeEventListener('wheel', onWheel);
    };
  }, [settingsRef]);

  const { spawnVFX } = useVFX();
  const [, getKeys]  = useKeyboardControls();

  const isDead = playerStats && typeof playerStats.hp !== 'undefined' && playerStats.hp <= 0;

  useFrame((state, delta) => {
    // === RAGNAROK X / NEW WORLD SPEED SYSTEM REFACTOR ===
    // 1. ATRIBUT UTAMA (FINAL ASPD PERCENT FROM AUTHORITATIVE BACKEND)
    // Membaca stats ASPD langsung dari backend untuk konsistensi mekanik penuh
    const finalASPDPercent = playerStatsRef?.current?.aspd ?? (playerStats?.aspd ?? 150);

    // 2. KONVERSI KE HITS PER SECOND (KECEPATAN PUKULAN)
    // Setiap kenaikan 125% Final ASPD memberikan tambahan 1 pukulan per detik di atas basis dasar 1 hit/detik
    const hitsPerSecond = 1 + (finalASPDPercent / 125);
    
    // Menghitung durasi satu siklus serangan (dalam milidetik) untuk animation lock
    const attackDuration = 1000 / hitsPerSecond;

    if (isTargetingAoE) {
      _raycaster.setFromCamera(state.pointer, camera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -_charPos.y);
      _raycaster.ray.intersectPlane(groundPlane, aoeTargetPos.current);
    }

    // ─── CHECK DEATH BLOCK & RESURRECTION TELEPORT ───
    const currentHp = playerStatsRef?.current && playerStatsRef.current.hp >= 0
      ? playerStatsRef.current.hp
      : (playerStats && typeof playerStats.hp !== 'undefined' ? playerStats.hp : 1000);

    // Resurrection Teleport on client side when HP resets to full
    if (lastHpRef.current <= 0 && currentHp > 0) {
      if (ecctrlRef.current) {
        const activeEnv = useEditorStore.getState().environment;
        const terrainConfig = useEditorStore.getState().terrainConfig;
        const spawnH = getTerrainElevation(0, 0, activeEnv, 24, terrainConfig);
        ecctrlRef.current.group.position.set(0, spawnH + 3.0, 0);
        ecctrlRef.current.resetLinVel();
        console.log("🛡️ Player resurrected! Teleporting back to starter town center above ground height:", spawnH + 3.0);
      }
    }
    lastHpRef.current = currentHp;

    // === CAMERA SYSTEM ===
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

    let groundH = _charPos.y;
    if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
      const raycastH = (window as any).getGroundHeight(_charPos.x, _charPos.z, -999);
      if (raycastH !== -999) {
        groundH = raycastH;
      } else {
        const activeEnv = useEditorStore.getState().environment;
        const terrainConfig = useEditorStore.getState().terrainConfig;
        const baseDistance = (activeEnv === "STORM" || activeEnv === "RAIN" || activeEnv === "THUNDER" || activeEnv === "CLEAR") ? 45.0 : 35.0;
        groundH = getTerrainElevation(_charPos.x, _charPos.z, activeEnv, baseDistance, terrainConfig);
      }
    } else {
      const activeEnv = useEditorStore.getState().environment;
      const terrainConfig = useEditorStore.getState().terrainConfig;
      const baseDistance = (activeEnv === "STORM" || activeEnv === "RAIN" || activeEnv === "THUNDER" || activeEnv === "CLEAR") ? 45.0 : 35.0;
      groundH = getTerrainElevation(_charPos.x, _charPos.z, activeEnv, baseDistance, terrainConfig);
    }



    if (isDead) {
      // Force zero velocity and lock to ground to prevent gliding
      if (ecctrlRef.current) {
        ecctrlRef.current.resetLinVel();
        ecctrlRef.current.setMovement?.({ joystick: { x: 0, y: 0 } });
        ecctrlRef.current.group.position.y = groundH;
      }
      
      charState[0] = 0; // Return to normal state
      
      // Play death animation if available, otherwise fallback to idle animation loop
      let deathAnim = 'Death';
      if (!actions[deathAnim] && actions['death']) deathAnim = 'death';
      if (!actions[deathAnim] && actions['Death_B']) deathAnim = 'Death_B';
      
      const deathAction = actions[deathAnim];
      if (deathAction) {
        if (deathAction !== activeAction.current) {
          deathAction.reset().setLoop(THREE.LoopOnce, 1);
          deathAction.clampWhenFinished = true;
          deathAction.fadeIn(0.15).play();
          if (activeAction.current) activeAction.current.crossFadeTo(deathAction, 0.2, true);
          activeAction.current = deathAction;
        }
      } else {
        const idleAction = actions[animationSet.idle];
        if (idleAction && idleAction !== activeAction.current) {
          idleAction.reset().fadeIn(0.2).play();
          if (activeAction.current) activeAction.current.crossFadeTo(idleAction, 0.2, true);
          activeAction.current = idleAction;
        }
      }
    } else {
      // Failsafe: Snapping player back up if they fall below the sculpted ground level
      if (_charPos.y < groundH - 3.0) {
        if (ecctrlRef.current) {
          // Aggressive snap-back: tighter threshold prevents deep fall-through
          ecctrlRef.current.group.position.y = groundH + 5.0;
          ecctrlRef.current.resetLinVel();
          _charPos.y = groundH + 5.0;
          console.warn("⚠️ Player fell through map! Snapped back to ground height:", groundH + 5.0);
        }
      }
    }

    // Update player position in store (for enemy AI targeting)
    useStore.getState().setPlayerPosition([_charPos.x, _charPos.y, _charPos.z]);
    
    // Sync real-time high-fidelity position, world rotation, and animations over WebSocket
    syncAccumulator.current += delta;
    if (syncAccumulator.current >= 0.033) {
      syncAccumulator.current = 0;
      if (sendPlayerState && characterRef.current) {
        // Calculate exact world rotation from character mesh
        const fwd = _tempFwd.copy(_fwdAxis);
        fwd.applyQuaternion(characterRef.current.quaternion);
        if (characterRef.current.parent) {
          fwd.applyQuaternion(characterRef.current.parent.quaternion);
        }
        const worldRot = Math.atan2(fwd.x, fwd.z);

        // Get exact animation status
        let anim = "Idle";
        if (charState[0] === 1) {
          anim = "Attack";
        } else if (performance.now() - ((window as any).lastSkillTime || 0) < 1000) {
          anim = "Skill";
        } else {
          const status = useAnimationStore.getState().animationStatus;
          anim = ecctrlAnimationSet[status] ?? animationSet.idle;
        }

        sendPlayerState({
          x: _charPos.x,
          y: _charPos.y,
          z: _charPos.z,
          rotation: worldRot,
          animation: anim,
          targetId: anim === "Attack" || anim === "Skill" ? lastNearestTargetId.current : "",
        });
      }
    }

    // Lerp zoom (ECS buffers → no allocation)
    camZoom[0] += (camZoomTarget[0] - camZoom[0]) * Math.min(1, ZOOM_LERP * delta);

    const cosPitch = Math.cos(camPitch[0]);
    const sinPitch = Math.sin(camPitch[0]);
    
    // --- 1. CALCULATE IDEAL CAMERA POSITION ---
    // Offset the target slightly to the shoulder for premium look
    _fwdVec.set(Math.sin(camYaw[0]), 0, Math.cos(camYaw[0])).normalize();
    const shoulderOffset = _shoulderOffsetVec.set(Math.cos(camYaw[0]), 0, -Math.sin(camYaw[0])).multiplyScalar(SHOULDER_OFFSET);
    
    _camTarget.copy(_charPos).add(shoulderOffset);
    _camTarget.y += EYE_HEIGHT;

    _camDesired.set(
      _camTarget.x - Math.sin(camYaw[0]) * cosPitch * camZoom[0],
      _camTarget.y + sinPitch * camZoom[0],
      _camTarget.z - Math.cos(camYaw[0]) * cosPitch * camZoom[0],
    );

    // --- 2. CAMERA COLLISION (Ghost Busting Walls/Trees) ---
    _rayOrigin.copy(_camTarget);
    _rayDir.subVectors(_camDesired, _rayOrigin).normalize();
    _raycaster.set(_rayOrigin, _rayDir);
    _raycaster.far = camZoom[0];

    const colliders = (window as any).globalNonInstancedColliders || [];
    const intersects = _raycaster.intersectObjects(colliders, false);

    if (intersects.length > 0) {
      // Push camera forward to hit point (minus buffer to prevent near-plane clipping)
      const hitDist = intersects[0].distance;
      const safeDist = Math.max(0.4, hitDist - 0.4); 
      _camDesired.copy(_rayOrigin).add(_rayDir.multiplyScalar(safeDist));
      
      // INSTANT SNAP: If we are colliding, don't lerp slowly into the character
      // This prevents the "slow zoom" feel when hitting a tree
      camPosX[0] = _camDesired.x;
      camPosY[0] = _camDesired.y;
      camPosZ[0] = _camDesired.z;
    }

    // --- 3. PREVENT UNDERWORLD CAMERA (Hard Floor) ---
    // Only check ground if colliders are actually loaded to prevent flickering at start
    if (colliders.length > 0) {
      const terrainHeightAtCam = (window as any).getGroundHeight ? (window as any).getGroundHeight(_camDesired.x, _camDesired.z, -1) : -1;
      if (_camDesired.y < terrainHeightAtCam + 0.6) {
        _camDesired.y = terrainHeightAtCam + 0.6;
        camPosY[0] = _camDesired.y; 
      }
    }

    if (!hasCamInit[0]) {
      camPosX[0] = _camDesired.x;
      camPosY[0] = _camDesired.y;
      camPosZ[0] = _camDesired.z;
      lookAtX[0] = _camTarget.x;
      lookAtY[0] = _camTarget.y;
      lookAtZ[0] = _camTarget.z;
      hasCamInit[0] = 1;
    }

    // Lerp camera pos (write to ECS floats first, then push to Three.js once)
    const lerpT = Math.min(1, 15 * delta);
    camPosX[0] += (_camDesired.x - camPosX[0]) * lerpT;
    camPosY[0] += (_camDesired.y - camPosY[0]) * lerpT;
    camPosZ[0] += (_camDesired.z - camPosZ[0]) * lerpT;

    // Apply Camera Shake decay and offset for dynamic impact feedback
    if (typeof (window as any).shakeIntensity === 'undefined') {
      (window as any).shakeIntensity = 0.0;
    }
    const shake = (window as any).shakeIntensity;
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    let shakeOffsetZ = 0;
    if (shake > 0.01) {
      shakeOffsetX = (Math.random() - 0.5) * shake;
      shakeOffsetY = (Math.random() - 0.5) * shake;
      shakeOffsetZ = (Math.random() - 0.5) * shake;
      (window as any).shakeIntensity = shake * 0.88; // decay shake
    }

    if (typeof (window as any).cameraShake !== 'function') {
      (window as any).cameraShake = (intensity: number) => {
        (window as any).shakeIntensity = intensity;
      };
    }

    camera.position.set(
      camPosX[0] + shakeOffsetX, 
      camPosY[0] + shakeOffsetY, 
      camPosZ[0] + shakeOffsetZ
    );

    // Lerp lookAt
    const lookT = Math.min(1, 20 * delta);
    lookAtX[0] += (_camTarget.x  - lookAtX[0]) * lookT;
    lookAtY[0] += (_camTarget.y  - lookAtY[0]) * lookT;
    lookAtZ[0] += (_camTarget.z  - lookAtZ[0]) * lookT;
    _lookAt.set(lookAtX[0], lookAtY[0], lookAtZ[0]);
    camera.lookAt(_lookAt);

    if (!isDead) {
      // Get dynamic attack range squared based on class
      let activeRangeSq = 81.0; // Default Marksman / MM (9.0m)
      if (playerClass === "Warrior") {
        activeRangeSq = 12.25;    // Fighter (Melee 3.5 meters) - sync with backend monster attack range!
      } else if (playerClass === "Thief") {
        activeRangeSq = 10.89;    // Assassin (Melee 3.3 meters)
      } else if (playerClass === "Priest") {
        activeRangeSq = 14.44;    // Tank (Melee 3.8 meters)
      } else if (playerClass === "Mage") {
        activeRangeSq = 64.0;    // Mage (Ranged 8.0 meters)
      } else if (playerClass === "Beginner") {
        activeRangeSq = 81.0;    // Marksman / MM (Ranged 9.0 meters)
      }

      const now = performance.now();

    // ── Find target (manual clicked target prioritized, then auto-aim) ──
    hasTarget[0] = 0;
    let nearestTarget: UnitRuntimeData | null = null;
    const grid = (window as any).battleGrid;

    // First prioritize manual clicked target
    const clickedId = (window as any).clickedTargetId;
    let clickedTarget: UnitRuntimeData | null = null;
    if (clickedId) {
      const units = unitRegistry?.current || [];
      const found = units.find((u: any) => u.id === clickedId && u.type === 'enemy' && u.isActive && !u.isDying);
      if (found) {
        clickedTarget = found;
        (window as any).isAutoAttacking = true;
      } else {
        (window as any).clickedTargetId = null; // Clear if target is dead/inactive
        (window as any).isAutoAttacking = false;
      }
    } else {
      (window as any).isAutoAttacking = false;
    }

    if (clickedTarget) {
      aimTargetX[0] = clickedTarget.position[0];
      aimTargetY[0] = clickedTarget.position[1] + 1.2;
      aimTargetZ[0] = clickedTarget.position[2];
      hasTarget[0] = 1;
      nearestTarget = clickedTarget;
    } else if (grid) {
      const nearby = grid.queryRadius(_charPos.x, _charPos.z, AUTO_AIM_RADIUS);
      let closestDistSq = AUTO_AIM_RSQ;

      for (let i = 0; i < nearby.length; i++) {
        const u = nearby[i];
        if (u.type !== 'enemy' || !u.isActive || u.isDying) continue;

        const dx = _charPos.x - u.position[0];
        const dz = _charPos.z - u.position[2];
        const dSq = dx * dx + dz * dz;

        // Prioritize the closest enemy unit within the valid auto-aim radius
        if (dSq < closestDistSq) {
          closestDistSq = dSq;
          aimTargetX[0] = u.position[0];
          aimTargetY[0] = u.position[1] + 1.2;
          aimTargetZ[0] = u.position[2];
          hasTarget[0] = 1;
          nearestTarget = u;
        }
      }
    }
    lastNearestTargetId.current = nearestTarget ? nearestTarget.id : "";

    const isChatFocus = document.activeElement && 
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
    const keys = isChatFocus ? {} : getKeys();
    const isMovingInput = keys.forward || keys.backward || keys.leftward || keys.rightward;
    const isAttackInput = keys.action1 || (window as any).hasAttackIntent || ((window as any).isAutoAttacking && !isMovingInput);
    if ((window as any).hasAttackIntent) {
      (window as any).hasAttackIntent = false;
    }

    // ── Execute Attack Function (Delegated to Strategy Design Pattern in ClassCombatEngine) ──
    const executeAttack = (target: UnitRuntimeData | null) => {
      _originVec.set(_charPos.x, _charPos.y + 1.35, _charPos.z);
      camera.getWorldDirection(_camDir);
      
      if (target) {
        _camDir.set(
          aimTargetX[0] - _charPos.x,
          aimTargetY[0] - (_charPos.y + 1.35),
          aimTargetZ[0] - _charPos.z,
        ).normalize();
      } else {
        _camDir.y = 0;
        _camDir.normalize();
      }

      _fwdVec.copy(_camDir).multiplyScalar(0.7);
      _originVec.add(_fwdVec);

      // 3-Hit Spell Combo System Index Ticker
      if (typeof (window as any).comboIndex === 'undefined') {
        (window as any).comboIndex = 0;
      }
      const combo = (window as any).comboIndex;
      (window as any).comboIndex = (combo + 1) % 3;

      const ctx: CombatExecutionContext = {
        charPos: _charPos,
        originVec: _originVec,
        camDir: _camDir,
        combo,
        playerStats,
        dealPlayerDamage,
        spawnVFX,
        camera,
        simTimeRef,
        mmSpellsRef,
        mmSpellPtr,
        fighterSpellsRef,
        fighterSpellPtr,
        assassinSpellsRef,
        assassinSpellPtr,
        tankSpellsRef,
        tankSpellPtr,
        spellsRef,
        spellsPtr,
        poolRef,
        grid,
        ecctrlRef,
        cameraShake: (window as any).cameraShake,
      };

      executeClassAttack(playerClass, target as any, ctx);
    };

    // ── MMORPG STATE MACHINE ──
    const isSkillInput = keys.skill;
    const SKILL_COOLDOWN = 8000; // 8 seconds active skill cooldown
    if (typeof (window as any).lastSkillTime === 'undefined') {
      (window as any).lastSkillTime = 0;
    }
    const lastSkillTime = (window as any).lastSkillTime;

    // ── Execute Active Class Skill (Q / 1 Key) ──
    if (isSkillInput && now - lastSkillTime > SKILL_COOLDOWN) {
      if (!isTargetingAoE) {
        setIsTargetingAoE(true);
        console.log("🎯 Entered AoE Ground Targeting Mode. Left click to cast, right click to cancel.");
      }
    }

    if (isTargetingAoE && (window as any).triggerAoECast) {
      (window as any).triggerAoECast = false;
      (window as any).lastSkillTime = now;
      setIsTargetingAoE(false);

      const mockTarget: any = {
        id: "ground_target",
        name: "Ground",
        type: "enemy",
        isActive: true,
        isDying: false,
        hp: 9999,
        maxHp: 9999,
        position: [aoeTargetPos.current.x, aoeTargetPos.current.y, aoeTargetPos.current.z],
        level: 1,
        poolIdx: 0,
      };

      const ctx: CombatExecutionContext = {
        charPos: _charPos,
        originVec: _originVec,
        camDir: _camDir,
        combo: 0,
        playerStats,
        dealPlayerDamage,
        spawnVFX,
        camera,
        simTimeRef,
        mmSpellsRef,
        mmSpellPtr,
        fighterSpellsRef,
        fighterSpellPtr,
        assassinSpellsRef,
        assassinSpellPtr,
        tankSpellsRef,
        tankSpellPtr,
        spellsRef,
        spellsPtr,
        poolRef,
        grid,
        ecctrlRef,
        cameraShake: (window as any).cameraShake,
      };

      executeClassSkill(playerClass, mockTarget, ctx);
    }

    // Cooldown overlay DOM synchronizer
    const overlay = document.getElementById("skill-cooldown-overlay");
    if (overlay) {
      const elapsed = now - (window as any).lastSkillTime;
      if (elapsed < SKILL_COOLDOWN) {
        const remaining = ((SKILL_COOLDOWN - elapsed) / 1000).toFixed(1);
        overlay.innerText = `${remaining}S`;
        overlay.style.transform = "translateY(0%)";
      } else {
        overlay.style.transform = "translateY(100%)";
      }
    }

    // ── Passive System Ticks (runs every 3s but decoupled from render loop) ──
    // FIX: spawnVFX caused a React state update INSIDE useFrame which generated a mini-stutter.
    // Solution: set a flag inside useFrame, then process it via setTimeout(0) to defer state mutation.
    if (typeof (window as any).lastPassiveTick === 'undefined') {
      (window as any).lastPassiveTick = 0;
    }
    if (now - (window as any).lastPassiveTick > 3000) {
      (window as any).lastPassiveTick = now;
      // Defer VFX spawn to next idle tick — do NOT call spawnVFX inside useFrame
      const snapPos: [number, number, number] = [_charPos.x, _charPos.y + 1.2, _charPos.z];
      const snapClass = playerClass;
      const snapHasTarget = !!aimTargetX[0];
      setTimeout(() => {
        if (snapClass === "Priest") {
          spawnVFX(snapPos, "magic", "#10b981");
        } else if (snapClass === "Warrior" && snapHasTarget) {
          spawnVFX(snapPos, "magic", "#f97316");
        }
      }, 0);
    }

    // Check Input triggers
    if (isAttackInput && now - autoFireTimer[0] > attackDuration) {
      if (hasTarget[0]) {
        const dx = aimTargetX[0] - _charPos.x;
        const dz = aimTargetZ[0] - _charPos.z;
        const distSq = dx*dx + dz*dz;
        
        // Use standard range to initiate chase from normal input
        if (distSq > activeRangeSq) {
          // 4. Otomatis Mengejar Musuh
          charState[0] = 2; // CHASING
        } else {
          // Rotate character to face target instantly
          const worldTargetAngle = Math.atan2(aimTargetX[0] - _charPos.x, aimTargetZ[0] - _charPos.z);
          const fwd = _tempFwd.copy(_fwdAxis);
          fwd.applyQuaternion(characterRef.current.quaternion);
          if (characterRef.current.parent) {
            fwd.applyQuaternion(characterRef.current.parent.quaternion);
          }
          const worldRot = Math.atan2(fwd.x, fwd.z);
          let angleDiff = worldTargetAngle - worldRot;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          characterRef.current.rotation.y += angleDiff;

          // Start Attacking immediately
          charState[0] = 1; // ATTACKING
          attackTimer[0] = now;
          autoFireTimer[0] = now;
          ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
          
          // Hide toast
          const toastOk = document.getElementById("facing-alignment-alert");
          if (toastOk) toastOk.style.opacity = "0";
          
          executeAttack(nearestTarget);
        }
      } else {
        if ((window as any).isAutoAttacking) {
          // Stop auto-attacking if target is lost/dead
          (window as any).isAutoAttacking = false;
          (window as any).hasAttackIntent = false;
          charState[0] = 0;
        } else {
          // Memukul angin (Manual swing when clicking without target)
          charState[0] = 1; // ATTACKING
          attackTimer[0] = now;
          autoFireTimer[0] = now;
          ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
          executeAttack(null);
        }
      }
    }

    // Process Active States
    if (charState[0] === 1) { 
      // == STATE: ATTACKING ==
      if (isMovingInput || keys.jump) {
        // 3. Batal Memukul Jika Bergerak atau Melompat (Cancel/Override)
        charState[0] = 0; 
      } else {
        // 1. Berhenti Saat Menyerang (Animation Lock)
        // Lock horizontal velocity — let BVH gravity & float spring handle Y
        const vel = characterStatus.linvel;
        ecctrlRef.current?.setLinVel({ x: 0, y: vel.y, z: 0 } as any);
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        
        // Face target dynamically
        if (hasTarget[0]) {
          const worldTargetAngle = Math.atan2(aimTargetX[0] - _charPos.x, aimTargetZ[0] - _charPos.z);
          const fwd = _tempFwd.copy(_fwdAxis);
          fwd.applyQuaternion(characterRef.current.quaternion);
          if (characterRef.current.parent) {
            fwd.applyQuaternion(characterRef.current.parent.quaternion);
          }
          const worldRot = Math.atan2(fwd.x, fwd.z);
          let diff = worldTargetAngle - worldRot;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          characterRef.current.rotation.y += diff * 15 * delta;
        }

        // Force Shoot / Melee Animation
        let targetAnim = animationSet.shoot;
        if (playerClass === "Warrior" || playerClass === "Thief" || playerClass === "Beginner") {
          if (actions['SwordSlash']) targetAnim = 'SwordSlash';
          else if (actions['1H_Melee_Attack_Chop']) targetAnim = '1H_Melee_Attack_Chop';
        }
        const shootAction = actions[targetAnim] || actions[animationSet.shoot];
        if (shootAction) {
          // 5. REFACTOR ANIMASI GAME (ANIMATION SPEED SCALE)
          // Mengambil durasi asli file animasi menyerang dalam satuan detik
          const defaultAnimationDuration = shootAction.getClip()?.duration || 1.0;
          
          // Rumus: AnimationSpeedScale = HitsPerSecond * DefaultAnimationDuration
          // Menyesuaikan kecepatan pemutaran animasi agar sinkron sempurna dengan pukulan per detik!
          const animationSpeedScale = hitsPerSecond * defaultAnimationDuration;

          if (shootAction !== activeAction.current) {
            shootAction.reset().play();
            if (activeAction.current) activeAction.current.crossFadeTo(shootAction, 0.1, true);
            activeAction.current = shootAction;
          }
          
          // Menerapkan nilai pengali kecepatan animasi ke Three.js AnimationAction
          shootAction.timeScale = animationSpeedScale;
        }

        // Check if animation lock is over
        if (now - attackTimer[0] > attackDuration) {
          // If the player is still holding the attack button, keep them in the ATTACKING state to prevent animation stuttering
          if (!isAttackInput) {
            charState[0] = 0; // Return to normal
          }
        }
      }
    } else if (charState[0] === 2) { 
      // == STATE: CHASING ==
      if (isMovingInput || keys.jump) {
        // Cancel chase if player moves manually or jumps
        charState[0] = 0;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
      } else if (hasTarget[0]) {
        const dx = aimTargetX[0] - _charPos.x;
        const dz = aimTargetZ[0] - _charPos.z;
        const distSq = dx*dx + dz*dz;
        
        // While chasing, allow 50% more range area tolerance to immediately trigger melee attack swing without infinite chasing run lag
        const effectiveRangeSq = activeRangeSq * 1.5;
        if (distSq <= effectiveRangeSq) {
          // Reached Target! Rotate character to face target instantly
          const worldTargetAngle = Math.atan2(aimTargetX[0] - _charPos.x, aimTargetZ[0] - _charPos.z);
          const fwd = _tempFwd.copy(_fwdAxis);
          fwd.applyQuaternion(characterRef.current.quaternion);
          if (characterRef.current.parent) {
            fwd.applyQuaternion(characterRef.current.parent.quaternion);
          }
          const worldRot = Math.atan2(fwd.x, fwd.z);
          let angleDiff = worldTargetAngle - worldRot;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          characterRef.current.rotation.y += angleDiff;

          // Reached Target! Stop and Attack
          charState[0] = 1;
          attackTimer[0] = now;
          autoFireTimer[0] = now;
          ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
          
          const toastOk2 = document.getElementById("facing-alignment-alert");
          if (toastOk2) toastOk2.style.opacity = "0";
          
          executeAttack(nearestTarget);
        } else {
          // Keep Chasing (Spoof Joystick Input to run to target)
          _chaseDir.set(dx, 0, dz).normalize();
          
          camera.getWorldDirection(_camProjDir);
          _camProjDir.y = 0;
          _camProjDir.normalize();
          
          // Calculate standard right vector based on camera
          _camRightDir.set(1, 0, 0).applyQuaternion(camera.quaternion);
          _camRightDir.y = 0;
          _camRightDir.normalize();
          
          // Project world direction onto camera's local axes to fake joystick
          const moveY = _chaseDir.dot(_camProjDir);
          const moveX = _chaseDir.dot(_camRightDir);
          
          ecctrlRef.current?.setMovement({ 
            joystick: { x: moveX, y: moveY },
            run: true // Force run mode while chasing
          });
          
          // Reset rotation offset to 0 so character faces movement direction
          const resetLerpT = Math.min(1, 10 * delta);
          characterRef.current.rotation.y += (0 - characterRef.current.rotation.y) * resetLerpT;
        }
      } else {
        // Target lost
        charState[0] = 0;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
      }
    }

    if (charState[0] === 0) {
      // == STATE: NORMAL ==

      // ─── SNAPPY JUMP GATE FOR GLB STAIRS & INCLINED MOUNTAINS ──────────────
      const jumpKeys = isChatFocus ? {} : getKeys();
      if (jumpKeys.jump && ecctrlRef.current) {
        // If BVHEcctrl is grounded, we let it jump.
        // If going uphill, BVHEcctrl's internal grounding might fail because of collision push.
        // We override this by performing a downward raycast against all colliders (terrain + GLBs).
        let canJumpOverride = characterStatus.isOnGround;

        if (!canJumpOverride) {
          _downRayOrigin.copy(_charPos);
          _downRayOrigin.y += 0.5; // offset slightly above feet inside the hips capsule
          _downRaycaster.set(_downRayOrigin, _downRayDir);
          _downRaycaster.far = 1.6; // 0.5 hip offset + 1.1 air clearance

          const allColliders = (window as any).globalColliders || [];
          const hits = _downRaycaster.intersectObjects(allColliders, false);
          if (hits.length > 0) {
            canJumpOverride = true;
          }
        }

        if (canJumpOverride) {
          const now = performance.now();
          if (typeof (window as any).lastJumpTime === 'undefined') {
            (window as any).lastJumpTime = 0;
          }
          if (now - (window as any).lastJumpTime > 300) {
            (window as any).lastJumpTime = now;

            if (ecctrlRef.current.setLinVel) {
              const currentVel = characterStatus.linvel;
              // Snappy jump: set Y velocity to 9.5 for quick Roblox-like upwards thrust!
              _velVec.set(currentVel.x, 9.5, currentVel.z);
              ecctrlRef.current.setLinVel(_velVec);
            }
          }
        }
      }

      // Revert local rotation offset
      const resetLerpT = Math.min(1, 10 * delta);
      characterRef.current.rotation.y += (0 - characterRef.current.rotation.y) * resetLerpT;
    }

    // ─── FRAME-LOOP ANIMATION SYNCHRONIZER ───
    // Poll animation store directly (no useEffect, no React scheduling latency).
    // This catches state changes on the SAME frame physics transitions happen.
    const currentAnimStatus = useAnimationStore.getState().animationStatus;
    const expectedAnimName = ecctrlAnimationSet[currentAnimStatus] ?? animationSet.idle;
    const expectedAction = actions[expectedAnimName];

    const isAttackingOrCasting = charState[0] === 1 || (window as any).pendingSkillExecution;

    if (!isAttackingOrCasting) {
      // If not attacking/casting, ensure we are playing the correct movement/idle animation
      if (expectedAction && (currentAnimStatus !== prevAnimStatus.current || activeAction.current !== expectedAction)) {
        prevAnimStatus.current = currentAnimStatus;

        const isJump = expectedAnimName.toLowerCase().includes('jump');
        // Ultra-fast transition for jump (0.04s) so it feels instant;
        // standard crossfade (0.12s) for walk/run/idle to remain smooth.
        const crossfadeDuration = isJump ? 0.04 : 0.12;

        expectedAction.reset().play();
        if (activeAction.current && activeAction.current !== expectedAction) {
          activeAction.current.crossFadeTo(expectedAction, crossfadeDuration, true);
        } else if (!activeAction.current) {
          expectedAction.fadeIn(crossfadeDuration);
        }
        activeAction.current = expectedAction;
      }
    } else {
      // Track the physics animation status so that when we stop attacking, we know if it changed.
      if (currentAnimStatus !== prevAnimStatus.current) {
        prevAnimStatus.current = currentAnimStatus;
      }
    }

    // Adjust animation timescale dynamically to match actual physics velocity
    if (activeAction.current) {
      // Reuse prevAnimStatus.current — already synced from the frame-loop synchronizer above (zero extra getState() call)
      const desired = (ecctrlAnimationSet[prevAnimStatus.current] ?? animationSet.idle).toLowerCase();

      const linvel = characterStatus.linvel;
      const horizontalSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);

      const isAttackAnim = activeAction.current === actions[animationSet.shoot] ||
                           (actions['SwordSlash'] && activeAction.current === actions['SwordSlash']) ||
                           (actions['1H_Melee_Attack_Chop'] && activeAction.current === actions['1H_Melee_Attack_Chop']);

      if (isAttackAnim) {
        // Do not override attack animation timescale with movement speed calculations
      } else if (desired.includes("walk")) {
        activeAction.current.timeScale = Math.max(0.4, Math.min(1.2, horizontalSpeed / 3.0));
      } else if (desired.includes("run")) {
        activeAction.current.timeScale = Math.max(0.4, Math.min(1.4, horizontalSpeed / 5.5));
      } else if (!(window as any).pendingSkillExecution) {
        // Only reset to 1.0 if NOT attacking/casting (so we don't overwrite ASPD scaling!)
        activeAction.current.timeScale = 1.0;
      }
    }
    }
  }, 1); // priority 1: runs AFTER physics tick so characterStatus is fresh

  // ─── RENDER ──────────────────────────────────────────────────────────────
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
        /* ── Collider: Slim capsule for nimble stair/slope clearance ── */
        colliderCapsuleArgs={[0.28, 1.1, 4, 8]}
        /* ── Float / Ground Detection: Tuned for buttery smooth stair climbing and landing ── */
        floatCheckType="SHAPECAST"
        floatHeight={0.35}
        floatPullBackHeight={0.5}
        floatSensorRadius={0.32}
        floatSpringK={220}
        floatDampingC={40}
        /* ── Movement ── */
        maxWalkSpeed={3.5}
        maxRunSpeed={6.5}
        acceleration={45}
        deceleration={35}
        turnSpeed={22}
        /* ── Jump / Gravity: Snappy yet smooth Roblox-like jump physics ── */
        jumpVel={9.5}
        gravity={24.0}
        fallGravityFactor={1.8}
        maxFallSpeed={45}
        mass={1}
        /* ── Slope: Increased limit to recognize steep steps/ramps as grounds for jumping ── */
        maxSlope={1.45}
        /* ── Collision: High iteration precision to prevent clipping stair corners ── */
        collisionCheckIteration={3}
        collisionPushBackVelocity={1.0}
        collisionPushBackDamping={0.06}
        collisionPushBackThreshold={0.01}
      >
        <group ref={characterRef} dispose={null} position={[0, -1.3, 0]}>
          <primitive object={clone} />
        </group>
      </BVHEcctrl>

      {isTargetingAoE && (
        <group position={[aoeTargetPos.current.x, aoeTargetPos.current.y + 0.05, aoeTargetPos.current.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <ringGeometry args={[2.5, 2.7, 32]} />
            <meshBasicMaterial color="#ec4899" side={THREE.DoubleSide} transparent opacity={0.8} />
          </mesh>
          <mesh>
            <circleGeometry args={[2.5, 32]} />
            <meshBasicMaterial color="#ec4899" side={THREE.DoubleSide} transparent opacity={0.15} />
          </mesh>
        </group>
      )}
    </>
  );
};
