'use client';

import { API_BASE_URL } from '@/src/core/config';

export interface AssetInfo {
  name: string;
  path: string;
  category: 'kingdom' | 'env' | 'tree';
}

export interface MaterialInfo {
  id: string;
  name: string;
  diffuse?: string;
  normal?: string;
  roughness?: string;
  displacement?: string;
}

// FULL_ASSET_LIBRARY is now refactored to be dynamically populated from the GORM database in the backend.
// This maintains full backward compatibility for all imports using FULL_ASSET_LIBRARY across the game.
export let FULL_ASSET_LIBRARY: AssetInfo[] = [];

// Helper to update the asset library in-place
export function setAssetLibrary(assets: AssetInfo[]) {
  FULL_ASSET_LIBRARY.length = 0; // Clear array in-place
  FULL_ASSET_LIBRARY.push(...assets); // Add loaded assets
}

export const FULL_MATERIAL_LIBRARY: MaterialInfo[] = [
  {
    id: "texture_1",
    name: "Texture 1",
    diffuse: `${API_BASE_URL}/assets/textures/materials/marble_cliff/marble_cliff_03_diff_1k.jpg`,
    displacement: `${API_BASE_URL}/assets/textures/materials/marble_cliff/marble_cliff_03_disp_1k.png`,
    normal: `${API_BASE_URL}/assets/textures/materials/marble_cliff/marble_cliff_03_nor_gl_1k.png`,
    roughness: `${API_BASE_URL}/assets/textures/materials/marble_cliff/marble_cliff_03_rough_1k.png`,
  },
  {
    id: "texture_2",
    name: "Texture 2",
    diffuse: `${API_BASE_URL}/assets/textures/materials/rocky_terrain/rocky_terrain_02_diff_1k.jpg`,
    displacement: `${API_BASE_URL}/assets/textures/materials/rocky_terrain/rocky_terrain_02_disp_1k.png`,
    normal: `${API_BASE_URL}/assets/textures/materials/rocky_terrain/rocky_terrain_02_nor_gl_1k.png`,
    roughness: `${API_BASE_URL}/assets/textures/materials/rocky_terrain/rocky_terrain_02_rough_1k.png`,
  },
];