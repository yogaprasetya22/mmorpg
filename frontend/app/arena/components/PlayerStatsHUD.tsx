/** Player stats HUD: Avatar, HP/MP bars, currency bar, and bottom HP gauge (isolated microservice). */
'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
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
        const next = { ...prev, ...newStats };
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("player_stats_updated", { detail: next }));
        }, 0);
        return next;
      });
    },
    updateHpMp(hp: number, maxHp: number, mp?: number, maxMp?: number) {
      setStats((prev: any) => {
        if (!prev) return { hp, max_hp: maxHp, mp: mp ?? 50, max_mp: maxMp ?? 50, level: defaultLevel, gold: 0, username: defaultUsername };
        if (prev.hp === hp && prev.max_hp === maxHp && (typeof mp === 'undefined' || prev.mp === mp) && (typeof maxMp === 'undefined' || prev.max_mp === maxMp)) return prev;
        
        const next = { ...prev, hp, max_hp: maxHp };
        if (typeof mp !== 'undefined') next.mp = mp;
        if (typeof maxMp !== 'undefined') next.max_mp = maxMp;
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("player_stats_updated", { detail: next }));
        }, 0);
        return next;
      });
    },
    getStats() { return stats; }
  }));

    const hpPct = Math.max(0, Math.min(100, ((stats.hp ?? 100) / (stats.max_hp ?? 100)) * 100));
    const mpPct = Math.max(0, Math.min(100, ((stats.mp ?? 50) / (stats.max_mp ?? 50)) * 100));
    const currentXp = stats.xp ?? 0;
    const getRequiredXp = (lvl: number) => {
      if (lvl <= 0) return 100;
      return Math.round(100 * Math.pow(lvl, 1.8));
    };
    const xpNeeded = getRequiredXp(stats.level ?? 1);
    const xpPct = Math.max(0, Math.min(100, (currentXp / xpNeeded) * 100));

    return (
      <>
        {/* ── TOP-LEFT: Ragnarok-Style Portrait & HP/SP/Job Bars ── */}
        <div className="absolute left-4 top-4 flex items-center gap-2 pointer-events-auto select-none">
          {/* Circular Portrait with custom border */}
          <div className="relative cursor-pointer group" onClick={onOpenStats}>
            {/* Outer Ring */}
            <div className="w-[64px] h-[64px] rounded-full bg-gradient-to-tr from-[#86efac] via-[#10b981] to-[#67e8f9] p-[2px] shadow-[0_4px_12px_rgba(0,0,0,0.4)] relative z-10 hover:scale-105 transition-transform duration-200">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#1e293b] to-[#0f172a] flex items-center justify-center overflow-hidden border border-black/30">
                <div className="text-2xl transform group-hover:scale-110 transition-transform">
                  {stats.class === "Mage" ? "🧙" : stats.class === "Priest" ? "👼" : stats.class === "Tank" ? "🛡️" : stats.class === "Assassin" ? "🥷" : "⚔️"}
                </div>
              </div>
            </div>

            {/* Level Badge Overlay (Top right overlapping avatar, RO style) */}
            <div className="absolute -top-1.5 -right-1 z-20 px-2 py-0.5 rounded-full bg-[#10b981] border border-white/20 flex items-center justify-center shadow-md">
              <span className="text-[8px] font-black text-white tracking-tight leading-none">
                Lv {stats.level ?? defaultLevel}
              </span>
            </div>
          </div>

          {/* Bar Panel - Ragnarok Semi-Transparent Plate */}
          <div className="flex flex-col gap-1 bg-black/30 backdrop-blur-md border border-white/10 pl-4 pr-4 py-1.5 rounded-2xl relative z-0 shadow-lg min-w-[160px]">
            {/* Username and Class Badge */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] tracking-wide">
                {stats.username ?? defaultUsername}
              </span>
              <span className="bg-[#10b981]/25 text-[#a7f3d0] text-[7px] font-extrabold px-1 py-0.2 rounded border border-[#10b981]/30 uppercase tracking-wider scale-90 origin-left">
                {stats.class || "Warrior"}
              </span>
            </div>

            {/* HP Bar: Ragnarok Glossy Green */}
            <div className="w-36 h-[9px] rounded-full bg-zinc-950/80 border border-white/5 overflow-hidden relative shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-[#22c55e] to-[#4ade80] transition-all duration-300 relative rounded-full" 
                style={{width:`${hpPct}%`}}
              >
                {/* Glossy Overlay Reflection */}
                <div className="absolute inset-x-0 top-0 h-[40%] bg-white/25" />
              </div>
            </div>

            {/* SP Bar: Ragnarok Glossy Blue */}
            <div className="w-36 h-[8px] rounded-full bg-zinc-950/80 border border-white/5 overflow-hidden relative shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] transition-all duration-300 relative rounded-full" 
                style={{width:`${mpPct}%`}}
              >
                <div className="absolute inset-x-0 top-0 h-[40%] bg-white/25" />
              </div>
            </div>
          </div>
        </div>
  
        {/* ── TOP-CENTER: Currency & Channel Bar (Clean Glassy Aesthetic) ── */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3.5 bg-black/25 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.3)] pointer-events-auto text-white">
          {/* Zeny (Z) Currency */}
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-[#facc15] flex items-center justify-center text-[8.5px] font-bold text-black shadow-sm">Z</span>
            <span className="text-[10px] font-bold text-[#fef08a]">{(stats.gold ?? 2048).toLocaleString()}</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] filter drop-shadow-sm">💎</span>
            <span className="text-[10px] font-bold text-[#f472b6]">88</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] filter drop-shadow-sm">🔷</span>
            <span className="text-[10px] font-bold text-[#38bdf8]">150</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <FPSBadge />
        </div>
  
        {/* ── BOTTOM-CENTER: Ragnarok Monster HP Target & EXP ── */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[340px] flex flex-col gap-1 pointer-events-none">
          <div className="relative w-full h-[14px] bg-black/30 backdrop-blur-sm rounded-full border border-white/10 overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#22c55e] to-[#4ade80] rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
              style={{width:`${hpPct}%`}}
            >
              <div className="absolute inset-x-0 top-0 h-[40%] bg-white/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-[8.5px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              HP {hpPct.toFixed(1)}%
            </div>
          </div>
          {/* Job Fever Bar */}
          <div className="relative w-full h-[8px] bg-black/30 backdrop-blur-sm rounded-full border border-white/10 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#ec4899] to-[#f472b6] transition-all duration-300 rounded-full" style={{width:"65%"}}>
              <div className="absolute inset-x-0 top-0 h-[40%] bg-white/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center gap-1 text-[7px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] tracking-wider">
              FEVER EXP 65%
            </div>
          </div>
        </div>
  
        {/* Bottom EXP Bar: Classic RO styling */}
        <div className="absolute bottom-0 inset-x-0 h-1.5 bg-zinc-950 z-20 flex items-center pointer-events-auto">
          <div
            className="h-full bg-gradient-to-r from-[#a855f7] to-[#c084fc] transition-all duration-500"
            style={{ width: `${xpPct}%` }}
          />
          <div className="absolute bottom-2 left-4 text-[8px] font-black text-[#c084fc] uppercase tracking-widest leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            BASE EXP {xpPct.toFixed(2)}%
          </div>
        </div>
      </>
    );
  });
PlayerStatsHUD.displayName = "PlayerStatsHUD";
