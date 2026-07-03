/**
 * world-core — headless world domain logic.
 * No React, no browser. Can run in Node, Bun, Deno.
 *
 * Location: packages/world-core/src/index.ts
 */

// Schema
export type {
    NodeType,
    NodeId,
    Vec3,
    Transform,
    BoundingBox,
    WorldNode,
    CreateNodeInput,
    UpdateNodeInput,
    NodeQuery,
    WorldSnapshot,
    WorldSnapshotSettings,
    TerrainConfig,
    EnvironmentSettings,
} from "./schema/node";
export { NODE_TYPES, asNodeId } from "./schema/node";

// Error codes
export {
    ERROR_CODES,
    type ErrorCode,
    type OperationError,
    type OperationResult,
} from "./schema/error-codes";

// Bridge
export {
    createWorldBridge,
    getWorld,
    setWorld,
    updateSettings,
    updatePaintData,
    updateSculptData,
    createNode,
    updateNode,
    deleteNode,
    duplicateRegion,
    getNode,
    findNodes,
    undo,
    redo,
    checkCollisions,
    describeNode,
    type BridgeState,
} from "./bridge/world-bridge";

// Generators
export {
    createSeededRandom,
    type SeededRandom,
    generateMountainRange,
    type MountainRangeParams,
    createVillageLayout,
    type VillageParams,
    generateRoadNetwork,
    type RoadNetworkParams,
    paintBiome,
    type BiomeType,
    type BiomeParams,
} from "./generators/index";

// Events
export {
    createEventBus,
    type WorldEvent,
    type WorldEventType,
    type WorldEventBus,
} from "./bridge/events";

// ID generator
export { buildNodeId } from "./bridge/node-ids";
