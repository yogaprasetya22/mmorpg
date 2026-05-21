'use client';

import { Grid, Mountain, Paintbrush, Database, SunMoon, Globe, Sun, CloudFog } from 'lucide-react';
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
    lightIntensity,
    setLightIntensity,
    ambientIntensity,
    setAmbientIntensity,
    sunAngle,
    setSunAngle,
    fogDensity,
    setFogDensity
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-950/60 border-b border-zinc-800 font-mono text-zinc-350">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">Map Configurator</span>
        <span className="text-[8px] px-1 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded uppercase font-mono"> autorative </span>
      </div>

      {/* Map Active Selection Dropdown as the Name input */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[8.5px] font-bold text-zinc-500 uppercase tracking-widest pl-0.5">Active Workspace</span>
        <select 
          value={selectedMapId}
          onChange={(e) => setSelectedMapId(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-200 font-bold focus:outline-none focus:border-blue-500 cursor-pointer shadow-inner transition-colors"
        >
          {mapList.map((m: any) => (
            <option key={m.id} value={m.id} className="bg-zinc-950">{m.name}</option>
          ))}
          {mapList.length === 0 && <option value="Starter Zone">Starter Zone</option>}
        </select>
      </div>

      {/* Create New Map Inline Input */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-900/60 pt-2.5">
        <span className="text-[8.5px] font-bold text-zinc-550 uppercase tracking-widest pl-0.5">Create New Map</span>
        <div className="flex gap-1.5">
          <input 
            type="text"
            placeholder="New Map Name..."
            id="new-map-input"
            className="flex-1 bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 text-[9px] text-zinc-300 font-bold focus:border-blue-500 outline-none"
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
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[8.5px] font-bold transition-all uppercase tracking-wider"
          >
            Create
          </button>
        </div>
      </div>

      {/* Skybox Selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[8.5px] font-bold text-zinc-500 uppercase tracking-widest pl-0.5 flex items-center gap-1">
          <SunMoon className="w-3.5 h-3.5 text-zinc-400" />
          Environment Skybox
        </span>
        <select 
          value={sky}
          onChange={(e) => setSky(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-200 font-bold focus:outline-none focus:border-blue-500 cursor-pointer shadow-inner transition-colors"
        >
          <option value="sunset" className="bg-zinc-950">Sunset Glow</option>
          <option value="night" className="bg-zinc-950">Midnight Shadows</option>
          <option value="clear" className="bg-zinc-950">Clear Sky (Day)</option>
        </select>
      </div>

      {/* Environment Preset Selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[8.5px] font-bold text-zinc-500 uppercase tracking-widest pl-0.5 flex items-center gap-1">
          <Globe className="w-3.5 h-3.5 text-zinc-400" />
          Environment Preset
        </span>
        <select 
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-200 font-bold focus:outline-none focus:border-blue-500 cursor-pointer shadow-inner transition-colors"
        >
          <option value="STORM" className="bg-zinc-950">Open World (Storm)</option>
          <option value="DIORAMA" className="bg-zinc-950">Whimsical Diorama</option>
        </select>
      </div>

      {/* ─── ATMOSPHERE & LIGHTING CONFIGS ─── */}
      <div className="flex flex-col gap-3 pt-2.5 border-t border-zinc-900/60">
        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-yellow-550 animate-pulse" />
          Atmosphere & Lighting
        </span>

        {/* Slider: Sun Angle */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest flex items-center gap-1">
              Sun Angle (Shadow Rotation)
            </span>
            <span className="text-blue-400 font-bold">{sunAngle}°</span>
          </div>
          <input 
            type="range" min="0" max="360" step="5" 
            value={sunAngle} 
            onChange={(e) => setSunAngle(parseInt(e.target.value))}
            className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Slider: Direct Light */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest flex items-center gap-1">
              Direct Sun Intensity
            </span>
            <span className="text-blue-400 font-bold">{lightIntensity !== null ? lightIntensity.toFixed(1) : 'Auto'}</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0.1" max="5.0" step="0.1" 
              value={lightIntensity ?? (sky === 'night' ? (environment === 'DIORAMA' ? 2.5 : 0.8) : (environment === 'DIORAMA' ? 15.0 : 2.5))} 
              onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            {lightIntensity !== null && (
              <button 
                onClick={() => setLightIntensity(null)} 
                className="text-[7.5px] font-bold bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                AUTO
              </button>
            )}
          </div>
        </div>

        {/* Slider: Ambient Light */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest flex items-center gap-1">
              Ambient Glow Intensity
            </span>
            <span className="text-blue-400 font-bold">{ambientIntensity !== null ? ambientIntensity.toFixed(1) : 'Auto'}</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0.1" max="4.0" step="0.1" 
              value={ambientIntensity ?? (sky === 'night' ? (environment === 'DIORAMA' ? 0.8 : 0.2) : (environment === 'DIORAMA' ? 3.5 : 0.8))} 
              onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            {ambientIntensity !== null && (
              <button 
                onClick={() => setAmbientIntensity(null)} 
                className="text-[7.5px] font-bold bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                AUTO
              </button>
            )}
          </div>
        </div>

        {/* Slider: Fog Density */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest flex items-center gap-1.5">
              <CloudFog className="w-3.5 h-3.5 text-zinc-400" />
              Exponential Fog
            </span>
            <span className="text-blue-400 font-bold">{(fogDensity * 1000).toFixed(1)}k</span>
          </div>
          <input 
            type="range" min="0.0001" max="0.015" step="0.0001" 
            value={fogDensity} 
            onChange={(e) => setFogDensity(parseFloat(e.target.value))}
            className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

      </div>

      {/* ─── CUSTOM BLUE-KNOB SLIDERS ─── */}
      <div className="flex flex-col gap-3.5 pt-2.5 border-t border-zinc-900/60">
        
        {/* Slider 1: Grid Snapping */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-zinc-400" />
              Grid Snapping
            </span>
            <span className="text-blue-400 font-bold">{gridSize}m</span>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="range" min="0.1" max="5" step="0.1" 
              value={gridSize} 
              onChange={(e) => setGridSize(parseFloat(e.target.value))}
              className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Slider 2: Peak Height */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest flex items-center gap-1.5">
              <Mountain className="w-3.5 h-3.5 text-zinc-400" />
              Peak Heights
            </span>
            <span className="text-blue-400 font-bold">{terrainConfig.height.toFixed(0)}m</span>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="range" min="0" max="100" step="1" 
              value={terrainConfig.height} 
              onChange={(e) => setTerrainConfig({ height: parseFloat(e.target.value) })}
              className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Slider 3: Brush Radius */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest flex items-center gap-1.5">
              <Paintbrush className="w-3.5 h-3.5 text-zinc-400" />
              Brush Radius
            </span>
            <span className="text-blue-400 font-bold">{brushSize}px</span>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="range" min="1" max="150" step="1" 
              value={brushSize} 
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

      </div>

      {/* Pill Blue Save Button */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => saveToDatabase()}
          className="px-8 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[10px] font-black uppercase tracking-widest rounded-full transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center gap-2 border border-blue-400/20"
        >
          <Database className="w-3.5 h-3.5" />
          Save Workspace
        </button>
      </div>

    </div>
  );
};
