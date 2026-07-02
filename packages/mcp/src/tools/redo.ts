/**
 * redo tool.
 *
 * Location: packages/mcp/src/tools/redo.ts
 */

import { opRedo } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";

export function redoTool(ops: OperationsState, _params: unknown) {
    const r = opRedo(ops);
    if (!r.success) return fmtError(r.error!.message);
    return fmtResult({ success: true });
}
