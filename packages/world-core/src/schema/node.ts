/**
 * World node schema — strict typed node system with parent-child relations.
 * Headless: no React, no browser dependency.
 *
 * Location: packages/world-core/src/schema/node.ts
 */

// ─── Node types ───
export const NODE_TYPES = [
    "terrain",
    "mountain",
    "village",
    "road",
    "river",
    "vegetation",
    "structure",
    "zone",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

// ─── Node ID ───
export type NodeId = string & { readonly __brand: "NodeId" };
export function asNodeId(id: string): NodeId {
    return id as NodeId;
}

// ─── Geometry / transform ───
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface Transform {
    position: Vec3;
    rotation: Vec3; // euler degrees
    scale: Vec3;
}

// ─── Bounding box ───
export interface BoundingBox {
    min: Vec3;
    max: Vec3;
}

// ─── World node ───
export interface WorldNode {
    id: NodeId;
    type: NodeType;
    name: string;
    parentId: NodeId | null; // null = root node
    children: NodeId[];
    transform: Transform;
    bounds: BoundingBox | null;
    properties: Record<string, unknown>;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

// ─── Node creation input ───
export interface CreateNodeInput {
    type: NodeType;
    name: string;
    parentId?: NodeId | null;
    position?: Vec3;
    rotation?: Vec3;
    scale?: Vec3;
    properties?: Record<string, unknown>;
    tags?: string[];
}

// ─── Node patch input ───
export interface UpdateNodeInput {
    id: NodeId;
    name?: string;
    parentId?: NodeId | null;
    position?: Partial<Vec3>;
    rotation?: Partial<Vec3>;
    scale?: Partial<Vec3>;
    properties?: Record<string, unknown>;
    tags?: string[];
}

export interface TerrainConfig {
    height: number;
    scale: number;
    seed: number;
    sharpness: number;
}

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

export interface WorldSnapshotSettings {
    gridSize: number;
    gridEnabled: boolean;
    terrainConfig: TerrainConfig;
    terrainColor: string;
    terrainMaterialId: string | null;
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
}

// ─── World snapshot ───
export interface WorldSnapshot {
    id: string;
    name: string;
    version: number;
    nodes: WorldNode[];
    items: unknown[]; // legacy item compatibility
    settings?: WorldSnapshotSettings;
    paintData?: string | null;
    sculptData?: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

// ─── Query filters ───
export interface NodeQuery {
    type?: NodeType | NodeType[];
    parentId?: NodeId | null;
    tag?: string | string[];
    namePattern?: string; // simple substring match
    bounds?: BoundingBox; // spatial query
}
