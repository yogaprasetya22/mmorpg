'use client';

/**
 * WorldEditor.tsx — main 3D editor orchestrator for Jagres Map Studio.
 *
 * Handles:
 *  - Zustand state integration
 *  - Pointer events (down/move/up)
 *  - Wheel events (rotate/scale/brush)
 *  - useFrame (raycasting, brush position, spray, camera focus)
 *
 * Rendering sub-components imported from ./editor/*.tsx
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

// ─── WORLD EDITOR COMPONENT ───

export const WorldEditor = () => {
  const { scene, raycaster, camera, gl } = useThree();
  const {
    items, setItems, selectedId, setSelectedId, selectedIds, toggleSelectedId,
    activeAsset, setActiveAsset, isEditorOpen, updateItemsWithHistory,
    undo, redo, loadFromStorage, gridSize, gridEnabled,
    paintMode, brushSize, brushHoverPos, setBrushHoverPos,
    brushMaskId, brushStrength, setBrushStrength, terrainMode,
    brushRotation, brushColor, lastUsedScales, setLastUsedScale,
    lastUsedRotations, setLastUsedRotation, environment, terrainConfig,
    vegetationBrushActive, setVegetationBrushActive,
    vegetationFixedScale, vegetationDensity,
    cameraFocusTarget, setCameraFocusTarget, cameraFocusObjectId, setCameraFocusObjectId,
    assetLibrary, vegetationRadius,
  } = useEditorStore();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hasHoverPos, setHasHoverPos] = useState(false);
  const hoverPosRef = useRef<THREE.Vector3 | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [isOverUI, setIsOverUI] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  const getRaycastTargets = useCallback(() => {
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
    return targets.length > 0 ? targets : scene.children;
  }, [scene, items]);

  // Refs
  const isDraggingVegetationRef = useRef(false);
  const lastSprayTimeRef = useRef(0);
  const sprayBufferRef = useRef<MapItem[] | null>(null);
  const lastSprayPosRef = useRef<[number, number, number] | null>(null);
  const dragStartRef = useRef<{ pos: [number, number, number]; rot: [number, number, number]; sca: [number, number, number] } | null>(null);
  const smoothHoverPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const targetDragPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const dragElevationOffsetRef = useRef(0);
  const pointerStartRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastDraggedIdRef = useRef<string | null>(null);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (activeAsset) useGLTF.preload(activeAsset.path);
  }, [activeAsset]);

  const snap = useCallback((val: number) => gridEnabled ? Math.round(val / gridSize) * gridSize : val, [gridEnabled, gridSize]);

  // ─── COMMIT PLACEMENT ───
  const commitPlacement = useCallback((id: string) => {
    const obj = scene.getObjectByName(id);
    if (!obj) return;
    updateItemsWithHistory(prev => prev.map(i => i.id === id ? { ...i, pos: [obj.position.x, obj.position.y, obj.position.z], rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z], sca: [obj.scale.x, obj.scale.y, obj.scale.z] } : i));
    setDraggedId(null);
    dragStartRef.current = null;
  }, [updateItemsWithHistory, scene]);

  const cancelActiveDragOrPlacement = useCallback(() => {
    if (draggedId) {
      const start = dragStartRef.current;
      const activeId = draggedId;
      setDraggedId(null);
      dragStartRef.current = null;
      if (start) {
        const obj = scene.getObjectByName(activeId);
        if (obj) { obj.position.set(...start.pos); obj.rotation.set(...start.rot); obj.scale.set(...start.sca); }
        setItems(items.map(i => i.id === activeId ? { ...i, pos: start.pos, rot: start.rot, sca: start.sca } : i));
      }
    } else if (activeAsset) {
      setActiveAsset(null);
    } else if (selectedId) { setSelectedId(null); }
    if (vegetationBrushActive) setVegetationBrushActive(false);
  }, [draggedId, activeAsset, selectedId, items, setItems, scene, setActiveAsset, setSelectedId, vegetationBrushActive, setVegetationBrushActive]);

  const spawnAtPoint = useCallback((point: THREE.Vector3) => {
    if (!activeAsset || paintMode || vegetationBrushActive) return;
    const snappedX = snap(point.x); const snappedZ = snap(point.z);
    let snapY = getTerrainElevation(snappedX, snappedZ, environment, 24, terrainConfig);
    if (typeof window !== 'undefined' && (window as any).getGroundHeight) {
      const h = (window as any).getGroundHeight(snappedX, snappedZ, -999);
      if (h !== -999) snapY = h;
    }
    const snappedPos: [number, number, number] = [snappedX, snapY, snappedZ];
    const cachedScale = lastUsedScales[activeAsset.path] || [1, 1, 1];
    const cachedRotation = lastUsedRotations[activeAsset.path] || [0, 0, 0];
    const newItem: MapItem = { id: 'item_' + Math.random().toString(36).substr(2, 9), type: activeAsset.name, path: activeAsset.path, pos: snappedPos, rot: cachedRotation, sca: cachedScale };
    updateItemsWithHistory(prev => [...prev, newItem]);
    setSelectedId(newItem.id);
    setDraggedId(newItem.id);
    dragStartRef.current = { pos: snappedPos, rot: cachedRotation, sca: cachedScale };
    setActiveAsset(null);
  }, [activeAsset, updateItemsWithHistory, setSelectedId, snap, lastUsedScales, lastUsedRotations, paintMode, vegetationBrushActive, environment, terrainConfig]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length > 0) {
      updateItemsWithHistory(prev => prev.filter(i => !selectedIds.includes(i.id)));
      setSelectedId(null); setDraggedId(null); dragStartRef.current = null;
    }
  }, [selectedIds, updateItemsWithHistory, setSelectedId]);

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
      if (!isEditorOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); cancelActiveDragOrPlacement(); }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !document.activeElement?.matches('input, textarea')) deleteSelected();
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [isEditorOpen, undo, redo, selectedIds, deleteSelected, cancelActiveDragOrPlacement]);

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
      const nextItems = items.filter((item) => {
        if (item.type !== 'procedural-vegetation') return true;
        const [px, , pz] = item.pos;
        return Math.hypot(px - cx, pz - cz) > radius;
      });
      if (nextItems.length !== items.length) updateItemsWithHistory(nextItems);
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
    if (flushImmediate) {
      updateItemsWithHistory((prev: MapItem[]) => [...prev, ...newTrees]);
    } else {
      if (!sprayBufferRef.current) sprayBufferRef.current = [];
      sprayBufferRef.current.push(...newTrees);
    }
  }, [vegetationDensity, environment, terrainConfig, items, updateItemsWithHistory, isShiftPressed, vegetationFixedScale]);

  // ─── POINTER EVENTS ───
  useEffect(() => {
    if (!isEditorOpen) return;
    const onMove = (e: PointerEvent) => {
      setIsShiftPressed(e.shiftKey);
      setIsOverUI(!!(e.target as HTMLElement).closest('.world-editor-ui, [data-leva], #leva__root') || ['BUTTON', 'INPUT', 'SELECT', 'LABEL'].includes((e.target as HTMLElement).tagName));
    };
    const onDown = (e: PointerEvent) => {
      setIsShiftPressed(e.shiftKey);
      if (isOverUI) return;
      const t = e.target as HTMLElement;
      if (t.closest('.world-editor-ui, [data-leva], #leva__root') || ['BUTTON', 'INPUT', 'SELECT', 'LABEL'].includes(t.tagName)) return;
      if (vegetationBrushActive) { if (e.button === 0) { isDraggingVegetationRef.current = true; sprayBufferRef.current = []; lastSprayPosRef.current = null; } return; }
      pointerStartRef.current = { time: Date.now(), x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      setIsShiftPressed(e.shiftKey);
      if (isOverUI) return;
      if (vegetationBrushActive) {
        if (e.button === 0) {
          isDraggingVegetationRef.current = false;
          if (sprayBufferRef.current && sprayBufferRef.current.length > 0) {
            const buf = sprayBufferRef.current;
            sprayBufferRef.current = null;
            updateItemsWithHistory((prev: MapItem[]) => [...prev, ...buf]);
          }
          lastSprayPosRef.current = null;
        }
        return;
      }
      if (paintMode) {
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
          const hits = raycaster.intersectObjects(getRaycastTargets(), true);
          const terrainHit = hits.find(i => i.object.name === 'terrain');
          if (terrainHit) {
            const hp = terrainHit.point;
            const newItem: MapItem = { id: 'item_mask_' + Math.random().toString(36).substr(2, 9), type: 'mask_projection', path: brushMaskId, pos: [hp.x, hp.y, hp.z], rot: [0, (brushRotation * Math.PI) / 180, 0], sca: [brushSize, brushSize, brushSize], color: brushColor };
            updateItemsWithHistory(prev => [...prev, newItem]);
          }
        }
        return;
      }
      if (e.button === 2) { e.preventDefault(); cancelActiveDragOrPlacement(); return; }
      if (e.button !== 0 || !pointerStartRef.current) return;
      const elapsed = Date.now() - pointerStartRef.current.time;
      const dist = Math.hypot(e.clientX - pointerStartRef.current.x, e.clientY - pointerStartRef.current.y);
      pointerStartRef.current = null;
      if (elapsed > 300 || dist > 5) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const exactMouse = new THREE.Vector2(ndcX, ndcY);
      raycaster.setFromCamera(exactMouse, camera);
      const hits = raycaster.intersectObjects(getRaycastTargets(), true);
      const filtered = draggedId ? hits.filter(i => { let c: any = i.object; while (c) { if (c.name === draggedId) return false; c = c.parent; } return true; }) : hits;
      if (filtered.length === 0) { if (draggedId) commitPlacement(draggedId); else setSelectedId(null); return; }
      const itemHit = filtered.find(i => { let c: any = i.object; while (c) { if (c.name && (c.name.startsWith('item_') || items.some(it => it.id === c.name))) return true; c = c.parent; } return false; });
      if (itemHit) {
        let c: any = itemHit.object;
        while (c) {
          if (c.name && (c.name.startsWith('item_') || items.some(it => it.id === c.name))) {
            const hitId = c.name;
            if (draggedId) { commitPlacement(draggedId); return; }
            if (selectedId === hitId) {
              const it = items.find(i2 => i2.id === hitId);
              if (it) { setDraggedId(hitId); dragStartRef.current = { pos: [...it.pos], rot: [...it.rot], sca: [...it.sca] }; }
            } else {
              setSelectedId(hitId);
              const it = items.find(i2 => i2.id === hitId);
              if (it) { setDraggedId(hitId); dragStartRef.current = { pos: [...it.pos], rot: [...it.rot], sca: [...it.sca] }; }
              if (activeAsset) setActiveAsset(null);
            }
            return;
          }
          c = c.parent;
        }
      }
      const groundHit = filtered.find(i => i.object.name && (i.object.name.toLowerCase().includes('terrain') || i.object.name.toLowerCase().includes('ground')));
      if (groundHit) { if (draggedId) commitPlacement(draggedId); else if (activeAsset) spawnAtPoint(groundHit.point); else setSelectedId(null); }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp); };
  }, [isEditorOpen, isOverUI, selectedId, draggedId, activeAsset, paintMode, vegetationBrushActive, setActiveAsset, scene, camera, gl, raycaster, spawnAtPoint, setSelectedId, commitPlacement, cancelActiveDragOrPlacement, items]);

  // ─── WHEEL EVENTS ───
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const activeId = draggedId || selectedId;
      const direction = e.deltaY > 0 ? -1 : 1;
      const isShift = e.shiftKey, isCtrl = e.ctrlKey, isAlt = e.altKey;

      if (vegetationBrushActive) {
        e.preventDefault();
        if (isShift && isAlt) {
          const { vegetationFixedScale: vfs, setVegetationFixedScale: svfs } = useEditorStore.getState();
          const nextScale = Math.max(0, Math.min(4.0, vfs + 0.05 * direction));
          svfs(parseFloat(nextScale.toFixed(2)));
        } else if (isCtrl && !isShift) {
          const { vegetationDensity: vd, setVegetationDensity: svd } = useEditorStore.getState();
          svd(Math.max(5, Math.min(100, vd + 5 * direction)));
        } else if (isShift && !isAlt) {
          const { vegetationRadius: vr, setVegetationRadius: svr } = useEditorStore.getState();
          svr(Math.max(2, Math.min(30, vr + 0.5 * direction)));
        }
        return;
      }

      if (isCtrl && !isAlt && !isShift && selectedId === 'terrain') { e.preventDefault(); setBrushStrength(Math.max(0.01, Math.min(1.0, brushStrength + 0.05 * direction))); return; }
      if (isCtrl && !isAlt && activeId && activeId !== 'terrain') {
        e.preventDefault();
        const yStep = (isShift ? 0.03 : 0.2) * direction;
        const item = items.find(i => i.id === activeId);
        if (item) {
          const obj = scene.getObjectByName(activeId);
          if (obj) obj.position.y += yStep;

          if (draggedId === activeId) {
            dragElevationOffsetRef.current += yStep;
            targetDragPosRef.current.y += yStep;
          } else {
            updateItemsWithHistory(prev => prev.map(i => i.id === activeId ? { ...i, pos: [i.pos[0], i.pos[1] + yStep, i.pos[2]] } : i));
          }
        }
        return;
      }
      if (isShift && !isAlt) {
        if (selectedId === 'terrain') {
          e.preventDefault();
          const { brushSize: cbs, setBrushSize: sbs } = useEditorStore.getState();
          sbs(Math.max(1, Math.min(150, cbs + 2 * direction)));
          return;
        }
        return;
      }
      if (!isAlt) return;
      if (!activeId && !activeAsset) return;
      e.preventDefault();
      if (isShift && isAlt) {
        const scaleStep = 0.05 * direction;
        if (activeId) {
          const item = items.find(i => i.id === activeId);
          if (item) {
            const obj = scene.getObjectByName(activeId);
            const currentSca = obj ? obj.scale.x : item.sca[0];
            const nextSca = Math.max(0.1, currentSca + scaleStep);
            setLastUsedScale(item.path, [nextSca, nextSca, nextSca]);
            if (obj) obj.scale.set(nextSca, nextSca, nextSca);
            if (draggedId !== activeId) {
              updateItemsWithHistory(prev => prev.map(i => i.id === activeId ? { ...i, sca: [nextSca, nextSca, nextSca] } : i));
            }
          }
        } else if (activeAsset) {
          const cur = lastUsedScales[activeAsset.path] || [1, 1, 1];
          setLastUsedScale(activeAsset.path, [Math.max(0.1, cur[0] + scaleStep), Math.max(0.1, cur[0] + scaleStep), Math.max(0.1, cur[0] + scaleStep)]);
        }
      } else {
        const rotStep = (Math.PI / 24) * direction;
        if (activeId) {
          const item = items.find(i => i.id === activeId);
          if (item) {
            const obj = scene.getObjectByName(activeId);
            const currentYaw = obj ? obj.rotation.y : item.rot[1];
            const nextYaw = currentYaw + rotStep;
            setLastUsedRotation(item.path, [item.rot[0], nextYaw, item.rot[2]]);
            if (obj) obj.rotation.y = nextYaw;
            if (draggedId !== activeId) {
              updateItemsWithHistory(prev => prev.map(i => i.id === activeId ? { ...i, rot: [i.rot[0], nextYaw, i.rot[2]] } : i));
            }
          }
        } else if (activeAsset) {
          const cur = lastUsedRotations[activeAsset.path] || [0, 0, 0];
          setLastUsedRotation(activeAsset.path, [cur[0], cur[1] + rotStep, cur[2]]);
        }
      }
    };
    const el = gl.domElement;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [draggedId, selectedId, selectedIds, activeAsset, items, updateItemsWithHistory, setLastUsedScale, setLastUsedRotation, lastUsedScales, lastUsedRotations, gl, scene, brushStrength, setBrushStrength, vegetationBrushActive]);

  // ─── USE FRAME ───
  useFrame((state, delta) => {
    const { camera, scene, clock, raycaster, mouse } = state;
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

    if (!isEditorOpen || isOverUI) {
      hoverPosRef.current = null;
      if (hasHoverPos) setHasHoverPos(false);
      if (hoveredId) setHoveredId(null);
      if (brushHoverPos) setBrushHoverPos(null);
      document.body.style.cursor = 'auto';
      return;
    }

    // VEGETATION MODE
    if (vegetationBrushActive) {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(getRaycastTargets(), true);
      const terrainHit = intersects.find(i => i.object.name && (i.object.name.toLowerCase().includes('terrain') || i.object.name.toLowerCase().includes('ground')));
      if (terrainHit) {
        const p = terrainHit.point;
        setBrushHoverPos([p.x, p.y, p.z]);
        lastSprayPosRef.current = [p.x, p.y, p.z];
        if (isDraggingVegetationRef.current) {
          handleSprayVegetation(lastSprayPosRef.current, false);
          const ctrls = (state as any).controls as any;
          if (ctrls && ctrls.enabled) ctrls.enabled = false;
        } else {
          const ctrls = (state as any).controls as any;
          if (ctrls && !ctrls.enabled && !draggedId) ctrls.enabled = true;
        }
      } else { setBrushHoverPos(null); if (!isDraggingVegetationRef.current) lastSprayPosRef.current = null; }
      hoverPosRef.current = null;
      if (hasHoverPos) setHasHoverPos(false);
      if (hoveredId) setHoveredId(null);
      document.body.style.cursor = 'cell';
      return;
    }

    // FULL RAYCAST (non-veg modes)
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(getRaycastTargets(), true);

    // Paint mode
    if (paintMode) {
      const terrainHit = intersects.find(i => i.object.name === 'terrain');
      if (terrainHit) {
        setBrushHoverPos([terrainHit.point.x, terrainHit.point.y, terrainHit.point.z]);
      } else { setBrushHoverPos(null); }
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
    } else {
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

    // Hover highlight
    const itemHit = intersects.find(i => { let c: any = i.object; while (c) { if (c.name && (c.name.startsWith('item_') || items.some(it => it.id === c.name))) return true; c = c.parent; } return false; });
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

  return (
    <group ref={groupRef}>
      {/* Ghost preview for manual placement */}
      {hasHoverPos && activeAsset && (
        <Suspense fallback={null}>
          <GhostPreview path={activeAsset.path} positionRef={hoverPosRef} scale={lastUsedScales[activeAsset.path] || [1, 1, 1]} rotation={lastUsedRotations[activeAsset.path] || [0, 0, 0]} />
        </Suspense>
      )}

      {/* Ghost for veg single-asset */}
      {vegetationBrushActive && brushHoverPos && !isDraggingVegetationRef.current && (() => {
        const bp = items.find(i => i.id === selectedId) ? null : assetLibrary.blueprints.find(b => b.id === assetLibrary.selectedBlueprintId);
        if (!bp) return null;
        _ghostPreviewPos.set(brushHoverPos[0], brushHoverPos[1], brushHoverPos[2]);
        const modelPath = bp.modelUrl.startsWith('http') ? bp.modelUrl : `${API_BASE_URL}${bp.modelUrl}`;
        return (
          <Suspense fallback={null}>
            <GhostPreview path={modelPath} position={_ghostPreviewPos}
              scale={vegetationFixedScale > 0 ? [vegetationFixedScale, vegetationFixedScale, vegetationFixedScale] : [1, 1, 1]} rotation={[0, 0, 0]} />
          </Suspense>
        );
      })()}

      {/* Vegetation spray ring */}
      {vegetationBrushActive && brushHoverPos && (() => {
        const worldRadius = vegetationRadius;
        const vegPts = buildProjectedCirclePoints(brushHoverPos[0], brushHoverPos[1], brushHoverPos[2], worldRadius, 64, environment, terrainConfig);
        return (
          <lineLoop>
            <bufferGeometry><float32BufferAttribute attach="attributes-position" args={[vegPts, 3]} /></bufferGeometry>
            <lineBasicMaterial color={isShiftPressed ? '#ef4444' : '#10b981'} linewidth={2} transparent opacity={0.85} depthWrite={false} />
          </lineLoop>
        );
      })()}

      {/* Paint brush projection */}
      {paintMode && brushHoverPos && (
        <HolographicBrushProjection maskId={brushMaskId} size={brushSize} strength={brushStrength} position={brushHoverPos} environment={environment} terrainConfig={terrainConfig} />
      )}

      {/* Normal items */}
      {normalItems.map(item => (
        <SafeErrorBoundary key={item.id} fallback={<mesh position={item.pos} rotation={item.rot} scale={item.sca}><boxGeometry args={[1.1, 1.1, 1.1]} /><meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.6} /></mesh>}>
          <Suspense fallback={<mesh position={item.pos} rotation={item.rot} scale={item.sca}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#6366f1" wireframe transparent opacity={0.4} /></mesh>}>
            {item.type === 'mask_projection' ? (
              <PlacedMaskProjection item={item} isSelected={selectedIds.includes(item.id)} isHovered={hoveredId === item.id}
                onPointerOver={(e) => { if (activeAsset || paintMode || vegetationBrushActive) return; e.stopPropagation(); setHoveredId(item.id); }}
                onPointerOut={(e) => { e.stopPropagation(); if (hoveredId === item.id) setHoveredId(null); }} />
            ) : (
              <EditorItem item={item} isSelected={selectedIds.includes(item.id)} isHovered={hoveredId === item.id} isDragging={draggedId === item.id}
                onClick={(e) => { if (!isEditorOpen) return; const sh = e.shiftKey || e.nativeEvent?.shiftKey; if (sh) toggleSelectedId(item.id); else setSelectedId(item.id); }} />
            )}
          </Suspense>
        </SafeErrorBoundary>
      ))}

      {/* Vegetation layers */}
      <GrassField items={grassItems} />
      <ProceduralVegetationLayer items={treeItems} />
    </group>
  );
};
