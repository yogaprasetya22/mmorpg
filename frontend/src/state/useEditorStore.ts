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
}

export const ASSET_LIBRARY = FULL_ASSET_LIBRARY;

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
        lastUsedRotations: state.lastUsedRotations
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
          lastUsedRotations: parsed.lastUsedRotations || {}
        });
      } catch (e) {}
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as MapItem[];
        
        // Path Sanitization (Fix legacy paths from local storage)
        const sanitized = parsed.map(item => {
          if (item.path.includes('/models/environment/')) {
            const fileName = item.path.split('/').pop()?.replace(/_/g, '-') || '';
            
            // Check if it belongs in kingdom or assets-env
            const kingdomAssets = [
              'bridge-straight', 'tower-square', 'wall', 'wall-corner', 
              'wall-pillar', 'tree-large', 'gate', 'stairs-stone', 
              'rocks-large', 'tower-top'
            ];
            
            if (kingdomAssets.some(a => fileName.startsWith(a))) {
              // Special case for wall_buttress -> wall
              const finalName = fileName === 'wall-buttress.glb' ? 'wall.glb' : fileName;
              return { ...item, path: `/kingdom/${finalName}` };
            } else {
              return { ...item, path: `/assets-env/${fileName}` };
            }
          }
          return item;
        });

        set({ items: sanitized, history: [sanitized], historyIndex: 0 });
      } catch (e) {
        console.error("Failed to load map", e);
      }
    }

    const paint = localStorage.getItem('world_editor_paint');
    if (paint) set({ paintData: paint });
    const sculpt = localStorage.getItem('world_editor_sculpt');
    if (sculpt) set({ sculptData: sculpt });
  },
  
  saveToStorage: () => {
    const { items, gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, sky, environment, paintData, sculptData } = get();
    try {
      localStorage.setItem('world_editor_map', JSON.stringify(items));
      localStorage.setItem('world_editor_settings', JSON.stringify({ gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, sky, environment }));
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
      await fetch(`${API_BASE_URL}/api/config/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      await fetch(`${API_BASE_URL}/api/config/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      console.log(`Global activeMapId synced to: ${mapId}`);
    } catch (e) {
      console.warn("Failed to sync global activeMapId to database:", e);
    }
  },
  deleteActiveMap: async () => {
    const mapId = get().selectedMapId;
    if (mapId === "Starter Zone") {
      alert("Starter Zone adalah peta sistem bawaan dan tidak dapat dihapus!");
      return;
    }
    
    if (!confirm(`Apakah Anda yakin ingin menghapus peta "${mapId}" secara permanen? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/world-editor/delete?map_id=${encodeURIComponent(mapId)}`, {
        method: "DELETE"
      });

      if (res.ok) {
        alert("Peta berhasil dihapus!");
        // Reset active map selection back to Starter Zone
        set({ selectedMapId: "Starter Zone" });
        await get().loadFromDatabase();
        await get().fetchMapList();
      } else {
        const data = await res.json();
        alert(`Gagal menghapus peta: ${data.error || "Unknown Error"}`);
      }
    } catch (e) {
      console.error("Error deleting active map:", e);
      alert("Terjadi kesalahan saat menghapus peta!");
    }
  },

  dynamicAssets: [],
  fetchDynamicAssets: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/assets`);
      if (res.ok) {
        const assets: { name: string; path: string }[] = await res.json();
        const mapped: AssetInfo[] = assets.map(item => {
          let category: 'kingdom' | 'env' | 'tree' = 'env';
          const lowerPath = item.path.toLowerCase();
          const lowerName = item.name.toLowerCase();
          
          if (lowerPath.includes('/kingdom/') || lowerName.includes('wall') || lowerName.includes('tower') || lowerName.includes('gate') || lowerName.includes('stairs') || lowerName.includes('castle') || lowerName.includes('fortress') || lowerName.includes('bridge')) {
            category = 'kingdom';
          } else if (lowerPath.includes('/assets-tree/') || lowerPath.includes('/asset-enverement/') || lowerName.includes('tree') || lowerName.includes('pine') || lowerName.includes('birch') || lowerName.includes('oak') || lowerName.includes('grass') || lowerName.includes('flora')) {
            category = 'tree';
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
    const { selectedMapId, items, gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, sky, environment, paintData, sculptData, lightIntensity, ambientIntensity, sunAngle, fogDensity } = get();
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
      settings: { gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, sky, environment, lightIntensity, ambientIntensity, sunAngle, fogDensity },
      paintData,
      sculptData
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/world-editor/save?map_id=${encodeURIComponent(selectedMapId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        console.log(`Map '${selectedMapId}' synced to database!`);
        get().fetchMapList();
      }
    } catch (e) {
      console.error("Failed to sync map to database", e);
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
          if (path.startsWith('/assets-model/') || path.startsWith('/kingdom/') || path.startsWith('/assets-tree/')) {
            path = `${API_BASE_URL}${path}`;
          }
          return { ...item, path };
        });

        const loadedEnv = data.settings?.environment ?? 'STORM';
        useStore.getState().setEnvironment(loadedEnv as any);

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
          terrainMaterialId: data.settings?.terrainMaterialId ?? null,
          terrainColor: data.settings?.terrainColor ?? '#3d5c36',
          sky: data.settings?.sky ?? 'sunset',
          environment: loadedEnv,
          lightIntensity: data.settings?.lightIntensity !== undefined ? data.settings?.lightIntensity : null,
          ambientIntensity: data.settings?.ambientIntensity !== undefined ? data.settings?.ambientIntensity : null,
          sunAngle: data.settings?.sunAngle !== undefined ? data.settings?.sunAngle : 45,
          fogDensity: data.settings?.fogDensity !== undefined ? data.settings?.fogDensity : 0.002,
          paintData: data.paintData || null,
          sculptData: data.sculptData || null,
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
          "/assets-tree/converted/Tree Type0 01.glb",
          "/assets-tree/converted/Tree Type0 02.glb",
          "/assets-tree/converted/Tree Type0 03.glb",
          "/assets-tree/converted/Tree Type1 01.glb",
          "/assets-tree/converted/Tree Type1 02.glb",
          "/kingdom/rocks-large.glb",
          "/kingdom/rocks-small.glb"
        ]
      },
      cherry: {
        paths: [
          "/assets-tree/converted/Tree Type2 01.glb",
          "/assets-tree/converted/Tree Type2 02.glb",
          "/assets-tree/converted/Tree Type2 03.glb",
          "/assets-tree/converted/Tree Type3 01.glb",
          "/assets-tree/converted/Tree Type3 02.glb"
        ],
        colors: ["#fda4af", "#f472b6", "#ec4899", "#db2777"]
      },
      autumn: {
        paths: [
          "/assets-tree/converted/Tree Type4 01.glb",
          "/assets-tree/converted/Tree Type4 02.glb",
          "/assets-tree/converted/Tree Type5 01.glb",
          "/assets-tree/converted/Tree Type5 02.glb"
        ],
        colors: ["#f59e0b", "#d97706", "#b45309", "#ea580c", "#ca8a04"]
      },
      desert: {
        paths: [
          "/kingdom/tree-log.glb",
          "/kingdom/tree-trunk.glb",
          "/kingdom/rocks-large.glb",
          "/kingdom/rocks-small.glb"
        ],
        colors: ["#a1a1aa", "#71717a", "#b45309", "#78350f"]
      },
      clover: {
        paths: [
          "/kingdom/tree-large.glb",
          "/kingdom/tree-small.glb",
          "/assets-tree/converted/Tree Type6 01.glb",
          "/assets-tree/converted/Tree Type6 02.glb"
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
      const y = terrainH - 0.3; // Align with GROUND_Y

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
  }
}));
