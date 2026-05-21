'use client';

import { memo, MouseEvent } from 'react';
import { Undo2, Redo2, Copy, Box, Mountain, X } from 'lucide-react';
import { useEditorStore, MapItem } from '@/src/state/useEditorStore';

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
    <div className={`flex items-center justify-between pl-2 pr-1 py-0.5 rounded border text-[9.5px] transition-all font-mono ${
      isSelected 
        ? 'bg-blue-950/60 border-blue-500 text-white shadow-sm' 
        : 'bg-zinc-950/40 border-zinc-900 hover:bg-zinc-800/40 text-zinc-400'
    }`}>
      <button 
        onClick={onClick}
        className="flex-1 text-left flex items-center gap-1.5 truncate py-0.5 cursor-pointer outline-none"
      >
        <Box className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-zinc-550'}`} />
        <span className="truncate tracking-tighter">{item.type}</span>
        <span className="text-[7.5px] text-zinc-650 tracking-normal opacity-70 truncate">({item.id.substring(0,6)})</span>
      </button>
      <button 
        onClick={onDelete}
        title="Remove Instance"
        className="w-4 h-4 flex items-center justify-center rounded hover:bg-rose-950/50 text-zinc-600 hover:text-rose-400 transition-colors"
      >
        <X className="w-2.5 h-2.5" />
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
    setActiveAsset
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
        <span className="text-zinc-550 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Undo / Redo History</span>
        <div className="grid grid-cols-2 gap-1.5 text-[9px]">
          <button 
            onClick={undo} 
            disabled={historyIndex <= 0} 
            className="flex items-center justify-center gap-1 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-25 text-zinc-350 rounded-lg transition-colors font-bold uppercase tracking-tight"
          >
            <Undo2 className="w-3 h-3" />
            Undo ({historyIndex})
          </button>
          <button 
            onClick={redo} 
            disabled={historyIndex >= history.length - 1} 
            className="flex items-center justify-center gap-1 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-25 text-zinc-350 rounded-lg transition-colors font-bold uppercase tracking-tight"
          >
            <Redo2 className="w-3 h-3" />
            Redo ({history.length - 1 - historyIndex})
          </button>
        </div>
      </div>

      {/* Hierarchy Scene Tree */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-850 pt-2.5">
        <span className="text-zinc-550 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Active placed layers ({items.length})</span>
        <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar bg-zinc-950/20 p-1 rounded border border-zinc-850">
          
          {/* Core Terrain */}
          <div 
            onClick={() => setSelectedId('terrain')}
            className={`flex items-center justify-between px-2 py-0.5 rounded border text-[9.5px] cursor-pointer transition-all font-mono ${
              selectedId === 'terrain' 
                ? 'bg-blue-950/60 border-blue-500 text-white shadow-sm' 
                : 'bg-zinc-950/40 border-zinc-900 hover:bg-zinc-800/40 text-zinc-400'
            }`}
          >
            <div className="flex items-center gap-1.5 py-0.5">
              <Mountain className={`w-3 h-3 ${selectedId === 'terrain' ? 'text-blue-450' : 'text-zinc-550'}`} />
              <span className="font-bold">Core_Terrain</span>
            </div>
            <span className="text-[6.5px] font-mono text-zinc-550 bg-zinc-900 px-1 rounded border border-zinc-850">STATIC</span>
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
      <div className="flex flex-col gap-1 border-t border-zinc-850 pt-2.5">
        <button 
          onClick={copyMapCode} 
          className="w-full py-1.5 bg-blue-600/15 hover:bg-blue-650 border border-blue-500/20 text-blue-400 hover:text-white rounded-lg text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy Map Struct
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={exportMap} className="py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-zinc-200 rounded-lg font-bold uppercase text-[8.5px] transition-colors">Export JSON</button>
          <button onClick={handleClearMap} className="py-1 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-950/30 text-rose-450 hover:text-white rounded-lg font-bold uppercase text-[8.5px] transition-colors">Wipe Scene</button>
        </div>
      </div>

    </div>
  );
};
