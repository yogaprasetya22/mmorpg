/**
 * validate-world tool.
 *
 * Location: packages/mcp/src/tools/validate-world.ts
 */

import { opValidateWorld } from "../operations/world-operations";
import { fmtResult } from "./helpers";
import type { OperationsState } from "../operations/world-operations";

export function validateWorldTool(ops: OperationsState, _params: unknown) {
    return fmtResult(opValidateWorld(ops));
}
