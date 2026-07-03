/**
 * generate-village tool.
 *
 * Location: packages/mcp/src/tools/generate-village.ts
 */

import { opGenerateVillage } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import type { VillageParams } from "../../../world-core/src/index";

export function generateVillageTool(ops: OperationsState, params: unknown) {
    const p = params as VillageParams;
    if (!p.center || p.seed === undefined) {
        return fmtError("Missing required: seed, center");
    }
    const count = opGenerateVillage(ops, p);
    return fmtResult({ success: true, nodesCreated: count });
}
