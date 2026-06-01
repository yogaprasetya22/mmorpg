// REFACTORED FROM: ClassCombatEngine.ts — Thief (Assassin) Strategy
import type { ClassCombatStrategy } from '../types';
import { BaseAttackCalculator } from '../DamageCalculator';

const ThiefStrategy: ClassCombatStrategy = {
  comboColors: ["#7e22ce", "#a855f7", "#d8b4fe"], // Purple -> Amethyst -> Lavender
  bulletSpeeds: [160.0, 160.0, 120.0],
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

      if (ctx.assassinSpellsRef?.current) {
        const pool = ctx.assassinSpellsRef.current;
        const as = pool[ctx.assassinSpellPtr.current];
        if (as) {
          as.active = true;
          as.x = toX; as.y = toY - 1.1; as.z = toZ;
          as.startTime = performance.now();
          as.color = comboColor;
          (as as any).isTeleport = isFinisher;
          ctx.assassinSpellPtr.current = (ctx.assassinSpellPtr.current + 1) % pool.length;
        }
      }

      if (isFinisher && ctx.cameraShake) {
        ctx.cameraShake(0.55);
      }

      const comboMult = isFinisher ? 1.6 : (ctx.combo === 1 ? 1.3 : 1.0);
      BaseAttackCalculator(target, ctx, comboMult, isFinisher, false);
    } else {
      // Free fire swipe visual
      ctx.camera.getWorldDirection(ctx.camDir);
      ctx.camDir.y = 0;
      ctx.camDir.normalize();
      const slashX = ctx.charPos.x + ctx.camDir.x * 2.0;
      const slashY = ctx.charPos.y + 0.5;
      const slashZ = ctx.charPos.z + ctx.camDir.z * 2.0;

      if (ctx.assassinSpellsRef?.current) {
        const pool = ctx.assassinSpellsRef.current;
        const as = pool[ctx.assassinSpellPtr.current];
        if (as) {
          as.active = true;
          as.x = slashX; as.y = slashY; as.z = slashZ;
          as.startTime = performance.now();
          as.color = comboColor;
          (as as any).isTeleport = false;
          ctx.assassinSpellPtr.current = (ctx.assassinSpellPtr.current + 1) % pool.length;
        }
      }
    }
  },

  executeSkill(target, ctx) {
    // --- SKILL: Lompatan Bayang (Shadow Step Teleport Backstab) ---
    const originalX = ctx.charPos.x;
    const originalY = ctx.charPos.y;
    const originalZ = ctx.charPos.z;

    if (target) {
      const tx = target.position[0] + (Math.random() - 0.5) * 0.2;
      const tz = target.position[2] - 1.2;

      if (ctx.assassinSpellsRef?.current) {
        const pool = ctx.assassinSpellsRef.current;

        // 1. Teleport Burst at Origin Position
        const asOrigin = pool[ctx.assassinSpellPtr.current];
        if (asOrigin) {
          asOrigin.active = true;
          asOrigin.x = originalX;
          asOrigin.y = originalY;
          asOrigin.z = originalZ;
          asOrigin.startTime = performance.now();
          asOrigin.color = "#7e22ce";
          (asOrigin as any).isTeleport = true;
          ctx.assassinSpellPtr.current = (ctx.assassinSpellPtr.current + 1) % pool.length;
        }

        // 2. Teleport Burst at Target Arrival Position
        const asArrival = pool[ctx.assassinSpellPtr.current];
        if (asArrival) {
          asArrival.active = true;
          asArrival.x = tx;
          asArrival.y = target.position[1];
          asArrival.z = tz;
          asArrival.startTime = performance.now();
          asArrival.color = "#7e22ce";
          (asArrival as any).isTeleport = true;
          ctx.assassinSpellPtr.current = (ctx.assassinSpellPtr.current + 1) % pool.length;
        }
      }

      if (ctx.ecctrlRef?.current) {
        if (ctx.ecctrlRef.current.group) {
          ctx.ecctrlRef.current.group.position.set(tx, target.position[1] + 0.1, tz);
        }
        ctx.ecctrlRef.current.resetLinVel?.();
      }

      if (ctx.dealPlayerDamage) {
        const targetMaxHp = (target as any).maxHp || 1000;
        const damage = targetMaxHp * (0.60 + Math.random() * 0.10);
        setTimeout(() => {
          ctx.dealPlayerDamage?.(target.id, damage, true);
        }, 200);
      }

      if (ctx.cameraShake) {
        ctx.cameraShake(0.4);
      }
    } else {
      // Dash forward 6.5 meters if no target
      ctx.camera.getWorldDirection(ctx.camDir);
      ctx.camDir.y = 0;
      ctx.camDir.normalize();
      const dashX = ctx.charPos.x + ctx.camDir.x * 6.5;
      const dashZ = ctx.charPos.z + ctx.camDir.z * 6.5;

      if (ctx.assassinSpellsRef?.current) {
        const pool = ctx.assassinSpellsRef.current;

        // 1. Dash Burst at Origin
        const asOrigin = pool[ctx.assassinSpellPtr.current];
        if (asOrigin) {
          asOrigin.active = true;
          asOrigin.x = originalX;
          asOrigin.y = originalY;
          asOrigin.z = originalZ;
          asOrigin.startTime = performance.now();
          asOrigin.color = "#a855f7";
          (asOrigin as any).isTeleport = true;
          ctx.assassinSpellPtr.current = (ctx.assassinSpellPtr.current + 1) % pool.length;
        }

        // 2. Dash Burst at Target
        const asArrival = pool[ctx.assassinSpellPtr.current];
        if (asArrival) {
          asArrival.active = true;
          asArrival.x = dashX;
          asArrival.y = ctx.charPos.y;
          asArrival.z = dashZ;
          asArrival.startTime = performance.now();
          asArrival.color = "#a855f7";
          (asArrival as any).isTeleport = true;
          ctx.assassinSpellPtr.current = (ctx.assassinSpellPtr.current + 1) % pool.length;
        }
      }

      if (ctx.ecctrlRef?.current) {
        if (ctx.ecctrlRef.current.group) {
          ctx.ecctrlRef.current.group.position.set(dashX, ctx.charPos.y + 0.1, dashZ);
        }
        ctx.ecctrlRef.current.resetLinVel?.();
      }
    }
    ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "shockwave", "#7e22ce");
  }
};

export default ThiefStrategy;
