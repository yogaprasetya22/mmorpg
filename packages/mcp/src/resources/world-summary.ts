/**
 * world-summary resource.
 *
 * Location: packages/mcp/src/resources/world-summary.ts
 */

import type { OperationsState } from "../operations/world-operations";
import { opGetWorld } from "../operations/world-operations";

export async function worldSummaryResource(ops: OperationsState) {
    const w = opGetWorld(ops);
    const typeCount: Record<string, number> = {};
    for (const n of w.nodes) {
        typeCount[n.type] = (typeCount[n.type] ?? 0) + 1;
    }
    return {
        uri: "world://current/summary",
        mimeType: "application/json",
        text: JSON.stringify(
            {
                id: w.id,
                name: w.name,
                version: w.version,
                totalNodes: w.nodes.length,
                byType: typeCount,
            },
            null,
            2,
        ),
    };
}
