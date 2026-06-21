// ============================================================
// archerSkillInput.ts — Keyboard-to-Skill Dispatch System
// ============================================================
// Handles per-key skill triggering for the Archer class.
// Each key (1-6, F1) maps to a specific skill with independent cooldowns.
//
// Architecture:
//   - DIRECT execution: keydown handler executes the skill immediately
//     by setting window.__pendingSkillQueue (consumed by game loop).
//   - Does NOT rely on useKeyboardControls / canvas focus.
//   - Uses classic removeEventListener pattern (not AbortController)
//     for maximum browser compatibility.
// ============================================================

import {
  ARCHER_SKILLS,
  initArcherCooldowns,
  isArcherSkillReady,
  setArcherSkillOnCooldown,
  getArcherSkillCooldownRemaining,
  executeArcherSkill,
} from './archerSkills';
import type { CombatExecutionContext, UnitRuntimeData } from './types';

// ── Key-to-Skill Mapping ────────────────────────────────────────────────────

export const KEY_TO_SKILL: Record<string, string> = {
  'KeyQ':   'double_strafe',    // Q → quick spammable attack (replaces old keys.skill)
  'Digit1': 'double_strafe',
  'Digit2': 'double_strafe',
  'Digit3': 'arrow_shower',
  'Digit4': 'arrow_repel',
  'Digit5': 'ankle_snare',
  'Digit6': 'improve_concentration',
  'F1':     'rain_of_arrows',
};

// ── Pending Skill FIFO Queue ──────────────────────────────────────────────────
// Stored on window for cross-module accessibility.
// Game loop (useFrame) calls consumePendingArcherSkill() once per frame.

function getQueue(): string[] {
  if (!(window as any).__archerSkillQueue) {
    (window as any).__archerSkillQueue = [];
  }
  return (window as any).__archerSkillQueue;
}

/**
 * Consume the oldest pending skill from the queue.
 * Called ONCE per frame from PlayerController.useFrame.
 * Returns null if the queue is empty.
 */
export function consumePendingArcherSkill(): string | null {
  const q = getQueue();
  if (q.length === 0) return null;
  return q.shift() ?? null;
}

/** @deprecated kept for backward-compat */
export function getPendingArcherSkill(): string | null {
  const q = getQueue();
  return q[0] ?? null;
}

/** @deprecated kept for backward-compat */
export function clearPendingArcherSkill(): void {
  getQueue().shift();
}

/** Drain the entire queue (e.g. on debuff / death). */
export function clearAllPendingArcherSkills(): void {
  (window as any).__archerSkillQueue = [];
}

// ── Keyboard Listener ────────────────────────────────────────────────────────

// Named function so it can be removed with removeEventListener
function _onSkillKeyDown(e: KeyboardEvent): void {
  const skillId = KEY_TO_SKILL[e.code];
  if (!skillId) return;

  // Skip if chat/input is focused
  const activeTag = (document.activeElement as HTMLElement)?.tagName?.toUpperCase();
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

  // Prevent F1 from opening browser help
  if (e.code === 'F1') e.preventDefault();

  // Soft class guard
  const playerClass = (window as any).__playerClass;
  if (playerClass && playerClass !== 'Beginner') return;

  // Check cooldown
  if (!isArcherSkillReady(skillId)) {
    const remaining = getArcherSkillCooldownRemaining(skillId);
    console.log(`⏳ ${ARCHER_SKILLS[skillId]?.name || skillId} on cooldown: ${(remaining / 1000).toFixed(1)}s`);
    return;
  }

  // Push to queue (cap at 3)
  const q = getQueue();
  if (q.length < 3) {
    q.push(skillId);
    console.log(`🏹 QUEUED: ${ARCHER_SKILLS[skillId]?.name || skillId} [${e.code}] queue=${q.length}`);
  }
}

let _listenerAttached = false;

/**
 * Attach the global skill keydown listener.
 * Safe to call multiple times — idempotent.
 */
export function attachArcherSkillListener(): void {
  if (_listenerAttached) {
    // Re-attach: remove old first to avoid double registration
    window.removeEventListener('keydown', _onSkillKeyDown);
  }
  initArcherCooldowns();
  window.addEventListener('keydown', _onSkillKeyDown);
  _listenerAttached = true;
  console.log('🏹 Archer skill listener attached! Keys: 1-6, F1');
}

/**
 * Detach the skill listener (class change / unmount).
 */
export function detachArcherSkillListener(): void {
  window.removeEventListener('keydown', _onSkillKeyDown);
  _listenerAttached = false;
  console.log('🏹 Archer skill listener detached.');
}

// ── Skill Dispatch ───────────────────────────────────────────────────────────

/**
 * Called from the game loop when a pending Archer skill needs execution.
 * Returns true if a skill was consumed (even if it couldn't execute).
 */
export function dispatchPendingArcherSkill(
  target: UnitRuntimeData | null,
  ctx: CombatExecutionContext,
  castState: { current: any },
  setIsTargetingAoE: (v: boolean) => void,
): boolean {
  const skillId = consumePendingArcherSkill();
  if (!skillId) return false;

  const config = ARCHER_SKILLS[skillId];
  if (!config) return false;

  if (castState.current.isCasting) return false;

  setArcherSkillOnCooldown(skillId);

  if (config.castType === 'instant') {
    executeArcherSkill(skillId, target, ctx);
    return true;
  }

  if (config.castType === 'aoe-ground') {
    if (target && target.isActive && !target.isDying) {
      const mockTarget: UnitRuntimeData = {
        id: 'ground_target',
        name: 'Ground',
        type: 'enemy',
        isActive: true,
        isDying: false,
        hp: 9999,
        maxHp: 9999,
        position: [target.position[0], target.position[1], target.position[2]],
        level: 1,
        poolIdx: 0,
      };
      executeArcherSkill(skillId, mockTarget, ctx);
      return true;
    }
    (window as any).__pendingAoESkillId = skillId;
    setIsTargetingAoE(true);
    console.log(`🎯 ${config.name}: No target — entering AoE targeting. Left-click to cast.`);
    return true;
  }

  // single-target
  if (target) {
    const stats = ctx.playerStats || {};
    const dex = stats.base_dex ?? stats.baseDEX ?? 10;
    const int = stats.base_int ?? stats.baseINT ?? 10;
    const vctRatio = Math.min(1.0, (dex + int / 2.0) / 265.0);
    const vctActual = config.vct * (1.0 - vctRatio);
    const totalCastTime = (config.fct + vctActual) * 1000;

    castState.current = {
      isCasting: true,
      startTime: performance.now(),
      totalTime: totalCastTime,
      fctTime: config.fct * 1000,
      vctTime: vctActual * 1000,
      target: target as any,
      context: ctx,
      skillId,
    };
    return true;
  }

  console.log(`⚠️ ${config.name} requires a target!`);
  return false;
}

/**
 * Execute an AoE Archer skill at the ground-target position.
 * Called when the AoE targeting is confirmed (left-click).
 */
export function executeAoEArcherSkill(
  skillId: string,
  groundPos: { x: number; y: number; z: number },
  ctx: CombatExecutionContext,
): void {
  const mockTarget: UnitRuntimeData = {
    id: 'ground_target',
    name: 'Ground',
    type: 'enemy',
    isActive: true,
    isDying: false,
    hp: 9999,
    maxHp: 9999,
    position: [groundPos.x, groundPos.y, groundPos.z],
    level: 1,
    poolIdx: 0,
  };
  executeArcherSkill(skillId, mockTarget, ctx);
}

// ── Auto-Mode Skill Rotation ──────────────────────────────────────────────────

const AUTO_SKILL_PRIORITY = [
  'improve_concentration',
  'rain_of_arrows',
  'arrow_shower',
  'arrow_repel',
  'ankle_snare',
  'double_strafe',
];

/**
 * Pick the best available Archer skill for auto-mode.
 * Returns skillId or null if all on cooldown.
 */
export function pickAutoArcherSkill(): string | null {
  initArcherCooldowns();
  for (const skillId of AUTO_SKILL_PRIORITY) {
    if (isArcherSkillReady(skillId)) {
      return skillId;
    }
  }
  return null;
}
