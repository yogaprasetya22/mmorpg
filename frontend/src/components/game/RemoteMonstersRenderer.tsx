'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, Text, Billboard } from "@react-three/drei";
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { MeshoptDecoder } from 'meshoptimizer';
import { MonsterNetworkState, PlayerNetworkState } from "@/src/hooks/useWebSocketGame";
import { useStore } from "@/src/state/useStore";

// ─── Shared reusable Box3 to avoid allocation per monster ────────────────────
const _sharedBox3 = new THREE.Box3();
// ─── Shared scratch vectors to avoid per-frame allocations ───────────────────
const _v3 = new THREE.Vector3();
// ─── Module-level LOD thresholds (hoisted out of useFrame to avoid re-eval every frame) ─
const MONSTER_FAR_SQ     = 55 * 55;  // > 55 units: cull completely
const MONSTER_MED_FAR_SQ = 35 * 35;  // > 35 units: hide billboard + text (much further distance!)


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
    idle:   keys.find(k => k === 'Idle'   || k.toLowerCase() === 'idle')   ?? 'Idle',
    walk:   keys.find(k => k === 'Walk'   || k.toLowerCase().includes('walk') || k === 'Run' || k.toLowerCase() === 'run') ?? 'Idle',
    run:    keys.find(k => k === 'Run'    || k.toLowerCase() === 'run')     ?? 'Idle',
    attack: keys.find(k => k.toLowerCase().includes('attack') || k.toLowerCase().includes('slash') || k.toLowerCase().includes('bash')) ?? 'Idle',
    death:  keys.find(k => k === 'Death'  || k.toLowerCase().includes('death')) ?? 'Idle',
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
      if (path) return path;
    }

    if (isBoss) return '/assets-model/Zombie_Female.glb';
    const MONSTER_MODELS = [
      '/assets-model/Goblin_Male.glb',
      '/assets-model/Goblin_Female.glb',
      '/assets-model/Zombie_Male.glb',
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

  const prevVisualPos = useRef<Float32Array>(new Float32Array(2));
  const hasInitializedPrevVisual = useRef(false);
  const isMoving = useRef(false);
  const currentAnimState = useRef("Idle");
  const monsterIdRef = useRef<string | null>(null);

  // Optimization refs
  const smoothedSpeed = useRef(0);
  const lastTextKey = useRef("");
  const billboardGroupRef = useRef<THREE.Group>(null!);
  // Track HP scale to skip redundant GPU uniform updates
  const lastHpRatio = useRef(-1);
  // Smooth lerp target for HP bar — avoids jarring instant jump when HP changes
  const smoothHpRatio = useRef(1);

  useEffect(() => {
    return () => {
      monsterVisualPositions.delete(monsterId);
    };
  }, [monsterId]);



  // Pre-compute HP bar height once (not every frame)
  const hpBarY = useMemo(() => {
    _sharedBox3.setFromObject(clone);
    const maxY = _sharedBox3.max.y > 0 ? _sharedBox3.max.y : 1.8;
    const scale = isBoss ? 2.3 : 0.9;
    return (maxY * scale) + 0.35;
  }, [clone, isBoss]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // O(1) Map lookup
    const data = monsterMapRef.current?.get(monsterId);

    if (!data || data.is_dead) {
      if (data) monsterVisualPositions.delete(data.id);
      groupRef.current.visible = false;
      hasInitializedPrevVisual.current = false;
      if (activeAction.current) activeAction.current.paused = true;
      return;
    }

    // ─── Density Culling — limit maximum rendered monster count when gathered ──────
    const isDensityCulled = visibleMonsterIdsRef && visibleMonsterIdsRef.current && !visibleMonsterIdsRef.current.has(monsterId);
    if (isDensityCulled) {
      groupRef.current.visible = false;
      if (activeAction.current) activeAction.current.paused = true;
      return;
    }

    // Snap HP bar to full when monster resets (returned to spawn with full HP)
    if (data.hp >= data.max_hp && smoothHpRatio.current < 0.99) {
      smoothHpRatio.current = 1;
      lastHpRatio.current = -1; // force re-render
    }

    // ─── Distance Culling — avoids full skeleton update for far monsters ──────
    // Use squared distance to avoid sqrt on every frame per monster
    _v3.subVectors(state.camera.position, groupRef.current.position);
    const camDistSq = _v3.lengthSq();

    if (camDistSq > MONSTER_FAR_SQ) {
      groupRef.current.visible = false;
      if (activeAction.current) activeAction.current.paused = true;
      return;
    }

    groupRef.current.visible = true;
    if (activeAction.current) activeAction.current.paused = false;

    monsterIdRef.current = data.id;

    // ─── Read flat position fields (no nested object allocation) ─────────────
    const x = data.x;
    const z = data.z;
    const groundY = (window as any).getGroundHeight
      ? (window as any).getGroundHeight(x, z, data.y)
      : data.y;

    const meshX = groupRef.current.position.x;
    const meshY = groupRef.current.position.y;
    const meshZ = groupRef.current.position.z;

    const dx = x - meshX;
    const dz = z - meshZ;
    const distToTargetSq = dx * dx + dz * dz;
    const distToTarget = Math.sqrt(distToTargetSq); // needed for step calc only

    // ─── Resolve target position for attack/rotation ──────────────────────────
    let targetPosX = 0, targetPosZ = 0, hasTarget = false;
    if (data.target_player_id && data.target_player_id !== "") {
      if (data.target_player_id === localPlayerId) {
        const localPos = useStore.getState().playerPosition;
        targetPosX = localPos[0];
        targetPosZ = localPos[2];
        hasTarget = true;
      } else {
        // O(1) Map lookup — replaces O(n) .find() per frame per monster
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

    const serverAnim = (data.animation || "").toLowerCase();
    isMoving.current = distToTarget > 0.05;

    // ─── Determine desired animation state ───────────────────────────────────
    let desiredState = "idle";
    if (data.is_dead || serverAnim === "death") desiredState = "death";
    else if (serverAnim === "attack") desiredState = "attack";
    else if (serverAnim === "run")    desiredState = "run";
    else if (serverAnim === "walk")   desiredState = "walk";
    else if (data.target_player_id && data.target_player_id !== "") {
      if (isMoving.current)        desiredState = "run";
      else if (isWithinAttackRange) desiredState = "attack";
      else                          desiredState = "idle";
    } else if (isMoving.current) {
      desiredState = "walk";
    }

    // ─── Uniform Constant-Speed Movement with Dynamic Catch-up ───────────────
    if (!hasInitializedPrevVisual.current || distToTarget > 3.0) {
      groupRef.current.position.set(x, groundY, z);
      prevVisualPos.current[0] = x;
      prevVisualPos.current[1] = z;
      hasInitializedPrevVisual.current = true;
    } else if (distToTarget > 0.01) {
      let baseSpeed = 1.8;
      if      (desiredState === "run")  baseSpeed = isBoss ? 3.5 : 3.0;
      else if (desiredState === "walk") baseSpeed = isBoss ? 2.0 : 1.8;

      // Dynamic catch-up: scale speed when lagging behind server position
      const speedMult = distToTarget > 0.3
        ? 1.0 + (distToTarget - 0.3) * 2.5
        : 1.0;

      const step = baseSpeed * speedMult * delta;

      if (distToTarget <= step) {
        groupRef.current.position.x = x;
        groupRef.current.position.z = z;
      } else {
        const invDist = 1.0 / distToTarget;
        groupRef.current.position.x += dx * invDist * step;
        groupRef.current.position.z += dz * invDist * step;
      }

      // Smooth Y interpolation to avoid hill jitter
      groupRef.current.position.y += (groundY - meshY) * Math.min(1, 10.0 * delta);
    }

    const currentMeshX = groupRef.current.position.x;
    const currentMeshZ = groupRef.current.position.z;
    const visualDx = currentMeshX - prevVisualPos.current[0];
    const visualDz = currentMeshZ - prevVisualPos.current[1];
    // Use squared distance for speed estimate to avoid a sqrt — accurate enough for low-pass filter
    const visualDistSq = visualDx * visualDx + visualDz * visualDz;
    const visualDistance = visualDistSq > 0.000001 ? Math.sqrt(visualDistSq) : 0;

    monsterVisualPositions.set(data.id, { x: currentMeshX, z: currentMeshZ });
    // Keep window reference for external minimap/targeting code that reads it
    if (!(window as any).monsterVisualPositions) {
      (window as any).monsterVisualPositions = monsterVisualPositions;
    }

    prevVisualPos.current[0] = currentMeshX;
    prevVisualPos.current[1] = currentMeshZ;

    // ─── Low-pass filter speed to prevent animation timescale jitter ─────────
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
      while (diff > Math.PI)  diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * Math.min(1, 12.0 * delta);
    }

    // ─── Animation State Machine (JIT clip name cache initialization) ──────────
    if (actions && Object.keys(actions).length > 0) {
      if (!clipCache.current) {
        clipCache.current = buildClipNameCache(actions);
      }

      if (clipCache.current && currentAnimState.current !== desiredState) {
        const cache = clipCache.current;
        let clipName: string;
        if      (desiredState === "death")  clipName = cache.death;
        else if (desiredState === "attack") clipName = cache.attack;
        else if (desiredState === "run")    clipName = cache.run;
        else if (desiredState === "walk")   clipName = cache.walk;
        else                                clipName = cache.idle;

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

    // ─── Synchronized animation timescale ────────────────────────────────────
    if (activeAction.current) {
      if      (desiredState === "walk") activeAction.current.timeScale = Math.max(0.4, Math.min(1.8, smoothedSpeed.current / 1.5));
      else if (desiredState === "run")  activeAction.current.timeScale = Math.max(0.4, Math.min(2.0, smoothedSpeed.current / 3.0));
      else                              activeAction.current.timeScale = 1.0;
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
          const lvl = isBoss ? 50 : 15;
          const hpInt = Math.round(data.hp);
          const textKey = `${lvl}_${data.name}_${hpInt}`;
          // Only rebuild SDF geometry when text content actually changes
          if (lastTextKey.current !== textKey) {
            textRef.current.text = `[Lv.${lvl}] ${data.name}\n[ HP: ${hpInt} ]`;
            lastTextKey.current = textKey;
          }
        }
      }
    }
  });

  const scale = isBoss ? 2.3 : 0.9;

  return (
    <group ref={groupRef} visible={false}>
      <Billboard ref={billboardGroupRef} position={[0, hpBarY, 0]} follow={true} visible={false}>
        <Text
          ref={textRef}
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

        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[1.24, 0.16]} />
          <meshBasicMaterial color="#09090b" toneMapped={false} />
        </mesh>

        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.2, 0.12]} />
          <meshBasicMaterial color="#27272a" toneMapped={false} />
        </mesh>

        <mesh ref={hpFillRef} position={[0, 0, 0.002]}>
          <planeGeometry args={[1.2, 0.12]} />
          <meshBasicMaterial color={isBoss ? "#ef4444" : "#f43f5e"} toneMapped={false} />
        </mesh>
      </Billboard>

      <group
        scale={scale}
        onClick={(e) => {
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
}

export const RemoteMonstersRenderer = ({
  worldMonstersRef,
  onAttack,
  connectedPlayersRef,
  localPlayerId,
  gameConfig
}: RemoteMonstersRendererProps) => {
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
  // Pre-allocated scratch array to avoid new array allocation every frame
  const scratchDistances = useRef<{ id: string; distSq: number }[]>([]);

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

      // Reuse scratch array — no heap allocation per frame
      const scratch = scratchDistances.current;
      scratch.length = 0;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.is_dead) continue;  // skip dead monsters from visibility budget
        const dx = m.x - camPos.x;
        const dy = m.y - camPos.y;
        const dz = m.z - camPos.z;
        scratch.push({ id: m.id, distSq: dx * dx + dy * dy + dz * dz });
      }

      scratch.sort((a, b) => a.distSq - b.distSq);

      // Adaptive cap: aggressively reduce skeleton updates under heavy load
      // 80+ monsters: cap 5 (combined with 40 bots = very heavy), 40+: cap 8, otherwise 12
      const densityCap = list.length > 60 ? 5 : list.length > 40 ? 8 : 12;
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
    let changed = false;
    const incomingIds = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      incomingIds.add(list[i].id);
      if (!seenIdsSet.current.has(list[i].id)) {
        seenIdsSet.current.add(list[i].id);
        changed = true;
      }
    }
    
    // Collect keys to prune first to avoid mutating Set while iterating over it (safe in all JS engines)
    const toPrune: string[] = [];
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
      setActiveMonsterIds(Array.from(seenIdsSet.current));
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
