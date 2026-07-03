/**
 * place-asset tool.
 *
 * Location: packages/mcp/src/tools/place-asset.ts
 */

import { opCreateNode } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import type { CreateNodeInput } from "../../../world-core/src/schema/node";
import { z } from "zod";

const PlaceAssetSchema = z.object({
    name: z.string().min(1).max(128),
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    properties: z.record(z.string(), z.unknown()).optional(),
});

export function placeAssetTool(ops: OperationsState, params: unknown) {
    const input = PlaceAssetSchema.parse(params);
    const nodeInput: CreateNodeInput = {
        type: "structure",
        name: input.name,
        position: input.position,
        properties: input.properties ?? {},
    };
    const r = opCreateNode(ops, nodeInput);
    if (!r.success) return fmtError(r.error!.message);
    const lastNode =
        ops.bridge.snapshot.nodes[ops.bridge.snapshot.nodes.length - 1];
    return fmtResult({ success: true, nodeId: lastNode.id });
}
