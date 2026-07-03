/**
 * MCP server — thin wiring orchestrator.
 * Layers: Transport → Server → Tools → Operations → Bridge → Engine State
 *
 * Location: packages/mcp/src/server.ts
 */

import {
    createWorldOperations,
    setLiveSyncHook,
    opGetWorld,
    type OperationsState,
} from "./operations/world-operations";
import { getTools } from "./tools/index";
import { getResources } from "./resources/index";
import { getPrompts } from "./prompts/index";
import {
    runStdio,
    runHttp,
    err,
    ok,
    type RpcRequest,
    type RpcResponse,
    type SseBroadcaster,
} from "./transports/index";
import { createJsonWorldStore } from "./storage/world-store";

// ─── Config ───
const DATA_DIR = process.env.WORLD_DATA_DIR ?? "./data/worlds";
const DB_PATH = process.env.WORLD_DB_PATH ?? DATA_DIR;

const store = createJsonWorldStore(DB_PATH);
const ops: OperationsState = createWorldOperations(store, "Untitled World");

// ─── SSE clients (HTTP mode) ───
const sseClients = new Set<SseBroadcaster>();

// ─── Inject SSE broadcast into operations layer ───
setLiveSyncHook(() => {
    const snap = opGetWorld(ops);
    const payload = JSON.stringify({
        type: "snapshot:changed",
        snapshot: {
            id: snap.id,
            name: snap.name,
            version: snap.version,
            nodeCount: snap.nodes.length,
        },
    });
    for (const send of sseClients) {
        try {
            send(payload);
        } catch {
            sseClients.delete(send);
        }
    }
});

// ─── Tool descriptions ───
const TOOL_DESC: Record<string, string> = {
    get_world: "Get current world summary",
    get_node: "Get full details of a node by ID",
    find_nodes: "Query nodes by type, parent, tags, name pattern",
    describe_node: "Node details with child count",
    create_zone: "Create a new zone/village/structure node",
    place_asset: "Place a structure asset at position",
    update_node: "Update node name, transform, properties",
    delete_node: "Delete node and all children recursively",
    duplicate_region: "Duplicate nodes with offset",
    undo: "Undo last mutation",
    redo: "Redo last undone mutation",
    check_collisions: "Check spatial collisions between nodes",
    validate_world: "Validate world integrity (dup IDs, orphan parents)",
    update_settings: "Update terrain material/color, skybox, lighting parameters and bloom settings",
    update_paint_data: "Update terrain paint splat canvas base64 image data URL string",
    update_sculpt_data: "Update terrain sculpt heightmap canvas base64 image data URL string",
    save_world: "Persist world to disk",
    load_world: "Load world from disk by ID",
    list_worlds: "List all saved worlds",
    rename_world: "Rename a saved world",
    delete_world: "Delete a saved world permanently",
    generate_mountain_range:
        "Generate a mountain range (deterministic by seed)",
    generate_village: "Generate a village layout with buildings and fences",
    generate_road: "Generate road/river network with branches",
    paint_biome:
        "Paint a biome zone (forest, grassland, swamp, desert, tundra)",
};

// ─── Layer registries ───
const tools = getTools(ops);
const resources = getResources(ops);
const prompts = getPrompts(ops);

// ─── MCP protocol handler ───
async function handleRequest(req: RpcRequest): Promise<RpcResponse> {
    try {
        switch (req.method) {
            case "initialize":
                return ok(req.id, {
                    protocolVersion: "2024-11-05",
                    serverInfo: { name: "world-mcp", version: "0.1.0" },
                    capabilities: { tools: {}, resources: {}, prompts: {} },
                });

            case "tools/list": {
                const toolList = [...tools.entries()].map(([name]) => ({
                    name,
                    description: TOOL_DESC[name] ?? name,
                    inputSchema: { type: "object", properties: {} },
                }));
                return ok(req.id, { tools: toolList });
            }

            case "tools/call": {
                const { name, arguments: args } = (req.params ?? {}) as {
                    name: string;
                    arguments?: unknown;
                };
                const tool = tools.get(name);
                if (!tool)
                    return err(req.id, -32601, `Tool not found: ${name}`);
                const result = await tool.handler(args ?? {});
                return ok(req.id, result);
            }

            case "resources/list": {
                const list = resources.map((r) => ({
                    uri: r.uri,
                    name: r.name,
                }));
                return ok(req.id, { resources: list });
            }

            case "resources/read": {
                const { uri } = (req.params ?? {}) as { uri: string };
                const res = resources.find((r) => r.uri === uri);
                if (!res) {
                    return err(req.id, -32602, `Resource not found: ${uri}`);
                }
                const contents = [await res.handler(uri)];
                return ok(req.id, { contents });
            }

            case "prompts/list": {
                const list = prompts.map((p) => ({
                    name: p.name,
                    description: p.description,
                }));
                return ok(req.id, { prompts: list });
            }

            case "prompts/get": {
                const { name, arguments: args } = (req.params ?? {}) as {
                    name: string;
                    arguments?: Record<string, string>;
                };
                const p = prompts.find((x) => x.name === name);
                if (!p) {
                    return err(req.id, -32602, `Prompt not found: ${name}`);
                }
                const result = await p.handler(args);
                return ok(req.id, result);
            }

            default:
                return err(req.id, -32601, `Method not found: ${req.method}`);
        }
    } catch (e: any) {
        return err(req.id, -32603, e.message);
    }
}

// ─── CLI entry ───
const args = process.argv.slice(2);
if (args.includes("--http")) {
    const pi = args.indexOf("--port");
    const port = pi >= 0 ? parseInt(args[pi + 1] ?? "3000", 10) : 3000;
    runHttp({
        port,
        token: process.env.WORLD_MCP_HTTP_TOKEN,
        getSnapshot: () => opGetWorld(ops),
        sseClients,
        handler: handleRequest,
    });
} else {
    runStdio(handleRequest);
}
