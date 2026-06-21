'use client';

import { API_BASE_URL } from '@/src/core/config';

export interface AssetInfo {
  name: string;
  path: string;
  category: 'rocks' | 'trees' | 'vegetation';
}

export interface MaterialInfo {
  id: string;
  name: string;
  diffuse?: string;
  normal?: string;
  roughness?: string;
  displacement?: string;
}

// FULL_ASSET_LIBRARY fallback static list
export let FULL_ASSET_LIBRARY: AssetInfo[] = [
  // ROCKS Assets
  { name: "Pebble Round 1", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Round_1.glb`, category: 'rocks' },
  { name: "Pebble Round 2", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Round_2.glb`, category: 'rocks' },
  { name: "Pebble Round 3", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Round_3.glb`, category: 'rocks' },
  { name: "Pebble Round 4", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Round_4.glb`, category: 'rocks' },
  { name: "Pebble Round 5", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Round_5.glb`, category: 'rocks' },
  { name: "Pebble Square 1", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Square_1.glb`, category: 'rocks' },
  { name: "Pebble Square 2", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Square_2.glb`, category: 'rocks' },
  { name: "Pebble Square 3", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Square_3.glb`, category: 'rocks' },
  { name: "Pebble Square 4", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Square_4.glb`, category: 'rocks' },
  { name: "Pebble Square 5", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Square_5.glb`, category: 'rocks' },
  { name: "Pebble Square 6", path: `${API_BASE_URL}/assets/environment/rocks/Pebble_Square_6.glb`, category: 'rocks' },
  { name: "Rockpath Round Small 1", path: `${API_BASE_URL}/assets/environment/rocks/RockPath_Round_Small_1.glb`, category: 'rocks' },
  { name: "Rockpath Round Small 2", path: `${API_BASE_URL}/assets/environment/rocks/RockPath_Round_Small_2.glb`, category: 'rocks' },
  { name: "Rockpath Round Small 3", path: `${API_BASE_URL}/assets/environment/rocks/RockPath_Round_Small_3.glb`, category: 'rocks' },
  { name: "Rockpath Round Thin", path: `${API_BASE_URL}/assets/environment/rocks/RockPath_Round_Thin.glb`, category: 'rocks' },
  { name: "Rockpath Round Wide", path: `${API_BASE_URL}/assets/environment/rocks/RockPath_Round_Wide.glb`, category: 'rocks' },
  { name: "Rockpath Square Small 1", path: `${API_BASE_URL}/assets/environment/rocks/RockPath_Square_Small_1.glb`, category: 'rocks' },
  { name: "Rockpath Square Small 2", path: `${API_BASE_URL}/assets/environment/rocks/RockPath_Square_Small_2.glb`, category: 'rocks' },
  { name: "Rockpath Square Small 3", path: `${API_BASE_URL}/assets/environment/rocks/RockPath_Square_Small_3.glb`, category: 'rocks' },
  { name: "Rockpath Square Thin", path: `${API_BASE_URL}/assets/environment/rocks/RockPath_Square_Thin.glb`, category: 'rocks' },
  { name: "Rockpath Square Wide", path: `${API_BASE_URL}/assets/environment/rocks/RockPath_Square_Wide.glb`, category: 'rocks' },
  { name: "Rock Medium 1", path: `${API_BASE_URL}/assets/environment/rocks/Rock_Medium_1.glb`, category: 'rocks' },
  { name: "Rock Medium 2", path: `${API_BASE_URL}/assets/environment/rocks/Rock_Medium_2.glb`, category: 'rocks' },
  { name: "Rock Medium 3", path: `${API_BASE_URL}/assets/environment/rocks/Rock_Medium_3.glb`, category: 'rocks' },

  // TREES Assets
  { name: "Birchtree 1", path: `${API_BASE_URL}/assets/environment/trees/BirchTree_1.glb`, category: 'trees' },
  { name: "Birchtree 2", path: `${API_BASE_URL}/assets/environment/trees/BirchTree_2.glb`, category: 'trees' },
  { name: "Birchtree 3", path: `${API_BASE_URL}/assets/environment/trees/BirchTree_3.glb`, category: 'trees' },
  { name: "Birchtree 4", path: `${API_BASE_URL}/assets/environment/trees/BirchTree_4.glb`, category: 'trees' },
  { name: "Birchtree 5", path: `${API_BASE_URL}/assets/environment/trees/BirchTree_5.glb`, category: 'trees' },
  { name: "Commontree 1", path: `${API_BASE_URL}/assets/environment/trees/CommonTree_1.glb`, category: 'trees' },
  { name: "Commontree 2", path: `${API_BASE_URL}/assets/environment/trees/CommonTree_2.glb`, category: 'trees' },
  { name: "Commontree 3", path: `${API_BASE_URL}/assets/environment/trees/CommonTree_3.glb`, category: 'trees' },
  { name: "Commontree 4", path: `${API_BASE_URL}/assets/environment/trees/CommonTree_4.glb`, category: 'trees' },
  { name: "Commontree 5", path: `${API_BASE_URL}/assets/environment/trees/CommonTree_5.glb`, category: 'trees' },
  { name: "Deadtree 1", path: `${API_BASE_URL}/assets/environment/trees/DeadTree_1.glb`, category: 'trees' },
  { name: "Deadtree 10", path: `${API_BASE_URL}/assets/environment/trees/DeadTree_10.glb`, category: 'trees' },
  { name: "Deadtree 2", path: `${API_BASE_URL}/assets/environment/trees/DeadTree_2.glb`, category: 'trees' },
  { name: "Deadtree 3", path: `${API_BASE_URL}/assets/environment/trees/DeadTree_3.glb`, category: 'trees' },
  { name: "Deadtree 4", path: `${API_BASE_URL}/assets/environment/trees/DeadTree_4.glb`, category: 'trees' },
  { name: "Deadtree 5", path: `${API_BASE_URL}/assets/environment/trees/DeadTree_5.glb`, category: 'trees' },
  { name: "Deadtree 6", path: `${API_BASE_URL}/assets/environment/trees/DeadTree_6.glb`, category: 'trees' },
  { name: "Deadtree 7", path: `${API_BASE_URL}/assets/environment/trees/DeadTree_7.glb`, category: 'trees' },
  { name: "Deadtree 8", path: `${API_BASE_URL}/assets/environment/trees/DeadTree_8.glb`, category: 'trees' },
  { name: "Deadtree 9", path: `${API_BASE_URL}/assets/environment/trees/DeadTree_9.glb`, category: 'trees' },
  { name: "Mapletree 1", path: `${API_BASE_URL}/assets/environment/trees/MapleTree_1.glb`, category: 'trees' },
  { name: "Mapletree 2", path: `${API_BASE_URL}/assets/environment/trees/MapleTree_2.glb`, category: 'trees' },
  { name: "Mapletree 3", path: `${API_BASE_URL}/assets/environment/trees/MapleTree_3.glb`, category: 'trees' },
  { name: "Mapletree 4", path: `${API_BASE_URL}/assets/environment/trees/MapleTree_4.glb`, category: 'trees' },
  { name: "Mapletree 5", path: `${API_BASE_URL}/assets/environment/trees/MapleTree_5.glb`, category: 'trees' },
  { name: "Pine 1", path: `${API_BASE_URL}/assets/environment/trees/Pine_1.glb`, category: 'trees' },
  { name: "Pine 2", path: `${API_BASE_URL}/assets/environment/trees/Pine_2.glb`, category: 'trees' },
  { name: "Pine 3", path: `${API_BASE_URL}/assets/environment/trees/Pine_3.glb`, category: 'trees' },
  { name: "Pine 4", path: `${API_BASE_URL}/assets/environment/trees/Pine_4.glb`, category: 'trees' },
  { name: "Pine 5", path: `${API_BASE_URL}/assets/environment/trees/Pine_5.glb`, category: 'trees' },
  { name: "Twistedtree 1", path: `${API_BASE_URL}/assets/environment/trees/TwistedTree_1.glb`, category: 'trees' },
  { name: "Twistedtree 2", path: `${API_BASE_URL}/assets/environment/trees/TwistedTree_2.glb`, category: 'trees' },
  { name: "Twistedtree 3", path: `${API_BASE_URL}/assets/environment/trees/TwistedTree_3.glb`, category: 'trees' },
  { name: "Twistedtree 4", path: `${API_BASE_URL}/assets/environment/trees/TwistedTree_4.glb`, category: 'trees' },
  { name: "Twistedtree 5", path: `${API_BASE_URL}/assets/environment/trees/TwistedTree_5.glb`, category: 'trees' },

  // VEGETATION Assets
  { name: "Bush", path: `${API_BASE_URL}/assets/environment/vegetation/Bush.glb`, category: 'vegetation' },
  { name: "Bush Common", path: `${API_BASE_URL}/assets/environment/vegetation/Bush_Common.glb`, category: 'vegetation' },
  { name: "Bush Common Flowers", path: `${API_BASE_URL}/assets/environment/vegetation/Bush_Common_Flowers.glb`, category: 'vegetation' },
  { name: "Bush Flowers", path: `${API_BASE_URL}/assets/environment/vegetation/Bush_Flowers.glb`, category: 'vegetation' },
  { name: "Bush Large", path: `${API_BASE_URL}/assets/environment/vegetation/Bush_Large.glb`, category: 'vegetation' },
  { name: "Bush Large Flowers", path: `${API_BASE_URL}/assets/environment/vegetation/Bush_Large_Flowers.glb`, category: 'vegetation' },
  { name: "Bush Small", path: `${API_BASE_URL}/assets/environment/vegetation/Bush_Small.glb`, category: 'vegetation' },
  { name: "Bush Small Flowers", path: `${API_BASE_URL}/assets/environment/vegetation/Bush_Small_Flowers.glb`, category: 'vegetation' },
  { name: "Clover 1", path: `${API_BASE_URL}/assets/environment/vegetation/Clover_1.glb`, category: 'vegetation' },
  { name: "Clover 2", path: `${API_BASE_URL}/assets/environment/vegetation/Clover_2.glb`, category: 'vegetation' },
  { name: "Fern 1", path: `${API_BASE_URL}/assets/environment/vegetation/Fern_1.glb`, category: 'vegetation' },
  { name: "Flower 1", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_1.glb`, category: 'vegetation' },
  { name: "Flower 1 Clump", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_1_Clump.glb`, category: 'vegetation' },
  { name: "Flower 2", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_2.glb`, category: 'vegetation' },
  { name: "Flower 2 Clump", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_2_Clump.glb`, category: 'vegetation' },
  { name: "Flower 3 Clump", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_3_Clump.glb`, category: 'vegetation' },
  { name: "Flower 3 Group", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_3_Group.glb`, category: 'vegetation' },
  { name: "Flower 3 Single", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_3_Single.glb`, category: 'vegetation' },
  { name: "Flower 4 Clump", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_4_Clump.glb`, category: 'vegetation' },
  { name: "Flower 4 Group", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_4_Group.glb`, category: 'vegetation' },
  { name: "Flower 4 Single", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_4_Single.glb`, category: 'vegetation' },
  { name: "Flower 5 Clump", path: `${API_BASE_URL}/assets/environment/vegetation/Flower_5_Clump.glb`, category: 'vegetation' },
  { name: "Grass Common Short", path: `${API_BASE_URL}/assets/environment/vegetation/Grass_Common_Short.glb`, category: 'vegetation' },
  { name: "Grass Common Tall", path: `${API_BASE_URL}/assets/environment/vegetation/Grass_Common_Tall.glb`, category: 'vegetation' },
  { name: "Grass Large", path: `${API_BASE_URL}/assets/environment/vegetation/Grass_Large.glb`, category: 'vegetation' },
  { name: "Grass Large Extruded", path: `${API_BASE_URL}/assets/environment/vegetation/Grass_Large_Extruded.glb`, category: 'vegetation' },
  { name: "Grass Small", path: `${API_BASE_URL}/assets/environment/vegetation/Grass_Small.glb`, category: 'vegetation' },
  { name: "Grass Wispy Short", path: `${API_BASE_URL}/assets/environment/vegetation/Grass_Wispy_Short.glb`, category: 'vegetation' },
  { name: "Grass Wispy Tall", path: `${API_BASE_URL}/assets/environment/vegetation/Grass_Wispy_Tall.glb`, category: 'vegetation' },
  { name: "Mushroom Common", path: `${API_BASE_URL}/assets/environment/vegetation/Mushroom_Common.glb`, category: 'vegetation' },
  { name: "Mushroom Laetiporus", path: `${API_BASE_URL}/assets/environment/vegetation/Mushroom_Laetiporus.glb`, category: 'vegetation' },
  { name: "Petal 1", path: `${API_BASE_URL}/assets/environment/vegetation/Petal_1.glb`, category: 'vegetation' },
  { name: "Petal 2", path: `${API_BASE_URL}/assets/environment/vegetation/Petal_2.glb`, category: 'vegetation' },
  { name: "Petal 3", path: `${API_BASE_URL}/assets/environment/vegetation/Petal_3.glb`, category: 'vegetation' },
  { name: "Petal 4", path: `${API_BASE_URL}/assets/environment/vegetation/Petal_4.glb`, category: 'vegetation' },
  { name: "Petal 5", path: `${API_BASE_URL}/assets/environment/vegetation/Petal_5.glb`, category: 'vegetation' },
  { name: "Plant 1", path: `${API_BASE_URL}/assets/environment/vegetation/Plant_1.glb`, category: 'vegetation' },
  { name: "Plant 1 Big", path: `${API_BASE_URL}/assets/environment/vegetation/Plant_1_Big.glb`, category: 'vegetation' },
  { name: "Plant 7", path: `${API_BASE_URL}/assets/environment/vegetation/Plant_7.glb`, category: 'vegetation' },
  { name: "Plant 7 Big", path: `${API_BASE_URL}/assets/environment/vegetation/Plant_7_Big.glb`, category: 'vegetation' },

];

// Helper to update the asset library in-place
export function setAssetLibrary(assets: AssetInfo[]) {
  FULL_ASSET_LIBRARY.length = 0; // Clear array in-place
  FULL_ASSET_LIBRARY.push(...assets); // Add loaded assets
}

export const FULL_MATERIAL_LIBRARY: MaterialInfo[] = [
  {
    id: "texture_1",
    name: "Marble Cliff",
    diffuse: `${API_BASE_URL}/assets/textures/materials/marble_cliff/marble_cliff_03_diff_1k.jpg`,
    normal: `${API_BASE_URL}/assets/textures/materials/marble_cliff/marble_cliff_03_nor_gl_1k.png`,
    roughness: `${API_BASE_URL}/assets/textures/materials/marble_cliff/marble_cliff_03_rough_1k.png`,
    displacement: `${API_BASE_URL}/assets/textures/materials/marble_cliff/marble_cliff_03_disp_1k.png`,
  },
  {
    id: "texture_2",
    name: "Rocky Terrain",
    diffuse: `${API_BASE_URL}/assets/textures/materials/rocky_terrain/rocky_terrain_02_diff_1k.jpg`,
    normal: `${API_BASE_URL}/assets/textures/materials/rocky_terrain/rocky_terrain_02_nor_gl_1k.png`,
    roughness: `${API_BASE_URL}/assets/textures/materials/rocky_terrain/rocky_terrain_02_rough_1k.png`,
    displacement: `${API_BASE_URL}/assets/textures/materials/rocky_terrain/rocky_terrain_02_disp_1k.png`,
  },
];