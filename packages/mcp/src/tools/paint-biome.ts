/**
 * paint-biome tool.
 *
 * Location: packages/mcp/src/tools/paint-biome.ts
 */

import { opPaintBiome } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import type { BiomeParams } from "../../../world-core/src/index";

export function paintBiomeTool(ops: OperationsState, params: unknown) {
    const p = params as BiomeParams;
    if (!p.center || !p.type || p.seed === undefined) {
        return fmtError("Missing required: seed, center, type");
    }
    const count = opPaintBiome(ops, p);
    return fmtResult({ success: true, nodesCreated: count });
}
