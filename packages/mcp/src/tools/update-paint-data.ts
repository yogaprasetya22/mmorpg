/**
 * update-paint-data tool.
 *
 * Location: packages/mcp/src/tools/update-paint-data.ts
 */

import { opUpdatePaintData } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import { z } from "zod";

const UpdatePaintSchema = z.object({
    paintData: z.string().nullable(), // Canvas base64 data URL string representing the splat texture painting data
});

export function updatePaintDataTool(ops: OperationsState, params: unknown) {
    try {
        const { paintData } = UpdatePaintSchema.parse(params);
        const r = opUpdatePaintData(ops, paintData);
        return fmtResult(r);
    } catch (e: any) {
        return fmtError(e.message);
    }
}
