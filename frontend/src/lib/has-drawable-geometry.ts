import type { BufferGeometry } from "three";

/**
 * Check if a geometry has a non-empty position buffer.
 *
 * WebGPU poisons the entire command encoder when a vertex buffer slot 0
 * is unbound (happens when geometry has 0 vertices). This guard skips
 * the draw call for such geometries.
 *
 * Pattern from `pascalorg/editor` — `installEmptyDrawGuard` in Viewer.tsx.
 */
export function hasDrawableGeometry(geometry?: BufferGeometry | null): boolean {
    if (!geometry) return false;
    const position = geometry.getAttribute("position");
    if (!position) return false;
    return position.count > 0;
}
