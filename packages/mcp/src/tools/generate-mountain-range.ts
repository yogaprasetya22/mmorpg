/**
 * generate-mountain-range tool.
 *
 * Location: packages/mcp/src/tools/generate-mountain-range.ts
 */

import { opGenerateMountainRange } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import type { MountainRangeParams } from "../../../world-core/src/index";

export function generateMountainRangeTool(
    ops: OperationsState,
    params: unknown,
) {
    const p = params as MountainRangeParams;
    if (!p.center || p.seed === undefined) {
        return fmtError("Missing required: seed, center");
    }
    const count = opGenerateMountainRange(ops, p);
    return fmtResult({ success: true, nodesCreated: count });
}
