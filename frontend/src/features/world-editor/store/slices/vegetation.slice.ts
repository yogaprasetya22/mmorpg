/**
 * Vegetation slice — procedural vegetation prototypes, instances, brush settings, and filters.
 *
 * Location: frontend/src/features/world-editor/store/slices/vegetation.slice.ts
 */

import type { StateCreator } from "zustand";
import type {
    VegetationTheme,
    VegetationPrototype,
    VegetationBrushMode,
    AssetBlueprint,
    AssetLibraryState,
} from "@/src/features/world-editor/types/editor.types";
import { getTerrainElevation, API_BASE_URL } from "@jagres/shared";
import type { MapItem } from "@jagres/shared";

export interface VegetationSlice {
    // UI & Tool settings
    vegetationTheme: VegetationTheme;
    setVegetationTheme: (theme: VegetationTheme) => void;
    vegetationDensity: number;
    setVegetationDensity: (density: number) => void;
    vegetationBrushActive: boolean;
    setVegetationBrushActive: (active: boolean) => void;
    vegetationSingleAsset: string | null;
    setVegetationSingleAsset: (path: string | null) => void;
    vegetationFixedScale: number;
    setVegetationFixedScale: (scale: number) => void;
    vegetationRadius: number;
    setVegetationRadius: (r: number) => void;
    vegetationAssetOverrides: Record<string, string | null>;
    setVegetationAssetOverride: (themeId: string, path: string | null) => void;

    // Prototype-based system additions
    vegetationPrototypes: VegetationPrototype[];
    selectedPrototypeIds: string[];
    vegetationBrushMode: VegetationBrushMode;
    vegetationBrushWeights: Record<string, number>;
    vegetationAlignToNormal: boolean;
    vegetationSlopeFilterEnabled: boolean;
    vegetationSlopeRange: [number, number];
    vegetationHeightFilterEnabled: boolean;
    vegetationHeightRange: [number, number];
    vegetationSelectedInstanceId: string | null;

    setVegetationBrushMode: (mode: VegetationBrushMode) => void;
    togglePrototypeSelection: (id: string) => void;
    setPrototypeWeight: (id: string, weight: number) => void;
    setVegetationAlignToNormal: (align: boolean) => void;
    setVegetationSlopeFilter: (enabled: boolean, range: [number, number]) => void;
    setVegetationHeightFilter: (enabled: boolean, range: [number, number]) => void;
    addVegetationPrototype: (proto: Omit<VegetationPrototype, "id">) => void;
    removeVegetationPrototype: (id: string) => void;
    setVegetationSelectedInstanceId: (id: string | null) => void;

    // Asset Library slice state additions
    assetLibrary: AssetLibraryState;
    setBlueprints: (blueprints: AssetBlueprint[]) => void;
    setSelectedBlueprintId: (id: string | null) => void;
    setAssetFilterText: (text: string) => void;
    setAssetCategory: (category: AssetBlueprint["category"]) => void;
    setIsAssetLoading: (loading: boolean) => void;

    generateVegetation: () => void;
    clearVegetation: () => void;
}

const DEFAULT_PROTOTYPES: VegetationPrototype[] = [
    // Pine theme
    { id: "pine-1", name: "Pine 1", assetUrl: "/assets/environment/trees/Pine_1.glb", category: "trees", defaultScaleMin: 0.55, defaultScaleMax: 1.45, defaultRandomYaw: true, alignToSurfaceNormal: false },
    { id: "pine-2", name: "Pine 2", assetUrl: "/assets/environment/trees/Pine_2.glb", category: "trees", defaultScaleMin: 0.55, defaultScaleMax: 1.45, defaultRandomYaw: true, alignToSurfaceNormal: false },
    { id: "pine-3", name: "Pine 3", assetUrl: "/assets/environment/trees/Pine_3.glb", category: "trees", defaultScaleMin: 0.55, defaultScaleMax: 1.45, defaultRandomYaw: true, alignToSurfaceNormal: false },
    { id: "pine-4", name: "Pine 4", assetUrl: "/assets/environment/trees/Pine_4.glb", category: "trees", defaultScaleMin: 0.55, defaultScaleMax: 1.45, defaultRandomYaw: true, alignToSurfaceNormal: false },
    { id: "pine-5", name: "Pine 5", assetUrl: "/assets/environment/trees/Pine_5.glb", category: "trees", defaultScaleMin: 0.55, defaultScaleMax: 1.45, defaultRandomYaw: true, alignToSurfaceNormal: false },
    
    // Cherry theme
    { id: "cherry-1", name: "Birch 1", assetUrl: "/assets/environment/trees/BirchTree_1.glb", category: "trees", defaultScaleMin: 0.55, defaultScaleMax: 1.45, defaultRandomYaw: true, alignToSurfaceNormal: false },
    { id: "cherry-2", name: "Birch 2", assetUrl: "/assets/environment/trees/BirchTree_2.glb", category: "trees", defaultScaleMin: 0.55, defaultScaleMax: 1.45, defaultRandomYaw: true, alignToSurfaceNormal: false },
    { id: "cherry-3", name: "Birch 3", assetUrl: "/assets/environment/trees/BirchTree_3.glb", category: "trees", defaultScaleMin: 0.55, defaultScaleMax: 1.45, defaultRandomYaw: true, alignToSurfaceNormal: false },

    // Autumn theme
    { id: "autumn-1", name: "Maple 1", assetUrl: "/assets/environment/trees/MapleTree_1.glb", category: "trees", defaultScaleMin: 0.55, defaultScaleMax: 1.45, defaultRandomYaw: true, alignToSurfaceNormal: false },
    { id: "autumn-2", name: "Maple 2", assetUrl: "/assets/environment/trees/MapleTree_2.glb", category: "trees", defaultScaleMin: 0.55, defaultScaleMax: 1.45, defaultRandomYaw: true, alignToSurfaceNormal: false },
    
    // Clover & Grasses
    { id: "clover-1", name: "Bush", assetUrl: "/assets/environment/vegetation/Bush.glb", category: "grass", defaultScaleMin: 0.8, defaultScaleMax: 1.2, defaultRandomYaw: true, alignToSurfaceNormal: true },
    { id: "grass-1", name: "Grass Small", assetUrl: "/assets/environment/vegetation/Grass_Small.glb", category: "grass", defaultScaleMin: 0.6, defaultScaleMax: 1.1, defaultRandomYaw: true, alignToSurfaceNormal: true },
    { id: "grass-2", name: "Grass Large", assetUrl: "/assets/environment/vegetation/Grass_Large.glb", category: "grass", defaultScaleMin: 0.7, defaultScaleMax: 1.3, defaultRandomYaw: true, alignToSurfaceNormal: true },
];

import blueprintsManifest from "@/src/features/world-editor/core/blueprints.manifest.json";
const DEFAULT_BLUEPRINTS = blueprintsManifest as AssetBlueprint[];

export const createVegetationSlice: StateCreator<
    VegetationSlice,
    [],
    [],
    VegetationSlice
> = (set, get) => ({
    // UI & Legacy theme settings
    vegetationTheme: "pine",
    setVegetationTheme: (theme) =>
        set((state) => {
            // Automatically select prototype IDs associated with the active theme to sync legacy flow
            const associatedIds = state.vegetationPrototypes
                .filter((p) => p.id.startsWith(theme))
                .map((p) => p.id);
            return {
                vegetationTheme: theme,
                selectedPrototypeIds: associatedIds,
            };
        }),
    vegetationDensity: 60,
    setVegetationDensity: (density) => set({ vegetationDensity: density }),
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
                } as any;
            }
            return { vegetationBrushActive: false } as any;
        }),
    vegetationSingleAsset: null,
    setVegetationSingleAsset: (path) => set({ vegetationSingleAsset: path }),
    vegetationFixedScale: 0,
    setVegetationFixedScale: (scale) => set({ vegetationFixedScale: scale }),
    vegetationRadius: 10,
    setVegetationRadius: (r) => set({ vegetationRadius: r }),
    vegetationAssetOverrides: {},
    setVegetationAssetOverride: (themeId, path) =>
        set((state) => ({
            vegetationAssetOverrides: {
                ...state.vegetationAssetOverrides,
                [themeId]: path,
            },
        })),

    // Prototype-based settings initialization
    vegetationPrototypes: DEFAULT_PROTOTYPES,
    selectedPrototypeIds: DEFAULT_PROTOTYPES.filter((p) => p.id.startsWith("pine")).map((p) => p.id),
    vegetationBrushMode: "Paint",
    vegetationBrushWeights: DEFAULT_PROTOTYPES.reduce((acc, p) => ({ ...acc, [p.id]: 1 }), {}),
    vegetationAlignToNormal: false,
    vegetationSlopeFilterEnabled: false,
    vegetationSlopeRange: [0, 45],
    vegetationHeightFilterEnabled: false,
    vegetationHeightRange: [-20, 80],
    vegetationSelectedInstanceId: null,

    setVegetationBrushMode: (mode) => set({ vegetationBrushMode: mode }),
    togglePrototypeSelection: (id) =>
        set((state) => {
            const isSelected = state.selectedPrototypeIds.includes(id);
            const selectedPrototypeIds = isSelected
                ? state.selectedPrototypeIds.filter((x) => x !== id)
                : [...state.selectedPrototypeIds, id];
            return { selectedPrototypeIds };
        }),
    setPrototypeWeight: (id, weight) =>
        set((state) => ({
            vegetationBrushWeights: {
                ...state.vegetationBrushWeights,
                [id]: Math.max(0, weight),
            },
        })),
    setVegetationAlignToNormal: (align) => set({ vegetationAlignToNormal: align }),
    setVegetationSlopeFilter: (enabled, range) =>
        set({
            vegetationSlopeFilterEnabled: enabled,
            vegetationSlopeRange: range,
        }),
    setVegetationHeightFilter: (enabled, range) =>
        set({
            vegetationHeightFilterEnabled: enabled,
            vegetationHeightRange: range,
        }),
    addVegetationPrototype: (proto) =>
        set((state) => {
            const nextId = `proto-custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            const newProto: VegetationPrototype = { ...proto, id: nextId };
            return {
                vegetationPrototypes: [...state.vegetationPrototypes, newProto],
                vegetationBrushWeights: {
                    ...state.vegetationBrushWeights,
                    [nextId]: 1,
                },
            };
        }),
    removeVegetationPrototype: (id) =>
        set((state) => ({
            vegetationPrototypes: state.vegetationPrototypes.filter((p) => p.id !== id),
            selectedPrototypeIds: state.selectedPrototypeIds.filter((x) => x !== id),
        })),
    setVegetationSelectedInstanceId: (id) => set({ vegetationSelectedInstanceId: id }),

    // Asset Library state initialization
    assetLibrary: {
        blueprints: DEFAULT_BLUEPRINTS,
        selectedBlueprintId: DEFAULT_BLUEPRINTS[0].id,
        filterText: "",
        activeCategory: "all",
        isLoading: false,
    },
    setBlueprints: (blueprints) =>
        set((state) => ({
            assetLibrary: {
                ...state.assetLibrary,
                blueprints,
            },
        })),
    setSelectedBlueprintId: (id) =>
        set((state) => ({
            assetLibrary: {
                ...state.assetLibrary,
                selectedBlueprintId: id,
            },
        })),
    setAssetFilterText: (text) =>
        set((state) => ({
            assetLibrary: {
                ...state.assetLibrary,
                filterText: text,
            },
        })),
    setAssetCategory: (category) =>
        set((state) => ({
            assetLibrary: {
                ...state.assetLibrary,
                activeCategory: category,
            },
        })),
    setIsAssetLoading: (loading) =>
        set((state) => ({
            assetLibrary: {
                ...state.assetLibrary,
                isLoading: loading,
            },
        })),

    generateVegetation: () => {
        const state = get() as any;
        const {
            items,
            terrainConfig,
            environment,
            updateItemsWithHistory,
            selectedPrototypeIds,
            vegetationPrototypes,
            vegetationDensity,
            vegetationBrushWeights,
        } = state;

        if (selectedPrototypeIds.length === 0) return;

        const generatedItems: MapItem[] = [];
        const baseDistance = 24;
        const totalWeight = selectedPrototypeIds.reduce((sum: number, id: string) => sum + (vegetationBrushWeights[id] || 0), 0);

        for (let i = 0; i < vegetationDensity; i++) {
            let x = 0,
                z = 0,
                dist = 0;
            for (let attempt = 0; attempt < 15; attempt++) {
                x = (Math.random() - 0.5) * 110;
                z = (Math.random() - 0.5) * 110;
                dist = Math.sqrt(x * x + z * z);
                if (dist > baseDistance + 6) break;
            }
            const terrainH = getTerrainElevation(
                x,
                z,
                environment,
                baseDistance,
                terrainConfig,
                false,
            );
            const y = terrainH;

            // Pick weighted prototype
            let chosenProto: VegetationPrototype = vegetationPrototypes.find((p: any) => p.id === selectedPrototypeIds[0])!;
            if (totalWeight > 0) {
                let randomVal = Math.random() * totalWeight;
                for (const protoId of selectedPrototypeIds) {
                    const weight = vegetationBrushWeights[protoId] || 0;
                    randomVal -= weight;
                    if (randomVal <= 0) {
                        chosenProto = vegetationPrototypes.find((p: any) => p.id === protoId) || chosenProto;
                        break;
                    }
                }
            }

            let modelPath = chosenProto.assetUrl;
            if (modelPath.startsWith("/")) {
                modelPath = `${API_BASE_URL}${modelPath}`;
            }
            const sizeScale = chosenProto.defaultScaleMin + Math.random() * (chosenProto.defaultScaleMax - chosenProto.defaultScaleMin);

            generatedItems.push({
                id: `procedural-veg-${chosenProto.id}-${Date.now()}-${i}-${crypto.randomUUID()}`,
                type: "procedural-vegetation",
                path: modelPath,
                pos: [x, y, z],
                rot: [0, Math.random() * Math.PI * 2, 0],
                sca: [sizeScale, sizeScale, sizeScale],
            });
        }

        const otherItems = items.filter(
            (i: MapItem) => i.type !== "procedural-vegetation",
        );
        updateItemsWithHistory([...otherItems, ...generatedItems]);
    },
    clearVegetation: () => {
        const state = get() as any;
        const { items, updateItemsWithHistory } = state;
        const filtered = items.filter(
            (i: MapItem) => i.type !== "procedural-vegetation",
        );
        updateItemsWithHistory(filtered);
    },
});
