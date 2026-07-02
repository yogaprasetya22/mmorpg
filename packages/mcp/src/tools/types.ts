/**
 * Tools types — shared tool handler signature.
 *
 * Location: packages/mcp/src/tools/types.ts
 */

import type { z } from "zod";

export type ToolHandler = (params: unknown) => unknown | Promise<unknown>;

export interface ToolEntry {
    schema?: z.ZodTypeAny;
    handler: ToolHandler;
}
