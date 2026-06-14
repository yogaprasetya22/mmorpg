/** Character status modal with premium vintage-parchment RPG styling. */
'use client';

import { useState, useEffect } from 'react';
import { Activity, X, ShieldAlert } from 'lucide-react';
import { STAT_ATTRIBUTES, TALENT_ATTRIBUTES, COMBAT_STAT_FIELDS } from '../ArenaClient.constants';

interface CharacterStatsModalProps {
  playerStats: any;
  onClose: () => void;
  sendDistributeStat: (key: string, amount: number) => void;
}

export function CharacterStatsModal({ 
  playerStats: initialPlayerStats, 
  onClose, 
  sendDistributeStat
}: CharacterStatsModalProps) {
  const [playerStats, setPlayerStats] = useState(initialPlayerStats);
  const [activeTab, setActiveTab] = useState<'primary' | 'talent' | 'combat'>('primary');
  
  useEffect(() => {
    document.body.classList.add('modal-open');
    const handleStatsUpdate = (e: Event) => {
      const nextStats = (e as CustomEvent).detail;
      if (nextStats) {
        setPlayerStats(nextStats);
      }
    };
    window.addEventListener("player_stats_updated", handleStatsUpdate);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener("player_stats_updated", handleStatsUpdate);
    };
  }, []);

  if (!playerStats) return null;

  const isLevel200 = (playerStats.level ?? 1) >= 200;

  return (
    <div 
      className="fixed inset-0 w-screen h-screen z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto font-sans"
      onClick={onClose}
    >
      <div 
        className="w-[490px] max-w-[94vw] bg-[#fdf9f3] border-[3px] border-[#ebdcb9] p-6 rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.55)] flex flex-col gap-4 text-[#4a3000] border-t-8 border-t-[#b88c42]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#dfb76c]/30 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#dfb76c]/10 border border-[#dfb76c] rounded-2xl flex items-center justify-center text-[#b88c42]">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-base font-black tracking-wider uppercase text-[#4a3000] leading-none">STATUS KARAKTER</h3>
              <span className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-widest mt-1">RPG Player Attributes Panel</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#fdf9f3] hover:bg-[#ebdcb9] text-zinc-500 hover:text-black flex items-center justify-center border border-zinc-300 transition-all active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Brief Box */}
        <div className="bg-[#ebdcb9]/20 border border-[#dfb76c]/40 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex flex-col gap-0.5">
            <div className="text-base font-black text-[#4a3000]">{playerStats.username || "Traveler"}</div>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1.5">
              Kelas: <span className="text-[#a855f7] font-black">{playerStats.class || "Beginner"}</span>
              <span className="text-[#dfb76c] mx-2">|</span>
              Level: <span className="text-[#eab308] font-black">{playerStats.level ?? 1}</span>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-0.5">
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
              {activeTab === 'talent' ? 'Talent Poin' : 'Stat Poin'}
            </span>
            <span className="text-3xl font-black text-[#60a5fa] drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] leading-none mt-1">
              {activeTab === 'talent' ? (playerStats.talent_points ?? 0) : (playerStats.stat_points ?? 0)}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border border-[#dfb76c]/30 p-1 bg-[#ebdcb9]/30 rounded-2xl">
          <button
            onClick={() => setActiveTab('primary')}
            className={`py-2 text-center text-[9.5px] font-black uppercase tracking-wider rounded-xl flex-1 transition duration-200 ${
              activeTab === 'primary' 
                ? 'bg-gradient-to-b from-[#e3c598] to-[#b88c42] text-[#4a3000] border border-[#8c5b1b]/30 shadow-md' 
                : 'text-zinc-500 hover:text-black hover:bg-white/40'
            }`}
          >
            Stats
          </button>
          <button
            onClick={() => setActiveTab('talent')}
            className={`py-2 text-center text-[9.5px] font-black uppercase tracking-wider rounded-xl flex-1 transition duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'talent' 
                ? 'bg-gradient-to-b from-[#e3c598] to-[#b88c42] text-[#4a3000] border border-[#8c5b1b]/30 shadow-md' 
                : 'text-zinc-500 hover:text-black hover:bg-white/40'
            }`}
          >
            Talent
          </button>
          <button
            onClick={() => setActiveTab('combat')}
            className={`py-2 text-center text-[9.5px] font-black uppercase tracking-wider rounded-xl flex-1 transition duration-200 ${
              activeTab === 'combat' 
                ? 'bg-gradient-to-b from-[#e3c598] to-[#b88c42] text-[#4a3000] border border-[#8c5b1b]/30 shadow-md' 
                : 'text-zinc-500 hover:text-black hover:bg-white/40'
            }`}
          >
            Tempur
          </button>
        </div>

        {/* Dynamic Tab Content Area */}
        <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {activeTab === 'primary' && (
            <>
              <div className="flex justify-between items-center border-b border-[#dfb76c]/20 pb-1 mt-1 shrink-0">
                <span className="text-[9.5px] font-black text-zinc-500 uppercase tracking-widest">
                  Atribut Utama (Batas: {isLevel200 ? '130' : '99'})
                </span>
                {playerStats.stat_points > 0 && (
                  <span className="text-blue-500 font-black tracking-wider text-[9px] animate-pulse uppercase">
                    Alokasikan Poin!
                  </span>
                )}
              </div>
              
              {STAT_ATTRIBUTES.map((stat) => {
                const baseVal = playerStats[`base_${stat.key}`] ?? playerStats[stat.key] ?? 10;
                const limitVal = isLevel200 ? 130 : 99;
                const canIncrease = playerStats.stat_points > 0 && baseVal < limitVal;
                
                return (
                  <div key={stat.key} className="flex items-center justify-between p-3 bg-[#fdf9f3] border border-[#dfb76c]/40 rounded-2xl hover:shadow-md transition-shadow">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-black text-[#4a3000]">{stat.label}</span>
                        <span className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-wider">{stat.name}</span>
                      </div>
                      <span className="text-[9.5px] text-zinc-500 leading-normal mt-0.5">{stat.desc}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-[#4a3000] tracking-wide">
                        {baseVal}
                        {playerStats[`bonus_${stat.key}`] !== undefined && playerStats[`bonus_${stat.key}`] > 0 && (
                          <span className="text-emerald-600 font-bold ml-1">+{playerStats[`bonus_${stat.key}`]}</span>
                        )}
                      </span>
                      
                      {canIncrease && (
                        <button
                          onClick={() => sendDistributeStat(stat.key, 1)}
                          className="w-6 h-6 rounded-full bg-[#dfb76c] hover:bg-[#b88c42] text-[#4a3000] flex items-center justify-center font-bold text-xs border border-[#8c5b1b]/30 shadow-md active:scale-90 transition duration-150"
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {activeTab === 'talent' && (
            <>
              {!isLevel200 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-2.5 bg-[#ebdcb9]/15 border border-dashed border-[#dfb76c] rounded-2xl">
                  <ShieldAlert className="w-8 h-8 text-[#b88c42] animate-bounce" />
                  <div className="text-xs font-black text-[#4a3000] uppercase tracking-wider">TALENT LOCK</div>
                  <p className="text-[10px] text-zinc-500 max-w-[80%] leading-relaxed">
                    Karakter Anda harus mencapai minimal <span className="text-purple-600 font-bold">Level 200</span> untuk membuka Sistem Talent 4th Class Traits & melampaui batas stat 99 poin.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center border-b border-[#dfb76c]/20 pb-1 mt-1 shrink-0">
                    <span className="text-[9.5px] font-black text-zinc-500 uppercase tracking-widest">
                      Atribut Talent 4th Class (Batas: 100)
                    </span>
                    {playerStats.talent_points > 0 && (
                      <span className="text-purple-600 font-black tracking-wider text-[9px] animate-pulse uppercase">
                        Alokasikan Poin!
                      </span>
                    )}
                  </div>
                  
                  {TALENT_ATTRIBUTES.map((stat) => {
                    const baseVal = playerStats[`base_${stat.key}`] ?? playerStats[stat.key] ?? 0;
                    const canIncrease = playerStats.talent_points > 0 && baseVal < 100;
                    
                    return (
                      <div key={stat.key} className="flex items-center justify-between p-3 bg-[#fdf9f3] border border-[#dfb76c]/40 rounded-2xl hover:shadow-md transition-shadow">
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-black text-[#7e22ce]">{stat.label}</span>
                            <span className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-wider">{stat.name}</span>
                          </div>
                          <span className="text-[9.5px] text-zinc-500 leading-normal mt-0.5">{stat.desc}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-[#4a3000] tracking-wide">
                            {baseVal}
                            {playerStats[`bonus_${stat.key}`] !== undefined && playerStats[`bonus_${stat.key}`] > 0 && (
                              <span className="text-[#7e22ce] font-bold ml-1">+{playerStats[`bonus_${stat.key}`]}</span>
                            )}
                          </span>
                          
                          {canIncrease && (
                            <button
                              onClick={() => sendDistributeStat(stat.key, 1)}
                              className="w-6 h-6 rounded-full bg-[#dfb76c] hover:bg-[#b88c42] text-[#4a3000] flex items-center justify-center font-bold text-xs border border-[#8c5b1b]/30 shadow-md active:scale-90 transition duration-150"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {activeTab === 'combat' && (() => {
            const rawASPD = playerStats.aspd ?? 150;
            const roASPD = 130 + (Math.min(1000, Math.max(0, rawASPD)) / 1000) * 63;
            const hitsPerSec = 1 + (rawASPD / 125);
            const isMaxASPD = rawASPD >= 1000;

            return (
              <>
                <div className="flex justify-between items-center border-b border-[#dfb76c]/20 pb-1 mt-1 shrink-0">
                  <span className="text-[9.5px] font-black text-zinc-500 uppercase tracking-widest">
                    Kecepatan Serang (ASPD)
                  </span>
                  {isMaxASPD && (
                    <span className="bg-gradient-to-r from-amber-400 to-red-500 text-black text-[8px] font-extrabold px-2 py-0.5 rounded-full animate-pulse tracking-wider">
                      ASPD MAX (193)
                    </span>
                  )}
                </div>

                {/* Outstanding ASPD Panel */}
                <div className="bg-[#ebdcb9]/20 border border-[#dfb76c]/40 p-4 rounded-2xl flex flex-col gap-2.5 mb-2 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8.5px] font-bold text-zinc-500 uppercase tracking-widest">ASPD Level (RO Scale)</span>
                      <span className="text-xl font-black text-[#4a3000] tracking-tight flex items-baseline gap-1.5">
                        {roASPD.toFixed(0)} <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">/ 193 Cap</span>
                      </span>
                    </div>
                    <div className="text-right flex flex-col gap-0.5">
                      <span className="text-[8.5px] font-bold text-zinc-500 uppercase tracking-widest">Speed Rate</span>
                      <span className="text-sm font-black text-[#e07b00]">{rawASPD.toFixed(0)}%</span>
                      <span className="text-[8px] font-bold text-zinc-500">{hitsPerSec.toFixed(1)} hit / detik</span>
                    </div>
                  </div>
                  
                  {/* ASPD progress bar */}
                  <div className="w-full h-1.5 bg-[#fdf9f3] rounded-full overflow-hidden border border-[#dfb76c]/20">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        isMaxASPD 
                          ? 'bg-gradient-to-r from-[#dfb76c] via-[#ffb547] to-[#e07b00]' 
                          : 'bg-[#2cb835]'
                      }`}
                      style={{ width: `${(rawASPD / 1000) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="text-[9.5px] font-black text-zinc-500 uppercase tracking-widest border-b border-[#dfb76c]/20 pb-1 mt-2 shrink-0">
                  Statistik Tempur Lainnya
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {COMBAT_STAT_FIELDS.map((item, i) => {
                    let displayValue: string | number;
                    const rawValue = playerStats[item.key] ?? item.fallback;
                    if (item.format === "percent") {
                      displayValue = `${((rawValue as number) * 100).toFixed(1)}%`;
                    } else if (item.format === "percent_direct") {
                      displayValue = `${(rawValue as number).toFixed(1)}%`;
                    } else if (item.format === "cast_reduction") {
                      const reductionPct = (1.0 - (rawValue as number)) * 100;
                      displayValue = `${reductionPct.toFixed(1)}%`;
                    } else if (item.format === "decimal") {
                      displayValue = (rawValue as number).toFixed(1);
                    } else {
                      displayValue = Math.round(rawValue as number);
                    }
                    return (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-[#fdf9f3] border border-[#dfb76c]/40 rounded-2xl hover:shadow-md transition-shadow">
                        <span className="text-[8.5px] font-bold text-zinc-500 uppercase tracking-wider">{item.label}</span>
                        <span className="text-xs font-black text-[#4a3000] tracking-wide">{displayValue}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
