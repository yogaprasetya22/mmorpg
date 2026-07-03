/**
 * rename-world tool.
 *
 * Location: packages/mcp/src/tools/rename-world.ts
 */

import { opRenameWorld } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";

export async function renameWorldTool(ops: OperationsState, params: unknown) {
    const { worldId, name } = params as { worldId: string; name: string };
    const r = await opRenameWorld(ops, worldId, name);
    if (!r.success) return fmtError(r.error!.message);
    return fmtResult({ success: true });
}
