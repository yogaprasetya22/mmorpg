/**
 * create-zone tool.
 *
 * Location: packages/mcp/src/tools/create-zone.ts
 */

import { opCreateNode } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import type { CreateNodeInput } from "../../../world-core/src/schema/node";
import { z } from "zod";
import { NODE_TYPES } from "../../../world-core/src/index";

const Vec3Schema = z
    .object({ x: z.number(), y: z.number(), z: z.number() })
    .optional();

const CreateNodeSchema = z.object({
    type: z.enum(NODE_TYPES),
    name: z.string().min(1).max(128),
    parentId: z.string().optional().nullable(),
    position: Vec3Schema,
    rotation: Vec3Schema,
    scale: Vec3Schema,
    properties: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string()).optional(),
});

export function createZoneTool(ops: OperationsState, params: unknown) {
    const input = CreateNodeSchema.parse(params) as CreateNodeInput;
    const r = opCreateNode(ops, input);
    if (!r.success) return fmtError(r.error!.message);
    const lastNode =
        ops.bridge.snapshot.nodes[ops.bridge.snapshot.nodes.length - 1];
    return fmtResult({ success: true, nodeId: lastNode.id });
}
