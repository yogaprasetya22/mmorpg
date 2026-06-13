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
    { num: 1, icon: <Sword className="w-5 h-5" />, color: "from-[#dfb76c] to-[#b88c42]", border: "border-[#8c5b1b]", text: "text-zinc-950", label: "ATK" },
    { num: 2, icon: <Zap className="w-5 h-5" />, color: "from-[#38bdf8] to-[#0284c7]", border: "border-[#0369a1]", text: "text-white", label: "SKL" },
    { num: 3, icon: <Sparkles className="w-5 h-5" />, color: "from-[#c084fc] to-[#7e22ce]", border: "border-[#581c87]", text: "text-white", label: "PSV" },
    { num: 4, icon: <Shield className="w-5 h-5" />, color: "from-[#34d399] to-[#059669]", border: "border-[#065f46]", text: "text-white", label: "DEF" },
  ];

  return (
    <div className="absolute right-4 bottom-14 flex flex-col items-end gap-3.5 pointer-events-auto">
      {/* Top row: 4 numbered skill slots */}
      <div className="flex gap-2.5">
        {skills.map(s => (
          <div key={s.num} className="relative flex flex-col items-center gap-1">
            <button
              className={`w-[50px] h-[50px] rounded-full bg-gradient-to-br ${s.color} border-2 ${s.border} ${s.text} flex items-center justify-center active:scale-95 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.4)] relative hover:brightness-110`}
              onClick={() => handleSlotClick(s.num)}
            >
              {s.icon}
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-[#ebdcb9] border border-[#b88c42] flex items-center justify-center text-[7px] font-black text-[#5c3e16] shadow-sm">{s.num}</span>
            </button>
            <span className="text-[7.5px] font-black text-[#fdf6e2] drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.85)] uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Bottom row: AUTO + big skill button */}
      <div className="flex items-center gap-3">
        {/* AUTO battle */}
        <button
          onClick={() => setIsAutoMode(v => !v)}
          className={`flex flex-col items-center justify-center w-[48px] h-[48px] rounded-full border-2 transition-all ${
            isAutoMode 
              ? "bg-[#10b981]/20 border-[#047857] shadow-[0_0_12px_rgba(16,185,129,0.5)]" 
              : "bg-black/50 border-[#b88c42]/30 text-zinc-400"
          }`}
        >
          <span className={`text-[8.5px] font-black tracking-wider ${isAutoMode ? "text-[#10b981] animate-pulse" : "text-[#8c6b4f]"}`}>AUTO</span>
        </button>

        {/* Main attack big button */}
        <button
          onClick={handleAttackDispatch}
          className="relative w-[78px] h-[78px] rounded-full bg-gradient-to-br from-[#dfb76c] via-[#b88c42] to-[#8c5b1b] border-2 border-[#5c3e16] active:scale-95 flex items-center justify-center text-zinc-950 shadow-[0_6px_20px_rgba(0,0,0,0.5)] transition-all hover:brightness-115 group"
        >
          <div className="absolute inset-1 rounded-full bg-white/10 group-hover:bg-white/20 transition-all border border-[#ebdcb9]/40" />
          {selectedCharacter.class === "Warrior" && <Sword className="w-9 h-9 relative z-10 group-hover:rotate-12 transition-transform" />}
          {selectedCharacter.class === "Mage" && <Zap className="w-9 h-9 relative z-10" />}
          {selectedCharacter.class === "Priest" && <Sparkles className="w-9 h-9 relative z-10" />}
          {selectedCharacter.class === "Thief" && <Target className="w-9 h-9 relative z-10" />}
          {selectedCharacter.class === "Beginner" && <Target className="w-9 h-9 relative z-10" />}
          <span className="absolute bottom-1.5 text-[7px] font-black text-black uppercase tracking-widest z-10 drop-shadow-sm">ATTACK</span>
        </button>

        {/* Q Skill */}
        <button
          id="skill-button-active"
          onClick={handleSkillDispatch}
          className="relative w-[58px] h-[58px] rounded-full bg-gradient-to-br from-[#ffb547] to-[#e07b00] border-2 border-[#b25900] active:scale-95 flex items-center justify-center text-white shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-all hover:brightness-110 group"
        >
          <div id="skill-cooldown-overlay" className="absolute inset-0 bg-black/85 backdrop-blur-[1px] rounded-full flex items-center justify-center text-[9px] font-black text-amber-400 transition-all translate-y-[100%]">CD</div>
          {selectedCharacter.class === "Warrior" && <RefreshCw className="w-6 h-6 relative z-10 text-black" />}
          {selectedCharacter.class === "Mage" && <Zap className="w-6 h-6 relative z-10 text-black" />}
          {selectedCharacter.class === "Priest" && <Sparkles className="w-6 h-6 relative z-10 text-black" />}
          {selectedCharacter.class === "Thief" && <Target className="w-6 h-6 relative z-10 text-black" />}
          {selectedCharacter.class === "Beginner" && <Target className="w-6 h-6 relative z-10 text-black" />}
          <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-[#ebdcb9] border border-[#b88c42] flex items-center justify-center text-[7px] font-black text-[#5c3e16] shadow-sm">Q</div>
        </button>
      </div>
    </div>
  );
}
