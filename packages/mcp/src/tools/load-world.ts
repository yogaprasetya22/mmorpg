/**
 * load-world tool.
 *
 * Location: packages/mcp/src/tools/load-world.ts
 */

import { opLoadWorld } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";

export async function loadWorldTool(ops: OperationsState, params: unknown) {
    const { worldId } = params as { worldId: string };
    const r = await opLoadWorld(ops, worldId);
    if (!r.success) return fmtError(r.error!.message);
    return fmtResult({
        success: true,
        name: ops.bridge.snapshot.name,
        nodeCount: ops.bridge.snapshot.nodes.length,
    });
}
