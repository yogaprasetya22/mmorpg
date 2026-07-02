/**
 * save-world tool.
 *
 * Location: packages/mcp/src/tools/save-world.ts
 */

import { opSaveWorld } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";

export async function saveWorldTool(ops: OperationsState, _params: unknown) {
    const worldId = ops.bridge.snapshot.id;
    const r = await opSaveWorld(ops);
    if (!r.success) return fmtError(r.error!.message);
    return fmtResult({ success: true, worldId });
}
