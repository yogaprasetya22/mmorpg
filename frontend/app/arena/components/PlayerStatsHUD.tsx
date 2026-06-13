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
        
        let next = { ...prev, hp, max_hp: maxHp };
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
        <div className="absolute left-4 top-4 flex items-center gap-3 pointer-events-auto">
          {/* Circular Portrait with Golden Ornate Ring */}
          <div className="relative cursor-pointer select-none group" onClick={onOpenStats}>
            {/* Outer Golden/Bronze Ornate Ring */}
            <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-b from-[#dfb76c] via-[#b88c42] to-[#8c5b1b] p-[3px] shadow-[0_4px_10px_rgba(0,0,0,0.5),_0_0_15px_rgba(223,183,108,0.25)] relative z-10 hover:brightness-110 transition-all duration-200">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#1a2333] to-[#2c3d59] flex items-center justify-center overflow-hidden border border-[#5c3e16]">
                <div className="text-2xl">
                  {stats.class === "Mage" ? "🧙" : stats.class === "Priest" ? "👼" : stats.class === "Tank" ? "🛡️" : stats.class === "Assassin" ? "🥷" : "⚔️"}
                </div>
              </div>
            </div>

            {/* Level Badge Overlay (Classic Base Level) */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#dfb76c] to-[#a67c32] border border-[#5c3e16] flex items-center justify-center shadow-md">
              <span className="text-[9px] font-black text-black tracking-tight leading-none">
                Lv.{stats.level ?? defaultLevel}
              </span>
            </div>
          </div>

          {/* Bar Panel - Ragnarok Semi-Transparent Plate */}
          <div className="flex flex-col gap-1.5 bg-black/40 backdrop-blur-md border border-[#dfb76c]/30 pl-11 pr-4 py-2 rounded-r-2xl -ml-10 relative z-0 shadow-lg">
            {/* Username and Class Badge */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-black text-[#fdf6e2] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-wide">
                {stats.username ?? defaultUsername}
              </span>
              <span className="bg-[#b88c42] text-black text-[7.5px] font-extrabold px-1.5 py-0.5 rounded border border-[#dfb76c]/40 uppercase tracking-wider scale-90 origin-left">
                {stats.class || "Warrior"}
              </span>
            </div>

            {/* HP Bar: Ragnarok Glossy Green */}
            <div className="w-44 h-[13px] rounded bg-zinc-950 border border-[#7a643f] overflow-hidden relative shadow-inner">
              <div 
                className="h-full bg-gradient-to-b from-[#5cff67] via-[#2cb835] to-[#147a1b] transition-all duration-300 relative" 
                style={{width:`${hpPct}%`}}
              >
                {/* Glossy Overlay Reflection */}
                <div className="absolute inset-x-0 top-0 h-[40%] bg-white/20" />
              </div>
              <span className="absolute inset-0 flex items-center justify-center text-[8.5px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                HP {Math.round(stats.hp ?? 100)} / {Math.round(stats.max_hp ?? 100)}
              </span>
            </div>

            {/* SP Bar: Ragnarok Glossy Blue */}
            <div className="w-44 h-[11px] rounded bg-zinc-950 border border-[#7a643f] overflow-hidden relative shadow-inner">
              <div 
                className="h-full bg-gradient-to-b from-[#6ce8ff] via-[#2c9bb8] to-[#176275] transition-all duration-300 relative" 
                style={{width:`${mpPct}%`}}
              >
                <div className="absolute inset-x-0 top-0 h-[40%] bg-white/20" />
              </div>
              <span className="absolute inset-0 flex items-center justify-center text-[7.5px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                SP {Math.round(stats.mp ?? 50)} / {Math.round(stats.max_mp ?? 50)}
              </span>
            </div>
          </div>
        </div>
  
        {/* ── TOP-CENTER: Currency & Channel Bar (Parchment Aesthetic) ── */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-gradient-to-b from-[#f9f5eb] to-[#e6dbcc] border-2 border-[#b88c42] px-5 py-1.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.35)] pointer-events-auto text-zinc-900 font-medium">
          {/* Zeny (Z) Currency */}
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-gradient-to-b from-[#ffea75] to-[#c79800] border border-[#7c5d00] flex items-center justify-center text-[9px] font-black text-black shadow-sm">Z</span>
            <span className="text-[11px] font-black text-[#7a4b08]">{(stats.gold ?? 2048).toLocaleString()}</span>
          </div>
          <div className="w-px h-3.5 bg-[#b88c42]/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs filter drop-shadow-sm">💎</span>
            <span className="text-[11px] font-black text-[#c026d3]">88</span>
          </div>
          <div className="w-px h-3.5 bg-[#b88c42]/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs filter drop-shadow-sm">🔷</span>
            <span className="text-[11px] font-black text-[#0284c7]">150</span>
          </div>
          <div className="w-px h-3.5 bg-[#b88c42]/30" />
          <FPSBadge />
        </div>
  
        {/* ── BOTTOM-CENTER: Ragnarok Monster HP Target & EXP ── */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[380px] flex flex-col gap-1 pointer-events-none">
          <div className="relative w-full h-[18px] bg-zinc-950 rounded border border-[#7a643f] overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.7)]">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-b from-[#5cff67] via-[#2cb835] to-[#147a1b] rounded transition-all duration-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
              style={{width:`${hpPct}%`}}
            >
              <div className="absolute inset-x-0 top-0 h-[40%] bg-white/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              HP {hpPct.toFixed(1)}%
            </div>
          </div>
          {/* Job Fever Bar */}
          <div className="relative w-full h-[10px] bg-zinc-950 rounded border border-[#7a643f] overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.7)]">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-b from-[#f472b6] via-[#db2777] to-[#9d174d] transition-all duration-300" style={{width:"65%"}}>
              <div className="absolute inset-x-0 top-0 h-[40%] bg-white/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center gap-1 text-[7px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] tracking-wider">
              FEVER EXP 65%
            </div>
          </div>
        </div>
 
        {/* Bottom EXP Bar: Classic RO styling */}
        <div className="absolute bottom-0 inset-x-0 h-2 bg-zinc-950 z-20 flex items-center pointer-events-auto border-t border-[#7a643f]/40">
          <div
            className="h-full bg-gradient-to-b from-[#a855f7] via-[#7e22ce] to-[#581c87] transition-all duration-500"
            style={{ width: `${xpPct}%` }}
          />
          <div className="absolute bottom-2.5 left-4 text-[8px] font-black text-[#c084fc] uppercase tracking-widest leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            BASE EXP {xpPct.toFixed(2)}%
          </div>
        </div>
      </>
  );
});
PlayerStatsHUD.displayName = "PlayerStatsHUD";
