'use client';

import { useMemo, useRef, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, Text } from "@react-three/drei";
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { MeshoptDecoder } from 'meshoptimizer';
import { PlayerNetworkState } from "@/src/hooks/useWebSocketGame";
import { UnitRuntimeData } from "@/src/core/domain/unit.types";
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import { useStore } from "@/src/state/useStore";
import { useEditorStore } from "@/src/state/useEditorStore";
import { API_BASE_URL } from "@/src/core/config";

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
  gameConfig,
  mmSpellsRef,
  spellsRef,
  fighterSpellsRef,
  tankSpellsRef,
  assassinSpellsRef,
  unitRegistry,
  visiblePlayerIdsRef
}: RemotePlayerInstanceProps) => {
  // Pre-select model based on actual character Class + Gender from backend registry
  const modelPath = useMemo(() => {
    if (gameConfig && gameConfig.character_models) {
      const genderModels = gameConfig.character_models[gender || "Male"] || gameConfig.character_models["Male"];
      const path = genderModels[cls || "Beginner"];
      if (path) return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    }
    
    return `${API_BASE_URL}/assets-model/Knight_Golden_Male.glb`;
  }, [cls, gender, gameConfig]);

  const { scene, animations } = useGLTF(modelPath, true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const clone = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        // Enable highly optimized shadows for remote players
        child.castShadow = true;
        child.receiveShadow = true;
        child.geometry?.computeBoundingSphere?.();
      }
    });
    return cloned;
  }, [scene]);

  const groupRef = useRef<THREE.Group>(null!);
  const nameRef = useRef<THREE.Group>(null!);
  const textRef = useRef<any>(null);
  const { actions } = useAnimations(animations, groupRef);
  const activeAction = useRef<THREE.AnimationAction | null>(null);

  const currentAnimState = useRef("Idle");
  const stateBufferRef = useRef<{ x: number, y: number, z: number, rotation: number, timestamp: number }[]>([]);
  const prevVisualPos = useRef<{ x: number, z: number } | null>(null);
  const smoothedSpeed = useRef(0);

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

    const FAR_SQ = 60 * 60;     // > 60 units: cull completely
    const MED_FAR_SQ = 40 * 40; // > 40 units: hide name tag

    const isCurrentlyVisible = !isDensityCulled && camDistSq <= FAR_SQ;

    // Get client terrain elevation to map desynced or flat server coordinates cleanly onto 3D sculpted landscape
    const activeEnv = useStore.getState().environment;
    const terrainConfig = useEditorStore.getState().terrainConfig;
    const terrainY = getTerrainElevation(data.x, data.z, activeEnv, 24, terrainConfig);

    // Snapping position and rotation if culled to keep state synchronized
    if (!isCurrentlyVisible) {
      const snapY = (Math.abs(data.y) < 0.001 || data.y < terrainY - 5.0) ? terrainY : data.y;
      groupRef.current.position.set(data.x, snapY, data.z);
      groupRef.current.rotation.y = data.rotation;
      groupRef.current.visible = false;
      if (activeAction.current) activeAction.current.paused = true;
      return;
    }

    groupRef.current.visible = true;
    if (activeAction.current) activeAction.current.paused = false;

    if (prevVisualPos.current === null) {
      prevVisualPos.current = { x: groupRef.current.position.x, z: groupRef.current.position.z };
    }
    const currentMeshX = groupRef.current.position.x;
    const currentMeshZ = groupRef.current.position.z;
    const visualDx = currentMeshX - prevVisualPos.current.x;
    const visualDz = currentMeshZ - prevVisualPos.current.z;
    const visualDistance = Math.sqrt(visualDx * visualDx + visualDz * visualDz);
    prevVisualPos.current = { x: currentMeshX, z: currentMeshZ };

    const currentSpeed = visualDistance / Math.max(0.0001, delta);
    smoothedSpeed.current += (currentSpeed - smoothedSpeed.current) * Math.min(1, 10.0 * delta);

    // Push new network state to buffer if it differs from the last pushed state
    const buf = stateBufferRef.current;
    if (buf.length === 0 || 
        buf[buf.length - 1].x !== data.x || 
        buf[buf.length - 1].y !== data.y || 
        buf[buf.length - 1].z !== data.z || 
        buf[buf.length - 1].rotation !== data.rotation) {
      buf.push({
        x: data.x,
        y: data.y,
        z: data.z,
        rotation: data.rotation,
        timestamp: (data as any).receivedAt || performance.now()
      });
      if (buf.length > 30) buf.shift(); // Limit queue length to 30 frames
    }

    // Perform Entity Interpolation with a 160ms visual buffer delay to absorb 20Hz network jitter
    const renderTime = performance.now() - 160;
    let targetX = data.x;
    let targetY = data.y;
    let targetZ = data.z;
    let targetRot = data.rotation;

    if (buf.length >= 2) {
      let i = 0;
      for (; i < buf.length - 1; i++) {
        if (buf[i].timestamp <= renderTime && buf[i+1].timestamp > renderTime) {
          break;
        }
      }

      if (i < buf.length - 1) {
        const start = buf[i];
        const end = buf[i+1];
        const elapsed = renderTime - start.timestamp;
        const duration = end.timestamp - start.timestamp;
        const alpha = Math.min(1, Math.max(0, elapsed / (duration || 1)));

        targetX = start.x + (end.x - start.x) * alpha;
        targetY = start.y + (end.y - start.y) * alpha;
        targetZ = start.z + (end.z - start.z) * alpha;

        // Correctly handle angle wrapping (Slerp)
        let diffRot = end.rotation - start.rotation;
        while (diffRot < -Math.PI) diffRot += Math.PI * 2;
        while (diffRot > Math.PI) diffRot -= Math.PI * 2;
        targetRot = start.rotation + diffRot * alpha;
      } else {
        // Fallback: If network lag causes buffer starvation, fallback to the latest known state
        targetX = buf[buf.length - 1].x;
        targetY = buf[buf.length - 1].y;
        targetZ = buf[buf.length - 1].z;
        targetRot = buf[buf.length - 1].rotation;
      }
    }

    // Adjust targetY using the terrain height fallback if desynced/flat, but do NOT cap players standing on high elevated obstacles
    if (Math.abs(targetY) < 0.001 || targetY < terrainY - 5.0) {
      targetY = terrainY;
    }
    
    // Set position and rotation directly from the mathematically smooth entity interpolation to achieve 120fps+ fluidity
    groupRef.current.position.set(targetX, targetY, targetZ);
    groupRef.current.rotation.y = targetRot;

    // Billboard name label or hide if too far
    if (nameRef.current) {
      if (camDistSq > MED_FAR_SQ) {
        nameRef.current.visible = false;
      } else {
        nameRef.current.visible = true;
      }
    }

    // Update text only if changed to avoid expensive Troika dirty checking/re-layouts
    if (textRef.current && nameRef.current.visible) {
      const expectedText = username || id.substring(0, 8);
      if (textRef.current.text !== expectedText) {
        textRef.current.text = expectedText;
      }
    }
    
    // Billboard name label: quaternion copy removed — nameRef is a group, not Billboard.
    // Skip camera.quaternion.copy per player — use drei <Billboard> in JSX instead if needed.

    // Handle animations inside useFrame dynamically without React state re-render!
    const animation = data.animation || "Idle";
    const desired = animation.toLowerCase();
    const isAttacking = desired.includes("shoot") || desired.includes("attack") || desired.includes("slash");
    const isUsingSkill = desired.includes("skill");

    const startedNewAttack = isAttacking && (currentAnimState.current !== animation);
    const startedNewSkill  = isUsingSkill && (currentAnimState.current !== animation);

    if (actions && currentAnimState.current !== animation) {
      const keys = Object.keys(actions);
      let clipName = "Idle";

      if (desired.includes("run")) {
        clipName = keys.find((k) => k === "Run" || k.toLowerCase() === "run") || "Idle";
      } else if (desired.includes("walk")) {
        clipName = keys.find((k) => k === "Walk" || k.toLowerCase().includes("walk")) || "Idle";
      } else if (desired.includes("jump")) {
        clipName = keys.find((k) => k === "Jump" || k.toLowerCase() === "jump" || k.toLowerCase().includes("jump")) || "Idle";
      } else if (isAttacking || isUsingSkill) {
        clipName = keys.find((k) => k.toLowerCase().includes("attack") || k.toLowerCase().includes("slash") || k.toLowerCase().includes("shoot")) || "Idle";
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
        activeAction.current = nextAction;
      }
      currentAnimState.current = animation;
    }

    if (activeAction.current) {
      if (desired.includes("walk")) {
        activeAction.current.timeScale = Math.max(0.4, Math.min(1.2, smoothedSpeed.current / 3.0));
      } else if (desired.includes("run")) {
        activeAction.current.timeScale = Math.max(0.4, Math.min(1.4, smoothedSpeed.current / 5.5));
      } else if (desired.includes("jump")) {
        activeAction.current.timeScale = 0.8;
      } else {
        activeAction.current.timeScale = 1.0;
      }
    }



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
          let maxRangeSq = 15.0 * 15.0;
          const uPos = groupRef.current.position;
          let minDistSq = maxRangeSq;

          for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (u.isActive && !u.isDying && u.type === 'enemy') {
              const dx = u.position[0] - uPos.x;
              const dy = u.position[1] - uPos.y;
              const dz = u.position[2] - uPos.z;
              const distSq = dx*dx + dy*dy + dz*dz;
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
        let fPtr = (window as any).globalRemoteFighterPtr;
        
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
        let aPtr = (window as any).globalRemoteAssassinPtr;
        
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
        let tPtr = (window as any).globalRemoteTankPtr;
        
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
          let mPtr = (window as any).globalRemoteMagePtr;
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
          let ptr = (window as any).globalRemoteSpellPtr;
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
              const distSq = dx*dx + dy*dy + dz*dz;
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
      let isFinisher = Math.random() > 0.6;
      
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
        const pool = mmSpellsRef.current;
        if (typeof (window as any).globalRemoteSpellPtr === 'undefined') {
          (window as any).globalRemoteSpellPtr = 0;
        }
        let ptr = (window as any).globalRemoteSpellPtr;
        
        const s = pool[ptr];
        if (s) {
          s.active = true;
          s.isBullet = true;
          s.fromX = fromX;
          s.fromY = fromY;
          s.fromZ = fromZ;
          s.toX = toX;
          s.toY = toY;
          s.toZ = toZ;
          s.startTime = performance.now();
          s.color = color;
          s.targetId = targetId;
          (s as any).targetPoolIdx = targetPoolIdx;
          (s as any).isSniper = false;
          (s as any).isFinisher = isFinisher;
          (s as any).bulletSpeed = bulletSpeed;
          (s as any).playerClass = pClass;
          
          (window as any).globalRemoteSpellPtr = (ptr + 1) % pool.length;
        }
      }

      // Trigger premium class-specific visual layers
      if (pClass === "Warrior" && fighterSpellsRef?.current) {
        const fPool = fighterSpellsRef.current;
        if (typeof (window as any).globalRemoteFighterPtr === 'undefined') (window as any).globalRemoteFighterPtr = 0;
        let fPtr = (window as any).globalRemoteFighterPtr;
        
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
        let aPtr = (window as any).globalRemoteAssassinPtr;
        
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
        let tPtr = (window as any).globalRemoteTankPtr;
        
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
        let mPtr = (window as any).globalRemoteMagePtr;
        
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
  });

  return (
    <group ref={groupRef}>
      <group scale={1.0} position={[0, -1.3, 0]}>
        <primitive object={clone} />
      </group>
      <group ref={nameRef} position={[0, 1.75, 0]}>
        <Text
          ref={textRef}
          font="/Press_Start_2P/PressStart2P-Regular.ttf"
          fontSize={0.22}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.03}
          outlineColor="#000000"
          color="#06b6d4"
          depthOffset={-5}
        >
          {""}
        </Text>
      </group>
    </group>
  );
};

export interface RemotePlayersRendererProps {
  activeRemotePlayers: { id: string; username: string; class: string; gender: string }[];
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
  activeRemotePlayers, 
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
  if (localPlayerId) { /* bypass */ }
  const { camera } = useThree();
  const playerMapRef = useRef<Map<string, PlayerNetworkState>>(new Map());
  const visiblePlayerIdsRef = useRef<Set<string>>(new Set());

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

    // ─── Throttled distance sort (10Hz max) ──────────────────────────────────
    const now = state.clock.elapsedTime;
    if (now - lastSortTime.current >= 0.10) {
      lastSortTime.current = now;

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

      // Adaptive cap: when loadtest saturates server with 40 bots, limit to 8 closest player skeletons
      const playerCap = players.length > 20 ? 8 : 12;
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
      {activeRemotePlayers.map((player) => (
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
