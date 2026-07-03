/**
 * find-nodes tool.
 *
 * Location: packages/mcp/src/tools/find-nodes.ts
 */

import type { OperationsState } from "../operations/world-operations";
import { opFindNodes } from "../operations/world-operations";
import { fmtResult } from "./helpers";
import type { NodeQuery } from "../../../world-core/src/schema/node";
import { z } from "zod";
import { NODE_TYPES } from "../../../world-core/src/index";

const FindNodesSchema = z.object({
    type: z.union([z.enum(NODE_TYPES), z.array(z.enum(NODE_TYPES))]).optional(),
    parentId: z.string().optional().nullable(),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
    namePattern: z.string().optional(),
});

export function findNodesTool(ops: OperationsState, params: unknown) {
    const q = FindNodesSchema.parse(params) as NodeQuery;
    const nodes = opFindNodes(ops, q);
    return fmtResult({
        count: nodes.length,
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, name: n.name })),
    });
}
