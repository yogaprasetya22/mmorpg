'use client';

import { Mountain, Paintbrush, ArrowUp, ArrowDown, Sparkles, Eraser } from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';

export const TerrainSculptModule = () => {
  const {
    terrainMode,
    setTerrainMode,
    sculptTool,
    setSculptTool,
    terrainConfig,
    setTerrainConfig,
    setSculptData
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-3 font-mono text-[9px]">
      
      {/* Mode Switcher */}
      <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-850 text-[8.5px] font-bold">
        <button
          onClick={() => setTerrainMode('paint')}
          className={`flex-1 py-1 rounded-sm uppercase tracking-tighter transition-all flex items-center justify-center gap-1 ${
            terrainMode === 'paint' ? 'bg-blue-600 text-white shadow' : 'text-zinc-550 hover:text-zinc-350'
          }`}
        >
          <Paintbrush className="w-3.5 h-3.5" /> Paint splat
        </button>
        <button
          onClick={() => setTerrainMode('sculpt')}
          className={`flex-1 py-1 rounded-sm uppercase tracking-tighter transition-all flex items-center justify-center gap-1 ${
            terrainMode === 'sculpt' ? 'bg-blue-600 text-white shadow' : 'text-zinc-550 hover:text-zinc-350'
          }`}
        >
          <Mountain className="w-3.5 h-3.5" /> Height sculpt
        </button>
      </div>

      {/* Height Sculpting specific tools */}
      {terrainMode === 'sculpt' && (
        <div className="flex flex-col gap-2.5 animate-in slide-in-from-top-1 duration-150">
          
          <div className="flex flex-col gap-1">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Brush Tool Mode</span>
            <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded border border-zinc-850">
              <button
                onClick={() => setSculptTool('raise')}
                className={`py-1 rounded text-center transition-all flex items-center justify-center gap-1 border ${
                  sculptTool === 'raise' 
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-black' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <ArrowUp className="w-3 h-3 text-emerald-450" /> Raise Hills
              </button>
              <button
                onClick={() => setSculptTool('lower')}
                className={`py-1 rounded text-center transition-all flex items-center justify-center gap-1 border ${
                  sculptTool === 'lower' 
                    ? 'bg-rose-600/20 border-rose-500 text-rose-450 font-black' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <ArrowDown className="w-3 h-3 text-rose-455" /> Lower Valleys
              </button>
              <button
                onClick={() => setSculptTool('smooth')}
                className={`py-1 rounded text-center transition-all flex items-center justify-center gap-1 border ${
                  sculptTool === 'smooth' 
                    ? 'bg-cyan-600/20 border-cyan-500 text-cyan-400 font-black' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <Sparkles className="w-3 h-3 text-cyan-400" /> Smooth Slope
              </button>
              <button
                onClick={() => setSculptTool('flatten')}
                className={`py-1 rounded text-center transition-all flex items-center justify-center gap-1 border ${
                  sculptTool === 'flatten' 
                    ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-black' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <Eraser className="w-3 h-3 text-amber-450" /> Flatten Plain
              </button>
            </div>
          </div>

          {/* Quick instructions */}
          <div className="p-2 bg-zinc-900/60 rounded border border-zinc-850 text-[8.2px] leading-relaxed text-zinc-550 select-none">
            <span>
              <strong className="text-zinc-400">Shortcut:</strong> Hold <kbd className="bg-zinc-950 px-1 py-0.2 rounded border border-zinc-800">Shift + Drag</kbd> to temporarily invert sculpt direction (Raise ⇄ Lower).
            </span>
          </div>

        </div>
      )}

      {/* Procedural Height Presets */}
      <div className="flex flex-col gap-2.5 border-t border-zinc-850 pt-2.5">
        <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Preset Generators</span>
        <div className="grid grid-cols-4 gap-1">
          {[
            { label: 'Plains', height: 4, scale: 0.01, seed: 12 },
            { label: 'Hills', height: 18, scale: 0.05, seed: 42 },
            { label: 'Peaks', height: 50, scale: 0.12, seed: 250 },
            { label: 'Crater', height: 32, scale: 0.03, seed: 99 }
          ].map(preset => (
            <button
              key={preset.label}
              onClick={() => {
                setTerrainConfig({ height: preset.height, scale: preset.scale, seed: preset.seed });
              }}
              className="py-1 bg-zinc-950 border border-zinc-850 hover:bg-blue-600 hover:border-blue-500 hover:text-white rounded text-[8.5px] font-bold uppercase transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Procedural sliders */}
      <div className="flex flex-col gap-3 pt-1">
        
        {/* Terrain Scale */}
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between items-center text-[8.2px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest">Terrain Scale</span>
            <span className="text-blue-450 font-bold font-mono">x{terrainConfig.scale.toFixed(2)}</span>
          </div>
          <input 
            type="range" min="0.01" max="2" step="0.01" 
            value={terrainConfig.scale} 
            onChange={(e) => setTerrainConfig({ scale: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 h-1 bg-zinc-950 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* World Seed */}
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between items-center text-[8.2px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest">Noise World Seed</span>
            <span className="text-blue-450 font-bold font-mono">#{terrainConfig.seed}</span>
          </div>
          <input 
            type="range" min="0" max="1000" step="1" 
            value={terrainConfig.seed} 
            onChange={(e) => setTerrainConfig({ seed: parseInt(e.target.value) })}
            className="w-full accent-blue-500 h-1 bg-zinc-950 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Peak Sharpness */}
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between items-center text-[8.2px] font-bold text-zinc-500">
            <span className="uppercase tracking-widest">Peak Sharpness</span>
            <span className="text-blue-450 font-bold font-mono">{(terrainConfig.sharpness ?? 2.0).toFixed(1)}</span>
          </div>
          <input 
            type="range" min="1.0" max="4.0" step="0.1" 
            value={terrainConfig.sharpness ?? 2.0} 
            onChange={(e) => setTerrainConfig({ sharpness: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 h-1 bg-zinc-950 rounded appearance-none cursor-pointer"
          />
        </div>

      </div>

      {/* Operations */}
      <div className="flex gap-2 border-t border-zinc-850 pt-3">
        <button 
          onClick={() => { if (confirm("Wipe all height adjustments and flatten terrain?")) setSculptData(null); }}
          className="w-full py-1.5 bg-rose-600/10 hover:bg-rose-650 border border-rose-500/20 text-rose-400 hover:text-white rounded-lg transition-colors font-bold uppercase tracking-tight text-center"
        >
          Flatten All Heights
        </button>
      </div>

    </div>
  );
};
