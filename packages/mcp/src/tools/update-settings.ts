/**
 * update-settings tool.
 *
 * Location: packages/mcp/src/tools/update-settings.ts
 */

import { opUpdateSettings } from "../operations/world-operations";
import { fmtResult, fmtError } from "./helpers";
import type { OperationsState } from "../operations/world-operations";
import { z } from "zod";

const TerrainConfigSchema = z.object({
    height: z.number().optional(),
    scale: z.number().optional(),
    seed: z.number().optional(),
    sharpness: z.number().optional(),
}).optional();

const UpdateSettingsSchema = z.object({
    gridSize: z.number().optional(),
    gridEnabled: z.boolean().optional(),
    terrainConfig: TerrainConfigSchema,
    terrainColor: z.string().optional(),
    terrainMaterialId: z.string().optional().nullable(),
    sky: z.string().optional(),
    environment: z.string().optional(),
    lightIntensity: z.number().optional().nullable(),
    ambientIntensity: z.number().optional().nullable(),
    sunAngle: z.number().optional(),
    fogDensity: z.number().optional(),
    skyboxIntensity: z.number().optional().nullable(),
    bloomThreshold: z.number().optional().nullable(),
    bloomStrength: z.number().optional().nullable(),
    bloomRadius: z.number().optional().nullable(),
});

export function updateSettingsTool(ops: OperationsState, params: unknown) {
    try {
        const patch = UpdateSettingsSchema.parse(params);
        const r = opUpdateSettings(ops, patch as any);
        return fmtResult(r);
    } catch (e: any) {
        return fmtError(e.message);
    }
}
