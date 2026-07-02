import { characterStatus } from "bvhecctrl";
import { useEditorStore } from "@/src/features/world-editor/store/useEditorStore";
import { getTerrainElevation } from "@jagres/shared";
import {
    _charPos,
    _velVec,
    _downRayOrigin,
    _downRayDir,
    _downRaycaster,
    charState,
    hasCamInit,
} from "../buffers";

export function handlePlayerResurrectionAndFailsafe(
    lastHpRef: React.MutableRefObject<number>,
    currentHp: number,
    isDead: boolean,
    groundH: number,
    ecctrlRef: React.RefObject<any>,
) {
    // Resurrection Teleport on client side when HP resets to full
    if (lastHpRef.current <= 0 && currentHp > 0) {
        if (ecctrlRef.current) {
            const activeEnv = useEditorStore.getState().environment;
            const terrainConfig = useEditorStore.getState().terrainConfig;
            const spawnH = getTerrainElevation(
                0,
                0,
                activeEnv,
                24,
                terrainConfig,
            );
            ecctrlRef.current.group.position.set(0, spawnH + 3.0, 0);
            ecctrlRef.current.resetLinVel();

            // Update local position buffer immediately to prevent sending stale dead coordinates
            _charPos.set(0, spawnH + 3.0, 0);
            // Snap camera instantly to respawn location
            hasCamInit[0] = 0;

            console.log(
                "🛡️ Player resurrected! Teleporting back to starter town center above ground height:",
                spawnH + 3.0,
            );
        }
    }
    lastHpRef.current = currentHp;

    if (isDead) {
        // Force zero velocity and lock to ground to prevent gliding
        if (ecctrlRef.current) {
            ecctrlRef.current.resetLinVel();
            ecctrlRef.current.setMovement?.({ joystick: { x: 0, y: 0 } });
            // Position capsule center above terrain so model sits ON ground, not inside it
            ecctrlRef.current.group.position.y = groundH + 1.18;
        }
        charState[0] = 0; // Return to normal state
    } else {
        // Failsafe: Snapping player back up if they fall below the sculpted ground level
        if (_charPos.y < groundH - 3.0) {
            if (ecctrlRef.current) {
                ecctrlRef.current.group.position.y = groundH + 5.0;
                ecctrlRef.current.resetLinVel();
                _charPos.y = groundH + 5.0;
                console.warn(
                    "⚠️ Player fell through map! Snapped back to ground height:",
                    groundH + 5.0,
                );
            }
        }
    }
}

export function handlePlayerPhysicsJump(
    isChatFocus: boolean,
    getKeys: () => any,
    ecctrlRef: React.RefObject<any>,
) {
    const jumpKeys = isChatFocus ? {} : getKeys();
    if (jumpKeys.jump && ecctrlRef.current) {
        let canJumpOverride = characterStatus.isOnGround;

        if (!canJumpOverride) {
            _downRayOrigin.copy(_charPos);
            _downRayOrigin.y += 0.5; // offset slightly above feet inside the hips capsule
            _downRaycaster.set(_downRayOrigin, _downRayDir);
            _downRaycaster.far = 1.6; // 0.5 hip offset + 1.1 air clearance

            const allColliders = (window as any).globalColliders || [];
            const hits = _downRaycaster.intersectObjects(allColliders, false);
            if (hits.length > 0) {
                canJumpOverride = true;
            }
        }

        if (canJumpOverride) {
            const now = performance.now();
            if (typeof (window as any).lastJumpTime === "undefined") {
                (window as any).lastJumpTime = 0;
            }
            if (now - (window as any).lastJumpTime > 300) {
                (window as any).lastJumpTime = now;

                if (ecctrlRef.current.setLinVel) {
                    const currentVel = characterStatus.linvel;
                    // Snappy jump: set Y velocity to 9.5 for quick upwards thrust!
                    _velVec.set(currentVel.x, 9.5, currentVel.z);
                    ecctrlRef.current.setLinVel(_velVec);
                }
            }
        }
    }
}
