/**
 * world-current resource.
 *
 * Location: packages/mcp/src/resources/world-current.ts
 */

import type { OperationsState } from "../operations/world-operations";
import { opGetWorld } from "../operations/world-operations";

export async function worldCurrentResource(ops: OperationsState) {
    const w = opGetWorld(ops);
    return {
        uri: "world://current",
        mimeType: "application/json",
        text: JSON.stringify(
            {
                id: w.id,
                name: w.name,
                version: w.version,
                nodeCount: w.nodes.length,
            },
            null,
            2,
        ),
    };
}
