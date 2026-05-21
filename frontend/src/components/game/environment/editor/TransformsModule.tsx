'use client';

import { Box, Trash2, Copy } from 'lucide-react';
import { useEditorStore, MapItem } from '@/src/state/useEditorStore';

export const TransformsModule = () => {
  const {
    items,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    mode,
    setMode,
    updateItemsWithHistory
  } = useEditorStore();

  const selectedItem = items.find(i => i.id === selectedId);

  if (!selectedId || selectedId === 'terrain' || !selectedItem) {
    return (
      <div className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-lg text-center text-zinc-500 font-mono text-[8.5px] italic">
        Select a placed static asset in the list or viewport to load its coordinate matrix.
      </div>
    );
  }

  const deleteSelected = () => {
    if (selectedIds.length > 0) {
      updateItemsWithHistory(prev => prev.filter(i => !selectedIds.includes(i.id)));
      setSelectedId(null);
    }
  };

  const duplicateSelected = () => {
    if (selectedIds.length > 0) {
      const duplicatedItems: MapItem[] = [];
      const newIds: string[] = [];

      selectedIds.forEach(id => {
        const item = items.find(i => i.id === id);
        if (item) {
          const newId = "item_" + Math.random().toString(36).substr(2, 9);
          duplicatedItems.push({
            ...item,
            id: newId,
            pos: [item.pos[0] + 1, item.pos[1], item.pos[2] + 1] as [number, number, number]
          });
          newIds.push(newId);
        }
      });

      if (duplicatedItems.length > 0) {
        updateItemsWithHistory(prev => [...prev, ...duplicatedItems]);
        setSelectedIds(newIds);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 font-mono text-[9px]">
      
      {/* Selection detail bar */}
      <div className="flex items-center gap-2 p-1.5 bg-zinc-950 border border-zinc-850 rounded-lg">
        <div className="w-5 h-5 rounded bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
          <Box className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col truncate w-full">
          <span className="text-[9.5px] font-black text-white truncate uppercase leading-none">{selectedItem.type}</span>
          <span className="text-[7px] text-zinc-550 uppercase tracking-tighter truncate mt-0.5">{selectedItem.id}</span>
        </div>
      </div>

      {/* Sub-mode selector tabs */}
      <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-850 text-[8px] font-bold">
        {(['translate', 'rotate', 'scale'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1 rounded-sm uppercase tracking-tighter transition-all ${
              mode === m ? 'bg-blue-600 text-white shadow' : 'text-zinc-550 hover:text-zinc-350'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Numerical Coordinate Matrix Inputs */}
      <div className="flex flex-col gap-2 pt-1">
        
        {/* Translation Pos */}
        <div className="flex flex-col gap-0.5">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Global Position (X, Y, Z)</span>
          <div className="grid grid-cols-3 gap-1">
            <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded focus-within:border-blue-500 overflow-hidden">
              <span className="bg-rose-950/60 text-rose-450 font-black px-1.5 py-0.5 select-none border-r border-zinc-850">X</span>
              <input
                type="number" step={0.1}
                value={Number(selectedItem.pos[0]?.toFixed(2)) || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [val, i.pos[1], i.pos[2]] } : i));
                }}
                className="w-full bg-transparent px-1 py-0.5 text-center text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded focus-within:border-blue-500 overflow-hidden">
              <span className="bg-emerald-950/60 text-emerald-450 font-black px-1.5 py-0.5 select-none border-r border-zinc-850">Y</span>
              <input
                type="number" step={0.1}
                value={Number(selectedItem.pos[1]?.toFixed(2)) || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0], val, i.pos[2]] } : i));
                }}
                className="w-full bg-transparent px-1 py-0.5 text-center text-white focus:outline-none [appearance:textfield]"
              />
            </div>
            <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded focus-within:border-blue-500 overflow-hidden">
              <span className="bg-sky-950/60 text-sky-450 font-black px-1.5 py-0.5 select-none border-r border-zinc-850">Z</span>
              <input
                type="number" step={0.1}
                value={Number(selectedItem.pos[2]?.toFixed(2)) || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0], i.pos[1], val] } : i));
                }}
                className="w-full bg-transparent px-1 py-0.5 text-center text-white focus:outline-none [appearance:textfield]"
              />
            </div>
          </div>
        </div>

        {/* Orientation Rot */}
        <div className="flex flex-col gap-0.5 border-t border-zinc-850 pt-2">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Pitch, Yaw, Roll (Rot°)</span>
          <div className="grid grid-cols-3 gap-1">
            <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded focus-within:border-blue-500 overflow-hidden">
              <span className="bg-rose-950/60 text-rose-450 font-black px-1.5 py-0.5 select-none border-r border-zinc-850">P</span>
              <input
                type="number"
                value={Math.round((selectedItem.rot[0] || 0) * 180 / Math.PI)}
                onChange={(e) => {
                  const val = (parseFloat(e.target.value) || 0) * Math.PI / 180;
                  updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, rot: [val, i.rot[1], i.rot[2]] } : i));
                }}
                className="w-full bg-transparent px-1 py-0.5 text-center text-white focus:outline-none [appearance:textfield]"
              />
            </div>
            <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded focus-within:border-blue-500 overflow-hidden">
              <span className="bg-emerald-950/60 text-emerald-450 font-black px-1.5 py-0.5 select-none border-r border-zinc-850">Y</span>
              <input
                type="number"
                value={Math.round((selectedItem.rot[1] || 0) * 180 / Math.PI)}
                onChange={(e) => {
                  const val = (parseFloat(e.target.value) || 0) * Math.PI / 180;
                  updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, rot: [i.rot[0], val, i.rot[2]] } : i));
                }}
                className="w-full bg-transparent px-1 py-0.5 text-center text-white focus:outline-none [appearance:textfield]"
              />
            </div>
            <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded focus-within:border-blue-500 overflow-hidden">
              <span className="bg-sky-950/60 text-sky-450 font-black px-1.5 py-0.5 select-none border-r border-zinc-850">R</span>
              <input
                type="number"
                value={Math.round((selectedItem.rot[2] || 0) * 180 / Math.PI)}
                onChange={(e) => {
                  const val = (parseFloat(e.target.value) || 0) * Math.PI / 180;
                  updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, rot: [i.rot[0], i.rot[1], val] } : i));
                }}
                className="w-full bg-transparent px-1 py-0.5 text-center text-white focus:outline-none [appearance:textfield]"
              />
            </div>
          </div>
        </div>

        {/* Scale Vectors */}
        <div className="flex flex-col gap-0.5 border-t border-zinc-850 pt-2">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Scale Vector Ratio</span>
          <div className="grid grid-cols-3 gap-1">
            <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded focus-within:border-blue-500 overflow-hidden">
              <span className="bg-rose-950/60 text-rose-450 font-black px-1.5 py-0.5 select-none border-r border-zinc-850">X</span>
              <input
                type="number" step={0.1}
                value={Number(selectedItem.sca[0]?.toFixed(2)) || 1}
                onChange={(e) => {
                  const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                  updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [val, i.sca[1], i.sca[2]] } : i));
                }}
                className="w-full bg-transparent px-1 py-0.5 text-center text-white focus:outline-none [appearance:textfield]"
              />
            </div>
            <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded focus-within:border-blue-500 overflow-hidden">
              <span className="bg-emerald-950/60 text-emerald-450 font-black px-1.5 py-0.5 select-none border-r border-zinc-850">Y</span>
              <input
                type="number" step={0.1}
                value={Number(selectedItem.sca[1]?.toFixed(2)) || 1}
                onChange={(e) => {
                  const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                  updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0], val, i.sca[2]] } : i));
                }}
                className="w-full bg-transparent px-1 py-0.5 text-center text-white focus:outline-none [appearance:textfield]"
              />
            </div>
            <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded focus-within:border-blue-500 overflow-hidden">
              <span className="bg-sky-950/60 text-sky-450 font-black px-1.5 py-0.5 select-none border-r border-zinc-850">Z</span>
              <input
                type="number" step={0.1}
                value={Number(selectedItem.sca[2]?.toFixed(2)) || 1}
                onChange={(e) => {
                  const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                  updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0], i.sca[1], val] } : i));
                }}
                className="w-full bg-transparent px-1 py-0.5 text-center text-white focus:outline-none [appearance:textfield]"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Instance Operations */}
      <div className="grid grid-cols-2 gap-1.5 border-t border-zinc-850 pt-3">
        <button 
          onClick={duplicateSelected} 
          className="flex items-center justify-center gap-1 py-1.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 text-blue-400 hover:text-white rounded-lg transition-colors font-bold uppercase tracking-tight"
        >
          <Copy className="w-3 h-3" />
          Clone Node
        </button>
        <button 
          onClick={deleteSelected} 
          className="flex items-center justify-center gap-1 py-1.5 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 text-rose-450 hover:text-white rounded-lg transition-colors font-bold uppercase tracking-tight"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete Node
        </button>
      </div>

      <button 
        onClick={() => setSelectedId(null)}
        className="w-full py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-850 uppercase rounded-lg transition-all"
      >
        Deselect Instance
      </button>

    </div>
  );
};
