/**
 * Resources index — barrel + list registration.
 *
 * Location: packages/mcp/src/resources/index.ts
 */

import type { OperationsState } from "../operations/world-operations";
import type { ResourceEntry } from "./types";
import { worldCurrentResource } from "./world-current";
import { worldSummaryResource } from "./world-summary";
import { assetCatalogResource } from "./asset-catalog";

export function getResources(ops: OperationsState): ResourceEntry[] {
    return [
        {
            uri: "world://current",
            name: "Current World",
            handler: () => worldCurrentResource(ops),
        },
        {
            uri: "world://current/summary",
            name: "World Summary",
            handler: () => worldSummaryResource(ops),
        },
        {
            uri: "world://catalog/assets",
            name: "Asset Catalog",
            handler: () => assetCatalogResource(ops),
        },
    ];
}

export { type ResourceEntry, type ResourceHandler } from "./types";
