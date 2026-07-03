/**
 * Prompts — prompt handler types and registry.
 *
 * Location: packages/mcp/src/prompts/types.ts
 */

export type PromptHandler = (args?: Record<string, string>) => Promise<unknown>;

export interface PromptEntry {
    name: string;
    description: string;
    handler: PromptHandler;
}
