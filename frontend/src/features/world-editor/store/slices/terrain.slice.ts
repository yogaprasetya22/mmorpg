/**
 * Terrain slice — sculpt/paint brush state, terrain config, layer paint.
 *
 * Location: frontend/src/editor/app/store/slices/terrain.slice.ts
 */

import type { StateCreator } from "zustand";
import type { BrushMaskId, TerrainConfig } from "@/src/features/world-editor/types/editor.types";

export type SculptTool = "raise" | "lower" | "smooth" | "flatten";
export type ToolBrushProfiles = Record<
    string,
    { size: number; strength: number; maskId: BrushMaskId }
>;

const DEFAULT_BRUSH_PROFILES: ToolBrushProfiles = {
    raise: { size: 12, strength: 0.25, maskId: "softCircle" as BrushMaskId },
    lower: { size: 12, strength: 0.25, maskId: "softCircle" as BrushMaskId },
    smooth: { size: 20, strength: 0.35, maskId: "softCircle" as BrushMaskId },
    flatten: { size: 25, strength: 0.5, maskId: "hardCircle" as BrushMaskId },
    paint: { size: 10, strength: 0.25, maskId: "softCircle" as BrushMaskId },
};

export interface TerrainSlice {
    terrainConfig: TerrainConfig;
    setTerrainConfig: (config: Partial<TerrainConfig>) => void;
    terrainMaterialId: string | null;
    setTerrainMaterialId: (id: string | null) => void;
    terrainColor: string;
    setTerrainColor: (color: string) => void;
    paintMode: boolean;
    setPaintMode: (mode: boolean) => void;
    brushSize: number;
    setBrushSize: (size: number) => void;
    brushColor: string;
    setBrushColor: (color: string) => void;
    brushTextureId: string | null;
    setBrushTextureId: (id: string | null) => void;
    paintData: string | null;
    setPaintData: (data: string | null) => void;
    terrainMode: "paint" | "sculpt";
    setTerrainMode: (mode: "paint" | "sculpt") => void;
    sculptTool: SculptTool;
    setSculptTool: (tool: SculptTool) => void;
    sculptData: string | null;
    setSculptData: (data: string | null) => void;
    brushStrength: number;
    setBrushStrength: (strength: number) => void;
    brushRotation: number;
    setBrushRotation: (rotation: number) => void;
    brushMaskId: BrushMaskId;
    setBrushMaskId: (maskId: BrushMaskId) => void;
    toolBrushProfiles: ToolBrushProfiles;
    activeToolKey: string;
    brushHoverPos: [number, number, number] | null;
    setBrushHoverPos: (pos: [number, number, number] | null) => void;
    activePaintLayer: 0 | 1 | 2 | 3 | 4;
    setActivePaintLayer: (layer: 0 | 1 | 2 | 3 | 4) => void;
    paintLayerMaterials: [
        string | null,
        string | null,
        string | null,
        string | null,
    ];
    setPaintLayerMaterial: (layer: number, matId: string | null) => void;
    paintLayerColors: [string, string, string, string];
    setPaintLayerColor: (layer: number, color: string) => void;
    flattenTargetHeight: number;
    setFlattenTargetHeight: (h: number) => void;
    sculptMaxHeight: number;
    setSculptMaxHeight: (h: number) => void;
    terrainWireframe: boolean;
    setTerrainWireframe: (wireframe: boolean) => void;
}

export const createTerrainSlice: StateCreator<
    TerrainSlice,
    [],
    [],
    TerrainSlice
> = (set, get) => ({
    terrainConfig: { height: 12.0, scale: 0.05, seed: 0, sharpness: 2.0 },
    setTerrainConfig: (config) =>
        set((state) => ({
            terrainConfig: { ...state.terrainConfig, ...config },
        })),
    terrainMaterialId: null,
    setTerrainMaterialId: (id) => set({ terrainMaterialId: id }),
    terrainColor: "#3d5c36",
    setTerrainColor: (color) => set({ terrainColor: color }),
    paintMode: false,
    setPaintMode: (paintMode) => set({ paintMode }),
    brushSize: 12,
    setBrushSize: (brushSize) => {
        const state = get();
        const toolKey = state.activeToolKey;
        set((s) => ({
            brushSize,
            toolBrushProfiles: {
                ...s.toolBrushProfiles,
                [toolKey]: {
                    ...(s.toolBrushProfiles[toolKey] || {}),
                    size: brushSize,
                },
            },
        }));
    },
    brushColor: "#5a4d3a",
    setBrushColor: (brushColor) => set({ brushColor }),
    brushTextureId: null,
    setBrushTextureId: (id) => set({ brushTextureId: id }),
    paintData: null,
    setPaintData: (paintData) => {
        const state = get() as any;
        if (state.updateTerrainWithHistory) {
            state.updateTerrainWithHistory("paint", paintData);
        } else {
            set({ paintData });
        }
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("world_editor_paint", paintData || "");
        }
    },
    terrainMode: "paint",
    setTerrainMode: (newMode) => {
        const state = get();
        const oldKey = state.activeToolKey;
        const newKey = newMode === "paint" ? "paint" : state.sculptTool;
        const newProfile = state.toolBrushProfiles[newKey] ||
            DEFAULT_BRUSH_PROFILES[newKey] || {
                size: 12,
                strength: 0.25,
                maskId: "softCircle" as BrushMaskId,
            };
        set((s) => ({
            terrainMode: newMode,
            activeToolKey: newKey,
            toolBrushProfiles: {
                ...s.toolBrushProfiles,
                [oldKey]: {
                    size: s.brushSize,
                    strength: s.brushStrength,
                    maskId: s.brushMaskId,
                },
            },
            brushSize: newProfile.size,
            brushStrength: newProfile.strength,
            brushMaskId: newProfile.maskId,
        }));
    },
    sculptTool: "raise",
    setSculptTool: (newTool) => {
        const state = get();
        const oldKey = state.activeToolKey;
        const newProfile = state.toolBrushProfiles[newTool] ||
            DEFAULT_BRUSH_PROFILES[newTool] || {
                size: 12,
                strength: 0.25,
                maskId: "softCircle" as BrushMaskId,
            };
        set((s) => ({
            sculptTool: newTool,
            terrainMode: "sculpt" as const,
            activeToolKey: newTool,
            toolBrushProfiles: {
                ...s.toolBrushProfiles,
                [oldKey]: {
                    size: s.brushSize,
                    strength: s.brushStrength,
                    maskId: s.brushMaskId,
                },
            },
            brushSize: newProfile.size,
            brushStrength: newProfile.strength,
            brushMaskId: newProfile.maskId,
        }));
    },
    sculptData: null,
    setSculptData: (sculptData) => {
        const state = get() as any;
        if (state.updateTerrainWithHistory) {
            state.updateTerrainWithHistory("sculpt", sculptData);
        } else {
            set({ sculptData });
        }
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("world_editor_sculpt", sculptData || "");
        }
    },
    brushStrength: 0.25,
    setBrushStrength: (brushStrength) => {
        const state = get();
        const toolKey = state.activeToolKey;
        set((s) => ({
            brushStrength,
            toolBrushProfiles: {
                ...s.toolBrushProfiles,
                [toolKey]: {
                    ...(s.toolBrushProfiles[toolKey] || {}),
                    strength: brushStrength,
                },
            },
        }));
    },
    brushRotation: 0,
    setBrushRotation: (brushRotation) => set({ brushRotation }),
    brushMaskId: "softCircle",
    setBrushMaskId: (brushMaskId) => {
        const state = get();
        const toolKey = state.activeToolKey;
        set((s) => ({
            brushMaskId,
            toolBrushProfiles: {
                ...s.toolBrushProfiles,
                [toolKey]: {
                    ...(s.toolBrushProfiles[toolKey] || {}),
                    maskId: brushMaskId,
                },
            },
        }));
    },
    toolBrushProfiles: DEFAULT_BRUSH_PROFILES,
    activeToolKey: "paint",
    brushHoverPos: null,
    setBrushHoverPos: (brushHoverPos) => set({ brushHoverPos }),
    activePaintLayer: 0,
    setActivePaintLayer: (layer) => set({ activePaintLayer: layer }),
    paintLayerMaterials: [null, null, null, null],
    setPaintLayerMaterial: (layer, matId) =>
        set((state) => {
            const next = [...state.paintLayerMaterials] as [
                string | null,
                string | null,
                string | null,
                string | null,
            ];
            next[layer] = matId;
            return { paintLayerMaterials: next };
        }),
    paintLayerColors: ["#3d5c36", "#7c6a4a", "#5a4d3a", "#e8e0d0"],
    setPaintLayerColor: (layer, color) =>
        set((state) => {
            const next = [...state.paintLayerColors] as [
                string,
                string,
                string,
                string,
            ];
            next[layer] = color;
            return { paintLayerColors: next };
        }),
    flattenTargetHeight: 0,
    setFlattenTargetHeight: (h) => set({ flattenTargetHeight: h }),
    sculptMaxHeight: 120,
    setSculptMaxHeight: (h) => set({ sculptMaxHeight: h }),
    terrainWireframe: false,
    setTerrainWireframe: (terrainWireframe) => set({ terrainWireframe }),
});
