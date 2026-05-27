'use client';

import { useState, useEffect } from 'react';
import { Loader2, Package, X, ChevronRight, Menu } from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';

// ─── IMPORT MODULAR SUB-COMPONENTS ───
import { MapSettingsModule } from './editor/MapSettingsModule';
import { AssetsLibraryModule } from './editor/AssetsLibraryModule';
import { TransformsModule } from './editor/TransformsModule';
import { TerrainEditorModule } from './editor/TerrainEditorModule';
import { VegetationModule } from './editor/VegetationModule';
import { SystemModule } from './editor/SystemModule';
import { LightingSettingsModule } from './editor/LightingSettingsModule';
import { AIPromptWidget } from './editor/AIPromptWidget';

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
    items
  } = useEditorStore();

  const [mounted, setMounted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>('elements');

  useEffect(() => {
    setMounted(true);
    loadFromDatabase();
    fetchDynamicAssets();
    fetchMapList();
    const timer = setTimeout(() => setIsInitializing(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Sync paint mode with the active accordion section in the sidebar
  useEffect(() => {
    if (activeSection === 'terrain') {
      setSelectedId('terrain');
      setPaintMode(true);
    } else {
      if (selectedId === 'terrain') {
        setSelectedId(null);
      }
      setPaintMode(false);
    }
  }, [activeSection, setPaintMode, setSelectedId]);

  // Automatically expand Transforms section when a placed object is selected
  useEffect(() => {
    if (selectedId && selectedId !== 'terrain') {
      setActiveSection('transforms');
    } else if (selectedId === 'terrain') {
      if (activeSection !== 'terrain') {
        setActiveSection('terrain');
      }
    }
  }, [selectedId, activeSection]);

  // Keyboard Nudge & Shortkeys Listener
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

      const { selectedId, brushSize, setBrushSize, brushStrength, setBrushStrength } = useEditorStore.getState();
      if (selectedId === 'terrain') {
        if (e.key === '[') {
          setBrushSize(Math.max(1, brushSize - 2));
          e.preventDefault();
          return;
        } else if (e.key === ']') {
          setBrushSize(Math.min(150, brushSize + 2));
          e.preventDefault();
          return;
        } else if (e.key === '-') {
          setBrushStrength(Math.max(0.01, brushStrength - 0.05));
          e.preventDefault();
          return;
        } else if (e.key === '=' || e.key === '+') {
          setBrushStrength(Math.min(1.0, brushStrength + 0.05));
          e.preventDefault();
          return;
        }
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

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const SECTIONS = [
    { id: 'elements', label: 'Asset blueprints', component: <AssetsLibraryModule /> },
    { id: 'transforms', label: 'Mesh transforms', component: <TransformsModule /> },
    { id: 'terrain', label: 'Terrain sculpt & paint', component: <TerrainEditorModule /> },
    { id: 'vegetation', label: 'Vegetation spawner', component: <VegetationModule /> },
    { id: 'lighting', label: 'Atmosphere & Lighting', component: <LightingSettingsModule /> },
    { id: 'system', label: 'Workspace operations', component: <SystemModule /> }
  ];

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex justify-between select-none text-zinc-200">
      
      
      {/* ─── INITIALIZING LOADING OVERLAY ─── */}
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

      {/* ─── MODULAR LEFT SIDEBAR DOCK (SHADCN UI SPEC) ─── */}
      {isEditorOpen && (
        <div className="world-editor-ui w-[310px] h-screen bg-zinc-950/90 border-r border-zinc-900 flex flex-col pointer-events-auto z-[9999] shadow-2xl relative overflow-hidden font-sans backdrop-blur-xl">
          
          {/* Header Branding */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900/60 bg-zinc-950/40 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse" />
              <h3 className="text-[11px] font-extrabold tracking-[0.15em] text-zinc-100 uppercase">
                SEAL-M MAP STUDIO
              </h3>
            </div>
            
            {/* Quick Exit */}
            <button 
              onClick={() => setIsEditorOpen(false)}
              className="p-1 hover:bg-zinc-900 rounded-md text-zinc-500 hover:text-white transition-all duration-200 outline-none cursor-pointer"
              title="Close Workspace"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrolling Content Panel */}
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            
            {/* Module 1: Core Map Settings (Search, circular blue-knob sliders, Save button) */}
            <MapSettingsModule />

            {/* Accordion List (Elements, Light, Water, etc.) */}
            <div className="flex flex-col border-t border-zinc-900">
              {SECTIONS.map((sec) => (
                <div key={sec.id} className="border-b border-zinc-900/40">
                  <button
                    onClick={() => toggleSection(sec.id)}
                    className={`w-full text-left px-4 py-2.5 text-[10px] font-semibold tracking-wider transition-all duration-200 flex items-center justify-between outline-none cursor-pointer ${
                      activeSection === sec.id 
                        ? 'bg-zinc-900/40 text-blue-400 border-l-2 border-blue-500 font-bold' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/10 border-l-2 border-transparent'
                    }`}
                  >
                    <span className="uppercase">{sec.label}</span>
                    <ChevronRight className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${activeSection === sec.id ? 'rotate-90 text-blue-500' : ''}`} />
                  </button>
                  {activeSection === sec.id && (
                    <div className="px-4 pb-4 pt-1 bg-zinc-950/20 border-t border-zinc-900/30 animate-in fade-in duration-200">
                      {sec.component}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>

          {/* Telemetry diagnostics footer */}
          <div className="px-4 py-2.5 bg-zinc-950/80 border-t border-zinc-900/60 flex items-center justify-between text-[9px] font-semibold tracking-wider text-zinc-500 flex-shrink-0">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Package className="w-3.5 h-3.5 text-blue-500" />
              PLACED LAYERS: {items.length}
            </span>
            <span className="text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              OPTIMAL
            </span>
          </div>

        </div>
      )}

      {/* ─── MODULAR RIGHT SIDEBAR DOCK (DEEPSEEK AI) ─── */}
      <AIPromptWidget />

    </div>
  );
};
