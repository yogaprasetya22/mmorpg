'use client';

/**
 * WorldEditor.tsx — main 3D editor orchestrator for Jagres Map Studio.
 *
 * Handles:
 *  - Zustand state integration
 *  - R3F native pointer events via editorPointerRefs bridge (StormTerrain delegates)
 *  - EditorItem native pointer events for drag/select
 *  - Wheel events (rotate/scale/brush)
 *  - useFrame (camera focus, brush sync, spray, drag lerp, hover highlight)
 *
 * Brush indicator ring lives in BrushIndicator.tsx (standalone, zero entanglement).
 * Shared module-level refs: brushWorldPosRef, hasBrushWorldPosRef.
 *
 * Pointer event architecture (WebGPU-safe):
 *   StormTerrain terrain mesh → onPointerDown/Up/Move → editorPointerRefs → WorldEditor
 *   EditorItem group → onPointerDown/Up → WorldEditor state
 *   No window event listeners, no manual NDC, no parent-traversal.
 */

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';
import type { MapItem } from '@jagres/shared';
import { getTerrainElevation, API_BASE_URL, windUniforms } from '@jagres/shared';
import { GrassField, isGrassAssetPath } from '@/src/components/game/environment/GrassField';
import { _charPos as _ghostPreviewPos } from '@/src/entities/player/buffers';
import { getCachedTerrainHeight } from '@jagres/shared';

// Extracted sub-components
import { SafeErrorBoundary, _scratchBox3, _scratchSize, _scratchDir, _scratchTarget, buildProjectedCirclePoints } from '../editorUtils';
import { GhostPreview } from './GhostPreview';
import { HolographicBrushProjection, PlacedMaskProjection } from './BrushProjection';
import { EditorItem } from './EditorItem';
import { ProceduralVegetationLayer } from './VegetationLayers';

// Standalone brush indicator shared refs (module-level, zero React overhead)
import { brushWorldPosRef, hasBrushWorldPosRef } from './BrushIndicator';

// Bridge refs for StormTerrain → WorldEditor delegation (no window listeners)
import { editorPointerRefs } from '../core/editorPointerRefs';

// ─── WORLD EDITOR COMPONENT ───

export const WorldEditor = () => {
  const { scene, gl } = useThree();
  const {
    // Selection & items
    items, selectedId, selectedIds,
    activeAsset,
    isEditorOpen,
    // Grid
    gridSize, gridEnabled,
    // Load / persist
    loadFromStorage,
    // Brush hover (read via .getState() in handlers, but destructured for JSX + useFrame)
    paintMode,
    brushSize, brushStrength, brushMaskId,
    // Camera focus
    cameraFocusTarget, setCameraFocusTarget, cameraFocusObjectId, setCameraFocusObjectId,
    // Environment / terrain
    environment, terrainConfig,
    // Vegetation (closure-captured in useCallback handlers)
    vegetationBrushActive,
    vegetationFixedScale,
    vegetationDensity,
    vegetationRadius,
    // Last-used transform cache
    lastUsedScales, lastUsedRotations,
    // Asset library
    assetLibrary,
  } = useEditorStore();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hasHoverPos, setHasHoverPos] = useState(false);
  // React state mirror of hasBrushWorldPosRef (ref alone can't trigger conditional JSX)
  const [showBrush, setShowBrush] = useState(false);
  const hoverPosRef = useRef<THREE.Vector3 | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  // Refs for volatile state — avoids constant effect re-registration.
  // Handlers read from .getState() or these refs instead of closure.
  const itemsRef = useRef<MapItem[]>(items);
  const activeAssetRef = useRef(activeAsset);
  const vegetationBrushActiveRef = useRef(vegetationBrushActive);
  const paintModeRef = useRef(paintMode);
  const draggedIdRef = useRef<string | null>(null);
  const isUIOverRef = useRef(false);

  // Sync refs every render so handlers always see latest
  itemsRef.current = items;
  activeAssetRef.current = activeAsset;
  vegetationBrushActiveRef.current = vegetationBrushActive;
  paintModeRef.current = paintMode;
  draggedIdRef.current = draggedId;

  // Refs
  const isDraggingVegetationRef = useRef(false);
  const lastSprayTimeRef = useRef(0);
  const sprayBufferRef = useRef<MapItem[] | null>(null);
  const lastSprayPosRef = useRef<[number, number, number] | null>(null);
  const dragStartRef = useRef<{ pos: [number, number, number]; rot: [number, number, number]; sca: [number, number, number] } | null>(null);
  const smoothHoverPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const targetDragPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const dragElevationOffsetRef = useRef(0);
  const lastDraggedIdRef = useRef<string | null>(null);

  // ─── UI OVER DETECTION (via pointermove on document, lightweight) ───
  useEffect(() => {
    if (!isEditorOpen) return;
    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      isUIOverRef.current = !!(
        target.closest('.world-editor-ui, [data-leva], #leva__root') ||
        ['BUTTON', 'INPUT', 'SELECT', 'LABEL'].includes(target.tagName)
      );
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, [isEditorOpen]);

  // ─── STORM TERRAIN BRIDGE ───
  // StormTerrain fires editorPointerRefs on pointer events.
  // This effect installs the handlers once. They delegate to imperative logic.
  useEffect(() => {
    editorPointerRefs.onTerrainPointerDown = (_point: THREE.Vector3, button: number) => {
      if (isUIOverRef.current) return;
      setIsShiftPressed((window as any)._shiftKey === true);

      if (vegetationBrushActiveRef.current) {
        if (button === 0) {
          isDraggingVegetationRef.current = true;
          sprayBufferRef.current = [];
          lastSprayPosRef.current = null;
        }
        return;
      }
      if (paintModeRef.current) {
        // Paint mode click-to-place-mask handled in onUp
        return;
      }
      if (button === 2) {
        cancelActiveDragOrPlacement();
        return;
      }
      if (button === 0 && draggedIdRef.current) {
        // Already dragging — ignore down during drag
        return;
      }
    };

    editorPointerRefs.onTerrainPointerUp = (point: THREE.Vector3, button: number) => {
      if (isUIOverRef.current) return;
      setIsShiftPressed((window as any)._shiftKey === true);
      const st = useEditorStore.getState() as any;

      if (vegetationBrushActiveRef.current) {
        if (button === 0) {
          isDraggingVegetationRef.current = false;
          if (sprayBufferRef.current && sprayBufferRef.current.length > 0) {
            const buf = sprayBufferRef.current;
            sprayBufferRef.current = null;
            st.updateItemsWithHistory((prev: MapItem[]) => [...prev, ...buf]);
          }
          lastSprayPosRef.current = null;
        }
        return;
      }

      if (paintModeRef.current) {
        if (button === 0 && st.terrainMode === 'paint' && ['star', 'hexagon', 'square', 'starOutline'].includes(st.brushMaskId)) {
          const newItem: MapItem = {
            id: 'item_mask_' + Math.random().toString(36).substr(2, 9),
            type: 'mask_projection',
            path: st.brushMaskId,
            pos: [point.x, point.y, point.z],
            rot: [0, (st.brushRotation * Math.PI) / 180, 0],
            sca: [st.brushSize, st.brushSize, st.brushSize],
            color: st.brushColor,
          };
          st.updateItemsWithHistory((prev: MapItem[]) => [...prev, newItem]);
        }
        return;
      }

      if (button === 2) return;
      if (button !== 0) return;

      // Normal mode: check if dragging finished or spawn
      if (draggedIdRef.current) {
        commitPlacement(draggedIdRef.current);
      } else if (activeAssetRef.current) {
        spawnAtPoint(point);
      }
    };

    editorPointerRefs.onTerrainPointerMove = (point: THREE.Vector3) => {
      if (isUIOverRef.current) return;
      // Brush position already handled by BrushIndicator useFrame.
      // Vegetation drag: set lastSprayPosRef (read in useFrame).
      if (vegetationBrushActiveRef.current) {
        lastSprayPosRef.current = [point.x, point.y, point.z];
      }
    };

    return () => {
      editorPointerRefs.onTerrainPointerDown = null;
      editorPointerRefs.onTerrainPointerUp = null;
      editorPointerRefs.onTerrainPointerMove = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — refs capture the latest via .current

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (activeAsset) useGLTF.preload(activeAsset.path);
  }, [activeAsset]);

  const snap = useCallback((val: number) => gridEnabled ? Math.round(val / gridSize) * gridSize : val, [gridEnabled, gridSize]);

  // ─── COMMIT PLACEMENT ───
  const commitPlacement = useCallback((id: string) => {
    const obj = scene.getObjectByName(id);
    if (!obj) return;
    const store = useEditorStore.getState() as any;
    const pos: [number, number, number] = [obj.position.x, obj.position.y, obj.position.z];
    const rot: [number, number, number] = [obj.rotation.x, obj.rotation.y, obj.rotation.z];
    const sca: [number, number, number] = [obj.scale.x, obj.scale.y, obj.scale.z];
    store.updateItemsWithHistory((prev: MapItem[]) => prev.map(i => i.id === id ? { ...i, pos, rot, sca } : i));
    setDraggedId(null);
    dragStartRef.current = null;
  }, [scene]);

  const cancelActiveDragOrPlacement = useCallback(() => {
    const store = useEditorStore.getState() as any;
    const localDraggedId = draggedIdRef.current;
    if (localDraggedId) {
      const start = dragStartRef.current;
      setDraggedId(null);
      dragStartRef.current = null;
      if (start) {
        const obj = scene.getObjectByName(localDraggedId);
        if (obj) { obj.position.set(...start.pos); obj.rotation.set(...start.rot); obj.scale.set(...start.sca); }
        store.setItems(store.items.map((i: MapItem) => i.id === localDraggedId ? { ...i, pos: start.pos, rot: start.rot, sca: start.sca } : i));
      }
    } else if (store.activeAsset) {
      store.setActiveAsset(null);
    } else if (store.selectedId) { store.setSelectedId(null); }
    if (store.vegetationBrushActive) store.setVegetationBrushActive(false);
  }, [scene]);

  const spawnAtPoint = useCallback((point: THREE.Vector3) => {
    const store = useEditorStore.getState() as any;
    const { activeAsset: aa, paintMode: pm, vegetationBrushActive: vba, environment: env, terrainConfig: tc, gridEnabled: ge, gridSize: gs } = store;
    if (!aa || pm || vba) return;
    const snapFn = (val: number) => ge ? Math.round(val / gs) * gs : val;
    const snappedX = snapFn(point.x); const snappedZ = snapFn(point.z);
    let snapY = getTerrainElevation(snappedX, snappedZ, env, 24, tc);
    if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
      const h = (window as any).getGroundHeight(snappedX, snappedZ, -999);
      if (h !== -999) snapY = h;
    }
    const snappedPos: [number, number, number] = [snappedX, snapY, snappedZ];
    const cachedScale = store.lastUsedScales?.[aa.path] || [1, 1, 1];
    const cachedRotation = store.lastUsedRotations?.[aa.path] || [0, 0, 0];
    const newItem: MapItem = { id: 'item_' + Math.random().toString(36).substr(2, 9), type: aa.name, path: aa.path, pos: snappedPos, rot: cachedRotation, sca: cachedScale };
    store.updateItemsWithHistory((prev: MapItem[]) => [...prev, newItem]);
    store.setSelectedId(newItem.id);
    setDraggedId(newItem.id);
    dragStartRef.current = { pos: snappedPos, rot: cachedRotation, sca: cachedScale };
    store.setActiveAsset(null);
  }, []);

  const deleteSelected = useCallback(() => {
    const store = useEditorStore.getState() as any;
    const { selectedIds: sIds, updateItemsWithHistory: uih, setSelectedId: ssi } = store;
    if (sIds.length > 0) {
      uih((prev: MapItem[]) => prev.filter(i => !sIds.includes(i.id)));
      ssi(null); setDraggedId(null); dragStartRef.current = null;
    }
  }, []);

  // ─── EDITOR ITEM HANDLERS ───
  // Called via onPointerDown/Up on EditorItem group (no parent-traversal needed)
  const handleItemPointerDown = useCallback((_e: any, itemId: string) => {
    if (!isEditorOpen || isUIOverRef.current) return;
    const st = useEditorStore.getState() as any;
    if (vegetationBrushActiveRef.current || paintModeRef.current) return;
    const item = st.items.find((i: MapItem) => i.id === itemId);
    if (!item) return;
    if (st.mode === 'translate') {
      setDraggedId(itemId);
      dragStartRef.current = { pos: [item.pos[0], item.pos[1], item.pos[2]], rot: [item.rot[0], item.rot[1], item.rot[2]], sca: [item.sca[0], item.sca[1], item.sca[2]] };
    }
    st.setSelectedId(itemId);
    if (activeAssetRef.current) st.setActiveAsset(null);
  }, [isEditorOpen]);

  const handleItemPointerUp = useCallback((_e: any, itemId: string) => {
    if (!isEditorOpen || isUIOverRef.current) return;
    if (draggedIdRef.current === itemId) {
      commitPlacement(itemId);
    }
  }, [isEditorOpen, commitPlacement]);

  const handleItemPointerOver = useCallback((_e: any, itemId: string) => {
    if (!isEditorOpen || isUIOverRef.current || vegetationBrushActiveRef.current || paintModeRef.current) return;
    setHoveredId(itemId);
  }, [isEditorOpen]);

  const handleItemPointerOut = useCallback((_e: any, itemId: string) => {
    if (!isEditorOpen) return;
    setHoveredId(prev => prev === itemId ? null : prev);
  }, [isEditorOpen]);

  // Block context menu
  useEffect(() => {
    const h = (e: MouseEvent) => { if (isEditorOpen) e.preventDefault(); };
    window.addEventListener('contextmenu', h);
    return () => window.removeEventListener('contextmenu', h);
  }, [isEditorOpen]);

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
      (window as any)._shiftKey = e.shiftKey;
      const st = useEditorStore.getState() as any;
      if (!st.isEditorOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); cancelActiveDragOrPlacement(); }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); st.undo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); st.redo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedIds.length > 0 && !document.activeElement?.matches('input, textarea')) deleteSelected();
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); (window as any)._shiftKey = e.shiftKey; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [cancelActiveDragOrPlacement, deleteSelected]);

  // ─── SPRAY HANDLER ───
  const handleSprayVegetation = useCallback((center: [number, number, number], flushImmediate: boolean) => {
    const now = Date.now();
    if (!flushImmediate && now - lastSprayTimeRef.current < 90) return;
    lastSprayTimeRef.current = now;
    const [cx, , cz] = center;
    const {
      vegetationRadius,
      selectedPrototypeIds,
      vegetationPrototypes,
      vegetationBrushWeights,
      vegetationAlignToNormal,
      vegetationSlopeFilterEnabled,
      vegetationSlopeRange,
      vegetationHeightFilterEnabled,
      vegetationHeightRange,
    } = useEditorStore.getState();
    const radius = vegetationRadius;

    if (isShiftPressed) {
      const st2 = useEditorStore.getState() as any;
      const storeItems = st2.items as MapItem[];
      const nextItems = storeItems.filter((item) => {
        if (item.type !== 'procedural-vegetation') return true;
        const [px, , pz] = item.pos;
        return Math.hypot(px - cx, pz - cz) > radius;
      });
      if (nextItems.length !== storeItems.length) st2.updateItemsWithHistory(nextItems);
      return;
    }

    if (selectedPrototypeIds.length === 0) return;

    const count = Math.max(1, Math.round(vegetationDensity / 12));
    const newTrees: MapItem[] = [];

    const totalWeight = selectedPrototypeIds.reduce((sum, id) => sum + (vegetationBrushWeights[id] || 0), 0);

    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * radius;
      const theta = Math.random() * Math.PI * 2;
      const px = cx + Math.cos(theta) * r;
      const pz = cz + Math.sin(theta) * r;
      const py = getCachedTerrainHeight(px, pz, () => {
        const h = getTerrainElevation(px, pz, environment, 24, terrainConfig);
        if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
          const rh = (window as any).getGroundHeight(px, pz, -999);
          if (rh !== -999) return rh;
        }
        return h;
      });

      // Height filter validation
      if (vegetationHeightFilterEnabled) {
        if (py < vegetationHeightRange[0] || py > vegetationHeightRange[1]) continue;
      }

      // Slope calculations
      const eps = 0.1;
      const hL = getTerrainElevation(px - eps, pz, environment, 24, terrainConfig);
      const hR = getTerrainElevation(px + eps, pz, environment, 24, terrainConfig);
      const hD = getTerrainElevation(px, pz - eps, environment, 24, terrainConfig);
      const hU = getTerrainElevation(px, pz + eps, environment, 24, terrainConfig);
      const nx = -(hR - hL) / (2 * eps);
      const nz = -(hU - hD) / (2 * eps);
      const ny = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const normal = [nx / len, ny / len, nz / len];
      const slopeDegrees = Math.acos(ny / len) * (180 / Math.PI);

      // Slope filter validation
      if (vegetationSlopeFilterEnabled) {
        if (slopeDegrees < vegetationSlopeRange[0] || slopeDegrees > vegetationSlopeRange[1]) continue;
      }

      // Pick weighted prototype
      let chosenProto = vegetationPrototypes.find(p => p.id === selectedPrototypeIds[0])!;
      if (totalWeight > 0) {
        let randomVal = Math.random() * totalWeight;
        for (const protoId of selectedPrototypeIds) {
          const weight = vegetationBrushWeights[protoId] || 0;
          randomVal -= weight;
          if (randomVal <= 0) {
            chosenProto = vegetationPrototypes.find(p => p.id === protoId) || chosenProto;
            break;
          }
        }
      }

      const resolvedPath = chosenProto.assetUrl;
      const modelPath = resolvedPath.startsWith('http') ? resolvedPath : `${API_BASE_URL}${resolvedPath}`;
      const scaleRatio = vegetationFixedScale > 0 ? vegetationFixedScale : chosenProto.defaultScaleMin + Math.random() * (chosenProto.defaultScaleMax - chosenProto.defaultScaleMin);
      const rotY = Math.random() * Math.PI * 2;

      let rot: [number, number, number] = [0, rotY, 0];
      if (vegetationAlignToNormal || chosenProto.alignToSurfaceNormal) {
        const upVec = new THREE.Vector3(0, 1, 0);
        const normVec = new THREE.Vector3(normal[0], normal[1], normal[2]).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(upVec, normVec);
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(upVec, rotY);
        quat.multiply(yawQuat);
        const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
        rot = [euler.x, euler.y, euler.z];
      }

      newTrees.push({
        id: `procedural-veg-${chosenProto.id}-${now}-${i}-${Math.random()}`,
        type: 'procedural-vegetation', path: modelPath,
        pos: [px, py, pz], rot, sca: [scaleRatio, scaleRatio, scaleRatio],
      });
    }

    if (newTrees.length === 0) return;
    const store = useEditorStore.getState() as any;
    if (flushImmediate) {
      store.updateItemsWithHistory((prev: MapItem[]) => [...prev, ...newTrees]);
    } else {
      if (!sprayBufferRef.current) sprayBufferRef.current = [];
      sprayBufferRef.current.push(...newTrees);
    }
  }, [vegetationDensity, environment, terrainConfig, isShiftPressed, vegetationFixedScale]);

  // ─── POINTER EVENTS ───
  // REMOVED: window event listeners for pointerdown/move/up.
  // StormTerrain fires editorPointerRefs (above).
  // EditorItem fires onPointerDown/Up natively.

  // ─── WHEEL EVENTS ───
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const st = useEditorStore.getState() as any;
      const localDraggedId = draggedIdRef.current;
      const localActiveAsset = activeAssetRef.current;
      const localSelectedId = st.selectedId;
      const activeId = localDraggedId || localSelectedId;
      const direction = e.deltaY > 0 ? -1 : 1;
      const isShift = e.shiftKey, isCtrl = e.ctrlKey, isAlt = e.altKey;

      if (st.vegetationBrushActive) {
        e.preventDefault();
        if (isShift && isAlt) {
          const nextScale = Math.max(0, Math.min(4.0, st.vegetationFixedScale + 0.05 * direction));
          st.setVegetationFixedScale(parseFloat(nextScale.toFixed(2)));
        } else if (isCtrl && !isShift) {
          st.setVegetationDensity(Math.max(5, Math.min(100, st.vegetationDensity + 5 * direction)));
        } else if (isShift && !isAlt) {
          st.setVegetationRadius(Math.max(2, Math.min(30, st.vegetationRadius + 0.5 * direction)));
        }
        return;
      }

      if (isCtrl && !isAlt && !isShift && localSelectedId === 'terrain') { e.preventDefault(); st.setBrushStrength(Math.max(0.01, Math.min(1.0, st.brushStrength + 0.05 * direction))); return; }
      if (isCtrl && !isAlt && activeId && activeId !== 'terrain') {
        e.preventDefault();
        const yStep = (isShift ? 0.03 : 0.2) * direction;
        const item = st.items.find((i: MapItem) => i.id === activeId);
        if (item) {
          const obj = scene.getObjectByName(activeId);
          if (obj) obj.position.y += yStep;

          if (localDraggedId === activeId) {
            dragElevationOffsetRef.current += yStep;
            targetDragPosRef.current.y += yStep;
          } else {
            st.updateItemsWithHistory((prev: MapItem[]) => prev.map(i => i.id === activeId ? { ...i, pos: [i.pos[0], i.pos[1] + yStep, i.pos[2]] } : i));
          }
        }
        return;
      }
      if (isShift && !isAlt) {
        if (localSelectedId === 'terrain') {
          e.preventDefault();
          st.setBrushSize(Math.max(1, Math.min(150, st.brushSize + 2 * direction)));
          return;
        }
        return;
      }
      if (!isAlt) return;
      if (!activeId && !localActiveAsset) return;
      e.preventDefault();
      if (isShift && isAlt) {
        const scaleStep = 0.05 * direction;
        if (activeId) {
          const item = st.items.find((i: MapItem) => i.id === activeId);
          if (item) {
            const obj = scene.getObjectByName(activeId);
            const currentSca = obj ? obj.scale.x : item.sca[0];
            const nextSca = Math.max(0.1, currentSca + scaleStep);
            st.setLastUsedScale(item.path, [nextSca, nextSca, nextSca]);
            if (obj) obj.scale.set(nextSca, nextSca, nextSca);
            if (localDraggedId !== activeId) {
              st.updateItemsWithHistory((prev: MapItem[]) => prev.map(i => i.id === activeId ? { ...i, sca: [nextSca, nextSca, nextSca] } : i));
            }
          }
        } else if (localActiveAsset) {
          const cur = st.lastUsedScales?.[localActiveAsset.path] || [1, 1, 1];
          st.setLastUsedScale(localActiveAsset.path, [Math.max(0.1, cur[0] + scaleStep), Math.max(0.1, cur[0] + scaleStep), Math.max(0.1, cur[0] + scaleStep)]);
        }
      } else {
        const rotStep = (Math.PI / 24) * direction;
        if (activeId) {
          const item = st.items.find((i: MapItem) => i.id === activeId);
          if (item) {
            const obj = scene.getObjectByName(activeId);
            const currentYaw = obj ? obj.rotation.y : item.rot[1];
            const nextYaw = currentYaw + rotStep;
            st.setLastUsedRotation(item.path, [item.rot[0], nextYaw, item.rot[2]]);
            if (obj) obj.rotation.y = nextYaw;
            if (localDraggedId !== activeId) {
              st.updateItemsWithHistory((prev: MapItem[]) => prev.map(i => i.id === activeId ? { ...i, rot: [i.rot[0], nextYaw, i.rot[2]] } : i));
            }
          }
        } else if (localActiveAsset) {
          const cur = st.lastUsedRotations?.[localActiveAsset.path] || [0, 0, 0];
          st.setLastUsedRotation(localActiveAsset.path, [cur[0], cur[1] + rotStep, cur[2]]);
        }
      }
    };
    const el = gl.domElement;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [gl, scene]);

  // ─── USE FRAME ───
  useFrame((state, delta) => {
    const { camera, scene, clock, raycaster, pointer } = state;
    windUniforms.time.value = clock.getElapsedTime();

    // Camera focus
    if (cameraFocusTarget) {
      const controls = ((state as any).controls || (camera as any).controls) as any;
      if (controls) {
        _scratchTarget.set(cameraFocusTarget[0], cameraFocusTarget[1], cameraFocusTarget[2]);
        controls.target.lerp(_scratchTarget, 1 - Math.exp(-8 * delta));
        let cameraDistance = 22;
        if (cameraFocusObjectId && cameraFocusObjectId !== 'terrain') {
          const focusObj = scene.getObjectByName(cameraFocusObjectId);
          if (focusObj) {
            _scratchBox3.setFromObject(focusObj);
            _scratchBox3.getSize(_scratchSize);
            cameraDistance = Math.max(6, Math.min(50, Math.max(_scratchSize.x, _scratchSize.y, _scratchSize.z) * 2.5 + 4));
          }
        }
        _scratchDir.set(0.65, 0.5, 0.65).normalize();
        camera.position.lerp(_scratchTarget.clone().add(_scratchDir.multiplyScalar(cameraDistance)), 1 - Math.exp(-8 * delta));
        if (controls.target.distanceTo(_scratchTarget) < 0.1) { setCameraFocusTarget(null); setCameraFocusObjectId(null); }
      }
    }

    // ─── SHOW BRUSH SYNC ───
    // Mirror module-level hasBrushWorldPosRef → React showBrush (transition only, not every frame)
    if (hasBrushWorldPosRef.current && !showBrush) {
      setShowBrush(true);
    } else if (!hasBrushWorldPosRef.current && showBrush) {
      setShowBrush(false);
      if (paintMode) useEditorStore.getState().setBrushHoverPos?.(null);
    }

    if (!isEditorOpen || isUIOverRef.current) {
      hoverPosRef.current = null;
      if (showBrush) setShowBrush(false);
      if (hasHoverPos) setHasHoverPos(false);
      if (hoveredId) setHoveredId(null);
      document.body.style.cursor = 'auto';
      return;
    }

    // VEGETATION MODE
    if (vegetationBrushActive) {
      // Read terrain hit from module-level ref (set by BrushIndicator)
      if (hasBrushWorldPosRef.current) {
        const p = brushWorldPosRef.current;
        lastSprayPosRef.current = [p.x, p.y, p.z];
        if (isDraggingVegetationRef.current) {
          handleSprayVegetation(lastSprayPosRef.current, false);
          const ctrls = (state as any).controls as any;
          if (ctrls && ctrls.enabled) ctrls.enabled = false;
        } else {
          const ctrls = (state as any).controls as any;
          if (ctrls && !ctrls.enabled && !draggedId) ctrls.enabled = true;
        }
      } else {
        if (!isDraggingVegetationRef.current) lastSprayPosRef.current = null;
      }
      hoverPosRef.current = null;
      if (hasHoverPos) setHasHoverPos(false);
      if (hoveredId) setHoveredId(null);
      document.body.style.cursor = 'cell';
      return;
    }

    // FULL RAYCAST (non-veg modes) — using state.raycaster & state.pointer (WebGPU-safe)
    raycaster.setFromCamera(pointer, camera);
    const targets: THREE.Object3D[] = [];
    const terrain = scene.getObjectByName('terrain');
    if (terrain) targets.push(terrain);
    if (groupRef.current) {
      groupRef.current.children.forEach(child => {
        if (child.name && (child.name.startsWith('item_') || items.some(it => it.id === child.name))) {
          targets.push(child);
        }
      });
    }
    const intersects = raycaster.intersectObjects(targets.length > 0 ? targets : scene.children, true);

    // Paint mode — brush position already synced by BrushIndicator
    if (paintMode) {
      hoverPosRef.current = null;
      if (hasHoverPos) setHasHoverPos(false);
      if (hoveredId) setHoveredId(null);
      document.body.style.cursor = 'crosshair';
      return;
    }

    // Object drag mode
    const filteredIntersects = draggedId ? intersects.filter(i => { let c: any = i.object; while (c) { if (c.name === draggedId) return false; c = c.parent; } return true; }) : intersects;
    const terrainHit = filteredIntersects.find(i => i.object.name && (i.object.name.toLowerCase().includes('terrain') || i.object.name.toLowerCase().includes('ground')));

    if (draggedId) {
      const obj = scene.getObjectByName(draggedId);
      if (obj) {
        if (lastDraggedIdRef.current !== draggedId) {
          const item = items.find(i => i.id === draggedId);
          if (item) {
            targetDragPosRef.current.set(item.pos[0], item.pos[1], item.pos[2]);
            let terrainYHere = getTerrainElevation(item.pos[0], item.pos[2], environment, 24, terrainConfig);
            if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
              const rh = (window as any).getGroundHeight(item.pos[0], item.pos[2], -999);
              if (rh !== -999) terrainYHere = rh;
            }
            dragElevationOffsetRef.current = item.pos[1] - terrainYHere;
          } else {
            targetDragPosRef.current.copy(obj.position);
            dragElevationOffsetRef.current = 0;
          }
          lastDraggedIdRef.current = draggedId;
        }
      }
    } else { if (lastDraggedIdRef.current !== null) lastDraggedIdRef.current = null; }

    if (terrainHit) {
      const rawPos = terrainHit.point;
      const snapX = snap(rawPos.x), snapZ = snap(rawPos.z);
      let snapY = getTerrainElevation(snapX, snapZ, environment, 24, terrainConfig);
      if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
        const rh = (window as any).getGroundHeight(snapX, snapZ, -999);
        if (rh !== -999) snapY = rh;
      }
      const snappedPoint = new THREE.Vector3(snapX, snapY + dragElevationOffsetRef.current, snapZ);
      targetDragPosRef.current.lerp(snappedPoint, 1 - Math.exp(-24 * delta));
      smoothHoverPosRef.current.lerp(new THREE.Vector3(snapX, snapY, snapZ), 1 - Math.exp(-18 * delta));
      hoverPosRef.current = smoothHoverPosRef.current;
      if (!hasHoverPos) setHasHoverPos(true);
    } else if (!vegetationBrushActive && !paintMode) {
      // Only clear hoverPos in normal mode — veg/paint use refs
      hoverPosRef.current = null;
      if (hasHoverPos) setHasHoverPos(false);
    }

    if (draggedId) {
      const obj = scene.getObjectByName(draggedId);
      if (obj) {
        obj.position.lerp(targetDragPosRef.current, 1 - Math.exp(-15 * delta));
        const ctrls = (state as any).controls as any;
        if (ctrls && ctrls.enabled) ctrls.enabled = false;
      }
      document.body.style.cursor = 'move';
      return;
    } else {
      const ctrls = (state as any).controls as any;
      if (ctrls && !ctrls.enabled && !isDraggingVegetationRef.current) ctrls.enabled = true;
    }

    // Hover highlight — via useFrame raycast (fallback; EditorItem onPointerOver also fires)
    // This catches items that miss R3F pointer-over due to scene graph quirks.
    const allHits = intersects; // reuse from above
    const itemHit = allHits.find(i => { let c: any = i.object; while (c) { if (c.name && (c.name.startsWith('item_') || items.some(it => it.id === c.name))) return true; c = c.parent; } return false; });
    if (itemHit) {
      let c: any = itemHit.object;
      while (c) { if (c.name && (c.name.startsWith('item_') || items.some(it => it.id === c.name))) { if (hoveredId !== c.name) setHoveredId(c.name); document.body.style.cursor = 'pointer'; return; } c = c.parent; }
    } else { if (hoveredId) { setHoveredId(null); document.body.style.cursor = 'auto'; } }
  });

  // ─── MEMO-ED ITEM SPLITS ───
  const normalItems = useMemo(() => items.filter(i => i.type !== 'procedural-vegetation'), [items]);
  const proceduralItems = useMemo(() => items.filter(i => i.type === 'procedural-vegetation'), [items]);
  const grassItems = useMemo(() => proceduralItems.filter(i => isGrassAssetPath(i.path)), [proceduralItems]);
  const treeItems = useMemo(() => proceduralItems.filter(i => !isGrassAssetPath(i.path)), [proceduralItems]);

  // Selected veg items rendered as individual EditorItem for transform/selection overlay.
  // These sit on top of the InstancedMesh visual layer and provide interactive gizmo control.
  const selectedVegItems = useMemo(
    () => proceduralItems.filter(i => selectedIds.includes(i.id) || draggedId === i.id),
    [proceduralItems, selectedIds, draggedId],
  );

  return (
    <group
      ref={groupRef}
      onPointerMissed={(e) => {
        const st = useEditorStore.getState() as any;
        if (e.button === 0 && !st.activeAsset && !st.paintMode && !st.vegetationBrushActive) {
          st.setSelectedId(null);
        }
      }}
    >
      {/* Ghost preview for manual placement */}
      {hasHoverPos && activeAsset && (
        <Suspense fallback={null}>
          <GhostPreview path={activeAsset.path} positionRef={hoverPosRef} scale={lastUsedScales[activeAsset.path] || [1, 1, 1]} rotation={lastUsedRotations[activeAsset.path] || [0, 0, 0]} />
        </Suspense>
      )}

      {/* Ghost for veg single-asset */}
      {vegetationBrushActive && showBrush && !isDraggingVegetationRef.current && (() => {
        const bp = items.find(i => i.id === selectedId) ? null : assetLibrary.blueprints.find(b => b.id === assetLibrary.selectedBlueprintId);
        if (!bp) return null;
        const _gp = brushWorldPosRef.current;
        _ghostPreviewPos.set(_gp.x, _gp.y, _gp.z);
        const modelPath = bp.modelUrl.startsWith('http') ? bp.modelUrl : `${API_BASE_URL}${bp.modelUrl}`;
        return (
          <Suspense fallback={null}>
            <GhostPreview path={modelPath} position={_ghostPreviewPos}
              scale={vegetationFixedScale > 0 ? [vegetationFixedScale, vegetationFixedScale, vegetationFixedScale] : [1, 1, 1]} rotation={[0, 0, 0]} />
          </Suspense>
        );
      })()}

      {/* Vegetation spray ring — LineSegments (LineLoop unsupported in WebGPU) */}
      {vegetationBrushActive && showBrush && (() => {
        const bp = brushWorldPosRef.current;
        const worldRadius = vegetationRadius;
        const vegPts = buildProjectedCirclePoints(bp.x, bp.y, bp.z, worldRadius, 64, environment, terrainConfig);
        // Duplicate vertices to form connected segments: [0-1, 1-2, ... n-1-0]
        const segPts: number[] = [];
        for (let i = 0; i < vegPts.length / 3; i++) {
          const next = (i + 1) % (vegPts.length / 3);
          for (const k of [0, 1, 2]) segPts.push(vegPts[i * 3 + k]);
          for (const k of [0, 1, 2]) segPts.push(vegPts[next * 3 + k]);
        }
        return (
          <lineSegments>
            <bufferGeometry><float32BufferAttribute attach="attributes-position" args={[segPts, 3]} /></bufferGeometry>
            <lineBasicMaterial color={isShiftPressed ? '#ef4444' : '#10b981'} linewidth={2} transparent opacity={0.85} depthWrite={false} />
          </lineSegments>
        );
      })()}

      {/* Paint brush projection */}
      {paintMode && showBrush && (
        <HolographicBrushProjection maskId={brushMaskId} size={brushSize} strength={brushStrength}
          position={[brushWorldPosRef.current.x, brushWorldPosRef.current.y, brushWorldPosRef.current.z]}
          environment={environment} terrainConfig={terrainConfig} />
      )}

      {normalItems.map(item => (
        <SafeErrorBoundary key={item.id} fallback={<mesh position={item.pos} rotation={item.rot} scale={item.sca}><boxGeometry args={[1.1, 1.1, 1.1]} /><meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.6} /></mesh>}>
          <Suspense fallback={<mesh position={item.pos} rotation={item.rot} scale={item.sca}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#6366f1" wireframe transparent opacity={0.4} /></mesh>}>
            {item.type === 'mask_projection' ? (
              <PlacedMaskProjection item={item} isSelected={selectedIds.includes(item.id)} isHovered={hoveredId === item.id}
                onPointerOver={(e) => { if (activeAsset || paintMode || vegetationBrushActive) return; e.stopPropagation(); setHoveredId(item.id); }}
                onPointerOut={(e) => { e.stopPropagation(); if (hoveredId === item.id) setHoveredId(null); }} />
            ) : (
              <EditorItem item={item} isSelected={selectedIds.includes(item.id)} isHovered={hoveredId === item.id} isDragging={draggedId === item.id}
                onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                onPointerUp={(e) => handleItemPointerUp(e, item.id)}
                onPointerOver={(e) => handleItemPointerOver(e, item.id)}
                onPointerOut={(e) => handleItemPointerOut(e, item.id)} />
            )}
          </Suspense>
        </SafeErrorBoundary>
      ))}

      {/* Selected veg items — individual EditorItem overlay for transform & gizmo */}
      {isEditorOpen && selectedVegItems.map(item => (
        <SafeErrorBoundary key={`selveg-${item.id}`} fallback={null}>
          <Suspense fallback={null}>
            <EditorItem item={item} isSelected={selectedIds.includes(item.id)} isHovered={hoveredId === item.id} isDragging={draggedId === item.id}
              onPointerDown={(e) => handleItemPointerDown(e, item.id)}
              onPointerUp={(e) => handleItemPointerUp(e, item.id)}
              onPointerOver={(e) => handleItemPointerOver(e, item.id)}
              onPointerOut={(e) => handleItemPointerOut(e, item.id)} />
          </Suspense>
        </SafeErrorBoundary>
      ))}

      {/* Vegetation layers */}
      <GrassField items={grassItems} />
      <ProceduralVegetationLayer items={treeItems} />
    </group>
  );
};
