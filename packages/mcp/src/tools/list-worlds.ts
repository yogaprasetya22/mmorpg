/**
 * list-worlds tool.
 *
 * Location: packages/mcp/src/tools/list-worlds.ts
 */

import { opListWorlds } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";

export async function listWorldsTool(ops: OperationsState, _params: unknown) {
    const r = await opListWorlds(ops);
    if (!r.success) return fmtError(r.error!.message);
    return fmtResult({ worlds: r.data });
}
