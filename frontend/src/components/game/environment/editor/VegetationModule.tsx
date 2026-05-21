'use client';

import { Sparkles } from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';

export const VegetationModule = () => {
  const {
    vegetationTheme,
    setVegetationTheme,
    vegetationDensity,
    setVegetationDensity,
    generateVegetation,
    clearVegetation
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-3 font-mono text-[9px]">
      
      {/* Themes */}
      <div className="flex flex-col gap-1">
        <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Vegetation Theme</span>
        <div className="grid grid-cols-5 gap-1 bg-zinc-950 p-1.5 rounded border border-zinc-850 text-[8px] font-bold">
          {[
            { id: 'pine', icon: '🌲', label: 'Pine' },
            { id: 'cherry', icon: '🌸', label: 'Cherry' },
            { id: 'autumn', icon: '🍁', label: 'Autumn' },
            { id: 'desert', icon: '🏜️', label: 'Desert' },
            { id: 'clover', icon: '🍀', label: 'Clover' }
          ].map(theme => (
            <button
              key={theme.id}
              onClick={() => setVegetationTheme(theme.id as any)}
              className={`py-1.5 rounded flex flex-col items-center justify-center transition-all border ${
                vegetationTheme === theme.id 
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-black' 
                  : 'border-transparent text-zinc-550 hover:text-zinc-330 hover:bg-zinc-900'
              }`}
            >
              <span className="text-sm mb-0.5">{theme.icon}</span>
              <span className="text-[6.5px] scale-90">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Density Slider */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between items-center text-[8px] font-bold text-zinc-550">
          <span className="uppercase tracking-widest">Spawn Density Rate</span>
          <span className="text-emerald-400 font-bold">{vegetationDensity} Assets</span>
        </div>
        <input 
          type="range" min="10" max="200" step="5" 
          value={vegetationDensity} 
          onChange={(e) => setVegetationDensity(parseInt(e.target.value))}
          className="w-full accent-emerald-500 h-1 bg-zinc-950 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Spawner Triggers */}
      <div className="grid grid-cols-2 gap-1.5 border-t border-zinc-850 pt-3">
        <button
          onClick={generateVegetation}
          className="py-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-md shadow-emerald-600/10"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Spawn Forest
        </button>
        <button
          onClick={clearVegetation}
          className="py-1.5 bg-zinc-900 hover:bg-rose-950/20 hover:text-rose-400 border border-zinc-800 hover:border-rose-900 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
        >
          Clear Trees
        </button>
      </div>

    </div>
  );
};
