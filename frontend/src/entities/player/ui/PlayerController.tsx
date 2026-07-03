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

import { useRef, useEffect, useMemo, useState, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls, Html } from '@react-three/drei';
import BVHEcctrl, { characterStatus } from 'bvhecctrl';
import * as THREE from 'three';
import { useVFX } from '@/src/components/game/systems/VFXManager';
import ProjectilePool, { ProjectilePoolHandle } from '@/src/components/game/systems/ProjectilePool';
import { useStore } from '@/src/state/useStore';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';
import { AvatarModel } from '@/src/components/game/avatar/AvatarModel';
import { getTerrainElevation } from '@jagres/shared';
import { classToWeaponCategory, classWeaponMap } from '@/src/components/game/avatar/weaponConfigs';
import {
  releaseNextPendingArrow,
  flushStaleArrows,
} from '@/src/core/combat/strategies/BeginnerStrategy';

const getDefaultCustomization = (_gender: string, playerClass: string, hairStyle = 1, hairColor = "#5A3E2D") => {
  let weaponId = "asset_weapon_sword";
  if (playerClass === "Mage") weaponId = "asset_weapon_scythe";
  else if (playerClass === "Priest") weaponId = "asset_weapon_hammer";
  else if (playerClass === "Thief") weaponId = "asset_weapon_scythe";
  else if (playerClass === "Beginner") weaponId = "asset_weapon_bow";

  const hairAssetId = `asset_hair_${String(hairStyle).padStart(3, '0')}`;

  return {
    "Head": {
      color: "#f5c6a5",
      asset: { id: "asset_head_001", name: "Head #1", group: "cat_head", url: "/assets/characters/modular/heads/Head.001.glb", thumbnail: "/assets/characters/thumbnails/Head.001.png" }
    },
    "Hair": {
      color: hairColor,
      asset: { id: hairAssetId, name: `Hair #${hairStyle}`, group: "cat_hair", url: `/assets/characters/modular/hair_and_hats/Hair.${String(hairStyle).padStart(3, '0')}.glb`, thumbnail: `/assets/characters/thumbnails/Hair.${String(hairStyle).padStart(3, '0')}.png` }
    },
    "Eyes": {
      color: "#3c6285",
      asset: { id: "asset_eyes_001", name: "Eyes #1", group: "cat_eyes", url: "/assets/characters/modular/faces/Eyes.001.glb", thumbnail: "/assets/characters/thumbnails/Eyes.001.png" }
    },
    "EyeBrow": {
      color: "#2d2d2d",
      asset: { id: "asset_eyebrow_001", name: "EyeBrow #1", group: "cat_eyebrow", url: "/assets/characters/modular/faces/EyeBrow.001.glb", thumbnail: "/assets/characters/thumbnails/EyeBrow.001.png" }
    },
    "Nose": {
      color: "",
      asset: { id: "asset_nose_004", name: "Nose #4", group: "cat_nose", url: "/assets/characters/modular/faces/Nose.004.glb", thumbnail: "/assets/characters/thumbnails/Nose.004.png" }
    },
    "Outfit": {
      color: "#4a6fa5",
      asset: { id: "asset_outfit_001", name: "Outfit #1", group: "cat_outfit", url: "/assets/characters/modular/tops/Outfit.001.glb", thumbnail: "/assets/characters/thumbnails/Outfit.001.png" }
    },
    "Shoes": {
      color: "#1a1a1a",
      asset: { id: "asset_shoes_001", name: "Shoes #1", group: "cat_shoes", url: "/assets/characters/modular/accessories/Shoes.001.glb", thumbnail: "/assets/characters/thumbnails/Shoes.001.png" }
    },
    "Weapon": {
      color: "",
      asset: {
        id: weaponId,
        name: playerClass,
        group: "cat_weapon",
        url: `/assets/items/weapons/${weaponId.replace("asset_weapon_", "") === 'sword' ? 'Sword.glb' : weaponId.replace("asset_weapon_", "") === 'scythe' ? 'Battle_Scythe.glb' : weaponId.replace("asset_weapon_", "") === 'hammer' ? 'Battle_Hammer.glb' : 'Battle_Bow.glb'}`,
        thumbnail: ""
      }
    }
  };
};

const parseCustomization = (customizationStr?: string, defaultGender = "Male", defaultClass = "Warrior", hairStyle = 1, hairColor = "#5A3E2D") => {
  let parsed: any = null;
  if (customizationStr) {
    try {
      const obj = JSON.parse(customizationStr);
      if (obj && typeof obj === 'object') {
        parsed = obj;
      }
    } catch (e) {
      console.warn("Failed to parse customization JSON:", e);
    }
  }
  if (!parsed) {
    parsed = getDefaultCustomization(defaultGender, defaultClass, hairStyle, hairColor);
  }

  // Fallback weapon based on class if no weapon asset is equipped
  if (!parsed["Weapon"] || !parsed["Weapon"].asset || !parsed["Weapon"].asset.url) {
    const weaponCat = classToWeaponCategory[defaultClass] || "sword";
    if (defaultClass === "Mage") {
      parsed["Weapon"] = { color: "", asset: null };
    } else {
      const weaponInfo = classWeaponMap[weaponCat] || classWeaponMap["sword"];
      parsed["Weapon"] = {
        color: "",
        asset: {
          id: weaponInfo.assetId,
          name: defaultClass,
          group: "cat_weapon",
          url: `/assets/items/weapons/${weaponInfo.filename}`,
          thumbnail: ""
        }
      };
    }
  }

  return parsed;
};

const mapGameAnimationToAvatarPose = (anim: string, hasWeapon: boolean, playerClass: string) => {
  const lower = anim.toLowerCase();
  // ── Death ──
  if (lower.includes("death")) {
    if (playerClass === "Priest" || playerClass === "Tank") {
      return "Sword And Shield Death";
    }
    if (playerClass === "Beginner") {
      return "Standing Death Forward Archer";
    }
    return "Standing React Death Right";
  }
  // ── Debuffs ──
  if (lower === "stun" || lower === "stunned") return "Stunned";
  if (lower === "freeze" || lower === "frozen" || lower === "dizzy") return "Dizzy";
  // ── Damage ──
  if (lower.includes("hit") || lower.includes("damage")) return "Light Hit To Head";
  // ── Combat ──
  if (lower.includes("attack") || lower.includes("slash") || lower.includes("shoot")) {
    if (playerClass === "Mage" || playerClass === "Priest") {
      return "Magic Heal";
    }
    if (playerClass === "Beginner") {
      return "Standing Draw Arrow";
    }
    return "Stable Sword Outward Slash";
  }
  if (lower.includes("skill") || lower.includes("spell") || lower.includes("heal")) return "Magic Heal";
  // ── Locomotion ──
  if (lower.includes("jump")) return "Jump With Sword";
  if (lower.includes("walk")) return "Walking";
  if (lower.includes("jog")) return "Jogging";
  if (lower.includes("run")) {
    if (playerClass === "Beginner") {
      return "Slow Run";
    }
    return hasWeapon ? "Run With Sword" : "Slow Run";
  }
  return "Idle";
};
import { PlayerProps, CastState } from '../types/player.types';
import { usePlayerControls } from '../hooks/usePlayerControls';
import { updatePlayerCamera } from '../hooks/usePlayerCamera';
import { updatePlayerCasting } from '../hooks/usePlayerCasting';
import { updatePlayerTargeting } from '../hooks/usePlayerTargeting';
import {
  attachArcherSkillListener,
  detachArcherSkillListener,
  executeAoEArcherSkill,
  pickAutoArcherSkill,
  consumePendingArcherSkill,
  clearAllPendingArcherSkills,
} from '@/src/core/combat/archerSkillInput';
import { executeArcherSkill, setArcherSkillOnCooldown, isArcherSkillReady } from '@/src/core/combat/archerSkills';
import {
  handlePlayerResurrectionAndFailsafe,
  handlePlayerPhysicsJump
} from '../hooks/usePlayerPhysics';
import { handlePlayerDebuffs } from '../hooks/usePlayerDebuffs';
import {
  _charPos,
  _originVec,
  _camDir,
  _fwdAxis,
  _tempFwd,
  _idleTargetQuat,
  _idleLookMatrix,
  _lookAt,
  aimTargetX,
  charState,
  animationSet,
  ecctrlAnimationSet,
  AUTO_AIM_RADIUS,
  AUTO_AIM_RSQ,
} from '../buffers';

// NOTE: Archer skill keys (Digit1-6, F1, KeyQ) are NOT listed here.
// They are captured by a dedicated window keydown listener in archerSkillInput.ts
// so they work regardless of canvas focus state.
export const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['Shift'] },
  { name: 'action1', keys: ['KeyF', 'KeyE'] },
];

export const PlayerController = (props: PlayerProps) => {
  const {
    paused = false,
    modelPath: _modelPath = '/assets-model/Chef_Male.glb',
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
    selectedCharacter,
    isAutoMode = false,
  } = props;

  const poolRef = useRef<ProjectilePoolHandle>(null);
  const ecctrlRef = useRef<any>(null);
  const characterRef = useRef<THREE.Group>(null!);
  const { camera } = useThree();
  const spellsPtr = useRef(0);
  const mmSpellPtr = useRef(0);
  const fighterSpellPtr = useRef(0);
  const tankSpellPtr = useRef(0);
  const assassinSpellPtr = useRef(0);
  const syncAccumulator = useRef(0);
  const lastHpRef = useRef(1000);
  const lastNearestTargetId = useRef<string>('');
  const [isTargetingAoE, setIsTargetingAoE] = useState(false);
  const aoeTargetPos = useRef(new THREE.Vector3());
  const [isSpawning, setIsSpawning] = useState(true);

  const [currentSpeed, setCurrentSpeed] = useState(6.5);

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

  // ─── Archer Skill System: attach keyboard listener ───
  useEffect(() => {
    (window as any).__playerClass = playerClass;
    if (playerClass === 'Beginner') {
      attachArcherSkillListener(); // uses AbortController — safe to re-call
      console.log('🏹 Archer skill system initialized! Keys 1-6 + F1 for skills.');
    } else {
      detachArcherSkillListener();
      clearAllPendingArcherSkills();
    }
    return () => {
      // Cleanup on unmount / class change
      if (playerClass === 'Beginner') {
        detachArcherSkillListener();
        clearAllPendingArcherSkills();
      }
    };
  }, [playerClass]);

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

  const dummyActions = useMemo(() => ({}), []);
  const dummyActiveAction = useRef<any>(null);

  const [currentPose, setCurrentPose] = useState("Idle");
  const [currentTimeScale, setCurrentTimeScale] = useState(1.0);

  const localCustomization = useMemo(() => {
    const hasStats = playerStats && typeof playerStats.hp !== 'undefined' && playerStats.hp !== -1;
    const stats = hasStats
      ? playerStats
      : ((playerStatsRef?.current && playerStatsRef.current.hp !== -1) ? playerStatsRef.current : (selectedCharacter || {}));
    return parseCustomization(
      (stats as any).custom_avatar_url || (stats as any).customAvatarUrl,
      (stats as any).gender || 'Male',
      playerClass,
      (stats as any).hair_style || (stats as any).hairStyle || 1,
      (stats as any).hair_color || (stats as any).hairColor || '#5A3E2D'
    );
  }, [selectedCharacter, playerStats, playerClass]);

  /**
   * Stable callback for AvatarModel's onAttackLoop prop.
   * useRef ensures the function reference never changes across renders,
   * so AvatarModel's useEffect (which deps on onAttackLoop) only runs once.
   * releaseNextPendingArrow is module-level — no stale closure risk.
   */
  const _attackLoopRef = useRef((now: number) => releaseNextPendingArrow(now));

  // --- RESET CAMERA ON GAME START ---
  const gameState = useStore(s => s.gameState);
  useEffect(() => {
    const { hasCamInit } = require('../buffers');
    hasCamInit[0] = 0; // Force camera snap on game state change (Play/Setup)
  }, [gameState]);

  // Register controls/events listener
  usePlayerControls(settingsRef);

  const { spawnVFX } = useVFX();
  const [, getKeys] = useKeyboardControls();

  const isDead = playerStats && typeof playerStats.hp !== 'undefined' && playerStats.hp <= 0;

  // ── Death/Respawn stabilization ──
  // When the player dies OR respawns, trigger isSpawning to keep BVHEcctrl
  // paused through the transition.  Without this, the physics controller
  // unpauses instantly on respawn while the teleport hasn't executed yet,
  // causing the capsule to fall through the terrain.
  const prevIsDeadRef = useRef(false);
  useEffect(() => {
    if (isDead !== prevIsDeadRef.current) {
      prevIsDeadRef.current = isDead;
      // Both death (false→true) and respawn (true→false) need stabilization
      setIsSpawning(true);
      const timer = setTimeout(() => {
        setIsSpawning(false);
        console.log(`🎮 ${isDead ? 'Death' : 'Respawn'} stabilization complete.`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDead]);

  useFrame((state, delta) => {
    const finalASPDPercent = playerStatsRef?.current?.aspd ?? (playerStats?.aspd ?? 150);
    const roASPD = 130 + (Math.min(1000, Math.max(0, finalASPDPercent)) / 1000) * 63;
    const hitsPerSecond = 50 / (200 - roASPD);
    const attackDuration = 1000 / hitsPerSecond;

    if (isTargetingAoE) {
      const { _raycaster } = require('../buffers');
      _raycaster.setFromCamera(state.pointer, camera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -_charPos.y);
      _raycaster.ray.intersectPlane(groundPlane, aoeTargetPos.current);
    }

    const currentHp = playerStatsRef?.current && playerStatsRef.current.hp >= 0
      ? playerStatsRef.current.hp
      : (playerStats && typeof playerStats.hp !== 'undefined' ? playerStats.hp : 1000);

    const currentDebuff = playerStatsRef?.current?.debuff || "";

    let anim = "Idle";
    if (isDead) {
      anim = "Death";
    } else if (currentDebuff === "stun" || currentDebuff === "freeze") {
      anim = "Stun";
    } else if (charState[0] === 1) {
      anim = "Attack";
    } else if (performance.now() - ((window as any).lastSkillTime || 0) < 1000) {
      anim = "Skill";
    } else {
      const status = characterStatus.animationStatus;
      anim = ecctrlAnimationSet[status] ?? animationSet.idle;
    }

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
      // Handled via currentPose state mapping
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
        dummyActions,
        dummyActiveAction
      );
      if (debuffed) {
        // Drain skill queue so stale skills don't fire after debuff lifts
        clearAllPendingArcherSkills();
        return;
      }

      // Process Casting
      const casting = updatePlayerCasting(
        castState,
        now,
        playerClass,
        ecctrlRef,
        characterRef,
        dummyActions,
        dummyActiveAction
      );
      // NOTE: We do NOT return here for Beginner — skill queue is checked
      // below regardless of casting state (so mid-cast key presses are queued
      // and executed on the frame casting finishes).
      if (casting && playerClass !== 'Beginner') return;
      if (casting && playerClass === 'Beginner') {
        // Still casting: drain excess queue to avoid pileup, then skip to targeting
        // (skill will execute naturally when casting is false next frame)
      }

      const isChatFocus = !!(document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'));
      const keys = isChatFocus ? {} : getKeys();
      const isMovingInput = !!(keys.forward || keys.backward || keys.leftward || keys.rightward);
      const isAttackInput = !!(keys.action1 || (window as any).hasAttackIntent || (isAutoMode && !isMovingInput) || ((window as any).isAutoAttacking && !isMovingInput));
      if ((window as any).hasAttackIntent) {
        (window as any).hasAttackIntent = false;
      }


      // ─── AoE Ground Skill (non-Beginner classes only) ───
      // For Beginner / Archer, all skills (incl. KeyQ) go through archerSkillInput.ts.
      // This block is for Warrior/Mage/Priest/Thief using their class AoE skills.
      if (playerClass !== 'Beginner') {
        const SKILL_COOLDOWN = 8000;
        if (typeof (window as any).lastSkillTime === 'undefined') {
          (window as any).lastSkillTime = 0;
        }

        let triggerAutoSkill = false;
        if (isAutoMode && now - (window as any).lastSkillTime > SKILL_COOLDOWN && !castState.current.isCasting && currentDebuff !== "silence" && !isMovingInput) {
          const targetId = lastNearestTargetId.current;
          const targetMonster = targetId ? unitRegistry?.current?.find((m: any) => m.id === targetId && m.isActive && !m.isDying) : null;
          if (targetMonster) {
            const tx = targetMonster.position[0];
            const ty = targetMonster.position[1];
            const tz = targetMonster.position[2];
            const dx = tx - _charPos.x;
            const dz = tz - _charPos.z;
            const distSq = dx * dx + dz * dz;
            let activeRangeSqLocal = 81.0;
            if (playerClass === "Warrior") activeRangeSqLocal = 12.25;
            else if (playerClass === "Thief") activeRangeSqLocal = 10.89;
            else if (playerClass === "Priest") activeRangeSqLocal = 14.44;
            else if (playerClass === "Mage") activeRangeSqLocal = 64.0;
            if (distSq <= activeRangeSqLocal) {
              aoeTargetPos.current.set(tx, ty, tz);
              triggerAutoSkill = true;
            }
          }
        }

        if (triggerAutoSkill && currentDebuff !== "silence") {
          (window as any).lastSkillTime = now;
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
          castState.current = {
            isCasting: true,
            startTime: now,
            totalTime: totalCastTime * 1000,
            fctTime: fct * 1000,
            vctTime: vctActual * 1000,
            target: mockTarget,
            context: ctx,
          };
        } else if (!triggerAutoSkill && !isTargetingAoE && (window as any).__pendingNonArcherSkill) {
          (window as any).__pendingNonArcherSkill = false;
          setIsTargetingAoE(true);
          console.log("🎯 AoE Targeting Mode. Left click to cast, right click to cancel.");
        }
      }


      // ─── Shared skill context builder (used by both manual & auto dispatch) ───
      // Wraps dealPlayerDamage to also push instantly to local damageQueue
      // so DamageHUDBatcher shows numbers immediately (before server round-trip).
      const localDealDamage = (
        targetId: string,
        damage: number,
        isCrit?: boolean,
        isMagic?: boolean,
        customColor?: string
      ) => {
        // Send to server (authoritative)
        if (dealPlayerDamage) dealPlayerDamage(targetId, damage, isCrit);

        // Push locally for instant DamageHUD feedback with skill color
        if (damageQueue?.current) {
          let tx = _charPos.x, ty = _charPos.y + 1.2, tz = _charPos.z;
          // Try to find target position from unitRegistry
          if (unitRegistry?.current) {
            const target = unitRegistry.current.find((m: any) => m.id === targetId);
            if (target) {
              tx = target.position[0];
              ty = target.position[1] + 1.2;
              tz = target.position[2];
            }
          }
          damageQueue.current.push({
            value: Math.round(damage),
            position: [tx, ty, tz],
            isCrit: !!isCrit,
            isMagic: !!isMagic,
            isMiss: false,
            color: customColor || (isCrit ? '#ff3b30' : '#ffcc00'),
            timestamp: performance.now(),
          });
        }
      };

      const buildSkillCtx = () => ({
        charPos: _charPos.clone(),
        originVec: _originVec.clone(),
        camDir: _camDir.clone(),
        combo: 0,
        playerStats,
        dealPlayerDamage: localDealDamage,
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
        playerStatsRef,
        damageQueue,
        unitRegistry,
      });

      // ─── Resolve nearest target for skill use (same as basic attack targeting) ───
      // Uses battleGrid spatial query — identical to usePlayerTargeting's auto-aim.
      const resolveSkillTarget = (_maxRangeSq?: number): any => {
        // 1) Prefer the same locked target the basic attack is tracking
        if (lastNearestTargetId.current && unitRegistry?.current) {
          const locked = unitRegistry.current.find(
            (m: any) => m.id === lastNearestTargetId.current && m.isActive && !m.isDying
          );
          if (locked) return locked;
        }
        // 2) Fallback: battleGrid query with AUTO_AIM_RADIUS (40m) — same as basic attack
        const grid = (window as any).battleGrid;
        if (!grid) return null;
        const nearby = grid.queryRadius(_charPos.x, _charPos.z, AUTO_AIM_RADIUS);
        let best: any = null;
        let bestDistSq = AUTO_AIM_RSQ;
        for (let i = 0; i < nearby.length; i++) {
          const u = nearby[i];
          if (u.type !== 'enemy' || !u.isActive || u.isDying) continue;
          const dx = _charPos.x - u.position[0];
          const dz = _charPos.z - u.position[2];
          const dSq = dx * dx + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            best = u;
          }
        }
        return best;
      };

      // Skills that don't need a target (buffs / traps at player position)
      const NO_TARGET_SKILLS = new Set(['ankle_snare', 'improve_concentration']);

      // ─── Archer Auto-Mode Skill Rotation ───
      if (typeof (window as any).__lastAutoSkillAttempt === 'undefined') {
        (window as any).__lastAutoSkillAttempt = 0;
      }
      const AUTO_SKILL_ATTEMPT_INTERVAL = 1500;
      if (
        playerClass === 'Beginner' &&
        isAutoMode &&
        !isMovingInput &&
        !castState.current.isCasting &&
        currentDebuff !== 'silence' &&
        now - (window as any).__lastAutoSkillAttempt >= AUTO_SKILL_ATTEMPT_INTERVAL
      ) {
        (window as any).__lastAutoSkillAttempt = now;
        const autoSkillId = pickAutoArcherSkill();
        if (autoSkillId) {
          const isNoTarget = NO_TARGET_SKILLS.has(autoSkillId);
          const autoTarget = isNoTarget ? null : resolveSkillTarget();
          const canExecute = isNoTarget || !!autoTarget;
          if (canExecute) {
            let inRange = isNoTarget;
            if (!isNoTarget && autoTarget) {
              const dx = autoTarget.position[0] - _charPos.x;
              const dz = autoTarget.position[2] - _charPos.z;
              inRange = (dx * dx + dz * dz) <= AUTO_AIM_RSQ;
            }
            if (inRange) {
              setArcherSkillOnCooldown(autoSkillId);
              (window as any).lastSkillTime = now;
              console.log(`🤖 AUTO SKILL: ${autoSkillId}${autoTarget ? ` → ${autoTarget.id}` : ' (buff)'}`);
              executeArcherSkill(autoSkillId, autoTarget as any, buildSkillCtx() as any);
            }
          }
        }
      }

      // ─── Archer Manual Skill Dispatch (Keys 1-6, F1 + SkillBar click) ───
      // Keys are captured by window keydown listener (works regardless of canvas focus).
      // Skills execute even during basic attack (charState === 1) — not blocked.
      // Note: castState.current.isCasting guard is intentionally removed;
      // skills queued mid-cast fire on the very next frame when casting ends.
      if (playerClass === 'Beginner' && currentDebuff !== 'silence') {
        // PRIMARY: consume from keydown queue
        let triggeredSkill: string | null = consumePendingArcherSkill();

        // SECONDARY: SkillBar click dispatch (window.__pendingSkillKey)
        if (!triggeredSkill && (window as any).__pendingSkillKey) {
          const pendingKey = (window as any).__pendingSkillKey as string;
          (window as any).__pendingSkillKey = null;
          const CODE_TO_SKILL: Record<string, string> = {
            Digit1: 'double_strafe', Digit2: 'double_strafe',
            Digit3: 'arrow_shower', Digit4: 'arrow_repel',
            Digit5: 'ankle_snare', Digit6: 'improve_concentration',
            F1: 'rain_of_arrows',
          };
          const fromBar = CODE_TO_SKILL[pendingKey];
          if (fromBar && isArcherSkillReady(fromBar)) {
            triggeredSkill = fromBar;
          }
        }

        // Re-verify cooldown (may have changed between keydown and this frame)
        if (triggeredSkill && !isArcherSkillReady(triggeredSkill)) {
          console.log(`⏳ ${triggeredSkill} still on cooldown — skipping`);
          triggeredSkill = null;
        }

        if (triggeredSkill) {
          setArcherSkillOnCooldown(triggeredSkill);
          (window as any).lastSkillTime = now;

          const isNoTarget = NO_TARGET_SKILLS.has(triggeredSkill);
          const skillTarget = isNoTarget ? null : resolveSkillTarget();

          try {
            if (isNoTarget) {
              console.log(`🏹 SKILL: ${triggeredSkill} (buff/trap)`);
              executeArcherSkill(triggeredSkill, null, buildSkillCtx() as any);
            } else if (skillTarget) {
              console.log(`🏹 SKILL: ${triggeredSkill} → ${skillTarget.id}`);
              executeArcherSkill(triggeredSkill, skillTarget, buildSkillCtx() as any);
            } else {
              // No target found — still fire skill along camera direction for visual feedback
              console.log(`⚠️ ${triggeredSkill}: no enemy in auto-aim range — firing along camera`);
              executeArcherSkill(triggeredSkill, null, buildSkillCtx() as any);
            }
          } catch (err) {
            console.error(`❌ Archer skill '${triggeredSkill}' CRASHED:`, err);
          }
        }
      }

      // ─── AoE Archer Skill Confirmation ───
      if (isTargetingAoE && (window as any).triggerAoECast) {
        (window as any).triggerAoECast = false;
        setIsTargetingAoE(false);

        // Check if this is an Archer AoE skill (arrow_shower or rain_of_arrows)
        const pendingAoESkillId = (window as any).__pendingAoESkillId;
        if (pendingAoESkillId && playerClass === 'Beginner') {
          (window as any).__pendingAoESkillId = null;
          const skillCtx = {
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
            playerStatsRef,
            damageQueue,
            unitRegistry,
          };
          executeAoEArcherSkill(pendingAoESkillId, aoeTargetPos.current, skillCtx as any);
          // Skip the generic AoE cast below — handled
        } else {

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
        } // end else (non-archer AoE)
      }

      // Cooldown HUD updating
      const overlay = document.getElementById("skill-cooldown-overlay");
      if (overlay) {
        const elapsed = now - (window as any).lastSkillTime;
        if (elapsed < 8000) {
          const remaining = ((8000 - elapsed) / 1000).toFixed(1);
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

      if (playerClass === "Beginner") {
        // Safety net: flush arrows that are too old (loop event never fired).
        flushStaleArrows(now);
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

      const hasWeapon = !!localCustomization["Weapon"]?.asset;
      const nextPose = mapGameAnimationToAvatarPose(anim, hasWeapon, playerClass);
      if (nextPose !== currentPose) {
        setCurrentPose(nextPose);
      }

      // Adjust animation timescale dynamically to match actual physics velocity
      // so legs sync with ground movement and don't "moonwalk" or slide.
      const linvel = characterStatus.linvel;
      const horizontalSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);
      let nextTimeScale = 1.0;
      if (nextPose === "Walking") {
        nextTimeScale = Math.max(0.3, Math.min(1.4, horizontalSpeed / 1.8));
      } else if (nextPose === "Jogging") {
        nextTimeScale = Math.max(0.4, Math.min(1.2, horizontalSpeed / 3.0));
      } else if (nextPose === "Slow Run" || nextPose === "Run With Sword") {
        nextTimeScale = Math.max(0.4, Math.min(2.8, horizontalSpeed / 3.2));
      } else if (
        nextPose === "Stable Sword Outward Slash" ||
        nextPose === "Standing Draw Arrow" ||
        nextPose === "Magic Heal"
      ) {
        nextTimeScale = hitsPerSecond * 1.2;
      }
      // Smooth interpolation: avoid jarring speed jumps by easing toward target
      const lerpedTimeScale = currentTimeScale + (nextTimeScale - currentTimeScale) * 0.15;
      if (Math.abs(lerpedTimeScale - currentTimeScale) > 0.01) {
        setCurrentTimeScale(lerpedTimeScale);
      }

      // Sync authoritative speed from backend stats to React state to update BVHEcctrl maxRunSpeed/maxWalkSpeed
      const statSpeed = playerStatsRef?.current?.speed || (playerStats?.speed || 6.5);
      if (Math.abs(currentSpeed - statSpeed) > 0.05) {
        setCurrentSpeed(statSpeed);
      }

      // Handle jump overrides
      handlePlayerPhysicsJump(isChatFocus, getKeys, ecctrlRef);

      // ── Idle rotation recovery: smoothly face camera when not moving ──
      // BVHEcctrl rotates its internal "BVHEcctrl-Model" group (parent of characterRef)
      // when there's movement input. After attacking, the model stays facing the attack
      // direction. This smoothly slerps the MODEL GROUP back to camera-facing when idle.
      //
      // Additionally, the targeting code (usePlayerTargeting) accumulates Y rotation on
      // characterRef (the CHILD group) during attacks. This child rotation compounds with
      // the parent's rotation, causing a visible offset. We lerp it back to 0 here.
      //
      // The character's visual forward is +X in model group space (determined empirically
      // from BVHEcctrl's lookAt convention: lookAt(inputDir, origin, up) orients +X toward
      // inputDir). Target angle θ where Rot_Y(θ) · (1,0,0) = camDir:
      //   θ = atan2(-camDir.z, camDir.x)
      const modelGroup = ecctrlRef.current?.model;
      if (modelGroup && !isDead &&
        currentDebuff !== "stun" && currentDebuff !== "freeze") {
        // ── Reset child group Y rotation accumulated during attack/chase ──
        // usePlayerTargeting adds to characterRef.rotation.y when attacking.
        // Smoothly lerp it back to 0 when NOT in attack or chase state.
        if (charState[0] === 0 && characterRef.current) {
          const childRotY = characterRef.current.rotation.y;
          if (Math.abs(childRotY) > 0.001) {
            const resetFactor = 1 - Math.exp(-12.0 * delta);
            characterRef.current.rotation.y += (0 - childRotY) * resetFactor;
          }
        }

        // Parent model group: Kept at last movement rotation (removed camera-facing slerp)
      }
    }
  }, 1);

  return (
    <>
      <ProjectilePool
        ref={poolRef}
        damageQueue={damageQueue}
        dealPlayerDamage={dealPlayerDamage}
        playerClass={playerClass}
        unitRegistry={unitRegistry}
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
        maxWalkSpeed={currentSpeed * 0.45}
        maxRunSpeed={currentSpeed}
        acceleration={65}
        deceleration={55}
        turnSpeed={28}
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
        <group ref={characterRef} dispose={null} position={[0, -1.18, 0]}>
          <Suspense fallback={null}>
            <AvatarModel customization={localCustomization} pose={currentPose} timeScale={currentTimeScale} onAttackLoop={_attackLoopRef.current} />
          </Suspense>

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
