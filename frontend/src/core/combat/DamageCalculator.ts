// REFACTORED FROM: ClassCombatEngine.ts
// BaseAttackCalculator — shared damage calculation helper used by all class strategies.
import type { UnitRuntimeData, CombatExecutionContext } from './types';

/**
 * BaseAttackCalculator computes client-side predictive damage for immediate visual feedback.
 * The authoritative damage is always computed server-side in combat.go.
 * 
 * Features:
 * - Class-aware base damage (physical vs magic for Mage)
 * - Target defense reduction
 * - +/- 10% damage variation
 * - Critical hit calculation with Eagle Eye override
 * - 12% Double Attack / Lightning Proc chance
 */
export const BaseAttackCalculator = (
  target: UnitRuntimeData,
  ctx: CombatExecutionContext,
  baseMultiplier: number,
  isFinisher: boolean,
  isEagleEyeActive: boolean
) => {
  if (!ctx.dealPlayerDamage) return;

  const playerClass = ctx.playerStats?.class || ctx.playerStats?.Class || "Warrior";
  let baseDamage = ctx.playerStats?.attack || 120;
  if (playerClass === "Mage") {
    baseDamage = ctx.playerStats?.magic_attack || 120;
  }
  baseDamage = baseDamage * baseMultiplier;

  if (isEagleEyeActive) baseDamage *= 1.8;

  // Apply target defense reduction locally for immediate client visuals
  const targetDefense = (target as any).defense || 20;
  const damageMultiplier = 100 / (100 + targetDefense);
  let damage = baseDamage * damageMultiplier;

  // Add slight variation +/- 10%
  const variation = (Math.random() * 0.20 - 0.10) * damage;
  damage = damage + variation;

  const critChance = ctx.playerStats?.critical_rate || 0.05;
  const isCrit = isEagleEyeActive ? true : (isFinisher || Math.random() < critChance);
  if (isCrit) {
    damage *= 1.5;
  }

  if (damage < 1) damage = 1;

  const finalDamage = damage;
  const finalCrit = isCrit;

  // Directly deal player damage to ensure real-time synchronization with the hit event
  ctx.dealPlayerDamage?.(target.id, finalDamage, finalCrit);

  // ── Client-Side Damage Prediction ─────────────────────────────────────────
  // Dispatch a local combat_damage_event IMMEDIATELY so the DamageHUDBatcher
  // shows the damage number on EVERY hit without waiting for the server roundtrip.
  // The server's authoritative response is deduplicated in ArenaClient.hooks.ts
  // using a per-target timestamp to prevent double-display.
  if (typeof window !== 'undefined') {
    (window as any)._lastClientHitTime = (window as any)._lastClientHitTime || {};
    (window as any)._lastClientHitTime[target.id] = performance.now();
    window.dispatchEvent(new CustomEvent("combat_damage_event", {
      detail: {
        targetId: target.id,
        // UnitRuntimeData.type is 'player'|'enemy', but handler expects 'monster'|'player'
        targetType: target.type === "player" ? "player" : "monster",
        damage: finalDamage,
        isCrit: finalCrit,
        isMiss: false,
        isMagic: playerClass === "Mage",
        _clientPredicted: true
      }
    }));
  }

  // PROC RATE: 12% chance to trigger an automated Double Attack / Lightning Proc!
  const isProc = Math.random() < 0.12;
  if (isProc) {
    const procDamage = finalDamage * 0.85;
    // Spawn double attack proc immediately too!
    ctx.spawnVFX([target.position[0], target.position[1] + 1.2, target.position[2]], "shockwave", "#00e5ff");
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent("combat_damage_event", {
        detail: {
          targetId: target.id,
          targetType: target.type === "player" ? "player" : "monster",
          damage: procDamage,
          isCrit: false,
          isMiss: false,
          isMagic: false
        }
      }));
    }
  }
};
