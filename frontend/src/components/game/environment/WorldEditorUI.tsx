'use client';

import { useState, useEffect } from 'react';
import { Loader2, Package, Menu, Layers, Sun, Settings } from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';

// ─── NEW MODULAR COMPONENTS ───
import { EditorToolbar } from './editor/EditorToolbar';
import { SceneHierarchy } from './editor/SceneHierarchy';

// ─── EXISTING MODULES (unchanged internals) ───
import { MapSettingsModule } from './editor/MapSettingsModule';
import { AssetsLibraryModule } from './editor/AssetsLibraryModule';
import { TransformsModule } from './editor/TransformsModule';
import { TerrainEditorModule } from './editor/TerrainEditorModule';
import { VegetationModule } from './editor/VegetationModule';
import { LightingSettingsModule } from './editor/LightingSettingsModule';

/**
 * WorldEditorUI — Unity-inspired layout.
 *
 * Structure:
 *   ┌──────────────────────────────────────┐
 *   │ EditorToolbar (context + undo/save)  │
 *   ├──────────┬───────────────────────────┤
 *   │ Hierarchy│ Inspector (context-based) │
 *   │ (scene   │  nothing → Assets+Scene   │
 *   │  tree)   │  terrain → Terrain tools  │
 *   │          │  mesh    → Transform      │
 *   ├──────────┴───────────────────────────┤
 *   │ Status bar (object count + health)   │
 *   └──────────────────────────────────────┘
 *
 * Pure UI refactor — all store mechanisms unchanged.
 */
export const WorldEditorUI = () => {
  const {
    isEditorOpen,
    setIsEditorOpen,
    selectedId,
    setSelectedId,
    toggleSelectedId,
    setPaintMode,
    fetchMapList,
    fetchDynamicAssets,
    loadFromDatabase,
    items,
    isSaving,
  } = useEditorStore();

  const [mounted, setMounted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [globalTab, setGlobalTab] = useState<'assets' | 'scene' | 'lighting'>('assets');
  const [terrainTab, setTerrainTab] = useState<'sculpt' | 'vegetation'>('sculpt');

  useEffect(() => {
    setMounted(true);
    loadFromDatabase();
    fetchDynamicAssets();
    fetchMapList();
    const timer = setTimeout(() => setIsInitializing(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Sync paint mode with terrain selection
  useEffect(() => {
    if (selectedId === 'terrain') {
      setPaintMode(true);
    } else {
      setPaintMode(false);
    }
  }, [selectedId]);

  // Keyboard Nudge & Shortkeys Listener (unchanged mechanism)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditorOpen) return;
      const { selectedIds } = useEditorStore.getState();

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      const { selectedId, brushSize, setBrushSize, brushStrength, setBrushStrength, setBrushMaskId } = useEditorStore.getState();
      if (selectedId === 'terrain') {
        if (e.key === '1') { setBrushMaskId('softCircle'); e.preventDefault(); return; }
        else if (e.key === '2') { setBrushMaskId('hardCircle'); e.preventDefault(); return; }
        else if (e.key === '3') { setBrushMaskId('star'); e.preventDefault(); return; }
        else if (e.key === '4') { setBrushMaskId('hexagon'); e.preventDefault(); return; }
        else if (e.key === '5') { setBrushMaskId('starOutline'); e.preventDefault(); return; }
        else if (e.key === '6') { setBrushMaskId('square'); e.preventDefault(); return; }

        if (e.key === '[') { setBrushSize(Math.max(1, brushSize - 2)); e.preventDefault(); return; }
        else if (e.key === ']') { setBrushSize(Math.min(150, brushSize + 2)); e.preventDefault(); return; }
        else if (e.key === '-') { setBrushStrength(Math.max(0.01, brushStrength - 0.05)); e.preventDefault(); return; }
        else if (e.key === '=' || e.key === '+') { setBrushStrength(Math.min(1.0, brushStrength + 0.05)); e.preventDefault(); return; }
      }

      if (selectedIds.length === 0) return;
      const step = e.shiftKey ? 0.5 : 0.1;
      let dx = 0, dy = 0, dz = 0;
      let handled = false;

      switch (e.key) {
        case 'ArrowLeft': dx = -step; handled = true; break;
        case 'ArrowRight': dx = step; handled = true; break;
        case 'ArrowUp': dz = -step; handled = true; break;
        case 'ArrowDown': dz = step; handled = true; break;
        case 'PageUp': dy = step; handled = true; break;
        case 'PageDown': dy = -step; handled = true; break;
        case 'Escape': setSelectedId(null); handled = true; break;
        default: break;
      }

      if (handled) {
        e.preventDefault();
        const { items: activeItems, setItems: activeSetItems } = useEditorStore.getState();
        const nextItems = activeItems.map(item =>
          selectedIds.includes(item.id)
            ? { ...item, pos: [item.pos[0] + dx, item.pos[1] + dy, item.pos[2] + dz] as [number, number, number] }
            : item
        );
        activeSetItems(nextItems);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditorOpen, setSelectedId, toggleSelectedId]);

  if (!mounted) return null;

  // ─── INSPECTOR CONTENT (context-sensitive) ───
  const renderInspector = () => {
    // Case 1: Terrain selected → Terrain tools
    if (selectedId === 'terrain') {
      return (
        <div className="flex flex-col h-full">
          {/* Terrain sub-tabs */}
          <div className="flex gap-0.5 px-3 pt-2 pb-1 flex-shrink-0">
            <button
              onClick={() => setTerrainTab('sculpt')}
              className={`flex-1 py-1.5 rounded-t-lg text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
                terrainTab === 'sculpt'
                  ? 'text-indigo-400 border-indigo-500 bg-indigo-500/5'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              🏔️ Sculpt & Paint
            </button>
            <button
              onClick={() => setTerrainTab('vegetation')}
              className={`flex-1 py-1.5 rounded-t-lg text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
                terrainTab === 'vegetation'
                  ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              🌿 Vegetation
            </button>
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 min-h-0">
            {terrainTab === 'sculpt' ? <TerrainEditorModule /> : <VegetationModule />}
          </div>
        </div>
      );
    }

    // Case 2: Mesh/object selected → Transform inspector
    if (selectedId && selectedId !== 'terrain') {
      return (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 min-h-0">
          <TransformsModule />
        </div>
      );
    }

    // Case 3: Nothing selected → Global scene tools
    return (
      <div className="flex flex-col h-full">
        {/* Global sub-tabs */}
        <div className="flex gap-0.5 px-3 pt-2 pb-1 flex-shrink-0 border-b border-zinc-800/40">
          {([
            { id: 'assets' as const, icon: <Layers className="w-3 h-3" />, label: 'Assets' },
            { id: 'scene' as const, icon: <Settings className="w-3 h-3" />, label: 'Scene' },
            { id: 'lighting' as const, icon: <Sun className="w-3 h-3" />, label: 'Lighting' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setGlobalTab(tab.id)}
              className={`flex-1 py-1.5 rounded-t-lg text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 border-b-2 ${
                globalTab === tab.id
                  ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 min-h-0">
          {globalTab === 'assets' && <AssetsLibraryModule />}
          {globalTab === 'scene' && <MapSettingsModule />}
          {globalTab === 'lighting' && <LightingSettingsModule />}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex select-none text-zinc-200">

      {/* ─── LOADING OVERLAY ─── */}
      {isEditorOpen && isInitializing && (
        <div className="fixed inset-0 z-[10005] bg-zinc-950/85 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <h2 className="mt-4 text-white font-mono text-xs uppercase tracking-[0.2em] font-black">Syncing Editor Pipeline</h2>
          <p className="mt-1 text-blue-400/60 font-mono text-[8px] uppercase tracking-widest">Preloading meshes & modular shaders...</p>
        </div>
      )}

      {/* ─── FLOATING OPEN BUTTON (WHEN CLOSED) ─── */}
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

      {/* ─── MAIN EDITOR PANEL ─── */}
      {isEditorOpen && (
        <div className="world-editor-ui w-[420px] h-screen bg-zinc-950/95 border-r border-zinc-800/60 flex flex-col pointer-events-auto z-[9999] shadow-2xl relative overflow-hidden font-sans backdrop-blur-xl">

          {/* ─── SAVING OVERLAY ─── */}
          {isSaving && (
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md z-[10000] flex flex-col items-center justify-center animate-in fade-in duration-350">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-16 h-16 rounded-full border border-blue-500/20 animate-ping duration-1000" />
                <div className="w-12 h-12 rounded-full border-t-2 border-r-2 border-b-2 border-transparent border-t-blue-500 border-r-indigo-500 animate-spin" />
                <div className="absolute w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_12px_#3b82f6] animate-pulse" />
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-zinc-300 mt-4 animate-pulse">Saving Workspace</span>
              <span className="text-[7.5px] font-bold text-zinc-500 mt-1 uppercase tracking-widest">Syncing with PostgreSQL...</span>
            </div>
          )}

          {/* Row 1: Top Toolbar */}
          <EditorToolbar />

          {/* Row 2: Main content — Hierarchy (left) + Inspector (right) */}
          <div className="flex-1 flex min-h-0 overflow-hidden">

            {/* Left: Scene Hierarchy (always visible) */}
            <div className="w-[145px] flex-shrink-0 border-r border-zinc-800/40 overflow-hidden flex flex-col">
              <SceneHierarchy />
            </div>

            {/* Right: Context-Sensitive Inspector */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Inspector header */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/40 bg-zinc-950/60 flex-shrink-0">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                  {selectedId === 'terrain' ? 'Terrain Inspector' : selectedId ? 'Object Inspector' : 'Scene Inspector'}
                </span>
                {selectedId && (
                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-[7px] font-bold text-zinc-600 hover:text-zinc-300 uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    ← Back
                  </button>
                )}
              </div>
              {/* Inspector body */}
              {renderInspector()}
            </div>
          </div>

          {/* Row 3: Status Bar */}
          <div className="px-3 py-2 bg-zinc-950/80 border-t border-zinc-800/50 flex items-center justify-between text-[8px] font-semibold tracking-wider text-zinc-500 flex-shrink-0">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Package className="w-3 h-3 text-blue-500" />
              {items.length} placed
            </span>
            <span className="text-zinc-600">
              [ ] brush • Shift+drag invert • Ctrl+Z undo
            </span>
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
