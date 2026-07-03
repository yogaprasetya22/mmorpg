/**
 * Editor core types — framework-agnostic, no React dependency.
 *
 * Location: frontend/src/editor/core/types.ts
 */

import type { MapItem } from "@jagres/shared";

// ─── Editor mode ───
export type TransformMode = "translate" | "rotate" | "scale";

// ─── Selection ───
export interface EditorSelection {
    readonly primaryId: string | null;
    readonly ids: readonly string[];
}

// ─── Terrain sculpt/paint ───
export type SculptTool = "raise" | "lower" | "smooth" | "flatten";
export type TerrainMode = "paint" | "sculpt";
export type BrushMaskId =
    | "softCircle"
    | "hardCircle"
    | "star"
    | "hexagon"
    | "starOutline"
    | "square"
    | "triangle";

export interface BrushProfile {
    size: number;
    strength: number;
    maskId: BrushMaskId;
}

export interface TerrainConfig {
    height: number;
    scale: number;
    seed: number;
    sharpness: number;
}

// ─── Vegetation ───
export interface VegetationPrototype {
    id: string;
    name: string;
    assetUrl: string;
    thumbnailUrl?: string;
    category: "trees" | "grass" | "rocks" | "custom";
    defaultScaleMin: number;
    defaultScaleMax: number;
    defaultRandomYaw: boolean;
    alignToSurfaceNormal: boolean;
    slopeMin?: number;
    slopeMax?: number;
    heightMin?: number;
    heightMax?: number;
    cullDistance?: number;
}

export interface VegetationInstance {
    id: string;
    prototypeId: string;
    pos: [number, number, number];
    rot: [number, number, number];
    sca: [number, number, number];
    color?: string;
    chunkId?: string;
    createdAt?: number;
    updatedAt?: number;
}

export type VegetationBrushMode = "Paint" | "Erase" | "Select" | "Single" | "Reapply";

export interface VegetationBrushState {
    mode: VegetationBrushMode;
    radius: number;
    density: number;
    scaleRange: [number, number];
    selectedPrototypeIds: string[];
    weights: Record<string, number>;
    alignToNormal: boolean;
    slopeFilterEnabled: boolean;
    slopeRange: [number, number];
    heightFilterEnabled: boolean;
    heightRange: [number, number];
    randomSeed: number;
}

export interface VegetationDocument {
    version: number;
    prototypes: VegetationPrototype[];
    instances: VegetationInstance[];
}

export type VegetationTheme =
    | "pine"
    | "cherry"
    | "autumn"
    | "desert"
    | "clover"
    | "grass";

// ─── Environment ───
export interface EnvironmentSettings {
    sky: string;
    environment: string;
    lightIntensity: number | null;
    ambientIntensity: number | null;
    sunAngle: number;
    fogDensity: number;
    skyboxIntensity: number | null;
    bloomThreshold: number | null;
    bloomStrength: number | null;
    bloomRadius: number | null;
    terrainColor: string;
    terrainMaterialId: string | null;
}

// ─── Paint blueprint ───
export interface PaintBlueprint {
    id: string;
    name: string;
    maskType: BrushMaskId;
    textureId: string | null;
    brushColor: string;
    defaultSize: number;
    defaultIntensity: number;
}

// ─── Paint layer ───
export type PaintLayerIndex = 0 | 1 | 2 | 3;

// ─── Grid ───
export interface GridSettings {
    size: number;
    enabled: boolean;
}

// ─── Full editor scene snapshot (for persistence) ───
export interface EditorSceneSnapshot {
    readonly version: number;
    readonly mapId: string;
    readonly items: readonly MapItem[];
    readonly terrainConfig: TerrainConfig;
    readonly environment: EnvironmentSettings;
    readonly grid: GridSettings;
    readonly paintData: string | null;
    readonly sculptData: string | null;
    readonly savedBlueprints: readonly PaintBlueprint[];
    readonly paintLayerMaterials: readonly [
        string | null,
        string | null,
        string | null,
        string | null,
    ];
    readonly paintLayerColors: readonly [string, string, string, string];
    readonly vegetationTheme: VegetationTheme;
    readonly vegetationDensity: number;
    readonly vegetationFixedScale: number;
    readonly vegetationRadius: number;
    readonly vegetationAssetOverrides: Record<string, string | null>;
    readonly lastUsedScales: Record<string, [number, number, number]>;
    readonly lastUsedRotations: Record<string, [number, number, number]>;
}

// ─── Asset Library & Caching ───
export interface AssetBlueprint {
    id: string;
    name: string;
    category: "trees" | "vegetation" | "rocks" | "characters" | "materials" | "all";
    modelUrl: string;
    thumbnailUrl?: string;
    polycountHint?: number;
    tags?: string[];
}

export interface AssetLibraryState {
    blueprints: AssetBlueprint[];
    selectedBlueprintId: string | null;
    filterText: string;
    activeCategory: AssetBlueprint["category"];
    isLoading: boolean;
}
