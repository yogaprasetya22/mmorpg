import * as THREE from "three";
import { CastState } from "../types/player.types";
import { characterStatus } from "@jagres/bvhecctrl";
import { executeClassSkill } from "@/src/core/combat/ClassCombatEngine";
import { animationSet, _charPos } from "../buffers";

export function updatePlayerCasting(
    castState: React.MutableRefObject<CastState>,
    now: number,
    playerClass: string,
    ecctrlRef: React.RefObject<any>,
    characterRef: React.RefObject<THREE.Group>,
    actions: Record<string, THREE.AnimationAction | null | undefined>,
    activeAction: React.MutableRefObject<THREE.AnimationAction | null>,
): boolean {
    if (!castState.current.isCasting) return false;

    const elapsed = now - castState.current.startTime;
    const { fctTime, vctTime, totalTime } = castState.current;

    const container = document.getElementById("player-cast-bar-container");
    const fctBar = document.getElementById("player-cast-fct");
    const vctBar = document.getElementById("player-cast-vct");

    if (container && fctBar && vctBar) {
        container.classList.remove("hidden");

        const fctRatio = fctTime / totalTime;
        const vctRatio = vctTime / totalTime;

        if (elapsed < fctTime) {
            const fctPercent = (elapsed / fctTime) * fctRatio * 100;
            fctBar.style.width = `${fctPercent}%`;
            vctBar.style.width = `0%`;
        } else {
            fctBar.style.width = `${fctRatio * 100}%`;
            const vctElapsed = Math.min(vctTime, elapsed - fctTime);
            const vctPercent =
                vctTime > 0 ? (vctElapsed / vctTime) * vctRatio * 100 : 0;
            vctBar.style.width = `${vctPercent}%`;
        }
    }

    if (elapsed >= totalTime) {
        castState.current.isCasting = false;
        if (container) container.classList.add("hidden");

        // Execute skill with skillId routing
        (window as any).lastSkillTime = now;
        executeClassSkill(
            playerClass,
            castState.current.target,
            castState.current.context,
            castState.current.skillId,
        );
    } else {
        // Lock player movement during casting
        const vel = characterStatus.linvel;
        ecctrlRef.current?.setLinVel({ x: 0, y: vel.y, z: 0 } as any);
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });

        // Face target
        const target = castState.current.target;
        if (target && characterRef.current) {
            const toX = target.position[0];
            const toZ = target.position[2];
            const angle = Math.atan2(toX - _charPos.x, toZ - _charPos.z);
            characterRef.current.rotation.y = angle;
        }

        // Force casting animation
        const castAnim =
            actions["Spell"] ||
            actions[animationSet.skill] ||
            actions[animationSet.idle];
        if (castAnim && activeAction.current !== castAnim) {
            castAnim.reset().play();
            if (activeAction.current)
                activeAction.current.crossFadeTo(castAnim, 0.1, true);
            activeAction.current = castAnim;
        }
    }

    return true;
}
