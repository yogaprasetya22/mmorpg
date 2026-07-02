/**
 * Vegetation slice — procedural veg theme, density, brush, and per-theme overrides.
 *
 * Location: frontend/src/editor/app/store/slices/vegetation.slice.ts
 */

import type { StateCreator } from "zustand";
import type { VegetationTheme } from "@/src/features/world-editor/types/editor.types";
import { getTerrainElevation, API_BASE_URL } from "@jagres/shared";
import type { MapItem } from "@jagres/shared";

export interface VegetationSlice {
    vegetationTheme: VegetationTheme;
    setVegetationTheme: (theme: VegetationTheme) => void;
    vegetationDensity: number;
    setVegetationDensity: (density: number) => void;
    generateVegetation: () => void;
    clearVegetation: () => void;
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
}

const THEME_ASSETS_INTERNAL: Record<
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

export const createVegetationSlice: StateCreator<
    VegetationSlice,
    [],
    [],
    VegetationSlice
> = (set, get) => ({
    vegetationTheme: "pine",
    setVegetationTheme: (theme) => set({ vegetationTheme: theme }),
    vegetationDensity: 60,
    setVegetationDensity: (density) => set({ vegetationDensity: density }),
    generateVegetation: () => {
        const state = get() as any;
        const {
            items,
            terrainConfig,
            environment,
            vegetationTheme,
            vegetationDensity,
            updateItemsWithHistory,
        } = state;

        const themeAssets = THEME_ASSETS_INTERNAL;
        const config = themeAssets[vegetationTheme] || themeAssets.pine;
        const generatedItems: MapItem[] = [];
        const baseDistance = 24;

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

            let modelPath =
                config.paths[Math.floor(Math.random() * config.paths.length)];
            if (modelPath.startsWith("/")) {
                modelPath = `${API_BASE_URL}${modelPath}`;
            }
            const sizeScale = 0.6 + Math.random() * 0.9;
            const color = config.colors
                ? config.colors[
                      Math.floor(Math.random() * config.colors.length)
                  ]
                : undefined;

            generatedItems.push({
                id: `procedural-veg-${vegetationTheme}-${Date.now()}-${i}-${crypto.randomUUID()}`,
                type: "procedural-vegetation",
                path: modelPath,
                pos: [x, y, z],
                rot: [0, Math.random() * Math.PI * 2, 0],
                sca: [sizeScale, sizeScale, sizeScale],
                color,
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
});
