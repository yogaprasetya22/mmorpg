/**
 * region-style-transfer prompt.
 *
 * Location: packages/mcp/src/prompts/region-style-transfer.ts
 */

import type { OperationsState } from "../operations/world-operations";

export async function regionStyleTransferPrompt(
    _ops: OperationsState,
    args?: Record<string, string>,
) {
    const from = args?.from ?? "unknown";
    const to = args?.to ?? "unknown";
    const region = args?.region ?? "selected area";
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Change style of "${region}" from "${from}" to "${to}". Analyze current nodes in the region and return a JSON array of update_node/delete_node/create_zone operations to achieve the style transfer.`,
                },
            },
        ],
    };
}
