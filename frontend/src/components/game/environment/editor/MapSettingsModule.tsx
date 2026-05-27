'use client';

import { Grid, Mountain, Paintbrush, Database, SunMoon, Globe } from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';

export const MapSettingsModule = () => {
  const {
    selectedMapId,
    setSelectedMapId,
    mapList,
    saveToDatabase,
    gridSize,
    setGridSize,
    terrainConfig,
    setTerrainConfig,
    brushSize,
    setBrushSize,
    sky,
    setSky,
    environment,
    setEnvironment,
    createNewMap,
    deleteActiveMap,
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-3.5 p-4 bg-zinc-950/40 border-b border-zinc-900/60 text-zinc-350 font-sans">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-widest">Map Configurator</span>
        <span className="text-[7.5px] px-1.5 py-0.5 bg-zinc-900/80 border border-zinc-800 text-zinc-500 rounded uppercase font-bold tracking-wider"> authoritative </span>
      </div>

      {/* Map Active Selection Dropdown as the Name input */}
      <div className="flex flex-col gap-1">
        <span className="text-[8px] font-extrabold text-zinc-550 uppercase tracking-widest pl-0.5">Active Workspace</span>
        <div className="flex gap-2">
          <select 
            value={selectedMapId}
            onChange={(e) => setSelectedMapId(e.target.value)}
            className="flex-1 bg-zinc-900/85 border border-zinc-800/80 rounded-md px-2.5 py-1.5 text-[10px] text-zinc-200 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer shadow-md hover:bg-zinc-850 transition-all outline-none"
          >
            {mapList.map((m: any) => (
              <option key={m.id} value={m.id} className="bg-zinc-950">{m.name}</option>
            ))}
            {mapList.length === 0 && <option value="Starter Zone">Starter Zone</option>}
          </select>
          {selectedMapId !== "Starter Zone" && (
            <button
              onClick={() => deleteActiveMap()}
              title="Delete Active Workspace"
              className="px-2.5 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 text-rose-455 hover:text-white rounded-md text-[9px] font-extrabold transition-all uppercase tracking-wider flex items-center justify-center cursor-pointer select-none"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Create New Map Inline Input */}
      <div className="flex flex-col gap-1 border-t border-zinc-900/40 pt-2.5">
        <span className="text-[8px] font-extrabold text-zinc-550 uppercase tracking-widest pl-0.5">Create New Map</span>
        <div className="flex gap-1.5">
          <input 
            type="text"
            placeholder="New Map Name..."
            id="new-map-input"
            className="flex-1 bg-zinc-950 border border-zinc-850 rounded-md px-2.5 py-1 text-[10px] text-zinc-300 font-semibold focus:border-blue-500 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) {
                  createNewMap(val);
                  (e.target as HTMLInputElement).value = '';
                }
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.getElementById('new-map-input') as HTMLInputElement;
              const val = input?.value.trim();
              if (val) {
                createNewMap(val);
                input.value = '';
              }
            }}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-550 text-white rounded-md text-[9px] font-extrabold transition-all uppercase tracking-wider cursor-pointer"
          >
            Create
          </button>
        </div>
      </div>

      {/* Skybox Selector */}
      <div className="flex flex-col gap-1 border-t border-zinc-900/40 pt-2.5">
        <span className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-widest pl-0.5 flex items-center gap-1">
          <SunMoon className="w-3 h-3 text-zinc-400" />
          Environment Skybox
        </span>
        <select 
          value={sky}
          onChange={(e) => setSky(e.target.value)}
          className="w-full bg-zinc-900/85 border border-zinc-800/80 rounded-md px-2.5 py-1.5 text-[10px] text-zinc-200 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer shadow-md hover:bg-zinc-850 transition-all outline-none"
        >
          <option value="sunset" className="bg-zinc-950">Sunset Glow</option>
          <option value="night" className="bg-zinc-950">Midnight Shadows</option>
          <option value="clear" className="bg-zinc-950">Clear Sky (Day)</option>
        </select>
      </div>

      {/* Environment Preset Selector */}
      <div className="flex flex-col gap-1">
        <span className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-widest pl-0.5 flex items-center gap-1">
          <Globe className="w-3 h-3 text-zinc-400" />
          Environment Preset
        </span>
        <select 
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          className="w-full bg-zinc-900/85 border border-zinc-800/80 rounded-md px-2.5 py-1.5 text-[10px] text-zinc-200 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer shadow-md hover:bg-zinc-850 transition-all outline-none"
        >
          <option value="STORM" className="bg-zinc-950">Open World (Storm)</option>
          <option value="DIORAMA" className="bg-zinc-950">Whimsical Diorama</option>
        </select>
      </div>

      {/* ─── CUSTOM SLIDERS ─── */}
      <div className="flex flex-col gap-3 pt-2.5 border-t border-zinc-900/40">
        
        {/* Slider 1: Grid Snapping */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest flex items-center gap-1.5">
              <Grid className="w-3 h-3 text-zinc-400" />
              Grid Snapping
            </span>
            <span className="text-blue-450 font-extrabold">{gridSize}m</span>
          </div>
          <input 
            type="range" min="0.1" max="5" step="0.1" 
            value={gridSize} 
            onChange={(e) => setGridSize(parseFloat(e.target.value))}
            className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Slider 2: Peak Height */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest flex items-center gap-1.5">
              <Mountain className="w-3 h-3 text-zinc-400" />
              Peak Heights
            </span>
            <span className="text-blue-450 font-extrabold">{terrainConfig.height.toFixed(0)}m</span>
          </div>
          <input 
            type="range" min="0" max="100" step="1" 
            value={terrainConfig.height} 
            onChange={(e) => setTerrainConfig({ height: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Slider 3: Brush Radius */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest flex items-center gap-1.5">
              <Paintbrush className="w-3 h-3 text-zinc-400" />
              Brush Radius
            </span>
            <span className="text-blue-450 font-extrabold">{brushSize}px</span>
          </div>
          <input 
            type="range" min="1" max="150" step="1" 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

      </div>

      {/* Pill Blue Save Button */}
      <div className="flex justify-center pt-1.5">
        <button
          onClick={() => saveToDatabase()}
          className="px-6 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-550 hover:to-indigo-550 active:scale-95 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-full transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center gap-1.5 border border-blue-450/20 cursor-pointer"
        >
          <Database className="w-3 h-3 text-blue-100" />
          Save Workspace
        </button>
      </div>

    </div>
  );
};
