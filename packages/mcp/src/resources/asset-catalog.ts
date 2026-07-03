/**
 * asset-catalog resource.
 *
 * Location: packages/mcp/src/resources/asset-catalog.ts
 */

import type { OperationsState } from "../operations/world-operations";

export async function assetCatalogResource(_ops: OperationsState) {
    return {
        uri: "world://catalog/assets",
        mimeType: "application/json",
        text: JSON.stringify(
            {
                categories: ["trees", "rocks", "structures", "vegetation"],
                note: "Asset catalog sourced from dynamic asset library",
            },
            null,
            2,
        ),
    };
}
