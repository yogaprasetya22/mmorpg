/** Full-screen death overlay with respawn animation (isolated microservice). */
'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import { Skull, RefreshCw } from 'lucide-react';
import type { DeathOverlayRef } from '../ArenaClient.types';

export const DeathOverlay = forwardRef<DeathOverlayRef, {}>((_props, ref) => {
  const [isDead, setIsDead] = useState(false);

  useImperativeHandle(ref, () => ({
    setDead(dead: boolean) {
      setIsDead(dead);
    }
  }));

  if (!isDead) return null;
  return (
    <div className="absolute inset-0 z-[99999] pointer-events-auto select-none bg-black/85 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-500">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0)_30%,rgba(0,0,0,0.9)_90%)] pointer-events-none animate-pulse" />
      <div className="flex flex-col items-center text-center max-w-md px-6 relative z-10">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 via-rose-700 to-red-950 p-0.5 border-4 border-red-500/40 shadow-2xl flex items-center justify-center mb-6 animate-bounce">
          <Skull className="w-10 h-10 text-white drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
        </div>
        <h1 className="text-3xl font-black tracking-tighter uppercase text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] italic mb-2">
          Karakter Anda Gugur!
        </h1>
        <p className="text-xs font-semibold text-zinc-400 leading-relaxed mb-8">
          Anda dikalahkan di pertempuran. Menghidupkan kembali dan memulihkan seluruh tenaga di Kota Starter...
        </p>
        <div className="flex items-center gap-3 bg-zinc-950/80 border border-red-500/20 px-6 py-3.5 rounded-2xl shadow-xl">
          <RefreshCw className="w-4 h-4 text-red-400 animate-spin" />
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">
            Memulihkan tenaga dalam beberapa detik...
          </span>
        </div>
      </div>
    </div>
  );
});
DeathOverlay.displayName = "DeathOverlay";
