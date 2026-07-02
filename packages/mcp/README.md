# @jagres/mcp — World Editor MCP Server

AI-agent-ready MCP (Model Context Protocol) server for world editing operations. Headless core, deterministic generators, SSE live sync.

## Quick Start

```bash
# Install
cd packages/mcp && bun install

# Run stdio mode (for MCP clients like Claude Desktop, Cursor, etc.)
bun run src/server.ts

# Run HTTP mode with SSE
bun run src/server.ts --http --port 3000

# Connect SSE client
curl http://localhost:3000/events
```

## Architecture

Layered: **Transport → Server → Tools → Operations → Bridge → Engine State**

```
packages/
  world-core/           # Headless domain logic (no browser, no React)
    src/
      schema/           # Node, Transform, BoundingBox, WorldSnapshot types
      bridge/           # WorldBridge: CRUD, undo/redo, queries, validation
      generators/       # Deterministic world generators (seed-based PRNG)
      events.ts         # Pub/sub event bus for live sync
  mcp/
    src/
      server.ts         # Thin wiring orchestrator — imports layers, wires transport
      operations/       # Single gateway for all business flows
        world-operations.ts   # All op functions: opGetWorld, opCreateNode, etc.
      tools/            # 18 individual tool files (one per tool)
        index.ts        # Barrel + getTools() registry factory
        types.ts        # ToolHandler + ToolEntry
        helpers.ts      # fmtResult / fmtError
        get-world.ts, get-node.ts, find-nodes.ts, describe-node.ts,
        create-zone.ts, place-asset.ts, update-node.ts, delete-node.ts,
        duplicate-region.ts, undo.ts, redo.ts,
        check-collisions.ts, validate-world.ts,
        save-world.ts, load-world.ts, list-worlds.ts, rename-world.ts, delete-world.ts,
        generate-mountain-range.ts, generate-village.ts, generate-road.ts, paint-biome.ts
      resources/        # 3 resource files
        index.ts        # Barrel + getResources() registry
        types.ts        # ResourceHandler + ResourceEntry
        world-current.ts, world-summary.ts, asset-catalog.ts
      prompts/          # 3 prompt files
        index.ts        # Barrel + getPrompts() registry
        types.ts        # PromptHandler + PromptEntry
        from-brief.ts, iterate-on-feedback.ts, region-style-transfer.ts
      transports/       # Transport layer
        index.ts        # Barrel exports
        types.ts        # RpcId, RpcRequest, RpcResponse, ok/err helpers
        stdio.ts        # stdio transport (line-delimited JSON-RPC 2.0)
        http.ts         # HTTP transport (POST + SSE /events)
      storage/          # Persistence
        world-store.ts  # WorldStore interface + JSON file implementation
        types.ts        # Canonical type re-exports
        sqlite-world-store.ts  # SQLite stub (ponytail: implement when needed)
      __tests__/
        smoke.ts        # 40 assertions: bridge, generators, storage
```

**Architecture rule**: Tools call operations, operations call bridge + storage. No layer skips.

## Transport Modes

| Mode       | Flag              | Use Case                             |
| ---------- | ----------------- | ------------------------------------ |
| stdio      | default           | MCP clients (Claude Desktop, Cursor) |
| HTTP + SSE | `--http --port N` | Web frontend, custom clients         |

HTTP endpoints:

- `POST /` — MCP JSON-RPC 2.0
- `GET /events` — SSE event stream (live world updates)

Environment variables:

- `WORLD_DATA_DIR` — data directory (default: `./data/worlds`)
- `WORLD_MCP_HTTP_TOKEN` — Bearer token for HTTP auth

## Tools (18 total)

### Query

| Tool            | Description                                          |
| --------------- | ---------------------------------------------------- |
| `get_world`     | Current world summary (id, name, version, nodeCount) |
| `get_node`      | Full node details by ID                              |
| `find_nodes`    | Query by type, parent, tags, name pattern            |
| `describe_node` | Node details with child count and names              |

### Mutation

| Tool               | Description                                     |
| ------------------ | ----------------------------------------------- |
| `create_zone`      | Create node (zone, structure, vegetation, etc.) |
| `place_asset`      | Place structure asset at position               |
| `update_node`      | Patch node name, transform, properties          |
| `delete_node`      | Delete node and all descendants recursively     |
| `duplicate_region` | Clone nodes with position offset                |

### History

| Tool   | Description                   |
| ------ | ----------------------------- |
| `undo` | Roll back last mutation       |
| `redo` | Re-apply last undone mutation |

### Generation

| Tool                      | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `generate_mountain_range` | Mountain chain with peaks + foothills                |
| `generate_village`        | Village layout: buildings, rings, fences             |
| `generate_road`           | Road/river network with branching paths              |
| `paint_biome`             | Biome fill: forest, grassland, swamp, desert, tundra |

### Validation & Persistence

| Tool               | Description                               |
| ------------------ | ----------------------------------------- |
| `validate_world`   | Check duplicate IDs, orphan parents       |
| `check_collisions` | Find overlapping bounding boxes           |
| `save_world`       | Persist to disk (with optimistic locking) |
| `load_world`       | Load from disk                            |
| `list_worlds`      | List all saved worlds                     |
| `rename_world`     | Rename a world                            |
| `delete_world`     | Delete permanently                        |

## Resources

| URI                       | Description                   |
| ------------------------- | ----------------------------- |
| `world://current`         | Full world snapshot           |
| `world://current/summary` | Summary (id, name, nodeCount) |
| `world://catalog/assets`  | Available asset list          |

## Prompts

| Name                    | Description                               |
| ----------------------- | ----------------------------------------- |
| `from_brief`            | Text description → world operations plan  |
| `iterate_on_feedback`   | Revise layout from feedback               |
| `region_style_transfer` | Change area style (e.g. forest → village) |

## Example Scenarios

### Scenario 1: "Build a medieval village in a valley"

```jsonc
// 1. Create valley zone
{ "method": "tools/call", "params": { "name": "create_zone", "arguments": {
  "type": "zone", "name": "Green Valley", "position": { "x": 0, "y": 0, "z": 0 },
  "scale": { "x": 100, "y": 0.1, "z": 100 },
  "tags": ["valley"]
}}}

// 2. Paint grassland biome
{ "method": "tools/call", "params": { "name": "paint_biome", "arguments": {
  "seed": 42, "type": "grassland", "center": { "x": 0, "y": 0, "z": 0 },
  "radius": 50, "density": 0.5
}}}

// 3. Generate village
{ "method": "tools/call", "params": { "name": "generate_village", "arguments": {
  "seed": 123, "center": { "x": 0, "y": 0, "z": 0 },
  "radius": 30, "buildingCount": 15
}}}

// 4. Save
{ "method": "tools/call", "params": { "name": "save_world" }}
```

### Scenario 2: "Add northern mountains + river to south"

```jsonc
// 1. Generate mountain range in north
{ "method": "tools/call", "params": { "name": "generate_mountain_range", "arguments": {
  "seed": 77, "center": { "x": 0, "y": 0, "z": -80 },
  "peakCount": 7, "spacing": 15, "maxHeight": 20, "direction": "x"
}}}

// 2. Generate river flowing south
{ "method": "tools/call", "params": { "name": "generate_road", "arguments": {
  "seed": 88, "origin": { "x": 0, "y": -0.5, "z": -50 },
  "destination": { "x": 10, "y": -0.5, "z": 80 },
  "roadType": "river", "segmentCount": 12, "winding": 0.5, "branchChance": 0.1
}}}

// 3. Validate
{ "method": "tools/call", "params": { "name": "validate_world" }}

// 4. Save
{ "method": "tools/call", "params": { "name": "save_world" }}
```

## Error Codes

| Code                   | Meaning                              |
| ---------------------- | ------------------------------------ |
| `validation_error`     | Input failed Zod schema validation   |
| `not_found`            | Node or world not found              |
| `version_conflict`     | Optimistic locking conflict on save  |
| `constraint_violation` | Operation violates world constraints |
| `not_implemented`      | Feature not yet implemented          |
| `internal_error`       | Unexpected server error              |

## MCP Client Configuration

### Claude Desktop (`claude_desktop_config.json`)

```json
{
    "mcpServers": {
        "world-editor": {
            "command": "bun",
            "args": ["run", "packages/mcp/src/server.ts"],
            "cwd": "/path/to/project"
        }
    }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
    "mcpServers": {
        "world-editor": {
            "command": "bun",
            "args": ["run", "packages/mcp/src/server.ts"],
            "cwd": "/path/to/project"
        }
    }
}
```

## Testing

```bash
bun run packages/mcp/src/__tests__/smoke.ts
# Expected: 40 passed, 0 failed
```

## Migration Notes

Architecture layers (from old monolithic `useEditorStore` 1561 lines):

- **Before**: UI mutated store directly, no headless capability, Math.random() IDs, no AI integration
- **After**: `Transport → Server → Tools → Operations → Bridge → Engine State`. Frontend becomes thin renderer subscribing to SSE events
- Operations layer is sole business flow gateway — tools never mutate state directly
- All IDs use `crypto.randomUUID()` via `buildNodeId()`
- Generators use mulberry32 seeded PRNG — deterministic output given same seed
- Optimistic locking via `version` field prevents concurrent save corruption
- SQLite store stub ready; implement `createSqliteWorldStore()` when file-based outgrown
