/**
 * describe-node tool.
 *
 * Location: packages/mcp/src/tools/describe-node.ts
 */

import type { OperationsState } from "../operations/world-operations";
import { opDescribeNode } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";

export function describeNodeTool(ops: OperationsState, params: unknown) {
    const { id } = params as { id: string };
    const d = opDescribeNode(ops, id);
    return d ? fmtResult(d) : fmtError(`Node ${id} not found`);
}
