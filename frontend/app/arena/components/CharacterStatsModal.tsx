/** Character status modal with RPG stat distribution panel, inventory slots, shop, and blacksmith refine system. */
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
      className="fixed inset-0 w-screen h-screen z-[9999] bg-black/65 backdrop-blur-sm flex items-center justify-center pointer-events-auto font-sans"
      onClick={onClose}
    >
      <div 
        className="w-[520px] max-w-[92vw] bg-[#fcf8f2] border-4 border-[#8e6a45] p-6 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.6)] flex flex-col gap-5 animate-in zoom-in-95 duration-200 text-[#4a3000]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#b88c42]/30 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-[#dfb76c]/20 border border-[#b88c42] rounded-xl flex items-center justify-center text-[#8c5b1b]">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-md font-black tracking-tight uppercase text-[#5c3e16] leading-none">STATUS KARAKTER</h3>
              <span className="text-[9px] text-[#8c6b4f] font-bold uppercase tracking-widest mt-1">RPG Player Attributes Panel</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#e6dbcc] hover:bg-[#dfb76c] hover:text-black text-[#5c3e16] flex items-center justify-center border border-[#b88c42]/40 transition-all active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Brief */}
        <div className="bg-[#ebdcb9] border border-[#b88c42] p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex flex-col gap-0.5">
            <div className="text-sm font-black text-[#5c3e16]">{playerStats.username || "Traveler"}</div>
            <div className="text-[9.5px] text-[#7a5932] font-bold uppercase tracking-wider mt-0.5">
              Kelas: <span className="text-[#a855f7] font-extrabold">{playerStats.class || "Beginner"}</span>
              <span className="text-[#b88c42]/60 mx-1.5">|</span>
              Level: <span className="text-[#c79800] font-black">{playerStats.level ?? 1}</span>
            </div>
          </div>
          <div className="text-right flex flex-col gap-0.5">
            {activeTab === 'talent' ? (
              <>
                <div className="text-[8.5px] font-black text-[#8c6b4f] uppercase tracking-widest">Talent Poin</div>
                <div className="text-xl font-black text-[#7e22ce] animate-pulse">{playerStats.talent_points ?? 0}</div>
              </>
            ) : (
              <>
                <div className="text-[8.5px] font-black text-[#8c6b4f] uppercase tracking-widest">Stat Poin</div>
                <div className="text-xl font-black text-[#2563eb] animate-pulse">{playerStats.stat_points ?? 0}</div>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 border border-[#b88c42]/30 p-1 gap-1 bg-[#e6dbcc] rounded-xl">
          <button
            onClick={() => setActiveTab('primary')}
            className={`py-2 text-center text-[9px] font-black uppercase tracking-wider rounded-lg transition duration-200 ${
              activeTab === 'primary' 
                ? 'bg-gradient-to-b from-[#dfb76c] to-[#b88c42] text-black border border-[#8c5b1b]/50 shadow-sm' 
                : 'text-[#8c5b1b] hover:text-[#5c3e16] hover:bg-[#f3e9d7]'
            }`}
          >
            Stats
          </button>
          <button
            onClick={() => setActiveTab('talent')}
            className={`py-2 text-center text-[9px] font-black uppercase tracking-wider rounded-lg transition duration-200 flex items-center justify-center gap-1 ${
              activeTab === 'talent' 
                ? 'bg-gradient-to-b from-[#a855f7] to-[#7e22ce] text-white border border-[#581c87]/50 shadow-sm' 
                : 'text-[#8c5b1b] hover:text-[#5c3e16] hover:bg-[#f3e9d7]'
            }`}
          >
            Talent
          </button>
          <button
            onClick={() => setActiveTab('combat')}
            className={`py-2 text-center text-[9px] font-black uppercase tracking-wider rounded-lg transition duration-200 ${
              activeTab === 'combat' 
                ? 'bg-[#8c6b4f] text-white border border-[#5c3e16]/50 shadow-sm' 
                : 'text-[#8c5b1b] hover:text-[#5c3e16] hover:bg-[#f3e9d7]'
            }`}
          >
            Tempur
          </button>
        </div>

        {/* Dynamic Tab Content */}
        {/* Dynamic Tab Content */}
        <div className="flex flex-col gap-2.5 max-h-[42vh] overflow-y-auto pr-1">
          {activeTab === 'primary' && (
            <>
              <h4 className="text-[8.5px] font-black text-[#8c6b4f] uppercase tracking-widest border-b border-[#b88c42]/20 pb-1 flex justify-between">
                <span>Atribut Utama (Batas: {isLevel200 ? '130' : '99'})</span>
                {playerStats.stat_points > 0 && <span className="text-[#2563eb] font-black animate-pulse">Alokasikan Poin!</span>}
              </h4>
              
              {STAT_ATTRIBUTES.map((stat) => {
                const baseVal = playerStats[`base_${stat.key}`] ?? playerStats[stat.key] ?? 10;
                const limitVal = isLevel200 ? 130 : 99;
                const canIncrease = playerStats.stat_points > 0 && baseVal < limitVal;
                
                return (
                  <div key={stat.key} className="flex items-center justify-between p-2.5 bg-[#f3e9d7] border border-[#d2be9f] rounded-xl hover:border-[#b88c42] transition-colors">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-black text-[#5c3e16]">{stat.label}</span>
                        <span className="text-[9px] text-[#8c6b4f] font-bold uppercase tracking-wider">{stat.name}</span>
                      </div>
                      <span className="text-[9px] text-[#7a5932] leading-normal">{stat.desc}</span>
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black text-[#5c3e16] tracking-wide">
                        {baseVal}
                        {playerStats[`bonus_${stat.key}`] !== undefined && playerStats[`bonus_${stat.key}`] > 0 && (
                          <span className="text-green-600 font-bold ml-1">+{playerStats[`bonus_${stat.key}`]}</span>
                        )}
                      </span>
                      
                      {canIncrease && (
                        <button
                          onClick={() => sendDistributeStat(stat.key, 1)}
                          className="w-6 h-6 rounded-lg bg-gradient-to-b from-[#dfb76c] to-[#b88c42] hover:brightness-110 text-[#5c3e16] border border-[#8c5b1b]/50 flex items-center justify-center font-bold text-xs active:scale-90 transition duration-150"
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
                <div className="flex flex-col items-center justify-center py-6 text-center gap-2.5 bg-[#ebdcb9]/40 border border-dashed border-[#b88c42]/40 rounded-2xl">
                  <ShieldAlert className="w-8 h-8 text-[#8c6b4f] animate-bounce" />
                  <div className="text-xs font-black text-[#5c3e16] uppercase tracking-wider">TALENT LOCK</div>
                  <p className="text-[10px] text-[#7a5932] max-w-[80%] leading-relaxed">
                    Karakter Anda harus mencapai minimal <span className="text-[#7e22ce] font-bold">Level 200</span> untuk membuka Sistem Talent 4th Class Traits & melampaui batas stat 99 poin.
                  </p>
                </div>
              ) : (
                <>
                  <h4 className="text-[8.5px] font-black text-[#8c6b4f] uppercase tracking-widest border-b border-[#b88c42]/20 pb-1 flex justify-between">
                    <span>Atribut Talent 4th Class (Batas: 100)</span>
                    {playerStats.talent_points > 0 && <span className="text-[#7e22ce] font-black animate-pulse">Alokasikan Poin!</span>}
                  </h4>
                  
                  {TALENT_ATTRIBUTES.map((stat) => {
                    const baseVal = playerStats[`base_${stat.key}`] ?? playerStats[stat.key] ?? 0;
                    const canIncrease = playerStats.talent_points > 0 && baseVal < 100;
                    
                    return (
                      <div key={stat.key} className="flex items-center justify-between p-2.5 bg-[#f3e9d7] border border-[#d2be9f] rounded-xl hover:border-[#b88c42] transition-colors">
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-black text-[#7e22ce]">{stat.label}</span>
                            <span className="text-[9px] text-[#8c6b4f] font-bold uppercase tracking-wider">{stat.name}</span>
                          </div>
                          <span className="text-[9px] text-[#7a5932] leading-normal">{stat.desc}</span>
                        </div>
                        
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-black text-[#5c3e16] tracking-wide">
                            {baseVal}
                            {playerStats[`bonus_${stat.key}`] !== undefined && playerStats[`bonus_${stat.key}`] > 0 && (
                              <span className="text-[#7e22ce] font-bold ml-1">+{playerStats[`bonus_${stat.key}`]}</span>
                            )}
                          </span>
                          
                          {canIncrease && (
                            <button
                              onClick={() => sendDistributeStat(stat.key, 1)}
                              className="w-6 h-6 rounded-lg bg-gradient-to-b from-[#a855f7] to-[#7e22ce] hover:brightness-110 text-white flex items-center justify-center font-bold text-xs active:scale-90 transition duration-150"
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
                <h4 className="text-[8.5px] font-black text-[#8c6b4f] uppercase tracking-widest border-b border-[#b88c42]/20 pb-1 mb-1.5 flex justify-between items-center">
                  <span>Kecepatan Serang (ASPD)</span>
                  {isMaxASPD && (
                    <span className="bg-gradient-to-r from-amber-400 to-red-500 text-black text-[8px] font-extrabold px-2 py-0.5 rounded-full animate-pulse tracking-wider shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                      ASPD MAX (193)
                    </span>
                  )}
                </h4>

                {/* Outstanding ASPD Panel */}
                <div className="bg-[#ebdcb9] border border-[#b88c42] p-4 rounded-2xl flex flex-col gap-2.5 mb-3 shadow-inner">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black text-[#8c6b4f] uppercase tracking-widest">ASPD Level (RO Scale)</span>
                      <span className="text-2xl font-black text-[#5c3e16] tracking-tight flex items-baseline gap-1.5">
                        {roASPD.toFixed(0)} <span className="text-[10px] text-[#8c6b4f] font-bold uppercase tracking-wider">/ 193 Cap</span>
                      </span>
                    </div>
                    <div className="text-right flex flex-col gap-0.5">
                      <span className="text-[9px] font-black text-[#8c6b4f] uppercase tracking-widest">Speed Rate</span>
                      <span className="text-md font-black text-[#e07b00]">{rawASPD.toFixed(0)}%</span>
                      <span className="text-[8.5px] font-bold text-[#8c6b4f]">{hitsPerSec.toFixed(1)} hit / detik</span>
                    </div>
                  </div>
                  
                  {/* ASPD progress bar */}
                  <div className="w-full h-1.5 bg-[#fcf8f2] rounded-full overflow-hidden border border-[#b88c42]/20">
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

                <h4 className="text-[8.5px] font-black text-[#8c6b4f] uppercase tracking-widest border-b border-[#b88c42]/20 pb-1">Statistik Tempur Lainnya</h4>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
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
                      <div key={i} className="flex items-center justify-between p-2 bg-[#f3e9d7] border border-[#d2be9f] rounded-xl hover:bg-[#ebdcb9]/40 transition-colors">
                        <span className="text-[9px] font-black text-[#8c6b4f] uppercase tracking-wider">{item.label}</span>
                        <span className="text-xs font-black text-[#5c3e16] tracking-wide">{displayValue}</span>
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
