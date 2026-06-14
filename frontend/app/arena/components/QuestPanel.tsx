/**
 * QuestPanel — Premium Mascot Speech Bubble layout matching reference screenshot.
 */
import { useState, useEffect, forwardRef, useImperativeHandle, memo } from 'react';
import type { QuestPanelRef } from '../ArenaClient.types';

interface QuestItem {
  id: string;
  quest_id?: string;
  questId?: string;
  title: string;
  status: string;
  progress: number;
  target_count?: number;
  targetCount?: number;
  reward_gold?: number;
  rewardGold?: number;
  reward_xp?: number;
  rewardXP?: number;
}

function questFingerprint(quests: QuestItem[]): string {
  let fp = '';
  for (let i = 0; i < quests.length; i++) {
    const q = quests[i];
    fp += `${q.id}|${q.status}|${q.progress};`;
  }
  return fp;
}

export const QuestPanel = memo(forwardRef<QuestPanelRef, {}>((_, ref) => {
  const [activeQuests, setActiveQuests] = useState<QuestItem[]>([]);
  const [timeLeft, setTimeLeft] = useState(280); // 4 minutes 40 seconds (280s)

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 280));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const lastFP = { current: '' };

  useImperativeHandle(ref, () => ({
    updateQuests(quests: QuestItem[]) {
      const active = quests.filter(q => q.status === 'active' || q.status === 'completed');
      const fp = questFingerprint(active);
      if (fp === lastFP.current) return;
      lastFP.current = fp;
      setActiveQuests(active);
    }
  }));

  // Get active quest details or use defaults matching the screenshot
  const currentQuest = activeQuests[0];
  const progress = currentQuest ? currentQuest.progress : 0;
  const targetCount = currentQuest ? (currentQuest.target_count ?? currentQuest.targetCount ?? 25) : 25;
  const titleText = currentQuest ? `Basmi Monster` : `Defeated`;
  const pct = Math.max(0, Math.min(100, (progress / targetCount) * 100));

  return (
    <div className="absolute left-6 top-[28%] flex items-center gap-2.5 pointer-events-auto select-none z-20">
      
      {/* ── Speech Bubble Mascot Box ── */}
      <div className="flex items-center bg-gradient-to-r from-teal-400/40 via-cyan-400/35 to-blue-500/25 backdrop-blur-md border-2 border-teal-300/40 rounded-full px-5 py-2.5 shadow-[0_6px_20px_rgba(20,184,166,0.3)] relative animate-pulse duration-[3000ms]">
        
        {/* Cute Mascot Cat Badge */}
        <div className="w-[44px] h-[44px] rounded-full bg-gradient-to-tr from-teal-300 to-emerald-200 border-2 border-white flex items-center justify-center shadow-md mr-3 shrink-0">
          {/* Custom Cat Face SVG */}
          <svg className="w-7 h-7 text-teal-700" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3c-1.2 0-2.4.3-3.5 1-.4-.4-.9-.7-1.5-.7-1.4 0-2.5 1.6-2 3.2C3.6 8 3 9.4 3 11c0 4.4 4 8 9 8s9-3.6 9-8c0-1.6-.6-3-2-4.5.5-1.6-.6-3.2-2-3.2-.6 0-1.1.3-1.5.7C14.4 3.3 13.2 3 12 3zm-3.5 6.5c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5-1.5-.7-1.5-1.5.7-1.5 1.5-1.5zm7 0c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5-1.5-.7-1.5-1.5.7-1.5 1.5-1.5z" />
          </svg>
        </div>

        {/* Content Column */}
        <div className="flex flex-col min-w-[110px]">
          {/* Quest Target */}
          <span className="text-[11px] font-black text-yellow-300 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] uppercase">
            {titleText} {progress}/{targetCount}
          </span>
          {/* Large Countdown Timer */}
          <span className="text-[17px] font-black text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)] tracking-wider mt-0.5 leading-none">
            {formatTime(timeLeft)}
          </span>
          {/* Progress Bar */}
          <div className="w-full h-[3.5px] bg-black/45 rounded-full overflow-hidden mt-1.5 border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-yellow-300 to-amber-500 rounded-full transition-all duration-500 shadow-[0_0_6px_rgba(234,179,8,0.7)]"
              style={{ width: `${currentQuest ? pct : 0}%` }}
            />
          </div>
        </div>

      </div>

    </div>
  );
}));
QuestPanel.displayName = 'QuestPanel';
