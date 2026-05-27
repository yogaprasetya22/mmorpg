/** Left-center quest tracker panel. */
'use client';

import { Trophy } from 'lucide-react';

export function QuestPanel() {
  return (
    <div className="absolute left-3 top-[48%] -translate-y-1/2 w-[200px] bg-black/50 backdrop-blur-xl border border-white/10 border-l-[3px] border-l-amber-400 rounded-r-2xl rounded-l-sm p-3 flex flex-col gap-2 shadow-2xl pointer-events-auto">
      <div className="flex items-center gap-2 border-b border-white/5 pb-1.5">
        <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[9px] font-black text-zinc-200 uppercase tracking-widest">Misi Utama</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-black text-white leading-tight">Taklukkan Lembah Badai</span>
          <span className="text-[8.5px] text-zinc-400">Basmi monster di arena</span>
        </div>
        <div className="bg-black/40 border border-white/5 rounded-lg px-2 py-1 flex justify-between text-[8px] font-black">
          <span className="text-zinc-500 uppercase tracking-wide">MONSTER</span>
          <span id="quest-monster-count" className="text-amber-400">—</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-black text-amber-300 leading-tight">Berburu Harta Karun</span>
          <div className="flex justify-between text-[8px]">
            <span className="text-zinc-500">Kumpulkan Gold</span>
            <span id="quest-gold-count" className="text-amber-400 font-black">0/500</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-black text-cyan-300 leading-tight">Eksplorasi Wilayah</span>
          <div className="flex justify-between text-[8px]">
            <span className="text-zinc-500">Pemain Online</span>
            <span id="quest-player-count" className="text-cyan-400 font-black">—</span>
          </div>
        </div>
      </div>
    </div>
  );
}
