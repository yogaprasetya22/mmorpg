'use client';

import React, { useState, Suspense, useMemo, useRef } from 'react';
import { useGLTF, Center, View } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useInView } from 'react-intersection-observer';
import { Search, Package } from 'lucide-react';
import * as THREE from 'three';
import { useEditorStore, ASSET_LIBRARY } from '@/src/state/useEditorStore';
import { FULL_MATERIAL_LIBRARY } from '@/src/core/logic/environment/assetRegistry';

// ─── 3D GLB MODEL VIEWER COMPONENT ───
const ModelViewer = ({ path }: { path: string }) => {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  
  const box = useMemo(() => {
    return new THREE.Box3().setFromObject(cloned);
  }, [cloned]);

  const scale = useMemo(() => {
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    return maxDim > 0 ? 1.6 / maxDim : 1;
  }, [box]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={cloned} scale={[scale, scale, scale]} />
      </Center>
    </group>
  );
};

// ─── ASSET CARD COMPONENT ───
const AssetCard = React.memo(({ asset, isActive, onClick }: { asset: any, isActive: boolean, onClick: () => void }) => {
  const { ref, inView } = useInView({
    triggerOnce: false,
    rootMargin: '30px 0px',
    threshold: 0.01,
  });

  const nameLower = (asset.name || '').toLowerCase();
  
  const getThumbnailContent = () => {
    // Material textures use image previews
    if (asset.diffuse) {
      return (
        <img 
          src={asset.diffuse} 
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
          alt={asset.name}
        />
      );
    }
    
    // Foliage (Trees)
    if (asset.category === 'trees' || asset.category === 'tree' || nameLower.includes('tree') || nameLower.includes('pine')) {
      return <span className="text-base filter drop-shadow-[0_2px_4px_rgba(16,185,129,0.3)]">🌲</span>;
    }

    // Vegetation
    if (asset.category === 'vegetation' || nameLower.includes('foliage') || nameLower.includes('flower') || nameLower.includes('bush') || nameLower.includes('clover') || nameLower.includes('grass') || nameLower.includes('fern') || nameLower.includes('mushroom') || nameLower.includes('plant')) {
      return <span className="text-base filter drop-shadow-[0_2px_4px_rgba(34,197,94,0.3)]">🌿</span>;
    }

    // Rocks
    if (asset.category === 'rocks' || nameLower.includes('rock') || nameLower.includes('pebble')) {
      return <span className="text-base filter drop-shadow-[0_2px_4px_rgba(156,163,175,0.3)]">🪨</span>;
    }

    // Loot / Gold
    if (nameLower.includes('coin') || nameLower.includes('jewel') || nameLower.includes('key') || nameLower.includes('gold') || nameLower.includes('star') || nameLower.includes('chest') || nameLower.includes('loot')) {
      return <span className="text-base filter drop-shadow-[0_2px_4px_rgba(234,179,8,0.3)]">{nameLower.includes('chest') ? '📦' : '💎'}</span>;
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
          <div className="aspect-square w-full bg-zinc-950 rounded flex items-center justify-center relative shadow-inner overflow-hidden">
            {inView && asset.path ? (
              <Suspense fallback={getThumbnailContent()}>
                <View className="w-full h-full">
                  <ambientLight intensity={1.5} />
                  <directionalLight position={[3, 3, 3]} intensity={2.0} />
                  <ModelViewer path={asset.path} />
                </View>
              </Suspense>
            ) : (
              getThumbnailContent()
            )}
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
  const containerRef = useRef<HTMLDivElement>(null);
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
    <div ref={containerRef} className="relative flex flex-col gap-3 font-mono text-[9px] h-full">
      
      {/* Category selector */}
      <div className="grid grid-cols-3 gap-1 p-0.5 bg-zinc-950 border border-zinc-850 rounded">
        {['all', 'trees', 'vegetation', 'rocks', 'characters', 'materials'].map((cat) => (
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

      {/* Local Canvas for rendering views */}
      <Canvas 
        eventSource={containerRef as any}
        className="pointer-events-none absolute inset-0 z-10"
        gl={{ antialias: true }}
      >
        <View.Port />
      </Canvas>

    </div>
  );
};
