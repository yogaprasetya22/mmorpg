/**
 * Tools index — barrel + registry factory.
 *
 * Location: packages/mcp/src/tools/index.ts
 */

import type { OperationsState } from "../operations/world-operations";
import type { ToolEntry } from "./types";
import { getWorldTool } from "./get-world";
import { getNodeTool } from "./get-node";
import { findNodesTool } from "./find-nodes";
import { describeNodeTool } from "./describe-node";
import { createZoneTool } from "./create-zone";
import { placeAssetTool } from "./place-asset";
import { updateNodeTool } from "./update-node";
import { deleteNodeTool } from "./delete-node";
import { duplicateRegionTool } from "./duplicate-region";
import { undoTool } from "./undo";
import { redoTool } from "./redo";
import { checkCollisionsTool } from "./check-collisions";
import { validateWorldTool } from "./validate-world";
import { saveWorldTool } from "./save-world";
import { loadWorldTool } from "./load-world";
import { listWorldsTool } from "./list-worlds";
import { renameWorldTool } from "./rename-world";
import { deleteWorldTool } from "./delete-world";
import { generateMountainRangeTool } from "./generate-mountain-range";
import { generateVillageTool } from "./generate-village";
import { generateRoadTool } from "./generate-road";
import { paintBiomeTool } from "./paint-biome";

import { updateSettingsTool } from "./update-settings";
import { updatePaintDataTool } from "./update-paint-data";
import { updateSculptDataTool } from "./update-sculpt-data";

export function getTools(ops: OperationsState): Map<string, ToolEntry> {
    const tools = new Map<string, ToolEntry>();
    tools.set("get_world", { handler: () => getWorldTool(ops) });
    tools.set("get_node", { handler: (p) => getNodeTool(ops, p) });
    tools.set("find_nodes", { handler: (p) => findNodesTool(ops, p) });
    tools.set("describe_node", { handler: (p) => describeNodeTool(ops, p) });
    tools.set("create_zone", { handler: (p) => createZoneTool(ops, p) });
    tools.set("place_asset", { handler: (p) => placeAssetTool(ops, p) });
    tools.set("update_node", { handler: (p) => updateNodeTool(ops, p) });
    tools.set("delete_node", { handler: (p) => deleteNodeTool(ops, p) });
    tools.set("duplicate_region", {
        handler: (p) => duplicateRegionTool(ops, p),
    });
    tools.set("undo", { handler: () => undoTool(ops, undefined) });
    tools.set("redo", { handler: () => redoTool(ops, undefined) });
    tools.set("check_collisions", {
        handler: () => checkCollisionsTool(ops, undefined),
    });
    tools.set("validate_world", {
        handler: () => validateWorldTool(ops, undefined),
    });
    tools.set("update_settings", { handler: (p) => updateSettingsTool(ops, p) });
    tools.set("update_paint_data", { handler: (p) => updatePaintDataTool(ops, p) });
    tools.set("update_sculpt_data", { handler: (p) => updateSculptDataTool(ops, p) });
    tools.set("save_world", {
        handler: () => saveWorldTool(ops, undefined),
    });
    tools.set("load_world", { handler: (p) => loadWorldTool(ops, p) });
    tools.set("list_worlds", {
        handler: () => listWorldsTool(ops, undefined),
    });
    tools.set("rename_world", { handler: (p) => renameWorldTool(ops, p) });
    tools.set("delete_world", { handler: (p) => deleteWorldTool(ops, p) });
    tools.set("generate_mountain_range", {
        handler: (p) => generateMountainRangeTool(ops, p),
    });
    tools.set("generate_village", {
        handler: (p) => generateVillageTool(ops, p),
    });
    tools.set("generate_road", {
        handler: (p) => generateRoadTool(ops, p),
    });
    tools.set("paint_biome", { handler: (p) => paintBiomeTool(ops, p) });
    return tools;
}

export { type ToolEntry, type ToolHandler } from "./types";
export { fmtResult, fmtError } from "./helpers";
