/**
 * editorPointerRefs.ts — module-level refs bridging WorldEditor ↔ StormTerrain.
 *
 * Same pattern as BrushIndicator's module-level refs. WorldEditor sets
 * handlers in useEffect; StormTerrain reads them in pointer events.
 * Zero React re-render cost.
 */
import * as THREE from 'three';

export const editorPointerRefs = {
  onTerrainPointerDown: null as ((point: THREE.Vector3, button: number, e: any) => void) | null,
  onTerrainPointerUp:   null as ((point: THREE.Vector3, button: number, e: any) => void) | null,
  onTerrainPointerMove: null as ((point: THREE.Vector3, e: any) => void) | null,
};
