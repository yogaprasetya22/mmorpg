/**
 * Tools — shared helpers for tool implementations.
 *
 * Location: packages/mcp/src/tools/helpers.ts
 */

export function fmtResult(data: unknown) {
    return {
        content: [
            { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
    };
}

export function fmtError(msg: string) {
    return {
        content: [{ type: "text" as const, text: msg }],
        isError: true as const,
    };
}
