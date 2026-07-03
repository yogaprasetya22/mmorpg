/**
 * delete-node tool.
 *
 * Location: packages/mcp/src/tools/delete-node.ts
 */

import { opDeleteNode } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";

export function deleteNodeTool(ops: OperationsState, params: unknown) {
    const { id } = params as { id: string };
    const r = opDeleteNode(ops, id);
    if (!r.success) return fmtError(r.error!.message);
    return fmtResult({ success: true });
}
