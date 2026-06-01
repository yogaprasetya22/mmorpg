/** Character status modal with RPG stat distribution panel. */
'use client';

import { useState } from 'react';
import { Activity, X, Award, ShieldAlert } from 'lucide-react';
import { STAT_ATTRIBUTES, TALENT_ATTRIBUTES, COMBAT_STAT_FIELDS } from '../ArenaClient.constants';

interface CharacterStatsModalProps {
  playerStats: any;
  onClose: () => void;
  sendDistributeStat: (key: string, amount: number) => void;
}

export function CharacterStatsModal({ playerStats, onClose, sendDistributeStat }: CharacterStatsModalProps) {
  const [activeTab, setActiveTab] = useState<'primary' | 'talent' | 'combat'>('primary');
  
  if (!playerStats) return null;

  const isLevel200 = (playerStats.level ?? 1) >= 200;

  return (
    <div 
      className="fixed inset-0 w-screen h-screen z-[9999] bg-black/65 backdrop-blur-sm flex items-center justify-center pointer-events-auto font-sans"
      onClick={onClose}
    >
      <div 
        className="w-[500px] max-w-[92vw] bg-zinc-950/85 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-cyan-500/15 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-md font-black tracking-tight uppercase text-white leading-none">STATUS KARAKTER</h3>
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">RPG Player Attributes Panel</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900/60 hover:bg-zinc-800 hover:text-white text-zinc-500 flex items-center justify-center transition-all active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Brief */}
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="text-sm font-black text-white">{playerStats.username || "Traveler"}</div>
            <div className="text-[9.5px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
              Kelas: <span className="text-cyan-400">{playerStats.class || "Beginner"}</span>
              <span className="text-zinc-600 mx-1.5">|</span>
              Level: <span className="text-amber-400">{playerStats.level ?? 1}</span>
            </div>
          </div>
          <div className="text-right flex flex-col gap-0.5">
            {activeTab === 'talent' ? (
              <>
                <div className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest">Talent Poin</div>
                <div className="text-xl font-black text-indigo-400 animate-pulse">{playerStats.talent_points ?? 0}</div>
              </>
            ) : (
              <>
                <div className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest">Stat Poin</div>
                <div className="text-xl font-black text-cyan-400 animate-pulse">{playerStats.stat_points ?? 0}</div>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 p-0.5 gap-1 bg-zinc-900/40 rounded-xl">
          <button
            onClick={() => setActiveTab('primary')}
            className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider rounded-lg transition duration-200 ${
              activeTab === 'primary' 
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Utama (1-199)
          </button>
          <button
            onClick={() => setActiveTab('talent')}
            className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider rounded-lg transition duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'talent' 
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Award className="w-3 h-3" /> Talent (200+)
          </button>
          <button
            onClick={() => setActiveTab('combat')}
            className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider rounded-lg transition duration-200 ${
              activeTab === 'combat' 
                ? 'bg-zinc-800 text-white shadow-md' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Stat Tempur
          </button>
        </div>

        {/* Dynamic Tab Content */}
        <div className="flex flex-col gap-2.5 max-h-[35vh] overflow-y-auto pr-1">
          {activeTab === 'primary' && (
            <>
              <h4 className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-1 flex justify-between">
                <span>Atribut Utama (Batas: {isLevel200 ? '130' : '99'})</span>
                {playerStats.stat_points > 0 && <span className="text-cyan-400 font-black animate-pulse">Alokasikan Poin!</span>}
              </h4>
              
              {STAT_ATTRIBUTES.map((stat) => {
                const baseVal = playerStats[`base_${stat.key}`] ?? playerStats[stat.key] ?? 10;
                const limitVal = isLevel200 ? 130 : 99;
                const canIncrease = playerStats.stat_points > 0 && baseVal < limitVal;
                
                return (
                  <div key={stat.key} className="flex items-center justify-between p-2.5 bg-zinc-900/30 border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-black text-white">{stat.label}</span>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{stat.name}</span>
                      </div>
                      <span className="text-[9px] text-zinc-500 leading-normal">{stat.desc}</span>
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black text-white tracking-wide">
                        {baseVal}
                        {playerStats[`bonus_${stat.key}`] !== undefined && playerStats[`bonus_${stat.key}`] > 0 && (
                          <span className="text-emerald-400 font-bold ml-1">+{playerStats[`bonus_${stat.key}`]}</span>
                        )}
                      </span>
                      
                      {canIncrease && (
                        <button
                          onClick={() => sendDistributeStat(stat.key, 1)}
                          className="w-6 h-6 rounded-lg bg-gradient-to-b from-cyan-400 to-indigo-600 hover:brightness-110 text-white flex items-center justify-center font-bold text-xs active:scale-90 transition duration-150"
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
                <div className="flex flex-col items-center justify-center py-6 text-center gap-2.5 bg-zinc-900/20 border border-dashed border-white/10 rounded-2xl">
                  <ShieldAlert className="w-8 h-8 text-zinc-600 animate-bounce" />
                  <div className="text-xs font-black text-zinc-400 uppercase tracking-wider">TALENT LOCK</div>
                  <p className="text-[10px] text-zinc-500 max-w-[80%] leading-relaxed">
                    Karakter Anda harus mencapai minimal <span className="text-indigo-400 font-bold">Level 200</span> untuk membuka Sistem Talent 4th Class Traits & melampaui batas stat 99 poin.
                  </p>
                </div>
              ) : (
                <>
                  <h4 className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-1 flex justify-between">
                    <span>Atribut Talent 4th Class (Batas: 100)</span>
                    {playerStats.talent_points > 0 && <span className="text-indigo-400 font-black animate-pulse">Alokasikan Poin!</span>}
                  </h4>
                  
                  {TALENT_ATTRIBUTES.map((stat) => {
                    const baseVal = playerStats[`base_${stat.key}`] ?? playerStats[stat.key] ?? 0;
                    const canIncrease = playerStats.talent_points > 0 && baseVal < 100;
                    
                    return (
                      <div key={stat.key} className="flex items-center justify-between p-2.5 bg-zinc-900/30 border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-black text-indigo-400">{stat.label}</span>
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{stat.name}</span>
                          </div>
                          <span className="text-[9px] text-zinc-500 leading-normal">{stat.desc}</span>
                        </div>
                        
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-black text-white tracking-wide">
                            {baseVal}
                            {playerStats[`bonus_${stat.key}`] !== undefined && playerStats[`bonus_${stat.key}`] > 0 && (
                              <span className="text-indigo-400 font-bold ml-1">+{playerStats[`bonus_${stat.key}`]}</span>
                            )}
                          </span>
                          
                          {canIncrease && (
                            <button
                              onClick={() => sendDistributeStat(stat.key, 1)}
                              className="w-6 h-6 rounded-lg bg-gradient-to-b from-indigo-400 to-purple-600 hover:brightness-110 text-white flex items-center justify-center font-bold text-xs active:scale-90 transition duration-150"
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

          {activeTab === 'combat' && (
            <>
              <h4 className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-1">Statistik Tempur</h4>
              <div className="grid grid-cols-2 gap-2">
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
                    <div key={i} className="flex items-center justify-between p-2 bg-white/[0.01] border border-white/5 rounded-xl">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">{item.label}</span>
                      <span className="text-xs font-black text-white tracking-wide">{displayValue}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
