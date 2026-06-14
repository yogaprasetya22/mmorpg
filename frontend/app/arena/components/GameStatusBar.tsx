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
    <div className="flex flex-col items-end gap-1 mt-1">
      {/* Map Zone Name Badge */}
      <div className="bg-black/20 backdrop-blur-md border border-white/10 px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 self-end">
        <span className="text-[7.5px] font-bold text-white tracking-wider uppercase">
          {getMapName(mapId)}
        </span>
      </div>

      {/* Server info pills */}
      <div className="flex gap-1">
        <div className="bg-black/20 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Users className="w-2.5 h-2.5 text-cyan-400" />
          <span className="text-[7.5px] font-bold text-zinc-300">{counts.pc}</span>
        </div>
        <div className="bg-black/20 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Skull className="w-2.5 h-2.5 text-red-400 animate-pulse" />
          <span className="text-[7.5px] font-bold text-zinc-300">{counts.mc}</span>
        </div>
      </div>
    </div>
  );
}));
GameStatusBar.displayName = "GameStatusBar";
