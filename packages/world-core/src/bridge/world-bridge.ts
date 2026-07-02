/**
 * WorldBridge — headless core state container for world nodes.
 * Runs without browser. All mutations via bridge, not direct state access.
 *
 * Location: packages/world-core/src/bridge/world-bridge.ts
 */

import {
    type WorldNode,
    type WorldSnapshot,
    type CreateNodeInput,
    type UpdateNodeInput,
    type NodeId,
    type NodeQuery,
    type Transform,
    type BoundingBox,
    asNodeId,
} from "../schema/node";
import {
    ERROR_CODES,
    type OperationResult,
    type OperationError,
} from "../schema/error-codes";
import { buildNodeId } from "./node-ids";

// ─── Bridge state ───
export interface BridgeState {
    snapshot: WorldSnapshot;
    undoStack: WorldNode[][]; // snapshots of nodes arrays
    redoStack: WorldNode[][];
}

function cloneNodes(nodes: WorldNode[]): WorldNode[] {
    return nodes.map((n) => ({
        ...n,
        children: [...n.children],
        transform: {
            position: { ...n.transform.position },
            rotation: { ...n.transform.rotation },
            scale: { ...n.transform.scale },
        },
        bounds: n.bounds
            ? {
                  min: { ...n.bounds.min },
                  max: { ...n.bounds.max },
              }
            : null,
        properties: { ...n.properties },
        tags: [...n.tags],
    }));
}

const EMPTY_TRANSFORM: Transform = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
};

export function createWorldBridge(
    name: string = "Untitled World",
): BridgeState {
    const initialSnapshot: WorldSnapshot = {
        id: buildNodeId(),
        name,
        version: 1,
        nodes: [],
        items: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    return {
        snapshot: initialSnapshot,
        undoStack: [],
        redoStack: [],
    };
}

// ─── Core operations ───

export function getWorld(state: BridgeState): WorldSnapshot {
    return state.snapshot;
}

export function setWorld(
    state: BridgeState,
    snapshot: WorldSnapshot,
): BridgeState {
    return { ...state, snapshot, undoStack: [], redoStack: [] };
}

export function updateSettings(
    state: BridgeState,
    settingsPatch: Partial<import("../schema/node").WorldSnapshotSettings>,
): BridgeState {
    const nextSettings = {
        gridSize: 1,
        gridEnabled: true,
        terrainConfig: { height: 12.0, scale: 0.05, seed: 0, sharpness: 2.0 },
        terrainColor: "#3d5c36",
        terrainMaterialId: null,
        sky: "sunset",
        environment: "STORM",
        lightIntensity: null,
        ambientIntensity: null,
        sunAngle: 45,
        fogDensity: 0.002,
        skyboxIntensity: null,
        bloomThreshold: null,
        bloomStrength: null,
        bloomRadius: null,
        ...(state.snapshot.settings || {}),
        ...settingsPatch,
    };
    
    // Deep clone nested configs to prevent shared mutations
    if (settingsPatch.terrainConfig) {
        nextSettings.terrainConfig = {
            ...(state.snapshot.settings?.terrainConfig || { height: 12.0, scale: 0.05, seed: 0, sharpness: 2.0 }),
            ...settingsPatch.terrainConfig,
        };
    }

    return {
        ...state,
        snapshot: {
            ...state.snapshot,
            version: state.snapshot.version + 1,
            settings: nextSettings,
            updatedAt: new Date().toISOString(),
        },
    };
}

export function updatePaintData(
    state: BridgeState,
    paintData: string | null,
): BridgeState {
    return {
        ...state,
        snapshot: {
            ...state.snapshot,
            version: state.snapshot.version + 1,
            paintData,
            updatedAt: new Date().toISOString(),
        },
    };
}

export function updateSculptData(
    state: BridgeState,
    sculptData: string | null,
): BridgeState {
    return {
        ...state,
        snapshot: {
            ...state.snapshot,
            version: state.snapshot.version + 1,
            sculptData,
            updatedAt: new Date().toISOString(),
        },
    };
}


export function createNode(
    state: BridgeState,
    input: CreateNodeInput,
): OperationResult<BridgeState> {
    try {
        const now = new Date().toISOString();
        const node: WorldNode = {
            id: asNodeId(buildNodeId()),
            type: input.type,
            name: input.name,
            parentId: input.parentId ?? null,
            children: [],
            transform: {
                position: input.position ?? { x: 0, y: 0, z: 0 },
                rotation: input.rotation ?? { x: 0, y: 0, z: 0 },
                scale: input.scale ?? { x: 1, y: 1, z: 1 },
            },
            bounds: null,
            properties: input.properties ?? {},
            tags: input.tags ?? [],
            createdAt: now,
            updatedAt: now,
        };

        // Add parent-child link if parentId specified
        const nodesBefore = state.snapshot.nodes;
        const nodes = nodesBefore.map((n) => {
            if (input.parentId && n.id === input.parentId) {
                return { ...n, children: [...n.children, node.id] };
            }
            return n;
        });

        const newNodes = [...nodes, node];
        const newSnapshot: WorldSnapshot = {
            ...state.snapshot,
            version: state.snapshot.version + 1,
            nodes: newNodes,
            updatedAt: now,
        };
        const newUndoStack = [
            ...state.undoStack,
            cloneNodes(nodesBefore),
        ].slice(-50);

        return {
            success: true,
            data: {
                snapshot: newSnapshot,
                undoStack: newUndoStack,
                redoStack: [],
            },
            error: null,
        };
    } catch (err: any) {
        return {
            success: false,
            data: null,
            error: { code: ERROR_CODES.INTERNAL_ERROR, message: err.message },
        };
    }
}

export function updateNode(
    state: BridgeState,
    input: UpdateNodeInput,
): OperationResult<BridgeState> {
    try {
        const now = new Date().toISOString();
        const nodesBefore = state.snapshot.nodes;
        const idx = nodesBefore.findIndex((n) => n.id === input.id);
        if (idx === -1) {
            return {
                success: false,
                data: null,
                error: {
                    code: ERROR_CODES.NOT_FOUND,
                    message: `Node ${input.id} not found`,
                },
            };
        }

        const existing = nodesBefore[idx];
        const updated: WorldNode = {
            ...existing,
            name: input.name ?? existing.name,
            parentId:
                input.parentId !== undefined
                    ? input.parentId
                    : existing.parentId,
            transform: {
                position: { ...existing.transform.position, ...input.position },
                rotation: { ...existing.transform.rotation, ...input.rotation },
                scale: { ...existing.transform.scale, ...input.scale },
            },
            properties:
                input.properties !== undefined
                    ? { ...existing.properties, ...input.properties }
                    : existing.properties,
            tags: input.tags ?? existing.tags,
            updatedAt: now,
        };

        const newNodes = [...nodesBefore];
        newNodes[idx] = updated;

        const newSnapshot: WorldSnapshot = {
            ...state.snapshot,
            version: state.snapshot.version + 1,
            nodes: newNodes,
            updatedAt: now,
        };
        const newUndoStack = [
            ...state.undoStack,
            cloneNodes(nodesBefore),
        ].slice(-50);

        return {
            success: true,
            data: {
                snapshot: newSnapshot,
                undoStack: newUndoStack,
                redoStack: [],
            },
            error: null,
        };
    } catch (err: any) {
        return {
            success: false,
            data: null,
            error: { code: ERROR_CODES.INTERNAL_ERROR, message: err.message },
        };
    }
}

export function deleteNode(
    state: BridgeState,
    id: NodeId,
): OperationResult<BridgeState> {
    try {
        const now = new Date().toISOString();
        const nodesBefore = state.snapshot.nodes;
        const node = nodesBefore.find((n) => n.id === id);
        if (!node) {
            return {
                success: false,
                data: null,
                error: {
                    code: ERROR_CODES.NOT_FOUND,
                    message: `Node ${id} not found`,
                },
            };
        }

        // Recursively collect all children
        const toDelete = new Set<NodeId>();
        function collectDescendants(nid: NodeId) {
            toDelete.add(nid);
            const n = nodesBefore.find((x) => x.id === nid);
            if (n) n.children.forEach(collectDescendants);
        }
        collectDescendants(id);

        const newNodes = nodesBefore
            .filter((n) => !toDelete.has(n.id))
            .map((n) => ({
                ...n,
                children: n.children.filter((cid) => !toDelete.has(cid)),
            }));

        const newSnapshot: WorldSnapshot = {
            ...state.snapshot,
            version: state.snapshot.version + 1,
            nodes: newNodes,
            updatedAt: now,
        };
        const newUndoStack = [
            ...state.undoStack,
            cloneNodes(nodesBefore),
        ].slice(-50);

        return {
            success: true,
            data: {
                snapshot: newSnapshot,
                undoStack: newUndoStack,
                redoStack: [],
            },
            error: null,
        };
    } catch (err: any) {
        return {
            success: false,
            data: null,
            error: { code: ERROR_CODES.INTERNAL_ERROR, message: err.message },
        };
    }
}

export function duplicateRegion(
    state: BridgeState,
    nodeIds: NodeId[],
    offset: { x: number; y: number; z: number },
): OperationResult<BridgeState> {
    try {
        const now = new Date().toISOString();
        const nodesBefore = state.snapshot.nodes;
        const toDuplicate = new Set(nodeIds);

        const sourceNodes = nodesBefore.filter((n) => toDuplicate.has(n.id));
        if (sourceNodes.length === 0) {
            return {
                success: false,
                data: null,
                error: {
                    code: ERROR_CODES.NOT_FOUND,
                    message: "No nodes to duplicate",
                },
            };
        }

        // Build old→new ID mapping
        const idMap = new Map<NodeId, NodeId>();
        for (const n of sourceNodes) {
            idMap.set(n.id, asNodeId(buildNodeId()));
        }

        const duplicates: WorldNode[] = sourceNodes.map((n) => ({
            ...n,
            id: idMap.get(n.id)!,
            parentId:
                n.parentId && idMap.has(n.parentId)
                    ? idMap.get(n.parentId)!
                    : n.parentId,
            children: n.children
                .filter((cid) => idMap.has(cid))
                .map((cid) => idMap.get(cid)!),
            transform: {
                position: {
                    x: n.transform.position.x + offset.x,
                    y: n.transform.position.y + offset.y,
                    z: n.transform.position.z + offset.z,
                },
                rotation: { ...n.transform.rotation },
                scale: { ...n.transform.scale },
            },
            createdAt: now,
            updatedAt: now,
        }));

        const newNodes = [...nodesBefore, ...duplicates];
        const newSnapshot: WorldSnapshot = {
            ...state.snapshot,
            version: state.snapshot.version + 1,
            nodes: newNodes,
            updatedAt: now,
        };
        const newUndoStack = [
            ...state.undoStack,
            cloneNodes(nodesBefore),
        ].slice(-50);

        return {
            success: true,
            data: {
                snapshot: newSnapshot,
                undoStack: newUndoStack,
                redoStack: [],
            },
            error: null,
        };
    } catch (err: any) {
        return {
            success: false,
            data: null,
            error: { code: ERROR_CODES.INTERNAL_ERROR, message: err.message },
        };
    }
}

// ─── Query ───

export function getNode(state: BridgeState, id: NodeId): WorldNode | null {
    return state.snapshot.nodes.find((n) => n.id === id) ?? null;
}

export function findNodes(state: BridgeState, query: NodeQuery): WorldNode[] {
    let result = state.snapshot.nodes;

    if (query.type) {
        const types = Array.isArray(query.type) ? query.type : [query.type];
        result = result.filter((n) => types.includes(n.type));
    }
    if (query.parentId !== undefined) {
        result = result.filter((n) => n.parentId === query.parentId);
    }
    if (query.tag) {
        const tags = Array.isArray(query.tag) ? query.tag : [query.tag];
        result = result.filter((n) => tags.some((t) => n.tags.includes(t)));
    }
    if (query.namePattern) {
        const p = query.namePattern.toLowerCase();
        result = result.filter((n) => n.name.toLowerCase().includes(p));
    }
    if (query.bounds) {
        result = result.filter((n) => {
            if (!n.bounds) return false;
            return (
                n.bounds.max.x >= query.bounds!.min.x &&
                n.bounds.min.x <= query.bounds!.max.x &&
                n.bounds.max.z >= query.bounds!.min.z &&
                n.bounds.min.z <= query.bounds!.max.z
            );
        });
    }

    return result;
}

// ─── Undo / Redo ───

export function undo(state: BridgeState): OperationResult<BridgeState> {
    if (state.undoStack.length === 0) {
        return {
            success: false,
            data: null,
            error: { code: ERROR_CODES.NOT_FOUND, message: "Nothing to undo" },
        };
    }
    const prevNodes = state.undoStack[state.undoStack.length - 1];
    const currentNodes = state.snapshot.nodes;
    const newSnapshot: WorldSnapshot = {
        ...state.snapshot,
        version: state.snapshot.version + 1,
        nodes: prevNodes,
        updatedAt: new Date().toISOString(),
    };
    return {
        success: true,
        data: {
            snapshot: newSnapshot,
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, cloneNodes(currentNodes)],
        },
        error: null,
    };
}

export function redo(state: BridgeState): OperationResult<BridgeState> {
    if (state.redoStack.length === 0) {
        return {
            success: false,
            data: null,
            error: { code: ERROR_CODES.NOT_FOUND, message: "Nothing to redo" },
        };
    }
    const nextNodes = state.redoStack[state.redoStack.length - 1];
    const currentNodes = state.snapshot.nodes;
    const newSnapshot: WorldSnapshot = {
        ...state.snapshot,
        version: state.snapshot.version + 1,
        nodes: nextNodes,
        updatedAt: new Date().toISOString(),
    };
    return {
        success: true,
        data: {
            snapshot: newSnapshot,
            undoStack: [...state.undoStack, cloneNodes(currentNodes)],
            redoStack: state.redoStack.slice(0, -1),
        },
        error: null,
    };
}

// ─── Validation ───

export function checkCollisions(
    state: BridgeState,
    id?: NodeId,
): { nodeA: NodeId; nodeB: NodeId; overlap: number }[] {
    const nodes = state.snapshot.nodes;
    const collisions: { nodeA: NodeId; nodeB: NodeId; overlap: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            if (id && nodes[i].id !== id && nodes[j].id !== id) continue;
            const a = nodes[i].bounds;
            const b = nodes[j].bounds;
            if (!a || !b) continue;
            const overlapX = Math.max(
                0,
                Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x),
            );
            const overlapZ = Math.max(
                0,
                Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z),
            );
            const overlap = overlapX * overlapZ;
            if (overlap > 0) {
                collisions.push({
                    nodeA: nodes[i].id,
                    nodeB: nodes[j].id,
                    overlap,
                });
            }
        }
    }
    return collisions;
}

// ─── Describe ───

export function describeNode(
    state: BridgeState,
    id: NodeId,
): Record<string, unknown> | null {
    const node = getNode(state, id);
    if (!node) return null;
    const children = node.children
        .map((cid) => getNode(state, cid))
        .filter(Boolean) as WorldNode[];
    return {
        ...node,
        childCount: children.length,
        childNames: children.map((c) => c.name),
    };
}
