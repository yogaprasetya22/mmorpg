// REFACTORED FROM: ClassCombatEngine.ts — Warrior (Fighter) Strategy
import type { ClassCombatStrategy } from '../types';
import { BaseAttackCalculator } from '../DamageCalculator';

const WarriorStrategy: ClassCombatStrategy = {
  comboColors: ["#ef4444", "#f97316", "#ea580c"], // Red -> Orange -> Dark Orange
  bulletSpeeds: [75.0, 75.0, 55.0],
  muzzleVFX: "muzzle",
  isMelee: true,

  executeAttack(target, ctx) {
    const isFinisher = ctx.combo === 2;
    const comboColor = this.comboColors[ctx.combo];

    ctx.spawnVFX([ctx.originVec.x, ctx.originVec.y, ctx.originVec.z], isFinisher ? "shockwave" : this.muzzleVFX, comboColor);

    if (target) {
      const toX = target.position[0];
      const toY = target.position[1] + 1.2;
      const toZ = target.position[2];

      if (ctx.fighterSpellsRef?.current) {
        const pool = ctx.fighterSpellsRef.current;
        const fs = pool[ctx.fighterSpellPtr.current];
        if (fs) {
          fs.active = true;
          fs.x = toX; fs.y = toY - 1.1; fs.z = toZ;
          fs.targetX = toX; fs.targetZ = toZ;
          const dx = toX - ctx.originVec.x;
          const dz = toZ - ctx.originVec.z;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          fs.rotation = Math.atan2(dx / len, dz / len);
          fs.startTime = performance.now();
          fs.color = comboColor;
          fs.isCyclone = isFinisher;
          ctx.fighterSpellPtr.current = (ctx.fighterSpellPtr.current + 1) % pool.length;
        }
      }

      if (isFinisher && ctx.cameraShake) {
        ctx.cameraShake(0.55);
      }

      const comboMult = isFinisher ? 1.5 : (ctx.combo === 1 ? 1.25 : 1.0);
      BaseAttackCalculator(target, ctx, comboMult, isFinisher, false);
    } else {
      // Free fire swipe visual
      ctx.camera.getWorldDirection(ctx.camDir);
      ctx.camDir.y = 0;
      ctx.camDir.normalize();
      const slashX = ctx.charPos.x + ctx.camDir.x * 2.0;
      const slashY = ctx.charPos.y + 0.5;
      const slashZ = ctx.charPos.z + ctx.camDir.z * 2.0;

      if (ctx.fighterSpellsRef?.current) {
        const pool = ctx.fighterSpellsRef.current;
        const fs = pool[ctx.fighterSpellPtr.current];
        if (fs) {
          fs.active = true;
          fs.x = slashX; fs.y = slashY; fs.z = slashZ;
          fs.targetX = slashX; fs.targetZ = slashZ;
          fs.rotation = Math.atan2(ctx.camDir.x, ctx.camDir.z);
          fs.startTime = performance.now();
          fs.color = comboColor;
          fs.isCyclone = false;
          ctx.fighterSpellPtr.current = (ctx.fighterSpellPtr.current + 1) % pool.length;
        }
      }
    }
  },

  executeSkill(target, ctx, _skillId) {
    const castX = target ? target.position[0] : ctx.charPos.x;
    const castY = target ? target.position[1] : ctx.charPos.y;
    const castZ = target ? target.position[2] : ctx.charPos.z;

    // --- SKILL: Putaran Badai (Cyclone Slash / Whirlwind) ---
    if (ctx.fighterSpellsRef?.current) {
      const pool = ctx.fighterSpellsRef.current;
      const fs = pool[ctx.fighterSpellPtr.current];
      if (fs) {
        fs.active = true;
        fs.x = castX;
        fs.y = castY;
        fs.z = castZ;
        fs.startTime = performance.now();
        fs.color = "#ea580c"; // Fiery orange cyclone
        fs.isCyclone = true;
        ctx.fighterSpellPtr.current = (ctx.fighterSpellPtr.current + 1) % pool.length;
      }
    }

    if (ctx.cameraShake) {
      ctx.cameraShake(0.85); // Heavy screen shake
    }

    if (ctx.grid && ctx.dealPlayerDamage) {
      const nearby = ctx.grid.queryRadius(castX, castZ, 6.5);
      setTimeout(() => {
        nearby.forEach((u: any) => {
          if (u.type === "enemy" && u.isActive && !u.isDying) {
            const targetMaxHp = (u as any).maxHp || 1000;
            const damage = targetMaxHp * (0.35 + Math.random() * 0.10);
            ctx.dealPlayerDamage?.(u.id, damage, true);
          }
        });
      }, 350);
    }
    ctx.spawnVFX([castX, castY + 1.2, castZ], "shockwave", "#ea580c");
  }
};

export default WarriorStrategy;
