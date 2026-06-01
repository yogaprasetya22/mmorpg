// REFACTORED FROM: ClassCombatEngine.ts — Beginner (Marksman) Strategy
import type { ClassCombatStrategy } from '../types';
import { BaseAttackCalculator } from '../DamageCalculator';

const BeginnerStrategy: ClassCombatStrategy = {
  comboColors: ["#10b981", "#34d399", "#a7f3d0"], // Green -> Emerald -> Mint
  bulletSpeeds: [100.0, 100.0, 80.0],
  muzzleVFX: "magic",
  isMelee: false,

  executeAttack(target, ctx) {
    const isFinisher = ctx.combo === 2;
    const comboColor = this.comboColors[ctx.combo];

    const isEagleEyeActive = performance.now() - ((window as any).lastEagleEyeTime || 0) < 6000;

    ctx.spawnVFX([ctx.originVec.x, ctx.originVec.y, ctx.originVec.z], isFinisher ? "shockwave" : this.muzzleVFX, comboColor);

    if (target) {
      const toX = target.position[0];
      const toY = target.position[1] + 1.2;
      const toZ = target.position[2];

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
          s.color = isEagleEyeActive ? "#ffd700" : comboColor;
          s.targetId = target.id;
          (s as any).targetPoolIdx = target.poolIdx;
          (s as any).isSniper = isEagleEyeActive;
          (s as any).isFinisher = isEagleEyeActive ? true : isFinisher;
          (s as any).bulletSpeed = isEagleEyeActive ? 160.0 : this.bulletSpeeds[ctx.combo];
          (s as any).playerClass = "Beginner";

          ctx.mmSpellPtr.current = (ctx.mmSpellPtr.current + 1) % pool.length;
        }
      }

      if ((isFinisher || isEagleEyeActive) && ctx.cameraShake) {
        ctx.cameraShake(0.55);
      }

      const comboMult = isFinisher ? 1.5 : (ctx.combo === 1 ? 1.25 : 1.0);
      BaseAttackCalculator(target, ctx, comboMult, isFinisher, isEagleEyeActive);
    } else {
      ctx.poolRef?.current?.fire(ctx.originVec, ctx.camDir);
    }
  },

  executeSkill(target, ctx) {
    // --- SKILL: Eagle Eye / Bullet Storm Ultimate (Mata Elang) ---
    const now = performance.now();
    (window as any).lastEagleEyeTime = now;

    // Dash forward 5.0 meters with dust trails
    ctx.camera.getWorldDirection(ctx.camDir);
    ctx.camDir.y = 0;
    ctx.camDir.normalize();
    const dashX = ctx.charPos.x + ctx.camDir.x * 5.0;
    const dashZ = ctx.charPos.z + ctx.camDir.z * 5.0;

    if (ctx.ecctrlRef?.current) {
      if (ctx.ecctrlRef.current.group) {
        ctx.ecctrlRef.current.group.position.set(dashX, ctx.charPos.y + 0.1, dashZ);
      }
      ctx.ecctrlRef.current.resetLinVel?.();
    }

    // Deal massive initial splash damage to target
    if (target && ctx.dealPlayerDamage) {
      const damage = 20000 + Math.random() * 2000;
      ctx.dealPlayerDamage?.(target.id, damage, true);
    }

    // Circular bullet storm: Fire 16 golden high-speed sniper bullets in a radial wave!
    if (ctx.mmSpellsRef?.current) {
      const pool = ctx.mmSpellsRef.current;
      for (let b = 0; b < 16; b++) {
        const s = pool[ctx.mmSpellPtr.current];
        if (s) {
          const angle = (b / 16) * Math.PI * 2;
          s.active = true;
          s.isBullet = true;
          s.fromX = dashX;
          s.fromY = ctx.charPos.y + 1.2;
          s.fromZ = dashZ;
          s.toX = dashX + Math.sin(angle) * 18.0;
          s.toY = ctx.charPos.y + 1.2;
          s.toZ = dashZ + Math.cos(angle) * 18.0;
          s.startTime = performance.now();
          s.color = "#ffd700"; // Golden storm bullets
          s.targetId = "";
          (s as any).targetPoolIdx = undefined;
          (s as any).isSniper = true;
          (s as any).isFinisher = true;
          (s as any).bulletSpeed = 140.0;
          (s as any).playerClass = "Beginner";

          ctx.mmSpellPtr.current = (ctx.mmSpellPtr.current + 1) % pool.length;
        }
      }
    }

    ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "magic", "#ffd700"); // Golden flash
    ctx.spawnVFX([dashX, ctx.charPos.y + 1.2, dashZ], "shockwave", "#ffd700");
  }
};

export default BeginnerStrategy;
