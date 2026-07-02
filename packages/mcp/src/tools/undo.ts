/**
 * undo tool.
 *
 * Location: packages/mcp/src/tools/undo.ts
 */

import { opUndo } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";

export function undoTool(ops: OperationsState, _params: unknown) {
    const r = opUndo(ops);
    if (!r.success) return fmtError(r.error!.message);
    return fmtResult({ success: true });
}
