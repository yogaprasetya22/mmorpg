/**
 * Persistence slice — save/load to localStorage + database, multi-map management,
 * dynamic assets, paint blueprints.
 *
 * Location: frontend/src/editor/app/store/slices/persistence.slice.ts
 */

import type { StateCreator } from "zustand";
import type { MapItem } from "@jagres/shared";
import {
    API_BASE_URL,
    sanitizeAssetPath,
    AssetInfo,
    setAssetLibrary,
} from "@jagres/shared";
import { newItemId } from "@/src/features/world-editor/utils/ids";
import type { PaintBlueprint } from "@/src/features/world-editor/types/editor.types";

export interface CustomPaintBlueprint extends PaintBlueprint {}

export interface PersistenceSlice {
    // Map management
    selectedMapId: string;
    setSelectedMapId: (mapId: string) => Promise<void>;
    mapList: { id: string; name: string; updated_at: string }[];
    fetchMapList: () => Promise<void>;
    createNewMap: (mapId: string) => Promise<void>;
    deleteActiveMap: () => Promise<void>;
    deleteMap: (mapId: string) => Promise<void>;

    // Dynamic assets
    dynamicAssets: AssetInfo[];
    fetchDynamicAssets: () => Promise<void>;

    // Persistence
    loadFromStorage: () => void;
    saveToStorage: () => void;
    saveToDatabase: () => Promise<void>;
    loadFromDatabase: () => Promise<void>;

    // Paint blueprints
    savedPaintBlueprints: CustomPaintBlueprint[];
    activePaintBlueprintId: string | null;
    createPaintBlueprint: (
        name: string,
        config: Omit<CustomPaintBlueprint, "id" | "name">,
    ) => void;
    deletePaintBlueprint: (id: string) => void;
    applyPaintBlueprint: (id: string) => void;
}

const sanitizeCanvasData = (data: string | null | undefined): string | null => {
    if (!data || typeof data !== "string") return null;
    if (
        data.startsWith("data:image/") ||
        data.startsWith("data:application/")
    ) {
        return data;
    }
    return null;
};

export const createPersistenceSlice: StateCreator<
    PersistenceSlice,
    [],
    [],
    PersistenceSlice
> = (set, get) => ({
    selectedMapId: "Starter Zone",
    setSelectedMapId: async (mapId) => {
        set({ selectedMapId: mapId });
        // self-reference: call loadFromDatabase on self
        await (get() as any).loadFromDatabase?.();

        try {
            const resSettings = await fetch(
                `${API_BASE_URL}/api/config/settings`,
            );
            let dataSettings = {};
            if (resSettings.ok) dataSettings = await resSettings.json();
            const updated = { ...dataSettings, activeMapId: mapId };
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
            items: [] as MapItem[],
            paintData: null,
            sculptData: null,
            history: [{ items: [], paintData: null, sculptData: null }],
            historyIndex: 0,
        } as any);
        await (get() as any).saveToDatabase?.();
        await (get() as any).fetchMapList?.();
    },
    deleteActiveMap: async () => {
        const { selectedMapId } = get() as any;
        await (get() as any).deleteMap?.(selectedMapId);
    },
    deleteMap: async (mapId: string) => {
        if (
            !confirm(
                `Apakah Anda yakin ingin menghapus peta "${mapId}" secara permanen? Tindakan ini tidak dapat dibatalkan.`,
            )
        )
            return;

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
                await (get() as any).fetchMapList?.();
                const self = get() as any;
                if (self.selectedMapId === mapId) {
                    const remaining = self.mapList;
                    if (remaining.length > 0) {
                        await (get() as any).setSelectedMapId?.(
                            remaining[0].id,
                        );
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

    dynamicAssets: [],
    fetchDynamicAssets: async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/config/assets`);
            if (res.ok) {
                const assets: {
                    name: string;
                    path: string;
                    category?: string;
                    thumbnail?: string;
                }[] = await res.json();
                const mapped: AssetInfo[] = assets.map((item) => {
                    let category: AssetInfo["category"] = "rocks";
                    if (item.category) {
                        category = item.category as AssetInfo["category"];
                    } else {
                        const lowerPath = item.path.toLowerCase();
                        if (lowerPath.includes("/environment/trees/"))
                            category = "trees";
                        else if (lowerPath.includes("/environment/vegetation/"))
                            category = "vegetation";
                        else if (lowerPath.includes("/environment/rocks/"))
                            category = "rocks";
                    }
                    const path = `${API_BASE_URL}${item.path}`;
                    const name = item.name
                        .replace(/\.[^/.]+$/, "")
                        .replace(/[-_]/g, " ");
                    const thumbnail = item.thumbnail
                        ? item.thumbnail
                        : undefined;
                    return { name, path, category, thumbnail };
                });
                set({ dynamicAssets: mapped });
                setAssetLibrary(
                    mapped as Parameters<typeof setAssetLibrary>[0],
                );
            }
        } catch (e) {
            console.error("Failed to fetch dynamic assets", e);
        }
    },

    loadFromStorage: () => {
        const saved = localStorage.getItem("world_editor_map");
        const settings = localStorage.getItem("world_editor_settings");

        if (settings) {
            try {
                const parsed = JSON.parse(settings);
                set({
                    gridSize: parsed.gridSize ?? 1,
                    gridEnabled: parsed.gridEnabled ?? true,
                    terrainConfig: {
                        height: 12.0,
                        scale: 0.05,
                        seed: 0,
                        sharpness: 2.0,
                        ...parsed.terrainConfig,
                    },
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
                    savedPaintBlueprints: parsed.savedPaintBlueprints || [],
                    paintLayerMaterials: parsed.paintLayerMaterials || [
                        null,
                        null,
                        null,
                        null,
                    ],
                    paintLayerColors: parsed.paintLayerColors || [
                        "#3d5c36",
                        "#7c6a4a",
                        "#5a4d3a",
                        "#e8e0d0",
                    ],
                } as any);
            } catch (e) {
                /* ignore corrupt settings */
            }
        }

        const paint = sanitizeCanvasData(
            localStorage.getItem("world_editor_paint"),
        );
        if (paint) set({ paintData: paint } as any);
        const sculpt = sanitizeCanvasData(
            localStorage.getItem("world_editor_sculpt"),
        );
        if (sculpt) set({ sculptData: sculpt } as any);

        if (saved) {
            try {
                const parsed = JSON.parse(saved) as MapItem[];
                const sanitized = parsed.map((item) => ({
                    ...item,
                    path: sanitizeAssetPath(item.path),
                }));
                set({
                    items: sanitized,
                    history: [
                        {
                            items: sanitized,
                            paintData: paint,
                            sculptData: sculpt,
                        },
                    ],
                    historyIndex: 0,
                } as any);
            } catch (e) {
                console.error("Failed to load map", e);
            }
        }
    },

    saveToStorage: () => {
        const state = get() as any;
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
        } = state;
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
                    paintLayerMaterials: state.paintLayerMaterials,
                    paintLayerColors: state.paintLayerColors,
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

    saveToDatabase: async () => {
        const state = get() as any;
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
        } = state;

        // Map internal IDs to database texture names
        let savedMaterialId = terrainMaterialId;
        if (terrainMaterialId === "texture_2")
            savedMaterialId = "rocky_terrain_02_nor_gl_1k.png";
        else if (terrainMaterialId === "texture_1")
            savedMaterialId = "marble_cliff_03_nor_gl_1k.png";

        let savedBrushTextureId = brushTextureId;
        if (brushTextureId === "texture_2")
            savedBrushTextureId = "rocky_terrain_02_nor_gl_1k.png";
        else if (brushTextureId === "texture_1")
            savedBrushTextureId = "marble_cliff_03_nor_gl_1k.png";

        set({ isSaving: true } as any);

        const sanitizedToSave = items.map((item: MapItem) => {
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
                savedPaintBlueprints: state.savedPaintBlueprints,
                skyboxIntensity,
                bloomThreshold,
                bloomStrength,
                bloomRadius,
            },
            paintData,
            sculptData,
            paintLayerMaterials: state.paintLayerMaterials
                .map((x: any) => x || "")
                .join(","),
            paintLayerColors: state.paintLayerColors.join(","),
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
                (get() as any).fetchMapList?.();
            }
        } catch (e) {
            console.error("Failed to sync map to database", e);
        } finally {
            setTimeout(() => set({ isSaving: false } as any), 500);
        }
    },

    _loadPromise: null as Promise<void> | null,

    loadFromDatabase: async () => {
        const self = get() as any;
        if (self._loadPromise) return self._loadPromise;
        const { selectedMapId } = self;
        const promise = (async () => {
            let text = "";
            let res;
            try {
                res = await fetch(
                    `${API_BASE_URL}/api/world-editor/load?map_id=${encodeURIComponent(selectedMapId)}&_t=${Date.now()}`,
                );
                if (!res.ok) return;
                text = await res.text();
            } catch (fetchErr) {
                console.error(
                    "Failed to load map from database (fetch)",
                    fetchErr,
                );
                return;
            }

            let data: any;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                console.error(
                    "Failed to load map from database (JSON)",
                    parseErr,
                    text.slice(0, 500),
                );
                return;
            }

            const sanitizedItems = (data.items || []).map((item: any) => ({
                ...item,
                path: sanitizeAssetPath(item.path),
            }));

            const loadedEnv = data.settings?.environment ?? "STORM";

            let loadedMaterialId = data.settings?.terrainMaterialId ?? null;
            if (
                loadedMaterialId &&
                (loadedMaterialId.includes("rocky_terrain") ||
                    loadedMaterialId === "texture_2")
            )
                loadedMaterialId = "texture_2";
            else if (
                loadedMaterialId &&
                (loadedMaterialId.includes("marble_cliff") ||
                    loadedMaterialId === "texture_1")
            )
                loadedMaterialId = "texture_1";

            let loadedBrushTextureId = data.settings?.brushTextureId ?? null;
            if (
                loadedBrushTextureId &&
                (loadedBrushTextureId.includes("rocky_terrain") ||
                    loadedBrushTextureId === "texture_2")
            )
                loadedBrushTextureId = "texture_2";
            else if (
                loadedBrushTextureId &&
                (loadedBrushTextureId.includes("marble_cliff") ||
                    loadedBrushTextureId === "texture_1")
            )
                loadedBrushTextureId = "texture_1";

            set({
                items: sanitizedItems,
                gridSize: data.settings?.gridSize ?? 1.0,
                gridEnabled: data.settings?.gridEnabled ?? true,
                terrainConfig: {
                    height: 12,
                    scale: 0.05,
                    seed: 0,
                    sharpness: 2,
                    ...(data.settings?.terrainConfig || {}),
                },
                terrainMaterialId: loadedMaterialId,
                terrainColor: data.settings?.terrainColor ?? "#3d5c36",
                sky: data.settings?.sky ?? "sunset",
                environment: loadedEnv,
                lightIntensity: data.settings?.lightIntensity ?? null,
                ambientIntensity: data.settings?.ambientIntensity ?? null,
                sunAngle: data.settings?.sunAngle ?? 45,
                fogDensity: data.settings?.fogDensity ?? 0.002,
                paintData: sanitizeCanvasData(data.paintData) || null,
                sculptData: sanitizeCanvasData(data.sculptData) || null,
                brushTextureId: loadedBrushTextureId,
                savedPaintBlueprints: data.settings?.savedPaintBlueprints || [],
                skyboxIntensity: data.settings?.skyboxIntensity ?? null,
                bloomThreshold: data.settings?.bloomThreshold ?? null,
                bloomStrength: data.settings?.bloomStrength ?? null,
                bloomRadius: data.settings?.bloomRadius ?? null,
                paintLayerMaterials: data.paintLayerMaterials
                    ? data.paintLayerMaterials
                          .split(",")
                          .map((x: string) => x || null)
                    : [null, null, null, null],
                paintLayerColors: data.paintLayerColors
                    ? data.paintLayerColors.split(",")
                    : ["#3d5c36", "#7c6a4a", "#5a4d3a", "#e8e0d0"],
                history: [
                    {
                        items: sanitizedItems,
                        paintData: sanitizeCanvasData(data.paintData) || null,
                        sculptData: sanitizeCanvasData(data.sculptData) || null,
                    },
                ],
                historyIndex: 0,
            } as any);
        })();
        promise
            .catch((e) => console.error("Failed to load map from database", e))
            .finally(() => {
                (get() as any)._loadPromise = null;
            });
        self._loadPromise = promise;
        return promise;
    },

    savedPaintBlueprints: [],
    activePaintBlueprintId: null,

    createPaintBlueprint: (name, config) => {
        const newBlueprint: CustomPaintBlueprint = {
            ...config,
            id: newItemId().replace("item-", "blueprint-"),
            name,
        };
        set((state) => ({
            savedPaintBlueprints: [
                ...(state as any).savedPaintBlueprints,
                newBlueprint,
            ],
            activePaintBlueprintId: newBlueprint.id,
        }));

        // Trigger save via debounce pattern — handled by store subscriber
    },

    deletePaintBlueprint: (id) => {
        set((state) => {
            const self = state as any;
            const next = self.savedPaintBlueprints.filter(
                (b: CustomPaintBlueprint) => b.id !== id,
            );
            const nextActiveId =
                self.activePaintBlueprintId === id
                    ? null
                    : self.activePaintBlueprintId;
            return {
                savedPaintBlueprints: next,
                activePaintBlueprintId: nextActiveId,
            };
        });
    },

    applyPaintBlueprint: (id) => {
        const self = get() as any;
        const blueprint = self.savedPaintBlueprints.find(
            (b: CustomPaintBlueprint) => b.id === id,
        );
        if (blueprint) {
            set(
                (s) =>
                    ({
                        activePaintBlueprintId: id,
                        brushMaskId: blueprint.maskType,
                        brushTextureId: blueprint.textureId ?? null,
                        brushColor: blueprint.brushColor,
                        brushSize: blueprint.defaultSize,
                        brushStrength: blueprint.defaultIntensity,
                        toolBrushProfiles: {
                            ...(s as any).toolBrushProfiles,
                            paint: {
                                size: blueprint.defaultSize,
                                strength: blueprint.defaultIntensity,
                                maskId: blueprint.maskType,
                            },
                        },
                    }) as any,
            );
        }
    },
});
