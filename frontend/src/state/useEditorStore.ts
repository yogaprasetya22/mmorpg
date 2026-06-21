import { create } from 'zustand';
import { getTerrainElevation } from '@/src/core/utils/terrainHeight';
import { useStore } from './useStore';
import { API_BASE_URL } from '@/src/core/config';

export interface MapItem {
  id: string;
  type: string;
  path: string;
  pos: [number, number, number];
  rot: [number, number, number];
  sca: [number, number, number];
  color?: string;
}

import { FULL_ASSET_LIBRARY, AssetInfo, setAssetLibrary } from '@/src/core/logic/environment/assetRegistry';

export interface EditorState {
  isEditorOpen: boolean;
  setIsEditorOpen: (open: boolean) => void;
  
  items: MapItem[];
  setItems: (items: MapItem[]) => void;
  
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  toggleSelectedId: (id: string) => void;
  
  mode: 'translate' | 'rotate' | 'scale';
  setMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  
  activeAsset: AssetInfo | null;
  setActiveAsset: (asset: AssetInfo | null) => void;
  
  history: MapItem[][];
  historyIndex: number;
  
  // Actions
  updateItemsWithHistory: (newItems: MapItem[] | ((prev: MapItem[]) => MapItem[])) => void;
  undo: () => void;
  redo: () => void;
  
  // Helpers
  loadFromStorage: () => void;
  saveToStorage: () => void;
  saveToDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;

  // Multi-Map Persist States
  selectedMapId: string;
  setSelectedMapId: (mapId: string) => Promise<void>;
  mapList: { id: string; name: string; updated_at: string }[];
  fetchMapList: () => Promise<void>;
  createNewMap: (mapId: string) => Promise<void>;
  deleteActiveMap: () => Promise<void>;
  deleteMap: (mapId: string) => Promise<void>;

  // Dynamic Asset States
  dynamicAssets: AssetInfo[];
  fetchDynamicAssets: () => Promise<void>;
  
  gridSize: number;
  setGridSize: (size: number) => void;
  gridEnabled: boolean;
  setGridEnabled: (enabled: boolean) => void;
  
  terrainConfig: {
    height: number;
    scale: number;
    seed: number;
    sharpness: number;
  };
  setTerrainConfig: (config: Partial<EditorState['terrainConfig']>) => void;
  
  terrainMaterialId: string | null;
  setTerrainMaterialId: (id: string | null) => void;
  
  terrainColor: string;
  setTerrainColor: (color: string) => void;
  
  sky: string;
  setSky: (sky: string) => void;

  environment: string;
  setEnvironment: (env: string) => void;

  lightIntensity: number | null;
  setLightIntensity: (intensity: number | null) => void;
  ambientIntensity: number | null;
  setAmbientIntensity: (intensity: number | null) => void;
  sunAngle: number;
  setSunAngle: (angle: number) => void;
  fogDensity: number;
  setFogDensity: (density: number) => void;
  
  skyboxIntensity: number | null;
  setSkyboxIntensity: (intensity: number | null) => void;

  bloomThreshold: number | null;
  setBloomThreshold: (threshold: number | null) => void;
  bloomStrength: number | null;
  setBloomStrength: (strength: number | null) => void;
  bloomRadius: number | null;
  setBloomRadius: (radius: number | null) => void;

  paintMode: boolean;
  setPaintMode: (mode: boolean) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushTextureId: string | null;
  setBrushTextureId: (id: string | null) => void;
  paintData: string | null;
  setPaintData: (data: string | null) => void;
  
  terrainMode: 'paint' | 'sculpt';
  setTerrainMode: (mode: 'paint' | 'sculpt') => void;
  sculptTool: 'raise' | 'lower' | 'smooth' | 'flatten';
  setSculptTool: (tool: 'raise' | 'lower' | 'smooth' | 'flatten') => void;
  sculptData: string | null;
  setSculptData: (data: string | null) => void;

  brushStrength: number;
  setBrushStrength: (strength: number) => void;
  brushRotation: number;
  setBrushRotation: (rotation: number) => void;
  brushMaskId: 'softCircle' | 'hardCircle' | 'star' | 'hexagon' | 'starOutline' | 'square';
  setBrushMaskId: (maskId: 'softCircle' | 'hardCircle' | 'star' | 'hexagon' | 'starOutline' | 'square') => void;
  
  brushHoverPos: [number, number, number] | null;
  setBrushHoverPos: (pos: [number, number, number] | null) => void;

  lastUsedScales: Record<string, [number, number, number]>;
  setLastUsedScale: (assetPath: string, scale: [number, number, number]) => void;
  lastUsedRotations: Record<string, [number, number, number]>;
  setLastUsedRotation: (assetPath: string, rotation: [number, number, number]) => void;

  // Procedural Vegetation Generator States/Actions
  vegetationTheme: 'pine' | 'cherry' | 'autumn' | 'desert' | 'clover';
  setVegetationTheme: (theme: 'pine' | 'cherry' | 'autumn' | 'desert' | 'clover') => void;
  vegetationDensity: number;
  setVegetationDensity: (density: number) => void;
  generateVegetation: () => void;
  clearVegetation: () => void;

  cameraFocusTarget: [number, number, number] | null;
  setCameraFocusTarget: (target: [number, number, number] | null) => void;
  vegetationBrushActive: boolean;
  setVegetationBrushActive: (active: boolean) => void;

  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;

  // Custom Paint Blueprint Library (Paralives Feature)
  savedPaintBlueprints: CustomPaintBlueprint[];
  activePaintBlueprintId: string | null;
  createPaintBlueprint: (name: string, config: Omit<CustomPaintBlueprint, 'id' | 'name'>) => void;
  deletePaintBlueprint: (id: string) => void;
  applyPaintBlueprint: (id: string) => void;
}

export interface CustomPaintBlueprint {
  id: string;
  name: string;
  maskType: 'softCircle' | 'hardCircle' | 'star' | 'hexagon' | 'starOutline' | 'square';
  textureId: string | null;
  brushColor: string;
  defaultSize: number;
  defaultIntensity: number;
}

export const ASSET_LIBRARY = FULL_ASSET_LIBRARY;

/**
 * Validates that a canvas data string is a proper base64 data URL.
 * Rejects JSON objects that were accidentally stored in the old layer-based format.
 * This prevents THREE.js from using an invalid JSON string as a URL path (causing 404 errors).
 */
const sanitizeCanvasData = (data: string | null | undefined): string | null => {
  if (!data || typeof data !== 'string') return null;
  const trimmed = data.trim();
  
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  
  // Try to recover the composite image if the data is stored in the old JSON format
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const composite = parsed.composite;
        if (typeof composite === 'string' && composite.startsWith('data:image/')) {
          console.log('[EditorStore] Successfully recovered composite canvas data from legacy JSON format.');
          return composite;
        }
      }
    } catch (e) {
      // Ignored, proceed to fallback warning
    }
  }

  console.warn('[EditorStore] Invalid canvas data format detected and discarded (expected data URL, got:', trimmed.slice(0, 80), '...). Clearing.');
  return null;
};

let saveTimeout: any = null;
const debouncedSave = () => {
  if (typeof window === 'undefined') return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const state = useEditorStore.getState();
    try {
      localStorage.setItem('world_editor_map', JSON.stringify(state.items));
      localStorage.setItem('world_editor_settings', JSON.stringify({
        gridSize: state.gridSize,
        gridEnabled: state.gridEnabled,
        terrainConfig: state.terrainConfig,
        terrainMaterialId: state.terrainMaterialId,
        terrainColor: state.terrainColor,
        sky: state.sky,
        environment: state.environment,
        lightIntensity: state.lightIntensity,
        ambientIntensity: state.ambientIntensity,
        sunAngle: state.sunAngle,
        fogDensity: state.fogDensity,
        lastUsedScales: state.lastUsedScales,
        lastUsedRotations: state.lastUsedRotations,
        brushTextureId: state.brushTextureId,
        savedPaintBlueprints: state.savedPaintBlueprints,
        skyboxIntensity: state.skyboxIntensity,
        bloomThreshold: state.bloomThreshold,
        bloomStrength: state.bloomStrength,
        bloomRadius: state.bloomRadius
      }));
      if (state.paintData) {
        localStorage.setItem('world_editor_paint', state.paintData);
      }
      if (state.sculptData) {
        localStorage.setItem('world_editor_sculpt', state.sculptData);
      }
    } catch (e) {
      console.warn("Local storage is full!", e);
    }
  }, 1000);
};

export const useEditorStore = create<EditorState>((set, get) => ({
  isEditorOpen: false,
  setIsEditorOpen: (open) => set({ isEditorOpen: open }),
  isSaving: false,
  setIsSaving: (saving) => set({ isSaving: saving }),

  lastUsedScales: {},
  setLastUsedScale: (assetPath, scale) => set((state) => {
    const next = { ...state.lastUsedScales, [assetPath]: scale };
    debouncedSave();
    return { lastUsedScales: next };
  }),
  lastUsedRotations: {},
  setLastUsedRotation: (assetPath, rotation) => set((state) => {
    const next = { ...state.lastUsedRotations, [assetPath]: rotation };
    debouncedSave();
    return { lastUsedRotations: next };
  }),
  
  items: [],
  setItems: (items) => set({ items }),
  
  selectedId: null,
  setSelectedId: (id) => set((state) => {
    const isTerrain = id === 'terrain';
    return {
      selectedId: id,
      selectedIds: id ? [id] : [],
      paintMode: isTerrain ? state.paintMode : false
    };
  }),
  selectedIds: [],
  setSelectedIds: (ids) => set((state) => {
    const newSelectedId = ids.length > 0 ? ids[ids.length - 1] : null;
    const isTerrain = newSelectedId === 'terrain';
    return {
      selectedIds: ids,
      selectedId: newSelectedId,
      paintMode: isTerrain ? state.paintMode : false
    };
  }),
  toggleSelectedId: (id) => set((state) => {
    const isSelected = state.selectedIds.includes(id);
    const newIds = isSelected
      ? state.selectedIds.filter(x => x !== id)
      : [...state.selectedIds, id];
    const newSelectedId = newIds.length > 0 ? newIds[newIds.length - 1] : null;
    const isTerrain = newSelectedId === 'terrain';
    return {
      selectedIds: newIds,
      selectedId: newSelectedId,
      paintMode: isTerrain ? state.paintMode : false
    };
  }),
  
  mode: 'translate',
  setMode: (mode) => set({ mode }),
  
  activeAsset: null,
  setActiveAsset: (asset) => set((state) => {
    const isDeactivating = state.activeAsset?.path === asset?.path;
    const nextActiveAsset = isDeactivating ? null : asset;
    if (nextActiveAsset) {
      // Entering Placement Mode: Clear active selection and terrain painting
      return {
        activeAsset: nextActiveAsset,
        selectedId: null,
        selectedIds: [],
        paintMode: false
      };
    } else {
      return {
        activeAsset: null
      };
    }
  }),
  
  history: [],
  historyIndex: -1,
  
  updateItemsWithHistory: (newItems) => {
    console.log("=== [ZUSTAND STORE] updateItemsWithHistory CALLED ===");
    const { items, history, historyIndex } = get();
    const updated = typeof newItems === 'function' ? newItems(items) : newItems;
    console.log("Previous items count in store:", items.length);
    console.log("Next items count to set:", updated.length);
    
    const nextH = history.slice(0, historyIndex + 1);
    const newHistory = [...nextH, updated].slice(-50);
    
    set({ 
      items: updated, 
      history: newHistory, 
      historyIndex: newHistory.length - 1 
    });
    console.log("After set(), items count in store is now:", get().items.length);
    
    debouncedSave();
  },
  
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevItems = history[historyIndex - 1];
      set({ items: prevItems, historyIndex: historyIndex - 1, selectedId: null, selectedIds: [] });
    }
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextItems = history[historyIndex + 1];
      set({ items: nextItems, historyIndex: historyIndex + 1, selectedId: null, selectedIds: [] });
    }
  },
  
  loadFromStorage: () => {
    const saved = localStorage.getItem('world_editor_map');
    const settings = localStorage.getItem('world_editor_settings');
    
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        const loadedConfig = {
          height: 12.0,
          scale: 0.05,
          seed: 0,
          sharpness: 2.0,
          ...parsed.terrainConfig
        };
        set({ 
          gridSize: parsed.gridSize, 
          gridEnabled: parsed.gridEnabled, 
          terrainConfig: loadedConfig, 
          terrainMaterialId: parsed.terrainMaterialId,
          terrainColor: parsed.terrainColor || '#3d5c36',
          sky: parsed.sky || 'sunset',
          environment: parsed.environment || 'STORM',
          lightIntensity: parsed.lightIntensity !== undefined ? parsed.lightIntensity : null,
          ambientIntensity: parsed.ambientIntensity !== undefined ? parsed.ambientIntensity : null,
          sunAngle: parsed.sunAngle !== undefined ? parsed.sunAngle : 45,
          fogDensity: parsed.fogDensity !== undefined ? parsed.fogDensity : 0.002,
          lastUsedScales: parsed.lastUsedScales || {},
          lastUsedRotations: parsed.lastUsedRotations || {},
          brushTextureId: parsed.brushTextureId || null,
          savedPaintBlueprints: parsed.savedPaintBlueprints || [],
          skyboxIntensity: parsed.skyboxIntensity !== undefined ? parsed.skyboxIntensity : null,
          bloomThreshold: parsed.bloomThreshold !== undefined ? parsed.bloomThreshold : null,
          bloomStrength: parsed.bloomStrength !== undefined ? parsed.bloomStrength : null,
          bloomRadius: parsed.bloomRadius !== undefined ? parsed.bloomRadius : null
        });
      } catch (e) {}
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as MapItem[];
        
        // Path Sanitization (Fix legacy paths from local storage)
        const sanitized = parsed.map(item => {
          let path = item.path;

          if (path.includes('asset-enverement/') || path.includes('assets-model/asset-')) {
            const fileName = path.split('/').pop() || '';
            const nameLower = fileName.toLowerCase();
            if (nameLower.includes('tree') || nameLower.includes('birch') || nameLower.includes('pine') || nameLower.includes('oak')) {
              return { ...item, path: `/assets/environment/trees/${fileName}` };
            }
            return { ...item, path: `/assets/environment/vegetation/${fileName}` };
          }

          if (path.includes('nature/trees/')) {
            path = path.replace('nature/trees/', 'trees/');
          }
          if (path.includes('nature/vegetation/')) {
            path = path.replace('nature/vegetation/', 'vegetation/');
          }

          // Fix "assets-model/assets-env/" prefix → proper environment path
          if (path.includes('assets-model/assets-env')) {
            const fileName = path.split('/').pop() || '';
            return { ...item, path: `/assets/environment/props/decor/${fileName}` };
          }

          // Strip any accidental "assets-model/" prefix for non-NPC assets
          if (path.startsWith('assets-model/') || path.startsWith('/assets-model/')) {
            const rest = path.replace(/^\/?assets-model\//, '');
            // If remaining path looks like an environment asset, reroute
            if (rest.startsWith('assets-env') || rest.startsWith('asset-')) {
              const fileName = rest.split('/').pop() || '';
              return { ...item, path: `/assets/environment/props/decor/${fileName}` };
            }
          }

          // Fix legacy /models/environment/ paths
          if (path.includes('/models/environment/')) {
            const fileName = path.split('/').pop()?.replace(/_/g, '-') || '';
            const kingdomAssets = [
              'bridge-straight', 'tower-square', 'wall', 'wall-corner',
              'wall-pillar', 'tree-large', 'gate', 'stairs-stone',
              'rocks-large', 'tower-top'
            ];
            if (kingdomAssets.some(a => fileName.startsWith(a))) {
              const finalName = fileName === 'wall-buttress.glb' ? 'wall.glb' : fileName;
              return { ...item, path: `/assets/environment/structures/kingdom/${finalName}` };
            } else {
              return { ...item, path: `/assets/environment/props/decor/${fileName}` };
            }
          }

          // Prepend API base URL for valid server-relative paths
          if (path.startsWith('/assets/') || path.startsWith('/assets-model/') || path.startsWith('/assets/environment/structures/kingdom/') || path.startsWith('/assets-tree/')) {
            path = `${API_BASE_URL}${path}`;
          }

          return { ...item, path };
        });

        set({ items: sanitized, history: [sanitized], historyIndex: 0 });
      } catch (e) {
        console.error("Failed to load map", e);
      }
    }

    const paint = sanitizeCanvasData(localStorage.getItem('world_editor_paint'));
    if (paint) set({ paintData: paint });
    const sculpt = sanitizeCanvasData(localStorage.getItem('world_editor_sculpt'));
    if (sculpt) set({ sculptData: sculpt });
  },
  
  saveToStorage: () => {
    const { items, gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, sky, environment, paintData, sculptData, lightIntensity, ambientIntensity, sunAngle, fogDensity, lastUsedScales, lastUsedRotations, brushTextureId, savedPaintBlueprints, skyboxIntensity, bloomThreshold, bloomStrength, bloomRadius } = get();
    try {
      localStorage.setItem('world_editor_map', JSON.stringify(items));
      localStorage.setItem('world_editor_settings', JSON.stringify({ gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, sky, environment, lightIntensity, ambientIntensity, sunAngle, fogDensity, lastUsedScales, lastUsedRotations, brushTextureId, savedPaintBlueprints, skyboxIntensity, bloomThreshold, bloomStrength, bloomRadius }));
      if (paintData) localStorage.setItem('world_editor_paint', paintData);
      if (sculptData) localStorage.setItem('world_editor_sculpt', sculptData);
    } catch (e) {
      console.warn("Local storage is full! Use saveToDatabase() to persist your changes.", e);
    }
  },

  selectedMapId: 'Starter Zone',
  setSelectedMapId: async (mapId) => {
    set({ selectedMapId: mapId });
    await get().loadFromDatabase();
    
    // Sync the active map selection to the database global simulation settings
    try {
      const resSettings = await fetch(`${API_BASE_URL}/api/config/settings`);
      let dataSettings = {};
      if (resSettings.ok) {
        dataSettings = await resSettings.json();
      }
      const updated = {
        ...dataSettings,
        activeMapId: mapId
      };
      const token = typeof window !== 'undefined' ? localStorage.getItem("game_auth_token") : "";
      await fetch(`${API_BASE_URL}/api/config/settings`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(updated)
      });
      console.log(`Global activeMapId synced to: ${mapId}`);
    } catch (e) {
      console.warn("Failed to sync global activeMapId to database:", e);
    }
  },
  mapList: [],
  fetchMapList: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/world-editor/maps`);
      if (res.ok) {
        const list = await res.json();
        set({ mapList: list });
      }
    } catch (e) {
      console.error("Failed to fetch map list", e);
    }
  },
  createNewMap: async (mapId) => {
    set({ 
      selectedMapId: mapId, 
      items: [], 
      paintData: null, 
      sculptData: null,
      history: [[]],
      historyIndex: 0
    });
    await get().saveToDatabase();
    await get().fetchMapList();

    // Sync the active map selection to the database global simulation settings
    try {
      const resSettings = await fetch(`${API_BASE_URL}/api/config/settings`);
      let dataSettings = {};
      if (resSettings.ok) {
        dataSettings = await resSettings.json();
      }
      const updated = {
        ...dataSettings,
        activeMapId: mapId
      };
      const token = typeof window !== 'undefined' ? localStorage.getItem("game_auth_token") : "";
      await fetch(`${API_BASE_URL}/api/config/settings`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(updated)
      });
      console.log(`Global activeMapId synced to: ${mapId}`);
    } catch (e) {
      console.warn("Failed to sync global activeMapId to database:", e);
    }
  },
  deleteMap: async (mapId: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus peta "${mapId}" secara permanen? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("game_auth_token") : "";
      const res = await fetch(`${API_BASE_URL}/api/world-editor/delete?map_id=${encodeURIComponent(mapId)}`, {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });

      if (res.ok) {
        alert("Peta berhasil dihapus!");
        
        // Fetch map list first to see what's remaining
        await get().fetchMapList();
        
        // Reset active map selection back to first available map and sync with backend
        if (get().selectedMapId === mapId) {
          const remaining = get().mapList;
          if (remaining.length > 0) {
            await get().setSelectedMapId(remaining[0].id);
          }
        }
      } else {
        const data = await res.json();
        alert(`Gagal menghapus peta: ${data.error || "Unknown Error"}`);
      }
    } catch (e) {
      console.error("Error deleting map:", e);
      alert("Terjadi kesalahan saat menghapus peta!");
    }
  },
  deleteActiveMap: async () => {
    await get().deleteMap(get().selectedMapId);
  },

  dynamicAssets: [],
  fetchDynamicAssets: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/assets`);
      if (res.ok) {
        const assets: { name: string; path: string; category?: string }[] = await res.json();
        const mapped: AssetInfo[] = assets.map(item => {
          let category: any = 'rocks';
          
          if (item.category) {
            category = item.category;
          } else {
            // Fallback heuristics for custom or empty backend categories
            const lowerPath = item.path.toLowerCase();
            if (lowerPath.includes('/environment/trees/')) {
              category = 'trees';
            } else if (lowerPath.includes('/environment/vegetation/')) {
              category = 'vegetation';
            } else if (lowerPath.includes('/environment/rocks/')) {
              category = 'rocks';
            } else if (lowerPath.includes('/environment/characters/')) {
              category = 'characters';
            }
          }
          
          const path = `${API_BASE_URL}${item.path}`;
          const name = item.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

          return {
            name,
            path,
            category
          };
        });
        set({ dynamicAssets: mapped });
        setAssetLibrary(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch dynamic assets", e);
    }
  },

  saveToDatabase: async () => {
    const { selectedMapId, items, gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, sky, environment, paintData, sculptData, lightIntensity, ambientIntensity, sunAngle, fogDensity, brushTextureId, skyboxIntensity, bloomThreshold, bloomStrength, bloomRadius } = get();
    
    // Map IDs to specific high-quality PBR PNG filenames for database compatibility
    let savedMaterialId = terrainMaterialId;
    if (terrainMaterialId === 'texture_2') {
      savedMaterialId = 'rocky_terrain_02_nor_gl_1k.png';
    } else if (terrainMaterialId === 'texture_1') {
      savedMaterialId = 'marble_cliff_03_nor_gl_1k.png';
    }

    let savedBrushTextureId = brushTextureId;
    if (brushTextureId === 'texture_2') {
      savedBrushTextureId = 'rocky_terrain_02_nor_gl_1k.png';
    } else if (brushTextureId === 'texture_1') {
      savedBrushTextureId = 'marble_cliff_03_nor_gl_1k.png';
    }

    // Set saving active to display the transparent spinner overlay
    set({ isSaving: true });

    // Sanitize item paths to ensure we don't save full URL prefixes to database redundantly
    const sanitizedToSave = items.map(item => {
      let path = item.path;
      if (path.startsWith('http://localhost:8080/')) {
        path = path.replace('http://localhost:8080', '');
      }
      if (path.startsWith(API_BASE_URL + '/')) {
        path = path.replace(API_BASE_URL, '');
      }
      return { ...item, path };
    });

    const payload = {
      map_id: selectedMapId,
      items: sanitizedToSave,
      settings: { 
        gridSize, 
        gridEnabled, 
        terrainConfig, 
        terrainMaterialId: savedMaterialId, 
        terrainColor, 
        sky, 
        environment, 
        lightIntensity, 
        ambientIntensity, 
        sunAngle, 
        fogDensity,
        brushTextureId: savedBrushTextureId,
        savedPaintBlueprints: get().savedPaintBlueprints,
        skyboxIntensity,
        bloomThreshold,
        bloomStrength,
        bloomRadius
      },
      paintData,
      sculptData
    };

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("game_auth_token") : "";
      const res = await fetch(`${API_BASE_URL}/api/world-editor/save?map_id=${encodeURIComponent(selectedMapId)}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        console.log(`Map '${selectedMapId}' synced to database!`);
        get().fetchMapList();
      }
    } catch (e) {
      console.error("Failed to sync map to database", e);
    } finally {
      // Deactivate saving overlay after transmission completes
      setTimeout(() => {
        set({ isSaving: false });
      }, 500); // smooth UX fadeout
    }
  },

  loadFromDatabase: async () => {
    const { selectedMapId } = get();
    try {
      const res = await fetch(`${API_BASE_URL}/api/world-editor/load?map_id=${encodeURIComponent(selectedMapId)}`);
      if (res.ok) {
        const data = await res.json();
        
        const sanitizedItems = (data.items || []).map((item: any) => {
          let path = item.path;

          // Fix legacy broken path prefixes from database-saved maps
          if (path.includes('asset-enverement/') || path.includes('assets-model/asset-')) {
            const fileName = path.split('/').pop() || '';
            const nameLower = fileName.toLowerCase();
            if (nameLower.includes('tree') || nameLower.includes('birch') || nameLower.includes('pine') || nameLower.includes('oak')) {
              path = `/assets/environment/trees/${fileName}`;
            } else {
              path = `/assets/environment/vegetation/${fileName}`;
            }
          } else if (path.includes('assets-model/assets-env')) {
            const fileName = path.split('/').pop() || '';
            path = `/assets/environment/props/decor/${fileName}`;
          }

          if (path.includes('nature/trees/')) {
            path = path.replace('nature/trees/', 'trees/');
          }
          if (path.includes('nature/vegetation/')) {
            path = path.replace('nature/vegetation/', 'vegetation/');
          }

          // Prepend API base URL for valid server-relative paths
          if (path.startsWith('/assets/') || path.startsWith('/assets-model/') || path.startsWith('/assets/environment/structures/kingdom/') || path.startsWith('/assets-tree/')) {
            path = `${API_BASE_URL}${path}`;
          }
          return { ...item, path };
        });

        const loadedEnv = data.settings?.environment ?? 'STORM';
        useStore.getState().setEnvironment(loadedEnv as any);

        // Reconstruct friendly material IDs from backend PBR EXR paths
        let loadedMaterialId = data.settings?.terrainMaterialId ?? null;
        if (loadedMaterialId && (loadedMaterialId.includes('rocky_terrain') || loadedMaterialId === 'texture_2')) {
          loadedMaterialId = 'texture_2';
        } else if (loadedMaterialId && (loadedMaterialId.includes('marble_cliff') || loadedMaterialId === 'texture_1')) {
          loadedMaterialId = 'texture_1';
        }

        let loadedBrushTextureId = data.settings?.brushTextureId ?? null;
        if (loadedBrushTextureId && (loadedBrushTextureId.includes('rocky_terrain') || loadedBrushTextureId === 'texture_2')) {
          loadedBrushTextureId = 'texture_2';
        } else if (loadedBrushTextureId && (loadedBrushTextureId.includes('marble_cliff') || loadedBrushTextureId === 'texture_1')) {
          loadedBrushTextureId = 'texture_1';
        }

        set({ 
          items: sanitizedItems, 
          gridSize: data.settings?.gridSize ?? 1.0,
          gridEnabled: data.settings?.gridEnabled ?? true,
          terrainConfig: {
            height: 12.0,
            scale: 0.05,
            seed: 0,
            sharpness: 2.0,
            ...(data.settings?.terrainConfig || {})
          },
          terrainMaterialId: loadedMaterialId,
          terrainColor: data.settings?.terrainColor ?? '#3d5c36',
          sky: data.settings?.sky ?? 'sunset',
          environment: loadedEnv,
          lightIntensity: data.settings?.lightIntensity !== undefined ? data.settings?.lightIntensity : null,
          ambientIntensity: data.settings?.ambientIntensity !== undefined ? data.settings?.ambientIntensity : null,
          sunAngle: data.settings?.sunAngle !== undefined ? data.settings?.sunAngle : 45,
          fogDensity: data.settings?.fogDensity !== undefined ? data.settings?.fogDensity : 0.002,
          paintData: sanitizeCanvasData(data.paintData) || null,
          sculptData: sanitizeCanvasData(data.sculptData) || null,
          brushTextureId: loadedBrushTextureId,
          savedPaintBlueprints: data.settings?.savedPaintBlueprints || [],
          skyboxIntensity: data.settings?.skyboxIntensity !== undefined ? data.settings?.skyboxIntensity : null,
          bloomThreshold: data.settings?.bloomThreshold !== undefined ? data.settings?.bloomThreshold : null,
          bloomStrength: data.settings?.bloomStrength !== undefined ? data.settings?.bloomStrength : null,
          bloomRadius: data.settings?.bloomRadius !== undefined ? data.settings?.bloomRadius : null,
          history: [sanitizedItems],
          historyIndex: 0
        });
      }
    } catch (e) {
      console.error("Failed to load map from database", e);
    }
  },

  gridSize: 1,
  setGridSize: (gridSize) => {
    set({ gridSize });
    debouncedSave();
  },
  gridEnabled: true,
  setGridEnabled: (gridEnabled) => {
    set({ gridEnabled });
    debouncedSave();
  },
  
  terrainConfig: {
    height: 12.0,
    scale: 0.05,
    seed: 0,
    sharpness: 2.0
  },
  setTerrainConfig: (config) => {
    set((state) => ({ 
      terrainConfig: { ...state.terrainConfig, ...config } 
    }));
    debouncedSave();
  },

  terrainMaterialId: null,
  setTerrainMaterialId: (id) => {
    set({ terrainMaterialId: id });
    debouncedSave();
  },

  terrainColor: '#3d5c36',
  setTerrainColor: (color) => {
    set({ terrainColor: color });
    debouncedSave();
  },

  sky: 'sunset',
  setSky: (sky) => {
    set({ sky });
    debouncedSave();
  },

  environment: 'STORM',
  setEnvironment: (environment) => {
    set({ environment });
    useStore.getState().setEnvironment(environment as any);
    debouncedSave();
  },

  lightIntensity: null,
  setLightIntensity: (lightIntensity) => {
    set({ lightIntensity });
    debouncedSave();
  },
  ambientIntensity: null,
  setAmbientIntensity: (ambientIntensity) => {
    set({ ambientIntensity });
    debouncedSave();
  },
  sunAngle: 45,
  setSunAngle: (sunAngle) => {
    set({ sunAngle });
    debouncedSave();
  },
  fogDensity: 0.002,
  setFogDensity: (fogDensity) => {
    set({ fogDensity });
    debouncedSave();
  },

  skyboxIntensity: null,
  setSkyboxIntensity: (skyboxIntensity) => {
    set({ skyboxIntensity });
    debouncedSave();
  },
  bloomThreshold: null,
  setBloomThreshold: (bloomThreshold) => {
    set({ bloomThreshold });
    debouncedSave();
  },
  bloomStrength: null,
  setBloomStrength: (bloomStrength) => {
    set({ bloomStrength });
    debouncedSave();
  },
  bloomRadius: null,
  setBloomRadius: (bloomRadius) => {
    set({ bloomRadius });
    debouncedSave();
  },

  paintMode: false,
  setPaintMode: (paintMode) => set({ paintMode }),
  brushSize: 10,
  setBrushSize: (brushSize) => set({ brushSize }),
  brushColor: '#5a4d3a',
  setBrushColor: (brushColor) => set({ brushColor }),
  brushTextureId: null,
  setBrushTextureId: (id) => set({ brushTextureId: id }),
  paintData: null,
  setPaintData: (paintData) => {
    set({ paintData });
    localStorage.setItem('world_editor_paint', paintData || '');
  },

  terrainMode: 'paint',
  setTerrainMode: (terrainMode) => set({ terrainMode }),
  sculptTool: 'raise',
  setSculptTool: (sculptTool) => set({ sculptTool }),
  sculptData: null,
  setSculptData: (sculptData) => {
    set({ sculptData });
    localStorage.setItem('world_editor_sculpt', sculptData || '');
  },
  
  brushStrength: 0.25,
  setBrushStrength: (brushStrength) => set({ brushStrength }),
  brushRotation: 0,
  setBrushRotation: (brushRotation) => set({ brushRotation }),
  brushMaskId: 'softCircle',
  setBrushMaskId: (brushMaskId) => set({ brushMaskId }),
  
  brushHoverPos: null,
  setBrushHoverPos: (brushHoverPos) => set({ brushHoverPos }),

  savedPaintBlueprints: [],
  activePaintBlueprintId: null,

  createPaintBlueprint: (name, config) => {
    const newBlueprint = {
      ...config,
      id: 'blueprint_' + Math.random().toString(36).substr(2, 9),
      name
    };
    set((state) => {
      const next = [...state.savedPaintBlueprints, newBlueprint];
      return { savedPaintBlueprints: next, activePaintBlueprintId: newBlueprint.id };
    });
    debouncedSave();
  },

  deletePaintBlueprint: (id) => {
    set((state) => {
      const next = state.savedPaintBlueprints.filter(b => b.id !== id);
      const nextActiveId = state.activePaintBlueprintId === id ? null : state.activePaintBlueprintId;
      return { savedPaintBlueprints: next, activePaintBlueprintId: nextActiveId };
    });
    debouncedSave();
  },

  applyPaintBlueprint: (id) => {
    const blueprint = get().savedPaintBlueprints.find(b => b.id === id);
    if (blueprint) {
      set({
        activePaintBlueprintId: id,
        brushMaskId: blueprint.maskType,
        brushTextureId: blueprint.textureId,
        brushColor: blueprint.brushColor,
        brushSize: blueprint.defaultSize,
        brushStrength: blueprint.defaultIntensity
      });
    }
  },

  // Procedural Vegetation Generator States/Actions
  vegetationTheme: 'pine',
  setVegetationTheme: (theme) => {
    set({ vegetationTheme: theme });
  },
  vegetationDensity: 60,
  setVegetationDensity: (density) => {
    set({ vegetationDensity: density });
  },
  generateVegetation: () => {
    const { vegetationTheme, vegetationDensity, terrainConfig, items } = get();
    
    const themeAssets: Record<string, { paths: string[], colors?: string[] }> = {
      pine: {
        paths: [
          "/assets/environment/trees/BirchTree_1.glb",
          "/assets/environment/trees/BirchTree_2.glb",
          "/assets/environment/trees/BirchTree_3.glb",
          "/assets/environment/trees/BirchTree_4.glb",
          "/assets/environment/trees/BirchTree_5.glb",
          "/assets/environment/vegetation/Grass_Small.glb"
        ]
      },
      cherry: {
        paths: [
          "/assets/environment/trees/MapleTree_1.glb",
          "/assets/environment/trees/MapleTree_2.glb",
          "/assets/environment/trees/MapleTree_3.glb",
          "/assets/environment/trees/MapleTree_4.glb",
          "/assets/environment/trees/MapleTree_5.glb"
        ],
        colors: ["#fda4af", "#f472b6", "#ec4899", "#db2777"]
      },
      autumn: {
        paths: [
          "/assets/environment/trees/MapleTree_1.glb",
          "/assets/environment/trees/MapleTree_2.glb",
          "/assets/environment/trees/MapleTree_3.glb"
        ],
        colors: ["#f59e0b", "#d97706", "#b45309", "#ea580c", "#ca8a04"]
      },
      desert: {
        paths: [
          "/assets/environment/trees/DeadTree_1.glb",
          "/assets/environment/trees/DeadTree_2.glb",
          "/assets/environment/trees/DeadTree_3.glb",
          "/assets/environment/trees/DeadTree_4.glb",
          "/assets/environment/trees/DeadTree_5.glb",
          "/assets/environment/trees/DeadTree_6.glb",
          "/assets/environment/trees/DeadTree_7.glb",
          "/assets/environment/trees/DeadTree_8.glb",
          "/assets/environment/trees/DeadTree_9.glb",
          "/assets/environment/trees/DeadTree_10.glb"
        ],
        colors: ["#a1a1aa", "#71717a", "#b45309", "#78350f"]
      },
      clover: {
        paths: [
          "/assets/environment/vegetation/Bush.glb",
          "/assets/environment/vegetation/Bush_Large.glb",
          "/assets/environment/vegetation/Bush_Small.glb",
          "/assets/environment/vegetation/Flower_1_Clump.glb",
          "/assets/environment/vegetation/Flower_2_Clump.glb",
          "/assets/environment/vegetation/Flower_3_Clump.glb"
        ],
        colors: ["#34d399", "#059669", "#10b981", "#047857"]
      }
    };

    const config = themeAssets[vegetationTheme] || themeAssets.pine;
    const generatedItems: MapItem[] = [];
    const baseDistance = 24;
    
    for (let i = 0; i < vegetationDensity; i++) {
      let x = 0;
      let z = 0;
      let dist = 0;
      
      // Avoid spawning directly in center base
      for (let attempt = 0; attempt < 15; attempt++) {
        x = (Math.random() - 0.5) * 110;
        z = (Math.random() - 0.5) * 110;
        dist = Math.sqrt(x * x + z * z);
        if (dist > baseDistance + 6) break;
      }
      
      // Calculate precise elevation at (x, z) including current sculpt height!
      const terrainH = getTerrainElevation(x, z, "STORM", baseDistance, terrainConfig, false);
      const y = terrainH; // Align with GROUND_Y (now 0.0)

      let modelPath = config.paths[Math.floor(Math.random() * config.paths.length)];
      if (modelPath.startsWith('/')) {
        modelPath = `${API_BASE_URL}${modelPath}`;
      }
      const sizeScale = 0.6 + Math.random() * 0.9; // 0.6 to 1.5 times
      
      const pos: [number, number, number] = [x, y, z];
      const rot: [number, number, number] = [0, Math.random() * Math.PI * 2, 0];
      const sca: [number, number, number] = [sizeScale, sizeScale, sizeScale];
      const color = config.colors ? config.colors[Math.floor(Math.random() * config.colors.length)] : undefined;
      
      generatedItems.push({
        id: `procedural-veg-${vegetationTheme}-${Date.now()}-${i}-${Math.random()}`,
        type: 'procedural-vegetation',
        path: modelPath,
        pos,
        rot,
        sca,
        color
      });
    }
    
    // Merge, keeping other non-procedural items
    const otherItems = items.filter(item => item.type !== 'procedural-vegetation');
    const newItems = [...otherItems, ...generatedItems];
    
    get().updateItemsWithHistory(newItems);
  },
  clearVegetation: () => {
    const { items } = get();
    const filtered = items.filter(item => item.type !== 'procedural-vegetation');
    get().updateItemsWithHistory(filtered);
  },

  cameraFocusTarget: null,
  setCameraFocusTarget: (target) => set({ cameraFocusTarget: target }),
  vegetationBrushActive: false,
  setVegetationBrushActive: (active) => set(() => {
    if (active) {
      // Deactivate normal assets carrying and normal paintMode when activating vegetation brush
      return {
        vegetationBrushActive: true,
        paintMode: false,
        activeAsset: null,
        selectedId: null,
        selectedIds: []
      };
    } else {
      return {
        vegetationBrushActive: false
      };
    }
  })
}));
