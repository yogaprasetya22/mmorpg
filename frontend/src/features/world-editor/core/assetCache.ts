/**
 * assetCache.ts — standard memory cache for loaded 3D models and thumbnail images.
 *
 * Location: frontend/src/features/world-editor/core/assetCache.ts
 */

const modelCache = new Map<string, any>();
const thumbnailCache = new Map<string, string>();

export const assetCache = {
  getModel: (key: string): any => modelCache.get(key),
  setModel: (key: string, val: any): any => modelCache.set(key, val),
  getThumb: (key: string): string | undefined => thumbnailCache.get(key),
  setThumb: (key: string, val: string): any => thumbnailCache.set(key, val),
};
