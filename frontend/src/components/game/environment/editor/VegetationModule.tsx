'use client';

import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { Trash2, Paintbrush } from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';
import { API_BASE_URL } from '@/src/core/config';

const GRASS_ASSETS = [
  { path: "/assets/environment/vegetation/Grass_Large.glb", label: "Grass Large" },
  { path: "/assets/environment/vegetation/Grass_Small.glb", label: "Grass Small" },
  { path: "/assets/environment/vegetation/Grass_Large_Extruded.glb", label: "Grass Extruded" },
  { path: "/assets/environment/vegetation/Grass_Wispy_Short.glb", label: "Wispy Short" },
  { path: "/assets/environment/vegetation/Grass_Wispy_Tall.glb", label: "Wispy Tall" },
  { path: "/assets/environment/vegetation/Grass_Common_Short.glb", label: "Common Short" },
  { path: "/assets/environment/vegetation/Grass_Common_Tall.glb", label: "Common Tall" },
  { path: "/assets/environment/vegetation/Clover_1.glb", label: "Clover 1" },
  { path: "/assets/environment/vegetation/Clover_2.glb", label: "Clover 2" },
  { path: "/assets/environment/vegetation/Fern_1.glb", label: "Fern" },
  { path: "/assets/environment/vegetation/Flower_1.glb", label: "Flower 1" },
  { path: "/assets/environment/vegetation/Flower_1_Clump.glb", label: "Flower Clump 1" },
  { path: "/assets/environment/vegetation/Flower_2.glb", label: "Flower 2" },
  { path: "/assets/environment/vegetation/Flower_2_Clump.glb", label: "Flower Clump 2" },
];

export const VegetationModule = () => {
  const {
    vegetationTheme,
    setVegetationTheme,
    vegetationDensity,
    setVegetationDensity,
    clearVegetation,
    vegetationBrushActive,
    setVegetationBrushActive,
    vegetationSingleAsset,
    setVegetationSingleAsset,
    vegetationFixedScale,
    setVegetationFixedScale,
    vegetationRadius,
    setVegetationRadius,
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-3.5 font-sans text-[10px] text-zinc-300">

      {/* Themes Selection grid */}
      <div className="flex flex-col gap-1.5">
        <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Vegetation Theme</span>
        <div className="grid grid-cols-6 gap-1.5 bg-zinc-950 p-2 rounded-xl border border-zinc-900 text-[8px] font-bold">
          {[
            { id: 'pine', icon: '🌲', label: 'Pine' },
            { id: 'cherry', icon: '🌸', label: 'Cherry' },
            { id: 'autumn', icon: '🍁', label: 'Autumn' },
            { id: 'desert', icon: '🏜️', label: 'Desert' },
            { id: 'clover', icon: '🍀', label: 'Clover' },
            { id: 'grass', icon: '🌿', label: 'Grass' }
          ].map(theme => (
            <button
              key={theme.id}
              onClick={() => {
                setVegetationTheme(theme.id as any);
                setVegetationSingleAsset(null);
              }}
              className={`py-2 rounded-lg flex flex-col items-center justify-center transition-all border duration-200 cursor-pointer ${vegetationTheme === theme.id
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

      {/* Single Asset Picker — only for grass theme */}
      {vegetationTheme === 'grass' && (
        <div className="flex flex-col gap-1.5 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest">Asset Mode</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setVegetationSingleAsset(null)}
              className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold transition-all cursor-pointer ${vegetationSingleAsset === null
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 border'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                }`}
            >
              Mixed
            </button>
            <button
              onClick={() => setVegetationSingleAsset(GRASS_ASSETS[0].path)}
              className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold transition-all cursor-pointer ${vegetationSingleAsset !== null
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 border'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                }`}
            >
              Single
            </button>
          </div>

          {vegetationSingleAsset !== null && (
            <select
              value={vegetationSingleAsset}
              onChange={(e) => setVegetationSingleAsset(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[8px] text-zinc-300 font-bold cursor-pointer mt-1"
            >
              {GRASS_ASSETS.map(a => (
                <option key={a.path} value={a.path}>{a.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── GLB Preview Box ── */}
      {vegetationTheme === 'grass' && vegetationSingleAsset !== null && (
        <div className="flex flex-col gap-1 bg-zinc-950/40 p-2 rounded-xl border border-zinc-900 items-center">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest self-start pl-0.5">Preview</span>
          <div className="w-16 h-16 bg-zinc-900 rounded-lg overflow-hidden">
            <GrassPreview path={vegetationSingleAsset} />
          </div>
          <span className="text-zinc-600 text-[7px] font-mono truncate w-full text-center">
            {GRASS_ASSETS.find(a => a.path === vegetationSingleAsset)?.label || ''}
          </span>
        </div>
      )}

      {/* Fixed Scale slider */}
      <div className="flex flex-col gap-1 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest">Scale</span>
          <span className="text-[8px] font-mono font-bold text-zinc-400">
            {vegetationFixedScale > 0 ? `Fixed: ${vegetationFixedScale.toFixed(2)}x` : 'Random 0.55–1.45'}
          </span>
        </div>
        <div className="flex gap-1.5 items-center">
          <button
            onClick={() => setVegetationFixedScale(0)}
            className={`px-2 py-1 rounded-lg text-[8px] font-bold transition-all cursor-pointer ${vegetationFixedScale === 0
              ? 'bg-zinc-800 text-zinc-200'
              : 'bg-zinc-900 text-zinc-600 hover:text-zinc-400'
              }`}
          >
            Rand
          </button>
          <input
            type="range" min="0.1" max="5" step="0.05"
            value={vegetationFixedScale || 0.55}
            onChange={(e) => setVegetationFixedScale(parseFloat(e.target.value))}
            className="flex-1 accent-indigo-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
          />
          <span className="text-[9px] font-mono w-10 text-right text-zinc-500">
            {vegetationFixedScale > 0 ? vegetationFixedScale.toFixed(1) : '—'}
          </span>
        </div>
      </div>

      {/* Radius Slider */}
      <div className="flex flex-col gap-1 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest">Radius</span>
          <span className="text-[8px] font-mono font-bold text-emerald-400">{vegetationRadius}m</span>
        </div>
        <input
          type="range" min="2" max="30" step="0.5"
          value={vegetationRadius}
          onChange={(e) => setVegetationRadius(parseFloat(e.target.value))}
          className="w-full accent-emerald-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
        />
      </div>

      {/* Density Slider */}
      <div className="flex flex-col gap-1 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
        <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
          <span className="uppercase tracking-wider">Density</span>
          <span className="text-emerald-400 font-mono font-bold">{vegetationDensity} / Spray</span>
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
          className={`py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 shadow-md cursor-pointer select-none border ${vegetationBrushActive
            ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
            : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300'
            }`}
        >
          <Paintbrush className={`w-3.5 h-3.5 ${vegetationBrushActive ? 'text-white' : 'text-emerald-500'}`} />
          {vegetationBrushActive ? 'Kuas Aktif (Spray ON)' : 'Kuas Vegetasi'}
        </button>
        <button
          onClick={() => {
            if (confirm("Wipe all procedurally generated trees/grass?")) {
              clearVegetation();
            }
          }}
          className="py-2.5 bg-zinc-900 hover:bg-rose-950/20 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/30 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          Clear All
        </button>
      </div>

      {/* Quick Interactive Tip */}
      <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-900 text-[8px] leading-relaxed text-zinc-500 select-none">
        <span>
          <strong className="text-zinc-400 text-[7.5px] uppercase tracking-wide block mb-0.5">Vegetation Brush:</strong>
          Aktifkan tombol <strong className="text-emerald-400 font-bold">Kuas Vegetasi</strong>, lalu tahan <kbd className="bg-zinc-900 px-1 py-0.2 rounded border border-zinc-850 font-mono text-[8px]">Klik Kiri + Geser</kbd> di tanah untuk menyemprot.
          <span className="block mt-1 font-bold text-rose-400">Tahan <kbd className="bg-zinc-900 px-1 py-0.2 rounded border border-zinc-850 font-mono text-rose-300 text-[8px]">Shift</kbd> untuk menghapus.</span>
          <span className="block mt-1.5 text-zinc-600">
            <span className="text-emerald-400">Mixed</span>: random GLB dari tema. <span className="text-indigo-400">Single</span>: pilih 1 GLB tetap. Scale slider atur ukuran.
          </span>
        </span>
      </div>

    </div>
  );
};

/** Tiny inline preview of a single grass GLB. */
function GrassPreview({ path }: { path: string }) {
  const fullPath = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  useEffect(() => { useGLTF.preload(fullPath); }, [fullPath]);
  return null;
}
