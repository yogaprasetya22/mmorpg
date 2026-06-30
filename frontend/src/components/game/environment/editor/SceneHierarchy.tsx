'use client';

import { useState, memo, MouseEvent } from 'react';
import { Mountain, Box, Search, X, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';
import type { MapItem } from '@jagres/shared';

/**
 * SceneHierarchy — Unity-style scene tree panel.
 * Always visible on the left side of the editor.
 * Shows: Terrain root node + all placed objects (grouped by type).
 */

// ─── Individual Layer Row (memoized for performance) ───
const HierarchyRow = memo(({
  item,
  isSelected,
  onClick,
  onDelete,
}: {
  item: MapItem;
  isSelected: boolean;
  onClick: (e: MouseEvent) => void;
  onDelete: () => void;
}) => {
  // Derive a display name from type/path
  const displayName = item.type.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const isProcedural = item.type.includes('procedural');

  return (
    <div
      className={`flex items-center gap-1 pl-4 pr-1 py-[3px] rounded-md border text-[9px] transition-all duration-150 group cursor-pointer ${isSelected
          ? 'bg-blue-600/15 border-blue-500/50 text-white'
          : 'bg-transparent border-transparent hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200'
        }`}
      onClick={onClick}
    >
      <Box className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
      <span className="flex-1 truncate font-semibold tracking-tight leading-tight">{displayName}</span>
      {isProcedural && (
        <span className="text-[6px] font-bold text-emerald-500/60 bg-emerald-500/10 px-1 py-px rounded border border-emerald-500/20 flex-shrink-0">
          PROC
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded hover:bg-rose-950/50 text-zinc-600 hover:text-rose-400 transition-all flex-shrink-0 cursor-pointer"
        title="Delete"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.isSelected === next.isSelected);

HierarchyRow.displayName = 'HierarchyRow';


// ─── Main Hierarchy Panel ───
export const SceneHierarchy = () => {
  const {
    items,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    toggleSelectedId,
    updateItemsWithHistory,
    activeAsset,
    setActiveAsset,
    setCameraFocusTarget,
    setCameraFocusObjectId,
  } = useEditorStore();

  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  // Filter items by search
  const filteredItems = search
    ? items.filter(i => i.type.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase()))
    : items;

  const handleSelectTerrain = () => {
    if (activeAsset) setActiveAsset(null);
    setSelectedId('terrain');
    setCameraFocusTarget([0, 0, 0]);
    setCameraFocusObjectId('terrain');
  };

  const handleSelectItem = (item: MapItem, e: MouseEvent) => {
    if (activeAsset) setActiveAsset(null);
    setCameraFocusTarget(item.pos);
    setCameraFocusObjectId(item.id);
    if (e.shiftKey) {
      toggleSelectedId(item.id);
    } else {
      setSelectedId(item.id);
    }
  };

  const handleDeleteItem = (item: MapItem) => {
    updateItemsWithHistory(prev => prev.filter(i => i.id !== item.id));
    if (selectedIds.includes(item.id)) {
      setSelectedIds(selectedIds.filter(x => x !== item.id));
    }
  };

  const handleDeselectAll = () => {
    setSelectedId(null);
    setSelectedIds([]);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/80 font-sans text-[9px]">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 flex-shrink-0">
        <span className="text-[8.5px] font-black uppercase tracking-widest text-zinc-400">Hierarchy</span>
        <span className="text-[7px] font-bold text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800/50">
          {items.length} objects
        </span>
      </div>

      {/* Search Filter */}
      <div className="px-2 pt-2 pb-1.5 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter objects..."
            className="w-full bg-zinc-900/60 border border-zinc-800/50 rounded-md py-1 pl-6 pr-6 text-[8.5px] text-zinc-300 placeholder:text-zinc-600 focus:border-blue-500/40 outline-none transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Scene Tree (scrollable) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-1.5 pb-2 min-h-0">

        {/* Root: Scene */}
        <div className="flex items-center gap-1 px-1 py-1 text-[8px] text-zinc-500 font-bold uppercase tracking-widest select-none">
          <button onClick={() => setCollapsed(!collapsed)} className="cursor-pointer hover:text-zinc-300 transition-colors">
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <span>🌍 Scene</span>
        </div>

        {!collapsed && (
          <div className="flex flex-col gap-px">
            {/* Terrain Node (always present) */}
            <div
              onClick={handleSelectTerrain}
              className={`flex items-center gap-1.5 pl-4 pr-1 py-[3px] rounded-md border text-[9px] transition-all duration-150 cursor-pointer ${selectedId === 'terrain'
                  ? 'bg-indigo-600/15 border-indigo-500/50 text-white'
                  : 'bg-transparent border-transparent hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <Mountain className={`w-3 h-3 flex-shrink-0 ${selectedId === 'terrain' ? 'text-indigo-400' : 'text-zinc-600'}`} />
              <span className="flex-1 font-bold tracking-tight">Terrain</span>
              <span className="text-[6px] font-bold text-zinc-600 bg-zinc-900 px-1 py-px rounded border border-zinc-800/50">BASE</span>
            </div>

            {/* Placed Objects */}
            {filteredItems.length === 0 && items.length > 0 && (
              <div className="pl-5 py-3 text-zinc-600 text-[8px] italic text-center">No matching objects</div>
            )}

            {filteredItems.length === 0 && items.length === 0 && (
              <div className="pl-5 py-3 text-zinc-600 text-[8px] italic text-center">Empty scene — place assets from the Inspector →</div>
            )}

            {/* Object rows (reversed: newest on top) */}
            {[...filteredItems].reverse().map(item => (
              <HierarchyRow
                key={item.id}
                item={item}
                isSelected={selectedIds.includes(item.id)}
                onClick={(e) => handleSelectItem(item, e)}
                onDelete={() => handleDeleteItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom: Deselect button */}
      {selectedId && (
        <div className="px-2 py-1.5 border-t border-zinc-800/40 flex-shrink-0">
          <button
            onClick={handleDeselectAll}
            className="w-full py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-800/50 rounded-md text-[7.5px] font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            <EyeOff className="w-2.5 h-2.5 inline mr-1" />
            Deselect
          </button>
        </div>
      )}
    </div>
  );
};
