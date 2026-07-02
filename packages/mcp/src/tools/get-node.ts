/**
 * get-node tool.
 *
 * Location: packages/mcp/src/tools/get-node.ts
 */

import type { OperationsState } from "../operations/world-operations";
import { opGetNode } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";

export function getNodeTool(ops: OperationsState, params: unknown) {
    const { id } = params as { id: string };
    const n = opGetNode(ops, id);
    return n ? fmtResult(n) : fmtError(`Node ${id} not found`);
}
