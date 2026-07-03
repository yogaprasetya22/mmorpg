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
export type { BrushMaskId, TerrainConfig } from "@/src/features/world-editor/types/editor.types";

// ─── Debounced Auto Save ───
let saveTimeout: any = null;

if (typeof window !== "undefined") {
    useEditorStore.subscribe(
        (state) => [
            state.historyIndex,
            state.terrainConfig,
            state.terrainColor,
            state.terrainMaterialId,
            state.sky,
            state.environment,
            state.lightIntensity,
            state.ambientIntensity,
            state.sunAngle,
            state.fogDensity,
            state.paintData,
            state.sculptData,
            state.paintLayerMaterials,
            state.paintLayerColors,
        ] as const,
        () => {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const store = useEditorStore.getState();
                // Backup to localStorage
                store.saveToStorage();
                // Persist to Database
                store.saveToDatabase().catch((err) => {
                    console.error("Auto save failed:", err);
                });
            }, 1000); // 1 second debounce
        },
        {
            equalityFn: (a, b) => {
                return (
                    a[0] === b[0] &&
                    a[1].height === b[1].height &&
                    a[1].scale === b[1].scale &&
                    a[1].seed === b[1].seed &&
                    a[1].sharpness === b[1].sharpness &&
                    a[2] === b[2] &&
                    a[3] === b[3] &&
                    a[4] === b[4] &&
                    a[5] === b[5] &&
                    a[6] === b[6] &&
                    a[7] === b[7] &&
                    a[8] === b[8] &&
                    a[9] === b[9] &&
                    a[10] === b[10] &&
                    a[11] === b[11] &&
                    a[12].length === b[12].length &&
                    a[12].every((v, i) => v === b[12][i]) &&
                    a[13].length === b[13].length &&
                    a[13].every((v, i) => v === b[13][i])
                );
            }
        }
    );
}

