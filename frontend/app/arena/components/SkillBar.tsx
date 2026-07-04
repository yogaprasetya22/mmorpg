/** Bottom skill bar — Ragnarok Archer Multi-Skill Hotbar with Cooldown UI */
'use client';

import { Sword, Shield, Zap, Sparkles, Target, RefreshCw, Lock, Flag, Ban, ChevronDown, Crosshair, Flame, Eye, Wind, CloudRain } from 'lucide-react';
import { useCallback, useState, useEffect, useRef } from 'react';

interface SkillBarProps {
  selectedCharacter: any;
  isAutoMode: boolean;
  setIsAutoMode: (v: (prev: boolean) => boolean) => void;
}

// Maps SkillBar slot key → archerSkillCDs key (from archerSkills.ts)
const SLOT_TO_SKILL_ID: Record<string, string> = {
  "2": "double_strafe",
  "3": "arrow_shower",
  "4": "arrow_repel",
  "5": "ankle_snare",
  "6": "improve_concentration",
  "F1": "rain_of_arrows",
};

// Cooldown durations in ms (mirrors ARCHER_SKILLS config for UI display)
const SKILL_CD_MS: Record<string, number> = {
  double_strafe: 1500,
  arrow_shower: 4000,
  arrow_repel: 6000,
  ankle_snare: 10000,
  improve_concentration: 30000,
  rain_of_arrows: 45000,
};

// Damage multiplier per skill (for tooltip display)
const SKILL_DMG_LABEL: Record<string, string> = {
  double_strafe: "2.0× ATK",
  arrow_shower: "1.2× ATK AoE",
  arrow_repel: "1.8× ATK",
  ankle_snare: "Trap",
  improve_concentration: "Buff",
  rain_of_arrows: "3.5× ATK AoE",
};

// Archer skill metadata for tooltips and icons
const SKILL_META: Record<string, { name: string; tooltip: string; code: string }> = {
  "1": { name: "Attack", tooltip: "Basic Attack (ASPD)", code: "" },
  "2": { name: "Double Strafe", tooltip: "2.0x ATK — 2 rapid arrows (1.5s CD)", code: "Digit2" },
  "3": { name: "Arrow Shower", tooltip: "1.2x ATK AoE + Knockback (4s CD)", code: "Digit3" },
  "4": { name: "Arrow Repel", tooltip: "1.8x ATK + Heavy Knockback (6s CD)", code: "Digit4" },
  "5": { name: "Ankle Snare", tooltip: "Trap: Root enemy 3s (10s CD)", code: "Digit5" },
  "6": { name: "Concentration", tooltip: "+25% ASPD +15% DEX 15s (30s CD)", code: "Digit6" },
  "F1": { name: "Rain of Arrows", tooltip: "3.5x ATK massive AoE (45s CD)", code: "F1" },
};

/** Read remaining cooldown (ms) from the global archerSkillCDs tracker */
function getRemainingCD(skillId: string): number {
  const cds = (window as any).archerSkillCDs;
  if (!cds) return 0;
  const until = cds[skillId] || 0;
  const rem = until - performance.now();
  return rem > 0 ? rem : 0;
}

export function SkillBar({ selectedCharacter, isAutoMode, setIsAutoMode }: SkillBarProps) {
  const playerClass = selectedCharacter?.class || "Warrior";
  const isArcher = playerClass === "Beginner";

  // ── Cooldown tracking (polls every 80ms) ──
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const rafRef = useRef(0);

  useEffect(() => {
    if (!isArcher || !selectedCharacter) return;
    let running = true;

    const tick = () => {
      if (!running) return;
      const next: Record<string, number> = {};
      for (const [slot, skillId] of Object.entries(SLOT_TO_SKILL_ID)) {
        next[slot] = getRemainingCD(skillId);
      }
      setCooldowns(next);
      rafRef.current = window.setTimeout(tick, 80);
    };
    tick();

    return () => {
      running = false;
      clearTimeout(rafRef.current);
    };
  }, [isArcher, selectedCharacter]);

  const handleAttackDispatch = useCallback(() => {
    const e = new MouseEvent("mousedown", { button: 0 });
    document.dispatchEvent(e);
    setTimeout(() => document.dispatchEvent(new MouseEvent("mouseup", { button: 0 })), 50);
  }, []);

  const handleSkillKeyDispatch = useCallback((code: string) => {
    (window as any).__pendingSkillKey = code;
  }, []);

  const handleSlotClick = useCallback((key: string) => {
    if (key === "1") {
      handleAttackDispatch();
    } else {
      const meta = SKILL_META[key];
      if (meta?.code) {
        handleSkillKeyDispatch(meta.code);
      } else {
        handleSkillKeyDispatch("KeyQ");
      }
    }
  }, [handleAttackDispatch, handleSkillKeyDispatch]);

  if (!selectedCharacter) return null;

  // Predefined keys for the grid layout
  const topRowKeys = ["7", "8", "9", "0", "-", "="];
  const bottomRowKeys = ["1", "2", "3", "4", "5", "6"];
  const fRowKeys = ["F1", "F2", "F3", "F4"];

  // ── Cooldown overlay renderer ──
  const CooldownOverlay = ({ slotKey }: { slotKey: string }) => {
    const remaining = cooldowns[slotKey] || 0;
    if (remaining <= 0) return null;

    const skillId = SLOT_TO_SKILL_ID[slotKey];
    const totalCd = SKILL_CD_MS[skillId] || 1000;
    const progress = 1 - remaining / totalCd; // 0→1 as cooldown completes
    const degrees = progress * 360;
    const seconds = remaining / 1000;
    const dmgLabel = SKILL_DMG_LABEL[skillId] || "";

    return (
      <>
        {/* Dark sweep overlay (conic gradient) */}
        <div
          className="absolute inset-0 rounded-xl pointer-events-none z-10"
          style={{
            background: `conic-gradient(
              from -90deg,
              rgba(0,0,0,0.72) ${degrees}deg,
              transparent ${degrees}deg
            )`,
          }}
        />
        {/* Remaining time text */}
        <span className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <span
            className="text-white font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
            style={{ fontSize: seconds >= 10 ? '9px' : '11px' }}
          >
            {seconds >= 10 ? Math.ceil(seconds) : seconds.toFixed(1)}
          </span>
        </span>
        {/* Damage label at bottom */}
        {dmgLabel && seconds < 0.5 && (
          <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-[5px] font-extrabold text-amber-400/80 whitespace-nowrap">
            {dmgLabel}
          </span>
        )}
      </>
    );
  };

  // Skill icons — Archer-specific when class is Beginner
  const getSkillIcon = (key: string) => {
    if (isArcher && SKILL_META[key]) {
      switch (key) {
        case "1": return <Crosshair className="w-4.5 h-4.5 text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.6)]" />;
        case "2": return <Zap className="w-4.5 h-4.5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />;
        case "3": return <CloudRain className="w-4.5 h-4.5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" />;
        case "4": return <Flame className="w-4.5 h-4.5 text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]" />;
        case "5": return <Target className="w-4.5 h-4.5 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]" />;
        case "6": return <Eye className="w-4.5 h-4.5 text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]" />;
        case "F1": return <CloudRain className="w-4.5 h-4.5 text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.8)]" />;
      }
    }
    switch (key) {
      case "1": return <Sparkles className="w-4.5 h-4.5 text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.6)]" />;
      case "2": return <Shield className="w-4.5 h-4.5 text-blue-300 drop-shadow-[0_0_6px_rgba(147,197,253,0.6)]" />;
      case "3": return <Zap className="w-4.5 h-4.5 text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.6)]" />;
      case "4": return <Sparkles className="w-4.5 h-4.5 text-cyan-300 drop-shadow-[0_0_6px_rgba(103,232,249,0.6)]" />;
      case "5": return <Shield className="w-4.5 h-4.5 text-purple-300 drop-shadow-[0_0_6px_rgba(216,180,254,0.6)]" />;
      case "6": return <Target className="w-4.5 h-4.5 text-[#a7f3d0] drop-shadow-[0_0_6px_rgba(167,243,208,0.6)]" />;
      case "7": return <RefreshCw className="w-4.5 h-4.5 text-emerald-300" />;
      case "8": return <Sword className="w-4.5 h-4.5 text-zinc-300" />;
      case "9": return <Zap className="w-4.5 h-4.5 text-[#67e8f9]" />;
      case "0": return <Sword className="w-4.5 h-4.5 text-yellow-400" />;
      case "F1": return <Shield className="w-4.5 h-4.5 text-zinc-400" />;
      default: return null;
    }
  };

  const getSkillBG = (key: string) => {
    if (isArcher && SKILL_META[key]) {
      switch (key) {
        case "1": return "bg-gradient-to-b from-[#fcd34d]/20 to-[#f59e0b]/10 border-[#fbbf24]/40";
        case "2": return "bg-gradient-to-b from-[#fbbf24]/25 to-[#d97706]/15 border-[#f59e0b]/50";
        case "3": return "bg-gradient-to-b from-[#34d399]/25 to-[#059669]/15 border-[#10b981]/50";
        case "4": return "bg-gradient-to-b from-[#fb923c]/25 to-[#ea580c]/15 border-[#f97316]/50";
        case "5": return "bg-gradient-to-b from-[#a78bfa]/25 to-[#7c3aed]/15 border-[#8b5cf6]/50";
        case "6": return "bg-gradient-to-b from-[#22d3ee]/25 to-[#0891b2]/15 border-[#06b6d4]/50";
        case "F1": return "bg-gradient-to-b from-[#f87171]/25 to-[#dc2626]/15 border-[#ef4444]/50";
      }
    }
    switch (key) {
      case "1": return "bg-gradient-to-b from-[#fcd34d]/20 to-[#f59e0b]/10 border-[#fbbf24]/40";
      case "2": return "bg-gradient-to-b from-[#93c5fd]/20 to-[#3b82f6]/10 border-[#60a5fa]/40";
      case "3": return "bg-gradient-to-b from-[#f87171]/20 to-[#ef4444]/10 border-[#f87171]/40";
      case "4": return "bg-gradient-to-b from-[#67e8f9]/20 to-[#06b6d4]/10 border-[#22d3ee]/40";
      case "5": return "bg-gradient-to-b from-[#d8b4fe]/20 to-[#8b5cf6]/10 border-[#c084fc]/40";
      case "6": return "bg-gradient-to-b from-[#a7f3d0]/20 to-[#10b981]/10 border-[#34d399]/40";
      case "7": return "bg-zinc-800/40 border-zinc-700/40";
      case "8": return "bg-zinc-800/40 border-zinc-700/40";
      case "9": return "bg-zinc-800/40 border-zinc-700/40";
      case "0": return "bg-gradient-to-b from-[#fef08a]/20 to-[#eab308]/10 border-[#facc15]/40";
      case "F1": return "bg-zinc-800/40 border-zinc-700/40";
      default: return "bg-[#0b0c10]/70 border-[#23272a]/80";
    }
  };

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-end gap-3.5 bg-black/45 backdrop-blur-md border border-white/10 px-5 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.55)] pointer-events-auto select-none z-30">

      {/* LEFT: Locked Utility Slots */}
      <div className="flex gap-1.5">
        <div className="relative flex flex-col items-center">
          <button className="w-[42px] h-[42px] rounded-xl bg-zinc-950/80 border border-zinc-800/50 flex items-center justify-center cursor-not-allowed group shadow-inner">
            <Lock className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-500 transition-colors" />
          </button>
          <span className="absolute -top-1.5 -left-1 px-1 bg-black/80 rounded text-[7px] font-bold text-zinc-500 uppercase tracking-wider">E</span>
        </div>
        <div className="relative flex flex-col items-center">
          <button
            onClick={() => handleSkillKeyDispatch("KeyQ")}
            className="w-[42px] h-[42px] rounded-xl bg-zinc-950/80 border border-zinc-800/50 flex items-center justify-center hover:border-zinc-700 active:scale-95 transition-all shadow-inner"
            title="Generic Skill (Q)"
          >
            <Wind className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <span className="absolute -top-1.5 -left-1 px-1 bg-black/80 rounded text-[7px] font-bold text-zinc-500 uppercase tracking-wider">Q</span>
        </div>
      </div>

      {/* Downward Chevron Separator */}
      <div className="h-10 self-center flex items-center justify-center opacity-40 text-white">
        <ChevronDown className="w-4.5 h-4.5 rotate-90" />
      </div>

      {/* CENTER: Double Row Keyboard Slots Grid */}
      <div className="flex flex-col gap-1.5">
        {/* Row 1: Keys 7 - = */}
        <div className="flex gap-1.5">
          {topRowKeys.map((key) => (
            <div key={key} className="relative group">
              <button
                className={`w-[40px] h-[40px] rounded-xl border flex items-center justify-center active:scale-95 transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] ${getSkillBG(key)}`}
              >
                {getSkillIcon(key)}
              </button>
              <span className="absolute -top-1.5 -left-1.5 px-1 bg-black/75 rounded text-[7px] font-extrabold text-zinc-400">{key}</span>
            </div>
          ))}
        </div>

        {/* Row 2: Keys 1 - 6 & F1 - F4 */}
        <div className="flex gap-1.5 items-center">
          {bottomRowKeys.map((key) => {
            const meta = SKILL_META[key];
            return (
              <div key={key} className="relative group">
                <button
                  onClick={() => handleSlotClick(key)}
                  className={`w-[40px] h-[40px] rounded-xl border flex items-center justify-center active:scale-95 transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] ${getSkillBG(key)}`}
                  title={isArcher && meta ? `${meta.name}: ${meta.tooltip}` : undefined}
                >
                  {getSkillIcon(key)}
                  {/* Cooldown overlay for archer skills */}
                  {isArcher && SLOT_TO_SKILL_ID[key] && <CooldownOverlay slotKey={key} />}
                </button>
                <span className="absolute -top-1.5 -left-1.5 px-1 bg-black/75 rounded text-[7px] font-extrabold text-zinc-400">{key}</span>
                {/* Skill name label for Archer */}
                {isArcher && meta && (
                  <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[5px] font-bold text-zinc-500 whitespace-nowrap uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                    {meta.name}
                  </span>
                )}
              </div>
            );
          })}

          {/* Vertical subtle divider before F keys */}
          <div className="w-[1px] h-7 bg-white/10 mx-0.5" />

          {/* F Keys F1 - F4 */}
          {fRowKeys.map((key) => {
            const meta = SKILL_META[key];
            return (
              <div key={key} className="relative group">
                <button
                  onClick={() => meta?.code && handleSkillKeyDispatch(meta.code)}
                  className={`w-[40px] h-[40px] rounded-xl border flex items-center justify-center active:scale-95 transition-all ${getSkillBG(key)}`}
                  title={isArcher && meta ? `${meta.name}: ${meta.tooltip}` : undefined}
                >
                  {getSkillIcon(key)}
                  {/* Cooldown overlay for archer skills */}
                  {isArcher && SLOT_TO_SKILL_ID[key] && <CooldownOverlay slotKey={key} />}
                </button>
                <span className="absolute -top-1.5 -left-1.5 px-1 bg-black/75 rounded text-[7px] font-extrabold text-zinc-400">{key}</span>
                {isArcher && meta && (
                  <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[5px] font-bold text-zinc-500 whitespace-nowrap uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                    {meta.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Advance Instance & Auto Controls */}
      <div className="flex items-center gap-3 pl-2 border-l border-white/10 h-16 self-center">
        <button className="flex flex-col items-center justify-center bg-black/25 hover:bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 transition-all active:scale-95 text-zinc-300 hover:text-white shadow-sm">
          <Flag className="w-4 h-4 text-emerald-400 animate-bounce" />
          <span className="text-[6.5px] font-bold tracking-wider uppercase mt-1">Advance Instance</span>
        </button>

        <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1.5 rounded-xl border border-white/5">
          <button
            onClick={() => setIsAutoMode(v => !v)}
            className={`flex flex-col items-center justify-center w-[40px] h-[40px] rounded-xl border transition-all ${isAutoMode
              ? "bg-[#10b981]/25 border-[#10b981] text-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.35)]"
              : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
              }`}
          >
            <Sword className={`w-4 h-4 ${isAutoMode ? "animate-pulse" : ""}`} />
            <span className="text-[6.5px] font-extrabold mt-0.5 uppercase tracking-wide">Auto (Z)</span>
          </button>

          {isAutoMode && (
            <button
              onClick={() => setIsAutoMode(() => false)}
              className="w-[40px] h-[40px] rounded-xl bg-red-950/40 border border-red-500/40 hover:bg-red-900/30 flex items-center justify-center text-red-400 active:scale-95 transition-all"
              title="Cancel Auto"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
