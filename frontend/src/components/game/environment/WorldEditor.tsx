'use client';

import { useState, useEffect, useMemo, useCallback, useRef, memo, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore, MapItem } from '@/src/state/useEditorStore';
import { getTerrainElevation } from '@/src/core/utils/terrainHeight';

// ─── TERRAIN PROJECTION HELPER ───
// Returns an array of 3D world points that form a closed loop
// conforming to the terrain surface — like Unity's Terrain Brush Projector.
// It samples world-space terrain height at each angle step.
const buildProjectedCirclePoints = (
  cx: number,
  _cy: number,
  cz: number,
  radius: number,
  segments: number,
  environment: string,
  terrainConfig: any
): Float32Array => {
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const wx = cx + Math.cos(angle) * radius;
    const wz = cz + Math.sin(angle) * radius;
    let wy = getTerrainElevation(wx, wz, environment as any, 24, terrainConfig);
    // Use BVH raycast result if available (sculpted terrain)
    if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
      const h = (window as any).getGroundHeight(wx, wz, -9999);
      if (h !== -9999) wy = h;
    }
    pts[i * 3 + 0] = wx;
    pts[i * 3 + 1] = wy + 0.35; // small float offset to prevent z-fighting
    pts[i * 3 + 2] = wz;
  }
  return pts;
};

// Builds an N-sided polygon outline projected onto terrain (hexagon, square, etc.)
const buildProjectedPolygonPoints = (
  cx: number,
  _cy: number,
  cz: number,
  radius: number,
  sides: number,
  rotOffset: number,
  environment: string,
  terrainConfig: any
): Float32Array => {
  const pts = new Float32Array((sides + 1) * 3);
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + rotOffset;
    const wx = cx + Math.cos(angle) * radius;
    const wz = cz + Math.sin(angle) * radius;
    let wy = getTerrainElevation(wx, wz, environment as any, 24, terrainConfig);
    if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
      const h = (window as any).getGroundHeight(wx, wz, -9999);
      if (h !== -9999) wy = h;
    }
    pts[i * 3 + 0] = wx;
    pts[i * 3 + 1] = wy + 0.35;
    pts[i * 3 + 2] = wz;
  }
  return pts;
};

// Builds a star-shape outline projected onto terrain
const buildProjectedStarPoints = (
  cx: number,
  _cy: number,
  cz: number,
  outerR: number,
  innerR: number,
  spikes: number,
  environment: string,
  terrainConfig: any
): Float32Array => {
  const total = spikes * 2;
  const pts = new Float32Array((total + 1) * 3);
  const step = Math.PI / spikes;
  let rot = (Math.PI / 2) * 3;
  for (let i = 0; i <= total; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const wx = cx + Math.cos(rot) * r;
    const wz = cz + Math.sin(rot) * r;
    let wy = getTerrainElevation(wx, wz, environment as any, 24, terrainConfig);
    if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
      const h = (window as any).getGroundHeight(wx, wz, -9999);
      if (h !== -9999) wy = h;
    }
    pts[i * 3 + 0] = wx;
    pts[i * 3 + 1] = wy + 0.35;
    pts[i * 3 + 2] = wz;
    rot += step;
  }
  return pts;
};

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class SafeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("R3F Asset Load Error caught:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Foliage Theme assets matching useEditorStore procedural forest generator
const themeAssets: Record<string, { paths: string[], colors?: string[] }> = {
  pine: {
    paths: [
      "/assets/environment/trees/Pine_1.glb",
      "/assets/environment/trees/Pine_2.glb",
      "/assets/environment/trees/Pine_3.glb",
      "/assets/environment/trees/Pine_4.glb",
      "/assets/environment/trees/Pine_5.glb",
      "/assets/environment/rocks/Rock_Medium_1.glb",
      "/assets/environment/rocks/Rock_Medium_2.glb"
    ]
  },
  cherry: {
    paths: [
      "/assets/environment/trees/BirchTree_1.glb",
      "/assets/environment/trees/BirchTree_2.glb",
      "/assets/environment/trees/BirchTree_3.glb",
      "/assets/environment/trees/BirchTree_4.glb",
      "/assets/environment/trees/BirchTree_5.glb"
    ],
    colors: ["#fda4af", "#f472b6", "#ec4899", "#db2777"]
  },
  autumn: {
    paths: [
      "/assets/environment/trees/MapleTree_1.glb",
      "/assets/environment/trees/MapleTree_2.glb",
      "/assets/environment/trees/MapleTree_3.glb",
      "/assets/environment/trees/MapleTree_4.glb",
      "/assets/environment/trees/MapleTree_5.glb"
    ],
    colors: ["#f59e0b", "#d97706", "#b45309", "#ea580c", "#ca8a04"]
  },
  desert: {
    paths: [
      "/assets/environment/trees/DeadTree_1.glb",
      "/assets/environment/trees/DeadTree_2.glb",
      "/assets/environment/rocks/Rock_Medium_3.glb",
      "/assets/environment/rocks/RockPath_Round_Wide.glb"
    ],
    colors: ["#a1a1aa", "#71717a", "#b45309", "#78350f"]
  },
  clover: {
    paths: [
      "/assets/environment/trees/CommonTree_1.glb",
      "/assets/environment/trees/CommonTree_2.glb",
      "/assets/environment/vegetation/Clover_1.glb",
      "/assets/environment/vegetation/Clover_2.glb"
    ],
    colors: ["#4ade80", "#22c55e", "#16a34a", "#86efac"]
  }
};

// A highly aesthetic semi-transparent 3D preview of the model being placed
const GhostPreview = ({ path, position, scale, rotation }: { path: string, position: THREE.Vector3, scale: number | [number, number, number], rotation: [number, number, number] }) => {
  const { scene } = useGLTF(path);
  const ghost = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((node: any) => {
      if (node.isMesh) {
        node.material = node.material.clone();
        node.material.transparent = true;
        node.material.opacity = 0.45;
        node.material.depthWrite = false;
        node.material.color.set('#818cf8'); // High-tech neon indigo glow!
        if ('emissive' in node.material) {
          node.material.emissive = new THREE.Color('#4f46e5');
        }
        if ('emissiveIntensity' in node.material) {
          (node.material as any).emissiveIntensity = 0.6;
        }
      }
    });
    return clone;
  }, [scene]);

  const sca: [number, number, number] = Array.isArray(scale) ? scale : [scale, scale, scale];

  // Poin 3: Hitung offset Y agar bagian bawah model/alas selalu menempel di atas tanah
  const pivotToBottomY = useMemo(() => {
    const tempGroup = new THREE.Group();
    const clonedGhost = ghost.clone();
    tempGroup.add(clonedGhost);
    tempGroup.scale.set(...sca);
    tempGroup.rotation.set(...rotation);
    tempGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(tempGroup);
    return -box.min.y;
  }, [ghost, sca, rotation]);

  const adjustedPosition = useMemo(() => {
    return new THREE.Vector3(position.x, position.y + pivotToBottomY, position.z);
  }, [position, pivotToBottomY]);

  return <primitive object={ghost} position={adjustedPosition} rotation={rotation} scale={sca} />;
};

// Sleek minimal selection ring replacing the old RGB coordinate arrows
const SleekSelectionRing = memo(({ radius, isDragging }: { radius: number, isDragging: boolean }) => {
  return (
    <group position-y={0.02}>
      {/* Pulsing neon indigo ring */}
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[radius - 0.04, radius, 64]} />
        <meshBasicMaterial 
          color={isDragging ? "#6366f1" : "#818cf8"} 
          transparent 
          opacity={0.85} 
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Ground soft aura glow */}
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0, radius]} />
        <meshBasicMaterial 
          color={isDragging ? "#4f46e5" : "#6366f1"} 
          transparent 
          opacity={isDragging ? 0.22 : 0.12} 
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
});

// Sleek minimal hover ring
const SleekHoverRing = memo(({ radius }: { radius: number }) => {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
      <ringGeometry args={[radius - 0.03, radius, 64]} />
      <meshBasicMaterial 
        color="#fbbf24" // Beautiful warm amber hover glow!
        transparent 
        opacity={0.65} 
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
});

// ─── HOLOGRAPHIC BRUSH MASK PROJECTION COMPONENT ───
// Projects the brush cursor directly onto the terrain surface (like Unity's Terrain Brush Projector).
// Uses a dynamic set of 3D vertices that follow terrain elevation.
const HolographicBrushProjection = memo(({ maskId, size, strength, position, environment, terrainConfig }: {
  maskId: 'softCircle' | 'hardCircle' | 'star' | 'hexagon' | 'starOutline' | 'square';
  size: number;
  strength: number;
  position: [number, number, number];
  environment: string;
  terrainConfig: any;
}) => {
  const [cx, cy, cz] = position;
  const SEGS = 64;

  // Outer projected circle — always shown for circles and stars
  const outerPts = useMemo(
    () => (['softCircle', 'hardCircle', 'star', 'starOutline'].includes(maskId)) 
      ? buildProjectedCirclePoints(cx, cy, cz, size, SEGS, environment, terrainConfig)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cx, cy, cz, size, environment, terrainConfig, maskId]
  );

  // Inner projected circle — for softCircle strength indicator
  const innerPts = useMemo(
    () => (maskId === 'softCircle')
      ? buildProjectedCirclePoints(cx, cy, cz, size * strength, SEGS, environment, terrainConfig)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cx, cy, cz, size, strength, environment, terrainConfig, maskId]
  );

  // Second ring at 0.7× for starOutline
  const outerPts70 = useMemo(
    () => (maskId === 'starOutline')
      ? buildProjectedCirclePoints(cx, cy, cz, size * 0.7, SEGS, environment, terrainConfig)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cx, cy, cz, size, environment, terrainConfig, maskId]
  );

  // Hexagon outline (6 sides)
  const hexPts = useMemo(
    () => (maskId === 'hexagon')
      ? buildProjectedPolygonPoints(cx, cy, cz, size, 6, 0, environment, terrainConfig)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cx, cy, cz, size, environment, terrainConfig, maskId]
  );

  // Square outline (4 sides, rotated 45deg)
  const squarePts = useMemo(
    () => (maskId === 'square')
      ? buildProjectedPolygonPoints(cx, cy, cz, size, 4, Math.PI / 4, environment, terrainConfig)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cx, cy, cz, size, environment, terrainConfig, maskId]
  );

  // Star outline (5 spikes)
  const starPts = useMemo(
    () => (maskId === 'star')
      ? buildProjectedStarPoints(cx, cy, cz, size, size * 0.45, 5, environment, terrainConfig)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cx, cy, cz, size, environment, terrainConfig, maskId]
  );

  const lineMat = <lineBasicMaterial color="#3b82f6" linewidth={2} transparent opacity={0.9} depthWrite={false} />;
  const dimLineMat = <lineBasicMaterial color="#3b82f6" linewidth={1.5} transparent opacity={0.55} depthWrite={false} />;

  return (
    <group>
      {/* 1. SOFT CIRCLE — outer boundary + inner strength ring */}
      {maskId === 'softCircle' && outerPts && innerPts && (
        <group>
          <lineLoop>
            <bufferGeometry>
              <float32BufferAttribute attach="attributes-position" args={[outerPts, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#3b82f6" linewidth={2} transparent opacity={0.75} depthWrite={false} />
          </lineLoop>
          <lineLoop>
            <bufferGeometry>
              <float32BufferAttribute attach="attributes-position" args={[innerPts, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#3b82f6" linewidth={1.5} transparent opacity={0.9} depthWrite={false} />
          </lineLoop>
        </group>
      )}

      {/* 2. HARD CIRCLE — single outer ring, crisp */}
      {maskId === 'hardCircle' && outerPts && (
        <lineLoop>
          <bufferGeometry>
            <float32BufferAttribute attach="attributes-position" args={[outerPts, 3]} />
          </bufferGeometry>
          {lineMat}
        </lineLoop>
      )}

      {/* 3. STAR */}
      {maskId === 'star' && starPts && (
        <lineLoop>
          <bufferGeometry>
            <float32BufferAttribute attach="attributes-position" args={[starPts, 3]} />
          </bufferGeometry>
          {lineMat}
        </lineLoop>
      )}

      {/* 4. HEXAGON */}
      {maskId === 'hexagon' && hexPts && (
        <lineLoop>
          <bufferGeometry>
            <float32BufferAttribute attach="attributes-position" args={[hexPts, 3]} />
          </bufferGeometry>
          {lineMat}
        </lineLoop>
      )}

      {/* 5. STAR OUTLINE — two projected concentric circles */}
      {maskId === 'starOutline' && outerPts && outerPts70 && (
        <group>
          <lineLoop>
            <bufferGeometry>
              <float32BufferAttribute attach="attributes-position" args={[outerPts, 3]} />
            </bufferGeometry>
            {lineMat}
          </lineLoop>
          <lineLoop>
            <bufferGeometry>
              <float32BufferAttribute attach="attributes-position" args={[outerPts70, 3]} />
            </bufferGeometry>
            {dimLineMat}
          </lineLoop>
        </group>
      )}

      {/* 6. SQUARE */}
      {maskId === 'square' && squarePts && (
        <lineLoop>
          <bufferGeometry>
            <float32BufferAttribute attach="attributes-position" args={[squarePts, 3]} />
          </bufferGeometry>
          {lineMat}
        </lineLoop>
      )}
    </group>
  );
});

// ─── PLACED MASK PROJECTION COMPONENT ───
const PlacedMaskProjection = memo(({ item, isSelected, isHovered, onPointerOver, onPointerOut }: {
  item: MapItem;
  isSelected: boolean;
  isHovered: boolean;
  onPointerOver: (e: any) => void;
  onPointerOut: (e: any) => void;
}) => {
  const { pos, rot, sca, path: maskId, color } = item;
  const radius = sca[0]; // Scale stores size in absolute meters

  // Star Points calculation
  const starPoints = useMemo(() => {
    const pts = [];
    const spikes = 5;
    const outerRadius = radius;
    const innerRadius = radius * 0.45;
    let rotVal = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      pts.push(new THREE.Vector3(Math.cos(rotVal) * r, Math.sin(rotVal) * r, 0));
      rotVal += step;
    }
    return new Float32Array(pts.flatMap(p => [p.x, p.y, p.z]));
  }, [radius]);

  const outlineColor = isSelected ? '#fbbf24' : isHovered ? '#60a5fa' : color || '#3b82f6';
  const filledColor = color || '#3b82f6';

  return (
    <group 
      name={item.id} 
      position={[pos[0], pos[1] + 0.08, pos[2]]} 
      rotation={[-Math.PI / 2, 0, rot[1]]}
      scale={[1, 1, 1]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* Selection Aura */}
      {isSelected && (
        <mesh>
          <ringGeometry args={[radius, radius + 0.15, 64]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* 1. STAR */}
      {maskId === 'star' && (
        <group>
          <lineLoop>
            <bufferGeometry>
              <float32BufferAttribute attach="attributes-position" args={[starPoints, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={outlineColor} linewidth={2.5} transparent opacity={0.9} depthWrite={false} />
          </lineLoop>
          <mesh>
            <ringGeometry args={[0, radius * 0.4, 32]} />
            <meshBasicMaterial color={filledColor} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* 2. HEXAGON */}
      {maskId === 'hexagon' && (
        <group>
          <mesh>
            <ringGeometry args={[radius - 0.05, radius, 6]} />
            <meshBasicMaterial color={outlineColor} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[0, radius, 6]} />
            <meshBasicMaterial color={filledColor} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* 3. STAR OUTLINE (Double Ring) */}
      {maskId === 'starOutline' && (
        <group>
          <mesh>
            <ringGeometry args={[radius - 0.03, radius, 64]} />
            <meshBasicMaterial color={outlineColor} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[radius * 0.7 - 0.03, radius * 0.7, 64]} />
            <meshBasicMaterial color={outlineColor} transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* 4. SQUARE */}
      {maskId === 'square' && (
        <group rotation-z={Math.PI / 4}>
          <mesh>
            <ringGeometry args={[radius - 0.05, radius, 4]} />
            <meshBasicMaterial color={outlineColor} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[0, radius, 4]} />
            <meshBasicMaterial color={filledColor} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
});

// --- WORLD EDITOR 3D CANVAS INTERACTION COMPONENT ---
export const WorldEditor = () => {
  const { scene, raycaster, mouse, camera, gl } = useThree();
  const {
    items,
    setItems,
    selectedId,
    setSelectedId,
    selectedIds,
    toggleSelectedId,
    activeAsset,
    setActiveAsset,
    isEditorOpen,
    updateItemsWithHistory,
    undo,
    redo,
    loadFromStorage,
    gridSize,
    gridEnabled,
    paintMode,
    brushSize,
    brushHoverPos,
    setBrushHoverPos,
    brushMaskId,
    brushStrength,
    setBrushStrength,
    terrainMode,
    brushRotation,
    brushColor,
    lastUsedScales,
    setLastUsedScale,
    lastUsedRotations,
    setLastUsedRotation,
    environment,
    terrainConfig,

    // Vegetation Spray States
    vegetationBrushActive,
    setVegetationBrushActive,
    vegetationTheme,
    vegetationDensity,

    // Smooth panning states
    cameraFocusTarget,
    setCameraFocusTarget,
    cameraFocusObjectId,
    setCameraFocusObjectId
  } = useEditorStore();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null);
  const [isOverUI, setIsOverUI] = useState(false);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const isDraggingVegetationRef = useRef(false);
  const lastSprayTimeRef = useRef(0);

  // Cache starting coordinates to support cancellation
  const dragStartRef = useRef<{
    pos: [number, number, number];
    rot: [number, number, number];
    sca: [number, number, number];
  } | null>(null);

  // Smooth hover pos and target dragging pos
  const smoothHoverPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const targetDragPosRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // Bug 3 fix: Lock Y elevation offset at drag start so object's Y is preserved
  const dragElevationOffsetRef = useRef<number>(0);

  // Track initial pointer down coordinates and timestamp to distinguish taps from camera drags
  const pointerStartRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastDraggedIdRef = useRef<string | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Pre-load active asset dynamically when selected in the palette to warm up Drei cache
  useEffect(() => {
    if (activeAsset) {
      useGLTF.preload(activeAsset.path);
    }
  }, [activeAsset]);

  const snap = useCallback((val: number) => {
    if (!gridEnabled) return val;
    return Math.round(val / gridSize) * gridSize;
  }, [gridEnabled, gridSize]);

  // Commit placement logic
  const commitPlacement = useCallback((id: string) => {
    const obj = scene.getObjectByName(id);
    if (!obj) return;

    updateItemsWithHistory(prev => prev.map(i => {
      if (i.id === id) {
        return {
          ...i,
          pos: [obj.position.x, obj.position.y, obj.position.z],
          rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          sca: [obj.scale.x, obj.scale.y, obj.scale.z]
        };
      }
      return i;
    }));

    setDraggedId(null);
    dragStartRef.current = null;
    console.log(`[PARALIVES INTERACTION] Item committed at coordinates: X=${obj.position.x.toFixed(2)}, Y=${obj.position.y.toFixed(2)}, Z=${obj.position.z.toFixed(2)}`);
  }, [updateItemsWithHistory, scene]);

  // Cancel dragging or active placement
  const cancelActiveDragOrPlacement = useCallback(() => {
    if (draggedId) {
      const start = dragStartRef.current;
      const activeId = draggedId;
      setDraggedId(null);
      dragStartRef.current = null;

      if (start) {
        // Revert 3D object back to starting coordinates
        const obj = scene.getObjectByName(activeId);
        if (obj) {
          obj.position.set(...start.pos);
          obj.rotation.set(...start.rot);
          obj.scale.set(...start.sca);
        }
        // Revert Zustand store
        setItems(items.map(i => {
          if (i.id === activeId) {
            return {
              ...i,
              pos: start.pos,
              rot: start.rot,
              sca: start.sca
            };
          }
          return i;
        }));
      }
      console.log(`[PARALIVES INTERACTION] Dragging canceled for item ${activeId}. Reverted to starting coordinates.`);
    } else if (activeAsset) {
      setActiveAsset(null);
      console.log(`[PARALIVES INTERACTION] Placement blueprint canceled.`);
    } else if (selectedId) {
      setSelectedId(null);
    }
    if (vegetationBrushActive) {
      setVegetationBrushActive(false);
    }
  }, [draggedId, activeAsset, selectedId, items, setItems, scene, setActiveAsset, setSelectedId, vegetationBrushActive, setVegetationBrushActive]);

  const spawnAtPoint = useCallback((point: THREE.Vector3) => {
    if (!activeAsset || paintMode || vegetationBrushActive) return;

    // Direct Snapping: Auto locks to deforming terrain elevation Y coordinate!
    const snappedX = snap(point.x);
    const snappedZ = snap(point.z);
    let snapY = getTerrainElevation(snappedX, snappedZ, environment, 24, terrainConfig);
    if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
      const raycastH = (window as any).getGroundHeight(snappedX, snappedZ, -999);
      if (raycastH !== -999) {
        snapY = raycastH;
      }
    }

    const snappedPos: [number, number, number] = [
      snappedX,
      snapY,
      snappedZ
    ];

    const cachedScale = lastUsedScales[activeAsset.path] || [1, 1, 1];
    const cachedRotation = lastUsedRotations[activeAsset.path] || [0, 0, 0];

    const newItem: MapItem = {
      id: "item_" + Math.random().toString(36).substr(2, 9),
      type: activeAsset.name,
      path: activeAsset.path,
      pos: snappedPos,
      rot: cachedRotation,
      sca: cachedScale,
    };

    updateItemsWithHistory(prev => [...prev, newItem]);
    
    // Select newly spawned item and immediately pick it up in direct drag mode!
    setSelectedId(newItem.id);
    setDraggedId(newItem.id);
    dragStartRef.current = {
      pos: snappedPos,
      rot: cachedRotation,
      sca: cachedScale
    };

    setActiveAsset(null); // Clear blueprint placement mode
    console.log(`[PARALIVES INTERACTION] Spawned new ${activeAsset.name} and picked up in Drag Mode.`);
  }, [activeAsset, updateItemsWithHistory, setSelectedId, snap, lastUsedScales, lastUsedRotations, paintMode, vegetationBrushActive, environment, terrainConfig]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length > 0) {
      updateItemsWithHistory(prev => prev.filter(i => !selectedIds.includes(i.id)));
      setSelectedId(null);
      setDraggedId(null);
      dragStartRef.current = null;
    }
  }, [selectedIds, updateItemsWithHistory, setSelectedId]);

  // Block context menus inside editing mode
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (isEditorOpen) {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, [isEditorOpen]);

  // keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
      if (!isEditorOpen) return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelActiveDragOrPlacement();
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0 && !document.activeElement?.matches('input, textarea')) {
          deleteSelected();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isEditorOpen, undo, redo, selectedIds, deleteSelected, cancelActiveDragOrPlacement]);

  // Scroll wheel — MODIFIER KEY CONTROLLED transforms.
  // Plain scroll (no modifier) = camera zoom (pass-through).
  // Alt + Scroll           = Rotate Yaw of selected object / ghost asset.
  // Shift + Alt + Scroll   = Scale selected object / ghost asset.
  // Shift + Scroll         = Brush Size (when painting/sculpting/vegetation).
  // Ctrl + Scroll          = Brush Strength / Feathering (when terrain editing active).
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const activeId = draggedId || selectedId;
      const direction = e.deltaY > 0 ? -1 : 1;
      const isShift = e.shiftKey;
      const isCtrl  = e.ctrlKey;
      const isAlt   = e.altKey;

      // ── Ctrl + Scroll: Brush strength (terrain/sculpt active) ──
      if (isCtrl && !isAlt && !isShift && selectedId === 'terrain') {
        e.preventDefault();
        const strengthStep = 0.05 * direction;
        const nextStrength = Math.max(0.01, Math.min(1.0, brushStrength + strengthStep));
        setBrushStrength(nextStrength);
        return;
      }

      // ── Shift + Scroll (no Alt): Brush Size for paint / sculpt / vegetation brush ──
      if (isShift && !isAlt) {
        if (selectedId === 'terrain' || vegetationBrushActive) {
          e.preventDefault();
          const sizeStep = 2 * direction;
          const { brushSize: currentBrushSize, setBrushSize } = useEditorStore.getState();
          const nextSize = Math.max(1, Math.min(150, currentBrushSize + sizeStep));
          setBrushSize(nextSize);
          return;
        }
        // If not in brush mode but an object/asset is active — fall through to scale below with Shift+Alt
        return;
      }

      // ── Below: Only apply if Alt is held. Otherwise pass through for camera zoom ──
      if (!isAlt) return; // Let OrbitControls handle zoom naturally

      if (!activeId && !activeAsset) return;

      e.preventDefault();

      if (isShift && isAlt) {
        // Shift + Alt + Scroll: Scale
        const scaleStep = 0.05 * direction;

        if (activeId) {
          const item = items.find(i => i.id === activeId);
          if (item) {
            updateItemsWithHistory(prev => prev.map(i => {
              if (i.id === activeId) {
                const nextSca = Math.max(0.1, i.sca[0] + scaleStep);
                setLastUsedScale(i.path, [nextSca, nextSca, nextSca]);
                const obj = scene.getObjectByName(activeId);
                if (obj) obj.scale.set(nextSca, nextSca, nextSca);
                return { ...i, sca: [nextSca, nextSca, nextSca] };
              }
              return i;
            }));
          }
        } else if (activeAsset) {
          const current = lastUsedScales[activeAsset.path] || [1, 1, 1];
          const nextVal = Math.max(0.1, current[0] + scaleStep);
          setLastUsedScale(activeAsset.path, [nextVal, nextVal, nextVal]);
        }
      } else {
        // Alt + Scroll (no Shift): Rotate Yaw Y-axis
        const rotStep = (Math.PI / 24) * direction; // ~7.5 degrees step

        if (activeId) {
          const item = items.find(i => i.id === activeId);
          if (item) {
            updateItemsWithHistory(prev => prev.map(i => {
              if (i.id === activeId) {
                const nextYaw = i.rot[1] + rotStep;
                setLastUsedRotation(i.path, [i.rot[0], nextYaw, i.rot[2]]);
                const obj = scene.getObjectByName(activeId);
                if (obj) obj.rotation.y = nextYaw;
                return { ...i, rot: [i.rot[0], nextYaw, i.rot[2]] };
              }
              return i;
            }));
          }
        } else if (activeAsset) {
          const current = lastUsedRotations[activeAsset.path] || [0, 0, 0];
          const nextVal = current[1] + rotStep;
          setLastUsedRotation(activeAsset.path, [current[0], nextVal, current[2]]);
        }
      }
    };

    const el = gl.domElement;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [draggedId, selectedId, selectedIds, activeAsset, items, updateItemsWithHistory, setLastUsedScale, setLastUsedRotation, lastUsedScales, lastUsedRotations, gl, scene, brushStrength, setBrushStrength, vegetationBrushActive]);

  // Handle local vegetation spray brush points adding
  const handleSprayVegetation = useCallback((center: [number, number, number]) => {
    const now = Date.now();
    if (now - lastSprayTimeRef.current < 90) return; // limit frequency to 90ms intervals
    lastSprayTimeRef.current = now;

    const [cx, , cz] = center;
    const radius = brushSize * 0.12; // visual scaling for 3D units

    if (isShiftPressed) {
      // Erase mode: filter out items within radius
      const nextItems = items.filter((item) => {
        if (item.type !== 'procedural-vegetation') return true;
        const [px, , pz] = item.pos;
        const dist = Math.hypot(px - cx, pz - cz);
        return dist > radius;
      });
      if (nextItems.length !== items.length) {
        updateItemsWithHistory(nextItems);
      }
      return;
    }

    const count = Math.max(1, Math.round(vegetationDensity / 12));
    const theme = themeAssets[vegetationTheme] || themeAssets.pine;
    const newTrees: MapItem[] = [];

    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * radius; // uniform distribution
      const theta = Math.random() * Math.PI * 2;
      const px = cx + Math.cos(theta) * r;
      const pz = cz + Math.sin(theta) * r;

      // Perfectly calculates high-low elevation Y coordinate matching mountain slope contours
      let py = getTerrainElevation(px, pz, environment, 24, terrainConfig);
      if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
        const raycastH = (window as any).getGroundHeight(px, pz, -999);
        if (raycastH !== -999) {
          py = raycastH;
        }
      }

      const modelPath = theme.paths[Math.floor(Math.random() * theme.paths.length)];
      const color = theme.colors ? theme.colors[Math.floor(Math.random() * theme.colors.length)] : undefined;
      const scaleRatio = 0.55 + Math.random() * 0.9;
      const rotY = Math.random() * Math.PI * 2;

      newTrees.push({
        id: `procedural-veg-${vegetationTheme}-${now}-${i}-${Math.random()}`,
        type: 'procedural-vegetation',
        path: modelPath,
        pos: [px, py, pz],
        rot: [0, rotY, 0],
        sca: [scaleRatio, scaleRatio, scaleRatio],
        color
      });
    }

    if (newTrees.length > 0) {
      updateItemsWithHistory([...items, ...newTrees]);
    }
  }, [brushSize, vegetationDensity, vegetationTheme, environment, terrainConfig, items, updateItemsWithHistory, isShiftPressed]);

  // Set up pointer event handlers
  useEffect(() => {
    if (!isEditorOpen) return;

    const onMove = (e: PointerEvent) => {
      setIsShiftPressed(e.shiftKey);
      const target = e.target as HTMLElement;
      const over = !!(
        target.closest('.world-editor-ui') || 
        target.closest('[data-leva]') || 
        target.closest('#leva__root') ||
        ['BUTTON', 'INPUT', 'SELECT', 'LABEL'].includes(target.tagName)
      );
      setIsOverUI(over);
    };

    const onDown = (e: PointerEvent) => {
      setIsShiftPressed(e.shiftKey);
      if (isOverUI) return;
      
      const target = e.target as HTMLElement;
      if (
        target.closest('.world-editor-ui') || 
        target.closest('[data-leva]') || 
        target.closest('#leva__root') ||
        ['BUTTON', 'INPUT', 'SELECT', 'LABEL'].includes(target.tagName)
      ) return;

      if (vegetationBrushActive) {
        if (e.button === 0) {
          isDraggingVegetationRef.current = true;
        }
        return;
      }

      pointerStartRef.current = {
        time: Date.now(),
        x: e.clientX,
        y: e.clientY,
      };
    };

    const onUp = (e: PointerEvent) => {
      setIsShiftPressed(e.shiftKey);
      if (isOverUI) return;

      if (vegetationBrushActive) {
        if (e.button === 0) {
          isDraggingVegetationRef.current = false;
        }
        return;
      }

      if (paintMode) {
        // If terrainMode is paint and selected mask is persistent shape, spawn mask node object!
        if (e.button === 0 && terrainMode === 'paint' && ['star', 'hexagon', 'square', 'starOutline'].includes(brushMaskId)) {
          if (!pointerStartRef.current) return;
          const elapsed = Date.now() - pointerStartRef.current.time;
          const dist = Math.hypot(e.clientX - pointerStartRef.current.x, e.clientY - pointerStartRef.current.y);
          pointerStartRef.current = null;
          if (elapsed > 300 || dist > 5) return;

          const rect = gl.domElement.getBoundingClientRect();
          const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          const exactMouse = new THREE.Vector2(ndcX, ndcY);

          raycaster.setFromCamera(exactMouse, camera);
          const intersects = raycaster.intersectObjects(scene.children, true);
          const terrainHit = intersects.find(i => i.object.name === 'terrain');
          if (terrainHit) {
            const hitPoint = terrainHit.point;
            const newItem: MapItem = {
              id: "item_mask_" + Math.random().toString(36).substr(2, 9),
              type: "mask_projection",
              path: brushMaskId,
              pos: [hitPoint.x, hitPoint.y, hitPoint.z],
              rot: [0, (brushRotation * Math.PI) / 180, 0],
              sca: [brushSize, brushSize, brushSize],
              color: brushColor,
            };
            updateItemsWithHistory(prev => [...prev, newItem]);
            console.log(`[PERSISTENT MASK] Placed dynamic mask object ${brushMaskId} at`, hitPoint);
          }
        }
        return;
      }

      // Right click cancels selection or dragging
      if (e.button === 2) {
        e.preventDefault();
        cancelActiveDragOrPlacement();
        return;
      }

      if (e.button !== 0 || !pointerStartRef.current) return;
      
      const elapsed = Date.now() - pointerStartRef.current.time;
      const dist = Math.hypot(e.clientX - pointerStartRef.current.x, e.clientY - pointerStartRef.current.y);
      pointerStartRef.current = null;

      // Tap-to-drag validation threshold: hold or camera movement ignores selection
      if (elapsed > 300 || dist > 5) return;

      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const exactMouse = new THREE.Vector2(ndcX, ndcY);

      raycaster.setFromCamera(exactMouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      const filteredIntersects = draggedId 
        ? intersects.filter(i => {
            let cur: any = i.object;
            while (cur) {
              if (cur.name === draggedId) return false;
              cur = cur.parent;
            }
            return true;
          })
        : intersects;
      
      if (filteredIntersects.length === 0) {
        if (draggedId) {
          commitPlacement(draggedId);
        } else {
          setSelectedId(null);
        }
        return;
      }

      // Check if we hit an Item
      const itemHit = filteredIntersects.find(i => {
        let cur: any = i.object;
        while(cur) {
          if(cur.name?.startsWith('item_')) return true;
          cur = cur.parent;
        }
        return false;
      });

      if (itemHit) {
        let cur: any = itemHit.object;
        while(cur) {
          if(cur.name?.startsWith('item_')) {
            const hitId = cur.name;
            
            if (draggedId) {
              commitPlacement(draggedId);
            } else if (selectedId === hitId) {
              // Click selected item again to pick it up in direct drag mode!
              const it = items.find(i => i.id === hitId);
              if (it) {
                setDraggedId(hitId);
                dragStartRef.current = {
                  pos: [...it.pos],
                  rot: [...it.rot],
                  sca: [...it.sca]
                };
                console.log(`[PARALIVES INTERACTION] Picked up ${it.type} in Drag Mode.`);
              }
            } else {
              // Select item and immediately pick it up in direct drag mode!
              setSelectedId(hitId);
              const it = items.find(i => i.id === hitId);
              if (it) {
                setDraggedId(hitId);
                dragStartRef.current = {
                  pos: [...it.pos],
                  rot: [...it.rot],
                  sca: [...it.sca]
                };
                console.log(`[PARALIVES INTERACTION] Selected and picked up ${it.type} in Drag Mode.`);
              }
              if (activeAsset) setActiveAsset(null);
            }
            return;
          }
          cur = cur.parent;
        }
      }

      // Handle ground / terrain click
      const groundHit = filteredIntersects.find(i => 
        i.object.name && (
          i.object.name.toLowerCase().includes('terrain') || 
          i.object.name.toLowerCase().includes('ground')
        )
      );
      
      if (groundHit) {
        if (draggedId) {
          // Committing placement
          commitPlacement(draggedId);
        } else if (activeAsset) {
          // Spawn new blueprint
          spawnAtPoint(groundHit.point);
        } else {
          // Deselect selected item
          setSelectedId(null);
        }
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isEditorOpen, isOverUI, selectedId, draggedId, activeAsset, paintMode, vegetationBrushActive, setActiveAsset, scene, camera, gl, raycaster, spawnAtPoint, setSelectedId, commitPlacement, cancelActiveDragOrPlacement, items]);

  // Frame Loop logic
  useFrame((_, delta) => {
    // ─── 0. CAMERA FOCUS TARGET LERPING ───
    if (cameraFocusTarget) {
      const controls = (_.controls || (camera as any).controls) as any;
      if (controls) {
        const targetVec = new THREE.Vector3(...cameraFocusTarget);
        
        // Smoothly interpolate orbit controls focus target Y-level elevations
        controls.target.lerp(targetVec, 1 - Math.exp(-8 * delta));
        
        // Bug 2 fix: Dynamic camera distance based on focused object's bounding box size
        let cameraDistance = 22; // default fallback
        if (cameraFocusObjectId && cameraFocusObjectId !== 'terrain') {
          const focusObj = scene.getObjectByName(cameraFocusObjectId);
          if (focusObj) {
            const box = new THREE.Box3().setFromObject(focusObj);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            // Scale distance proportionally to object size, clamped to sensible range
            cameraDistance = Math.max(6, Math.min(50, maxDim * 2.5 + 4));
          }
        }
        
        // Position camera at a proportional offset based on computed distance
        const dir = new THREE.Vector3(0.65, 0.5, 0.65).normalize();
        const desiredCamPos = targetVec.clone().add(dir.multiplyScalar(cameraDistance));
        
        camera.position.lerp(desiredCamPos, 1 - Math.exp(-8 * delta));
        
        // Once cameras settle closely to focus vectors, free constraints controls
        if (controls.target.distanceTo(targetVec) < 0.1) {
          setCameraFocusTarget(null);
          setCameraFocusObjectId(null);
        }
      }
    }

    if (!isEditorOpen || isOverUI) {
      if (hoverPos) setHoverPos(null);
      if (hoveredId) setHoveredId(null);
      if (brushHoverPos) setBrushHoverPos(null);
      document.body.style.cursor = 'auto';
      return;
    }

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Vegetation Spray Brush Mode
    if (vegetationBrushActive) {
      const terrainHit = intersects.find(i => 
        i.object.name && (
          i.object.name.toLowerCase().includes('terrain') || 
          i.object.name.toLowerCase().includes('ground')
        )
      );
      if (terrainHit) {
        const p = terrainHit.point;
        setBrushHoverPos([p.x, p.y, p.z]);
        
        if (isDraggingVegetationRef.current) {
          handleSprayVegetation([p.x, p.y, p.z]);
          
          // Disable orbit controls while dragging to prevent rotation issues
          const controls = _.controls as any;
          if (controls && controls.enabled) {
            controls.enabled = false;
          }
        } else {
          // Re-enable controls when not active spraying
          const controls = _.controls as any;
          if (controls && !controls.enabled && !draggedId) {
            controls.enabled = true;
          }
        }
      } else {
        setBrushHoverPos(null);
      }
      
      if (hoverPos) setHoverPos(null);
      if (hoveredId) setHoveredId(null);
      document.body.style.cursor = 'cell';
      return;
    }

    // Terrain Paint Mode
    if (paintMode) {
      const terrainHit = intersects.find(i => i.object.name === 'terrain');
      if (terrainHit) {
        setBrushHoverPos([terrainHit.point.x, terrainHit.point.y, terrainHit.point.z]);
      } else {
        setBrushHoverPos(null);
      }
      if (hoverPos) setHoverPos(null);
      if (hoveredId) setHoveredId(null);
      document.body.style.cursor = 'crosshair';
      return;
    }

    // Poin 1: Abaikan objek yang sedang diseret (Raycast Target Filtering)
    const filteredIntersects = draggedId 
      ? intersects.filter(i => {
          let cur: any = i.object;
          while (cur) {
            if (cur.name === draggedId) return false;
            cur = cur.parent;
          }
          return true;
        })
      : intersects;

    // Retrieve terrain coordinates
    const terrainHit = filteredIntersects.find(i => 
      i.object.name && (
        i.object.name.toLowerCase().includes('terrain') || 
        i.object.name.toLowerCase().includes('ground')
      )
    );

    // Bug 3 fix: Compute elevation offset ONCE at drag start to preserve user's Y
    if (draggedId) {
      const obj = scene.getObjectByName(draggedId);
      if (obj) {
        // Initialize drag target position on first frame of this drag
        if (lastDraggedIdRef.current !== draggedId) {
          targetDragPosRef.current.copy(obj.position);
          lastDraggedIdRef.current = draggedId;

          // Calculate how far above the terrain surface the user placed this object.
          // This offset is locked for the entire drag so Y position is preserved.
          const currentX = obj.position.x;
          const currentZ = obj.position.z;
          let terrainYHere = getTerrainElevation(currentX, currentZ, environment, 24, terrainConfig);
          if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
            const raycastH = (window as any).getGroundHeight(currentX, currentZ, -999);
            if (raycastH !== -999) terrainYHere = raycastH;
          }
          dragElevationOffsetRef.current = obj.position.y - terrainYHere;
        }
      }
    } else {
      if (lastDraggedIdRef.current !== null) {
        lastDraggedIdRef.current = null;
      }
    }

    if (terrainHit) {
      // Langkah A: Tangkap koordinat mouse di tanah
      const rawPos = terrainHit.point;
      
      // Langkah B: Bulatkan koordinat X dan Z ke grid terdekat
      const snapX = snap(rawPos.x);
      const snapZ = snap(rawPos.z);
      
      // Langkah C: Ambil tinggi permukaan tanah tepat di koordinat X dan Z yang sudah dibulatkan
      let snapY = getTerrainElevation(snapX, snapZ, environment, 24, terrainConfig);
      if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
        const raycastH = (window as any).getGroundHeight(snapX, snapZ, -999);
        if (raycastH !== -999) {
          snapY = raycastH;
        }
      }
      
      // Bug 3 fix: Use locked elevation offset (not recalculated pivot)
      const snappedPoint = new THREE.Vector3(snapX, snapY + dragElevationOffsetRef.current, snapZ);
      
      // Poin 4: Perhalus pergerakan lerp target posisi saat meluncur di grid dan tebing/lereng curam
      targetDragPosRef.current.lerp(snappedPoint, 1 - Math.exp(-24 * delta));

      // Smooth blueprint ghost glide
      smoothHoverPosRef.current.lerp(new THREE.Vector3(snapX, snapY, snapZ), 1 - Math.exp(-18 * delta));
      setHoverPos(smoothHoverPosRef.current);
    } else {
      setHoverPos(null);
    }

    // Direct object dragging movement and smoothing
    if (draggedId) {
      const obj = scene.getObjectByName(draggedId);
      if (obj) {
        // Lerp coordinates for absolute Paralives sliding feel!
        obj.position.lerp(targetDragPosRef.current, 1 - Math.exp(-15 * delta));
        
        // Disable orbit controls while dragging to prevent rotation issues
        const controls = _.controls as any;
        if (controls && controls.enabled) {
          controls.enabled = false;
        }
      }
      document.body.style.cursor = 'move';
      return;
    } else {
      // Re-enable orbit controls when not dragging
      const controls = _.controls as any;
      if (controls && !controls.enabled && !isDraggingVegetationRef.current) {
        controls.enabled = true;
      }
    }

    // Item Hover Highlighting
    const itemHit = intersects.find(i => {
      let cur: any = i.object;
      while(cur) {
        if(cur.name?.startsWith('item_')) return true;
        cur = cur.parent;
      }
      return false;
    });

    if (itemHit) {
      let cur: any = itemHit.object;
      while(cur) {
        if(cur.name?.startsWith('item_')) {
          const hitId = cur.name;
          if (hoveredId !== hitId) setHoveredId(hitId);
          document.body.style.cursor = 'pointer';
          return;
        }
        cur = cur.parent;
      }
    } else {
      if (hoveredId) {
        setHoveredId(null);
        document.body.style.cursor = 'auto';
      }
    }
  });

  const normalItems = useMemo(() => items.filter(i => i.type !== 'procedural-vegetation'), [items]);
  const proceduralItems = useMemo(() => items.filter(i => i.type === 'procedural-vegetation'), [items]);

  return (
    <group>
      {/* Visual blueprint placement or ground projection cursor */}
      {hoverPos && activeAsset && (
        <Suspense fallback={
          <mesh position={[hoverPos.x, hoverPos.y + 0.15, hoverPos.z]} rotation-x={-Math.PI/2}>
            <ringGeometry args={[0.4, 0.5, 32]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
          </mesh>
        }>
          <GhostPreview 
            path={activeAsset.path} 
            position={hoverPos} 
            scale={lastUsedScales[activeAsset.path] || [1, 1, 1]} 
            rotation={lastUsedRotations[activeAsset.path] || [0, 0, 0]}
          />
        </Suspense>
      )}

      {/* ─── VEGETATION SPRAY BRUSH RADIAL RING ─── */}
      {vegetationBrushActive && brushHoverPos && (() => {
        const vegRadius = brushSize * 0.12;
        const vegPts = buildProjectedCirclePoints(
          brushHoverPos[0], brushHoverPos[1], brushHoverPos[2],
          vegRadius, 64, environment, terrainConfig
        );
        return (
          <lineLoop>
            <bufferGeometry>
              <float32BufferAttribute attach="attributes-position" args={[vegPts, 3]} />
            </bufferGeometry>
            <lineBasicMaterial
              color={isShiftPressed ? '#ef4444' : '#10b981'}
              linewidth={2}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </lineLoop>
        );
      })()}

      {/* ─── PAINT SPLAT HOLOGRAPHIC MASK PROJECTION ─── */}
      {paintMode && brushHoverPos && (
        <HolographicBrushProjection 
          maskId={brushMaskId} 
          size={brushSize} 
          strength={brushStrength} 
          position={brushHoverPos}
          environment={environment}
          terrainConfig={terrainConfig}
        />
      )}
      
      {normalItems.map((item) => (
        <SafeErrorBoundary
          key={item.id}
          fallback={
            <mesh position={item.pos} rotation={item.rot} scale={item.sca}>
              <boxGeometry args={[1.1, 1.1, 1.1]} />
              <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.6} />
            </mesh>
          }
        >
          <Suspense 
            fallback={
              <mesh position={item.pos} rotation={item.rot} scale={item.sca}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#6366f1" wireframe transparent opacity={0.4} />
              </mesh>
            }
          >
            {item.type === 'mask_projection' ? (
              <PlacedMaskProjection 
                item={item}
                isSelected={selectedIds.includes(item.id)}
                isHovered={hoveredId === item.id}
                onPointerOver={(e) => {
                  if (activeAsset || paintMode || vegetationBrushActive) return;
                  e.stopPropagation();
                  setHoveredId(item.id);
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  if (hoveredId === item.id) setHoveredId(null);
                }}
              />
            ) : (
              <EditorItem 
                item={item} 
                isSelected={selectedIds.includes(item.id)} 
                isHovered={hoveredId === item.id}
                isDragging={draggedId === item.id}
                onClick={(e) => {
                  if (!isEditorOpen) return;
                  const isShift = e.shiftKey || e.nativeEvent?.shiftKey;
                  if (isShift) {
                    toggleSelectedId(item.id);
                  } else {
                    setSelectedId(item.id);
                  }
                }}
              />
            )}
          </Suspense>
        </SafeErrorBoundary>
      ))}
      <ProceduralVegetationLayer items={proceduralItems} />
    </group>
  );
};

const EditorItem = memo(({ item, isSelected, isHovered, isDragging, onClick }: { 
  item: MapItem; 
  isSelected: boolean; 
  isHovered: boolean;
  isDragging: boolean;
  onClick: (e: any) => void;
}) => {
  const { scene: gltfScene } = useGLTF(item.path);
  const cloned = useMemo(() => {
    const c = gltfScene.clone();
    c.name = item.id;
    c.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.name = item.id;
        if (item.color) {
          child.material = child.material.clone();
          child.material.color.set(item.color);
        }
      }
    });
    return c;
  }, [gltfScene, item.id, item.color]);

  // Dynamically compute absolute mesh radius using bounding dimensions
  const radius = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const r = Math.max(size.x, size.z) * 0.65;
    return Math.max(0.4, r);
  }, [cloned]);

  return (
    <primitive 
      object={cloned} 
      name={item.id}
      position={item.pos}
      rotation={item.rot}
      scale={item.sca}
      onClick={(e: any) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {isSelected && (
        <SleekSelectionRing radius={radius} isDragging={isDragging} />
      )}
      {isHovered && !isSelected && (
        <SleekHoverRing radius={radius} />
      )}
    </primitive>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
         prev.isSelected === next.isSelected &&
         prev.isHovered === next.isHovered &&
         prev.isDragging === next.isDragging &&
         prev.item.pos[0] === next.item.pos[0] &&
         prev.item.pos[1] === next.item.pos[1] &&
         prev.item.pos[2] === next.item.pos[2] &&
         prev.item.rot[0] === next.item.rot[0] &&
         prev.item.rot[1] === next.item.rot[1] &&
         prev.item.rot[2] === next.item.rot[2] &&
         prev.item.sca[0] === next.item.sca[0] &&
         prev.item.sca[1] === next.item.sca[1] &&
         prev.item.sca[2] === next.item.sca[2] &&
         prev.item.color === next.item.color;
});

const ProceduralVegetationLayer = memo(({ items }: { items: MapItem[] }) => {
  const groups = useMemo(() => {
    const map = new Map<string, MapItem[]>();
    items.forEach(item => {
      if (!map.has(item.path)) map.set(item.path, []);
      map.get(item.path)!.push(item);
    });
    return Array.from(map.entries());
  }, [items]);

  if (items.length === 0) return null;

  return (
    <group>
      {groups.map(([path, groupItems]) => (
        <InstancedVegetationModel key={path} path={path} instances={groupItems} />
      ))}
    </group>
  );
}, (prev, next) => prev.items === next.items);

const InstancedVegetationModel = memo(({ path, instances }: { path: string, instances: MapItem[] }) => {
  const { scene } = useGLTF(path) as any;

  const meshes = useMemo(() => {
    const extracted: { geometry: THREE.BufferGeometry, material: THREE.Material, localMatrix: THREE.Matrix4 }[] = [];
    scene.updateMatrixWorld(true);

    scene.traverse((child: any) => {
      if (child.isMesh) {
        extracted.push({
          geometry: child.geometry,
          material: child.material.clone(),
          localMatrix: child.matrixWorld.clone()
        });
      }
    });
    return extracted;
  }, [scene]);

  return (
    <group>
      {meshes.map((mesh, index) => (
        <InstancedMeshPart 
          key={index} 
          meshData={mesh} 
          instances={instances} 
        />
      ))}
    </group>
  );
});

const InstancedMeshPart = ({ meshData, instances }: { meshData: any, instances: MapItem[] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  useEffect(() => {
    if (!meshRef.current) return;

    const tempObj = new THREE.Object3D();
    const tempMatrix = new THREE.Matrix4();
    const color = new THREE.Color();

    instances.forEach((item, i) => {
      tempObj.position.set(item.pos[0], item.pos[1], item.pos[2]);
      tempObj.rotation.set(item.rot[0], item.rot[1], item.rot[2]);
      tempObj.scale.set(item.sca[0], item.sca[1], item.sca[2]);
      tempObj.updateMatrix();

      tempMatrix.multiplyMatrices(tempObj.matrix, meshData.localMatrix);
      meshRef.current.setMatrixAt(i, tempMatrix);

      if (item.color) {
        color.set(item.color);
        meshRef.current.setColorAt(i, color);
      } else {
        color.set(0xffffff);
        meshRef.current.setColorAt(i, color);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [instances, meshData]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[meshData.geometry, meshData.material, instances.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
};
