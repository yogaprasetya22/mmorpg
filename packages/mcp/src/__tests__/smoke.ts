/**
 * Smoke test — verifies bridge, generators, and storage.
 * Run: bun run packages/mcp/src/__tests__/smoke.ts
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
    undo,
    redo,
    describeNode,
    checkCollisions,
    asNodeId,
    generateMountainRange,
    createVillageLayout,
    generateRoadNetwork,
    paintBiome,
} from "../../../world-core/src/index";
import { createJsonWorldStore } from "../../src/storage/world-store";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dirname ?? ".", ".tmp-smoke");
let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
    if (condition) {
        passed++;
        return;
    }
    failed++;
    console.error(`FAIL: ${msg}`);
}

// Setup
if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
mkdirSync(TEST_DIR, { recursive: true });

// ─── Bridge tests ───
let bridge = createWorldBridge("Smoke Test World");

const w = getWorld(bridge);
assert(w.name === "Smoke Test World", "bridge: getWorld returns name");
assert(w.nodes.length === 0, "bridge: empty world has 0 nodes");
assert(w.version === 1, "bridge: initial version = 1");

// createNode
let r = createNode(bridge, {
    type: "zone",
    name: "Test Zone",
    position: { x: 0, y: 0, z: 0 },
});
assert(r.success, "bridge: createNode succeeds");
bridge = r.data!;
assert(
    bridge.snapshot.nodes.length === 1,
    "bridge: node count after create = 1",
);
const nodeId = bridge.snapshot.nodes[0].id;

// getNode
const n = getNode(bridge, nodeId);
assert(n !== null, "bridge: getNode finds created node");
assert(n?.name === "Test Zone", "bridge: getNode name matches");

// updateNode — pushes to undoStack
r = updateNode(bridge, { id: nodeId, name: "Updated Zone" });
assert(r.success, "bridge: updateNode succeeds");
bridge = r.data!;
assert(
    bridge.undoStack.length >= 1,
    "bridge: undoStack has entries after update",
);
const n2 = getNode(bridge, nodeId);
assert(n2?.name === "Updated Zone", "bridge: updateNode changed name");

// undo — should restore "Test Zone"
const undoR = undo(bridge);
assert(undoR.success, "bridge: undo succeeds");
bridge = undoR.data!;
const n3 = getNode(bridge, nodeId);
assert(n3?.name === "Test Zone", "bridge: undo restored original name");

// redo — should go back to "Updated Zone"
const redoR = redo(bridge);
assert(redoR.success, "bridge: redo succeeds");
bridge = redoR.data!;
const n4 = getNode(bridge, nodeId);
assert(n4?.name === "Updated Zone", "bridge: redo restored updated name");

// deleteNode
r = deleteNode(bridge, nodeId);
assert(r.success, "bridge: deleteNode succeeds");
bridge = r.data!;
assert(
    bridge.snapshot.nodes.length === 0,
    "bridge: node count after delete = 0",
);

// findNodes
r = createNode(bridge, { type: "mountain", name: "Peak A", tags: ["alps"] });
bridge = r.data!;
r = createNode(bridge, { type: "vegetation", name: "Oak", tags: ["forest"] });
bridge = r.data!;
const found = findNodes(bridge, { type: "mountain" });
assert(found.length === 1, "bridge: findNodes by type returns 1");
const foundTag = findNodes(bridge, { tag: "forest" });
assert(foundTag.length === 1, "bridge: findNodes by tag returns 1");
const foundName = findNodes(bridge, { namePattern: "Peak" });
assert(foundName.length === 1, "bridge: findNodes by namePattern works");

// describeNode
const desc = describeNode(bridge, found[0].id);
assert(desc !== null, "bridge: describeNode returns data");
assert((desc as any).childCount === 0, "bridge: describeNode childCount = 0");

// duplicateRegion
r = duplicateRegion(bridge, [found[0].id], { x: 10, y: 0, z: 0 });
assert(r.success, "bridge: duplicateRegion succeeds");
bridge = r.data!;
const dupNodes = findNodes(bridge, { type: "mountain" });
assert(dupNodes.length === 2, "bridge: duplicateRegion creates copy");

// checkCollisions
const cols = checkCollisions(bridge);
assert(Array.isArray(cols), "bridge: checkCollisions returns array");

// ─── Generator tests ───
const mountainInputs = generateMountainRange({
    seed: 42,
    center: { x: 0, y: 0, z: 0 },
});
assert(mountainInputs.length > 0, "generator: mountainRange produces nodes");
assert(
    mountainInputs[0].type === "mountain",
    "generator: mountainRange node type correct",
);

const villageInputs = createVillageLayout({
    seed: 123,
    center: { x: 0, y: 0, z: 0 },
});
assert(villageInputs.length > 5, "generator: villageLayout produces >5 nodes");

const roadInputs = generateRoadNetwork({
    seed: 7,
    origin: { x: 0, y: 0, z: 0 },
    destination: { x: 50, y: 0, z: 50 },
});
assert(roadInputs.length > 0, "generator: roadNetwork produces nodes");

const biomeInputs = paintBiome({
    seed: 99,
    type: "forest",
    center: { x: 0, y: 0, z: 0 },
    radius: 20,
});
assert(biomeInputs.length > 10, "generator: paintBiome produces >10 nodes");

// ─── Storage tests (async) ───
const store = createJsonWorldStore(TEST_DIR);
const saveResult = await store.save(bridge.snapshot);
assert(saveResult.success, "storage: save succeeds");

const listResult = await store.list();
assert(listResult.success, "storage: list succeeds");
assert(listResult.data!.length === 1, "storage: list returns 1 world");

const loadResult = await store.load(bridge.snapshot.id);
assert(loadResult.success, "storage: load succeeds");
assert(
    loadResult.data!.name === "Smoke Test World",
    "storage: loaded name matches",
);

const renameResult = await store.rename(bridge.snapshot.id, "Renamed World");
assert(renameResult.success, "storage: rename succeeds");

const loadRenamed = await store.load(bridge.snapshot.id);
assert(loadRenamed.success, "storage: loaded renamed world");
assert(
    loadRenamed.data!.name === "Renamed World",
    "storage: renamed name matches",
);

// Optimistic locking
const saveV2Result = await store.save({ ...bridge.snapshot, version: 99 }, 1);
assert(!saveV2Result.success, "storage: version conflict detected");

const deleteResult = await store.delete(bridge.snapshot.id);
assert(deleteResult.success, "storage: delete succeeds");

const loadDeleted = await store.load(bridge.snapshot.id);
assert(!loadDeleted.success, "storage: load deleted world fails");

// Cleanup
rmSync(TEST_DIR, { recursive: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
