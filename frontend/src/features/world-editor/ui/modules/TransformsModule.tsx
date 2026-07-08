'use client';

import { useState } from 'react';
import { Box, Trash2, Copy, ChevronDown, ChevronUp, Grid } from 'lucide-react';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';
import type { MapItem } from '@jagres/shared';

export const TransformsModule = () => {
  const {
    items,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    updateItemsWithHistory,
    gridSize,
    setGridSize,
    gridEnabled,
    setGridEnabled,
    mode,
    setMode
  } = useEditorStore();

  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedItem = items.find(i => i.id === selectedId);

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
    <div className="flex flex-col gap-3 font-sans text-[10px] text-zinc-350">

      {/* Poin 3: Grid Snapping Panel di bagian atas */}
      <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl flex flex-col gap-2 shadow-inner">
        <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
          <span className="uppercase tracking-widest flex items-center gap-1.5">
            <Grid className="w-3.5 h-3.5 text-blue-500" />
            Grid Snapping
          </span>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={gridEnabled}
              onChange={(e) => setGridEnabled(e.target.checked)}
              className="rounded bg-zinc-900 border-zinc-800 text-blue-550 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5 accent-blue-500"
            />
            <span className={gridEnabled ? "text-blue-450 font-extrabold text-[9px]" : "text-zinc-600 font-bold"}>
              {gridEnabled ? `${gridSize}m` : 'DISABLED'}
            </span>
          </div>
        </div>
        {gridEnabled && (
          <input
            type="range" min="0.1" max="5" step="0.1"
            value={gridSize}
            onChange={(e) => setGridSize(parseFloat(e.target.value))}
            className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
          />
        )}
      </div>

      {(!selectedId || selectedId === 'terrain' || !selectedItem) ? (
        <div className="p-4 bg-zinc-950/45 border border-zinc-900 rounded-xl text-center text-zinc-500 font-sans text-[10px] italic">
          Select a placed static asset in the list or viewport to load its direct transform matrices.
        </div>
      ) : (
        <>
          {/* Dynamic Item Identity Display */}
          <div className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-900 rounded-xl shadow-inner">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Box className="w-4 h-4" />
            </div>
            <div className="flex flex-col truncate w-full">
              <span className="text-[11.5px] font-black text-white truncate uppercase tracking-tight leading-tight">
                {selectedItem.type.replace(/[-_]/g, ' ')}
              </span>
              <span className="text-[7.5px] text-indigo-400/60 uppercase tracking-widest font-mono mt-0.5 font-bold">
                Direct Control Active
              </span>
            </div>
          </div>

          {/* Transform Mode Switcher */}
          <div className="grid grid-cols-3 gap-1 bg-zinc-950 border border-zinc-900 p-1 rounded-xl">
            <button
              onClick={() => setMode('translate')}
              className={`py-1.5 text-[8.5px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${mode === 'translate' ? 'bg-blue-600 text-white font-black' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
            >
              Translate
            </button>
            <button
              onClick={() => setMode('rotate')}
              className={`py-1.5 text-[8.5px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${mode === 'rotate' ? 'bg-blue-600 text-white font-black' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
            >
              Rotate
            </button>
            <button
              onClick={() => setMode('scale')}
              className={`py-1.5 text-[8.5px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${mode === 'scale' ? 'bg-blue-600 text-white font-black' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
            >
              Scale
            </button>
          </div>


          {/* Primary Actions for node management */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={duplicateSelected}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white rounded-xl transition-all font-bold uppercase tracking-wider text-[9px] shadow cursor-pointer select-none active:scale-[0.98]"
            >
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              Clone Node
            </button>
            <button
              onClick={deleteSelected}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-900/30 hover:border-rose-950/40 text-rose-400 hover:text-rose-350 rounded-xl transition-all font-bold uppercase tracking-wider text-[9px] shadow cursor-pointer select-none active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              Delete Node
            </button>
          </div>

          {/* Collapsible Dropdown for Advanced Precision Coordinates */}
          <div className="border-t border-zinc-900/50 pt-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full py-2 px-2 bg-zinc-950/50 hover:bg-zinc-950 border border-zinc-900 rounded-xl flex items-center justify-between font-bold text-[8.5px] text-zinc-500 hover:text-zinc-350 transition-all uppercase tracking-widest select-none cursor-pointer"
            >
              <span>Advanced Precision</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-3.5 mt-3 p-3 bg-zinc-950/60 border border-zinc-900/50 rounded-xl font-mono text-[9px] animate-in slide-in-from-top-2 duration-200">

                {/* Global Position XYZ */}
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Global Position (X, Y, Z)</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg focus-within:border-indigo-500 overflow-hidden">
                      <span className="bg-rose-950/60 text-rose-450 font-black px-2 py-1 select-none border-r border-zinc-900">X</span>
                      <input
                        type="number" step={0.1}
                        value={Number(selectedItem.pos[0]?.toFixed(2)) || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [val, i.pos[1], i.pos[2]] } : i));
                        }}
                        className="w-full bg-transparent px-1.5 py-1 text-center text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-semibold"
                      />
                    </div>
                    <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg focus-within:border-indigo-500 overflow-hidden">
                      <span className="bg-emerald-950/60 text-emerald-450 font-black px-2 py-1 select-none border-r border-zinc-900">Y</span>
                      <input
                        type="number" step={0.1}
                        value={Number(selectedItem.pos[1]?.toFixed(2)) || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0], val, i.pos[2]] } : i));
                        }}
                        className="w-full bg-transparent px-1.5 py-1 text-center text-white focus:outline-none [appearance:textfield] font-semibold"
                      />
                    </div>
                    <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg focus-within:border-indigo-500 overflow-hidden">
                      <span className="bg-sky-950/60 text-sky-450 font-black px-2 py-1 select-none border-r border-zinc-900">Z</span>
                      <input
                        type="number" step={0.1}
                        value={Number(selectedItem.pos[2]?.toFixed(2)) || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0], i.pos[1], val] } : i));
                        }}
                        className="w-full bg-transparent px-1.5 py-1 text-center text-white focus:outline-none [appearance:textfield] font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Rotations */}
                <div className="flex flex-col gap-1 border-t border-zinc-900/50 pt-2.5">
                  <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Pitch, Yaw, Roll (Rot°)</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg focus-within:border-indigo-500 overflow-hidden">
                      <span className="bg-rose-950/60 text-rose-450 font-black px-2 py-1 select-none border-r border-zinc-900">P</span>
                      <input
                        type="number"
                        value={Math.round((selectedItem.rot[0] || 0) * 180 / Math.PI)}
                        onChange={(e) => {
                          const val = (parseFloat(e.target.value) || 0) * Math.PI / 180;
                          updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, rot: [val, i.rot[1], i.rot[2]] } : i));
                        }}
                        className="w-full bg-transparent px-1.5 py-1 text-center text-white focus:outline-none [appearance:textfield] font-semibold"
                      />
                    </div>
                    <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg focus-within:border-indigo-500 overflow-hidden">
                      <span className="bg-emerald-950/60 text-emerald-450 font-black px-2 py-1 select-none border-r border-zinc-900">Y</span>
                      <input
                        type="number"
                        value={Math.round((selectedItem.rot[1] || 0) * 180 / Math.PI)}
                        onChange={(e) => {
                          const val = (parseFloat(e.target.value) || 0) * Math.PI / 180;
                          updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, rot: [i.rot[0], val, i.rot[2]] } : i));
                        }}
                        className="w-full bg-transparent px-1.5 py-1 text-center text-white focus:outline-none [appearance:textfield] font-semibold"
                      />
                    </div>
                    <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg focus-within:border-indigo-500 overflow-hidden">
                      <span className="bg-sky-950/60 text-sky-450 font-black px-2 py-1 select-none border-r border-zinc-900">R</span>
                      <input
                        type="number"
                        value={Math.round((selectedItem.rot[2] || 0) * 180 / Math.PI)}
                        onChange={(e) => {
                          const val = (parseFloat(e.target.value) || 0) * Math.PI / 180;
                          updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, rot: [i.rot[0], i.rot[1], val] } : i));
                        }}
                        className="w-full bg-transparent px-1.5 py-1 text-center text-white focus:outline-none [appearance:textfield] font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Scales */}
                <div className="flex flex-col gap-1 border-t border-zinc-900/50 pt-2.5">
                  <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Scale Vector Ratio</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg focus-within:border-indigo-500 overflow-hidden">
                      <span className="bg-rose-950/60 text-rose-450 font-black px-2 py-1 select-none border-r border-zinc-900">X</span>
                      <input
                        type="number" step={0.1}
                        value={Number(selectedItem.sca[0]?.toFixed(2)) || 1}
                        onChange={(e) => {
                          const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                          updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [val, i.sca[1], i.sca[2]] } : i));
                        }}
                        className="w-full bg-transparent px-1.5 py-1 text-center text-white focus:outline-none [appearance:textfield] font-semibold"
                      />
                    </div>
                    <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg focus-within:border-indigo-500 overflow-hidden">
                      <span className="bg-emerald-950/60 text-emerald-450 font-black px-2 py-1 select-none border-r border-zinc-900">Y</span>
                      <input
                        type="number" step={0.1}
                        value={Number(selectedItem.sca[1]?.toFixed(2)) || 1}
                        onChange={(e) => {
                          const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                          updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0], val, i.sca[2]] } : i));
                        }}
                        className="w-full bg-transparent px-1.5 py-1 text-center text-white focus:outline-none [appearance:textfield] font-semibold"
                      />
                    </div>
                    <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded-lg focus-within:border-indigo-500 overflow-hidden">
                      <span className="bg-sky-950/60 text-sky-450 font-black px-2 py-1 select-none border-r border-zinc-900">Z</span>
                      <input
                        type="number" step={0.1}
                        value={Number(selectedItem.sca[2]?.toFixed(2)) || 1}
                        onChange={(e) => {
                          const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                          updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0], i.sca[1], val] } : i));
                        }}
                        className="w-full bg-transparent px-1.5 py-1 text-center text-white focus:outline-none [appearance:textfield] font-semibold"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Quick Deselect */}
          <button
            onClick={() => setSelectedId(null)}
            className="w-full py-2 mt-1 bg-zinc-950 hover:bg-zinc-900 text-zinc-550 hover:text-zinc-350 border border-zinc-900 uppercase font-bold tracking-wider rounded-xl transition-all text-[8.5px] cursor-pointer"
          >
            Deselect Instance
          </button>
        </>
      )}

    </div>
  );
};
