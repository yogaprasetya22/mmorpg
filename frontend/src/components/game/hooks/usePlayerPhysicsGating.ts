"use client";

import { characterStatus } from "@jagres/bvhecctrl";
import {
    _charPos,
    _velVec,
    _downRayOrigin,
    _downRayDir,
    _downRaycaster,
} from "@/src/entities/player/buffers";

export function usePlayerPhysicsGating(ecctrlRef: React.RefObject<any>) {
    const tick = (
        groundH: number,
        getKeys: () => any,
        isChatFocus: boolean,
    ) => {
        // 1. Snapping player back up if they fall below the sculpted ground level
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

        // 2. Snappy Jump Gating
        const jumpKeys = isChatFocus ? {} : getKeys();
        if (jumpKeys.jump && ecctrlRef.current) {
            let canJumpOverride = characterStatus.isOnGround;

            if (!canJumpOverride) {
                _downRayOrigin.copy(_charPos);
                _downRayOrigin.y += 0.5; // offset slightly above feet inside the hips capsule
                _downRaycaster.set(_downRayOrigin, _downRayDir);
                _downRaycaster.far = 1.6; // 0.5 hip offset + 1.1 air clearance

                const allColliders = (window as any).globalColliders || [];
                const hits = _downRaycaster.intersectObjects(
                    allColliders,
                    false,
                );
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
                        _velVec.set(currentVel.x, 9.5, currentVel.z);
                        ecctrlRef.current.setLinVel(_velVec);
                    }
                }
            }
        }
    };

    return { tick };
}
