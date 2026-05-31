/** Server connection status pills showing player count and alive monster count (isolated microservice). */
'use client';

import { useState, forwardRef, useImperativeHandle, memo } from 'react';
import { Users, Skull } from 'lucide-react';
import type { GameStatusBarRef } from '../ArenaClient.types';

// Hoisted outside component — never re-created on re-render
const MAP_NAME_MAP: Record<string, string> = {
  "Starter Zone": "📍 PRONTERA OUTSKIRTS",
  "dungeon_1": "💀 PAYON DUNGEON LV.1",
  "dungeon_2": "🔥 MAGMA DUNGEON LV.2",
  "boss_lair": "👑 GEFFEN TOWER - BOSS",
};

function getMapName(id: string): string {
  return MAP_NAME_MAP[id] ?? `🗺️ ${id.replace(/[-_]/g, ' ').toUpperCase()}`;
}

export const GameStatusBar = memo(forwardRef<GameStatusBarRef, { mapId?: string }>(({ mapId = "Starter Zone" }, ref) => {
  // Single state object — one setState = one re-render instead of two
  const [counts, setCounts] = useState({ pc: 1, mc: 0 });

  useImperativeHandle(ref, () => ({
    update(pc: number, mc: number) {
      setCounts(prev => {
        if (prev.pc === pc && prev.mc === mc) return prev; // skip if identical
        return { pc, mc };
      });
    }
  }));

  return (
    <div className="flex flex-col items-end gap-1.5 mt-2">
      {/* Map Zone Name Badge */}
      <div className="bg-gradient-to-r from-indigo-950/80 to-purple-900/60 border border-purple-500/30 px-3 py-1 rounded-xl shadow-[0_0_12px_rgba(168,85,247,0.2)] flex items-center gap-1.5 self-end">
        <span className="text-[9px] font-black text-purple-300 tracking-wider uppercase">
          {getMapName(mapId)}
        </span>
      </div>

      {/* Server info pills */}
      <div className="flex gap-1.5">
        <div className="bg-black/55 border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
          <Users className="w-3 h-3 text-cyan-400" />
          <span className="text-[9px] font-black text-white">{counts.pc}</span>
        </div>
        <div className="bg-black/55 border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
          <Skull className="w-3 h-3 text-red-400 animate-pulse" />
          <span className="text-[9px] font-black text-white">{counts.mc}</span>
        </div>
      </div>
    </div>
  );
}));
GameStatusBar.displayName = "GameStatusBar";
