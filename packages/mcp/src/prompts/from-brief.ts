/**
 * from-brief prompt.
 *
 * Location: packages/mcp/src/prompts/from-brief.ts
 */

import type { OperationsState } from "../operations/world-operations";

export async function fromBriefPrompt(
    _ops: OperationsState,
    args?: Record<string, string>,
) {
    const brief = args?.brief ?? "No brief provided";
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Based on this world-building brief, create a layout plan:\n\n${brief}\n\nReturn a JSON array of create_zone/place_asset/generate_* operations.`,
                },
            },
        ],
    };
}
