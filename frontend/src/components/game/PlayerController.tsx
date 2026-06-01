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
import { useKeyboardControls, useAnimations, useGLTF, Html } from '@react-three/drei';
import BVHEcctrl, { characterStatus } from 'bvhecctrl';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { MeshoptDecoder } from 'meshoptimizer';
import { useVFX } from './systems/VFXManager';
import ProjectilePool, { ProjectilePoolHandle } from './systems/ProjectilePool';
import { useStore } from '@/src/state/useStore';
import { useEditorStore } from '@/src/state/useEditorStore';
import { getTerrainElevation } from '@/src/core/utils/terrainHeight';
import { PlayerProps, CastState } from './player/types';
import { usePlayerControls } from './player/usePlayerControls';
import { updatePlayerCamera } from './player/usePlayerCamera';
import { updatePlayerCasting } from './player/usePlayerCasting';
import { updatePlayerTargeting } from './player/usePlayerTargeting';
import { updatePlayerAnimation } from './player/usePlayerAnimation';
import {
  handlePlayerResurrectionAndFailsafe,
  handlePlayerPhysicsJump
} from './player/usePlayerPhysics';
import { handlePlayerDebuffs } from './player/usePlayerDebuffs';
import {
  _charPos,
  _originVec,
  _camDir,
  _fwdAxis,
  _tempFwd,
  aimTargetX,
  charState,
  animationSet,
  ecctrlAnimationSet,
  attackTimer
} from './player/buffers';

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

export const PlayerController = (props: PlayerProps) => {
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
  } = props;

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
  const lastNearestTargetId = useRef<string>('');
  const [isTargetingAoE, setIsTargetingAoE] = useState(false);
  const aoeTargetPos = useRef(new THREE.Vector3());
  const [isSpawning, setIsSpawning] = useState(true);

  const castState = useRef<CastState>({
    isCasting: false,
    startTime: 0,
    totalTime: 0,
    fctTime: 0,
    vctTime: 0,
    target: null,
    context: null,
  });

  const stunVFXRef = useRef<THREE.Group>(null!);
  const freezeVFXRef = useRef<THREE.Mesh>(null!);
  const freezeBannerRef = useRef<THREE.Group>(null!);
  const silenceVFXRef = useRef<THREE.Group>(null!);

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
  const { scene, animations } = useGLTF(
    modelPath,
    true,
    true,
    (l: any) => (l as any).setMeshoptDecoder(MeshoptDecoder)
  ) as any;

  const clone = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.geometry?.computeBoundingSphere?.();
        child.raycast = () => {};
      }
    });
    return cloned;
  }, [scene]);

  const { actions }  = useAnimations(animations, characterRef);
  const activeAction = useRef<THREE.AnimationAction | null>(null);

  // --- RESET CAMERA ON GAME START ---
  const gameState = useStore(s => s.gameState);
  useEffect(() => {
    const { hasCamInit } = require('./player/buffers');
    hasCamInit[0] = 0; // Force camera snap on game state change (Play/Setup)
  }, [gameState]);

  // Register controls/events listener
  usePlayerControls(settingsRef);

  const { spawnVFX } = useVFX();
  const [, getKeys]  = useKeyboardControls();

  const isDead = playerStats && typeof playerStats.hp !== 'undefined' && playerStats.hp <= 0;
  const prevAnimStatus = useRef<string>('');

  useFrame((state, delta) => {
    const finalASPDPercent = playerStatsRef?.current?.aspd ?? (playerStats?.aspd ?? 150);
    const hitsPerSecond = 1 + (finalASPDPercent / 125);
    const attackDuration = 1000 / hitsPerSecond;

    if (isTargetingAoE) {
      const { _raycaster } = require('./player/buffers');
      _raycaster.setFromCamera(state.pointer, camera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -_charPos.y);
      _raycaster.ray.intersectPlane(groundPlane, aoeTargetPos.current);
    }

    const currentHp = playerStatsRef?.current && playerStatsRef.current.hp >= 0
      ? playerStatsRef.current.hp
      : (playerStats && typeof playerStats.hp !== 'undefined' ? playerStats.hp : 1000);

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
        const baseDistance = (activeEnv === "STORM" || activeEnv === "RAIN" || activeEnv === "THUNDER" || activeEnv === "CLEAR") ? 45.0 : 35.0;
        groundH = getTerrainElevation(_charPos.x, _charPos.z, activeEnv, baseDistance, terrainConfig);
      }
    } else {
      const baseDistance = (activeEnv === "STORM" || activeEnv === "RAIN" || activeEnv === "THUNDER" || activeEnv === "CLEAR") ? 45.0 : 35.0;
      groundH = getTerrainElevation(_charPos.x, _charPos.z, activeEnv, baseDistance, terrainConfig);
    }

    // Resurrection check & Failsafe
    handlePlayerResurrectionAndFailsafe(lastHpRef, currentHp, isDead, groundH, ecctrlRef);

    if (isDead) {
      // Play death animation
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
    }

    // Update player position in store (for enemy AI targeting)
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
          const status = useStore.getState().gameState === 'PLAYING' ? characterStatus.animationStatus : 'IDLE';
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

    // Camera update
    updatePlayerCamera(camera, delta);

    if (!isDead) {
      let activeRangeSq = 81.0; // Default Marksman / MM (9.0m)
      if (playerClass === "Warrior") {
        activeRangeSq = 12.25;    // Fighter (Melee 3.5 meters)
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
      const currentDebuff = playerStatsRef?.current?.debuff || "";

      // Process Debuffs
      const debuffed = handlePlayerDebuffs(
        now,
        delta,
        currentDebuff,
        castState,
        stunVFXRef,
        freezeVFXRef,
        freezeBannerRef,
        silenceVFXRef,
        ecctrlRef,
        actions,
        activeAction
      );
      if (debuffed) return;

      // Process Casting
      const casting = updatePlayerCasting(
        castState,
        now,
        playerClass,
        ecctrlRef,
        characterRef,
        actions,
        activeAction
      );
      if (casting) return;

      const isChatFocus = !!(document.activeElement && 
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'));
      const keys = isChatFocus ? {} : getKeys();
      const isMovingInput = !!(keys.forward || keys.backward || keys.leftward || keys.rightward);
      const isAttackInput = !!(keys.action1 || (window as any).hasAttackIntent || ((window as any).isAutoAttacking && !isMovingInput));
      if ((window as any).hasAttackIntent) {
        (window as any).hasAttackIntent = false;
      }

      // Skill Trigger System
      const isSkillInput = keys.skill;
      const SKILL_COOLDOWN = 8000;
      if (typeof (window as any).lastSkillTime === 'undefined') {
        (window as any).lastSkillTime = 0;
      }
      const lastSkillTime = (window as any).lastSkillTime;

      if (isSkillInput && now - lastSkillTime > SKILL_COOLDOWN) {
        if (currentDebuff === "silence") {
          console.log("🤫 You are silenced and cannot cast spells!");
        } else if (!isTargetingAoE) {
          setIsTargetingAoE(true);
          console.log("🎯 Entered AoE Ground Targeting Mode. Left click to cast, right click to cancel.");
        }
      }

      if (isTargetingAoE && (window as any).triggerAoECast) {
        (window as any).triggerAoECast = false;
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

        const ctx = {
          charPos: _charPos.clone(),
          originVec: _originVec.clone(),
          camDir: _camDir.clone(),
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
          grid: (window as any).battleGrid,
          ecctrlRef,
          cameraShake: (window as any).cameraShake,
        };

        const stats = playerStatsRef?.current || playerStats || {};
        const dex = stats.base_dex ?? stats.baseDEX ?? 10;
        const int = stats.base_int ?? stats.baseINT ?? 10;

        const fct = 0.4;
        const vctBase = 1.2;
        const vctRatio = Math.min(1.0, (dex + int / 2.0) / 265.0);
        const vctActual = vctBase * (1.0 - vctRatio);
        const totalCastTime = fct + vctActual;

        console.log(`🔮 Starting Cast: DEX=${dex}, INT=${int}, VCT Ratio=${vctRatio.toFixed(3)}, FCT=${fct}s, VCT=${vctActual.toFixed(3)}s, Total=${totalCastTime.toFixed(3)}s`);

        castState.current = {
          isCasting: true,
          startTime: now,
          totalTime: totalCastTime * 1000,
          fctTime: fct * 1000,
          vctTime: vctActual * 1000,
          target: mockTarget,
          context: ctx,
        };
      }

      // Cooldown HUD updating
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

      // Passive System Ticks
      if (typeof (window as any).lastPassiveTick === 'undefined') {
        (window as any).lastPassiveTick = 0;
      }
      if (now - (window as any).lastPassiveTick > 3000) {
        (window as any).lastPassiveTick = now;
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

      // Process Targeting/Attacking
      updatePlayerTargeting(
        now,
        delta,
        playerClass,
        attackDuration,
        activeRangeSq,
        unitRegistry,
        lastNearestTargetId,
        isMovingInput,
        isAttackInput,
        keys,
        ecctrlRef,
        characterRef,
        camera,
        playerStats,
        dealPlayerDamage,
        spawnVFX,
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
        poolRef
      );

      // Lock Melee/Attack animations timescales
      if (charState[0] === 1) {
        let targetAnim = animationSet.shoot;
        if (playerClass === "Warrior" || playerClass === "Thief" || playerClass === "Beginner") {
          if (actions['SwordSlash']) targetAnim = 'SwordSlash';
          else if (actions['1H_Melee_Attack_Chop']) targetAnim = '1H_Melee_Attack_Chop';
        }
        const shootAction = actions[targetAnim] || actions[animationSet.shoot];
        if (shootAction) {
          const defaultAnimationDuration = shootAction.getClip()?.duration || 1.0;
          const animationSpeedScale = hitsPerSecond * defaultAnimationDuration;
          const isNewAttack = now - attackTimer[0] < 30;
          if (shootAction !== activeAction.current || isNewAttack) {
            shootAction.reset().play();
            if (activeAction.current && activeAction.current !== shootAction) {
              activeAction.current.crossFadeTo(shootAction, 0.05, true);
            }
            activeAction.current = shootAction;
          }
          shootAction.timeScale = animationSpeedScale;
        }
      }

      // Update character animation states
      const isAttackingOrCasting = charState[0] === 1 || (window as any).pendingSkillExecution || castState.current.isCasting;
      updatePlayerAnimation(prevAnimStatus, actions, activeAction, isAttackingOrCasting, castState.current.isCasting);

      // Handle jump overrides
      handlePlayerPhysicsJump(isChatFocus, getKeys, ecctrlRef);
    }
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

          <group ref={stunVFXRef} position={[0, 2.3, 0]} visible={false}>
            <mesh position={[0.4, 0, 0]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
            <mesh position={[-0.2, 0, 0.35]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
            <mesh position={[-0.2, 0, -0.35]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
          </group>

          <mesh ref={freezeVFXRef} position={[0, 1.0, 0]} visible={false}>
            <boxGeometry args={[1.2, 2.0, 1.2]} />
            <meshPhysicalMaterial 
              color="#67e8f9" 
              transparent 
              opacity={0.6} 
              roughness={0.1} 
              metalness={0.1}
              transmission={0.6} 
              thickness={1.5} 
            />
          </mesh>

          <group ref={freezeBannerRef} position={[0, 2.2, 0]}>
            <Html center style={{ pointerEvents: 'none' }}>
              <div id="player-debuff-freeze" style={{ display: 'none' }} className="bg-cyan-500/80 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-cyan-300 shadow-md whitespace-nowrap animate-pulse uppercase tracking-widest">
                ❄️ Frozen
              </div>
            </Html>
          </group>

          <group ref={silenceVFXRef} position={[0, 2.2, 0]}>
            <Html center style={{ pointerEvents: 'none' }}>
              <div id="player-debuff-silence" style={{ display: 'none' }} className="bg-red-500/80 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-red-300 shadow-md whitespace-nowrap animate-bounce uppercase tracking-wider">
                🤐 Silenced
              </div>
            </Html>
          </group>
        </group>
      </BVHEcctrl>

      <group position={[_charPos.x, _charPos.y + 1.2, _charPos.z]}>
        <Html center style={{ pointerEvents: 'none' }}>
          <div 
            id="player-cast-bar-container" 
            className="hidden flex flex-col items-center gap-1 select-none"
          >
            <div className="text-[9px] font-black text-amber-300 drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.9)] uppercase tracking-wider">
              Casting...
            </div>
            
            <div className="w-24 h-2 bg-black/85 border border-white/20 rounded shadow-md overflow-hidden flex">
              <div 
                id="player-cast-fct" 
                className="h-full bg-amber-400"
                style={{ width: '0%' }}
              />
              <div 
                id="player-cast-vct" 
                className="h-full bg-emerald-400"
                style={{ width: '0%' }}
              />
            </div>
          </div>
        </Html>
      </group>

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
