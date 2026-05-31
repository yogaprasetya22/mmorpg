/** Player stats HUD: Avatar, HP/MP bars, currency bar, and bottom HP gauge (isolated microservice). */
'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import { User } from 'lucide-react';
import { FPSBadge } from './FPSCounter';
import type { PlayerStatsHUDRef } from '../ArenaClient.types';

export const PlayerStatsHUD = forwardRef<PlayerStatsHUDRef, {
  defaultUsername: string;
  defaultLevel: number;
  onOpenStats: () => void;
}>(({ defaultUsername, defaultLevel, onOpenStats }, ref) => {
  const [stats, setStats] = useState<any>({
    hp: 100, max_hp: 100, mp: 50, max_mp: 50,
    level: defaultLevel, gold: 0,
    username: defaultUsername,
  });

  useImperativeHandle(ref, () => ({
    updateStats(newStats: any) {
      setStats((prev: any) => {
        if (!prev) return newStats;
        let changed = false;
        for (const key in newStats) {
          if (prev[key] !== newStats[key]) {
            changed = true;
            break;
          }
        }
        if (!changed) return prev;
        return { ...prev, ...newStats };
      });
    },
    updateHpMp(hp: number, maxHp: number) {
      setStats((prev: any) => {
        if (!prev) return { hp, max_hp: maxHp, mp: 50, max_mp: 50, level: defaultLevel, gold: 0, username: defaultUsername };
        if (prev.hp === hp && prev.max_hp === maxHp) return prev; // Skip if unchanged
        return { ...prev, hp, max_hp: maxHp };
      });
    },
    getStats() { return stats; }
  }));

    const hpPct = Math.max(0, Math.min(100, ((stats.hp ?? 100) / (stats.max_hp ?? 100)) * 100));
    const mpPct = Math.max(0, Math.min(100, ((stats.mp ?? 50) / (stats.max_mp ?? 50)) * 100));
    const currentXp = stats.xp ?? 0;
    const xpNeeded = (stats.level ?? 1) * 100;
    const xpPct = Math.max(0, Math.min(100, (currentXp / xpNeeded) * 100));

    return (
      <>
        {/* ── TOP-LEFT: Avatar + HP/MP ── */}
        <div className="absolute left-3 top-3 flex items-center gap-2.5 pointer-events-auto">
          <div className="relative cursor-pointer" onClick={onOpenStats}>
            <div className="w-[62px] h-[62px] rounded-full bg-gradient-to-br from-emerald-400 via-cyan-500 to-indigo-600 p-[3px] shadow-[0_0_18px_rgba(16,185,129,0.45)]">
              <div className="w-full h-full rounded-full bg-[#0d1117] flex items-center justify-center overflow-hidden">
                <User className="w-7 h-7 text-cyan-300" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-[#0d1117] flex items-center justify-center text-[9px] font-black text-black shadow-lg">
              {stats.level ?? defaultLevel}
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-emerald-400/20 pointer-events-none" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-black text-white drop-shadow-md tracking-tight">
                {stats.username ?? defaultUsername}
              </span>
              <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[8px] font-black px-2 py-0.5 rounded-md tracking-wider">
                CP {((stats.level ?? 1) * 350 + 742).toLocaleString()}
              </span>
            </div>
            <div className="w-48 h-[14px] rounded-full bg-black/70 border border-white/10 overflow-hidden relative shadow-inner">
              <div className="h-full bg-gradient-to-r from-green-600 via-emerald-400 to-green-500 rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(16,185,129,0.5)]" style={{width:`${hpPct}%`}} />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white drop-shadow">
                {Math.round(stats.hp ?? 100)} / {Math.round(stats.max_hp ?? 100)}
              </span>
            </div>
            <div className="w-48 h-[10px] rounded-full bg-black/70 border border-white/10 overflow-hidden relative shadow-inner">
              <div className="h-full bg-gradient-to-r from-blue-600 via-sky-400 to-blue-500 rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(59,130,246,0.4)]" style={{width:`${mpPct}%`}} />
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white drop-shadow">
                {Math.round(stats.mp ?? 50)} / {Math.round(stats.max_mp ?? 50)}
              </span>
            </div>
          </div>
        </div>
  
        {/* ── TOP-CENTER: Currency bar ── */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/55 backdrop-blur-xl border border-white/10 px-4 py-1.5 rounded-2xl shadow-xl pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-[9px] font-black text-black shadow">S</span>
            <span className="text-[11px] font-black text-amber-400">{(stats.gold ?? 2048).toLocaleString()}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm">💎</span>
            <span className="text-[11px] font-black text-pink-400">88</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🔷</span>
            <span className="text-[11px] font-black text-cyan-400">150</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <FPSBadge />
        </div>
  
        {/* ── BOTTOM-CENTER: Big HP + Fever bar ── */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[380px] flex flex-col gap-1 pointer-events-none">
          <div className="relative w-full h-[18px] bg-black/75 rounded-full border border-white/10 overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-700 via-emerald-400 to-green-500 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
              style={{width:`${hpPct}%`}}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow">
              {hpPct.toFixed(2)}%
            </div>
          </div>
          <div className="relative w-full h-[11px] bg-black/70 rounded-full border border-white/10 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-600 via-rose-400 to-fuchsia-500 rounded-full shadow-[0_0_8px_rgba(236,72,153,0.6)]" style={{width:"65%"}} />
            <div className="absolute inset-0 flex items-center justify-center gap-1 text-[7px] font-black text-white drop-shadow tracking-widest uppercase">
              <span className="bg-pink-500/80 px-1.5 py-0.5 rounded-full text-[6px] font-black">FEVER</span>
            </div>
          </div>
        </div>

        {/* Bottom EXP Bar */}
        <div className="absolute bottom-0 inset-x-0 h-1.5 bg-zinc-950 z-20 flex items-center pointer-events-auto border-t border-white/5">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            style={{ width: `${xpPct}%` }}
          />
          <div className="absolute bottom-2 left-6 text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none drop-shadow">
            EXP {xpPct.toFixed(2)}%
          </div>
        </div>
      </>
  );
});
PlayerStatsHUD.displayName = "PlayerStatsHUD";
