/**
 * WorldOperations — single orchestration gateway for all business flows.
 * Tools call operations, operations call bridge + store, not the other way.
 *
 * Location: packages/mcp/src/operations/world-operations.ts
 */

import {
    createWorldBridge,
    getWorld,
    createNode,
    updateNode,
    deleteNode,
    getNode,
    findNodes,
    duplicateRegion,
    undo as bridgeUndo,
    redo as bridgeRedo,
    describeNode,
    checkCollisions,
    updateSettings,
    updatePaintData,
    updateSculptData,
    type BridgeState,
    type CreateNodeInput,
    type UpdateNodeInput,
    type NodeQuery,
    type WorldSnapshot,
    type NodeId,
    type WorldSnapshotSettings,
    asNodeId,
    generateMountainRange,
    createVillageLayout,
    generateRoadNetwork,
    paintBiome,
    type MountainRangeParams,
    type VillageParams,
    type RoadNetworkParams,
    type BiomeParams,
    createEventBus,
    type WorldEventBus,
} from "../../../world-core/src/index";
import { type WorldStore, type WorldMeta } from "../storage/world-store";

// ─── State container ───
export interface OperationsState {
    bridge: BridgeState;
    store: WorldStore;
    eventBus: WorldEventBus;
}

// ─── SSE hook (injected by transport layer) ───
let notifyLiveSync: (() => void) | null = null;

export function setLiveSyncHook(fn: (() => void) | null) {
    notifyLiveSync = fn;
}

function afterMutation(state: OperationsState) {
    const snap = getWorld(state.bridge);
    state.eventBus.emit({
        type: "snapshot:changed",
        snapshot: snap,
        timestamp: new Date().toISOString(),
    });
    if (notifyLiveSync) notifyLiveSync();
}

// ─── Factory ───
export function createWorldOperations(
    store: WorldStore,
    name: string = "Untitled World",
): OperationsState {
    return {
        bridge: createWorldBridge(name),
        store,
        eventBus: createEventBus(),
    };
}

export function loadWorldOperations(
    store: WorldStore,
    snapshot: WorldSnapshot,
): OperationsState {
    return {
        bridge: { snapshot, undoStack: [], redoStack: [] },
        store,
        eventBus: createEventBus(),
    };
}

// ─── Query operations ───

export function opGetWorld(state: OperationsState) {
    return getWorld(state.bridge);
}

export function opGetNode(state: OperationsState, id: string) {
    return getNode(state.bridge, asNodeId(id));
}

export function opFindNodes(state: OperationsState, query: NodeQuery) {
    return findNodes(state.bridge, query);
}

export function opDescribeNode(state: OperationsState, id: string) {
    return describeNode(state.bridge, asNodeId(id));
}

export function opCheckCollisions(state: OperationsState) {
    return checkCollisions(state.bridge);
}

export function opValidateWorld(state: OperationsState) {
    const w = getWorld(state.bridge);
    const issues: string[] = [];
    const ids = new Set<string>();
    for (const n of w.nodes) {
        if (ids.has(n.id)) issues.push(`Duplicate ID: ${n.id}`);
        ids.add(n.id);
    }
    for (const n of w.nodes) {
        if (n.parentId && !ids.has(n.parentId)) {
            issues.push(`Node ${n.id} references missing parent ${n.parentId}`);
        }
    }
    return { valid: issues.length === 0, nodeCount: w.nodes.length, issues };
}

// ─── Mutation operations ───

export function opCreateNode(state: OperationsState, input: CreateNodeInput) {
    const r = createNode(state.bridge, input);
    if (!r.success) return r;
    state.bridge = r.data!;
    afterMutation(state);
    return r;
}

export function opUpdateNode(state: OperationsState, input: UpdateNodeInput) {
    const r = updateNode(state.bridge, input);
    if (!r.success) return r;
    state.bridge = r.data!;
    afterMutation(state);
    return r;
}

export function opDeleteNode(state: OperationsState, id: string) {
    const r = deleteNode(state.bridge, asNodeId(id));
    if (!r.success) return r;
    state.bridge = r.data!;
    afterMutation(state);
    return r;
}

export function opDuplicateRegion(
    state: OperationsState,
    nodeIds: string[],
    offset: { x: number; y: number; z: number },
) {
    const r = duplicateRegion(state.bridge, nodeIds.map(asNodeId), offset);
    if (!r.success) return r;
    state.bridge = r.data!;
    afterMutation(state);
    return r;
}

export function opUndo(state: OperationsState) {
    const r = bridgeUndo(state.bridge);
    if (!r.success) return r;
    state.bridge = r.data!;
    afterMutation(state);
    return r;
}

export function opRedo(state: OperationsState) {
    const r = bridgeRedo(state.bridge);
    if (!r.success) return r;
    state.bridge = r.data!;
    afterMutation(state);
    return r;
}

// ─── Generator operations ───

export function opGenerateMountainRange(
    state: OperationsState,
    params: MountainRangeParams,
) {
    const inputs = generateMountainRange(params);
    let count = 0;
    for (const input of inputs) {
        const r = createNode(state.bridge, input);
        if (r.success) {
            state.bridge = r.data!;
            count++;
        }
    }
    afterMutation(state);
    return count;
}

export function opGenerateVillage(
    state: OperationsState,
    params: VillageParams,
) {
    const inputs = createVillageLayout(params);
    let count = 0;
    for (const input of inputs) {
        const r = createNode(state.bridge, input);
        if (r.success) {
            state.bridge = r.data!;
            count++;
        }
    }
    afterMutation(state);
    return count;
}

export function opGenerateRoad(
    state: OperationsState,
    params: RoadNetworkParams,
) {
    const inputs = generateRoadNetwork(params);
    let count = 0;
    for (const input of inputs) {
        const r = createNode(state.bridge, input);
        if (r.success) {
            state.bridge = r.data!;
            count++;
        }
    }
    afterMutation(state);
    return count;
}

export function opPaintBiome(state: OperationsState, params: BiomeParams) {
    const inputs = paintBiome(params);
    let count = 0;
    for (const input of inputs) {
        const r = createNode(state.bridge, input);
        if (r.success) {
            state.bridge = r.data!;
            count++;
        }
    }
    afterMutation(state);
    return count;
}

// ─── Environment & Terrain mutations ───

export function opUpdateSettings(state: OperationsState, settingsPatch: Partial<WorldSnapshotSettings>) {
    state.bridge = updateSettings(state.bridge, settingsPatch);
    afterMutation(state);
    return { success: true };
}

export function opUpdatePaintData(state: OperationsState, paintData: string | null) {
    state.bridge = updatePaintData(state.bridge, paintData);
    afterMutation(state);
    return { success: true };
}

export function opUpdateSculptData(state: OperationsState, sculptData: string | null) {
    state.bridge = updateSculptData(state.bridge, sculptData);
    afterMutation(state);
    return { success: true };
}

// ─── Persistence operations ───

export async function opSaveWorld(state: OperationsState) {
    return state.store.save(getWorld(state.bridge));
}

export async function opLoadWorld(state: OperationsState, worldId: string) {
    const r = await state.store.load(worldId);
    if (!r.success) return r;
    state.bridge = loadWorldOperations(state.store, r.data!).bridge;
    afterMutation(state);
    return r;
}

export async function opListWorlds(state: OperationsState) {
    return state.store.list();
}

export async function opRenameWorld(
    state: OperationsState,
    worldId: string,
    name: string,
) {
    return state.store.rename(worldId, name);
}

export async function opDeleteWorld(state: OperationsState, worldId: string) {
    return state.store.delete(worldId);
}
