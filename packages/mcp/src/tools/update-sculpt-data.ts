/**
 * update-sculpt-data tool.
 *
 * Location: packages/mcp/src/tools/update-sculpt-data.ts
 */

import { opUpdateSculptData } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import { z } from "zod";

const UpdateSculptSchema = z.object({
    sculptData: z.string().nullable(), // Canvas base64 data URL string representing the heightmap
});

export function updateSculptDataTool(ops: OperationsState, params: unknown) {
    try {
        const { sculptData } = UpdateSculptSchema.parse(params);
        const r = opUpdateSculptData(ops, sculptData);
        return fmtResult(r);
    } catch (e: any) {
        return fmtError(e.message);
    }
}
