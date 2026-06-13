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
import { useVFX } from './systems/VFXManager';
import ProjectilePool, { ProjectilePoolHandle } from './systems/ProjectilePool';
import { useStore } from '@/src/state/useStore';
import { useEditorStore } from '@/src/state/useEditorStore';
import { getTerrainElevation } from '@/src/core/utils/terrainHeight';
import { AvatarModel } from './avatar/AvatarModel';
import { classToWeaponCategory, classWeaponMap } from './avatar/weaponConfigs';

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
import { PlayerProps, CastState } from './player/types';
import { usePlayerControls } from './player/usePlayerControls';
import { updatePlayerCamera } from './player/usePlayerCamera';
import { updatePlayerCasting } from './player/usePlayerCasting';
import { updatePlayerTargeting } from './player/usePlayerTargeting';
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
  _idleTargetQuat,
  _idleLookMatrix,
  _lookAt,
  aimTargetX,
  charState,
  animationSet,
  ecctrlAnimationSet
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
    const stats = selectedCharacter || playerStatsRef?.current || playerStats || {};
    return parseCustomization(
      (stats as any).custom_avatar_url || (stats as any).customAvatarUrl,
      (stats as any).gender || 'Male',
      playerClass,
      (stats as any).hair_style || (stats as any).hairStyle || 1,
      (stats as any).hair_color || (stats as any).hairColor || '#5A3E2D'
    );
  }, [selectedCharacter, playerStats, playerClass]);

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
      if (debuffed) return;

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
        const idleSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);

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

        // ── Parent model group: slerp to camera-facing when idle ──
        if (charState[0] !== 1 && idleSpeed < 0.5) {
          // Get camera forward direction projected onto XZ plane
          camera.getWorldDirection(_camDir);
          _camDir.y = 0;
          if (_camDir.lengthSq() > 0.001) {
            _camDir.normalize();
            // Target angle where +X (character forward) faces camDir
            const targetAngle = Math.atan2(-_camDir.z, _camDir.x);
            // Build a pure Y-axis rotation quaternion (no X/Z tilt)
            _idleTargetQuat.setFromAxisAngle(
              _lookAt.set(0, 1, 0),
              targetAngle
            );
            // Smooth exponential slerp — converges in ~300ms
            const idleRotSpeed = 8.0;
            const slerpFactor = 1 - Math.exp(-idleRotSpeed * delta);
            modelGroup.quaternion.slerp(_idleTargetQuat, slerpFactor);
          }
        }
      }
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
        maxWalkSpeed={currentSpeed}
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
            <AvatarModel customization={localCustomization} pose={currentPose} timeScale={currentTimeScale} />
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
