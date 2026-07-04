'use client';

import { useMemo, useRef, useState, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from 'three';
import { PlayerNetworkState } from "@/src/hooks/useWebSocketGame";
import { UnitRuntimeData } from "@/src/core/domain/unit.types";
import { useStore } from "@/src/state/useStore";
import { getTerrainElevation, getCachedTerrainHeight } from '@jagres/shared';
import { useEditorStore } from "@/src/features/world-editor/store/useEditorStore";
import { AvatarModel, AvatarHandle } from "./avatar/AvatarModel";
import { classToWeaponCategory, classWeaponMap } from "./avatar/weaponConfigs";
import { HpBarPlanes } from "./shared/HpBarPlanes";

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

// Pre-built player Map for O(1) lookup inside useFrame (avoids O(n) find every 60fps)
export type PlayerMapRef = React.RefObject<Map<string, PlayerNetworkState>>;

export interface RemotePlayerInstanceProps {
  id: string;
  username: string;
  cls: string;
  gender: string;
  connectedPlayersRef: React.RefObject<PlayerNetworkState[]>;
  playerMapRef: PlayerMapRef;
  camera: THREE.Camera;
  gameConfig?: any;
  mmSpellsRef?: React.RefObject<any[]>;
  spellsRef?: React.RefObject<any[]>;
  fighterSpellsRef?: React.RefObject<any[]>;
  tankSpellsRef?: React.RefObject<any[]>;
  assassinSpellsRef?: React.RefObject<any[]>;
  unitRegistry?: React.RefObject<UnitRuntimeData[]>;
  visiblePlayerIdsRef: React.RefObject<Set<string>>;
}

export const RemotePlayerInstance = ({
  id,
  username,
  cls,
  gender,
  connectedPlayersRef: _connectedPlayersRef, // kept for API compat
  playerMapRef,
  camera: _camera, // kept for API compat
  gameConfig: _gameConfig,
  mmSpellsRef,
  spellsRef,
  fighterSpellsRef,
  tankSpellsRef,
  assassinSpellsRef,
  unitRegistry,
  visiblePlayerIdsRef
}: RemotePlayerInstanceProps) => {
  // ── Refs for per-frame values (zero React re-renders) ──
  const poseRef = useRef("Idle");
  const timeScaleRef = useRef(1.0);
  // State mirrors for useFrame-updated values — avoid passing ref.current as prop
  const [pose, setPose] = useState("Idle");
  const [timeScale, setTimeScale] = useState(1.0);
  const avatarControlRef = useRef<AvatarHandle>(null);
  const shadowEnabledRef = useRef(true);  // Track shadow state to avoid redundant toggles
  const animPausedRef = useRef(false);    // Track animation pause state to avoid per-frame calls

  // These change rarely (only on server-side appearance update) — useState OK
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | undefined>(undefined);
  const [hairStyle, setHairStyle] = useState<number>(1);
  const [hairColor, setHairColor] = useState<string>("#5A3E2D");

  const remoteCustomization = useMemo(() => {
    return parseCustomization(
      customAvatarUrl,
      gender || 'Male',
      cls || 'Beginner',
      hairStyle,
      hairColor
    );
  }, [customAvatarUrl, gender, cls, hairStyle, hairColor]);

  const groupRef = useRef<THREE.Group>(null!);
  const nameRef = useRef<THREE.Group>(null!);
  const textRef = useRef<any>(null);
  const hpFillRef = useRef<THREE.Mesh>(null!);
  const lastHpRatio = useRef(-1);
  const smoothHpRatio = useRef(1);

  const currentAnimState = useRef("Idle");
  // Smoothed position/rotation for exponential interpolation (replaces buffer-based system).
  // Converges in ~160ms (matching the old 160ms visual buffer delay) without any
  // object allocation or array operations per frame.
  const smoothPos = useRef<{ x: number, y: number, z: number } | null>(null);
  const smoothRot = useRef(0);
  const pendingArrowsRef = useRef<any[]>([]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // O(1) Map lookup — avoids O(n) find() per frame
    let data = playerMapRef.current?.get(id);
    if (!data && _connectedPlayersRef.current) {
      // Fallback search to prevent frame-ordering race conditions!
      data = _connectedPlayersRef.current.find(p => p.id === id);
    }

    if (!data) {
      groupRef.current.visible = false;
      return;
    }

    // ─── Density Culling — limit maximum rendered player count when gathered ──────
    // Disable density culling if overall player count is low to prevent desync hiding
    const isDensityCulled = (_connectedPlayersRef.current && _connectedPlayersRef.current.length > 12) &&
      visiblePlayerIdsRef.current && !visiblePlayerIdsRef.current.has(id);

    // ─── Distance Culling — avoids full skeleton/animation ticks for far players ──────
    const dxCam = state.camera.position.x - data.x;
    const dyCam = state.camera.position.y - data.y;
    const dzCam = state.camera.position.z - data.z;
    const camDistSq = dxCam * dxCam + dyCam * dyCam + dzCam * dzCam;

    const FAR_SQ = 100 * 100;     // > 100 units: cull completely (increased range!)
    const MED_FAR_SQ = 65 * 65;   // > 65 units: hide name tag (increased range!)

    const isCurrentlyVisible = !isDensityCulled && camDistSq <= FAR_SQ;

    // Get client terrain elevation to map desynced or flat server coordinates cleanly onto 3D sculpted landscape
    // ─── Terrain height with spatial cache ──────────────────────────────────
    let terrainY = data.y;
    terrainY = getCachedTerrainHeight(data.x, data.z, () => {
      if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
        const raycastH = (window as any).getGroundHeight(data.x, data.z, -999);
        if (raycastH !== -999) return raycastH;
        const activeEnv = useStore.getState().environment;
        const terrainConfig = useEditorStore.getState().terrainConfig;
        const baseDistance = activeEnv === "STORM" ? 45.0 : 35.0;
        return getTerrainElevation(data.x, data.z, activeEnv, baseDistance, terrainConfig);
      }
      const activeEnv = useStore.getState().environment;
      const terrainConfig = useEditorStore.getState().terrainConfig;
      const baseDistance = activeEnv === "STORM" ? 45.0 : 35.0;
      return getTerrainElevation(data.x, data.z, activeEnv, baseDistance, terrainConfig);
    });

    // Snapping position and rotation if culled to keep state synchronized
    if (!isCurrentlyVisible) {
      const snapY = (Math.abs(data.y) < 0.001 || data.y < terrainY - 5.0) ? (terrainY + 1.18) : data.y;
      groupRef.current.position.set(data.x, snapY, data.z);
      groupRef.current.rotation.y = data.rotation;
      groupRef.current.visible = false;
      // Pause animation ONLY on the transition frame (not every frame)
      if (!animPausedRef.current) {
        animPausedRef.current = true;
        avatarControlRef.current?.setPaused(true);
      }
      return;
    }

    groupRef.current.visible = true;
    // Resume animation when becoming visible after culling
    if (animPausedRef.current) {
      animPausedRef.current = false;
      avatarControlRef.current?.setPaused(false);
    }

    // ─── Distance-based shadow toggle (avoid expensive shadow map render for far players) ──
    const SHADOW_DIST_SQ = 40 * 40;  // 40 units
    const shouldShadow = camDistSq < SHADOW_DIST_SQ;
    if (shouldShadow !== shadowEnabledRef.current) {
      shadowEnabledRef.current = shouldShadow;
      avatarControlRef.current?.setShadowEnabled(shouldShadow);
    }

    // ─── Exponential smoothing (replaces buffer-based interpolation) ──────────
    // Network data arrives at 20Hz. We smooth at 60fps with a ~160ms time constant.
    // This eliminates per-frame object allocation, array push/shift, and buffer search.
    const SMOOTH_TAU = 0.08; // time constant: converges ~90% in 160ms
    const factor = 1 - Math.exp(-delta / SMOOTH_TAU);

    const targetX = data.x;
    let targetY = data.y;
    const targetZ = data.z;
    const targetRot = data.rotation;

    // Adjust targetY using terrain height fallback
    if (Math.abs(targetY) < 0.001 || targetY < terrainY - 5.0) {
      targetY = terrainY + 1.18;
    }

    if (smoothPos.current === null) {
      // First frame — snap to position
      smoothPos.current = { x: targetX, y: targetY, z: targetZ };
      smoothRot.current = targetRot;
    } else {
      // Exponential smoothing
      smoothPos.current.x += (targetX - smoothPos.current.x) * factor;
      smoothPos.current.y += (targetY - smoothPos.current.y) * factor;
      smoothPos.current.z += (targetZ - smoothPos.current.z) * factor;
      // Angle wrapping for rotation slerp
      let diffRot = targetRot - smoothRot.current;
      while (diffRot < -Math.PI) diffRot += Math.PI * 2;
      while (diffRot > Math.PI) diffRot -= Math.PI * 2;
      smoothRot.current += diffRot * factor;
    }

    groupRef.current.position.set(smoothPos.current.x, smoothPos.current.y, smoothPos.current.z);
    groupRef.current.rotation.y = smoothRot.current;

    // Billboard name label or hide if too far
    if (nameRef.current) {
      if (camDistSq > MED_FAR_SQ) {
        nameRef.current.visible = false;
      } else {
        nameRef.current.visible = true;

        // Smoothly update player HP bar scale under Billboard name tag group
        if (hpFillRef.current) {
          const currentHp = data.hp ?? 1000;
          const maxHp = data.maxHp ?? 1000;
          const targetRatio = Math.max(0, Math.min(1, currentHp / maxHp));

          // Lerp HP bar ratio smoothly (6.0 for damage drain, 12.0 for heal refill)
          const lerpSpeed = targetRatio < smoothHpRatio.current ? 6.0 : 12.0;
          smoothHpRatio.current += (targetRatio - smoothHpRatio.current) * Math.min(1, lerpSpeed * delta);
          const ratio = smoothHpRatio.current;

          if (Math.abs(ratio - lastHpRatio.current) > 0.0005) {
            hpFillRef.current.scale.x = ratio;
            hpFillRef.current.position.x = -0.6 * (1 - ratio);
            lastHpRatio.current = ratio;
          }
        }
      }
    }

    // Update text only if changed to avoid expensive Troika dirty checking/re-layouts
    if (textRef.current && nameRef.current.visible) {
      const lvl = data.level || 1;
      const expectedText = `[Lv.${lvl}] ${username || id.substring(0, 8)}`;
      if (textRef.current.text !== expectedText) {
        textRef.current.text = expectedText;
      }
    }

    // Billboard name label: quaternion copy removed — nameRef is a group, not Billboard.
    // Skip camera.quaternion.copy per player — use drei <Billboard> in JSX instead if needed.

    if (data) {
      if (data.custom_avatar_url !== customAvatarUrl) {
        setCustomAvatarUrl(data.custom_avatar_url);
      }
      if (typeof (data as any).hair_style !== 'undefined' && (data as any).hair_style !== hairStyle) {
        setHairStyle((data as any).hair_style);
      }
      if (typeof (data as any).hair_color !== 'undefined' && (data as any).hair_color !== hairColor) {
        setHairColor((data as any).hair_color);
      }
    }

    // Handle animations inside useFrame dynamically without React state re-render!
    const animation = data.animation || "Idle";
    const desired = animation.toLowerCase();
    const isAttacking = desired.includes("shoot") || desired.includes("attack") || desired.includes("slash");
    const isUsingSkill = desired.includes("skill");

    const startedNewAttack = isAttacking && (currentAnimState.current !== animation);
    const startedNewSkill = isUsingSkill && (currentAnimState.current !== animation);

    const hasWeapon = !!remoteCustomization["Weapon"]?.asset;
    const pClass = data.class || cls || "Warrior";
    const nextPose = mapGameAnimationToAvatarPose(animation, hasWeapon, pClass);
    // Drive animation imperatively — zero React re-renders
    if (nextPose !== poseRef.current) {
      poseRef.current = nextPose;
      setPose(nextPose);
      avatarControlRef.current?.setPose(nextPose);
    }

    let nextTimeScale = 1.0;
    // Calculate expected speed based on class to avoid network interpolation speed jitter
    let expectedSpeed = 6.5;
    if (pClass === "Thief" || pClass === "Assassin") expectedSpeed = 9.1;
    else if (pClass === "Warrior" || pClass === "Fighter") expectedSpeed = 7.15;
    else if (pClass === "Beginner" || pClass === "Marksman") expectedSpeed = 6.825;
    else if (pClass === "Mage") expectedSpeed = 5.85;
    else if (pClass === "Priest" || pClass === "Tank") expectedSpeed = 6.5;

    if (desired.includes("walk")) {
      nextTimeScale = Math.max(0.4, Math.min(1.2, (expectedSpeed * 0.54) / 3.0));
    } else if (desired.includes("run")) {
      nextTimeScale = Math.max(0.4, Math.min(2.8, expectedSpeed / 3.2)); // Adjusted divisor and max to prevent sliding using static expected speed
    } else if (desired.includes("jump")) {
      nextTimeScale = 0.8;
    } else if (isAttacking) {
      const remoteAspd = data.aspd ?? 150;
      const remoteRoASPD = 130 + (Math.min(1000, Math.max(0, remoteAspd)) / 1000) * 63;
      const remoteHPS = 50 / (200 - remoteRoASPD);
      nextTimeScale = remoteHPS * 1.2; // Sync with attack duration multiplier
    }
    if (Math.abs(nextTimeScale - timeScaleRef.current) > 0.05) {
      timeScaleRef.current = nextTimeScale;
      setTimeScale(nextTimeScale);
      avatarControlRef.current?.setTimeScale(nextTimeScale);
    }

    currentAnimState.current = animation;



    // ─── CLASS ULTIMATE ACTIVE SKILL VISUALS SYNCHRONIZER (Rising Edge Trigger) ───
    if (startedNewSkill) {
      const pClass = data.class || cls || "Warrior";
      const fromX = groupRef.current.position.x;
      const fromY = groupRef.current.position.y + 1.2;
      const fromZ = groupRef.current.position.z;

      let closestMonster: any = null;

      if (unitRegistry?.current) {
        const units = unitRegistry.current;

        // 1. Authoritative backend Target ID lookup
        if (data.targetId) {
          const idx = units.findIndex(u => u.id === data.targetId && u.isActive && !u.isDying);
          if (idx !== -1) {
            closestMonster = units[idx];
            closestMonster.poolIdx = idx;
          }
        }

        // 2. Client-side spatial fallback using squared distance (avoids sqrt per unit)
        if (!closestMonster) {
          const maxRangeSq = 15.0 * 15.0;
          const uPos = groupRef.current.position;
          let minDistSq = maxRangeSq;

          for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (u.isActive && !u.isDying && u.type === 'enemy') {
              const dx = u.position[0] - uPos.x;
              const dy = u.position[1] - uPos.y;
              const dz = u.position[2] - uPos.z;
              const distSq = dx * dx + dy * dy + dz * dz;
              if (distSq < minDistSq) {
                minDistSq = distSq;
                closestMonster = u;
              }
            }
          }
        }
      }

      let toX = fromX;
      let toY = fromY;
      let toZ = fromZ;

      if (closestMonster) {
        toX = closestMonster.position[0];
        toY = closestMonster.position[1] + 1.2;
        toZ = closestMonster.position[2];
      } else {
        // Fallback forward in facing direction
        const angle = groupRef.current.rotation.y;
        toX = fromX + Math.sin(angle) * 10;
        toY = fromY;
        toZ = fromZ + Math.cos(angle) * 10;
      }

      console.log(`🔥 [VISUAL SYNC] Remote Player ${username} (${pClass}) cast skill targeting (${toX.toFixed(1)}, ${toZ.toFixed(1)})`);

      if (pClass === "Warrior" && fighterSpellsRef?.current) {
        const fPool = fighterSpellsRef.current;
        if (typeof (window as any).globalRemoteFighterPtr === 'undefined') (window as any).globalRemoteFighterPtr = 0;
        const fPtr = (window as any).globalRemoteFighterPtr;

        const fs = fPool[fPtr];
        if (fs) {
          fs.active = true;
          fs.x = toX; fs.y = toY - 1.1; fs.z = toZ;
          fs.startTime = performance.now();
          fs.color = "#ea580c"; // Fiery orange cyclone
          fs.isCyclone = true;
          (window as any).globalRemoteFighterPtr = (fPtr + 1) % fPool.length;
        }
      } else if (pClass === "Thief" && assassinSpellsRef?.current) {
        const aPool = assassinSpellsRef.current;
        if (typeof (window as any).globalRemoteAssassinPtr === 'undefined') (window as any).globalRemoteAssassinPtr = 0;
        const aPtr = (window as any).globalRemoteAssassinPtr;

        const as = aPool[aPtr];
        if (as) {
          as.active = true;
          as.x = toX; as.y = toY - 1.1; as.z = toZ;
          as.startTime = performance.now();
          as.color = "#7e22ce";
          (as as any).isTeleport = true;
          (window as any).globalRemoteAssassinPtr = (aPtr + 1) % aPool.length;
        }
      } else if (pClass === "Priest" && tankSpellsRef?.current) {
        const tPool = tankSpellsRef.current;
        if (typeof (window as any).globalRemoteTankPtr === 'undefined') (window as any).globalRemoteTankPtr = 0;
        const tPtr = (window as any).globalRemoteTankPtr;

        const ts = tPool[tPtr];
        if (ts) {
          ts.active = true;
          ts.isShield = true; // Sanctuary dome
          ts.x = toX; ts.y = toY - 1.1; ts.z = toZ;
          ts.startTime = performance.now();
          ts.color = "#fbbf24";
          (ts as any).ownerId = id;
          (window as any).globalRemoteTankPtr = (tPtr + 1) % tPool.length;
        }
      } else if (pClass === "Mage" && spellsRef?.current) {
        const mPool = spellsRef.current;
        if (typeof (window as any).globalRemoteMagePtr === 'undefined') (window as any).globalRemoteMagePtr = 0;

        for (let m = 0; m < 4; m++) {
          const mPtr = (window as any).globalRemoteMagePtr;
          const ms = mPool[mPtr];
          if (ms) {
            ms.active = true;
            ms.isBullet = false; // falls from sky
            ms.fromX = toX + (Math.random() - 0.5) * 6;
            ms.fromY = toY + 10.0;
            ms.fromZ = toZ + (Math.random() - 0.5) * 6;
            ms.toX = toX + (Math.random() - 0.5) * 4;
            ms.toY = toY - 1.1;
            ms.toZ = toZ + (Math.random() - 0.5) * 4;
            ms.startTime = performance.now();
            ms.color = "#ec4899"; // Arcane Pink meteor
            ms.isMeteor = true;
            (window as any).globalRemoteMagePtr = (mPtr + 1) % mPool.length;
          }
        }
      } else if (pClass === "Beginner" && mmSpellsRef?.current) {
        const pool = mmSpellsRef.current;
        if (typeof (window as any).globalRemoteSpellPtr === 'undefined') (window as any).globalRemoteSpellPtr = 0;

        for (let b = 0; b < 12; b++) {
          const ptr = (window as any).globalRemoteSpellPtr;
          const s = pool[ptr];
          if (s) {
            const angle = (b / 12) * Math.PI * 2;
            s.active = true;
            s.isBullet = true;
            s.fromX = fromX;
            s.fromY = fromY;
            s.fromZ = fromZ;
            s.toX = toX + Math.sin(angle) * 15.0;
            s.toY = toY;
            s.toZ = toZ + Math.cos(angle) * 15.0;
            s.startTime = performance.now();
            s.color = "#ffd700"; // Golden storm bullets
            s.targetId = "";
            (s as any).targetPoolIdx = undefined;
            (s as any).isSniper = true;
            (s as any).isFinisher = true;
            (s as any).bulletSpeed = 140.0;
            (s as any).playerClass = "Beginner";
            (window as any).globalRemoteSpellPtr = (ptr + 1) % pool.length;
          }
        }
      }
    }

    // ─── CLASS BASIC ATTACK VISUALS SYNCHRONIZER (Rising Edge Trigger) ───
    if (startedNewAttack && mmSpellsRef?.current) {
      const pClass = data.class || cls || "Warrior";

      let closestMonster: any = null;

      if (unitRegistry?.current) {
        const units = unitRegistry.current;

        // 1. Authoritative backend Target ID lookup
        if (data.targetId) {
          const idx = units.findIndex(u => u.id === data.targetId && u.isActive && !u.isDying);
          if (idx !== -1) {
            closestMonster = units[idx];
            closestMonster.poolIdx = idx;
          }
        }

        // 2. Client-side spatial fallback using squared distance (avoids sqrt per unit)
        if (!closestMonster) {
          let maxRange = 10.0; // Default (10m)
          if (pClass === "Warrior") maxRange = 4.0;
          else if (pClass === "Thief") maxRange = 4.0;
          else if (pClass === "Beginner") maxRange = 11.0;
          else if (pClass === "Mage") maxRange = 10.0;
          else if (pClass === "Priest") maxRange = 4.5;
          const maxRangeSq = maxRange * maxRange;

          const uPos = groupRef.current.position;
          let minDistSq = maxRangeSq;

          for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (u.isActive && !u.isDying && u.type === 'enemy') {
              const dx = u.position[0] - uPos.x;
              const dy = u.position[1] - uPos.y;
              const dz = u.position[2] - uPos.z;
              const distSq = dx * dx + dy * dy + dz * dz;
              if (distSq < minDistSq) {
                minDistSq = distSq;
                closestMonster = u;
              }
            }
          }
        }
      }

      // Origin coordinates (remote player's hands)
      const fromX = groupRef.current.position.x;
      const fromY = groupRef.current.position.y + 1.2;
      const fromZ = groupRef.current.position.z;

      let toX = fromX;
      let toY = fromY;
      let toZ = fromZ;
      let targetId = "";
      let targetPoolIdx = undefined;

      if (closestMonster) {
        toX = closestMonster.position[0];
        toY = closestMonster.position[1] + 1.2;
        toZ = closestMonster.position[2];
        targetId = closestMonster.id;
        targetPoolIdx = closestMonster.poolIdx;
      } else {
        // Shoot forward in facing direction if no target is within range
        const angle = groupRef.current.rotation.y;
        toX = fromX + Math.sin(angle) * 15;
        toY = fromY;
        toZ = fromZ + Math.cos(angle) * 15;
      }

      // Dynamic visuals per class
      let color = "#ef4444";
      let bulletSpeed = 80.0;
      const isFinisher = Math.random() > 0.6;

      if (pClass === "Mage") {
        color = isFinisher ? "#ec4899" : "#3b82f6";
        bulletSpeed = isFinisher ? 65.0 : 85.0;
      } else if (pClass === "Warrior") {
        color = isFinisher ? "#ea580c" : "#ef4444";
        bulletSpeed = isFinisher ? 55.0 : 75.0;
      } else if (pClass === "Priest") {
        color = isFinisher ? "#fef08a" : "#fbbf24";
        bulletSpeed = isFinisher ? 70.0 : 90.0;
      } else if (pClass === "Thief") {
        color = isFinisher ? "#d8b4fe" : "#7e22ce";
        bulletSpeed = isFinisher ? 120.0 : 165.0;
      } else {
        color = isFinisher ? "#a7f3d0" : "#10b981";
        bulletSpeed = isFinisher ? 80.0 : 100.0;
      }

      // Fetch and setup next spell in the global pool ONLY for Beginner/Marksman class (prevents leaking MM bullets to melee classes!)
      if (pClass === "Beginner") {
        const remoteAspd = data.aspd ?? 150;
        const remoteRoASPD = 130 + (Math.min(1000, Math.max(0, remoteAspd)) / 1000) * 63;
        const remoteHPSVal = 50 / (200 - remoteRoASPD);
        const remoteAttackDuration = 1000 / remoteHPSVal;
        const remoteReleaseDelay = remoteAttackDuration * 0.48; // Release at 48% (when hand releases the bow string)

        pendingArrowsRef.current.push({
          startTime: performance.now(),
          releaseDelay: remoteReleaseDelay,
          fromX,
          fromY,
          fromZ,
          toX,
          toY,
          toZ,
          color,
          targetId,
          targetPoolIdx,
          isFinisher,
          bulletSpeed,
          pClass,
        });
      }

      // Trigger premium class-specific visual layers
      if (pClass === "Warrior" && fighterSpellsRef?.current) {
        const fPool = fighterSpellsRef.current;
        if (typeof (window as any).globalRemoteFighterPtr === 'undefined') (window as any).globalRemoteFighterPtr = 0;
        const fPtr = (window as any).globalRemoteFighterPtr;

        const fs = fPool[fPtr];
        if (fs) {
          fs.active = true;
          fs.x = toX; fs.y = toY - 1.1; fs.z = toZ;
          fs.targetX = toX; fs.targetZ = toZ;
          const dx = toX - fromX;
          const dz = toZ - fromZ;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          fs.rotation = Math.atan2(dx / len, dz / len);
          fs.startTime = performance.now();
          fs.color = color;
          fs.isCyclone = isFinisher;
          (window as any).globalRemoteFighterPtr = (fPtr + 1) % fPool.length;
        }
      } else if (pClass === "Thief" && assassinSpellsRef?.current) {
        const aPool = assassinSpellsRef.current;
        if (typeof (window as any).globalRemoteAssassinPtr === 'undefined') (window as any).globalRemoteAssassinPtr = 0;
        const aPtr = (window as any).globalRemoteAssassinPtr;

        const as = aPool[aPtr];
        if (as) {
          as.active = true;
          as.x = toX; as.y = toY - 1.1; as.z = toZ;
          as.startTime = performance.now();
          as.color = color;
          (as as any).isTeleport = isFinisher;
          (window as any).globalRemoteAssassinPtr = (aPtr + 1) % aPool.length;
        }
      } else if (pClass === "Priest" && tankSpellsRef?.current) {
        const tPool = tankSpellsRef.current;
        if (typeof (window as any).globalRemoteTankPtr === 'undefined') (window as any).globalRemoteTankPtr = 0;
        const tPtr = (window as any).globalRemoteTankPtr;

        const ts = tPool[tPtr];
        if (ts) {
          ts.active = true;
          ts.x = toX; ts.y = toY - 1.1; ts.z = toZ;
          ts.startTime = performance.now();
          ts.color = color;
          ts.isShield = false;
          (window as any).globalRemoteTankPtr = (tPtr + 1) % tPool.length;
        }
      } else if (pClass === "Mage" && spellsRef?.current) {
        const mPool = spellsRef.current;
        if (typeof (window as any).globalRemoteMagePtr === 'undefined') (window as any).globalRemoteMagePtr = 0;
        const mPtr = (window as any).globalRemoteMagePtr;

        const ms = mPool[mPtr];
        if (ms) {
          ms.active = true;
          ms.isBullet = true;
          ms.fromX = fromX; ms.fromY = fromY; ms.fromZ = fromZ;
          ms.toX = toX; ms.toY = toY; ms.toZ = toZ;
          ms.startTime = performance.now();
          ms.color = color;
          ms.isMeteor = isFinisher;
          ms.targetId = targetId;
          (ms as any).targetPoolIdx = targetPoolIdx;
          (window as any).globalRemoteMagePtr = (mPtr + 1) % mPool.length;
        }
      }
    }

    if (pendingArrowsRef.current.length > 0) {
      const now = performance.now();
      pendingArrowsRef.current = pendingArrowsRef.current.filter((arrow: any) => {
        const elapsed = now - arrow.startTime;
        if (elapsed >= arrow.releaseDelay) {
          const pool = mmSpellsRef?.current;
          if (pool) {
            if (typeof (window as any).globalRemoteSpellPtr === 'undefined') {
              (window as any).globalRemoteSpellPtr = 0;
            }
            const ptr = (window as any).globalRemoteSpellPtr;

            const s = pool[ptr];
            if (s) {
              s.active = true;
              s.isBullet = true;
              s.fromX = arrow.fromX;
              s.fromY = arrow.fromY;
              s.fromZ = arrow.fromZ;
              s.toX = arrow.toX;
              s.toY = arrow.toY;
              s.toZ = arrow.toZ;
              s.startTime = performance.now();
              s.color = arrow.color;
              s.targetId = arrow.targetId;
              (s as any).targetPoolIdx = arrow.targetPoolIdx;
              (s as any).isSniper = false;
              (s as any).isFinisher = arrow.isFinisher;
              (s as any).bulletSpeed = arrow.bulletSpeed;
              (s as any).playerClass = arrow.pClass;

              (window as any).globalRemoteSpellPtr = (ptr + 1) % pool.length;
            }
          }
          return false;
        }
        return true;
      });
    }
  });

  return (
    <group ref={groupRef}>
      <group scale={1.0} position={[0, -1.18, 0]}>
        <Suspense fallback={null}>
          <AvatarModel
            customization={remoteCustomization}
            pose={pose}
            timeScale={timeScale}
            controlRef={avatarControlRef}
            skipAnimControl
          />
        </Suspense>
      </group>
      <Billboard ref={nameRef as any} position={[0, -1.1, 0]} follow={true} visible={false}>
        <Text
          ref={textRef}
          font="/Press_Start_2P/PressStart2P-Regular.ttf"
          fontSize={0.22}
          position={[0, 0.25, 0]}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.035}
          outlineColor="#000000"
          color="#06b6d4"
          depthOffset={-5}
        >
          {""}
        </Text>

        <HpBarPlanes type="player" fillRef={hpFillRef} />
      </Billboard>
    </group>
  );
};

export interface RemotePlayersRendererProps {
  activeRemotePlayers?: { id: string; username: string; class: string; gender: string }[];
  connectedPlayersRef: React.RefObject<PlayerNetworkState[]>;
  gameConfig?: any;
  mmSpellsRef?: React.RefObject<any[]>;
  spellsRef?: React.RefObject<any[]>;
  fighterSpellsRef?: React.RefObject<any[]>;
  tankSpellsRef?: React.RefObject<any[]>;
  assassinSpellsRef?: React.RefObject<any[]>;
  unitRegistry?: React.RefObject<UnitRuntimeData[]>;
  settingsRef?: React.RefObject<any>;
  localPlayerId?: string;
}

export const RemotePlayersRenderer = ({
  activeRemotePlayers: _legacyProp,
  connectedPlayersRef,
  gameConfig,
  mmSpellsRef,
  spellsRef,
  fighterSpellsRef,
  tankSpellsRef,
  assassinSpellsRef,
  unitRegistry,
  settingsRef,
  localPlayerId
}: RemotePlayersRendererProps) => {
  if (settingsRef) { /* bypass */ }
  const { camera } = useThree();
  const playerMapRef = useRef<Map<string, PlayerNetworkState>>(new Map());
  const visiblePlayerIdsRef = useRef<Set<string>>(new Set());

  // ─── Self-derived roster from connectedPlayersRef at 1Hz ──────────────────
  // This replaces the broken parent React state prop that was always empty [].
  // By deriving the roster internally, we avoid parent re-renders entirely.
  const [derivedRoster, setDerivedRoster] = useState<{ id: string; username: string; class: string; gender: string }[]>([]);
  const lastRosterHash = useRef("");
  const lastRosterCheck = useRef(0);

  const lastSortTime = useRef(-1);
  // Pre-allocated scratch array and object pool to prevent heap allocation per frame
  const scratchPlayerDistances = useRef<{ id: string; distSq: number }[]>([]);
  const _sortPlayerObjPool = useRef<{ id: string; distSq: number }[]>([]);

  useFrame((state) => {
    const players = connectedPlayersRef.current || [];
    const map = playerMapRef.current;
    map.clear();
    for (let i = 0; i < players.length; i++) {
      map.set(players[i].id, players[i]);
    }

    // ─── 1Hz Roster derivation from connectedPlayersRef ──────────────────
    const now = performance.now();
    if (now - lastRosterCheck.current >= 1000) {
      lastRosterCheck.current = now;
      const remotes = localPlayerId
        ? players.filter(p => p.id !== localPlayerId)
        : players;
      const hash = remotes.map(p => `${p.id}-${p.class || 'B'}-${p.gender || 'M'}`).join(',');
      if (hash !== lastRosterHash.current) {
        lastRosterHash.current = hash;
        const nextList = remotes.map(p => ({
          id: p.id,
          username: (p as any).username || '',
          class: (p as any).class || 'Beginner',
          gender: (p as any).gender || 'Male',
        }));
        setDerivedRoster(nextList);
      }
    }

    // ─── Throttled distance sort (10Hz max) ──────────────────────────────────
    const elapsed = state.clock.elapsedTime;
    if (elapsed - lastSortTime.current >= 0.10) {
      lastSortTime.current = elapsed;

      const camPos = state.camera.position;
      const scratch = scratchPlayerDistances.current;
      const pool = _sortPlayerObjPool.current;
      scratch.length = 0;

      let poolIdx = 0;
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const dx = p.x - camPos.x;
        const dy = p.y - camPos.y;
        const dz = p.z - camPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (poolIdx < pool.length) {
          pool[poolIdx].id = p.id;
          pool[poolIdx].distSq = distSq;
          scratch.push(pool[poolIdx]);
        } else {
          const entry = { id: p.id, distSq };
          pool.push(entry);
          scratch.push(entry);
        }
        poolIdx++;
      }

      scratch.sort((a, b) => a.distSq - b.distSq);

      // Adaptive cap: when loadtest saturates server with 40 bots, limit to 20 closest player skeletons, otherwise 35
      const playerCap = players.length > 30 ? 20 : players.length > 15 ? 28 : 35;
      const visibleSet = visiblePlayerIdsRef.current;
      visibleSet.clear();

      const limit = Math.min(scratch.length, playerCap);
      for (let i = 0; i < limit; i++) {
        visibleSet.add(scratch[i].id);
      }
    }
  });

  return (
    <group>
      {derivedRoster.map((player) => (
        <Suspense key={player.id} fallback={null}>
          <RemotePlayerInstance
            key={player.id}
            id={player.id}
            username={player.username}
            cls={player.class}
            gender={player.gender}
            connectedPlayersRef={connectedPlayersRef}
            playerMapRef={playerMapRef}
            camera={camera}
            gameConfig={gameConfig}
            mmSpellsRef={mmSpellsRef}
            spellsRef={spellsRef}
            fighterSpellsRef={fighterSpellsRef}
            tankSpellsRef={tankSpellsRef}
            assassinSpellsRef={assassinSpellsRef}
            unitRegistry={unitRegistry}
            visiblePlayerIdsRef={visiblePlayerIdsRef}
          />
        </Suspense>
      ))}
    </group>
  );
};
