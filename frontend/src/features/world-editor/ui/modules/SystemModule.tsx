'use client';

import { memo, MouseEvent } from 'react';
import { Undo2, Redo2, Copy, Box, Mountain, X, Camera } from 'lucide-react';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';
import type { MapItem } from '@jagres/shared';

const LayerRow = memo(({
  item,
  isSelected,
  onClick,
  onDelete
}: {
  item: MapItem;
  isSelected: boolean;
  onClick: (e: MouseEvent) => void;
  onDelete: () => void;
}) => {
  return (
    <div className={`flex items-center justify-between pl-2 pr-1 py-0.5 rounded-lg border text-[9.5px] transition-all font-mono duration-200 ${isSelected
        ? 'bg-blue-950/60 border-blue-500/80 text-white shadow-sm'
        : 'bg-zinc-950/40 border-zinc-900 hover:bg-zinc-800/40 text-zinc-400'
      }`}>
      <button
        onClick={onClick}
        className="flex-1 text-left flex items-center gap-1.5 truncate py-0.5 cursor-pointer outline-none group"
      >
        <Box className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isSelected ? 'text-indigo-400' : 'text-zinc-550 group-hover:text-zinc-300'}`} />
        <span className="truncate tracking-tighter uppercase font-bold text-[8.5px]">{item.type.replace(/[-_]/g, ' ')}</span>
        {/* Technical ID is hidden! */}
        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pl-1">
          <Camera className="w-2.5 h-2.5 text-indigo-400" />
        </span>
      </button>
      <button
        onClick={onDelete}
        title="Remove Instance"
        className="w-4 h-4 flex items-center justify-center rounded-md hover:bg-rose-950/50 text-zinc-650 hover:text-rose-400 transition-colors cursor-pointer select-none"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.isSelected === next.isSelected && prev.item.type === next.item.type);

LayerRow.displayName = 'LayerRow';

export const SystemModule = () => {
  const {
    items,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    toggleSelectedId,
    undo,
    redo,
    historyIndex,
    history,
    updateItemsWithHistory,
    activeAsset,
    setActiveAsset,
    setCameraFocusTarget
  } = useEditorStore();

  const copyMapCode = () => {
    const code = `export const STATIC_WORLD_MAP: MapItem[] = ${JSON.stringify(items, null, 2)};`;
    navigator.clipboard.writeText(code);
    alert("Map configuration copied to clipboard!");
  };

  const exportMap = () => {
    const data = JSON.stringify(items, null, 2);
    navigator.clipboard.writeText(data);
    alert("JSON structure copied!");
  };

  const handleClearMap = () => {
    if (confirm("Wipe scene completely? This resets the entire workspace.")) {
      updateItemsWithHistory([]);
    }
  };

  return (
    <div className="flex flex-col gap-3 font-mono text-[9px]">

      {/* Undo/Redo Controls */}
      <div className="flex flex-col gap-1">
        <span className="text-zinc-555 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Undo / Redo History</span>
        <div className="grid grid-cols-2 gap-1.5 text-[9px]">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="flex items-center justify-center gap-1.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-25 text-zinc-350 rounded-xl transition-all font-bold uppercase tracking-wider cursor-pointer"
          >
            <Undo2 className="w-3 h-3" />
            Undo ({historyIndex})
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="flex items-center justify-center gap-1.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-25 text-zinc-350 rounded-xl transition-all font-bold uppercase tracking-wider cursor-pointer"
          >
            <Redo2 className="w-3 h-3" />
            Redo ({history.length - 1 - historyIndex})
          </button>
        </div>
      </div>

      {/* Hierarchy Scene Tree */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-850 pt-2.5">
        <span className="text-zinc-555 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Active placed layers ({items.length})</span>
        <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar bg-zinc-950/20 p-1.5 rounded-xl border border-zinc-900">

          {/* Core Terrain */}
          <div
            onClick={() => {
              setSelectedId('terrain');
              setCameraFocusTarget([0, 0, 0]);
            }}
            className={`flex items-center justify-between px-2 py-0.5 rounded-lg border text-[9.5px] cursor-pointer transition-all font-mono duration-200 ${selectedId === 'terrain'
                ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm'
                : 'bg-zinc-950/40 border-zinc-900 hover:bg-zinc-800/40 text-zinc-400'
              }`}
          >
            <div className="flex items-center gap-1.5 py-0.5">
              <Mountain className={`w-3.5 h-3.5 ${selectedId === 'terrain' ? 'text-indigo-400' : 'text-zinc-550'}`} />
              <span className="font-bold uppercase text-[8.5px]">Core Terrain</span>
            </div>
            <span className="text-[6px] font-mono font-bold text-zinc-500 bg-zinc-950 px-1 py-0.2 rounded border border-zinc-900 select-none">STATIC</span>
          </div>

          {items.length === 0 && (
            <p className="text-zinc-650 font-mono text-[8px] text-center py-4 italic">No placed mesh layers...</p>
          )}

          {[...items].reverse().map(item => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <LayerRow
                key={item.id}
                item={item}
                isSelected={isSelected}
                onClick={(e) => {
                  if (activeAsset) setActiveAsset(null);

                  // Smoothly pan and focus camera onto the object!
                  setCameraFocusTarget(item.pos);

                  if (e.shiftKey) {
                    toggleSelectedId(item.id);
                  } else {
                    setSelectedId(item.id);
                  }
                }}
                onDelete={() => {
                  updateItemsWithHistory(prev => prev.filter(i => i.id !== item.id));
                  if (selectedIds.includes(item.id)) {
                    setSelectedIds(selectedIds.filter(x => x !== item.id));
                  }
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Copy / Export buttons */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-850 pt-2.5">
        <button
          onClick={copyMapCode}
          className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-400 hover:text-white rounded-xl text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1 shadow-sm active:scale-[0.98] cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy Map Struct
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={exportMap} className="py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-xl font-bold uppercase text-[8.5px] transition-colors cursor-pointer active:scale-[0.98]">Export JSON</button>
          <button onClick={handleClearMap} className="py-1.5 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-950/30 text-rose-450 hover:text-white rounded-xl font-bold uppercase text-[8.5px] transition-colors cursor-pointer active:scale-[0.98]">Wipe Scene</button>
        </div>
      </div>

    </div>
  );
};
