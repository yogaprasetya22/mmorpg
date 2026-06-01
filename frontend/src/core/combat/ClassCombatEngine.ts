// REFACTORED: All class strategies extracted to /strategies/*.ts
// All types extracted to ./types.ts
// BaseAttackCalculator extracted to ./DamageCalculator.ts
//
// This file is now a slim registry + factory API + barrel re-export.
// Import strategies from their individual files and expose a unified API.

import type { ClassCombatStrategy, CombatExecutionContext, UnitRuntimeData } from './types';
import WarriorStrategy from './strategies/WarriorStrategy';
import ThiefStrategy from './strategies/ThiefStrategy';
import PriestStrategy from './strategies/PriestStrategy';
import MageStrategy from './strategies/MageStrategy';
import BeginnerStrategy from './strategies/BeginnerStrategy';

// Re-export types for backward compatibility with existing imports
export type { CombatExecutionContext, UnitRuntimeData, ClassCombatStrategy } from './types';
export { BaseAttackCalculator } from './DamageCalculator';

// ==========================================
// STRATEGY REGISTRY & FACTORY API
// ==========================================

const StrategyRegistry: Record<string, ClassCombatStrategy> = {
  Warrior: WarriorStrategy,
  Thief: ThiefStrategy,
  Priest: PriestStrategy,
  Mage: MageStrategy,
  Beginner: BeginnerStrategy,
};

export const getStrategyForClass = (playerClass: string): ClassCombatStrategy => {
  return StrategyRegistry[playerClass] || BeginnerStrategy;
};

export const executeClassAttack = (
  playerClass: string,
  target: UnitRuntimeData | null,
  ctx: CombatExecutionContext
) => {
  const strategy = getStrategyForClass(playerClass);
  strategy.executeAttack(target, ctx);
};

export const executeClassSkill = (
  playerClass: string,
  target: UnitRuntimeData | null,
  ctx: CombatExecutionContext
) => {
  const strategy = getStrategyForClass(playerClass);
  strategy.executeSkill(target, ctx);
};
