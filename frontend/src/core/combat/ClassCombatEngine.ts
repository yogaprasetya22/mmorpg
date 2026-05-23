import * as THREE from 'three';

export interface CombatExecutionContext {
  charPos: THREE.Vector3;
  originVec: THREE.Vector3;
  camDir: THREE.Vector3;
  combo: number;
  playerStats: any;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit: boolean) => void;
  spawnVFX: (pos: [number, number, number], type: string, color: string) => void;
  camera: any;
  simTimeRef?: { current: number };
  mmSpellsRef?: { current: any[] };
  mmSpellPtr: { current: number };
  fighterSpellsRef?: { current: any[] };
  fighterSpellPtr: { current: number };
  assassinSpellsRef?: { current: any[] };
  assassinSpellPtr: { current: number };
  tankSpellsRef?: { current: any[] };
  tankSpellPtr: { current: number };
  spellsRef?: { current: any[] };
  spellsPtr: { current: number };
  poolRef?: { current: any };
  grid: any;
  ecctrlRef?: { current: any };
  cameraShake?: (intensity: number) => void;
}

export interface UnitRuntimeData {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isDying: boolean;
  hp: number;
  maxHp: number;
  position: [number, number, number];
  level: number;
  poolIdx: number;
  defense?: number;
}

// ==========================================
// CLASS-SPECIFIC STRATEGIES DEFINITIONS
// ==========================================

export interface ClassCombatStrategy {
  comboColors: string[];
  bulletSpeeds: number[];
  muzzleVFX: string;
  isMelee: boolean;
  
  executeAttack: (target: UnitRuntimeData | null, ctx: CombatExecutionContext) => void;
  executeSkill: (target: UnitRuntimeData | null, ctx: CombatExecutionContext) => void;
}

const BaseAttackCalculator = (
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

  // SYNC FIX: Delay damage slightly to match physical weapon contact visual cues
  const finalDamage = damage;
  const finalCrit = isCrit;
  setTimeout(() => {
    ctx.dealPlayerDamage?.(target.id, finalDamage, finalCrit);
  }, 250);
};

// 1. WARRIOR (FIGHTER) STRATEGY
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

  executeSkill(_target, ctx) {
    // --- SKILL: Putaran Badai (Cyclone Slash / Whirlwind) ---
    if (ctx.fighterSpellsRef?.current) {
      const pool = ctx.fighterSpellsRef.current;
      const fs = pool[ctx.fighterSpellPtr.current];
      if (fs) {
        fs.active = true;
        fs.x = ctx.charPos.x;
        fs.y = ctx.charPos.y;
        fs.z = ctx.charPos.z;
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
      const nearby = ctx.grid.queryRadius(ctx.charPos.x, ctx.charPos.z, 6.5);
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
    ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "shockwave", "#ea580c");
  }
};

// 2. THIEF (ASSASSIN) STRATEGY
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

// 3. PRIEST (TANK/SUPPORT) STRATEGY
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

  executeSkill(_target, ctx) {
    // --- SKILL: Kuil Dewata (Divine Sanctuary Dome) ---
    if (ctx.tankSpellsRef?.current) {
      const pool = ctx.tankSpellsRef.current;
      const ts = pool[ctx.tankSpellPtr.current];
      if (ts) {
        ts.active = true;
        ts.isShield = true; // glowing sanctuary dome!
        ts.x = ctx.charPos.x;
        ts.y = ctx.charPos.y;
        ts.z = ctx.charPos.z;
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
      const nearby = ctx.grid.queryRadius(ctx.charPos.x, ctx.charPos.z, 8.0);
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
    ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "magic", "#fbbf24");
  }
};

// 4. MAGE STRATEGY
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

  executeSkill(_target, ctx) {
    // --- SKILL: Hujan Meteor (Meteor Rain) ---
    if (ctx.grid && ctx.spellsRef?.current) {
      const pool = ctx.spellsRef.current;
      const nearby = ctx.grid.queryRadius(ctx.charPos.x, ctx.charPos.z, 14.0);
      let targetCount = 0;

      nearby.forEach((t: any) => {
        if (t.type === "enemy" && t.isActive && !t.isDying && targetCount < 6) {
          const s = pool[ctx.spellsPtr.current];
          if (s) {
            s.active = true;
            s.isBullet = false; // falls from sky
            s.fromX = t.position[0] + (Math.random() - 0.5) * 4;
            s.fromY = ctx.charPos.y + 12.0;
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
    ctx.spawnVFX([ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z], "magic", "#ec4899");
  }
};

// 5. BEGINNER (MARKSMAN / OTHER) STRATEGY
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
