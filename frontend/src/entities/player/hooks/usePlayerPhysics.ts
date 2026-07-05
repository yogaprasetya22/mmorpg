import * as THREE from "three";
import { characterStatus } from "@jagres/bvhecctrl";
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

let _wasJumpLastFrame = false;

export function handlePlayerPhysicsJump(
    isChatFocus: boolean,
    getKeys: () => any,
    ecctrlRef: React.RefObject<any>,
) {
    const jumpKeys = isChatFocus ? {} : getKeys();
    // Rising-edge detection: only jump on fresh press, not hold
    const jumpPressed = jumpKeys.jump && !_wasJumpLastFrame;
    _wasJumpLastFrame = jumpKeys.jump;

    if (jumpPressed && ecctrlRef.current) {
        const nativeOnGround = characterStatus.isOnGround;
        let slopeOverride = false;

        // Only raycast when BVHEcctrl says NOT on ground (steep slope case)
        if (!nativeOnGround) {
            _downRayOrigin.copy(_charPos);
            _downRayOrigin.y += 0.5;
            _downRaycaster.set(_downRayOrigin, _downRayDir);
            _downRaycaster.far = 3.5;

            const allColliders = (window as any).globalColliders || [];
            const hits = _downRaycaster.intersectObjects(allColliders, false);

            const maxSlope = 1.3;
            const minUpDot = Math.cos(maxSlope);

            for (const hit of hits) {
                if (!hit.face) continue;

                const worldNormal = hit.face.normal.clone();
                const normalMatrix = new THREE.Matrix3().getNormalMatrix(
                    hit.object.matrixWorld,
                );
                worldNormal.applyMatrix3(normalMatrix).normalize();

                if (worldNormal.y >= minUpDot) {
                    slopeOverride = true;
                    break;
                }
            }
        }

        // nativeOnGround → BVHEcctrl handles jump internally, no manual needed
        // slopeOverride → manual setLinVel for steep slopes
        const doManualJump = !nativeOnGround && slopeOverride;

        if (doManualJump) {
            if (ecctrlRef.current.setLinVel) {
                const currentVel = characterStatus.linvel;
                _velVec.set(currentVel.x, 9.5, currentVel.z);
                ecctrlRef.current.setLinVel(_velVec);
            }
        }
    }
}
