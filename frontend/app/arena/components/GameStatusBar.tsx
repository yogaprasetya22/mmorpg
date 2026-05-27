/** Server connection status pills showing player count and alive monster count (isolated microservice). */
'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import { Users, Skull } from 'lucide-react';
import type { GameStatusBarRef } from '../ArenaClient.types';

export const GameStatusBar = forwardRef<GameStatusBarRef, {}>((_props, ref) => {
  const [playerCount, setPlayerCount] = useState(1);
  const [aliveMonsterCount, setAliveMonsterCount] = useState(0);

  useImperativeHandle(ref, () => ({
    update(pc: number, mc: number) {
      setPlayerCount(pc);
      setAliveMonsterCount(mc);
    }
  }));

  return (
    <>
      {/* Server info pills */}
      <div className="flex gap-1.5 mt-6">
        <div className="bg-black/55 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
          <Users className="w-3 h-3 text-cyan-400" />
          <span className="text-[9px] font-black text-white">{playerCount}</span>
        </div>
        <div className="bg-black/55 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
          <Skull className="w-3 h-3 text-red-400 animate-pulse" />
          <span className="text-[9px] font-black text-white">{aliveMonsterCount}</span>
        </div>
      </div>
    </>
  );
});
GameStatusBar.displayName = "GameStatusBar";
