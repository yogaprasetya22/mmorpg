/**
 * Resources — resource handler types and registry.
 *
 * Location: packages/mcp/src/resources/types.ts
 */

export type ResourceHandler = (uri: string) => Promise<unknown>;

export interface ResourceEntry {
    uri: string;
    name: string;
    handler: ResourceHandler;
}
