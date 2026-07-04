'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Trash2,
  Paintbrush,
  Search,
  SlidersHorizontal,
  Compass,
  Check,
  Mountain,
  Layers,
} from 'lucide-react';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';
import type { VegetationBrushMode, AssetBlueprint } from '@/src/features/world-editor/types/editor.types';
import { AssetPreviewCanvas } from './AssetPreviewCanvas';
import { BlueprintGridVirtualized } from './BlueprintGridVirtualized';
import { useGLTF } from '@react-three/drei';
import { API_BASE_URL } from '@/src/core/config';

// ─── THEME ASSETS (Retained for backwards-compatibility / references) ───
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

export const VegetationModule = () => {
  const store = useEditorStore();
  const {
    clearVegetation,
    vegetationBrushActive,
    setVegetationBrushActive,
    vegetationRadius,
    setVegetationRadius,
    vegetationDensity,
    setVegetationDensity,
    vegetationFixedScale,
    setVegetationFixedScale,

    // Prototype states
    vegetationPrototypes,
    selectedPrototypeIds,
    vegetationBrushMode,
    vegetationBrushWeights,
    vegetationAlignToNormal,
    vegetationSlopeFilterEnabled,
    vegetationSlopeRange,
    vegetationHeightFilterEnabled,
    vegetationHeightRange,

    // Setters
    setVegetationBrushMode,
    togglePrototypeSelection,
    setPrototypeWeight,
    setVegetationAlignToNormal,
    setVegetationSlopeFilter,
    setVegetationHeightFilter,

    // Asset Library states
    assetLibrary,
    setSelectedBlueprintId,
    setAssetFilterText,
    setAssetCategory,
  } = store;

  // Search input debouncer
  const [searchVal, setSearchVal] = useState(assetLibrary.filterText);

  useEffect(() => {
    const handle = setTimeout(() => {
      setAssetFilterText(searchVal);
    }, 200);
    return () => clearTimeout(handle);
  }, [searchVal, setAssetFilterText]);

  // Filter blueprints using selectors
  const filteredBlueprints = useMemo(() => {
    return assetLibrary.blueprints.filter((bp) => {
      // Keep only environment assets for VEG panel!
      const isEnv = bp.category === 'trees' || bp.category === 'vegetation' || bp.category === 'rocks';
      if (!isEnv) return false;

      const matchesSearch = bp.name.toLowerCase().includes(assetLibrary.filterText.toLowerCase());
      const matchesCat = assetLibrary.activeCategory === 'all' || bp.category === assetLibrary.activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [assetLibrary.blueprints, assetLibrary.filterText, assetLibrary.activeCategory]);

  const [hoveredBlueprint, setHoveredBlueprint] = useState<AssetBlueprint | null>(null);

  const selectedBlueprint = useMemo(() => {
    return assetLibrary.blueprints.find((bp) => bp.id === assetLibrary.selectedBlueprintId) || null;
  }, [assetLibrary.blueprints, assetLibrary.selectedBlueprintId]);

  // Determine active preview URL (hovered takes priority)
  const previewModelUrl = hoveredBlueprint?.modelUrl || selectedBlueprint?.modelUrl;

  const handleSelectBlueprint = (id: string, isMulti: boolean) => {
    setSelectedBlueprintId(id);
    if (isMulti) {
      const current = useEditorStore.getState().selectedPrototypeIds;
      const next = current.includes(id)
        ? current.filter(x => x !== id)
        : [...current, id];
      useEditorStore.setState({ selectedPrototypeIds: next });
    } else {
      useEditorStore.setState({ selectedPrototypeIds: [id] });
    }
  };

  const handleWeightChange = (id: string, value: string) => {
    const parsed = parseInt(value, 10);
    setPrototypeWeight(id, isNaN(parsed) ? 1 : parsed);
  };

  return (
    <div className="flex flex-col gap-3.5 font-sans text-[10px] text-zinc-300 max-h-[80vh] overflow-y-auto custom-scrollbar hover:overflow-y-auto">
      
      {/* ─── 3D MODEL PREVIEW ─── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Asset 3D Preview</span>
        <AssetPreviewCanvas modelUrl={previewModelUrl} />
      </div>

      {/* ─── BRUSH MODE TABS ─── */}
      <div className="flex flex-col gap-1">
        <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Brush Mode</span>
        <div className="grid grid-cols-5 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-900 text-[8px] font-bold">
          {(['Paint', 'Erase', 'Select', 'Single', 'Reapply'] as VegetationBrushMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setVegetationBrushMode(mode)}
              className={`py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                vegetationBrushMode === mode
                  ? 'bg-zinc-900 text-white font-extrabold shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40 border border-transparent'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* ─── VIRTUALIZED ASSET PICKER GRID ─── */}
      <div className="flex flex-col gap-2 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
        <span className="text-zinc-400 font-bold uppercase text-[8px] tracking-wider">Asset Catalog</span>

        {/* Search & Category Filter */}
        <div className="flex flex-col gap-1.5 mt-0.5">
          <div className="relative">
            <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg pl-7 pr-3 py-1.5 text-[8.5px] font-bold text-zinc-200 outline-none focus:border-zinc-700"
            />
          </div>

          <div className="flex gap-1 text-[7.5px] uppercase font-black">
            {(['all', 'trees', 'vegetation', 'rocks'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setAssetCategory(cat)}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  assetLibrary.activeCategory === cat ? 'bg-zinc-850 text-white border border-zinc-800' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Virtualized Grid */}
        <BlueprintGridVirtualized
          blueprints={filteredBlueprints}
          selectedBlueprintId={assetLibrary.selectedBlueprintId}
          selectedBlueprintIds={selectedPrototypeIds}
          onSelect={handleSelectBlueprint}
          onHover={(bp) => {
            setHoveredBlueprint(bp);
            if (bp?.modelUrl) {
              const resolved = bp.modelUrl.startsWith('http') ? bp.modelUrl : `${API_BASE_URL}${bp.modelUrl}`;
              useGLTF.preload(resolved);
            }
          }}
        />
      </div>

      {/* ─── ACTIVE BRUSH MEMBERS (PALETTE) ─── */}
      {selectedPrototypeIds.length > 0 && (
        <div className="flex flex-col gap-2 bg-zinc-950/20 p-2.5 rounded-xl border border-zinc-900/60">
          <span className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-widest pl-0.5">Active Paint Palette (Scatter Weights)</span>
          <div className="flex flex-col gap-1">
            {selectedPrototypeIds.map((protoId) => {
              const proto = vegetationPrototypes.find(p => p.id === protoId);
              if (!proto) return null;
              const weight = vegetationBrushWeights[protoId] ?? 1;
              return (
                <div key={protoId} className="flex justify-between items-center bg-zinc-950/40 p-1.5 rounded-lg border border-zinc-900 text-[8px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => togglePrototypeSelection(protoId)} className="w-4 h-4 bg-emerald-500/10 hover:bg-rose-500/10 text-emerald-400 hover:text-rose-400 border border-emerald-500/25 hover:border-rose-500/25 rounded flex items-center justify-center cursor-pointer select-none">
                      <Check className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-zinc-300 truncate max-w-28 uppercase">{proto.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 uppercase">Ratio:</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={weight}
                      onChange={e => handleWeightChange(protoId, e.target.value)}
                      className="w-8 bg-zinc-950 border border-zinc-850 text-center rounded text-[7.5px] text-zinc-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── BRUSH OPTIONS & FILTER PANEL ─── */}
      <div className="flex flex-col gap-3 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
        <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5 flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3" /> Brush Parameters
        </span>

        {/* Radius Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
            <span className="uppercase tracking-wider">Radius</span>
            <span className="text-emerald-400 font-mono font-bold">{vegetationRadius}m</span>
          </div>
          <input
            type="range" min="2" max="30" step="0.5"
            value={vegetationRadius}
            onChange={e => setVegetationRadius(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Density Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
            <span className="uppercase tracking-wider">Density</span>
            <span className="text-emerald-400 font-mono font-bold">{vegetationDensity} / Spray</span>
          </div>
          <input
            type="range" min="5" max="100" step="5"
            value={vegetationDensity}
            onChange={e => setVegetationDensity(parseInt(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Scale Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
            <span className="uppercase tracking-wider">Asset Scale (Ukuran)</span>
            <span className="text-emerald-400 font-mono font-bold">{vegetationFixedScale === 0 ? 'Random/Default' : `${vegetationFixedScale.toFixed(2)}x`}</span>
          </div>
          <input
            type="range" min="0" max="4" step="0.05"
            value={vegetationFixedScale}
            onChange={e => setVegetationFixedScale(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Align to Normal */}
        <label className="flex items-center gap-2 text-[8px] font-bold text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={vegetationAlignToNormal}
            onChange={e => setVegetationAlignToNormal(e.target.checked)}
            className="w-3 h-3 accent-emerald-500 rounded border-zinc-800"
          />
          <Compass className="w-3 h-3 text-zinc-500" />
          <span>Align Vegetation to Surface normal slope</span>
        </label>

        {/* Slope filter slider */}
        <div className="flex flex-col gap-1.5 border-t border-zinc-900 pt-2 flex-col">
          <label className="flex items-center gap-2 text-[8px] font-bold text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={vegetationSlopeFilterEnabled}
              onChange={e => setVegetationSlopeFilter(e.target.checked, vegetationSlopeRange)}
              className="w-3 h-3 accent-emerald-500"
            />
            <Mountain className="w-3 h-3 text-zinc-500" />
            <span>Enable Terrain Slope filter</span>
          </label>

          {vegetationSlopeFilterEnabled && (
            <div className="flex items-center gap-2 animate-in slide-in-from-top-1 duration-150 pl-5">
              <span className="text-[7.5px] text-zinc-500 uppercase font-black">Limit:</span>
              <input
                type="range" min="0" max="90" step="1"
                value={vegetationSlopeRange[1]}
                onChange={e => setVegetationSlopeFilter(true, [0, parseInt(e.target.value)])}
                className="flex-1 accent-indigo-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
              />
              <span className="text-[8px] font-mono text-zinc-400 w-10 text-right">0° - {vegetationSlopeRange[1]}°</span>
            </div>
          )}
        </div>

        {/* Elevation height filter slider */}
        <div className="flex flex-col gap-1.5 border-t border-zinc-900 pt-2">
          <label className="flex items-center gap-2 text-[8px] font-bold text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={vegetationHeightFilterEnabled}
              onChange={e => setVegetationHeightFilter(e.target.checked, vegetationHeightRange)}
              className="w-3 h-3 accent-emerald-500"
            />
            <Layers className="w-3 h-3 text-zinc-500" />
            <span>Enable Height Elevation filter</span>
          </label>

          {vegetationHeightFilterEnabled && (
            <div className="flex gap-2 items-center pl-5 animate-in slide-in-from-top-1 duration-150">
              <span className="text-[7.5px] text-zinc-500 uppercase font-black">Range:</span>
              <input
                type="number"
                placeholder="Min..."
                value={vegetationHeightRange[0]}
                onChange={e => setVegetationHeightFilter(true, [parseFloat(e.target.value) || 0, vegetationHeightRange[1]])}
                className="w-12 bg-zinc-900 border border-zinc-850 rounded px-1.5 py-0.5 text-[8px] font-bold text-zinc-300"
              />
              <span className="text-zinc-650">—</span>
              <input
                type="number"
                placeholder="Max..."
                value={vegetationHeightRange[1]}
                onChange={e => setVegetationHeightFilter(true, [vegetationHeightRange[0], parseFloat(e.target.value) || 0])}
                className="w-12 bg-zinc-900 border border-zinc-850 rounded px-1.5 py-0.5 text-[8px] font-bold text-zinc-300"
              />
              <span className="text-[8px] font-mono text-zinc-500">meters</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── ACTION BUTTONS ─── */}
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
          onClick={() => { if (confirm('Wipe all vegetation?')) clearVegetation(); }}
          className="py-2.5 bg-zinc-900 hover:bg-rose-950/20 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/30 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Clear All
        </button>
      </div>

      {/* Instructions */}
      <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-900 text-[8px] leading-relaxed text-zinc-500 select-none">
        <strong className="text-zinc-400 text-[7.5px] uppercase tracking-wide block mb-0.5">Vegetation Brush Instructions:</strong>
        Aktifkan Kuas, lalu tahan <kbd className="bg-zinc-900 px-1 py-0.2 rounded font-mono text-[8px]">Klik Kiri + Geser</kbd> di tanah. 
        Tahan <kbd className="bg-zinc-900 px-1 py-0.2 rounded font-mono text-[8px]">Shift</kbd> sambil menggeser untuk menghapus.
      </div>
    </div>
  );
};
