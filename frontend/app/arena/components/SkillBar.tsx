/** Bottom-right skill bar with 4 numbered skill slots, auto-battle toggle, and main attack button. */
'use client';

import { Sword, Shield, Zap, Sparkles, Target, RefreshCw } from 'lucide-react';

interface SkillBarProps {
  selectedCharacter: any;
  isAutoMode: boolean;
  setIsAutoMode: (v: (prev: boolean) => boolean) => void;
}

export function SkillBar({ selectedCharacter, isAutoMode, setIsAutoMode }: SkillBarProps) {
  if (!selectedCharacter) return null;

  const handleAttackDispatch = () => {
    const e = new MouseEvent("mousedown", { button: 0 });
    document.dispatchEvent(e);
    setTimeout(() => document.dispatchEvent(new MouseEvent("mouseup", { button: 0 })), 50);
  };

  const handleSkillDispatch = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ" }));
  };

  const handleSlotClick = (num: number) => {
    if (num === 1) {
      handleAttackDispatch();
    } else if (num === 2) {
      handleSkillDispatch();
    }
  };

  const skills = [
    { num: 1, icon: <Sword className="w-5 h-5" />, color: "from-amber-500 to-orange-600", glow: "rgba(245,158,11,0.5)", label: "ATK" },
    { num: 2, icon: <Zap className="w-5 h-5" />, color: "from-cyan-500 to-blue-600", glow: "rgba(6,182,212,0.5)", label: "SKL" },
    { num: 3, icon: <Sparkles className="w-5 h-5" />, color: "from-purple-500 to-indigo-600", glow: "rgba(168,85,247,0.5)", label: "PSV" },
    { num: 4, icon: <Shield className="w-5 h-5" />, color: "from-emerald-500 to-teal-600", glow: "rgba(16,185,129,0.5)", label: "DEF" },
  ];

  return (
    <div className="absolute right-3 bottom-14 flex flex-col items-end gap-2 pointer-events-auto">
      {/* Top row: 4 numbered skill slots */}
      <div className="flex gap-1.5">
        {skills.map(s => (
          <div key={s.num} className="relative flex flex-col items-center gap-0.5">
            <button
              className={`w-[52px] h-[52px] rounded-xl bg-gradient-to-br ${s.color} border border-white/20 flex items-center justify-center text-white active:scale-95 transition-all shadow-lg`}
              style={{ boxShadow: `0 0 12px ${s.glow}` }}
              onClick={() => handleSlotClick(s.num)}
            >
              {s.icon}
            </button>
            <span className="absolute top-0.5 left-1 text-[8px] font-black text-white/70">{s.num}</span>
            <span className="text-[7px] font-black text-zinc-400 uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Bottom row: AUTO + big skill button */}
      <div className="flex items-end gap-2">
        {/* AUTO battle */}
        <button
          onClick={() => setIsAutoMode(v => !v)}
          className={`flex flex-col items-center justify-center w-[48px] h-[48px] rounded-full border-2 transition-all ${isAutoMode ? "bg-emerald-500/30 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.6)]" : "bg-black/50 border-white/20"}`}
        >
          <span className={`text-[9px] font-black tracking-wider ${isAutoMode ? "text-emerald-300 animate-pulse" : "text-zinc-500"}`}>AUTO</span>
        </button>

        {/* Main attack big button */}
        <button
          onClick={handleAttackDispatch}
          className="relative w-[76px] h-[76px] rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 border-2 border-white/25 active:scale-95 flex items-center justify-center text-white shadow-2xl transition-all hover:brightness-110 group"
          style={{ boxShadow: "0 0 28px rgba(99,102,241,0.6), inset 0 2px 4px rgba(255,255,255,0.15)" }}
        >
          <div className="absolute inset-1 rounded-full bg-black/20 group-hover:bg-black/10 transition-all" />
          {selectedCharacter.class === "Warrior" && <Sword className="w-9 h-9 relative z-10 group-hover:rotate-12 transition-transform" />}
          {selectedCharacter.class === "Mage" && <Zap className="w-9 h-9 relative z-10" />}
          {selectedCharacter.class === "Priest" && <Sparkles className="w-9 h-9 relative z-10" />}
          {selectedCharacter.class === "Thief" && <Target className="w-9 h-9 relative z-10" />}
          {selectedCharacter.class === "Beginner" && <Shield className="w-9 h-9 relative z-10" />}
          <span className="absolute bottom-1 text-[7px] font-black text-white/80 uppercase tracking-widest z-10">ATTACK</span>
        </button>

        {/* Q Skill */}
        <button
          id="skill-button-active"
          onClick={handleSkillDispatch}
          className="relative w-[56px] h-[56px] rounded-full bg-gradient-to-br from-orange-500 to-red-600 border-2 border-white/20 active:scale-95 flex items-center justify-center text-white shadow-xl transition-all hover:brightness-110 group"
          style={{ boxShadow: "0 0 16px rgba(249,115,22,0.5)" }}
        >
          <div id="skill-cooldown-overlay" className="absolute inset-0 bg-black/85 backdrop-blur-[1px] rounded-full flex items-center justify-center text-[9px] font-black text-amber-400 transition-all translate-y-[100%]">CD</div>
          {selectedCharacter.class === "Warrior" && <RefreshCw className="w-6 h-6 relative z-10" />}
          {selectedCharacter.class === "Mage" && <Zap className="w-6 h-6 relative z-10" />}
          {selectedCharacter.class === "Priest" && <Sparkles className="w-6 h-6 relative z-10" />}
          {selectedCharacter.class === "Thief" && <Target className="w-6 h-6 relative z-10" />}
          {selectedCharacter.class === "Beginner" && <Shield className="w-6 h-6 relative z-10" />}
          <div className="absolute -top-1 -left-1 bg-zinc-900 border border-white/10 text-[7px] font-black px-1.5 py-0.5 rounded-full text-zinc-300">Q</div>
        </button>
      </div>
    </div>
  );
}
