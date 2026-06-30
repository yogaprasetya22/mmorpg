export { API_BASE_URL, WS_BASE_URL } from "./config";
export { windUniforms, applyWindSway } from "./wind";
export {
    PainterlyShaderUtils,
    PainterlyWaterMaterial,
    PainterlyTerrainMaterial,
    PainterlyGrassMaterial,
    applyPainterlyStyle,
} from "./painterly-materials";
export {
    FULL_ASSET_LIBRARY,
    setAssetLibrary,
    FULL_MATERIAL_LIBRARY,
} from "./asset-registry";
export type { AssetInfo, MaterialInfo } from "./asset-registry";
export type { MapItem } from "./map-item";
export { sanitizeAssetPath } from "./map-item";
export { getTerrainElevation } from "./terrain-height";
export { getCachedTerrainHeight, clearTerrainCache } from "./terrain-cache";
