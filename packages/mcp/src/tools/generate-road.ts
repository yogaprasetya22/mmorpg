/**
 * generate-road tool.
 *
 * Location: packages/mcp/src/tools/generate-road.ts
 */

import { opGenerateRoad } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import type { RoadNetworkParams } from "../../../world-core/src/index";

export function generateRoadTool(ops: OperationsState, params: unknown) {
    const p = params as RoadNetworkParams;
    if (!p.origin || p.seed === undefined) {
        return fmtError("Missing required: seed, origin");
    }
    const count = opGenerateRoad(ops, p);
    return fmtResult({ success: true, nodesCreated: count });
}
