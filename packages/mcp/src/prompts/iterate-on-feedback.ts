/**
 * iterate-on-feedback prompt.
 *
 * Location: packages/mcp/src/prompts/iterate-on-feedback.ts
 */

import type { OperationsState } from "../operations/world-operations";

export async function iterateOnFeedbackPrompt(
    _ops: OperationsState,
    args?: Record<string, string>,
) {
    const feedback = args?.feedback ?? "No feedback provided";
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Revise the current world layout based on feedback:\n\n${feedback}\n\nReturn a JSON array of update_node/delete_node/create_zone operations.`,
                },
            },
        ],
    };
}
