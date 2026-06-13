// REFACTORED FROM: ClassCombatEngine.ts — Beginner (Marksman) Strategy
import type { ClassCombatStrategy } from '../types';
import { BaseAttackCalculator } from '../DamageCalculator';
import { getProjectileSpawnConfig } from "@/src/components/game/avatar/weaponConfigs";

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
      const toY = target.position[1] + .2;
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

      if (isFinisher) {
        // RO Charge Arrow wind blast under the target feet!
        ctx.spawnVFX([toX, toY - 1.2, toZ], "shockwave", comboColor);
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
    // --- SKILL: Double Strafe (Tembakan Ganda) ---
    const now = performance.now();
    (window as any).lastEagleEyeTime = now; // Triggers golden concentration aura above player

    const fireArrow = (isSecond: boolean) => {
      if (!ctx.mmSpellsRef?.current) return;
      const pool = ctx.mmSpellsRef.current;
      const s = pool[ctx.mmSpellPtr.current];
      if (s) {
        const spawnConfig = getProjectileSpawnConfig("Beginner");
        s.active = true;
        s.isBullet = true;
        s.fromX = ctx.charPos.x;
        s.fromY = ctx.charPos.y + spawnConfig.launchY;
        s.fromZ = ctx.charPos.z;

        if (target) {
          s.toX = target.position[0];
          s.toY = target.position[1] + 1.2;
          s.toZ = target.position[2];
          s.targetId = target.id;
          (s as any).targetPoolIdx = target.poolIdx;
        } else {
          ctx.camera.getWorldDirection(ctx.camDir);
          ctx.camDir.y = 0;
          ctx.camDir.normalize();
          s.toX = ctx.charPos.x + ctx.camDir.x * 25.0;
          s.toY = ctx.charPos.y + spawnConfig.launchY;
          s.toZ = ctx.charPos.z + ctx.camDir.z * 25.0;
          s.targetId = "";
          (s as any).targetPoolIdx = undefined;
        }

        s.startTime = performance.now();
        s.color = "#ffd700"; // Golden Double Strafe arrow
        (s as any).isSniper = true;
        (s as any).isFinisher = isSecond;
        (s as any).bulletSpeed = 150.0; // Extremely fast projectile speed
        (s as any).playerClass = "Beginner";

        ctx.mmSpellPtr.current = (ctx.mmSpellPtr.current + 1) % pool.length;
      }

      if (target && ctx.dealPlayerDamage) {
        // Double Strafe deals high single-target damage per hit
        const damage = 14000 + Math.random() * 1500;
        ctx.dealPlayerDamage(target.id, damage, isSecond);
      }
    };

    // Fire 1st arrow immediately
    fireArrow(false);
    ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "magic", "#ffd700");

    // Fire 2nd arrow 120ms later for RO Double Strafe pacing
    setTimeout(() => {
      fireArrow(true);
      ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "magic", "#ffd700");
    }, 120);

    if (ctx.cameraShake) {
      ctx.cameraShake(0.35);
    }
  }
};

export default BeginnerStrategy;
