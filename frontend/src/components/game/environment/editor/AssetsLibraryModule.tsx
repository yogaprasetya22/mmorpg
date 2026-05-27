'use client';

import React, { useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useInView } from 'react-intersection-observer';
import { Search, Package } from 'lucide-react';
import { useEditorStore, ASSET_LIBRARY } from '@/src/state/useEditorStore';
import { FULL_MATERIAL_LIBRARY } from '@/src/core/logic/environment/assetRegistry';

// ─── GPU-FREE VECTOR THUMBNAIL COMPONENT ───
const AssetCard = React.memo(({ asset, isActive, onClick }: { asset: any, isActive: boolean, onClick: () => void }) => {
  const { ref, inView } = useInView({
    triggerOnce: false,
    rootMargin: '30px 0px',
    threshold: 0.01,
  });

  const nameLower = (asset.name || '').toLowerCase();
  
  const getThumbnailContent = () => {
    if (asset.diffuse) {
      return (
        <img 
          src={asset.diffuse} 
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
          alt={asset.name}
        />
      );
    }
    
    // Foliage
    if (asset.category === 'tree' || nameLower.includes('tree') || nameLower.includes('foliage') || nameLower.includes('pine') || nameLower.includes('log') || nameLower.includes('wood')) {
      return <span className="text-base filter drop-shadow-[0_2px_4px_rgba(16,185,129,0.3)]">🌲</span>;
    }

    // Loot / Gold
    if (nameLower.includes('coin') || nameLower.includes('jewel') || nameLower.includes('key') || nameLower.includes('gold') || nameLower.includes('star') || nameLower.includes('chest') || nameLower.includes('loot')) {
      return <span className="text-base filter drop-shadow-[0_2px_4px_rgba(234,179,8,0.3)]">{nameLower.includes('chest') ? '📦' : '💎'}</span>;
    }

    // Architecture
    if (asset.category === 'kingdom' || nameLower.includes('wall') || nameLower.includes('gate') || nameLower.includes('bridge') || nameLower.includes('stairs') || nameLower.includes('tower') || nameLower.includes('door')) {
      return <span className="text-base filter drop-shadow-[0_2px_4px_rgba(99,102,241,0.3)]">🏰</span>;
    }

    // Combat traps
    if (nameLower.includes('spike') || nameLower.includes('saw') || nameLower.includes('bomb') || nameLower.includes('trap') || nameLower.includes('siege') || nameLower.includes('barrel') || nameLower.includes('crate')) {
      return <span className="text-base filter drop-shadow-[0_2px_4px_rgba(244,63,94,0.35)]">{nameLower.includes('bomb') ? '💣' : '⚔️'}</span>;
    }

    return <span className="text-base">📦</span>;
  };

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => {
        if (asset.path) {
          useGLTF.preload(asset.path);
        }
      }}
      className={`group relative flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition-all duration-300 border ${
        isActive 
          ? 'bg-indigo-650/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.55)] scale-[0.96] ring-2 ring-indigo-550/20 text-white font-extrabold' 
          : 'bg-zinc-900/40 border-zinc-850 hover:bg-zinc-800/40 hover:border-zinc-700/60'
      }`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 54px' }}
    >
      {inView ? (
        <>
          <div className="aspect-square w-full bg-zinc-950 rounded flex items-center justify-center relative shadow-inner">
            {getThumbnailContent()}
            <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
          <span className={`text-[8px] font-mono tracking-tighter truncate w-full px-0.5 text-center ${isActive ? 'text-white font-extrabold' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
            {asset.name}
          </span>
        </>
      ) : (
        <div className="aspect-square w-full bg-zinc-950/40 rounded" />
      )}
    </button>
  );
}, (prev, next) => (prev.asset.path || prev.asset.id) === (next.asset.path || next.asset.id) && prev.isActive === next.isActive);

AssetCard.displayName = 'AssetCard';

export const AssetsLibraryModule = () => {
  const {
    activeAsset,
    setActiveAsset,
    terrainMaterialId,
    setTerrainMaterialId,
    dynamicAssets
  } = useEditorStore();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredAssets = selectedCategory === 'materials' 
    ? FULL_MATERIAL_LIBRARY 
    : (dynamicAssets.length > 0 ? dynamicAssets : ASSET_LIBRARY).filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || a.category === selectedCategory;
        return matchesSearch && matchesCategory;
      });

  return (
    <div className="flex flex-col gap-3 font-mono text-[9px]">
      
      {/* Category selector */}
      <div className="grid grid-cols-3 gap-1 p-0.5 bg-zinc-950 border border-zinc-850 rounded">
        {['all', 'kingdom', 'env', 'tree', 'materials'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`py-1 px-1 rounded text-[7.5px] font-black tracking-tighter uppercase transition-all ${
              selectedCategory === cat 
                ? 'bg-blue-600 text-white shadow' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Keyword search filter */}
      <div className="relative group w-full">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-650 group-focus-within:text-blue-500 transition-colors" />
        <input 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter blueprint assets..."
          className="w-full bg-zinc-950 border border-zinc-850 rounded-lg py-1.5 pl-8 pr-3 text-[9px] text-white placeholder:text-zinc-600 focus:border-blue-500/50 outline-none transition-colors"
        />
      </div>

      {/* Asset grid selector */}
      <div className="max-h-64 overflow-y-auto pr-1 custom-scrollbar">
        <div className="grid grid-cols-4 gap-1">
          {filteredAssets.map((asset: any) => (
            <AssetCard 
              key={asset.path || asset.id} 
              asset={asset} 
              isActive={activeAsset?.path === asset.path || terrainMaterialId === asset.id} 
              onClick={() => {
                if (selectedCategory === 'materials') {
                  setTerrainMaterialId(asset.id);
                } else {
                  setActiveAsset(asset);
                }
              }}
            />
          ))}
          {filteredAssets.length === 0 && (
            <p className="col-span-4 text-center py-4 text-zinc-600 italic">No matching blueprints found...</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[8px] text-zinc-500 border-t border-zinc-850 pt-2 px-0.5">
        <span className="flex items-center gap-1">
          <Package className="w-3 h-3 text-blue-500" />
          Lib count:
        </span>
        <span className="text-white font-bold">{filteredAssets.length} nodes</span>
      </div>

    </div>
  );
};
