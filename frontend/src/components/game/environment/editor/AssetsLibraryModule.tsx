'use client';

import React, { useState, Suspense, useMemo, useRef } from 'react';
import { useGLTF, Center, OrbitControls, Environment } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useInView } from 'react-intersection-observer';
import { Search, Package, Eye, RotateCw } from 'lucide-react';
import * as THREE from 'three';
import { useEditorStore, ASSET_LIBRARY } from '@/src/state/useEditorStore';
import { FULL_MATERIAL_LIBRARY } from '@jagres/shared';

// ─── SINGLE 3D PREVIEW MODEL (rotates smoothly, one GLB at a time) ───
const PreviewModel = ({ path }: { path: string }) => {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(), [scene]);
  const groupRef = useRef<THREE.Group>(null);

  // Auto-scale to fit the preview viewport uniformly
  const scale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    return maxDim > 0 ? 1.8 / maxDim : 1;
  }, [cloned]);

  // Auto-center offset so model sits at origin
  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    return -(box.min.y + size.y / 2) * scale;
  }, [cloned, scale]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.6;
    }
  });

  return (
    <group ref={groupRef} position={[0, yOffset, 0]}>
      <primitive object={cloned} scale={[scale, scale, scale]} />
    </group>
  );
};

// ─── CATEGORY → ICON/GRADIENT MAPPING (consistent visual identity per type) ───
const CATEGORY_VISUAL: Record<string, { emoji: string; gradient: string; ring: string }> = {
  trees: { emoji: '🌲', gradient: 'from-emerald-950/60 to-emerald-900/20', ring: 'ring-emerald-500/20' },
  tree: { emoji: '🌲', gradient: 'from-emerald-950/60 to-emerald-900/20', ring: 'ring-emerald-500/20' },
  vegetation: { emoji: '🌿', gradient: 'from-green-950/60 to-green-900/20', ring: 'ring-green-500/20' },
  rocks: { emoji: '🪨', gradient: 'from-stone-950/60 to-stone-900/20', ring: 'ring-stone-500/20' },
  characters: { emoji: '🧑', gradient: 'from-sky-950/60 to-sky-900/20', ring: 'ring-sky-500/20' },
};

const DEFAULT_VISUAL = { emoji: '📦', gradient: 'from-zinc-950/60 to-zinc-900/20', ring: 'ring-zinc-500/20' };

// ─── RESOLVE VISUAL for any asset by category + name keyword matching ───
function resolveVisual(asset: any) {
  const cat = (asset.category || '').toLowerCase();
  if (CATEGORY_VISUAL[cat]) return CATEGORY_VISUAL[cat];

  const name = (asset.name || '').toLowerCase();
  if (name.includes('tree') || name.includes('pine') || name.includes('birch') || name.includes('maple') || name.includes('dead')) return CATEGORY_VISUAL.trees;
  if (name.includes('rock') || name.includes('pebble') || name.includes('boulder')) return CATEGORY_VISUAL.rocks;
  if (name.includes('bush') || name.includes('flower') || name.includes('grass') || name.includes('fern') || name.includes('mushroom') || name.includes('clover') || name.includes('plant') || name.includes('petal') || name.includes('foliage')) return CATEGORY_VISUAL.vegetation;
  if (name.includes('chest') || name.includes('coin') || name.includes('gold') || name.includes('loot')) return { emoji: '💎', gradient: 'from-yellow-950/60 to-yellow-900/20', ring: 'ring-yellow-500/20' };
  if (name.includes('soldier') || name.includes('npc') || name.includes('chef') || name.includes('casual') || name.includes('cow')) return CATEGORY_VISUAL.characters;
  if (name.includes('spike') || name.includes('trap') || name.includes('bomb') || name.includes('barrel') || name.includes('crate') || name.includes('siege')) return { emoji: '⚔️', gradient: 'from-rose-950/60 to-rose-900/20', ring: 'ring-rose-500/20' };

  return DEFAULT_VISUAL;
}

// ─── LIGHTWEIGHT ASSET CARD (zero WebGL, pure DOM + CSS) ───
const AssetCard = React.memo(({ asset, isActive, onClick, onHover }: {
  asset: any;
  isActive: boolean;
  onClick: () => void;
  onHover: () => void;
}) => {
  const { ref, inView } = useInView({
    triggerOnce: false,
    rootMargin: '50px 0px',
    threshold: 0,
  });

  const visual = resolveVisual(asset);

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={onHover}
      className={`group relative flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all duration-200 border ${isActive
          ? 'bg-indigo-600/15 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.4)] scale-[0.96] ring-2 ring-indigo-500/20'
          : 'bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-800/50 hover:border-zinc-700/60 hover:scale-[0.98]'
        }`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 68px' }}
    >
      {inView ? (
        <>
          {/* Thumbnail: gradient bg + emoji icon (zero WebGL cost) */}
          <div className={`aspect-square w-full rounded-lg bg-gradient-to-br ${visual.gradient} flex items-center justify-center ring-1 ${visual.ring} relative overflow-hidden`}>
            <span className="text-xl filter drop-shadow-md select-none">{visual.emoji}</span>
            {/* Hover glow overlay */}
            <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/8 transition-colors pointer-events-none" />
            {/* Active indicator dot */}
            {isActive && (
              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
            )}
          </div>
          {/* Asset name label */}
          <span className={`text-[7.5px] font-mono tracking-tighter truncate w-full px-0.5 text-center leading-tight ${isActive ? 'text-indigo-300 font-bold' : 'text-zinc-500 group-hover:text-zinc-300'
            }`}>
            {asset.name}
          </span>
        </>
      ) : (
        /* Placeholder for off-screen cards (content-visibility optimization) */
        <div className="aspect-square w-full bg-zinc-950/30 rounded-lg" />
      )}
    </button>
  );
}, (prev, next) =>
  (prev.asset.path || prev.asset.id) === (next.asset.path || next.asset.id) &&
  prev.isActive === next.isActive
);

AssetCard.displayName = 'AssetCard';

// ─── 3D PREVIEW VIEWPORT (single Canvas, single GLB loaded) ───
const PreviewViewport = ({ asset }: { asset: any | null }) => {
  if (!asset?.path) {
    return (
      <div className="w-full h-32 rounded-xl bg-zinc-950/60 border border-zinc-800/40 flex flex-col items-center justify-center gap-2">
        <Eye className="w-4 h-4 text-zinc-700" />
        <span className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest">Select a blueprint to preview</span>
      </div>
    );
  }

  return (
    <div className="w-full h-36 rounded-xl bg-zinc-950 border border-zinc-800/40 overflow-hidden relative shadow-inner">
      {/* Asset name badge */}
      <div className="absolute top-2 left-2 z-10 bg-zinc-950/80 backdrop-blur-sm border border-zinc-800/50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[8px] font-mono font-bold text-zinc-300 tracking-tight">{asset.name}</span>
      </div>
      {/* Rotation hint */}
      <div className="absolute top-2 right-2 z-10 text-zinc-600 flex items-center gap-1">
        <RotateCw className="w-3 h-3" />
        <span className="text-[7px] font-mono uppercase">Drag to orbit</span>
      </div>
      {/* Single WebGL Canvas — one GLB loaded at a time */}
      <Canvas
        camera={{ position: [2.5, 1.8, 2.5], fov: 35, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[4, 5, 3]} intensity={2.5} />
        <directionalLight position={[-2, 3, -4]} intensity={1.0} color="#93c5fd" />
        <Suspense fallback={null}>
          <Center>
            <PreviewModel path={asset.path} />
          </Center>
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1.5}
          maxDistance={8}
          autoRotate={false}
          target={[0, 0, 0]}
        />
        <Environment preset="sunset" environmentIntensity={0.2} />
        {/* Ground shadow disc */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
          <circleGeometry args={[2, 32]} />
          <meshStandardMaterial color="#1a1a2e" roughness={1} transparent opacity={0.3} />
        </mesh>
      </Canvas>
    </div>
  );
};

// ─── MAIN MODULE EXPORT ───
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
  const [previewAsset, setPreviewAsset] = useState<any>(activeAsset);

  // Sync preview with active asset changes
  React.useEffect(() => {
    if (activeAsset) setPreviewAsset(activeAsset);
  }, [activeAsset]);

  const filteredAssets = selectedCategory === 'materials'
    ? FULL_MATERIAL_LIBRARY
    : (dynamicAssets.length > 0 ? dynamicAssets : ASSET_LIBRARY).filter((a: any) => {
      const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || a.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

  // Determine current preview target (selected or hovered asset)
  const currentPreview = previewAsset || activeAsset;

  return (
    <div className="relative flex flex-col gap-2.5 font-mono text-[9px] h-full">

      {/* ─── 3D PREVIEW VIEWPORT (single Canvas, shows selected/hovered GLB) ─── */}
      {selectedCategory !== 'materials' && (
        <PreviewViewport asset={currentPreview} />
      )}

      {/* Material preview (image-based for textures) */}
      {selectedCategory === 'materials' && currentPreview?.diffuse && (
        <div className="w-full h-28 rounded-xl bg-zinc-950 border border-zinc-800/40 overflow-hidden relative">
          <img
            src={currentPreview.diffuse}
            alt={currentPreview.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-zinc-950/80 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] text-zinc-300 font-bold">
            {currentPreview.name}
          </div>
        </div>
      )}

      {/* ─── CATEGORY TABS ─── */}
      <div className="grid grid-cols-4 gap-0.5 p-0.5 bg-zinc-950 border border-zinc-800/60 rounded-lg">
        {['all', 'trees', 'vegetation', 'rocks', 'characters', 'materials'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`py-1.5 px-1 rounded-md text-[7px] font-black tracking-tighter uppercase transition-all ${selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ─── SEARCH FILTER ─── */}
      <div className="relative group w-full">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter blueprints..."
          className="w-full bg-zinc-950 border border-zinc-800/60 rounded-lg py-1.5 pl-7 pr-3 text-[9px] text-white placeholder:text-zinc-600 focus:border-indigo-500/50 outline-none transition-colors"
        />
      </div>

      {/* ─── ASSET GRID (lightweight DOM, zero WebGL per card) ─── */}
      <div className="max-h-52 overflow-y-auto pr-0.5 custom-scrollbar">
        <div className="grid grid-cols-4 gap-1">
          {filteredAssets.map((asset: any) => (
            <AssetCard
              key={asset.path || asset.id}
              asset={asset}
              isActive={activeAsset?.path === asset.path || terrainMaterialId === asset.id}
              onClick={() => {
                if (selectedCategory === 'materials') {
                  setTerrainMaterialId(asset.id);
                  setPreviewAsset(asset);
                } else {
                  setActiveAsset(asset);
                  setPreviewAsset(asset);
                }
              }}
              onHover={() => {
                // Preload GLB on hover for instant preview
                if (asset.path) {
                  useGLTF.preload(asset.path);
                }
                setPreviewAsset(asset);
              }}
            />
          ))}
          {filteredAssets.length === 0 && (
            <p className="col-span-4 text-center py-4 text-zinc-600 italic text-[8px]">No matching blueprints found...</p>
          )}
        </div>
      </div>

      {/* ─── FOOTER COUNTER ─── */}
      <div className="flex items-center justify-between text-[8px] text-zinc-500 border-t border-zinc-800/40 pt-2 px-0.5">
        <span className="flex items-center gap-1">
          <Package className="w-3 h-3 text-indigo-400" />
          Library:
        </span>
        <span className="text-white font-bold">{filteredAssets.length} blueprints</span>
      </div>

    </div>
  );
};
