/**
 * check-collisions tool.
 *
 * Location: packages/mcp/src/tools/check-collisions.ts
 */

import { opCheckCollisions } from "../operations/world-operations";
import { fmtResult } from "./helpers";
import type { OperationsState } from "../operations/world-operations";

export function checkCollisionsTool(ops: OperationsState, _params: unknown) {
    const c = opCheckCollisions(ops);
    return fmtResult({ count: c.length, collisions: c });
}
