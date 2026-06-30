'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, Text, Billboard } from "@react-three/drei";
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { MeshoptDecoder } from 'meshoptimizer';
import { MonsterNetworkState, PlayerNetworkState } from "@/src/hooks/useWebSocketGame";
import { useStore } from "@/src/state/useStore";
import { useEditorStore } from "@/src/state/useEditorStore";
import { HpBarPlanes } from "./shared/HpBarPlanes";
import { API_BASE_URL } from "@/src/core/config";
import { getTerrainElevation, getCachedTerrainHeight } from '@jagres/shared';

// ─── Shared scratch vectors to avoid per-frame allocations ───────────────────
const _v3 = new THREE.Vector3();
// ─── Module-level LOD thresholds ──────────────────────────────────────────────
const MONSTER_FAR_SQ = 95 * 95;       // > 95 units: cull completely
const MONSTER_MED_FAR_SQ = 40 * 40;   // > 40 units: hide billboard + text
const MONSTER_LOD_SQ = 20 * 20;        // > 20 units: throttle animation updates (10Hz)


// ─── Global visual position registry (module-level Map, not window) ────────────
// Using a module-level Map is cheaper than window property access (avoids prototype chain lookup).
const monsterVisualPositions: Map<string, { x: number; z: number }> = new Map();

export interface RemoteMonsterInstanceProps {
  monsterId: string;
  worldMonstersRef: React.RefObject<MonsterNetworkState[]>;
  monsterMapRef: React.RefObject<Map<string, MonsterNetworkState>>;
  onAttack: (id: string) => void;
  camera: THREE.Camera;
  connectedPlayersRef?: React.RefObject<PlayerNetworkState[]>;
  // Pre-built O(1) lookup map for remote players — avoids O(n) .find() per frame per monster
  remotePlayerMapRef: React.RefObject<Map<string, PlayerNetworkState>>;
  localPlayerId?: string;
  gameConfig?: any;
  visibleMonsterIdsRef?: React.RefObject<Set<string>>;
}

// ─── Clip name cache: precomputed once per GLB load ───────────────────────────
// Avoids repeated Object.keys(actions) + .find() inside useFrame (hot path)
function buildClipNameCache(actions: Record<string, THREE.AnimationAction | null>) {
  const keys = Object.keys(actions);
  return {
    idle: keys.find(k => k === 'Idle' || k.toLowerCase() === 'idle') ?? 'Idle',
    walk: keys.find(k => k === 'Walk' || k.toLowerCase().includes('walk') || k === 'Run' || k.toLowerCase() === 'run') ?? 'Idle',
    run: keys.find(k => k === 'Run' || k.toLowerCase() === 'run') ?? 'Idle',
    attack: keys.find(k => k.toLowerCase().includes('attack') || k.toLowerCase().includes('slash') || k.toLowerCase().includes('bash')) ?? 'Idle',
    death: keys.find(k => k === 'Death' || k.toLowerCase().includes('death')) ?? 'Idle',
  };
}

export const RemoteMonsterInstance = ({
  monsterId,
  worldMonstersRef: _worldMonstersRef,
  monsterMapRef,
  onAttack,
  camera,
  connectedPlayersRef: _connectedPlayersRef, // kept for API compat — logic uses remotePlayerMapRef
  remotePlayerMapRef,
  localPlayerId,
  gameConfig,
  visibleMonsterIdsRef
}: RemoteMonsterInstanceProps) => {
  void camera;

  const isBoss = useMemo(() => {
    const data = monsterMapRef.current?.get(monsterId);
    return data ? (data.type === "boss" || data.name.toLowerCase().includes("boss")) : false;
  }, [monsterId, monsterMapRef]);

  const modelPath = useMemo(() => {
    const data = monsterMapRef.current?.get(monsterId);

    if (data && gameConfig && gameConfig.monster_models) {
      let typeKey = "goblin_male";
      if (isBoss) {
        typeKey = "zombie_female";
      } else {
        const nameLower = data.name.toLowerCase();
        if (nameLower.includes("boss") || nameLower.includes("giant") || nameLower.includes("zombie female")) {
          typeKey = "zombie_female";
        } else if (nameLower.includes("zombie")) {
          typeKey = "zombie_male";
        } else if (nameLower.includes("goblin female")) {
          typeKey = "goblin_female";
        } else {
          typeKey = "goblin_male";
        }
      }
      const path = gameConfig.monster_models[typeKey];
      if (path) return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    }

    if (isBoss) return `${API_BASE_URL}/assets/characters/npcs/Zombie_Female.glb`;
    const MONSTER_MODELS = [
      `${API_BASE_URL}/assets/characters/npcs/Goblin_Male.glb`,
      `${API_BASE_URL}/assets/characters/npcs/Goblin_Female.glb`,
      `${API_BASE_URL}/assets/characters/npcs/Zombie_Male.glb`,
    ];
    let hash = 0;
    if (monsterId) {
      for (let i = 0; i < monsterId.length; i++) {
        hash = monsterId.charCodeAt(i) + ((hash << 5) - hash);
      }
    }
    return MONSTER_MODELS[Math.abs(hash) % MONSTER_MODELS.length];
  }, [monsterId, isBoss, monsterMapRef, gameConfig]);

  const { scene, animations } = useGLTF(modelPath, true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const clone = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        // No shadow on monsters — removes shadow pass draw calls (cuts ~50%)
        child.castShadow = false;
        child.receiveShadow = false;
        // Pre-compute bounding sphere once — skip per-frame auto-compute
        child.geometry?.computeBoundingSphere?.();
        // Freeze material to skip redundant uniform uploads
        if (child.material) {
          child.material.needsUpdate = false;
        }
      }
    });
    return cloned;
  }, [scene]);

  const groupRef = useRef<THREE.Group>(null!);
  const hpFillRef = useRef<THREE.Mesh>(null!);
  const textRef = useRef<any>(null);
  const { actions } = useAnimations(animations, groupRef);
  const activeAction = useRef<THREE.AnimationAction | null>(null);

  // ─── Clip name cache (built once, not every frame) ─────────────────────────
  const clipCache = useRef<ReturnType<typeof buildClipNameCache> | null>(null);
  // Cache: whether actions object has any keys (avoids Object.keys() alloc per frame)
  const hasActionsRef = useRef(false);
  useEffect(() => {
    if (actions) {
      for (const _k in actions) { hasActionsRef.current = true; return; }
    }
    hasActionsRef.current = false;
  }, [actions]);

  const prevVisualPos = useRef<Float32Array>(new Float32Array(2));
  const hasInitializedPrevVisual = useRef(false);
  const isMoving = useRef(false);
  const currentAnimState = useRef("Idle");
  const monsterIdRef = useRef<string | null>(null);
  const stateBufferRef = useRef<{ x: number; y: number; z: number; animation: string; timestamp: number }[]>([]);

  // Optimization refs
  const smoothedSpeed = useRef(0);
  const lastTextKey = useRef("");
  const billboardGroupRef = useRef<THREE.Group>(null!);
  // Track HP scale to skip redundant GPU uniform updates
  const lastHpRatio = useRef(-1);
  // Smooth lerp target for HP bar — avoids jarring instant jump when HP changes
  const smoothHpRatio = useRef(1);
  const prevHp = useRef(-1);
  const flinchEndTime = useRef(0);
  const _lastAnimUpdate = useRef(0); // throttle for far monster animation updates

  useEffect(() => {
    return () => {
      monsterVisualPositions.delete(monsterId);
    };
  }, [monsterId]);




  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // O(1) Map lookup
    // O(1) Map lookup
    let data = monsterMapRef.current?.get(monsterId);
    if (!data && _worldMonstersRef.current) {
      // Fallback search to prevent frame-ordering race conditions!
      data = _worldMonstersRef.current.find(m => m.id === monsterId);
    }

    if (!data || data.is_dead) {
      if (data) monsterVisualPositions.delete(data.id);
      groupRef.current.visible = false;
      hasInitializedPrevVisual.current = false;
      if (activeAction.current) activeAction.current.paused = true;
      return;
    }
    // Flinch stagger detection
    if (prevHp.current === -1) {
      prevHp.current = data.hp;
    } else if (data.hp < prevHp.current) {
      flinchEndTime.current = performance.now() + 220; // 220ms stagger lock duration
      prevHp.current = data.hp;
    } else {
      prevHp.current = data.hp;
    }
    // ─── Density Culling — limit maximum rendered monster count when gathered ──────
    // Disable density culling if overall monster count is low to prevent desync hiding
    const isDensityCulled = (_worldMonstersRef.current && _worldMonstersRef.current.length > 12) &&
      visibleMonsterIdsRef && visibleMonsterIdsRef.current && !visibleMonsterIdsRef.current.has(monsterId);

    // ─── Distance Culling — avoids full skeleton update for far monsters ──────
    // Compare distance to server coordinates directly for consistency
    _v3.set(data.x, data.y, data.z);
    _v3.sub(state.camera.position);
    const camDistSq = _v3.lengthSq();

    const isCurrentlyVisible = !isDensityCulled && camDistSq <= MONSTER_FAR_SQ;

    // Get client terrain elevation with spatial cache (avoids 600+ BVH raycasts/sec)
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

    // Snap position and rotation if culled to keep state synchronized
    if (!isCurrentlyVisible) {
      groupRef.current.position.set(data.x, terrainY, data.z);
      groupRef.current.visible = false;
      if (activeAction.current) activeAction.current.paused = true;
      return;
    }

    groupRef.current.visible = true;
    if (activeAction.current) activeAction.current.paused = false;

    // Snap HP bar to full when monster resets (returned to spawn with full HP)
    if (data.hp >= data.max_hp && smoothHpRatio.current < 0.99) {
      smoothHpRatio.current = 1;
      lastHpRatio.current = -1; // force re-render
    }

    monsterIdRef.current = data.id;

    // ─── Read flat position fields (no nested object allocation) ─────────────
    const x = data.x;
    const z = data.z;
    // Client-side 3D terrain elevation handles server flat coordinate mapping
    const groundY = terrainY;

    // Push new network state to buffer if it differs from the last pushed state
    const buf = stateBufferRef.current;
    if (buf.length === 0 ||
      buf[buf.length - 1].x !== x ||
      buf[buf.length - 1].z !== z ||
      buf[buf.length - 1].animation !== (data.animation || "")) {
      buf.push({
        x: x,
        y: groundY,
        z: z,
        animation: data.animation || "",
        timestamp: (data as any).receivedAt || performance.now()
      });
      if (buf.length > 30) buf.shift(); // Limit queue length to 30 frames
    }

    // Perform Entity Interpolation with a 160ms visual buffer delay to absorb 20Hz network jitter
    const renderTime = performance.now() - 160;

    let targetX = x;
    let targetY = groundY;
    let targetZ = z;
    let targetAnim = data.animation || "";

    if (buf.length >= 2) {
      let i = 0;
      for (; i < buf.length - 1; i++) {
        if (buf[i].timestamp <= renderTime && buf[i + 1].timestamp > renderTime) {
          break;
        }
      }

      if (i < buf.length - 1) {
        const start = buf[i];
        const end = buf[i + 1];
        const elapsed = renderTime - start.timestamp;
        const duration = end.timestamp - start.timestamp;
        const alpha = Math.min(1, Math.max(0, elapsed / (duration || 1)));

        targetX = start.x + (end.x - start.x) * alpha;
        targetY = start.y + (end.y - start.y) * alpha;
        targetZ = start.z + (end.z - start.z) * alpha;
        targetAnim = alpha < 0.5 ? start.animation : end.animation;
      } else {
        targetX = buf[buf.length - 1].x;
        targetY = buf[buf.length - 1].y;
        targetZ = buf[buf.length - 1].z;
        targetAnim = buf[buf.length - 1].animation;
      }
    }

    const meshX = groupRef.current.position.x;
    const meshZ = groupRef.current.position.z;

    const dx = x - meshX;
    const dz = z - meshZ;
    const distToTargetSq = dx * dx + dz * dz;
    const distToTarget = Math.sqrt(distToTargetSq);

    // ─── Resolve target position for attack/rotation ──────────────────────────
    let targetPosX = 0, targetPosZ = 0, hasTarget = false;
    if (data.target_player_id && data.target_player_id !== "") {
      if (data.target_player_id === localPlayerId) {
        const localPos = useStore.getState().playerPosition;
        targetPosX = localPos[0];
        targetPosZ = localPos[2];
        hasTarget = true;
      } else {
        const rp = remotePlayerMapRef.current?.get(data.target_player_id);
        if (rp) {
          targetPosX = rp.x;
          targetPosZ = rp.z;
          hasTarget = true;
        }
      }
    }

    let isWithinAttackRange = false;
    if (hasTarget) {
      const tDx = targetPosX - meshX;
      const tDz = targetPosZ - meshZ;
      isWithinAttackRange = (tDx * tDx + tDz * tDz) <= (isBoss ? 4.5 * 4.5 : 3.5 * 3.5);
    }

    const serverAnim = (targetAnim || "").toLowerCase();
    isMoving.current = distToTarget > 0.15;

    // ─── Determine desired animation state ───────────────────────────────────
    let desiredState = "idle";
    const isFlinching = performance.now() < flinchEndTime.current;
    if (data.is_dead || serverAnim === "death") desiredState = "death";
    else if (isFlinching) desiredState = "idle"; // Flinch stagger animation lock
    else if (serverAnim === "attack") desiredState = "attack";
    else if (serverAnim === "run") desiredState = "run";
    else if (serverAnim === "walk") desiredState = "walk";
    else if (data.target_player_id && data.target_player_id !== "") {
      if (isMoving.current) desiredState = "run";
      else if (isWithinAttackRange) desiredState = "attack";
      else desiredState = "idle";
    } else if (isMoving.current) {
      desiredState = "walk";
    }

    // ─── Highly Responsive Lerp Interpolation ───────────────────
    if (!hasInitializedPrevVisual.current || distToTarget > 4.0) {
      groupRef.current.position.set(targetX, targetY, targetZ);
      prevVisualPos.current[0] = targetX;
      prevVisualPos.current[1] = targetZ;
      hasInitializedPrevVisual.current = true;
    } else {
      groupRef.current.position.set(targetX, targetY, targetZ);
    }

    // Flinch stagger visual feedback: tilt backwards slightly (removed position shake/pushback to prevent jitter)
    if (isFlinching && desiredState !== "death") {
      const remainingTime = flinchEndTime.current - performance.now();
      const factor = Math.max(0, Math.min(1, remainingTime / 220));

      // Tilt backwards
      groupRef.current.rotation.x = -0.15 * factor;
    } else {
      groupRef.current.rotation.x = 0;
    }

    const currentMeshX = groupRef.current.position.x;
    const currentMeshZ = groupRef.current.position.z;
    const visualDx = currentMeshX - prevVisualPos.current[0];
    const visualDz = currentMeshZ - prevVisualPos.current[1];
    const visualDistSq = visualDx * visualDx + visualDz * visualDz;
    const visualDistance = visualDistSq > 0.000001 ? Math.sqrt(visualDistSq) : 0;

    monsterVisualPositions.set(data.id, { x: currentMeshX, z: currentMeshZ });
    if (!(window as any).monsterVisualPositions) {
      (window as any).monsterVisualPositions = monsterVisualPositions;
    }

    prevVisualPos.current[0] = currentMeshX;
    prevVisualPos.current[1] = currentMeshZ;

    const currentSpeed = visualDistance / Math.max(0.0001, delta);
    smoothedSpeed.current += (currentSpeed - smoothedSpeed.current) * Math.min(1, 10.0 * delta);

    // ─── Rotation: face target or movement direction ──────────────────────────
    let targetAngle: number | null = null;
    if (serverAnim === "attack" || (isWithinAttackRange && data.target_player_id)) {
      if (hasTarget) {
        targetAngle = Math.atan2(targetPosX - currentMeshX, targetPosZ - currentMeshZ);
      }
    } else if (isMoving.current && (visualDx !== 0 || visualDz !== 0)) {
      targetAngle = Math.atan2(visualDx, visualDz);
    }

    if (targetAngle !== null) {
      let diff = targetAngle - groupRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * Math.min(1, 24.0 * delta);
    }

    // ─── LOD: throttle animation updates for far monsters ─────────────────────
    // > 20 units: only update animation state at 10Hz (mixer.update still runs)
    const isFar = camDistSq > MONSTER_LOD_SQ;
    const nowMs = performance.now();
    const canUpdateAnim = !isFar || (nowMs - _lastAnimUpdate.current >= 100);

    // ─── Animation State Machine (JIT clip name cache initialization) ──────────
    if (hasActionsRef.current && canUpdateAnim) {
      _lastAnimUpdate.current = nowMs;
      if (!clipCache.current) {
        clipCache.current = buildClipNameCache(actions);
      }

      if (clipCache.current && currentAnimState.current !== desiredState) {
        const cache = clipCache.current;
        let clipName: string;
        if (desiredState === "death") clipName = cache.death;
        else if (desiredState === "attack") clipName = cache.attack;
        else if (desiredState === "run") clipName = cache.run;
        else if (desiredState === "walk") clipName = cache.walk;
        else clipName = cache.idle;

        const nextAction = actions[clipName];
        if (nextAction && nextAction !== activeAction.current) {
          if (activeAction.current) {
            nextAction.reset().play();
            activeAction.current.crossFadeTo(nextAction, 0.15, true);
          } else {
            nextAction.reset().fadeIn(0.1).play();
          }
          if (clipName.toLowerCase().includes("death")) {
            nextAction.setLoop(THREE.LoopOnce, 1);
            nextAction.clampWhenFinished = true;
          } else {
            nextAction.setLoop(THREE.LoopRepeat, Infinity);
          }
          activeAction.current = nextAction;
        }
        currentAnimState.current = desiredState;
      }
    }

    // ─── Synchronized animation timescale (also throttled for far monsters) ───
    if (activeAction.current && canUpdateAnim) {
      if (desiredState === "walk") activeAction.current.timeScale = Math.max(0.4, Math.min(1.8, smoothedSpeed.current / 1.5));
      else if (desiredState === "run") activeAction.current.timeScale = Math.max(0.4, Math.min(2.0, smoothedSpeed.current / 3.0));
      else activeAction.current.timeScale = 1.0;
    }

    // ─── Billboard & HP UI (hidden beyond MED_FAR_SQ) ────────────────────────
    if (billboardGroupRef.current) {
      if (camDistSq > MONSTER_MED_FAR_SQ) {
        billboardGroupRef.current.visible = false;
      } else {
        billboardGroupRef.current.visible = true;

        if (hpFillRef.current) {
          const targetRatio = Math.max(0, Math.min(1, data.hp / data.max_hp));
          // Lerp toward target ratio — smooth drain animation ~8 units/sec feels responsive yet premium
          const lerpSpeed = targetRatio < smoothHpRatio.current ? 6.0 : 12.0; // drain slower, refill faster
          smoothHpRatio.current += (targetRatio - smoothHpRatio.current) * Math.min(1, lerpSpeed * delta);
          const ratio = smoothHpRatio.current;
          // Skip GPU uniform update if ratio hasn't changed meaningfully
          if (Math.abs(ratio - lastHpRatio.current) > 0.0005) {
            hpFillRef.current.scale.x = ratio;
            hpFillRef.current.position.x = -0.6 * (1 - ratio);
            lastHpRatio.current = ratio;
          }
        }

        if (textRef.current) {
          const lvl = data.level ?? (isBoss ? 50 : 15);
          const hpInt = Math.round(data.hp);
          const skillName = (data as any).current_skill || '';
          const textKey = `${lvl}_${data.name}_${hpInt}_${skillName}`;
          // Only rebuild SDF geometry when text content actually changes
          if (lastTextKey.current !== textKey) {
            const skillLine = skillName ? `\n[ ${skillName}! ]` : '';
            textRef.current.text = `[Lv.${lvl}] ${data.name}\n[ HP: ${hpInt} ]${skillLine}`;
            lastTextKey.current = textKey;
          }
        }
      }
    }
  });

  const scale = isBoss ? 2.3 : 0.9;

  return (
    <group ref={groupRef}>
      <Billboard ref={billboardGroupRef} position={[0, 0.25, 0]} follow={true} visible={false}>
        <Text
          ref={textRef}
          font="/Press_Start_2P/PressStart2P-Regular.ttf"
          fontSize={0.22}
          position={[0, 0.25, 0]}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.035}
          outlineColor="#000000"
          color={isBoss ? "#ef4444" : "#f97316"}
          depthOffset={-5}
        >
          {""}
        </Text>

        <HpBarPlanes type={isBoss ? "boss" : "monster"} fillRef={hpFillRef} />
      </Billboard>

      <group
        scale={scale}
        onClick={(e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (monsterIdRef.current) onAttack(monsterIdRef.current);
        }}
      >
        <primitive object={clone} />
      </group>
    </group>
  );
};

export interface RemoteMonstersRendererProps {
  worldMonstersRef: React.RefObject<MonsterNetworkState[]>;
  onAttack: (id: string) => void;
  connectedPlayersRef: React.RefObject<PlayerNetworkState[]>;
  localPlayerId?: string;
  gameConfig?: any;
  settingsRef?: React.RefObject<any>;
}

export const RemoteMonstersRenderer = ({
  worldMonstersRef,
  onAttack,
  connectedPlayersRef,
  localPlayerId,
  gameConfig,
  settingsRef
}: RemoteMonstersRendererProps) => {
  if (settingsRef) { /* bypass */ }
  const { camera } = useThree();
  const [activeMonsterIds, setActiveMonsterIds] = useState<string[]>([]);
  const seenIdsSet = useRef<Set<string>>(new Set());
  const visibleMonsterIdsRef = useRef<Set<string>>(new Set());

  // O(1) lookup map for monsters — rebuilt cheaply each frame
  const monsterMapRef = useRef<Map<string, MonsterNetworkState>>(new Map());

  // O(1) lookup map for remote players — eliminates O(n) .find() per monster per frame
  const remotePlayerMapRef = useRef<Map<string, PlayerNetworkState>>(new Map());

  // ─── Throttle refs — avoid O(n log n) sort every frame ───────────────────
  const lastSortTime = useRef(-1);
  // Pre-allocated scratch array AND object pool — zero heap allocs in sort hot-path
  const scratchDistances = useRef<{ id: string; distSq: number }[]>([]);
  // Object pool: reuse {id, distSq} entries instead of `new {}` every sort tick
  const _sortObjPool = useRef<{ id: string; distSq: number }[]>([]);

  // ─── Per-frame Set & array pre-allocs (moved out of useFrame body) ───────
  // incomingIds and toPrune are reused in-place every frame — no new allocation
  const _incomingIdsSet = useRef<Set<string>>(new Set());
  const _toPruneArr = useRef<string[]>([]);
  // Pre-allocated output array for activeMonsterIds — filled via loop, not Array.from()
  const _activeMonsterIdsArr = useRef<string[]>([]);

  useFrame((state) => {
    // ─── Rebuild monster map (O(n) but very cheap) ───────────────────────────
    const list = worldMonstersRef.current || [];
    const map = monsterMapRef.current;
    map.clear();
    for (let i = 0; i < list.length; i++) {
      map.set(list[i].id, list[i]);
    }

    // ─── Rebuild remote player map (O(n) but very cheap) ─────────────────────
    const players = connectedPlayersRef.current || [];
    const pMap = remotePlayerMapRef.current;
    pMap.clear();
    for (let i = 0; i < players.length; i++) {
      pMap.set(players[i].id, players[i]);
    }

    // ─── Throttled distance sort (10Hz max) — prevents 60x sort per second ──
    const now = state.clock.elapsedTime;
    if (now - lastSortTime.current >= 0.10) {
      lastSortTime.current = now;

      const camPos = state.camera.position;

      // Reuse scratch array AND object pool — zero new objects on sort hot-path
      const scratch = scratchDistances.current;
      const pool = _sortObjPool.current;
      scratch.length = 0;
      let poolIdx = 0;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.is_dead) continue;  // skip dead monsters from visibility budget
        const dx = m.x - camPos.x;
        const dy = m.y - camPos.y;
        const dz = m.z - camPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        // Reuse pooled object if available, otherwise allocate once and it stays in pool
        if (poolIdx < pool.length) {
          pool[poolIdx].id = m.id;
          pool[poolIdx].distSq = distSq;
          scratch.push(pool[poolIdx]);
        } else {
          const entry = { id: m.id, distSq };
          pool.push(entry);
          scratch.push(entry);
        }
        poolIdx++;
      }

      scratch.sort((a, b) => a.distSq - b.distSq);

      // Adaptive cap: aggressively reduce skeleton updates under heavy load
      // 80+ monsters: cap 15 (combined with 40 bots = very heavy), 40+: cap 25, otherwise 35 (increased visibility limits!)
      const densityCap = list.length > 60 ? 15 : list.length > 40 ? 25 : 35;
      const limit = Math.min(scratch.length, densityCap);

      // Reuse visibleMonsterIdsRef Set in-place — no new Set() allocation
      const visibleSet = visibleMonsterIdsRef.current;
      visibleSet.clear();
      for (let i = 0; i < limit; i++) {
        visibleSet.add(scratch[i].id);
      }
    }

    // ─── Sync monster ID set — add new IDs, prune IDs no longer in server payload ──
    // Without pruning, seenIdsSet grows forever with heavy-monsters causing component pool bloat
    // PERF: incomingIds Set and toPrune array are pre-allocated refs — zero heap alloc per frame
    let changed = false;
    const incomingIds = _incomingIdsSet.current;
    incomingIds.clear();
    for (let i = 0; i < list.length; i++) {
      incomingIds.add(list[i].id);
      if (!seenIdsSet.current.has(list[i].id)) {
        seenIdsSet.current.add(list[i].id);
        changed = true;
      }
    }

    // Collect keys to prune first to avoid mutating Set while iterating over it
    const toPrune = _toPruneArr.current;
    toPrune.length = 0;
    seenIdsSet.current.forEach(id => {
      if (!incomingIds.has(id)) {
        toPrune.push(id);
      }
    });

    if (toPrune.length > 0) {
      for (let i = 0; i < toPrune.length; i++) {
        seenIdsSet.current.delete(toPrune[i]);
      }
      changed = true;
    }

    if (changed) {
      // PERF: Manual loop into pre-allocated array — avoids Array.from() heap alloc
      const out = _activeMonsterIdsArr.current;
      out.length = 0;
      seenIdsSet.current.forEach(id => out.push(id));
      setActiveMonsterIds(out.slice()); // .slice() is required so React sees a new reference
    }
  });

  return (
    <group>
      {activeMonsterIds.map((id) => (
        <Suspense key={id} fallback={null}>
          <RemoteMonsterInstance
            monsterId={id}
            worldMonstersRef={worldMonstersRef}
            monsterMapRef={monsterMapRef}
            onAttack={onAttack}
            camera={camera}
            connectedPlayersRef={connectedPlayersRef}
            remotePlayerMapRef={remotePlayerMapRef}
            localPlayerId={localPlayerId}
            gameConfig={gameConfig}
            visibleMonsterIdsRef={visibleMonsterIdsRef}
          />
        </Suspense>
      ))}
    </group>
  );
};
