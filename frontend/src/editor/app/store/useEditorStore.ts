/**
 * Editor store — Zustand store composed from modular slices.
 * Replaces monolithic frontend/src/state/useEditorStore.ts (1561 lines).
 *
 * Slice composition pattern: each slice is a StateCreator that gets merged
 * via Zustand's built-in combine/middleware support.
 *
 * Location: frontend/src/editor/app/store/useEditorStore.ts
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import {
    createSelectionSlice,
    type SelectionSlice,
} from "./slices/selection.slice";
import { createTerrainSlice, type TerrainSlice } from "./slices/terrain.slice";
import {
    createVegetationSlice,
    type VegetationSlice,
} from "./slices/vegetation.slice";
import {
    createEnvironmentSlice,
    type EnvironmentSlice,
} from "./slices/environment.slice";
import { createHistorySlice, type HistorySlice } from "./slices/history.slice";
import {
    createPersistenceSlice,
    type PersistenceSlice,
} from "./slices/persistence.slice";

export type EditorStore = SelectionSlice &
    TerrainSlice &
    VegetationSlice &
    EnvironmentSlice &
    HistorySlice &
    PersistenceSlice;

export const useEditorStore = create<EditorStore>()(
    subscribeWithSelector((...args) => ({
        ...createSelectionSlice(...args),
        ...createTerrainSlice(...args),
        ...createVegetationSlice(...args),
        ...createEnvironmentSlice(...args),
        ...createHistorySlice(...args),
        ...createPersistenceSlice(...args),
    })),
);

// ─── Granular selectors (preferred over reading whole store) ───
// ponytail: add more as needed during Phase 2 UI migration

export const selectSelectedId = (s: EditorStore) => s.selectedId;
export const selectSelectedIds = (s: EditorStore) => s.selectedIds;
export const selectItems = (s: EditorStore) => s.items;
export const selectActiveAsset = (s: EditorStore) => s.activeAsset;
export const selectMode = (s: EditorStore) => s.mode;
export const selectBrushSize = (s: EditorStore) => s.brushSize;
export const selectBrushStrength = (s: EditorStore) => s.brushStrength;
export const selectBrushMaskId = (s: EditorStore) => s.brushMaskId;
export const selectBrushHoverPos = (s: EditorStore) => s.brushHoverPos;
export const selectTerrainMode = (s: EditorStore) => s.terrainMode;
export const selectSculptTool = (s: EditorStore) => s.sculptTool;
export const selectPaintMode = (s: EditorStore) => s.paintMode;
export const selectVegetationTheme = (s: EditorStore) => s.vegetationTheme;
export const selectVegetationBrushActive = (s: EditorStore) =>
    s.vegetationBrushActive;
export const selectVegetationAssetOverrides = (s: EditorStore) =>
    s.vegetationAssetOverrides;
export const selectEnvironment = (s: EditorStore) => s.environment;
export const selectSky = (s: EditorStore) => s.sky;
export const selectCameraFocusTarget = (s: EditorStore) => s.cameraFocusTarget;
export const selectIsSaving = (s: EditorStore) => s.isSaving;
export const selectDynamicAssets = (s: EditorStore) => s.dynamicAssets;
export const selectLastUsedScales = (s: EditorStore) => s.lastUsedScales;
export const selectLastUsedRotations = (s: EditorStore) => s.lastUsedRotations;

// ─── Re-export for convenience ───
export type { BrushMaskId, TerrainConfig } from "../../core/types";
