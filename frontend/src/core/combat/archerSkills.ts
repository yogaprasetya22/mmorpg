// ============================================================
// archerSkills.ts — Ragnarok Online Archer Skill System
// ============================================================
//
// Implements all 7 Archer skills with authentic RO mechanics:
//   1. Double Strafe  (Key 2, CD 1.5s) — Spammable single-target DPS
//   2. Arrow Shower   (Key 3, CD 4.0s) — AoE + knockback
//   3. Arrow Repel    (Key 4, CD 6.0s) — Heavy knockback + stun
//   4. Ankle Snare    (Key 5, CD 10.0s) — Trap/root placement
//   5. Improve Concentration (Key 6, CD 30.0s) — ASPD/DEX buff
//   6. Rain of Arrows (F1, CD 45.0s) — Ultimate AoE
//   7. Eagle Eye      (Passive) — Auto-activates on 5th combo hit
// ============================================================

import type { CombatExecutionContext, UnitRuntimeData } from './types';
import { getProjectileSpawnConfig } from '@/src/components/game/avatar/weaponConfigs';

// ── Skill Config ─────────────────────────────────────────────────────────────

export interface ArcherSkillConfig {
  id: string;
  name: string;
  key: string;
  cooldownMs: number;
  manaCost: number;
  damageMultiplier: number;
  range: number;
  castType: 'instant' | 'single-target' | 'aoe-ground';
  fct: number; // Fixed cast time (seconds)
  vct: number; // Variable cast time (seconds)
  aoeRadius?: number;
}

export const ARCHER_SKILLS: Record<string, ArcherSkillConfig> = {
  double_strafe: {
    id: 'double_strafe', name: 'Double Strafe', key: '2',
    cooldownMs: 1500, manaCost: 12, damageMultiplier: 2.0, range: 12.0,
    castType: 'single-target', fct: 0.15, vct: 0.25,
  },
  arrow_shower: {
    id: 'arrow_shower', name: 'Arrow Shower', key: '3',
    cooldownMs: 4000, manaCost: 25, damageMultiplier: 1.2, range: 12.0,
    castType: 'aoe-ground', fct: 0.4, vct: 0.6, aoeRadius: 5.0,
  },
  arrow_repel: {
    id: 'arrow_repel', name: 'Arrow Repel', key: '4',
    cooldownMs: 6000, manaCost: 18, damageMultiplier: 1.8, range: 12.0,
    castType: 'single-target', fct: 0.3, vct: 0.4,
  },
  ankle_snare: {
    id: 'ankle_snare', name: 'Ankle Snare', key: '5',
    cooldownMs: 10000, manaCost: 15, damageMultiplier: 0, range: 0,
    castType: 'instant', fct: 0.0, vct: 0.0,
  },
  improve_concentration: {
    id: 'improve_concentration', name: 'Improve Concentration', key: '6',
    cooldownMs: 30000, manaCost: 20, damageMultiplier: 0, range: 0,
    castType: 'instant', fct: 0.2, vct: 0.0,
  },
  rain_of_arrows: {
    id: 'rain_of_arrows', name: 'Rain of Arrows', key: 'F1',
    cooldownMs: 45000, manaCost: 60, damageMultiplier: 3.5, range: 15.0,
    castType: 'aoe-ground', fct: 0.4, vct: 1.2, aoeRadius: 10.0,
  },
};

// ── Per-Skill Cooldown Tracker ───────────────────────────────────────────────

export function initArcherCooldowns(): void {
  if (!(window as any).archerSkillCDs) {
    (window as any).archerSkillCDs = {
      double_strafe: 0,
      arrow_shower: 0,
      arrow_repel: 0,
      ankle_snare: 0,
      improve_concentration: 0,
      rain_of_arrows: 0,
    };
  }
}

export function isArcherSkillReady(skillId: string): boolean {
  initArcherCooldowns();
  const cds = (window as any).archerSkillCDs;
  return performance.now() >= (cds[skillId] || 0);
}

export function setArcherSkillOnCooldown(skillId: string): void {
  initArcherCooldowns();
  const config = ARCHER_SKILLS[skillId];
  if (config) {
    (window as any).archerSkillCDs[skillId] = performance.now() + config.cooldownMs;
  }
}

export function getArcherSkillCooldownRemaining(skillId: string): number {
  initArcherCooldowns();
  const cds = (window as any).archerSkillCDs;
  const remaining = (cds[skillId] || 0) - performance.now();
  return remaining > 0 ? remaining : 0;
}

// ── Trap Pool for Ankle Snare ────────────────────────────────────────────────

export interface ArcherTrap {
  active: boolean;
  x: number; y: number; z: number;
  createTime: number;
  triggerRadius: number;
  rootDurationMs: number;
}

const MAX_TRAPS = 3;
const TRAP_LIFETIME_MS = 15000;

export function getTrapPool(): ArcherTrap[] {
  if (!(window as any).archerTraps) {
    (window as any).archerTraps = Array.from({ length: MAX_TRAPS }, () => ({
      active: false, x: 0, y: 0, z: 0, createTime: 0,
      triggerRadius: 1.5, rootDurationMs: 3000,
    }));
  }
  return (window as any).archerTraps;
}

// ── Skill Execution Functions ────────────────────────────────────────────────

const spawnConfig = getProjectileSpawnConfig("Beginner");

/** Fire a single arrow projectile toward a target or along camera direction */
function fireSkillArrow(
  ctx: CombatExecutionContext,
  target: UnitRuntimeData | null,
  color: string,
  bulletSpeed: number,
  isSniper: boolean,
  isFinisher: boolean,
): void {
  if (!ctx.mmSpellsRef?.current) return;
  const pool = ctx.mmSpellsRef.current;
  const s = pool[ctx.mmSpellPtr.current];
  if (!s) return;

  s.active = true;
  s.isBullet = true;
  s.fromX = ctx.charPos.x;
  s.fromY = ctx.charPos.y + spawnConfig.launchY;
  s.fromZ = ctx.charPos.z;

  if (target && target.isActive && !target.isDying) {
    s.toX = target.position[0];
    s.toY = target.position[1] + 1.2;
    s.toZ = target.position[2];
    s.targetId = target.id;
    s.targetPoolIdx = target.poolIdx;
  } else {
    ctx.camera.getWorldDirection(ctx.camDir);
    ctx.camDir.y = 0;
    ctx.camDir.normalize();
    s.toX = ctx.charPos.x + ctx.camDir.x * 25.0;
    s.toY = ctx.charPos.y + spawnConfig.launchY;
    s.toZ = ctx.charPos.z + ctx.camDir.z * 25.0;
    s.targetId = "";
    s.targetPoolIdx = undefined;
  }

  s.startTime = performance.now();
  s.color = color;
  s.isSniper = isSniper;
  s.isFinisher = isFinisher;
  s.bulletSpeed = bulletSpeed;
  s.playerClass = "Beginner";

  ctx.mmSpellPtr.current = (ctx.mmSpellPtr.current + 1) % pool.length;
}

// ── 1. Double Strafe ─────────────────────────────────────────────────────────

export function skillDoubleStrafe(target: UnitRuntimeData | null, ctx: CombatExecutionContext): void {
  console.log(`⚡ [DoubleStrafe] EXECUTING — target: ${target?.id || 'none'}, mmSpells: ${!!ctx.mmSpellsRef?.current}, spawnVFX: ${typeof ctx.spawnVFX}`);
  const now = performance.now();
  (window as any).lastEagleEyeTime = now;

  // Fire 2 rapid arrows
  fireSkillArrow(ctx, target, "#ffd700", 150.0, true, false);
  ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "magic", "#ffd700");

  if (target && ctx.dealPlayerDamage) {
    const damage = 14000 + Math.random() * 1500;
    ctx.dealPlayerDamage(target.id, damage, false);
  }

  // 2nd arrow — 120ms later (RO Double Strafe cadence)
  setTimeout(() => {
    fireSkillArrow(ctx, target, "#ffd700", 150.0, true, true);
    ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "magic", "#ffd700");

    if (target && ctx.dealPlayerDamage) {
      const damage = 14000 + Math.random() * 1500;
      ctx.dealPlayerDamage(target.id, damage, true);
    }
  }, 120);

  if (ctx.cameraShake) ctx.cameraShake(0.35);
}

// ── 2. Arrow Shower (AoE + Knockback) ────────────────────────────────────────

export function skillArrowShower(target: UnitRuntimeData | null, ctx: CombatExecutionContext): void {
  console.log(`⚡ [ArrowShower] EXECUTING — target: ${target?.id || 'none'}, grid: ${!!ctx.grid}`);
  const castX = target ? target.position[0] : ctx.charPos.x;
  const castY = target ? target.position[1] : ctx.charPos.y;
  const castZ = target ? target.position[2] : ctx.charPos.z;

  const config = ARCHER_SKILLS.arrow_shower;
  const aoeRadius = config.aoeRadius || 5.0;

  // VFX: ground ring indicator
  ctx.spawnVFX([castX, castY + 0.1, castZ], "magic", "#10b981");

  if (ctx.grid && ctx.dealPlayerDamage) {
    const nearby = ctx.grid.queryRadius(castX, castZ, aoeRadius);
    let hitCount = 0;

    nearby.forEach((u: any) => {
      if (u.type === "enemy" && u.isActive && !u.isDying) {
        // Damage: 1.2x ATK to all in radius
        const baseDmg = (ctx.playerStats?.atk || 100) * config.damageMultiplier;
        const damage = baseDmg * (0.9 + Math.random() * 0.2);
        ctx.dealPlayerDamage?.(u.id, damage, false, false, "#10b981");

        // Knockback: push enemies 3m away from center
        const dx = u.position[0] - castX;
        const dz = u.position[2] - castZ;
        const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
        const pushX = (dx / dist) * 3.0;
        const pushZ = (dz / dist) * 3.0;
        u.position[0] += pushX;
        u.position[2] += pushZ;

        hitCount++;
      }
    });

    if (hitCount > 0 && ctx.cameraShake) {
      ctx.cameraShake(0.45);
    }
  }

  // Fire visual arrows falling from above
  if (ctx.mmSpellsRef?.current) {
    const pool = ctx.mmSpellsRef.current;
    for (let i = 0; i < 5; i++) {
      const s = pool[ctx.mmSpellPtr.current];
      if (s) {
        s.active = true;
        s.isBullet = true;
        s.fromX = castX + (Math.random() - 0.5) * aoeRadius * 1.5;
        s.fromY = castY + 10.0 + Math.random() * 3.0;
        s.fromZ = castZ + (Math.random() - 0.5) * aoeRadius * 1.5;
        s.toX = castX + (Math.random() - 0.5) * aoeRadius;
        s.toY = castY + 0.3;
        s.toZ = castZ + (Math.random() - 0.5) * aoeRadius;
        s.startTime = performance.now() + i * 60;
        s.color = "#10b981";
        s.isSniper = false;
        s.isFinisher = false;
        s.bulletSpeed = 50.0;
        s.playerClass = "Beginner";
        s.targetId = "";
        s.targetPoolIdx = undefined;
        ctx.mmSpellPtr.current = (ctx.mmSpellPtr.current + 1) % pool.length;
      }
    }
  }

  ctx.spawnVFX([castX, castY + 2.0, castZ], "magic", "#10b981");
}

// ── 3. Arrow Repel (Heavy Knockback + Stun) ─────────────────────────────────

export function skillArrowRepel(target: UnitRuntimeData | null, ctx: CombatExecutionContext): void {
  console.log(`⚡ [ArrowRepel] EXECUTING — target: ${target?.id || 'none'}`);
  const config = ARCHER_SKILLS.arrow_repel;

  // Fire heavy arrow
  fireSkillArrow(ctx, target, "#f97316", 120.0, true, true);
  ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "magic", "#f97316");

  if (target && ctx.dealPlayerDamage) {
    const baseDmg = (ctx.playerStats?.atk || 100) * config.damageMultiplier;
    const damage = baseDmg * (0.9 + Math.random() * 0.2);
    ctx.dealPlayerDamage(target.id, damage, false, false, "#f97316");

    // Heavy knockback: push target 8m away from player
    const dx = target.position[0] - ctx.charPos.x;
    const dz = target.position[2] - ctx.charPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
    target.position[0] += (dx / dist) * 8.0;
    target.position[2] += (dz / dist) * 8.0;
  }

  if (ctx.cameraShake) ctx.cameraShake(0.55);
}

// ── 4. Ankle Snare (Trap Placement) ─────────────────────────────────────────

export function skillAnkleSnare(_target: UnitRuntimeData | null, ctx: CombatExecutionContext): void {
  console.log(`⚡ [AnkleSnare] EXECUTING — charPos: (${ctx.charPos.x.toFixed(1)}, ${ctx.charPos.z.toFixed(1)})`);
  const traps = getTrapPool();
  const now = performance.now();

  // Clean expired traps
  traps.forEach((t: ArcherTrap) => {
    if (t.active && now - t.createTime > TRAP_LIFETIME_MS) {
      t.active = false;
    }
  });

  // Find an empty slot
  let placed = false;
  for (const trap of traps) {
    if (!trap.active) {
      trap.active = true;
      trap.x = ctx.charPos.x;
      trap.y = ctx.charPos.y;
      trap.z = ctx.charPos.z;
      trap.createTime = now;
      placed = true;
      break;
    }
  }

  if (!placed) {
    // Overwrite oldest trap
    const oldest = traps.reduce((a, b) => a.createTime < b.createTime ? a : b);
    oldest.active = true;
    oldest.x = ctx.charPos.x;
    oldest.y = ctx.charPos.y;
    oldest.z = ctx.charPos.z;
    oldest.createTime = now;
  }

  // VFX: subtle ground glyph
  ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 0.05, ctx.charPos.z], "magic", "#8b5cf6");
}

// ── 5. Improve Concentration (ASPD/DEX Buff) ────────────────────────────────

const CONCENTRATION_DURATION_MS = 15000;

export function skillImproveConcentration(_target: UnitRuntimeData | null, ctx: CombatExecutionContext): void {
  const now = performance.now();

  // Set buff timer
  (window as any).concentrationBuffUntil = now + CONCENTRATION_DURATION_MS;

  // Detection wave: reveal hidden enemies within 8m
  if (ctx.grid) {
    const nearby = ctx.grid.queryRadius(ctx.charPos.x, ctx.charPos.z, 8.0);
    nearby.forEach((u: any) => {
      if (u.type === "enemy" && u.isActive) {
        // Force reveal hidden enemies
        if (u.hidden || u.stealthed) {
          u.hidden = false;
          u.stealthed = false;
        }
      }
    });
  }

  // VFX: aura ring + spiral particles
  ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 0.5, ctx.charPos.z], "magic", "#06b6d4");
  ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "magic", "#06b6d4");

  // Console feedback
  console.log("🎯 Improve Concentration activated! +25% ASPD, +15% DEX for 15s");
}

/** Check if concentration buff is active */
export function isConcentrationActive(): boolean {
  return performance.now() < ((window as any).concentrationBuffUntil || 0);
}

// ── 6. Rain of Arrows (Ultimate AoE) ─────────────────────────────────────────

export function skillRainOfArrows(target: UnitRuntimeData | null, ctx: CombatExecutionContext): void {
  console.log(`⚡ [RainOfArrows] EXECUTING — target: ${target?.id || 'none'}, grid: ${!!ctx.grid}`);
  const castX = target ? target.position[0] : ctx.charPos.x;
  const castY = target ? target.position[1] : ctx.charPos.y;
  const castZ = target ? target.position[2] : ctx.charPos.z;

  const config = ARCHER_SKILLS.rain_of_arrows;
  const aoeRadius = config.aoeRadius || 10.0;

  // VFX: sky portal lightrays
  ctx.spawnVFX([castX, castY + 12.0, castZ], "magic", "#ef4444");
  ctx.spawnVFX([castX, castY + 0.1, castZ], "magic", "#ef4444");

  if (ctx.cameraShake) ctx.cameraShake(0.85);

  // Rain arrows from sky over 2 seconds (10 waves)
  const totalWaves = 10;
  const waveInterval = 200; // ms between waves
  const damagePerWave = ((ctx.playerStats?.atk || 100) * config.damageMultiplier) / totalWaves;

  for (let wave = 0; wave < totalWaves; wave++) {
    setTimeout(() => {
      // Fire visual arrows from sky
      if (ctx.mmSpellsRef?.current) {
        const pool = ctx.mmSpellsRef.current;
        for (let i = 0; i < 3; i++) {
          const s = pool[ctx.mmSpellPtr.current];
          if (s) {
            s.active = true;
            s.isBullet = true;
            s.fromX = castX + (Math.random() - 0.5) * aoeRadius * 2;
            s.fromY = castY + 15.0 + Math.random() * 5.0;
            s.fromZ = castZ + (Math.random() - 0.5) * aoeRadius * 2;
            s.toX = castX + (Math.random() - 0.5) * aoeRadius;
            s.toY = castY + 0.2;
            s.toZ = castZ + (Math.random() - 0.5) * aoeRadius;
            s.startTime = performance.now();
            s.color = "#ef4444";
            s.isSniper = false;
            s.isFinisher = wave === totalWaves - 1;
            s.bulletSpeed = 60.0;
            s.playerClass = "Beginner";
            s.targetId = "";
            s.targetPoolIdx = undefined;
            ctx.mmSpellPtr.current = (ctx.mmSpellPtr.current + 1) % pool.length;
          }
        }
      }

      // Deal damage to enemies in radius
      if (ctx.grid && ctx.dealPlayerDamage) {
        const nearby = ctx.grid.queryRadius(castX, castZ, aoeRadius);
        nearby.forEach((u: any) => {
          if (u.type === "enemy" && u.isActive && !u.isDying) {
            const damage = damagePerWave * (0.8 + Math.random() * 0.4);
            ctx.dealPlayerDamage?.(u.id, damage, wave === totalWaves - 1, false, "#ef4444");
          }
        });
      }

      // Impact VFX per wave
      ctx.spawnVFX(
        [castX + (Math.random() - 0.5) * aoeRadius, castY + 0.3, castZ + (Math.random() - 0.5) * aoeRadius],
        "magic",
        "#ef4444",
      );
    }, wave * waveInterval);
  }
}

// ── Skill Router ─────────────────────────────────────────────────────────────

export function executeArcherSkill(
  skillId: string,
  target: UnitRuntimeData | null,
  ctx: CombatExecutionContext,
): void {
  switch (skillId) {
    case 'double_strafe':
      skillDoubleStrafe(target, ctx);
      break;
    case 'arrow_shower':
      skillArrowShower(target, ctx);
      break;
    case 'arrow_repel':
      skillArrowRepel(target, ctx);
      break;
    case 'ankle_snare':
      skillAnkleSnare(target, ctx);
      break;
    case 'improve_concentration':
      skillImproveConcentration(target, ctx);
      break;
    case 'rain_of_arrows':
      skillRainOfArrows(target, ctx);
      break;
    default:
      skillDoubleStrafe(target, ctx);
      break;
  }
}

// ── Eagle Eye Passive Check ──────────────────────────────────────────────────

/**
 * Call this on every successful hit. If combo reaches 5 on the same target,
 * activate Eagle Eye for 6 seconds.
 */
export function checkEagleEyePassive(comboCount: number): void {
  if (comboCount >= 5) {
    const now = performance.now();
    (window as any).lastEagleEyeTime = now;
    console.log("🦅 Eagle Eye activated! +30% Crit, +50% Range for 6s");
  }
}
