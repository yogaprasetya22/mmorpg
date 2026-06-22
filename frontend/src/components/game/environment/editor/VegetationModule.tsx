'use client';

import { Trash2, Paintbrush } from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';

export const VegetationModule = () => {
  const {
    vegetationTheme,
    setVegetationTheme,
    vegetationDensity,
    setVegetationDensity,
    clearVegetation,
    vegetationBrushActive,
    setVegetationBrushActive
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-3.5 font-sans text-[10px] text-zinc-300">
      
      {/* Themes Selection grid */}
      <div className="flex flex-col gap-1.5">
        <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Vegetation Theme</span>
        <div className="grid grid-cols-5 gap-1.5 bg-zinc-950 p-2 rounded-xl border border-zinc-900 text-[8px] font-bold">
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
              className={`py-2 rounded-lg flex flex-col items-center justify-center transition-all border duration-200 cursor-pointer ${
                vegetationTheme === theme.id 
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-black shadow-[0_0_10px_rgba(16,185,129,0.25)]' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
              }`}
            >
              <span className="text-sm mb-0.5 select-none">{theme.icon}</span>
              <span className="text-[6.5px] scale-90 select-none">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Density Slider */}
      <div className="flex flex-col gap-1 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
        <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
          <span className="uppercase tracking-wider">Spawn Density Rate</span>
          <span className="text-emerald-400 font-mono font-bold">{vegetationDensity} Assets / Spray</span>
        </div>
        <input 
          type="range" min="5" max="100" step="5" 
          value={vegetationDensity} 
          onChange={(e) => setVegetationDensity(parseInt(e.target.value))}
          className="w-full accent-emerald-500 hover:accent-emerald-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Spawner Triggers */}
      <div className="grid grid-cols-2 gap-2 border-t border-zinc-900/50 pt-3">
        <button
          onClick={() => setVegetationBrushActive(!vegetationBrushActive)}
          className={`py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 shadow-md cursor-pointer select-none border ${
            vegetationBrushActive
              ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
              : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300'
          }`}
        >
          <Paintbrush className={`w-3.5 h-3.5 ${vegetationBrushActive ? 'text-white' : 'text-emerald-500'}`} />
          {vegetationBrushActive ? 'Kuas Aktif (Spray ON)' : 'Kuas Vegetasi'}
        </button>
        <button
          onClick={() => {
            if (confirm("Wipe all procedurally generated forest trees?")) {
              clearVegetation();
            }
          }}
          className="py-2.5 bg-zinc-900 hover:bg-rose-950/20 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/30 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          Clear Trees
        </button>
      </div>

      {/* Quick Interactive Tip */}
      <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-900 text-[8px] leading-relaxed text-zinc-500 select-none">
        <span>
          <strong className="text-zinc-400 text-[7.5px] uppercase tracking-wide block mb-0.5">Vegetation Brush Instruction:</strong>
          Aktifkan tombol <strong className="text-emerald-400 font-bold">Kuas Vegetasi</strong> di atas, lalu tahan <kbd className="bg-zinc-900 px-1 py-0.2 rounded border border-zinc-850 font-mono text-[8px]">Klik Kiri + Geser</kbd> di atas tanah untuk menyemprot pohon secara lokal di daerah tersebut.
          <span className="block mt-1 font-bold text-rose-400">Tahan <kbd className="bg-zinc-900 px-1 py-0.2 rounded border border-zinc-850 font-mono text-rose-300 text-[8px]">Shift</kbd> saat menggeser untuk menghapus vegetasi.</span>
        </span>
      </div>

    </div>
  );
};
