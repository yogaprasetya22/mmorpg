'use client';

import { useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { Trash2, Paintbrush, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';
import { API_BASE_URL } from '@/src/core/config';

// ─── ALL THEME ASSETS (single source of truth) ───
export const THEME_ASSETS: Record<string, { paths: string[], colors?: string[], label: string }> = {
  pine: {
    paths: [
      '/assets/environment/trees/Pine_1.glb', '/assets/environment/trees/Pine_2.glb',
      '/assets/environment/trees/Pine_3.glb', '/assets/environment/trees/Pine_4.glb',
      '/assets/environment/trees/Pine_5.glb',
      '/assets/environment/rocks/Rock_Medium_1.glb', '/assets/environment/rocks/Rock_Medium_2.glb',
    ],
    label: 'Pine Forest',
  },
  cherry: {
    paths: [
      '/assets/environment/trees/BirchTree_1.glb', '/assets/environment/trees/BirchTree_2.glb',
      '/assets/environment/trees/BirchTree_3.glb', '/assets/environment/trees/BirchTree_4.glb',
      '/assets/environment/trees/BirchTree_5.glb',
    ],
    colors: ['#fda4af', '#f472b6', '#ec4899', '#db2777'],
    label: 'Cherry Trees',
  },
  autumn: {
    paths: [
      '/assets/environment/trees/MapleTree_1.glb', '/assets/environment/trees/MapleTree_2.glb',
      '/assets/environment/trees/MapleTree_3.glb', '/assets/environment/trees/MapleTree_4.glb',
      '/assets/environment/trees/MapleTree_5.glb',
    ],
    colors: ['#f59e0b', '#d97706', '#b45309', '#ea580c', '#ca8a04'],
    label: 'Autumn Trees',
  },
  desert: {
    paths: [
      '/assets/environment/trees/DeadTree_1.glb', '/assets/environment/trees/DeadTree_2.glb',
      '/assets/environment/rocks/Rock_Medium_3.glb', '/assets/environment/rocks/RockPath_Round_Wide.glb',
    ],
    colors: ['#a1a1aa', '#71717a', '#b45309', '#78350f'],
    label: 'Desert',
  },
  clover: {
    paths: [
      '/assets/environment/vegetation/Bush.glb', '/assets/environment/vegetation/Bush_Large.glb',
      '/assets/environment/vegetation/Bush_Small.glb',
      '/assets/environment/vegetation/Clover_1.glb', '/assets/environment/vegetation/Clover_2.glb',
    ],
    colors: ['#4ade80', '#22c55e', '#16a34a', '#86efac'],
    label: 'Clover Field',
  },
  grass: {
    paths: [
      '/assets/environment/vegetation/Grass_Large.glb', '/assets/environment/vegetation/Grass_Small.glb',
      '/assets/environment/vegetation/Grass_Large_Extruded.glb', '/assets/environment/vegetation/Grass_Wispy_Short.glb',
      '/assets/environment/vegetation/Grass_Wispy_Tall.glb', '/assets/environment/vegetation/Grass_Common_Short.glb',
      '/assets/environment/vegetation/Grass_Common_Tall.glb',
      '/assets/environment/vegetation/Clover_1.glb', '/assets/environment/vegetation/Clover_2.glb',
      '/assets/environment/vegetation/Fern_1.glb',
      '/assets/environment/vegetation/Flower_1.glb', '/assets/environment/vegetation/Flower_1_Clump.glb',
      '/assets/environment/vegetation/Flower_2.glb', '/assets/environment/vegetation/Flower_2_Clump.glb',
    ],
    colors: ['#4ade80', '#22c55e', '#16a34a', '#86efac', '#a3e635'],
    label: 'Grass Field',
  },
};

/** Extract filename from path for display */
function labelFromPath(path: string): string {
  const name = path.split('/').pop()?.replace(/\.glb$/i, '') || path;
  return name.replace(/[-_]/g, ' ');
}

export const VegetationModule = () => {
  const store = useEditorStore();
  const {
    vegetationTheme, setVegetationTheme,
    vegetationDensity, setVegetationDensity,
    clearVegetation, vegetationBrushActive, setVegetationBrushActive,
    vegetationFixedScale, setVegetationFixedScale,
    vegetationRadius, setVegetationRadius,
    vegetationAssetOverrides, setVegetationAssetOverride,
  } = store;

  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);

  const themeList = [
    { id: 'pine', icon: '🌲', label: 'Pine' },
    { id: 'cherry', icon: '🌸', label: 'Cherry' },
    { id: 'autumn', icon: '🍁', label: 'Autumn' },
    { id: 'desert', icon: '🏜️', label: 'Desert' },
    { id: 'clover', icon: '🍀', label: 'Clover' },
    { id: 'grass', icon: '🌿', label: 'Grass' },
  ];

  const currentThemeAssets = THEME_ASSETS[vegetationTheme];
  const currentOverride = vegetationAssetOverrides[vegetationTheme] ?? null;
  const isSingleMode = currentOverride !== null;

  return (
    <div className="flex flex-col gap-3.5 font-sans text-[10px] text-zinc-300">

      {/* Theme grid */}
      <div className="flex flex-col gap-1.5">
        <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Vegetation Theme</span>
        <div className="grid grid-cols-6 gap-1.5 bg-zinc-950 p-2 rounded-xl border border-zinc-900 text-[8px] font-bold">
          {themeList.map(t => (
            <button key={t.id} onClick={() => { setVegetationTheme(t.id as any); setExpandedTheme(t.id); }}
              className={`py-2 rounded-lg flex flex-col items-center justify-center transition-all border duration-200 cursor-pointer ${
                vegetationTheme === t.id ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-black shadow-[0_0_10px_rgba(16,185,129,0.25)]' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
              }`}>
              <span className="text-sm mb-0.5 select-none">{t.icon}</span>
              <span className="text-[6.5px] scale-90 select-none">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Expandable asset config per theme */}
      {currentThemeAssets && (
        <div className="flex flex-col gap-1.5 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
          <button onClick={() => setExpandedTheme(expandedTheme === vegetationTheme ? null : vegetationTheme)}
            className="flex items-center justify-between text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
            <span className="text-[8px] font-bold uppercase tracking-wider">
              {isSingleMode ? '🔹 Single Asset' : '🔀 Mixed Assets'} — {currentThemeAssets.label}
            </span>
            {expandedTheme === vegetationTheme ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          {expandedTheme === vegetationTheme && (
            <div className="flex flex-col gap-2 pt-1">
              {/* Toggle mixed / single */}
              <div className="flex gap-1.5">
                <button onClick={() => setVegetationAssetOverride(vegetationTheme, null)}
                  className={`flex-1 py-1 rounded-lg text-[8px] font-bold transition-all cursor-pointer ${
                    !isSingleMode ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 border' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                  }`}>Mixed</button>
                <button onClick={() => setVegetationAssetOverride(vegetationTheme, currentThemeAssets.paths[0])}
                  className={`flex-1 py-1 rounded-lg text-[8px] font-bold transition-all cursor-pointer ${
                    isSingleMode ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 border' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                  }`}>Single</button>
              </div>

              {/* Single asset picker */}
              {isSingleMode && (
                <select value={currentOverride || ''} onChange={e => setVegetationAssetOverride(vegetationTheme, e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[8px] text-zinc-300 font-bold cursor-pointer">
                  {currentThemeAssets.paths.map(p => (
                    <option key={p} value={p}>{labelFromPath(p)}</option>
                  ))}
                </select>
              )}

              {/* Asset list with checkboxes for multi-select */}
              <div className="max-h-28 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 bg-zinc-900/40 rounded-lg p-1">
                {currentThemeAssets.paths.map(p => {
                  const isSelected = isSingleMode ? currentOverride === p : true;
                  return (
                    <label key={p} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[7.5px] cursor-pointer transition-colors ${
                      isSelected ? 'text-zinc-200 bg-zinc-800/60' : 'text-zinc-500 hover:text-zinc-300'
                    }`}>
                      <input type="checkbox" checked={isSelected} readOnly
                        className="w-2.5 h-2.5 accent-emerald-500 cursor-pointer" />
                      <span className="truncate">{labelFromPath(p)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
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
          <button onClick={() => setVegetationFixedScale(0)}
            className={`px-2 py-1 rounded-lg text-[8px] font-bold transition-all cursor-pointer ${vegetationFixedScale === 0 ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-900 text-zinc-600 hover:text-zinc-400'}`}>Rand</button>
          <input type="range" min="0.1" max="5" step="0.05" value={vegetationFixedScale || 0.55}
            onChange={e => setVegetationFixedScale(parseFloat(e.target.value))}
            className="flex-1 accent-indigo-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer" />
          <span className="text-[9px] font-mono w-10 text-right text-zinc-500">{vegetationFixedScale > 0 ? vegetationFixedScale.toFixed(1) : '—'}</span>
        </div>
      </div>

      {/* Radius */}
      <div className="flex flex-col gap-1 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest">Radius</span>
          <span className="text-[8px] font-mono font-bold text-emerald-400">{vegetationRadius}m</span>
        </div>
        <input type="range" min="2" max="30" step="0.5" value={vegetationRadius}
          onChange={e => setVegetationRadius(parseFloat(e.target.value))}
          className="w-full accent-emerald-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer" />
      </div>

      {/* Density */}
      <div className="flex flex-col gap-1 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
        <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
          <span className="uppercase tracking-wider">Density</span>
          <span className="text-emerald-400 font-mono font-bold">{vegetationDensity} / Spray</span>
        </div>
        <input type="range" min="5" max="100" step="5" value={vegetationDensity}
          onChange={e => setVegetationDensity(parseInt(e.target.value))}
          className="w-full accent-emerald-500 hover:accent-emerald-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer" />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 border-t border-zinc-900/50 pt-3">
        <button onClick={() => setVegetationBrushActive(!vegetationBrushActive)}
          className={`py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 shadow-md cursor-pointer select-none border ${
            vegetationBrushActive ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300'
          }`}>
          <Paintbrush className={`w-3.5 h-3.5 ${vegetationBrushActive ? 'text-white' : 'text-emerald-500'}`} />
          {vegetationBrushActive ? 'Kuas Aktif (Spray ON)' : 'Kuas Vegetasi'}
        </button>
        <button onClick={() => { if (confirm('Wipe all vegetation?')) clearVegetation(); }}
          className="py-2.5 bg-zinc-900 hover:bg-rose-950/20 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/30 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none">
          <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Clear All
        </button>
      </div>

      {/* Tip */}
      <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-900 text-[8px] leading-relaxed text-zinc-500 select-none">
        <strong className="text-zinc-400 text-[7.5px] uppercase tracking-wide block mb-0.5">Vegetation Brush:</strong>
        Aktifkan Kuas, lalu tahan <kbd className="bg-zinc-900 px-1 py-0.2 rounded font-mono text-[8px]">Klik Kiri + Geser</kbd> di tanah. Shift = hapus.
        <span className="block mt-1 text-zinc-600">Klik theme name untuk expand & pilih asset individual.</span>
      </div>
    </div>
  );
};

/** Preload selected single asset */
export function usePreloadSingleAsset(path: string | null) {
  useEffect(() => {
    if (!path) return;
    const full = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    useGLTF.preload(full);
  }, [path]);
}
