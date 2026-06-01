// REFACTORED FROM: ClassCombatEngine.ts — Mage Strategy
import type { ClassCombatStrategy } from '../types';
import { BaseAttackCalculator } from '../DamageCalculator';

const MageStrategy: ClassCombatStrategy = {
  comboColors: ["#3b82f6", "#8b5cf6", "#ec4899"], // Blue -> Purple -> Pink
  bulletSpeeds: [85.0, 85.0, 65.0],
  muzzleVFX: "magic",
  isMelee: false,

  executeAttack(target, ctx) {
    const isFinisher = ctx.combo === 2;
    const comboColor = this.comboColors[ctx.combo];

    ctx.spawnVFX([ctx.originVec.x, ctx.originVec.y, ctx.originVec.z], isFinisher ? "shockwave" : this.muzzleVFX, comboColor);

    if (target) {
      const toX = target.position[0];
      const toY = target.position[1] + 1.2;
      const toZ = target.position[2];

      // Targeted Mage projectile
      if (ctx.mmSpellsRef?.current) {
        const pool = ctx.mmSpellsRef.current;
        const s = pool[ctx.mmSpellPtr.current];
        if (s) {
          s.active = true;
          s.isBullet = true;
          s.fromX = ctx.originVec.x;
          s.fromY = ctx.originVec.y;
          s.fromZ = ctx.originVec.z;
          s.toX = toX;
          s.toY = toY;
          s.toZ = toZ;
          s.startTime = ctx.simTimeRef?.current || 0;
          s.color = comboColor;
          s.targetId = target.id;
          (s as any).targetPoolIdx = target.poolIdx;
          (s as any).isSniper = false;
          (s as any).isFinisher = isFinisher;
          (s as any).bulletSpeed = this.bulletSpeeds[ctx.combo];
          (s as any).playerClass = "Mage";

          ctx.mmSpellPtr.current = (ctx.mmSpellPtr.current + 1) % pool.length;
        }
      }

      // Mage hit spell effect layers
      if (ctx.spellsRef?.current) {
        const mPool = ctx.spellsRef.current;
        const ms = mPool[ctx.spellsPtr.current];
        if (ms) {
          ms.active = true;
          ms.isBullet = true;
          ms.fromX = ctx.originVec.x; ms.fromY = ctx.originVec.y; ms.fromZ = ctx.originVec.z;
          ms.toX = toX; ms.toY = toY; ms.toZ = toZ;
          ms.startTime = performance.now();
          ms.color = comboColor;
          ms.isMeteor = isFinisher;
          ms.targetId = target.id;
          (ms as any).targetPoolIdx = target.poolIdx;
          ctx.spellsPtr.current = (ctx.spellsPtr.current + 1) % mPool.length;
        }
      }

      if (isFinisher && ctx.cameraShake) {
        ctx.cameraShake(0.55);
      }

      const comboMult = isFinisher ? 1.5 : (ctx.combo === 1 ? 1.25 : 1.0);
      BaseAttackCalculator(target, ctx, comboMult, isFinisher, false);
    } else {
      ctx.poolRef?.current?.fire(ctx.originVec, ctx.camDir);
    }
  },

  executeSkill(target, ctx) {
    const castX = target ? target.position[0] : ctx.charPos.x;
    const castY = target ? target.position[1] : ctx.charPos.y;
    const castZ = target ? target.position[2] : ctx.charPos.z;

    // --- SKILL: Hujan Meteor (Meteor Rain) ---
    if (ctx.grid && ctx.spellsRef?.current) {
      const pool = ctx.spellsRef.current;
      const nearby = ctx.grid.queryRadius(castX, castZ, 14.0);
      let targetCount = 0;

      nearby.forEach((t: any) => {
        if (t.type === "enemy" && t.isActive && !t.isDying && targetCount < 6) {
          const s = pool[ctx.spellsPtr.current];
          if (s) {
            s.active = true;
            s.isBullet = false; // falls from sky
            s.fromX = t.position[0] + (Math.random() - 0.5) * 4;
            s.fromY = castY + 12.0;
            s.fromZ = t.position[2] + (Math.random() - 0.5) * 4;
            s.toX = t.position[0];
            s.toY = t.position[1] + 0.3;
            s.toZ = t.position[2];
            s.startTime = performance.now();
            s.color = "#ec4899"; // Arcane Pink meteor
            s.targetId = t.id;
            (s as any).isMeteor = true;
            (s as any).bulletSpeed = 35.0;
            (s as any).playerClass = "Mage";

            ctx.spellsPtr.current = (ctx.spellsPtr.current + 1) % pool.length;

            if (ctx.dealPlayerDamage) {
              const targetMaxHp = (t as any).maxHp || 1000;
              const damage = targetMaxHp * (0.25 + Math.random() * 0.05);
              setTimeout(() => {
                ctx.dealPlayerDamage?.(t.id, damage, true);
              }, 450);
            }
            targetCount++;
          }
        }
      });

      if (targetCount > 0 && ctx.cameraShake) {
        ctx.cameraShake(0.95);
      }
    }
    ctx.spawnVFX([castX, castY + 1.2, castZ], "magic", "#ec4899");
  }
};

export default MageStrategy;
