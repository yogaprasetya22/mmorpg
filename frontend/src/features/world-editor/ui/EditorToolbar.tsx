'use client';

import { Undo2, Redo2, Database } from 'lucide-react';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';

/**
 * EditorToolbar — Unity-style top toolbar.
 * Shows: active tool context indicator + quick actions (undo/redo/save).
 * Pure UI — no mechanism changes.
 */
export const EditorToolbar = () => {
  const {
    selectedId,
    items,
    historyIndex,
    history,
    undo,
    redo,
    saveToDatabase,
    isSaving,
    activeAsset,
    terrainMode,
    sculptTool,
    vegetationBrushActive,
  } = useEditorStore();

  // Determine active context label + icon
  const getContextInfo = () => {
    if (vegetationBrushActive) {
      return { icon: '🌿', label: 'Vegetation Brush', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    }
    if (activeAsset) {
      return { icon: '📦', label: `Placing: ${activeAsset.name}`, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' };
    }
    if (selectedId === 'terrain') {
      const toolLabels: Record<string, string> = { raise: 'Raise', lower: 'Lower', smooth: 'Smooth', flatten: 'Flatten' };
      const modeLabel = terrainMode === 'sculpt' ? `${toolLabels[sculptTool] || 'Sculpt'} Sculpt` : 'Paint Splat';
      return { icon: '🏔️', label: `Terrain — ${modeLabel}`, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' };
    }
    if (selectedId && selectedId !== 'terrain') {
      const item = items.find(i => i.id === selectedId);
      const name = item?.type?.replace(/[-_]/g, ' ') || selectedId;
      return { icon: '📐', label: `Transform: ${name}`, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    }
    return { icon: '🌍', label: 'Scene Overview', color: 'text-zinc-400', bg: 'bg-zinc-800/50 border-zinc-700/40' };
  };

  const ctx = getContextInfo();

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-zinc-950 border-b border-zinc-800/60 flex-shrink-0">
      {/* Left: Active Context Badge */}
      <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border ${ctx.bg}`}>
        <span className="text-sm select-none">{ctx.icon}</span>
        <span className={`text-[9px] font-black uppercase tracking-wider ${ctx.color}`}>{ctx.label}</span>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-1.5">
        {/* Undo */}
        <button
          onClick={undo}
          disabled={historyIndex <= 0}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-20 text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        {/* Redo */}
        <button
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          title="Redo (Ctrl+Y)"
          className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-20 text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
        {/* Separator */}
        <div className="w-px h-4 bg-zinc-800 mx-0.5" />
        {/* Save */}
        <button
          onClick={() => saveToDatabase()}
          disabled={isSaving}
          title="Save Workspace (Ctrl+S)"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600/15 hover:bg-blue-600 border border-blue-500/25 hover:border-blue-500 text-blue-400 hover:text-white text-[8.5px] font-extrabold uppercase tracking-wider transition-all cursor-pointer active:scale-95"
        >
          <Database className="w-3 h-3" />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
