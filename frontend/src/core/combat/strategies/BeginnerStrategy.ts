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
import { getProjectileSpawnConfig } from "@/src/components/game/avatar/weaponConfigs";
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
        // This is intentional — the "magic charge" glow appears as the hand
        // pulls the string back (frame 0 of the clip).
        ctx.spawnVFX(
            [ctx.originVec.x, ctx.originVec.y, ctx.originVec.z],
            "magic",
            comboColor,
        );

        // ── Queue arrow for event-driven release ──
        // The arrow snapshot is stored here. It fires the moment AvatarModel's
        // AnimationMixer fires its 'loop' event (clip completes one full cycle).
        // No timing computation needed — the engine is the clock.
        const queueTime = performance.now();
        pendingLocalArrows.push({
            startTime: queueTime,
            target,
            ctx: {
                combo: ctx.combo,
                spawnVFX: ctx.spawnVFX,
                mmSpellsRef: ctx.mmSpellsRef,
                mmSpellPtr: ctx.mmSpellPtr,
                cameraShake: ctx.cameraShake,
                poolRef: ctx.poolRef,
                dealPlayerDamage: ctx.dealPlayerDamage,
                playerStats: ctx.playerStats,
            },
            isFinisher,
            comboColor,
            isEagleEyeActive,
            originX: ctx.originVec.x,
            originY: ctx.originVec.y,
            originZ: ctx.originVec.z,
            dirX: ctx.camDir.x,
            dirY: ctx.camDir.y,
            dirZ: ctx.camDir.z,
        });

        // ── Safety net: force-release if AnimationMixer loop event doesn't fire ──
        // The loop event SHOULD fire when the "Standing Draw Arrow" clip completes
        // one cycle. But edge cases (action weight near zero during crossfade,
        // mixer update skipped, etc.) can prevent it. This setTimeout acts as a
        // watchdog: if the arrow hasn't been released by the loop event within
        // the expected attack interval, force-release it now.
        const stats = ctx.playerStats || {};
        const aspd = stats.aspd ?? stats.ASPD ?? 150;
        const roASPD = 130 + (Math.min(1000, Math.max(0, aspd)) / 1000) * 63;
        const hps = 50 / (200 - roASPD);
        const attackIntervalMs = 1000 / hps;
        setTimeout(() => {
            // Search by startTime instead of fixed index — the array shifts
            // when arrows are released via the loop event (FIFO splice).
            const idx = pendingLocalArrows.findIndex(a => a.startTime === queueTime);
            if (idx !== -1) {
                // Loop event didn't fire for this arrow — force release now
                pendingLocalArrows.splice(idx, 1);
                releaseNextPendingArrow(performance.now());
            }
            // If idx === -1, the loop event already released this arrow — no-op
        }, attackIntervalMs);
    },

    executeSkill(target, ctx) {
        // ── SKILL: Double Strafe (Tembakan Ganda) ──
        const now = performance.now();
        (window as any).lastEagleEyeTime = now;

        const spawnConfig = getProjectileSpawnConfig("Beginner");

        const fireArrow = (isSecond: boolean): void => {
            if (!ctx.mmSpellsRef?.current) return;
            const pool = ctx.mmSpellsRef.current;
            const s = pool[ctx.mmSpellPtr.current];
            if (!s) return;

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
            s.color = "#ffd700";
            s.isSniper = true;
            s.isFinisher = isSecond;
            s.bulletSpeed = 150.0;
            s.playerClass = "Beginner";

            ctx.mmSpellPtr.current = (ctx.mmSpellPtr.current + 1) % pool.length;

            // Damage: dealt at arrow FIRE time (server-side authoritative games
            // use hit-scan on the server; for a client-authoritative setup this
            // is equivalent to lag-compensated hit detection).
            if (target && ctx.dealPlayerDamage) {
                const damage = 14000 + Math.random() * 1500;
                ctx.dealPlayerDamage(target.id, damage, isSecond);
            }
        };

        // 1st arrow — immediate
        fireArrow(false);
        ctx.spawnVFX(
            [ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z],
            "magic",
            "#ffd700",
        );

        // 2nd arrow — 120 ms later (RO Double Strafe cadence)
        setTimeout(() => {
            fireArrow(true);
            ctx.spawnVFX(
                [ctx.charPos.x, ctx.charPos.y + 1.2, ctx.charPos.z],
                "magic",
                "#ffd700",
            );
        }, 120);

        if (ctx.cameraShake) {
            ctx.cameraShake(0.35);
        }
    },
};

export default BeginnerStrategy;
