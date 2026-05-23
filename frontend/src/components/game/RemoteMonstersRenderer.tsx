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

export interface RemoteMonsterInstanceProps {
  monsterId: string;
  worldMonstersRef: React.RefObject<MonsterNetworkState[]>;
  // Pass a pre-built Map for O(1) lookup instead of O(n) find() per frame
  monsterMapRef: React.RefObject<Map<string, MonsterNetworkState>>;
  onAttack: (id: string) => void;
  camera: THREE.Camera;
  connectedPlayersRef?: React.RefObject<PlayerNetworkState[]>;
  localPlayerId?: string;
  gameConfig?: any;
}

export const RemoteMonsterInstance = ({ 
  monsterId, 
  worldMonstersRef: _worldMonstersRef, // kept in props for API compat, logic uses monsterMapRef
  monsterMapRef,
  onAttack, 
  camera,
  connectedPlayersRef,
  localPlayerId,
  gameConfig
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
        // Shadows disabled on remote monsters for significant GPU perf gain.
        // Shadow casting requires expensive shadow-map re-renders every frame.
        child.castShadow = false;
        child.receiveShadow = false;
        // Freeze geometry bounding sphere to skip auto-compute per frame
        child.geometry?.computeBoundingSphere?.();
      }
    });
    return cloned;
  }, [scene]);

  const groupRef = useRef<THREE.Group>(null!);
  const hpFillRef = useRef<THREE.Mesh>(null!);
  const textRef = useRef<any>(null);
  const { actions } = useAnimations(animations, groupRef);
  const activeAction = useRef<THREE.AnimationAction | null>(null);

  const prevVisualPos = useRef({ x: 0, z: 0 });
  const hasInitializedPrevVisual = useRef(false);
  const isMoving = useRef(false);
  const currentAnimState = useRef("Idle");
  const monsterIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if ((window as any).monsterVisualPositions) {
        (window as any).monsterVisualPositions.delete(monsterId);
      }
    };
  }, [monsterId]);

  // Pre-compute HP bar height once (not every frame)
  const hpBarY = useMemo(() => {
    _sharedBox3.setFromObject(clone);
    const maxY = _sharedBox3.max.y > 0 ? _sharedBox3.max.y : 1.8;
    const scale = isBoss ? 2.3 : 0.9;
    return (maxY * scale) + 0.35;
  }, [clone, isBoss]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // O(1) Map lookup — replaces O(n) find() called every frame
    const data = monsterMapRef.current?.get(monsterId);
    
    if (!data || data.is_dead) {
      if (data && (window as any).monsterVisualPositions) {
        (window as any).monsterVisualPositions.delete(data.id);
      }
      groupRef.current.visible = false;
      hasInitializedPrevVisual.current = false;
      return;
    }
    
    groupRef.current.visible = true;
    monsterIdRef.current = data.id;

    const x = data.position.x;
    const z = data.position.z;
    const groundY = (window as any).getGroundHeight ? (window as any).getGroundHeight(x, z, data.position.y) : data.position.y;

    const meshX = groupRef.current.position.x;
    const meshY = groupRef.current.position.y;
    const meshZ = groupRef.current.position.z;
    const distToTarget = Math.hypot(x - meshX, z - meshZ);

    if (!hasInitializedPrevVisual.current || distToTarget > 3.0) {
      groupRef.current.position.set(x, groundY, z);
      prevVisualPos.current = { x, z };
      hasInitializedPrevVisual.current = true;
    } else {
      const lerpFactor = Math.min(1, 8.5 * delta);
      groupRef.current.position.x += (x - meshX) * lerpFactor;
      groupRef.current.position.y += (groundY - meshY) * lerpFactor;
      groupRef.current.position.z += (z - meshZ) * lerpFactor;
    }

    const currentMeshX = groupRef.current.position.x;
    const currentMeshZ = groupRef.current.position.z;
    const visualDx = currentMeshX - prevVisualPos.current.x;
    const visualDz = currentMeshZ - prevVisualPos.current.z;
    const visualDistance = Math.sqrt(visualDx * visualDx + visualDz * visualDz);
    
    if (typeof (window as any).monsterVisualPositions === "undefined") {
      (window as any).monsterVisualPositions = new Map();
    }
    (window as any).monsterVisualPositions.set(data.id, { x: currentMeshX, z: currentMeshZ });

    isMoving.current = visualDistance > 0.002;
    prevVisualPos.current = { x: currentMeshX, z: currentMeshZ };

    if (hpFillRef.current) {
      const ratio = Math.max(0, Math.min(1, data.hp / data.max_hp));
      hpFillRef.current.scale.x = ratio;
      hpFillRef.current.position.x = -0.6 * (1 - ratio);
    }

    if (textRef.current) {
      const lvl = isBoss ? 50 : 15;
      textRef.current.text = `[Lv.${lvl}] ${data.name}\n[ HP: ${Math.round(data.hp)} ]`;
    }

    let targetPos = null;
    if (data.target_player_id && data.target_player_id !== "") {
      if (data.target_player_id === localPlayerId) {
        const localPos = useStore.getState().playerPosition;
        targetPos = { x: localPos[0], z: localPos[2] };
      } else {
        const remotePlayers = connectedPlayersRef?.current || [];
        const rp = remotePlayers.find(p => p.id === data.target_player_id);
        if (rp) targetPos = { x: rp.x, z: rp.z };
      }
    }

    let isWithinAttackRange = false;
    if (targetPos) {
      const tDx = targetPos.x - groupRef.current.position.x;
      const tDz = targetPos.z - groupRef.current.position.z;
      const dist = Math.sqrt(tDx * tDx + tDz * tDz);
      isWithinAttackRange = dist <= (isBoss ? 4.5 : 3.5);
    }

    const serverAnim = (data.animation || "").toLowerCase();

    // Rotate monster to face target or movement direction
    let targetAngle = null;
    if (serverAnim === "attack" || (isWithinAttackRange && data.target_player_id)) {
      if (targetPos) {
        targetAngle = Math.atan2(targetPos.x - groupRef.current.position.x, targetPos.z - groupRef.current.position.z);
      }
    } else if (isMoving.current) {
      targetAngle = Math.atan2(visualDx, visualDz);
    }

    if (targetAngle !== null) {
      let diff = targetAngle - groupRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * Math.min(1, 12.0 * delta);
    }

    let desiredState = "idle";
    if (data.is_dead || serverAnim === "death") desiredState = "death";
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

    if (actions && currentAnimState.current !== desiredState) {
      const keys = Object.keys(actions);
      let clipName = "Idle";

      if (desiredState === "death") {
        clipName = keys.find((k) => k === "Death" || k.toLowerCase().includes("death")) || "Idle";
      } else if (desiredState === "attack") {
        clipName = keys.find((k) => k.toLowerCase().includes("attack") || k.toLowerCase().includes("slash") || k.toLowerCase().includes("bash")) || "Idle";
      } else if (desiredState === "run") {
        clipName = keys.find((k) => k === "Run" || k.toLowerCase() === "run") || "Idle";
      } else if (desiredState === "walk") {
        clipName = keys.find((k) => k === "Walk" || k.toLowerCase().includes("walk") || k === "Run" || k.toLowerCase() === "run") || "Idle";
      } else {
        clipName = keys.find((k) => k === "Idle" || k.toLowerCase() === "idle") || "Idle";
      }

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

    if (activeAction.current) {
      const visualSpeed = visualDistance / delta;
      if (desiredState === "walk") {
        activeAction.current.timeScale = Math.max(0.4, Math.min(1.8, visualSpeed / 1.5));
      } else if (desiredState === "run") {
        activeAction.current.timeScale = Math.max(0.4, Math.min(2.0, visualSpeed / 4.0));
      } else {
        activeAction.current.timeScale = 1.0;
      }
    }
  });

  // REMOVED: groupRef.current.updateMatrixWorld(true) — this is extremely expensive
  // and is called automatically by the R3F render loop. Calling it manually per-monster
  // causes redundant matrix recalculations every frame.

  const scale = isBoss ? 2.3 : 0.9;
  
  return (
    <group ref={groupRef} visible={false}>
      <Billboard position={[0, hpBarY, 0]} follow={true}>
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

  // Pre-built Map<id, monster> so each RemoteMonsterInstance does O(1) lookup per frame
  const monsterMapRef = useRef<Map<string, MonsterNetworkState>>(new Map());

  useFrame(() => {
    const list = worldMonstersRef.current || [];
    const map = monsterMapRef.current;
    
    // Always keep monsterMap fresh every frame (very cheap Map rebuild)
    map.clear();
    for (let i = 0; i < list.length; i++) {
      map.set(list[i].id, list[i]);
    }

    // Only update React state when a BRAND NEW monster ID is discovered.
    // We never remove IDs, ensuring components stay mounted and just toggle visibility!
    let hasNewId = false;
    for (let i = 0; i < list.length; i++) {
      const id = list[i].id;
      if (!seenIdsSet.current.has(id)) {
        seenIdsSet.current.add(id);
        hasNewId = true;
      }
    }

    if (hasNewId) {
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
            localPlayerId={localPlayerId}
            gameConfig={gameConfig}
          />
        </Suspense>
      ))}
    </group>
  );
};
