/**
 * delete-world tool.
 *
 * Location: packages/mcp/src/tools/delete-world.ts
 */

import { opDeleteWorld } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";

export async function deleteWorldTool(ops: OperationsState, params: unknown) {
    const { worldId } = params as { worldId: string };
    const r = await opDeleteWorld(ops, worldId);
    if (!r.success) return fmtError(r.error!.message);
    return fmtResult({ success: true });
}
