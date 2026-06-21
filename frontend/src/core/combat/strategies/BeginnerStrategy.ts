// ============================================================
//  BeginnerStrategy.ts — Marksman / Archer Class Combat
// ============================================================
//
//  SYNC ARCHITECTURE — Event-Driven, Zero Math, Zero Drift
//  ────────────────────────────────────────────────────────
//  All previous approaches (setTimeout, wall-clock ratio, accumulating
//  clock) tried to GUESS when the animation would complete.  They all
//  suffered from drift at non-default ASPD values.
//
//  This version hooks directly into Three.js AnimationMixer's 'loop'
//  event, which fires INSIDE mixer.update() at the EXACT tick the clip
//  finishes one full cycle.  No approximation.  No drift.  No ASPD
//  sensitivity.
//
//  Flow:
//    1. executeAttack() queues an arrow snapshot in pendingLocalArrows
//    2. AvatarModel registers:  mixer.addEventListener('loop', handler)
//    3. When "Standing Draw Arrow" completes one full loop:
//         → handler calls releaseNextPendingArrow(now)
//         → arrow spawns immediately — zero latency
//
//  ASPD → higher timeScale → faster animation → loop event fires sooner.
//  The Three.js engine handles all timing natively.
// ============================================================

import type { ClassCombatStrategy } from "../types";
import { BaseAttackCalculator } from "../DamageCalculator";
import * as THREE from "three";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Max age for a queued arrow (ms). Safety net if loop event never fires. */
const MAX_ARROW_AGE_MS = 3000;

/** Eagle Eye skill active window (ms). */
const EAGLE_EYE_DURATION_MS = 6000;

// ── Legacy stubs (PlayerController.tsx still imports these) ───────────────────
// No-ops: the real work is now done via releaseNextPendingArrow().
// You can remove these AND the corresponding imports in PlayerController.tsx
// once the event-driven architecture is confirmed stable.
export const archerAnimClock        = new Float64Array(3);
export const advanceArcherAnimClock = (): void => { /* no-op */ };
export const tickPendingLocalArrows = (_now: number): void => { /* no-op */ };

// ── Pending Arrow Queue ───────────────────────────────────────────────────────

/**
 * Snapshot of all data needed to spawn an arrow.
 * Captured at executeAttack() time.  Released when the AnimationMixer
 * 'loop' event fires (i.e. when the clip finishes one full cycle).
 */
export interface PendingLocalArrow {
    /** Wall-clock ms when executeAttack() was called — for stale detection. */
    startTime: number;
    target: any;
    ctx: {
        combo: number;
        spawnVFX: any;
        mmSpellsRef: any;
        mmSpellPtr: any;
        cameraShake: any;
        poolRef: any;
        dealPlayerDamage: any;
        playerStats: any;
    };
    isFinisher: boolean;
    comboColor: string;
    isEagleEyeActive: boolean;
    /** World-space bow-hand position at attack start */
    originX: number;
    originY: number;
    originZ: number;
    /** Camera forward direction at attack start */
    dirX: number;
    dirY: number;
    dirZ: number;
}

export const pendingLocalArrows: PendingLocalArrow[] = [];

// Pre-allocated reusable vectors — avoids per-frame GC
const _originVec = new THREE.Vector3();
const _camDirVec = new THREE.Vector3();

// ── Event-Driven Release API ──────────────────────────────────────────────────

/**
 * Called by AvatarModel's AnimationMixer 'loop' event handler the INSTANT
 * the "Standing Draw Arrow" clip completes one full cycle.
 *
 * Pops the oldest arrow (FIFO) from the queue and spawns it immediately.
 * No timing math — Three.js engine is the authoritative clock.
 *
 * @param now  performance.now() from the event callback frame
 */
export const releaseNextPendingArrow = (now: number): void => {
    if (pendingLocalArrows.length === 0) return;
    const arrow = pendingLocalArrows.shift()!; // FIFO
    if (now - arrow.startTime > MAX_ARROW_AGE_MS) return; // discard stale
    _releaseArrow(arrow);
};

/**
 * Safety net: flush arrows older than MAX_ARROW_AGE_MS.
 * Call once per frame from PlayerController.useFrame.
 * Handles edge cases where the loop event never fired.
 */
export const flushStaleArrows = (now: number): void => {
    while (
        pendingLocalArrows.length > 0 &&
        now - pendingLocalArrows[0].startTime > MAX_ARROW_AGE_MS
    ) {
        pendingLocalArrows.shift();
    }
};



function _releaseArrow(arrow: PendingLocalArrow): void {
    const {
        target,
        ctx,
        isFinisher,
        comboColor,
        isEagleEyeActive,
        originX,
        originY,
        originZ,
        dirX,
        dirY,
        dirZ,
    } = arrow;

    // Release VFX at bow hand position
    ctx.spawnVFX(
        [originX, originY, originZ],
        isFinisher ? "shockwave" : "magic",
        comboColor,
    );

    if (target && target.isActive && !target.isDying) {
        const toX = target.position[0];
        const toY = target.position[1] + 0.2;
        const toZ = target.position[2];

        if (ctx.mmSpellsRef?.current) {
            const pool = ctx.mmSpellsRef.current;
            const s = pool[ctx.mmSpellPtr.current];
            if (s) {
                s.active = true;
                s.isBullet = true;
                s.fromX = originX;
                s.fromY = originY;
                s.fromZ = originZ;
                s.toX = toX;
                s.toY = toY;
                s.toZ = toZ;
                s.startTime = performance.now();
                s.color = isEagleEyeActive ? "#ffd700" : comboColor;
                s.targetId = target.id;
                s.targetPoolIdx = target.poolIdx;
                s.isSniper = isEagleEyeActive;
                s.isFinisher = isEagleEyeActive ? true : isFinisher;
                s.bulletSpeed = isEagleEyeActive
                    ? 160.0
                    : isFinisher
                      ? 80.0
                      : 100.0;
                s.playerClass = "Beginner";

                ctx.mmSpellPtr.current =
                    (ctx.mmSpellPtr.current + 1) % pool.length;
            }
        }

        if (isFinisher) {
            ctx.spawnVFX([toX, toY - 1.2, toZ], "shockwave", comboColor);
        }

        if ((isFinisher || isEagleEyeActive) && ctx.cameraShake) {
            ctx.cameraShake(0.55);
        }

        const comboMult = isFinisher ? 1.5 : ctx.combo === 1 ? 1.25 : 1.0;
        BaseAttackCalculator(
            target,
            ctx as any,
            comboMult,
            isFinisher,
            isEagleEyeActive,
        );
    } else {
        // No valid target — fire into world space along camera direction
        if (ctx.poolRef?.current) {
            _originVec.set(originX, originY, originZ);
            _camDirVec.set(dirX, dirY, dirZ);
            ctx.poolRef.current.fire(_originVec, _camDirVec);
        }
    }
}

// ── Strategy Definition ───────────────────────────────────────────────────────

const BeginnerStrategy: ClassCombatStrategy = {
    comboColors: ["#10b981", "#34d399", "#a7f3d0"],
    bulletSpeeds: [100.0, 100.0, 80.0],
    muzzleVFX: "magic",
    isMelee: false,

    executeAttack(target, ctx) {
        const isFinisher = ctx.combo === 2;
        const comboColor = this.comboColors[ctx.combo];
        const isEagleEyeActive =
            performance.now() - ((window as any).lastEagleEyeTime || 0) <
            EAGLE_EYE_DURATION_MS;

        // ── Draw VFX: fires immediately when the archer begins drawing ──
        ctx.spawnVFX(
            [ctx.originVec.x, ctx.originVec.y, ctx.originVec.z],
            "magic",
            comboColor,
        );

        // ── 1. Calculate & send damage IMMEDIATELY ────────────────────────────
        // Damage goes to the server + client-side HUD prediction right away.
        // This does NOT depend on the animation loop event.
        if (target && target.isActive && !target.isDying) {
            const comboMult = isFinisher ? 1.5 : ctx.combo === 1 ? 1.25 : 1.0;
            BaseAttackCalculator(
                target,
                ctx as any,
                comboMult,
                isFinisher,
                isEagleEyeActive,
            );
        } else if (ctx.poolRef?.current) {
            // No valid target — fire dummy projectile into world space
            ctx.poolRef.current.fire(ctx.originVec, ctx.camDir);
        }

        // ── 2. Schedule arrow projectile with DIRECT delayed release ──────────
        // Instead of relying on the AnimationMixer 'loop' event (which can
        // silently fail to fire for certain attacks — e.g. hit 9/10), we
        // directly schedule the arrow spawn via setTimeout. The delay matches
        // the animation's "string release" point (~70% through the clip).
        const stats = ctx.playerStats || {};
        const aspd = stats.aspd ?? stats.ASPD ?? 150;
        const roASPD = 130 + (Math.min(1000, Math.max(0, aspd)) / 1000) * 63;
        const hps = 50 / (200 - roASPD);
        const attackIntervalMs = 1000 / hps;
        const releaseDelay = attackIntervalMs * 0.7;

        // Capture all arrow data NOW (target position, origin, etc.)
        // since these module-level vectors will be overwritten by the next attack.
        const originX = ctx.originVec.x;
        const originY = ctx.originVec.y;
        const originZ = ctx.originVec.z;
        const snapTarget = target;
        const snapMmSpellsRef = ctx.mmSpellsRef;
        const snapMmSpellPtr = ctx.mmSpellPtr;
        const snapSpawnVFX = ctx.spawnVFX;
        const snapCameraShake = ctx.cameraShake;
        const snapPoolRef = ctx.poolRef;
        const camDirX = ctx.camDir.x;
        const camDirY = ctx.camDir.y;
        const camDirZ = ctx.camDir.z;

        setTimeout(() => {
            // Release VFX at bow hand position
            snapSpawnVFX(
                [originX, originY, originZ],
                isFinisher ? "shockwave" : "magic",
                comboColor,
            );

            if (snapTarget && snapTarget.isActive && !snapTarget.isDying) {
                const toX = snapTarget.position[0];
                const toY = snapTarget.position[1] + 0.2;
                const toZ = snapTarget.position[2];

                if (snapMmSpellsRef?.current) {
                    const pool = snapMmSpellsRef.current;
                    const s = pool[snapMmSpellPtr.current];
                    if (s) {
                        s.active = true;
                        s.isBullet = true;
                        s.fromX = originX;
                        s.fromY = originY;
                        s.fromZ = originZ;
                        s.toX = toX;
                        s.toY = toY;
                        s.toZ = toZ;
                        s.startTime = performance.now();
                        s.color = isEagleEyeActive ? "#ffd700" : comboColor;
                        s.targetId = snapTarget.id;
                        s.targetPoolIdx = snapTarget.poolIdx;
                        s.isSniper = isEagleEyeActive;
                        s.isFinisher = isEagleEyeActive ? true : isFinisher;
                        s.bulletSpeed = isEagleEyeActive
                            ? 160.0
                            : isFinisher
                              ? 80.0
                              : 100.0;
                        s.playerClass = "Beginner";

                        snapMmSpellPtr.current =
                            (snapMmSpellPtr.current + 1) % pool.length;
                    }
                }

                if (isFinisher) {
                    snapSpawnVFX([toX, toY - 1.2, toZ], "shockwave", comboColor);
                }

                if ((isFinisher || isEagleEyeActive) && snapCameraShake) {
                    snapCameraShake(0.55);
                }
            } else {
                // No valid target — fire into world space along camera direction
                if (snapPoolRef?.current) {
                    _originVec.set(originX, originY, originZ);
                    _camDirVec.set(camDirX, camDirY, camDirZ);
                    snapPoolRef.current.fire(_originVec, _camDirVec);
                }
            }
        }, releaseDelay);
    },

    executeSkill(target, ctx, skillId) {
        // Route to the correct Archer skill
        if (skillId) {
            const { executeArcherSkill } = require('../archerSkills');
            executeArcherSkill(skillId, target, ctx);
            return;
        }

        // Fallback: Double Strafe (legacy behavior when no skillId provided)
        const { executeArcherSkill } = require('../archerSkills');
        executeArcherSkill('double_strafe', target, ctx);
    },
};

export default BeginnerStrategy;
