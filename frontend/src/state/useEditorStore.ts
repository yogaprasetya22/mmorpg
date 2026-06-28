import { create } from "zustand";
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import { useStore } from "./useStore";
import { API_BASE_URL } from "@/src/core/config";

export interface MapItem {
    id: string;
    type: string;
    path: string;
    pos: [number, number, number];
    rot: [number, number, number];
    sca: [number, number, number];
    color?: string;
}

import {
    FULL_ASSET_LIBRARY,
    AssetInfo,
    setAssetLibrary,
} from "@/src/core/logic/environment/assetRegistry";

export function sanitizeAssetPath(path: string): string {
    let cleanPath = path;
    if (cleanPath.startsWith(API_BASE_URL)) {
        cleanPath = cleanPath.slice(API_BASE_URL.length);
    }

    const fileName = cleanPath.split("/").pop() || "";
    const nameLower = fileName.toLowerCase();

    // 1. Rocks
    if (
        nameLower.includes("rock") ||
        nameLower.includes("pebble") ||
        nameLower.includes("stone") ||
        nameLower.includes("boulder") ||
        nameLower.includes("cliff")
    ) {
        const rockFiles = [
            "RockPath_Square_Thin.glb",
            "RockPath_Round_Thin.glb",
            "Rock_Medium_3.glb",
            "Pebble_Square_1.glb",
            "Rock_Medium_1.glb",
            "Pebble_Round_2.glb",
            "Pebble_Round_5.glb",
            "RockPath_Round_Small_3.glb",
            "Pebble_Square_3.glb",
            "RockPath_Round_Small_1.glb",
            "Pebble_Round_4.glb",
            "Pebble_Round_3.glb",
            "Pebble_Square_2.glb",
            "RockPath_Square_Small_3.glb",
            "Pebble_Square_6.glb",
            "Pebble_Square_5.glb",
            "RockPath_Round_Wide.glb",
            "RockPath_Square_Small_1.glb",
            "RockPath_Square_Small_2.glb",
            "RockPath_Square_Wide.glb",
            "Pebble_Square_4.glb",
            "Rock_Medium_2.glb",
            "Pebble_Round_1.glb",
            "RockPath_Round_Small_2.glb",
        ];
        const matchedFile = rockFiles.find(
            (f) =>
                f.toLowerCase() === nameLower ||
                nameLower.startsWith(f.toLowerCase().replace(".glb", "")),
        );
        if (matchedFile) {
            return `${API_BASE_URL}/assets/environment/rocks/${matchedFile}`;
        }
        return `${API_BASE_URL}/assets/environment/rocks/Rock_Medium_1.glb`;
    }

    // 2. Trees
    if (
        nameLower.includes("tree") ||
        nameLower.includes("birch") ||
        nameLower.includes("pine") ||
        nameLower.includes("maple") ||
        nameLower.includes("dead") ||
        nameLower.includes("twisted")
    ) {
        const treeFiles = [
            "Pine_5.glb",
            "DeadTree_3.glb",
            "BirchTree_4.glb",
            "DeadTree_1.glb",
            "CommonTree_5.glb",
            "DeadTree_7.glb",
            "CommonTree_1.glb",
            "DeadTree_5.glb",
            "MapleTree_5.glb",
            "Pine_1.glb",
            "DeadTree_8.glb",
            "BirchTree_3.glb",
            "DeadTree_9.glb",
            "CommonTree_4.glb",
            "DeadTree_4.glb",
            "BirchTree_5.glb",
            "TwistedTree_4.glb",
            "MapleTree_2.glb",
            "MapleTree_1.glb",
            "DeadTree_2.glb",
            "DeadTree_6.glb",
            "BirchTree_1.glb",
            "TwistedTree_3.glb",
            "Pine_4.glb",
            "CommonTree_3.glb",
            "MapleTree_4.glb",
            "CommonTree_2.glb",
            "DeadTree_10.glb",
            "Pine_3.glb",
            "BirchTree_2.glb",
            "MapleTree_3.glb",
            "Pine_2.glb",
            "TwistedTree_5.glb",
            "TwistedTree_2.glb",
            "TwistedTree_1.glb",
        ];
        const matchedFile = treeFiles.find(
            (f) =>
                f.toLowerCase() === nameLower ||
                nameLower.startsWith(f.toLowerCase().replace(".glb", "")),
        );
        if (matchedFile) {
            return `${API_BASE_URL}/assets/environment/trees/${matchedFile}`;
        }
        return `${API_BASE_URL}/assets/environment/trees/Pine_1.glb`;
    }

    // 3. Vegetation
    if (
        nameLower.includes("bush") ||
        nameLower.includes("flower") ||
        nameLower.includes("grass") ||
        nameLower.includes("fern") ||
        nameLower.includes("mushroom") ||
        nameLower.includes("clover") ||
        nameLower.includes("plant") ||
        nameLower.includes("petal")
    ) {
        const vegFiles = [
            "Bush_Flowers.glb",
            "Petal_3.glb",
            "Bush_Common.glb",
            "Fern_1.glb",
            "Flower_1.glb",
            "Plant_1.glb",
            "Bush_Small.glb",
            "Mushroom_Laetiporus.glb",
            "Petal_5.glb",
            "Petal_1.glb",
            "Flower_1_Clump.glb",
            "Flower_4_Single.glb",
            "Flower_3_Single.glb",
            "Grass_Large.glb",
            "Mushroom_Common.glb",
            "Flower_2_Clump.glb",
            "Plant_1_Big.glb",
            "Grass_Wispy_Short.glb",
            "Plant_7.glb",
            "Grass_Common_Short.glb",
            "Flower_5_Clump.glb",
            "Bush_Small_Flowers.glb",
            "Clover_2.glb",
            "Flower_4_Clump.glb",
            "Bush_Common_Flowers.glb",
            "Grass_Wispy_Tall.glb",
            "Clover_1.glb",
            "Grass_Common_Tall.glb",
            "Bush_Large.glb",
            "Petal_4.glb",
            "Plant_7_Big.glb",
            "Grass_Large_Extruded.glb",
            "Grass_Small.glb",
            "Flower_4_Group.glb",
            "Flower_2.glb",
            "Flower_3_Clump.glb",
            "Petal_2.glb",
            "Bush_Large_Flowers.glb",
            "Flower_3_Group.glb",
            "Bush.glb",
        ];
        const matchedFile = vegFiles.find(
            (f) =>
                f.toLowerCase() === nameLower ||
                nameLower.startsWith(f.toLowerCase().replace(".glb", "")),
        );
        if (matchedFile) {
            return `${API_BASE_URL}/assets/environment/vegetation/${matchedFile}`;
        }
        return `${API_BASE_URL}/assets/environment/vegetation/Bush.glb`;
    }

    // 4. Characters
    if (
        nameLower.includes("soldier") ||
        nameLower.includes("npc") ||
        nameLower.includes("chef") ||
        nameLower.includes("casual") ||
        nameLower.includes("cow") ||
        nameLower.includes("female") ||
        nameLower.includes("male") ||
        nameLower.includes("ninja") ||
        nameLower.includes("viking") ||
        nameLower.includes("worker") ||
        nameLower.includes("knight") ||
        nameLower.includes("wizard") ||
        nameLower.includes("witch") ||
        nameLower.includes("elf") ||
        nameLower.includes("goblin") ||
        nameLower.includes("pug") ||
        nameLower.includes("doctor") ||
        nameLower.includes("pirate") ||
        nameLower.includes("zombie")
    ) {
        const charFiles = [
            "Cowboy_Female.glb",
            "BlueSoldier_Female.glb",
            "Suit_Male.glb",
            "Ninja_Male_Hair.glb",
            "Pirate_Female.glb",
            "Doctor_Female_Young.glb",
            "Soldier_Female.glb",
            "BlueSoldier_Male.glb",
            "Viking_Female.glb",
            "Zombie_Female.glb",
            "Worker_Female.glb",
            "Pirate_Male.glb",
            "Knight_Golden_Male.glb",
            "Casual3_Male.glb",
            "Casual_Bald.glb",
            "Suit_Female.glb",
            "Ninja_Sand.glb",
            "Casual_Male.glb",
            "Viking_Male.glb",
            "Casual2_Female.glb",
            "Casual_Female.glb",
            "Wizard.glb",
            "Kimono_Male.glb",
            "Doctor_Female_Old.glb",
            "Ninja_Male.glb",
            "Cowboy_Male.glb",
            "Doctor_Male_Old.glb",
            "Soldier_Male.glb",
            "Elf.glb",
            "tower_2.glb",
            "Doctor_Male_Young.glb",
            "Casual3_Female.glb",
            "Ninja_Female.glb",
            "Worker_Male.glb",
            "Zombie_Male.glb",
            "Knight_Male.glb",
            "Cow.glb",
            "Casual2_Male.glb",
            "Pug.glb",
            "Chef_Male.glb",
            "Chef_Female.glb",
            "Chef_Hat.glb",
            "Chef_Male-processed.glb",
            "OldClassy_Female.glb",
            "Goblin_Male.glb",
            "tower.glb",
            "Witch.glb",
            "Knight_Golden_Female.glb",
            "OldClassy_Male.glb",
            "Ninja_Sand_Female.glb",
            "Kimono_Female.glb",
        ];
        const matchedFile = charFiles.find(
            (f) =>
                f.toLowerCase() === nameLower ||
                nameLower.startsWith(f.toLowerCase().replace(".glb", "")),
        );
        if (matchedFile) {
            return `${API_BASE_URL}/assets/characters/npcs/${matchedFile}`;
        }
        return `${API_BASE_URL}/assets/characters/npcs/Soldier_Male.glb`;
    }

    // 5. Default heuristic for any other paths/structures
    if (nameLower.includes("tree")) {
        return `${API_BASE_URL}/assets/environment/trees/Pine_1.glb`;
    }
    return `${API_BASE_URL}/assets/environment/rocks/Rock_Medium_1.glb`;
}

// ─── Per-tool brush profile (each sculpt/paint tool remembers its own settings) ───
export type BrushMaskId =
    | "softCircle"
    | "hardCircle"
    | "star"
    | "hexagon"
    | "starOutline"
    | "square";

export interface BrushProfile {
    size: number;
    strength: number;
    maskId: BrushMaskId;
}

export type ToolBrushProfiles = Record<string, BrushProfile>;

const DEFAULT_BRUSH_PROFILES: ToolBrushProfiles = {
    raise: { size: 12, strength: 0.25, maskId: "softCircle" },
    lower: { size: 12, strength: 0.25, maskId: "softCircle" },
    smooth: { size: 20, strength: 0.35, maskId: "softCircle" },
    flatten: { size: 25, strength: 0.5, maskId: "hardCircle" },
    paint: { size: 10, strength: 0.25, maskId: "softCircle" },
};

export interface EditorState {
    isEditorOpen: boolean;
    setIsEditorOpen: (open: boolean) => void;

    items: MapItem[];
    setItems: (items: MapItem[]) => void;

    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    selectedIds: string[];
    setSelectedIds: (ids: string[]) => void;
    toggleSelectedId: (id: string) => void;

    mode: "translate" | "rotate" | "scale";
    setMode: (mode: "translate" | "rotate" | "scale") => void;

    activeAsset: AssetInfo | null;
    setActiveAsset: (asset: AssetInfo | null) => void;

    history: MapItem[][];
    historyIndex: number;

    // Actions
    updateItemsWithHistory: (
        newItems: MapItem[] | ((prev: MapItem[]) => MapItem[]),
    ) => void;
    undo: () => void;
    redo: () => void;

    // Helpers
    loadFromStorage: () => void;
    saveToStorage: () => void;
    saveToDatabase: () => Promise<void>;
    loadFromDatabase: () => Promise<void>;

    // Multi-Map Persist States
    selectedMapId: string;
    setSelectedMapId: (mapId: string) => Promise<void>;
    mapList: { id: string; name: string; updated_at: string }[];
    fetchMapList: () => Promise<void>;
    createNewMap: (mapId: string) => Promise<void>;
    deleteActiveMap: () => Promise<void>;
    deleteMap: (mapId: string) => Promise<void>;

    // Dynamic Asset States
    dynamicAssets: AssetInfo[];
    fetchDynamicAssets: () => Promise<void>;

    gridSize: number;
    setGridSize: (size: number) => void;
    gridEnabled: boolean;
    setGridEnabled: (enabled: boolean) => void;

    terrainConfig: {
        height: number;
        scale: number;
        seed: number;
        sharpness: number;
    };
    setTerrainConfig: (config: Partial<EditorState["terrainConfig"]>) => void;

    terrainMaterialId: string | null;
    setTerrainMaterialId: (id: string | null) => void;

    terrainColor: string;
    setTerrainColor: (color: string) => void;

    sky: string;
    setSky: (sky: string) => void;

    environment: string;
    setEnvironment: (env: string) => void;

    lightIntensity: number | null;
    setLightIntensity: (intensity: number | null) => void;
    ambientIntensity: number | null;
    setAmbientIntensity: (intensity: number | null) => void;
    sunAngle: number;
    setSunAngle: (angle: number) => void;
    fogDensity: number;
    setFogDensity: (density: number) => void;

    skyboxIntensity: number | null;
    setSkyboxIntensity: (intensity: number | null) => void;

    bloomThreshold: number | null;
    setBloomThreshold: (threshold: number | null) => void;
    bloomStrength: number | null;
    setBloomStrength: (strength: number | null) => void;
    bloomRadius: number | null;
    setBloomRadius: (radius: number | null) => void;

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
    sculptTool: "raise" | "lower" | "smooth" | "flatten";
    setSculptTool: (tool: "raise" | "lower" | "smooth" | "flatten") => void;
    sculptData: string | null;
    setSculptData: (data: string | null) => void;

    brushStrength: number;
    setBrushStrength: (strength: number) => void;
    brushRotation: number;
    setBrushRotation: (rotation: number) => void;
    brushMaskId: BrushMaskId;
    setBrushMaskId: (maskId: BrushMaskId) => void;

    // Per-tool brush profiles: each tool remembers its own size/strength/mask
    toolBrushProfiles: ToolBrushProfiles;
    activeToolKey: string;

    brushHoverPos: [number, number, number] | null;
    setBrushHoverPos: (pos: [number, number, number] | null) => void;

    lastUsedScales: Record<string, [number, number, number]>;
    setLastUsedScale: (
        assetPath: string,
        scale: [number, number, number],
    ) => void;
    lastUsedRotations: Record<string, [number, number, number]>;
    setLastUsedRotation: (
        assetPath: string,
        rotation: [number, number, number],
    ) => void;

    // Procedural Vegetation Generator States/Actions
    vegetationTheme:
        | "pine"
        | "cherry"
        | "autumn"
        | "desert"
        | "clover"
        | "grass";
    setVegetationTheme: (
        theme: "pine" | "cherry" | "autumn" | "desert" | "clover" | "grass",
    ) => void;
    vegetationDensity: number;
    setVegetationDensity: (density: number) => void;
    generateVegetation: () => void;
    clearVegetation: () => void;

    cameraFocusTarget: [number, number, number] | null;
    setCameraFocusTarget: (target: [number, number, number] | null) => void;
    cameraFocusObjectId: string | null;
    setCameraFocusObjectId: (id: string | null) => void;
    vegetationBrushActive: boolean;
    setVegetationBrushActive: (active: boolean) => void;
    vegetationSingleAsset: string | null; // null = random from theme, path = fixed GLB
    setVegetationSingleAsset: (path: string | null) => void;
    vegetationFixedScale: number;
    setVegetationFixedScale: (scale: number) => void;
    vegetationRadius: number;
    setVegetationRadius: (r: number) => void;

    isSaving: boolean;
    setIsSaving: (saving: boolean) => void;

    // Multi-layer Splat Paint (4 RGBA channels)
    activePaintLayer: 0 | 1 | 2 | 3;
    setActivePaintLayer: (layer: 0 | 1 | 2 | 3) => void;
    paintLayerMaterials: [
        string | null,
        string | null,
        string | null,
        string | null,
    ];
    setPaintLayerMaterial: (layer: number, matId: string | null) => void;
    paintLayerColors: [string, string, string, string];
    setPaintLayerColor: (layer: number, color: string) => void;

    // Flatten to exact height
    flattenTargetHeight: number;
    setFlattenTargetHeight: (h: number) => void;

    // Custom Paint Blueprint Library (Paralives Feature)
    savedPaintBlueprints: CustomPaintBlueprint[];
    activePaintBlueprintId: string | null;
    createPaintBlueprint: (
        name: string,
        config: Omit<CustomPaintBlueprint, "id" | "name">,
    ) => void;
    deletePaintBlueprint: (id: string) => void;
    applyPaintBlueprint: (id: string) => void;
}

export interface CustomPaintBlueprint {
    id: string;
    name: string;
    maskType:
        | "softCircle"
        | "hardCircle"
        | "star"
        | "hexagon"
        | "starOutline"
        | "square";
    textureId: string | null;
    brushColor: string;
    defaultSize: number;
    defaultIntensity: number;
}

export const ASSET_LIBRARY = FULL_ASSET_LIBRARY;

/**
 * Validates that a canvas data string is a proper base64 data URL.
 * Rejects JSON objects that were accidentally stored in the old layer-based format.
 * This prevents THREE.js from using an invalid JSON string as a URL path (causing 404 errors).
 */
const sanitizeCanvasData = (data: string | null | undefined): string | null => {
    if (!data || typeof data !== "string") return null;
    const trimmed = data.trim();

    if (trimmed.startsWith("data:image/")) {
        return trimmed;
    }

    // Try to recover the composite image if the data is stored in the old JSON format
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === "object") {
                const composite = parsed.composite;
                if (
                    typeof composite === "string" &&
                    composite.startsWith("data:image/")
                ) {
                    console.log(
                        "[EditorStore] Successfully recovered composite canvas data from legacy JSON format.",
                    );
                    return composite;
                }
            }
        } catch (e) {
            // Ignored, proceed to fallback warning
        }
    }

    console.warn(
        "[EditorStore] Invalid canvas data format detected and discarded (expected data URL, got:",
        trimmed.slice(0, 80),
        "...). Clearing.",
    );
    return null;
};

let saveTimeout: any = null;
const debouncedSave = () => {
    if (typeof window === "undefined") return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        const state = useEditorStore.getState();
        try {
            localStorage.setItem(
                "world_editor_map",
                JSON.stringify(state.items),
            );
            localStorage.setItem(
                "world_editor_settings",
                JSON.stringify({
                    gridSize: state.gridSize,
                    gridEnabled: state.gridEnabled,
                    terrainConfig: state.terrainConfig,
                    terrainMaterialId: state.terrainMaterialId,
                    terrainColor: state.terrainColor,
                    sky: state.sky,
                    environment: state.environment,
                    lightIntensity: state.lightIntensity,
                    ambientIntensity: state.ambientIntensity,
                    sunAngle: state.sunAngle,
                    fogDensity: state.fogDensity,
                    lastUsedScales: state.lastUsedScales,
                    lastUsedRotations: state.lastUsedRotations,
                    brushTextureId: state.brushTextureId,
                    savedPaintBlueprints: state.savedPaintBlueprints,
                    skyboxIntensity: state.skyboxIntensity,
                    bloomThreshold: state.bloomThreshold,
                    bloomStrength: state.bloomStrength,
                    bloomRadius: state.bloomRadius,
                }),
            );
            if (state.paintData) {
                localStorage.setItem("world_editor_paint", state.paintData);
            }
            if (state.sculptData) {
                localStorage.setItem("world_editor_sculpt", state.sculptData);
            }
        } catch (e) {
            console.warn("Local storage is full!", e);
        }
    }, 1000);
};

export const useEditorStore = create<EditorState>((set, get) => ({
    isEditorOpen: false,
    setIsEditorOpen: (open) => set({ isEditorOpen: open }),
    isSaving: false,
    setIsSaving: (saving) => set({ isSaving: saving }),

    lastUsedScales: {},
    setLastUsedScale: (assetPath, scale) =>
        set((state) => {
            const next = { ...state.lastUsedScales, [assetPath]: scale };
            debouncedSave();
            return { lastUsedScales: next };
        }),
    lastUsedRotations: {},
    setLastUsedRotation: (assetPath, rotation) =>
        set((state) => {
            const next = { ...state.lastUsedRotations, [assetPath]: rotation };
            debouncedSave();
            return { lastUsedRotations: next };
        }),

    items: [],
    setItems: (items) => set({ items }),

    selectedId: null,
    setSelectedId: (id) =>
        set((state) => {
            const isTerrain = id === "terrain";
            return {
                selectedId: id,
                selectedIds: id ? [id] : [],
                paintMode: isTerrain ? state.paintMode : false,
            };
        }),
    selectedIds: [],
    setSelectedIds: (ids) =>
        set((state) => {
            const newSelectedId = ids.length > 0 ? ids[ids.length - 1] : null;
            const isTerrain = newSelectedId === "terrain";
            return {
                selectedIds: ids,
                selectedId: newSelectedId,
                paintMode: isTerrain ? state.paintMode : false,
            };
        }),
    toggleSelectedId: (id) =>
        set((state) => {
            const isSelected = state.selectedIds.includes(id);
            const newIds = isSelected
                ? state.selectedIds.filter((x) => x !== id)
                : [...state.selectedIds, id];
            const newSelectedId =
                newIds.length > 0 ? newIds[newIds.length - 1] : null;
            const isTerrain = newSelectedId === "terrain";
            return {
                selectedIds: newIds,
                selectedId: newSelectedId,
                paintMode: isTerrain ? state.paintMode : false,
            };
        }),

    mode: "translate",
    setMode: (mode) => set({ mode }),

    activeAsset: null,
    setActiveAsset: (asset) =>
        set((state) => {
            const isDeactivating = state.activeAsset?.path === asset?.path;
            const nextActiveAsset = isDeactivating ? null : asset;
            if (nextActiveAsset) {
                // Entering Placement Mode: Clear active selection and terrain painting
                return {
                    activeAsset: nextActiveAsset,
                    selectedId: null,
                    selectedIds: [],
                    paintMode: false,
                };
            } else {
                return {
                    activeAsset: null,
                };
            }
        }),

    history: [],
    historyIndex: -1,

    updateItemsWithHistory: (newItems) => {
        console.log("=== [ZUSTAND STORE] updateItemsWithHistory CALLED ===");
        const { items, history, historyIndex } = get();
        const updated =
            typeof newItems === "function" ? newItems(items) : newItems;
        console.log("Previous items count in store:", items.length);
        console.log("Next items count to set:", updated.length);

        const nextH = history.slice(0, historyIndex + 1);
        const newHistory = [...nextH, updated].slice(-50);

        set({
            items: updated,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        });
        console.log(
            "After set(), items count in store is now:",
            get().items.length,
        );

        debouncedSave();
    },

    undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
            const prevItems = history[historyIndex - 1];
            set({
                items: prevItems,
                historyIndex: historyIndex - 1,
                selectedId: null,
                selectedIds: [],
            });
        }
    },

    redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
            const nextItems = history[historyIndex + 1];
            set({
                items: nextItems,
                historyIndex: historyIndex + 1,
                selectedId: null,
                selectedIds: [],
            });
        }
    },

    loadFromStorage: () => {
        const saved = localStorage.getItem("world_editor_map");
        const settings = localStorage.getItem("world_editor_settings");

        if (settings) {
            try {
                const parsed = JSON.parse(settings);
                const loadedConfig = {
                    height: 12.0,
                    scale: 0.05,
                    seed: 0,
                    sharpness: 2.0,
                    ...parsed.terrainConfig,
                };
                set({
                    gridSize: parsed.gridSize,
                    gridEnabled: parsed.gridEnabled,
                    terrainConfig: loadedConfig,
                    terrainMaterialId: parsed.terrainMaterialId,
                    terrainColor: parsed.terrainColor || "#3d5c36",
                    sky: parsed.sky || "sunset",
                    environment: parsed.environment || "STORM",
                    lightIntensity:
                        parsed.lightIntensity !== undefined
                            ? parsed.lightIntensity
                            : null,
                    ambientIntensity:
                        parsed.ambientIntensity !== undefined
                            ? parsed.ambientIntensity
                            : null,
                    sunAngle:
                        parsed.sunAngle !== undefined ? parsed.sunAngle : 45,
                    fogDensity:
                        parsed.fogDensity !== undefined
                            ? parsed.fogDensity
                            : 0.002,
                    lastUsedScales: parsed.lastUsedScales || {},
                    lastUsedRotations: parsed.lastUsedRotations || {},
                    brushTextureId: parsed.brushTextureId || null,
                    savedPaintBlueprints: parsed.savedPaintBlueprints || [],
                    skyboxIntensity:
                        parsed.skyboxIntensity !== undefined
                            ? parsed.skyboxIntensity
                            : null,
                    bloomThreshold:
                        parsed.bloomThreshold !== undefined
                            ? parsed.bloomThreshold
                            : null,
                    bloomStrength:
                        parsed.bloomStrength !== undefined
                            ? parsed.bloomStrength
                            : null,
                    bloomRadius:
                        parsed.bloomRadius !== undefined
                            ? parsed.bloomRadius
                            : null,
                });
            } catch (e) {}
        }

        if (saved) {
            try {
                const parsed = JSON.parse(saved) as MapItem[];

                // Path Sanitization (Fix legacy paths from local storage)
                const sanitized = parsed.map((item) => ({
                    ...item,
                    path: sanitizeAssetPath(item.path),
                }));

                set({
                    items: sanitized,
                    history: [sanitized],
                    historyIndex: 0,
                });
            } catch (e) {
                console.error("Failed to load map", e);
            }
        }

        const paint = sanitizeCanvasData(
            localStorage.getItem("world_editor_paint"),
        );
        if (paint) set({ paintData: paint });
        const sculpt = sanitizeCanvasData(
            localStorage.getItem("world_editor_sculpt"),
        );
        if (sculpt) set({ sculptData: sculpt });
    },

    saveToStorage: () => {
        const {
            items,
            gridSize,
            gridEnabled,
            terrainConfig,
            terrainMaterialId,
            terrainColor,
            sky,
            environment,
            paintData,
            sculptData,
            lightIntensity,
            ambientIntensity,
            sunAngle,
            fogDensity,
            lastUsedScales,
            lastUsedRotations,
            brushTextureId,
            savedPaintBlueprints,
            skyboxIntensity,
            bloomThreshold,
            bloomStrength,
            bloomRadius,
        } = get();
        try {
            localStorage.setItem("world_editor_map", JSON.stringify(items));
            localStorage.setItem(
                "world_editor_settings",
                JSON.stringify({
                    gridSize,
                    gridEnabled,
                    terrainConfig,
                    terrainMaterialId,
                    terrainColor,
                    sky,
                    environment,
                    lightIntensity,
                    ambientIntensity,
                    sunAngle,
                    fogDensity,
                    lastUsedScales,
                    lastUsedRotations,
                    brushTextureId,
                    savedPaintBlueprints,
                    skyboxIntensity,
                    bloomThreshold,
                    bloomStrength,
                    bloomRadius,
                }),
            );
            if (paintData)
                localStorage.setItem("world_editor_paint", paintData);
            if (sculptData)
                localStorage.setItem("world_editor_sculpt", sculptData);
        } catch (e) {
            console.warn(
                "Local storage is full! Use saveToDatabase() to persist your changes.",
                e,
            );
        }
    },

    selectedMapId: "Starter Zone",
    setSelectedMapId: async (mapId) => {
        set({ selectedMapId: mapId });
        await get().loadFromDatabase();

        // Sync the active map selection to the database global simulation settings
        try {
            const resSettings = await fetch(
                `${API_BASE_URL}/api/config/settings`,
            );
            let dataSettings = {};
            if (resSettings.ok) {
                dataSettings = await resSettings.json();
            }
            const updated = {
                ...dataSettings,
                activeMapId: mapId,
            };
            const token =
                typeof window !== "undefined"
                    ? localStorage.getItem("game_auth_token")
                    : "";
            await fetch(`${API_BASE_URL}/api/config/settings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify(updated),
            });
            console.log(`Global activeMapId synced to: ${mapId}`);
        } catch (e) {
            console.warn("Failed to sync global activeMapId to database:", e);
        }
    },
    mapList: [],
    fetchMapList: async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/world-editor/maps`);
            if (res.ok) {
                const list = await res.json();
                set({ mapList: list });
            }
        } catch (e) {
            console.error("Failed to fetch map list", e);
        }
    },
    createNewMap: async (mapId) => {
        set({
            selectedMapId: mapId,
            items: [],
            paintData: null,
            sculptData: null,
            history: [[]],
            historyIndex: 0,
        });
        await get().saveToDatabase();
        await get().fetchMapList();

        // Sync the active map selection to the database global simulation settings
        try {
            const resSettings = await fetch(
                `${API_BASE_URL}/api/config/settings`,
            );
            let dataSettings = {};
            if (resSettings.ok) {
                dataSettings = await resSettings.json();
            }
            const updated = {
                ...dataSettings,
                activeMapId: mapId,
            };
            const token =
                typeof window !== "undefined"
                    ? localStorage.getItem("game_auth_token")
                    : "";
            await fetch(`${API_BASE_URL}/api/config/settings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify(updated),
            });
            console.log(`Global activeMapId synced to: ${mapId}`);
        } catch (e) {
            console.warn("Failed to sync global activeMapId to database:", e);
        }
    },
    deleteMap: async (mapId: string) => {
        if (
            !confirm(
                `Apakah Anda yakin ingin menghapus peta "${mapId}" secara permanen? Tindakan ini tidak dapat dibatalkan.`,
            )
        ) {
            return;
        }

        try {
            const token =
                typeof window !== "undefined"
                    ? localStorage.getItem("game_auth_token")
                    : "";
            const res = await fetch(
                `${API_BASE_URL}/api/world-editor/delete?map_id=${encodeURIComponent(mapId)}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                },
            );

            if (res.ok) {
                alert("Peta berhasil dihapus!");

                // Fetch map list first to see what's remaining
                await get().fetchMapList();

                // Reset active map selection back to first available map and sync with backend
                if (get().selectedMapId === mapId) {
                    const remaining = get().mapList;
                    if (remaining.length > 0) {
                        await get().setSelectedMapId(remaining[0].id);
                    }
                }
            } else {
                const data = await res.json();
                alert(`Gagal menghapus peta: ${data.error || "Unknown Error"}`);
            }
        } catch (e) {
            console.error("Error deleting map:", e);
            alert("Terjadi kesalahan saat menghapus peta!");
        }
    },
    deleteActiveMap: async () => {
        await get().deleteMap(get().selectedMapId);
    },

    dynamicAssets: [],
    fetchDynamicAssets: async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/config/assets`);
            if (res.ok) {
                const assets: {
                    name: string;
                    path: string;
                    category?: string;
                }[] = await res.json();
                const mapped: AssetInfo[] = assets.map((item) => {
                    let category: any = "rocks";

                    if (item.category) {
                        category = item.category;
                    } else {
                        // Fallback heuristics for custom or empty backend categories
                        const lowerPath = item.path.toLowerCase();
                        if (lowerPath.includes("/environment/trees/")) {
                            category = "trees";
                        } else if (
                            lowerPath.includes("/environment/vegetation/")
                        ) {
                            category = "vegetation";
                        } else if (lowerPath.includes("/environment/rocks/")) {
                            category = "rocks";
                        } else if (
                            lowerPath.includes("/environment/characters/")
                        ) {
                            category = "characters";
                        }
                    }

                    const path = `${API_BASE_URL}${item.path}`;
                    const name = item.name
                        .replace(/\.[^/.]+$/, "")
                        .replace(/[-_]/g, " ");

                    return {
                        name,
                        path,
                        category,
                    };
                });
                set({ dynamicAssets: mapped });
                setAssetLibrary(mapped);
            }
        } catch (e) {
            console.error("Failed to fetch dynamic assets", e);
        }
    },

    saveToDatabase: async () => {
        const {
            selectedMapId,
            items,
            gridSize,
            gridEnabled,
            terrainConfig,
            terrainMaterialId,
            terrainColor,
            sky,
            environment,
            paintData,
            sculptData,
            lightIntensity,
            ambientIntensity,
            sunAngle,
            fogDensity,
            brushTextureId,
            skyboxIntensity,
            bloomThreshold,
            bloomStrength,
            bloomRadius,
        } = get();

        // Map IDs to specific high-quality PBR PNG filenames for database compatibility
        let savedMaterialId = terrainMaterialId;
        if (terrainMaterialId === "texture_2") {
            savedMaterialId = "rocky_terrain_02_nor_gl_1k.png";
        } else if (terrainMaterialId === "texture_1") {
            savedMaterialId = "marble_cliff_03_nor_gl_1k.png";
        }

        let savedBrushTextureId = brushTextureId;
        if (brushTextureId === "texture_2") {
            savedBrushTextureId = "rocky_terrain_02_nor_gl_1k.png";
        } else if (brushTextureId === "texture_1") {
            savedBrushTextureId = "marble_cliff_03_nor_gl_1k.png";
        }

        // Set saving active to display the transparent spinner overlay
        set({ isSaving: true });

        // Sanitize item paths to ensure we don't save full URL prefixes to database redundantly
        const sanitizedToSave = items.map((item) => {
            let path = item.path;
            if (path.startsWith("http://localhost:8080/")) {
                path = path.replace("http://localhost:8080", "");
            }
            if (path.startsWith(API_BASE_URL + "/")) {
                path = path.replace(API_BASE_URL, "");
            }
            return { ...item, path };
        });

        const payload = {
            map_id: selectedMapId,
            items: sanitizedToSave,
            settings: {
                gridSize,
                gridEnabled,
                terrainConfig,
                terrainMaterialId: savedMaterialId,
                terrainColor,
                sky,
                environment,
                lightIntensity,
                ambientIntensity,
                sunAngle,
                fogDensity,
                brushTextureId: savedBrushTextureId,
                savedPaintBlueprints: get().savedPaintBlueprints,
                skyboxIntensity,
                bloomThreshold,
                bloomStrength,
                bloomRadius,
            },
            paintData,
            sculptData,
        };

        try {
            const token =
                typeof window !== "undefined"
                    ? localStorage.getItem("game_auth_token")
                    : "";
            const res = await fetch(
                `${API_BASE_URL}/api/world-editor/save?map_id=${encodeURIComponent(selectedMapId)}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                    body: JSON.stringify(payload),
                },
            );
            if (res.ok) {
                console.log(`Map '${selectedMapId}' synced to database!`);
                get().fetchMapList();
            }
        } catch (e) {
            console.error("Failed to sync map to database", e);
        } finally {
            // Deactivate saving overlay after transmission completes
            setTimeout(() => {
                set({ isSaving: false });
            }, 500); // smooth UX fadeout
        }
    },

    loadFromDatabase: async () => {
        const { selectedMapId } = get();
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/world-editor/load?map_id=${encodeURIComponent(selectedMapId)}`,
            );
            if (res.ok) {
                const data = await res.json();

                const sanitizedItems = (data.items || []).map((item: any) => ({
                    ...item,
                    path: sanitizeAssetPath(item.path),
                }));

                const loadedEnv = data.settings?.environment ?? "STORM";
                useStore.getState().setEnvironment(loadedEnv as any);

                // Reconstruct friendly material IDs from backend PBR EXR paths
                let loadedMaterialId = data.settings?.terrainMaterialId ?? null;
                if (
                    loadedMaterialId &&
                    (loadedMaterialId.includes("rocky_terrain") ||
                        loadedMaterialId === "texture_2")
                ) {
                    loadedMaterialId = "texture_2";
                } else if (
                    loadedMaterialId &&
                    (loadedMaterialId.includes("marble_cliff") ||
                        loadedMaterialId === "texture_1")
                ) {
                    loadedMaterialId = "texture_1";
                }

                let loadedBrushTextureId =
                    data.settings?.brushTextureId ?? null;
                if (
                    loadedBrushTextureId &&
                    (loadedBrushTextureId.includes("rocky_terrain") ||
                        loadedBrushTextureId === "texture_2")
                ) {
                    loadedBrushTextureId = "texture_2";
                } else if (
                    loadedBrushTextureId &&
                    (loadedBrushTextureId.includes("marble_cliff") ||
                        loadedBrushTextureId === "texture_1")
                ) {
                    loadedBrushTextureId = "texture_1";
                }

                set({
                    items: sanitizedItems,
                    gridSize: data.settings?.gridSize ?? 1.0,
                    gridEnabled: data.settings?.gridEnabled ?? true,
                    terrainConfig: {
                        height: 12.0,
                        scale: 0.05,
                        seed: 0,
                        sharpness: 2.0,
                        ...(data.settings?.terrainConfig || {}),
                    },
                    terrainMaterialId: loadedMaterialId,
                    terrainColor: data.settings?.terrainColor ?? "#3d5c36",
                    sky: data.settings?.sky ?? "sunset",
                    environment: loadedEnv,
                    lightIntensity:
                        data.settings?.lightIntensity !== undefined
                            ? data.settings?.lightIntensity
                            : null,
                    ambientIntensity:
                        data.settings?.ambientIntensity !== undefined
                            ? data.settings?.ambientIntensity
                            : null,
                    sunAngle:
                        data.settings?.sunAngle !== undefined
                            ? data.settings?.sunAngle
                            : 45,
                    fogDensity:
                        data.settings?.fogDensity !== undefined
                            ? data.settings?.fogDensity
                            : 0.002,
                    paintData: sanitizeCanvasData(data.paintData) || null,
                    sculptData: sanitizeCanvasData(data.sculptData) || null,
                    brushTextureId: loadedBrushTextureId,
                    savedPaintBlueprints:
                        data.settings?.savedPaintBlueprints || [],
                    skyboxIntensity:
                        data.settings?.skyboxIntensity !== undefined
                            ? data.settings?.skyboxIntensity
                            : null,
                    bloomThreshold:
                        data.settings?.bloomThreshold !== undefined
                            ? data.settings?.bloomThreshold
                            : null,
                    bloomStrength:
                        data.settings?.bloomStrength !== undefined
                            ? data.settings?.bloomStrength
                            : null,
                    bloomRadius:
                        data.settings?.bloomRadius !== undefined
                            ? data.settings?.bloomRadius
                            : null,
                    history: [sanitizedItems],
                    historyIndex: 0,
                });
            }
        } catch (e) {
            console.error("Failed to load map from database", e);
        }
    },

    gridSize: 1,
    setGridSize: (gridSize) => {
        set({ gridSize });
        debouncedSave();
    },
    gridEnabled: true,
    setGridEnabled: (gridEnabled) => {
        set({ gridEnabled });
        debouncedSave();
    },

    terrainConfig: {
        height: 12.0,
        scale: 0.05,
        seed: 0,
        sharpness: 2.0,
    },
    setTerrainConfig: (config) => {
        set((state) => ({
            terrainConfig: { ...state.terrainConfig, ...config },
        }));
        debouncedSave();
    },

    terrainMaterialId: null,
    setTerrainMaterialId: (id) => {
        set({ terrainMaterialId: id });
        debouncedSave();
    },

    terrainColor: "#3d5c36",
    setTerrainColor: (color) => {
        set({ terrainColor: color });
        debouncedSave();
    },

    sky: "sunset",
    setSky: (sky) => {
        set({ sky });
        debouncedSave();
    },

    environment: "STORM",
    setEnvironment: (environment) => {
        set({ environment });
        useStore.getState().setEnvironment(environment as any);
        debouncedSave();
    },

    lightIntensity: null,
    setLightIntensity: (lightIntensity) => {
        set({ lightIntensity });
        debouncedSave();
    },
    ambientIntensity: null,
    setAmbientIntensity: (ambientIntensity) => {
        set({ ambientIntensity });
        debouncedSave();
    },
    sunAngle: 45,
    setSunAngle: (sunAngle) => {
        set({ sunAngle });
        debouncedSave();
    },
    fogDensity: 0.002,
    setFogDensity: (fogDensity) => {
        set({ fogDensity });
        debouncedSave();
    },

    skyboxIntensity: null,
    setSkyboxIntensity: (skyboxIntensity) => {
        set({ skyboxIntensity });
        debouncedSave();
    },
    bloomThreshold: null,
    setBloomThreshold: (bloomThreshold) => {
        set({ bloomThreshold });
        debouncedSave();
    },
    bloomStrength: null,
    setBloomStrength: (bloomStrength) => {
        set({ bloomStrength });
        debouncedSave();
    },
    bloomRadius: null,
    setBloomRadius: (bloomRadius) => {
        set({ bloomRadius });
        debouncedSave();
    },

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
        set({ paintData });
        localStorage.setItem("world_editor_paint", paintData || "");
    },

    terrainMode: "paint",
    setTerrainMode: (newMode) => {
        const state = get();
        // Save current tool's brush profile before switching
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
        set({ sculptData });
        localStorage.setItem("world_editor_sculpt", sculptData || "");
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

    // Per-tool brush profiles
    toolBrushProfiles: DEFAULT_BRUSH_PROFILES,
    activeToolKey: "paint",

    brushHoverPos: null,
    setBrushHoverPos: (brushHoverPos) => set({ brushHoverPos }),

    savedPaintBlueprints: [],
    activePaintBlueprintId: null,

    createPaintBlueprint: (name, config) => {
        const newBlueprint = {
            ...config,
            id: "blueprint_" + Math.random().toString(36).substr(2, 9),
            name,
        };
        set((state) => {
            const next = [...state.savedPaintBlueprints, newBlueprint];
            return {
                savedPaintBlueprints: next,
                activePaintBlueprintId: newBlueprint.id,
            };
        });
        debouncedSave();
    },

    deletePaintBlueprint: (id) => {
        set((state) => {
            const next = state.savedPaintBlueprints.filter((b) => b.id !== id);
            const nextActiveId =
                state.activePaintBlueprintId === id
                    ? null
                    : state.activePaintBlueprintId;
            return {
                savedPaintBlueprints: next,
                activePaintBlueprintId: nextActiveId,
            };
        });
        debouncedSave();
    },

    applyPaintBlueprint: (id) => {
        const blueprint = get().savedPaintBlueprints.find((b) => b.id === id);
        if (blueprint) {
            set((s) => ({
                activePaintBlueprintId: id,
                brushMaskId: blueprint.maskType,
                brushTextureId: blueprint.textureId,
                brushColor: blueprint.brushColor,
                brushSize: blueprint.defaultSize,
                brushStrength: blueprint.defaultIntensity,
                // Also update the paint tool's profile so it remembers this blueprint's settings
                toolBrushProfiles: {
                    ...s.toolBrushProfiles,
                    paint: {
                        size: blueprint.defaultSize,
                        strength: blueprint.defaultIntensity,
                        maskId: blueprint.maskType,
                    },
                },
            }));
        }
    },

    // Procedural Vegetation Generator States/Actions
    vegetationTheme: "pine",
    setVegetationTheme: (theme) => {
        set({ vegetationTheme: theme });
    },
    vegetationDensity: 60,
    setVegetationDensity: (density) => {
        set({ vegetationDensity: density });
    },
    generateVegetation: () => {
        const { vegetationTheme, vegetationDensity, terrainConfig, items } =
            get();

        const themeAssets: Record<
            string,
            { paths: string[]; colors?: string[] }
        > = {
            pine: {
                paths: [
                    "/assets/environment/trees/BirchTree_1.glb",
                    "/assets/environment/trees/BirchTree_2.glb",
                    "/assets/environment/trees/BirchTree_3.glb",
                    "/assets/environment/trees/BirchTree_4.glb",
                    "/assets/environment/trees/BirchTree_5.glb",
                    "/assets/environment/vegetation/Grass_Small.glb",
                ],
            },
            cherry: {
                paths: [
                    "/assets/environment/trees/MapleTree_1.glb",
                    "/assets/environment/trees/MapleTree_2.glb",
                    "/assets/environment/trees/MapleTree_3.glb",
                    "/assets/environment/trees/MapleTree_4.glb",
                    "/assets/environment/trees/MapleTree_5.glb",
                ],
                colors: ["#fda4af", "#f472b6", "#ec4899", "#db2777"],
            },
            autumn: {
                paths: [
                    "/assets/environment/trees/MapleTree_1.glb",
                    "/assets/environment/trees/MapleTree_2.glb",
                    "/assets/environment/trees/MapleTree_3.glb",
                ],
                colors: ["#f59e0b", "#d97706", "#b45309", "#ea580c", "#ca8a04"],
            },
            desert: {
                paths: [
                    "/assets/environment/trees/DeadTree_1.glb",
                    "/assets/environment/trees/DeadTree_2.glb",
                    "/assets/environment/trees/DeadTree_3.glb",
                    "/assets/environment/trees/DeadTree_4.glb",
                    "/assets/environment/trees/DeadTree_5.glb",
                    "/assets/environment/trees/DeadTree_6.glb",
                    "/assets/environment/trees/DeadTree_7.glb",
                    "/assets/environment/trees/DeadTree_8.glb",
                    "/assets/environment/trees/DeadTree_9.glb",
                    "/assets/environment/trees/DeadTree_10.glb",
                ],
                colors: ["#a1a1aa", "#71717a", "#b45309", "#78350f"],
            },
            clover: {
                paths: [
                    "/assets/environment/vegetation/Bush.glb",
                    "/assets/environment/vegetation/Bush_Large.glb",
                    "/assets/environment/vegetation/Bush_Small.glb",
                    "/assets/environment/vegetation/Flower_1_Clump.glb",
                    "/assets/environment/vegetation/Flower_2_Clump.glb",
                    "/assets/environment/vegetation/Flower_3_Clump.glb",
                ],
                colors: ["#34d399", "#059669", "#10b981", "#047857"],
            },
            grass: {
                paths: [
                    "/assets/environment/vegetation/Grass_Large.glb",
                    "/assets/environment/vegetation/Grass_Small.glb",
                    "/assets/environment/vegetation/Grass_Large_Extruded.glb",
                    "/assets/environment/vegetation/Grass_Wispy_Short.glb",
                    "/assets/environment/vegetation/Grass_Wispy_Tall.glb",
                    "/assets/environment/vegetation/Grass_Common_Short.glb",
                    "/assets/environment/vegetation/Grass_Common_Tall.glb",
                    "/assets/environment/vegetation/Clover_1.glb",
                    "/assets/environment/vegetation/Clover_2.glb",
                    "/assets/environment/vegetation/Fern_1.glb",
                    "/assets/environment/vegetation/Flower_1.glb",
                    "/assets/environment/vegetation/Flower_1_Clump.glb",
                    "/assets/environment/vegetation/Flower_2.glb",
                    "/assets/environment/vegetation/Flower_2_Clump.glb",
                ],
                colors: ["#4ade80", "#22c55e", "#16a34a", "#86efac", "#a3e635"],
            },
        };

        const config = themeAssets[vegetationTheme] || themeAssets.pine;
        const generatedItems: MapItem[] = [];
        const baseDistance = 24;

        for (let i = 0; i < vegetationDensity; i++) {
            let x = 0;
            let z = 0;
            let dist = 0;

            // Avoid spawning directly in center base
            for (let attempt = 0; attempt < 15; attempt++) {
                x = (Math.random() - 0.5) * 110;
                z = (Math.random() - 0.5) * 110;
                dist = Math.sqrt(x * x + z * z);
                if (dist > baseDistance + 6) break;
            }

            // Calculate precise elevation at (x, z) including current sculpt height!
            const terrainH = getTerrainElevation(
                x,
                z,
                "STORM",
                baseDistance,
                terrainConfig,
                false,
            );
            const y = terrainH; // Align with GROUND_Y (now 0.0)

            let modelPath =
                config.paths[Math.floor(Math.random() * config.paths.length)];
            if (modelPath.startsWith("/")) {
                modelPath = `${API_BASE_URL}${modelPath}`;
            }
            const sizeScale = 0.6 + Math.random() * 0.9; // 0.6 to 1.5 times

            const pos: [number, number, number] = [x, y, z];
            const rot: [number, number, number] = [
                0,
                Math.random() * Math.PI * 2,
                0,
            ];
            const sca: [number, number, number] = [
                sizeScale,
                sizeScale,
                sizeScale,
            ];
            const color = config.colors
                ? config.colors[
                      Math.floor(Math.random() * config.colors.length)
                  ]
                : undefined;

            generatedItems.push({
                id: `procedural-veg-${vegetationTheme}-${Date.now()}-${i}-${Math.random()}`,
                type: "procedural-vegetation",
                path: modelPath,
                pos,
                rot,
                sca,
                color,
            });
        }

        // Merge, keeping other non-procedural items
        const otherItems = items.filter(
            (item) => item.type !== "procedural-vegetation",
        );
        const newItems = [...otherItems, ...generatedItems];

        get().updateItemsWithHistory(newItems);
    },
    vegetationSingleAsset: null,
    setVegetationSingleAsset: (path) => set({ vegetationSingleAsset: path }),
    vegetationFixedScale: 0,
    setVegetationFixedScale: (scale) => set({ vegetationFixedScale: scale }),
    vegetationRadius: 10,
    setVegetationRadius: (r) => set({ vegetationRadius: r }),
    clearVegetation: () => {
        const { items } = get();
        const filtered = items.filter(
            (item) => item.type !== "procedural-vegetation",
        );
        get().updateItemsWithHistory(filtered);
    },

    cameraFocusTarget: null,
    setCameraFocusTarget: (target) => set({ cameraFocusTarget: target }),
    cameraFocusObjectId: null,
    setCameraFocusObjectId: (id) => set({ cameraFocusObjectId: id }),
    vegetationBrushActive: false,
    setVegetationBrushActive: (active) =>
        set(() => {
            if (active) {
                return {
                    vegetationBrushActive: true,
                    paintMode: false,
                    activeAsset: null,
                    selectedId: null,
                    selectedIds: [],
                };
            } else {
                return {
                    vegetationBrushActive: false,
                };
            }
        }),

    // Multi-layer Splat Paint
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
            debouncedSave();
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
            debouncedSave();
            return { paintLayerColors: next };
        }),

    // Flatten to exact height
    flattenTargetHeight: 0,
    setFlattenTargetHeight: (h) => set({ flattenTargetHeight: h }),
}));
