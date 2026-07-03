/**
 * duplicate-region tool.
 *
 * Location: packages/mcp/src/tools/duplicate-region.ts
 */

import { opDuplicateRegion } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import { z } from "zod";

const DuplicateRegionSchema = z.object({
    nodeIds: z.array(z.string()).min(1),
    offset: z.object({ x: z.number(), y: z.number(), z: z.number() }),
});

export function duplicateRegionTool(ops: OperationsState, params: unknown) {
    const i = DuplicateRegionSchema.parse(params);
    const r = opDuplicateRegion(ops, i.nodeIds, i.offset);
    if (!r.success) return fmtError(r.error!.message);
    return fmtResult({ success: true });
}
