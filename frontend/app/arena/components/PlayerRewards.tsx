/** Daily Login Rewards panel aligned with vintage parchment RPG styling. */
'use client';

import { useState, useEffect } from 'react';
import { X, ArrowLeft, Check, Lock, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '@/src/core/config';

interface RewardItem {
  day: number;
  name: string;
  type: 'zeny' | 'item';
  itemId?: string;
  quantity: number;
  icon: string;
  desc: string;
}

const REWARDS_LIST: RewardItem[] = [
  { day: 1, name: "Zeny Pemula", type: "zeny", quantity: 500, icon: "🪙", desc: "500 Zeny untuk belanja kebutuhan awal." },
  { day: 2, name: "Red Potion", type: "item", itemId: "potion_red", quantity: 5, icon: "🔴", desc: "5x Red Potion untuk memulihkan 150 HP." },
  { day: 3, name: "Zeny Prajurit", type: "zeny", quantity: 1000, icon: "🪙", desc: "1000 Zeny untuk upgrade perlengkapan." },
  { day: 4, name: "Blue Potion", type: "item", itemId: "potion_blue", quantity: 5, icon: "🔵", desc: "5x Blue Potion untuk memulihkan 50 MP." },
  { day: 5, name: "Zeny Ksatria", type: "zeny", quantity: 2000, icon: "🪙", desc: "2000 Zeny untuk persiapan petualangan besar." },
  { day: 6, name: "Green Potion", type: "item", itemId: "potion_green", quantity: 5, icon: "🟢", desc: "5x Green Potion untuk memulihkan HP & MP." },
  { day: 7, name: "Cincin Kekuatan", type: "item", itemId: "accessory_ring", quantity: 1, icon: "💍", desc: "Cincin legendaris penambah kekuatan fisik. ATK +15, HP +50." },
];

const ITEM_THUMBNAIL_MAP: Record<string, string> = {
  potion_red: "🔴",
  potion_blue: "🔵",
  potion_green: "🟢",
  accessory_ring: "/assets/characters/thumbnails/Sword.png", // fallback or use nice ring emoji
};

function RewardItemThumbnail({ reward, className = "h-[64px] w-[64px]" }: { reward: RewardItem; className?: string }) {
  if (reward.type === 'zeny') {
    return <div className={`${className} bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-[28px] shrink-0 shadow-inner select-none`}>🪙</div>;
  }
  const relativeUrl = ITEM_THUMBNAIL_MAP[reward.itemId || ""];
  if (!relativeUrl || relativeUrl.startsWith('http') || !relativeUrl.startsWith('/')) {
    return <div className={`${className} bg-[#fdf9f3] border border-dashed border-[#dfb76c]/30 rounded-2xl flex items-center justify-center text-[28px] shrink-0`}>{reward.icon}</div>;
  }
  return (
    <div className={`${className} bg-white border border-[#dfb76c]/40 rounded-2xl overflow-hidden flex items-center justify-center shadow-sm shrink-0 p-1`}>
      <img
        src={`${API_BASE_URL}${relativeUrl}`}
        className="w-full h-full object-contain"
        alt=""
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    </div>
  );
}

interface PlayerRewardsProps {
  playerStats: any;
  onClose: () => void;
  sendClaimDailyReward: () => void;
}

export function PlayerRewards({ playerStats, onClose, sendClaimDailyReward }: PlayerRewardsProps) {
  const [claimCooldownSeconds, setClaimCooldownSeconds] = useState(0);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);

  const checkInCount = playerStats.check_in_count ?? 0;
  const lastDailyClaimStr = playerStats.last_daily_claim;

  // Calculate cooldown countdown
  useEffect(() => {
    if (!lastDailyClaimStr) {
      setClaimCooldownSeconds(0);
      return;
    }

    const updateCooldown = () => {
      const lastClaimTime = new Date(lastDailyClaimStr).getTime();
      const nextClaimTime = lastClaimTime + 20 * 60 * 60 * 1000; // 20 hours cooldown
      const diffMs = nextClaimTime - Date.now();
      if (diffMs <= 0) {
        setClaimCooldownSeconds(0);
      } else {
        setClaimCooldownSeconds(Math.ceil(diffMs / 1000));
      }
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [lastDailyClaimStr]);

  // Listen to claims callback events from server
  useEffect(() => {
    const handleSuccess = () => {
      setClaimSuccess(true);
      setClaimError("");
      setTimeout(() => setClaimSuccess(false), 3000);
    };

    const handleFail = (e: Event) => {
      const errDetail = (e as CustomEvent).detail;
      setClaimError(errDetail?.error || "Gagal mengklaim reward");
      setTimeout(() => setClaimError(""), 4000);
    };

    window.addEventListener("reward_claimed_success", handleSuccess);
    window.addEventListener("reward_claim_failed", handleFail);

    return () => {
      window.removeEventListener("reward_claimed_success", handleSuccess);
      window.removeEventListener("reward_claim_failed", handleFail);
    };
  }, []);

  const nextDayToClaim = checkInCount + 1 > 7 ? 1 : checkInCount + 1;
  const isClaimable = claimCooldownSeconds <= 0;

  const formatCooldown = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClaimClick = () => {
    if (!isClaimable) return;
    sendClaimDailyReward();
  };

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] z-[9999] bg-[#ebdcb9]/40 backdrop-blur-sm flex flex-col font-sans text-[#4a3000] pointer-events-auto select-none overflow-hidden animate-in fade-in duration-200">
      
      {/* ── BACKGROUND PARCHMENT ── */}
      <div className="absolute inset-0 z-0 bg-[#fdf9f3] pointer-events-none" />

      {/* ── TOP HEADER BAR ── */}
      <div className="relative z-10 px-6 py-3.5 flex justify-between items-center border-b border-[#dfb76c]/30 bg-[#ebdcb9]/20 shrink-0 select-none">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#fdf9f3] hover:bg-[#ebdcb9] flex items-center justify-center text-[#4a3000] border border-[#dfb76c] active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-[#4a3000]" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-black tracking-wider uppercase text-[#4a3000] drop-shadow-sm">KEHADIRAN HARIAN</span>
            <span className="text-[9px] text-[#8c6b4f] font-bold uppercase tracking-widest bg-[#ebdcb9]/40 border border-[#dfb76c]/40 px-2 py-0.5 rounded-full ml-1">REWARDS</span>
          </div>
        </div>

        {/* Center: Gold/Zeny */}
        <div className="flex items-center gap-2 bg-[#ebdcb9]/35 border border-[#dfb76c]/40 px-5 py-1.5 rounded-full shadow-inner text-[#4a3000]">
          <span className="w-4.5 h-4.5 rounded-full bg-[#38bdf8] flex items-center justify-center text-[8.5px] font-black text-black shadow-sm">Z</span>
          <span className="text-xs font-black text-[#b88c42]">{(playerStats.gold ?? 0).toLocaleString()} Zeny</span>
        </div>

        {/* Right: Close Button */}
        <button 
          onClick={onClose}
          className="w-9 h-9 rounded-xl hover:bg-black/5 flex items-center justify-center text-[#8c6b4f] transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 items-stretch justify-center relative min-h-0 z-10 overflow-y-auto">
        
        {/* LEFT COLUMN: DAY HIGHLIGHT & CLAIM PANEL */}
        <div className="w-full md:w-[380px] bg-[#ebdcb9]/20 border-2 border-[#dfb76c]/60 rounded-3xl p-6 flex flex-col items-center justify-between shadow-sm shrink-0">
          <div className="w-full flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#dfb76c]/20 flex items-center justify-center mb-4 text-[#8c6b4f]">
              <Sparkles className="w-8 h-8 animate-pulse text-[#b88c42]" />
            </div>
            
            <h2 className="text-lg font-black tracking-wide text-[#5c3e16] mb-1">PETUALANGAN SETIAP HARI</h2>
            <p className="text-xs text-[#8c6b4f] leading-relaxed max-w-[280px]">Masuk ke game setiap hari untuk klaim hadiah premium dan percepat progres karaktermu.</p>
            
            {/* Divider */}
            <div className="w-full h-[1px] bg-[#dfb76c]/30 my-5" />

            {/* Current/Next Reward Showcase */}
            {(() => {
              const currentReward = REWARDS_LIST[nextDayToClaim - 1];
              return (
                <div className="w-full flex flex-col items-center bg-[#fdf9f3] border border-[#dfb76c]/40 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] text-[#8c6b4f] font-extrabold tracking-widest uppercase mb-2">HADIAH HARI INI (HARI {nextDayToClaim})</span>
                  <RewardItemThumbnail reward={currentReward} className="h-16 w-16 mb-2.5" />
                  <span className="text-sm font-black text-[#5c3e16]">{currentReward.name}</span>
                  <span className="text-xs text-[#8c6b4f] font-semibold mt-0.5">Jumlah: x{currentReward.quantity}</span>
                  <p className="text-[11px] text-[#8c6b4f]/80 mt-2 text-center max-w-[240px] italic">"{currentReward.desc}"</p>
                </div>
              );
            })()}
          </div>

          <div className="w-full mt-6">
            {claimError && (
              <div className="w-full py-2 px-3 mb-3 bg-red-100 border border-red-300 text-red-700 text-xs rounded-xl text-center font-bold animate-shake">
                ⚠️ {claimError}
              </div>
            )}
            {claimSuccess && (
              <div className="w-full py-2 px-3 mb-3 bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs rounded-xl text-center font-bold">
                🎉 Reward Berhasil Diklaim!
              </div>
            )}

            {isClaimable ? (
              <button
                onClick={handleClaimClick}
                className="w-full py-3.5 bg-gradient-to-b from-[#dfb76c] to-[#b88c42] hover:brightness-110 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-md border-b-4 border-[#8c6b4f] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                KLAIM HADIAH HARI {nextDayToClaim}
              </button>
            ) : (
              <div className="w-full flex flex-col items-center">
                <button
                  disabled
                  className="w-full py-3.5 bg-zinc-200 text-zinc-400 font-black text-xs uppercase tracking-widest rounded-2xl border-b-4 border-zinc-300 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" /> SUDAH DIKLAIM HARI INI
                </button>
                <span className="text-[10px] text-[#8c6b4f] font-bold tracking-wider mt-2.5">
                  RESET DALAM: <span className="font-mono text-xs font-black text-[#5c3e16]">{formatCooldown(claimCooldownSeconds)}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: 7-DAY CALENDAR GRID */}
        <div className="flex-1 bg-[#ebdcb9]/10 border border-[#dfb76c]/40 rounded-3xl p-6 flex flex-col justify-start shadow-inner">
          <div className="flex justify-between items-center mb-5">
            <span className="text-xs font-black tracking-wider text-[#5c3e16] uppercase">KALENDER REWARD 7 HARI</span>
            <span className="text-[10px] font-bold text-[#8c6b4f]">TOTAL CHECK-IN: {checkInCount} HARI</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto">
            {REWARDS_LIST.map((reward) => {
              const isClaimed = reward.day <= checkInCount;
              const isActive = reward.day === nextDayToClaim && isClaimable;
              const isLocked = reward.day > nextDayToClaim || (reward.day === nextDayToClaim && !isClaimable);

              return (
                <div 
                  key={reward.day}
                  className={`relative flex flex-col items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 select-none ${
                    isClaimed 
                      ? "bg-[#ebdcb9]/15 border-dashed border-[#dfb76c]/40 opacity-70"
                      : isActive
                        ? "bg-[#fdf9f3] border-amber-500 shadow-md scale-[1.02] ring-2 ring-amber-500/20"
                        : "bg-[#fdf9f3]/60 border-[#dfb76c]/30"
                  }`}
                >
                  {/* Top Badge: Day Count */}
                  <div className="w-full flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-[#8c6b4f] uppercase">HARI {reward.day}</span>
                    {isClaimed && (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm">
                        <Check className="w-2.5 h-2.5 stroke-[4]" />
                      </span>
                    )}
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[7.5px] uppercase tracking-wider animate-pulse">SIAP</span>
                    )}
                    {isLocked && (
                      <span className="w-4 h-4 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-400 border border-zinc-300 shadow-sm">
                        <Lock className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Icon & Details */}
                  <div className="flex-1 flex flex-col items-center justify-center my-2 text-center">
                    <RewardItemThumbnail reward={reward} className="h-12 w-12 mb-2" />
                    <span className="text-xs font-extrabold text-[#5c3e16] line-clamp-1">{reward.name}</span>
                    <span className="text-[10px] text-[#8c6b4f] font-semibold mt-0.5">Jumlah: x{reward.quantity}</span>
                  </div>

                  {/* Hover info tooltip details */}
                  <div className="w-full mt-2 text-center text-[8.5px] text-[#8c6b4f]/80 leading-snug border-t border-[#dfb76c]/10 pt-1.5 line-clamp-2">
                    {reward.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
