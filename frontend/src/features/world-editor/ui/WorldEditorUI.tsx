'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Loader2, Package, Menu, Sun, Undo2, Redo2, Database,
  Mountain, Leaf, Box, Lightbulb, FileText, Trash2, Grid3x3,
  ChevronDown
} from 'lucide-react';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';
import { API_BASE_URL } from '@jagres/shared';

// ─── MODULES ───
import { SceneHierarchy } from './SceneHierarchy';
import { AssetsLibraryModule } from './modules/AssetsLibraryModule';
import { TransformsModule } from './modules/TransformsModule';
import { TerrainEditorModule } from './modules/TerrainEditorModule';
import { VegetationModule } from './modules/VegetationModule';
import { LightingSettingsModule } from './modules/LightingSettingsModule';

// ─── NAVBAR MENU DEFINITIONS ───

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'file', label: 'File', items: [
      { id: 'new-map', label: 'New Map', icon: <FileText className="w-3 h-3" />, shortcut: 'Ctrl+N' },
      { id: 'save', label: 'Save', icon: <Database className="w-3 h-3" />, shortcut: 'Ctrl+S' },
      { id: 'load', label: 'Load Map', icon: <Package className="w-3 h-3" /> },
      { id: 'export', label: 'Export JSON', icon: <FileText className="w-3 h-3" /> },
      { id: 'import', label: 'Import JSON', icon: <FileText className="w-3 h-3" /> },
    ]
  },
  {
    id: 'edit', label: 'Edit', items: [
      { id: 'undo', label: 'Undo', icon: <Undo2 className="w-3 h-3" />, shortcut: 'Ctrl+Z' },
      { id: 'redo', label: 'Redo', icon: <Redo2 className="w-3 h-3" />, shortcut: 'Ctrl+Y' },
      { id: 'delete', label: 'Delete Selected', icon: <Trash2 className="w-3 h-3" />, shortcut: 'Del' },
      { id: 'grid-toggle', label: 'Toggle Grid Snap', icon: <Grid3x3 className="w-3 h-3" /> },
    ]
  },
  {
    id: 'terrain', label: 'Terrain', items: [
      { id: 'sculpt-raise', label: 'Sculpt — Raise', icon: <Mountain className="w-3 h-3" /> },
      { id: 'sculpt-lower', label: 'Sculpt — Lower', icon: <Mountain className="w-3 h-3" /> },
      { id: 'sculpt-smooth', label: 'Sculpt — Smooth', icon: <Mountain className="w-3 h-3" /> },
      { id: 'sculpt-flatten', label: 'Sculpt — Flatten', icon: <Mountain className="w-3 h-3" /> },
      { id: 'paint', label: 'Paint Splat', icon: <Mountain className="w-3 h-3" /> },
    ]
  },
  {
    id: 'vegetation', label: 'Vegetation', items: [
      { id: 'veg-spray', label: 'Spray Brush', icon: <Leaf className="w-3 h-3" /> },
      { id: 'veg-clear', label: 'Clear All', icon: <Trash2 className="w-3 h-3" /> },
    ]
  },
  {
    id: 'assets', label: 'Assets', items: [
      { id: 'asset-browser', label: 'Asset Library', icon: <Box className="w-3 h-3" /> },
    ]
  },
  {
    id: 'lighting', label: 'Lighting', items: [
      { id: 'sky', label: 'Sky & Fog', icon: <Sun className="w-3 h-3" /> },
      { id: 'bloom', label: 'Post-Processing', icon: <Lightbulb className="w-3 h-3" /> },
    ]
  },
];

export const WorldEditorUI = () => {
  const store = useEditorStore();
  const {
    isEditorOpen, setIsEditorOpen, selectedId, setSelectedId,
    fetchMapList, fetchDynamicAssets, loadFromDatabase, items, isSaving,
    undo, redo, saveToDatabase,
    setSculptTool, setTerrainMode, setVegetationBrushActive,
    clearVegetation
  } = store;

  const [mounted, setMounted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string>('assets');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setMounted(true);
    loadFromDatabase();
    fetchDynamicAssets();
    fetchMapList();
    const timer = setTimeout(() => setIsInitializing(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Handle menu action
  const handleMenuAction = (action: string) => {
    setActiveMenu(null);
    switch (action) {
      case 'new-map': {
        const confirmNew = confirm("Membuat peta baru akan menghapus semua objek yang belum disimpan di layar. Lanjutkan?");
        if (confirmNew) {
          const mapId = prompt("Masukkan ID/Nama Peta Baru:", `Peta_${Date.now()}`);
          if (mapId) {
            useEditorStore.getState().createNewMap(mapId);
          }
        }
        break;
      }
      case 'load': {
        useEditorStore.getState().fetchMapList().then(() => {
          const maps = useEditorStore.getState().mapList;
          if (maps.length === 0) {
            alert("Tidak ada peta tersimpan di database.");
            return;
          }
          const listStr = maps.map((m, i) => `${i + 1}. ${m.id} (Update: ${new Date(m.updated_at).toLocaleString()})`).join("\n");
          const choice = prompt(`Pilih nomor peta yang ingin dimuat:\n\n${listStr}`);
          if (choice) {
            const idx = parseInt(choice, 10) - 1;
            if (maps[idx]) {
              useEditorStore.getState().setSelectedMapId(maps[idx].id);
            } else {
              alert("Pilihan tidak valid.");
            }
          }
        });
        break;
      }
      case 'export': {
        const snap = {
          items: useEditorStore.getState().items,
          settings: {
            gridSize: useEditorStore.getState().gridSize,
            gridEnabled: useEditorStore.getState().gridEnabled,
            terrainConfig: useEditorStore.getState().terrainConfig,
            terrainMaterialId: useEditorStore.getState().terrainMaterialId,
            terrainColor: useEditorStore.getState().terrainColor,
            sky: useEditorStore.getState().sky,
            environment: useEditorStore.getState().environment,
            fogDensity: useEditorStore.getState().fogDensity,
          }
        };
        const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${useEditorStore.getState().selectedMapId || 'map'}_export.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        break;
      }
      case 'import': {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const data = JSON.parse(evt.target?.result as string);
              // Handle both raw MapItem arrays and full snapshot payloads (nodes from MCP or items from frontend)
              const loadedItems = Array.isArray(data) 
                ? data 
                : (data.nodes || data.items || []);
                
              if (loadedItems.length === 0 && !data.settings) {
                alert("File JSON tidak valid atau kosong.");
                return;
              }
              
              // Normalize MCP nodes structure to frontend MapItem structure if needed
              const normalizedItems = loadedItems.map((item: any) => {
                if (item.transform && !item.pos) { // MCP Node format
                  // Extract path from properties or fallback to category defaults
                  let path = item.path || `${API_BASE_URL}/assets/environment/rocks/Rock_Medium_1.glb`;
                  if (item.properties && item.properties.path) {
                    path = item.properties.path;
                  } else if (item.type === 'vegetation') {
                    path = item.name === 'dead_tree' 
                      ? `${API_BASE_URL}/assets/environment/trees/DeadTree_1.glb` 
                      : `${API_BASE_URL}/assets/environment/trees/Pine_1.glb`;
                  } else if (item.type === 'mountain') {
                    path = `${API_BASE_URL}/assets/environment/rocks/Rock_Medium_1.glb`;
                  } else if (item.name === 'sumur_kecil') {
                    path = `${API_BASE_URL}/assets/environment/rocks/Rock_Medium_3.glb`; // well placeholder
                  }
                  
                  return {
                    id: item.id || `item-${crypto.randomUUID()}`,
                    type: item.type || 'structure',
                    path: path,
                    pos: [item.transform.position.x, item.transform.position.y, item.transform.position.z],
                    rot: [item.transform.rotation.x, item.transform.rotation.y, item.transform.rotation.z],
                    sca: [item.transform.scale.x, item.transform.scale.y, item.transform.scale.z],
                    color: item.color || undefined
                  };
                }
                return item; // Already frontend MapItem format
              });

              useEditorStore.getState().updateItemsWithHistory(normalizedItems);
              
              // Load settings if present
              if (data.settings) {
                const s = data.settings;
                const set = useEditorStore.setState;
                if (s.gridSize) set({ gridSize: s.gridSize });
                if (s.terrainColor) set({ terrainColor: s.terrainColor });
                if (s.sky) set({ sky: s.sky });
                if (s.environment) set({ environment: s.environment });
              }
              alert(`Berhasil mengimpor ${normalizedItems.length} objek.`);
            } catch (err: any) {
              alert("Gagal membaca file JSON: " + err.message);
            }
          };
          reader.readAsText(file);
        };
        input.click();
        break;
      }
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'save': saveToDatabase(); break;
      case 'grid-toggle':
        useEditorStore.getState().setGridEnabled(!useEditorStore.getState().gridEnabled);
        break;
      case 'delete': {
        const ids = useEditorStore.getState().selectedIds;
        if (ids.length > 0) {
          useEditorStore.getState().updateItemsWithHistory(
            useEditorStore.getState().items.filter(i => !ids.includes(i.id))
          );
          useEditorStore.getState().setSelectedId(null);
        }
        break;
      }
      case 'veg-clear': clearVegetation(); break;
      case 'veg-spray':
        setSelectedId('terrain');
        setVegetationBrushActive(true);
        setActiveModule('vegetation');
        break;
      case 'sculpt-raise':
        setSelectedId('terrain');
        setTerrainMode('sculpt');
        setSculptTool('raise');
        setActiveModule('terrain');
        break;
      case 'sculpt-lower':
        setSelectedId('terrain');
        setTerrainMode('sculpt');
        setSculptTool('lower');
        setActiveModule('terrain');
        break;
      case 'sculpt-smooth':
        setSelectedId('terrain');
        setTerrainMode('sculpt');
        setSculptTool('smooth');
        setActiveModule('terrain');
        break;
      case 'sculpt-flatten':
        setSelectedId('terrain');
        setTerrainMode('sculpt');
        setSculptTool('flatten');
        setActiveModule('terrain');
        break;
      case 'paint':
        setSelectedId('terrain');
        setTerrainMode('paint');
        setActiveModule('terrain');
        break;
      case 'asset-browser': setActiveModule('assets'); break;
      case 'sky': setActiveModule('lighting'); break;
      case 'bloom': setActiveModule('lighting'); break;
      default: setActiveModule(action);
    }
  };

  // Render the active module content
  const renderModule = () => {
    if (selectedId && selectedId !== 'terrain') {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <TransformsModule />
        </div>
      );
    }

    switch (activeModule) {
      case 'terrain':
        return (
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <TerrainEditorModule />
          </div>
        );
      case 'vegetation':
        return (
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <VegetationModule />
          </div>
        );
      case 'lighting':
        return (
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <LightingSettingsModule />
          </div>
        );
      case 'assets':
      default:
        return (
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <AssetsLibraryModule />
          </div>
        );
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex select-none text-zinc-200">

      {/* Loading overlay */}
      {isEditorOpen && isInitializing && (
        <div className="fixed inset-0 z-[10005] bg-zinc-950/85 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <h2 className="mt-4 text-white font-mono text-xs uppercase tracking-[0.2em] font-black">Syncing Editor Pipeline</h2>
          <p className="mt-1 text-blue-400/60 font-mono text-[8px] uppercase tracking-widest">Preloading meshes & shaders...</p>
        </div>
      )}

      {/* Floating open button */}
      {!isEditorOpen && (
        <div className="absolute top-6 right-6 pointer-events-auto">
          <button
            onClick={() => setIsEditorOpen(true)}
            className="px-6 py-3 rounded-full font-sans text-xs font-semibold tracking-widest bg-blue-600 hover:bg-blue-500 border border-blue-400 text-white shadow-xl hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center gap-2.5"
          >
            <Menu className="w-4 h-4 animate-pulse" />
            OPEN WORLD STUDIO
          </button>
        </div>
      )}

      {/* Editor panel */}
      {isEditorOpen && (
        <div className="world-editor-ui w-[440px] h-screen bg-zinc-950/95 border-r border-zinc-800/60 flex flex-col pointer-events-auto z-[9999] shadow-2xl relative overflow-hidden font-sans backdrop-blur-xl">

          {/* Saving overlay */}
          {isSaving && (
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md z-[10000] flex flex-col items-center justify-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-16 h-16 rounded-full border border-blue-500/20 animate-ping duration-1000" />
                <div className="w-12 h-12 rounded-full border-t-2 border-r-2 border-b-2 border-transparent border-t-blue-500 border-r-indigo-500 animate-spin" />
                <div className="absolute w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_12px_#3b82f6] animate-pulse" />
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-zinc-300 mt-4 animate-pulse">Saving Workspace</span>
            </div>
          )}

          {/* ─── NAVBAR ─── */}
          <div ref={menuRef} className="flex items-center h-9 bg-zinc-900/80 border-b border-zinc-800/60 flex-shrink-0 px-1 gap-0">
            {MENU_GROUPS.map(group => (
              <div key={group.id} className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === group.id ? null : group.id)}
                  className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer flex items-center gap-1 ${activeMenu === group.id
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                >
                  {group.label}
                  <ChevronDown className={`w-2.5 h-2.5 transition-transform ${activeMenu === group.id ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {activeMenu === group.id && (
                  <div className="absolute top-full left-0 mt-0.5 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 z-[10001]">
                    {group.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleMenuAction(item.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[9px] font-bold text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-all cursor-pointer"
                      >
                        <span className="text-zinc-500">{item.icon}</span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.shortcut && (
                          <span className="text-[7px] font-mono text-zinc-600">{item.shortcut}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Quick action buttons (right side) */}
            <div className="ml-auto flex items-center gap-1 pr-1">
              <button onClick={undo} className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-white cursor-pointer" title="Undo">
                <Undo2 className="w-3 h-3" />
              </button>
              <button onClick={redo} className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-white cursor-pointer" title="Redo">
                <Redo2 className="w-3 h-3" />
              </button>
              <button onClick={() => saveToDatabase()} className="p-1 rounded-md bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 cursor-pointer" title="Save">
                <Database className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* ─── MODULE TAB BAR ─── */}
          <div className="flex items-center gap-0.5 px-2 py-1 bg-zinc-950/60 border-b border-zinc-800/40 flex-shrink-0">
            {[
              { id: 'assets', icon: <Box className="w-3 h-3" />, label: 'Assets' },
              { id: 'terrain', icon: <Mountain className="w-3 h-3" />, label: 'Terrain' },
              { id: 'vegetation', icon: <Leaf className="w-3 h-3" />, label: 'Veg' },
              { id: 'lighting', icon: <Sun className="w-3 h-3" />, label: 'Light' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveModule(tab.id);
                  if (tab.id === 'terrain' || tab.id === 'vegetation') {
                    setSelectedId('terrain');
                    if (tab.id === 'vegetation') setVegetationBrushActive(false);
                  } else {
                    if (selectedId === 'terrain') setSelectedId(null);
                  }
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeModule === tab.id && selectedId !== 'terrain'
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25'
                  : selectedId === 'terrain' && (tab.id === 'terrain' || tab.id === 'vegetation')
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/25'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 border border-transparent'
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── CONTENT ─── */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Module panel */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="flex-1 min-h-0">
                {renderModule()}
              </div>
            </div>
            {/* Hierarchy sidebar (moved to right) */}
            <div className="w-[135px] flex-shrink-0 border-l border-zinc-800/40 overflow-hidden flex flex-col">
              <SceneHierarchy />
            </div>
          </div>

          {/* ─── STATUS BAR ─── */}
          <div className="px-3 py-2 bg-zinc-950/80 border-t border-zinc-800/50 flex items-center justify-between text-[8px] font-semibold tracking-wider text-zinc-500 flex-shrink-0">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Package className="w-3 h-3 text-blue-500" />
              {items.length} placed
            </span>
            <span className="text-zinc-600">Nav menus · Ctrl+Z/Y · Del to remove</span>
            <span className="text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              OK
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
