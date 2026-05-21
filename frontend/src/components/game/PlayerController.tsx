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

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls, useAnimations, useGLTF } from '@react-three/drei';
import BVHEcctrl, { useAnimationStore, characterStatus } from 'bvhecctrl';
import * as THREE from 'three';
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
const _targetVec  = new THREE.Vector3();

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
const AUTO_FIRE_RATE  = 750;   // ms between auto-shots
const AUTO_AIM_RADIUS = 40.0;  // world units detection radius (MM Role)
const AUTO_AIM_RSQ    = AUTO_AIM_RADIUS * AUTO_AIM_RADIUS;

// Camera Collision Check
const _rayDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

// ─── MMORPG STATE MACHINE ────────────────────────────────────────────────────
const charState = new Uint8Array(1);     // 0=NORMAL, 1=ATTACKING, 2=CHASING
const attackTimer = new Float64Array(1); // Time spent in attack animation
const ATTACK_DURATION = 600;             // ms animation lock duration
const _chaseDir = new THREE.Vector3();
const _camProjDir = new THREE.Vector3();
const _camRightDir = new THREE.Vector3();


// ─── COMPONENT ───────────────────────────────────────────────────────────────
export const PlayerController = ({
  modelPath = '/assets-model/Chef_Male.glb',
  playerClass = 'Warrior',
  damageQueue,
  settingsRef,
  paused = false,
  unitRegistry: _unitRegistry,
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
  const spellsPtr       = useRef(0);
  const mmSpellPtr      = useRef(0);
  const fighterSpellPtr = useRef(0);
  const tankSpellPtr    = useRef(0);
  const assassinSpellPtr = useRef(0);
  const syncAccumulator = useRef(0);
  const lastHpRef = useRef(1000);
  const lastNearestTargetId = useRef<string>("");

  // ─── ASSET LOADING ────────────────────────────────────────────────────────
  const { scene, animations } = useGLTF(modelPath);
  const { actions }           = useAnimations(animations, characterRef);
  const activeAction          = useRef<THREE.AnimationAction | null>(null);

  // --- RESET CAMERA ON GAME START ---
  const gameState = useStore(s => s.gameState);
  useEffect(() => {
    hasCamInit[0] = 0; // Force camera snap on game state change (Play/Setup)
  }, [gameState]);

  // ─── ANIMATION SYNC (outside useFrame, driven by bvhecctrl store) ─────────

  const animationStatus = useAnimationStore((s) => s.animationStatus);
  useEffect(() => {
    // If in ATTACKING state, do not apply idle/walk animations (handled in useFrame)
    if (charState[0] === 1) return; 

    const animName   = ecctrlAnimationSet[animationStatus] ?? animationSet.idle;
    const nextAction = actions[animName];
    if (!nextAction || nextAction === activeAction.current) return;

    if (activeAction.current) {
      nextAction.reset().play();
      activeAction.current.crossFadeTo(nextAction, 0.2, true);
    } else {
      nextAction.reset().fadeIn(0.1).play();
    }
    activeAction.current = nextAction;
  }, [animationStatus, actions]);

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
      if (e.button === 0) isLeftClick[0] = 1;
      if (e.button === 2) isRightClick[0] = 1;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isLeftClick[0] = 0;
      if (e.button === 2) isRightClick[0] = 0;
    };
    const preventContext = (e: MouseEvent) => { if (e.button === 2) e.preventDefault(); };

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
    document.addEventListener('contextmenu', preventContext);
    window.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      document.removeEventListener('mousemove',   onMouseMove);
      document.removeEventListener('mousemove',   onPointerLockMove);
      document.removeEventListener('mousedown',   onMouseDown);
      document.removeEventListener('mouseup',     onMouseUp);
      document.removeEventListener('contextmenu', preventContext);
      window.removeEventListener('wheel', onWheel);
    };
  }, [settingsRef]);

  const { spawnVFX } = useVFX();
  const [, getKeys]  = useKeyboardControls();

  // ─── SINGLE USEFRAME: Camera + Auto-Aim Combat (priority 1 = runs AFTER physics) ──
  useFrame((_, delta) => {
    // ─── CHECK DEATH BLOCK & RESURRECTION TELEPORT ───
    const currentHp = playerStats && typeof playerStats.hp !== 'undefined' ? playerStats.hp : 1000;
    const isDead = playerStats && typeof playerStats.hp !== 'undefined' && playerStats.hp <= 0;

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

    if (isDead) {
      // Lock horizontal velocity only — let gravity (Y) run freely
      const vel = characterStatus.linvel;
      ecctrlRef.current?.setLinVel({ x: 0, y: vel.y, z: 0 } as any);
      ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
      
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
      return;
    }

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

    // === CAMERA SYSTEM ===
    _charPos.copy(characterStatus.position as THREE.Vector3);
    (window as any).localPlayerPos = _charPos;

    // Failsafe: Snapping player back up if they fall below the sculpted ground level
    const activeEnv = useEditorStore.getState().environment;
    const terrainConfig = useEditorStore.getState().terrainConfig;
    const baseDistance = (activeEnv === "STORM" || activeEnv === "RAIN" || activeEnv === "THUNDER" || activeEnv === "CLEAR") ? 45.0 : 35.0;
    const mathElev = getTerrainElevation(_charPos.x, _charPos.z, activeEnv, baseDistance, terrainConfig);
    const groundH = typeof window !== 'undefined' && (window as any).getGroundHeight
      ? (window as any).getGroundHeight(_charPos.x, _charPos.z, mathElev)
      : mathElev;

    // Failsafe: Snapping player back up if they fall below the sculpted ground level
    if (!isDead && _charPos.y < groundH - 12.0) {
      if (ecctrlRef.current) {
        // Give BVHEcctrl float spring enough clearance to settle (avoid re-clipping)
        ecctrlRef.current.group.position.y = groundH + 5.0;
        ecctrlRef.current.resetLinVel();
        _charPos.y = groundH + 5.0;
        console.warn("⚠️ Player fell through map! Snapped back to ground height:", groundH + 5.0);
      }
    } else if (!isDead && _charPos.y < groundH - 0.05) {
      // Real-time anti-penetration: Push player up to terrain surface immediately if they clip
      if (ecctrlRef.current) {
        ecctrlRef.current.group.position.y = groundH;
        _charPos.y = groundH;
        if (ecctrlRef.current.setLinVel) {
          const currentVel = characterStatus.linvel;
          ecctrlRef.current.setLinVel(new THREE.Vector3(currentVel.x, Math.max(0, currentVel.y), currentVel.z));
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
        const fwd = new THREE.Vector3(0, 0, 1);
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
    const _shoulderOffset = new THREE.Vector3().set(Math.cos(camYaw[0]), 0, -Math.sin(camYaw[0])).multiplyScalar(SHOULDER_OFFSET);
    
    _camTarget.copy(_charPos).add(_shoulderOffset);
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

    const colliders = (window as any).globalColliders || [];
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

    const now = performance.now();

    // ── Find Lowest-HP Enemy Unit within Range ──
    hasTarget[0] = 0;
    let nearestTarget: UnitRuntimeData | null = null;
    const grid = (window as any).battleGrid; 
    
    if (grid) {
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

    const keys = getKeys();
    const isMovingInput = keys.forward || keys.backward || keys.leftward || keys.rightward;
    const isAttackInput = isLeftClick[0] || keys.action1;

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
      if (!hasTarget[0] || !nearestTarget) {
        const alertBox = document.getElementById("no-target-alert");
        if (alertBox) {
          alertBox.style.opacity = "1";
          if ((window as any)._targetAlertTimeout) {
            clearTimeout((window as any)._targetAlertTimeout);
          }
          (window as any)._targetAlertTimeout = setTimeout(() => {
            alertBox.style.opacity = "0";
          }, 1200);
        }
        return;
      }
      (window as any).lastSkillTime = now;

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

      executeClassSkill(playerClass, nearestTarget as any, ctx);
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

    // ── Passive System Ticks ──
    if (typeof (window as any).lastPassiveTick === 'undefined') {
      (window as any).lastPassiveTick = 0;
    }
    if (now - (window as any).lastPassiveTick > 3000) {
      (window as any).lastPassiveTick = now;

      if (playerClass === "Priest") {
        spawnVFX([_charPos.x, _charPos.y + 1.2, _charPos.z], "magic", "#10b981"); // Grace healing sparkle
      } else if (playerClass === "Warrior" && aimTargetX[0]) {
        spawnVFX([_charPos.x, _charPos.y + 1.2, _charPos.z], "magic", "#f97316"); // Iron Will shield shield spark
      }
    }

    // Check Input triggers
    if (isAttackInput && now - autoFireTimer[0] > AUTO_FIRE_RATE) {
      if (hasTarget[0]) {
        const dx = aimTargetX[0] - _charPos.x;
        const dz = aimTargetZ[0] - _charPos.z;
        const distSq = dx*dx + dz*dz;
        
        // Use standard range to initiate chase from normal input
        if (distSq > activeRangeSq) {
          // 4. Otomatis Mengejar Musuh
          charState[0] = 2; // CHASING
        } else {
          // 2. Combo Diam di Tempat (Reset timer jika serang lagi)
          charState[0] = 1; // ATTACKING
          attackTimer[0] = now;
          autoFireTimer[0] = now;
          ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
          executeAttack(nearestTarget);
        }
      } else {
        // Memukul angin
        charState[0] = 1; // ATTACKING
        attackTimer[0] = now;
        autoFireTimer[0] = now;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        executeAttack(null);
      }
    }

    // Process Active States
    if (charState[0] === 1) { 
      // == STATE: ATTACKING ==
      if (isMovingInput) {
        // 3. Batal Memukul Jika Bergerak (Cancel/Override)
        charState[0] = 0; 
      } else {
        // 1. Berhenti Saat Menyerang (Animation Lock)
        // Lock horizontal velocity — let BVH gravity & float spring handle Y
        const vel = characterStatus.linvel;
        ecctrlRef.current?.setLinVel({ x: 0, y: vel.y, z: 0 } as any);
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        
        // Face target dynamically
        if (hasTarget[0]) {
          _targetVec.set(aimTargetX[0], _charPos.y, aimTargetZ[0]);
          if (characterRef.current.parent) characterRef.current.parent.worldToLocal(_targetVec);
          const localTargetAngle = Math.atan2(_targetVec.x, _targetVec.z);
          let diff = localTargetAngle - characterRef.current.rotation.y;
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
        if (shootAction && shootAction !== activeAction.current) {
          shootAction.reset().play();
          if (activeAction.current) activeAction.current.crossFadeTo(shootAction, 0.1, true);
          activeAction.current = shootAction;
        }

        // Check if animation lock is over
        if (now - attackTimer[0] > ATTACK_DURATION) {
          charState[0] = 0; // Return to normal
        }
      }
    } else if (charState[0] === 2) { 
      // == STATE: CHASING ==
      if (isMovingInput) {
        // Cancel chase if player moves manually
        charState[0] = 0;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
      } else if (hasTarget[0]) {
        const dx = aimTargetX[0] - _charPos.x;
        const dz = aimTargetZ[0] - _charPos.z;
        const distSq = dx*dx + dz*dz;
        
        // While chasing, allow 50% more range area tolerance to immediately trigger melee attack swing without infinite chasing run lag
        const effectiveRangeSq = activeRangeSq * 1.5;
        if (distSq <= effectiveRangeSq) {
          // Reached Target! Stop and Attack
          charState[0] = 1; 
          attackTimer[0] = now;
          autoFireTimer[0] = now;
          ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
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
      // Revert animation if stuck in shoot or melee
      const isStuckAttack = activeAction.current === actions[animationSet.shoot] ||
                            (actions['SwordSlash'] && activeAction.current === actions['SwordSlash']) ||
                            (actions['1H_Melee_Attack_Chop'] && activeAction.current === actions['1H_Melee_Attack_Chop']);
      if (isStuckAttack) {
         const animName = ecctrlAnimationSet[characterStatus.animationStatus] ?? animationSet.idle;
         const nextAction = actions[animName];
         if (nextAction && nextAction !== activeAction.current) {
            nextAction.reset().fadeIn(0.1).play();
            if (activeAction.current) activeAction.current.crossFadeTo(nextAction, 0.2, true);
            activeAction.current = nextAction;
         }
      }
      
      // Revert local rotation offset
      const resetLerpT = Math.min(1, 10 * delta);
      characterRef.current.rotation.y += (0 - characterRef.current.rotation.y) * resetLerpT;
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
        paused={paused}
        position={[0, 8, 0]}
        /* ── Collider ── */
        colliderCapsuleArgs={[0.4, 1.2, 4, 8]}
        /* ── Float / Ground Detection (BVHEcctrl default-safe values) ── */
        floatCheckType="BOTH"
        floatHeight={0.2}
        floatSpringK={600}
        floatDampingC={28}
        /* ── Movement ── */
        maxWalkSpeed={3.5}
        maxRunSpeed={6.5}
        acceleration={35}
        deceleration={25}
        turnSpeed={20}
        /* ── Jump / Gravity ── */
        jumpVel={5}
        gravity={9.81}
        fallGravityFactor={3.5}
        maxFallSpeed={40}
        mass={1}
        /* ── Slope ── */
        maxSlope={0.85}
        /* ── Collision ── */
        collisionCheckIteration={4}
        collisionPushBackVelocity={1.2}
        collisionPushBackDamping={0.08}
        collisionPushBackThreshold={0.01}
      >
        <group ref={characterRef} dispose={null} position={[0, -1.3, 0]}>
          <primitive object={scene} />
        </group>
      </BVHEcctrl>
    </>
  );
};
