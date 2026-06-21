// REFACTORED FROM: ClassCombatEngine.ts — Priest (Tank/Support) Strategy
import type { ClassCombatStrategy } from '../types';
import { BaseAttackCalculator } from '../DamageCalculator';

const PriestStrategy: ClassCombatStrategy = {
  comboColors: ["#fbbf24", "#f59e0b", "#fef08a"], // Gold -> Amber -> White Gold
  bulletSpeeds: [90.0, 90.0, 70.0],
  muzzleVFX: "magic",
  isMelee: true,

  executeAttack(target, ctx) {
    const isFinisher = ctx.combo === 2;
    const comboColor = this.comboColors[ctx.combo];

    ctx.spawnVFX([ctx.originVec.x, ctx.originVec.y, ctx.originVec.z], isFinisher ? "shockwave" : this.muzzleVFX, comboColor);

    if (target) {
      const toX = target.position[0];
      const toY = target.position[1] + 1.2;
      const toZ = target.position[2];

      if (ctx.tankSpellsRef?.current) {
        const pool = ctx.tankSpellsRef.current;
        const ts = pool[ctx.tankSpellPtr.current];
        if (ts) {
          ts.active = true;
          ts.x = toX; ts.y = toY - 1.1; ts.z = toZ;
          ts.startTime = performance.now();
          ts.color = comboColor;
          ts.isShield = false;
          ctx.tankSpellPtr.current = (ctx.tankSpellPtr.current + 1) % pool.length;
        }
      }

      if (isFinisher && ctx.cameraShake) {
        ctx.cameraShake(0.55);
      }

      const comboMult = isFinisher ? 1.4 : (ctx.combo === 1 ? 1.2 : 1.0);
      BaseAttackCalculator(target, ctx, comboMult, isFinisher, false);
    } else {
      // Free fire swipe visual
      ctx.camera.getWorldDirection(ctx.camDir);
      ctx.camDir.y = 0;
      ctx.camDir.normalize();
      const slashX = ctx.charPos.x + ctx.camDir.x * 2.0;
      const slashY = ctx.charPos.y + 0.5;
      const slashZ = ctx.charPos.z + ctx.camDir.z * 2.0;

      if (ctx.tankSpellsRef?.current) {
        const pool = ctx.tankSpellsRef.current;
        const ts = pool[ctx.tankSpellPtr.current];
        if (ts) {
          ts.active = true;
          ts.x = slashX; ts.y = slashY; ts.z = slashZ;
          ts.startTime = performance.now();
          ts.color = comboColor;
          ts.isShield = false;
          ctx.tankSpellPtr.current = (ctx.tankSpellPtr.current + 1) % pool.length;
        }
      }
    }
  },

  executeSkill(target, ctx, _skillId) {
    const castX = target ? target.position[0] : ctx.charPos.x;
    const castY = target ? target.position[1] : ctx.charPos.y;
    const castZ = target ? target.position[2] : ctx.charPos.z;

    // --- SKILL: Kuil Dewata (Divine Sanctuary Dome) ---
    if (ctx.tankSpellsRef?.current) {
      const pool = ctx.tankSpellsRef.current;
      const ts = pool[ctx.tankSpellPtr.current];
      if (ts) {
        ts.active = true;
        ts.isShield = true; // glowing sanctuary dome!
        ts.x = castX;
        ts.y = castY;
        ts.z = castZ;
        ts.startTime = performance.now();
        ts.color = "#fbbf24";
        (ts as any).ownerId = "localPlayer";
        ctx.tankSpellPtr.current = (ctx.tankSpellPtr.current + 1) % pool.length;
      }
    }

    if (ctx.cameraShake) {
      ctx.cameraShake(0.3);
    }

    if (ctx.grid && ctx.dealPlayerDamage) {
      const nearby = ctx.grid.queryRadius(castX, castZ, 8.0);
      setTimeout(() => {
        nearby.forEach((u: any) => {
          if (u.type === "enemy" && u.isActive && !u.isDying) {
            const targetMaxHp = (u as any).maxHp || 1000;
            const damage = targetMaxHp * (0.20 + Math.random() * 0.05);
            ctx.dealPlayerDamage?.(u.id, damage, true);
          }
        });
      }, 200);
    }
    ctx.spawnVFX([castX, castY + 1.2, castZ], "magic", "#fbbf24");
  }
};

export default PriestStrategy;
