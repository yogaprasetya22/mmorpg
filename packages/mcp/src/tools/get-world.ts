/**
 * get-world tool.
 *
 * Location: packages/mcp/src/tools/get-world.ts
 */

import type { OperationsState } from "../operations/world-operations";
import { fmtResult } from "./helpers";

export function getWorldTool(ops: OperationsState) {
    const w = ops.bridge.snapshot;
    return fmtResult({
        id: w.id,
        name: w.name,
        version: w.version,
        nodeCount: w.nodes.length,
    });
}
