/**
 * update-node tool.
 *
 * Location: packages/mcp/src/tools/update-node.ts
 */

import { opUpdateNode } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import type { UpdateNodeInput } from "../../../world-core/src/schema/node";
import { asNodeId } from "../../../world-core/src/index";
import { z } from "zod";

const UpdateNodeSchema = z.object({
    id: z.string().min(1),
    name: z.string().max(128).optional(),
    position: z
        .object({
            x: z.number().optional(),
            y: z.number().optional(),
            z: z.number().optional(),
        })
        .optional(),
    rotation: z
        .object({
            x: z.number().optional(),
            y: z.number().optional(),
            z: z.number().optional(),
        })
        .optional(),
    scale: z
        .object({
            x: z.number().optional(),
            y: z.number().optional(),
            z: z.number().optional(),
        })
        .optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string()).optional(),
});

export function updateNodeTool(ops: OperationsState, params: unknown) {
    const i = UpdateNodeSchema.parse(params);
    const r = opUpdateNode(ops, {
        ...i,
        id: asNodeId(i.id),
    } as UpdateNodeInput);
    if (!r.success) return fmtError(r.error!.message);
    return fmtResult({ success: true });
}
