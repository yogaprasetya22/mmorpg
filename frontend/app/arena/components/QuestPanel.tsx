/**
 * QuestPanel — Isolated microservice pattern (ref-driven, zero parent re-renders).
 *
 * PERFORMANCE: This component is driven entirely via useImperativeHandle/ref.
 * The parent never passes `quests` as a prop — instead it calls
 * `questPanelRef.current?.updateQuests(data)` from the idle profile poller.
 * This eliminates the #1 performance killer: setQuests() in the parent hook
 * which previously caused full MultiplayerArena re-render (Canvas + all HUD).
 */
import { useState, forwardRef, useImperativeHandle, memo } from 'react';
import { Trophy, CheckCircle, Circle } from 'lucide-react';

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

export interface QuestPanelRef {
  updateQuests: (quests: QuestItem[]) => void;
}

/** Serialise quests to a fingerprint string for cheap deep-equality check. */
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

  // Ref-only fingerprint to skip redundant setState when poll returns same data
  const lastFP = { current: '' };

  useImperativeHandle(ref, () => ({
    updateQuests(quests: QuestItem[]) {
      const active = quests.filter(q => q.status === 'active' || q.status === 'completed');
      const fp = questFingerprint(active);
      if (fp === lastFP.current) return; // identical — skip setState entirely
      lastFP.current = fp;
      setActiveQuests(active);
    }
  }));

  return (
    <div className="absolute right-3 top-[42%] -translate-y-1/2 w-[210px] bg-black/60 border border-white/10 border-r-[3px] border-r-amber-400 rounded-l-2xl rounded-r-sm p-3.5 flex flex-col gap-2.5 shadow-2xl pointer-events-auto select-none">
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[9px] font-black text-zinc-200 uppercase tracking-widest">Misi Aktif</span>
      </div>

      {activeQuests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <span className="text-zinc-600 text-lg mb-1">🗺️</span>
          <span className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-wider">Tidak ada misi aktif</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activeQuests.map((q) => {
            const progress = q.progress;
            const targetCount = q.target_count ?? q.targetCount ?? 1;
            const isCompleted = q.status === 'completed' || progress >= targetCount;
            const rewardGold = q.reward_gold ?? q.rewardGold ?? 0;
            const rewardXp = q.reward_xp ?? q.rewardXP ?? 0;

            return (
              <div key={q.id} className="flex flex-col gap-1.5">
                <div className="flex items-start gap-1.5">
                  {isCompleted ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                  )}
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-black leading-tight ${isCompleted ? 'text-zinc-400 line-through' : 'text-white'}`}>
                      {q.title}
                    </span>
                    <span className="text-[8px] text-zinc-400 mt-0.5">
                      {isCompleted ? 'Misi selesai! Temui NPC.' : 'Target Pembasmian:'}
                    </span>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-lg px-2.5 py-1.5 flex flex-col gap-1 text-[8.5px] font-black">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 uppercase tracking-wide">Progress</span>
                    <span className={isCompleted ? "text-emerald-400" : "text-amber-400"}>
                      {progress} / {targetCount}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isCompleted ? 'bg-emerald-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, (progress / targetCount) * 100)}%` }}
                    />
                  </div>

                  {/* Rewards */}
                  <div className="flex justify-between items-center text-[7.5px] text-zinc-500 border-t border-white/5 pt-1 mt-1">
                    <span>Hadiah:</span>
                    <span className="text-amber-400">+{rewardGold}G</span>
                    <span className="text-emerald-400">+{rewardXp}XP</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}));
QuestPanel.displayName = 'QuestPanel';
