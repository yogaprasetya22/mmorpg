'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, Text, Billboard } from "@react-three/drei";
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { MonsterNetworkState, PlayerNetworkState } from "@/src/hooks/useWebSocketGame";
import { useStore } from "@/src/state/useStore";

export interface RemoteMonsterInstanceProps {
  monsterId: string;
  worldMonstersRef: React.RefObject<MonsterNetworkState[]>;
  onAttack: (id: string) => void;
  camera: THREE.Camera;
  connectedPlayersRef?: React.RefObject<PlayerNetworkState[]>;
  localPlayerId?: string;
  gameConfig?: any;
}

export const RemoteMonsterInstance = ({ 
  monsterId, 
  worldMonstersRef, 
  onAttack, 
  camera,
  connectedPlayersRef,
  localPlayerId,
  gameConfig
}: RemoteMonsterInstanceProps) => {
  void camera;
  
  const isBoss = useMemo(() => {
    const monsters = worldMonstersRef.current || [];
    const data = monsters.find(m => m.id === monsterId);
    return data ? (data.type === "boss" || data.name.toLowerCase().includes("boss")) : false;
  }, [monsterId, worldMonstersRef]);
  
  const modelPath = useMemo(() => {
    const monsters = worldMonstersRef.current || [];
    const data = monsters.find(m => m.id === monsterId);
    
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
    
    if (isBoss) return '/assets-model/Zombie_Female.glb'; // Giant Boss
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
    const idx = Math.abs(hash);
    return MONSTER_MODELS[idx % MONSTER_MODELS.length];
  }, [monsterId, isBoss, worldMonstersRef, gameConfig]);

  const { scene, animations } = useGLTF(modelPath) as any;
  const clone = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }, [scene]);

  const groupRef = useRef<THREE.Group>(null!);
  const hpFillRef = useRef<THREE.Mesh>(null!);
  const textRef = useRef<any>(null);
  const { actions } = useAnimations(animations, groupRef);
  const activeAction = useRef<THREE.AnimationAction | null>(null);

  // Track visual position history to calculate visual movement velocity/speed (no network jitter!)
  const prevVisualPos = useRef({ x: 0, z: 0 });
  const hasInitializedPrevVisual = useRef(false);
  const isMoving = useRef(false);
  const currentAnimState = useRef("Idle");
  
  // Save ID for click interaction
  const monsterIdRef = useRef<string | null>(null);

  // Cleanup monster visual position mapping on unmount or when ID changes
  useEffect(() => {
    return () => {
      if ((window as any).monsterVisualPositions) {
        (window as any).monsterVisualPositions.delete(monsterId);
      }
    };
  }, [monsterId]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const monsters = worldMonstersRef.current || [];
    const data = monsters.find(m => m.id === monsterId);
    
    if (!data || data.is_dead) {
      if (data && (window as any).monsterVisualPositions) {
        (window as any).monsterVisualPositions.delete(data.id);
      }
      groupRef.current.visible = false;
      hasInitializedPrevVisual.current = false; // Reset on death to instantly snap on respawn!
      return;
    }
    
    groupRef.current.visible = true;
    monsterIdRef.current = data.id;

    const x = data.position.x;
    const z = data.position.z;
    // authoritatively snap to the client-side 3D terrain ground height to eliminate clipping or floating!
    const groundY = (window as any).getGroundHeight ? (window as any).getGroundHeight(x, z, data.position.y) : data.position.y;
    const y = groundY;

    // Smooth position lerping (Increased snappiness for instant feedback)
    const meshX = groupRef.current.position.x;
    const meshY = groupRef.current.position.y;
    const meshZ = groupRef.current.position.z;
    const distToTarget = Math.hypot(x - meshX, z - meshZ);

    if (!hasInitializedPrevVisual.current || distToTarget > 3.0) {
      groupRef.current.position.set(x, y, z);
      prevVisualPos.current = { x, z };
      hasInitializedPrevVisual.current = true;
    } else {
      groupRef.current.position.x += (x - meshX) * Math.min(1, 8.5 * delta);
      groupRef.current.position.y += (y - meshY) * Math.min(1, 8.5 * delta);
      groupRef.current.position.z += (z - meshZ) * Math.min(1, 8.5 * delta);
    }

    // Calculate rotation to face visual movement direction (no network quantization stuttering!)
    const currentMeshX = groupRef.current.position.x;
    const currentMeshZ = groupRef.current.position.z;
    const visualDx = currentMeshX - prevVisualPos.current.x;
    const visualDz = currentMeshZ - prevVisualPos.current.z;
    const visualDistance = Math.sqrt(visualDx * visualDx + visualDz * visualDz);
    
    // Store frame-accurate coordinates globally so auto-aim spatial grid is 100% accurate
    if (typeof (window as any).monsterVisualPositions === "undefined") {
      (window as any).monsterVisualPositions = new Map();
    }
    (window as any).monsterVisualPositions.set(data.id, { x: currentMeshX, z: currentMeshZ });

    isMoving.current = visualDistance > 0.002;
    
    prevVisualPos.current = { x: currentMeshX, z: currentMeshZ };

    // Scale HP bar based on ratio
    if (hpFillRef.current) {
      const ratio = Math.max(0, Math.min(1, data.hp / data.max_hp));
      hpFillRef.current.scale.x = ratio;
      hpFillRef.current.position.x = -0.6 * (1 - ratio);
    }

    // Update nameplate text
    if (textRef.current) {
      const lvl = isBoss ? 50 : 15;
      textRef.current.text = `[Lv.${lvl}] ${data.name}\n[ HP: ${Math.round(data.hp)} ]`;
    }

    // Track precise distance to targeted player to locks attack animations logically
    let targetPos = null;
    if (data.target_player_id && data.target_player_id !== "") {
      if (data.target_player_id === localPlayerId) {
        const localPos = useStore.getState().playerPosition;
        targetPos = { x: localPos[0], z: localPos[2] };
      } else {
        const remotePlayers = connectedPlayersRef?.current || [];
        const rp = remotePlayers.find(p => p.id === data.target_player_id);
        if (rp) {
          targetPos = { x: rp.x, z: rp.z };
        }
      }
    }

    let isWithinAttackRange = false;
    if (targetPos) {
      const tDx = targetPos.x - groupRef.current.position.x;
      const tDz = targetPos.z - groupRef.current.position.z;
      const dist = Math.sqrt(tDx * tDx + tDz * tDz);
      const reach = isBoss ? 4.5 : 3.5; // Adaptive hit reach based on backend ranges
      isWithinAttackRange = dist <= reach;
    }

    // Face the target player when attacking, or face visual movement direction when moving
    let targetAngle = null;
    const serverAnim = (data.animation || "").toLowerCase();

    if (serverAnim === "attack" || (isWithinAttackRange && data.target_player_id)) {
      if (targetPos) {
        const tDx = targetPos.x - groupRef.current.position.x;
        const tDz = targetPos.z - groupRef.current.position.z;
        targetAngle = Math.atan2(tDx, tDz);
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

    // Handle animations using server-authoritative state with client fallbacks
    if (actions) {
      const keys = Object.keys(actions);
      let clipName = "Idle";

      if (data.is_dead || serverAnim === "death") {
        clipName = keys.find((k) => k === "Death" || k.toLowerCase().includes("death")) || "Idle";
      } else if (serverAnim === "attack") {
        clipName = keys.find((k) => k.toLowerCase().includes("attack") || k.toLowerCase().includes("slash") || k.toLowerCase().includes("bash")) || "Idle";
      } else if (serverAnim === "run") {
        clipName = keys.find((k) => k === "Run" || k.toLowerCase() === "run") || "Idle";
      } else if (serverAnim === "walk") {
        clipName = keys.find((k) => k === "Walk" || k.toLowerCase().includes("walk") || k === "Run" || k.toLowerCase() === "run") || "Idle";
      } else {
        // Client-side fallback mapping
        if (data.target_player_id && data.target_player_id !== "") {
          if (isMoving.current) {
            clipName = keys.find((k) => k === "Run" || k.toLowerCase() === "run") || "Idle";
          } else if (isWithinAttackRange) {
            clipName = keys.find((k) => k.toLowerCase().includes("attack") || k.toLowerCase().includes("slash") || k.toLowerCase().includes("bash")) || "Idle";
          } else {
            clipName = keys.find((k) => k === "Idle" || k.toLowerCase() === "idle") || "Idle";
          }
        } else if (isMoving.current) {
          clipName = keys.find((k) => k === "Walk" || k.toLowerCase().includes("walk") || k === "Run" || k.toLowerCase() === "run") || "Idle";
        } else {
          clipName = keys.find((k) => k === "Idle" || k.toLowerCase() === "idle") || "Idle";
        }
      }

      if (currentAnimState.current !== clipName) {
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
        currentAnimState.current = clipName;
      }

      // Visual speed-adaptive time-scale (eliminates character sliding on terrain)
      if (activeAction.current) {
        const visualSpeed = visualDistance / delta;
        if (clipName === "Walk" || clipName.toLowerCase().includes("walk")) {
          activeAction.current.timeScale = Math.max(0.4, Math.min(1.8, visualSpeed / 1.5));
        } else if (clipName === "Run" || clipName.toLowerCase().includes("run")) {
          activeAction.current.timeScale = Math.max(0.4, Math.min(2.0, visualSpeed / 4.0));
        } else {
          activeAction.current.timeScale = 1.0;
        }
      }
    }

    // Force recursively updated world matrices down the skeleton to ensure flawless Raycasting from behind/any angle
    groupRef.current.updateMatrixWorld(true);
  });

  const scale = isBoss ? 2.3 : 0.9;
  
  // Dynamically calculate the actual top of the head for any GLB scale/pivot offset
  const hpBarY = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clone);
    const maxY = box.max.y > 0 ? box.max.y : 1.8;
    return (maxY * scale) + 0.35;
  }, [clone, scale]);

  return (
    <group ref={groupRef} visible={false}>
      {/* Billboard HP & Name Bar (Always facing the local player camera perfectly!) */}
      <Billboard position={[0, hpBarY, 0]} follow={true}>
        {/* Monster Name */}
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
        
        {/* HP Background border backing */}
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[1.24, 0.16]} />
          <meshBasicMaterial color="#09090b" toneMapped={false} />
        </mesh>
        
        {/* HP Background fill backing */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.2, 0.12]} />
          <meshBasicMaterial color="#27272a" toneMapped={false} />
        </mesh>
        
        {/* HP Fill progress bar */}
        <mesh ref={hpFillRef} position={[0, 0, 0.002]}>
          <planeGeometry args={[1.2, 0.12]} />
          <meshBasicMaterial color={isBoss ? "#ef4444" : "#f43f5e"} toneMapped={false} />
        </mesh>
      </Billboard>

      {/* 3D Monster Mesh */}
      <group 
        scale={scale}
        onClick={(e) => {
          e.stopPropagation();
          if (monsterIdRef.current) {
            onAttack(monsterIdRef.current);
          }
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
  const lastUpdate = useRef(0);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastUpdate.current < 0.2) return; // Update active IDs list 5 times per second
    lastUpdate.current = now;

    const list = worldMonstersRef.current || [];
    const aliveIds = list.filter(m => !m.is_dead).map(m => m.id);
    
    // Simple array equality check
    let changed = aliveIds.length !== activeMonsterIds.length;
    if (!changed) {
      for (let i = 0; i < aliveIds.length; i++) {
        if (aliveIds[i] !== activeMonsterIds[i]) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      setActiveMonsterIds(aliveIds);
    }
  });

  return (
    <group>
      {activeMonsterIds.map((id) => (
        <RemoteMonsterInstance
          key={id}
          monsterId={id}
          worldMonstersRef={worldMonstersRef}
          onAttack={onAttack}
          camera={camera}
          connectedPlayersRef={connectedPlayersRef}
          localPlayerId={localPlayerId}
          gameConfig={gameConfig}
        />
      ))}
    </group>
  );
};
