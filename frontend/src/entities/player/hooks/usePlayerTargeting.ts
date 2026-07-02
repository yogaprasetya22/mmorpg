import * as THREE from 'three';
import { UnitRuntimeData } from '@/src/core/domain/unit.types';
import { executeClassAttack } from '@/src/core/combat/ClassCombatEngine';
import { characterStatus } from 'bvhecctrl';
import {
  _charPos,
  _originVec,
  _camDir,
  _fwdVec,
  _fwdAxis,
  _tempFwd,
  _chaseDir,
  _camProjDir,
  _camRightDir,
  aimTargetX,
  aimTargetY,
  aimTargetZ,
  hasTarget,
  charState,
  attackTimer,
  autoFireTimer,
  AUTO_AIM_RADIUS,
  AUTO_AIM_RSQ
} from '../buffers';

export function updatePlayerTargeting(
  now: number,
  delta: number,
  playerClass: string,
  attackDuration: number,
  activeRangeSq: number,
  unitRegistry: React.RefObject<UnitRuntimeData[]> | undefined,
  lastNearestTargetId: React.MutableRefObject<string>,
  isMovingInput: boolean,
  isAttackInput: boolean,
  keys: any,
  ecctrlRef: React.RefObject<any>,
  characterRef: React.RefObject<THREE.Group>,
  camera: THREE.Camera,
  // combat context items
  playerStats: any,
  dealPlayerDamage: any,
  spawnVFX: any,
  simTimeRef: any,
  mmSpellsRef: any,
  mmSpellPtr: any,
  fighterSpellsRef: any,
  fighterSpellPtr: any,
  assassinSpellsRef: any,
  assassinSpellPtr: any,
  tankSpellsRef: any,
  tankSpellPtr: any,
  spellsRef: any,
  spellsPtr: any,
  poolRef: any
) {
  hasTarget[0] = 0;
  let nearestTarget: UnitRuntimeData | null = null;
  const grid = (window as any).battleGrid;

  // First prioritize manual clicked target
  const clickedId = (window as any).clickedTargetId;
  let clickedTarget: UnitRuntimeData | null = null;
  if (clickedId) {
    const units = unitRegistry?.current || [];
    const found = units.find(
      (u: any) => u.id === clickedId && u.type === 'enemy' && u.isActive && !u.isDying
    );
    if (found) {
      clickedTarget = found;
      (window as any).isAutoAttacking = true;
    } else {
      (window as any).clickedTargetId = null; // Clear if target is dead/inactive
      (window as any).isAutoAttacking = false;
    }
  } else {
    (window as any).isAutoAttacking = false;
  }

  if (clickedTarget) {
    aimTargetX[0] = clickedTarget.position[0];
    aimTargetY[0] = clickedTarget.position[1] + 1.2;
    aimTargetZ[0] = clickedTarget.position[2];
    hasTarget[0] = 1;
    nearestTarget = clickedTarget;
  } else if (grid) {
    const nearby = grid.queryRadius(_charPos.x, _charPos.z, AUTO_AIM_RADIUS);
    let closestDistSq = AUTO_AIM_RSQ;

    for (let i = 0; i < nearby.length; i++) {
      const u = nearby[i];
      if (u.type !== 'enemy' || !u.isActive || u.isDying) continue;

      const dx = _charPos.x - u.position[0];
      const dz = _charPos.z - u.position[2];
      const dSq = dx * dx + dz * dz;

      // Prioritize the closest enemy unit within the valid auto-aim radius
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        aimTargetX[0] = u.position[0];
        aimTargetY[0] = u.position[1] + 1.2;
        aimTargetZ[0] = u.position[2];
        hasTarget[0] = 1;
        nearestTarget = u;
      }
    }
  }
  lastNearestTargetId.current = nearestTarget ? nearestTarget.id : '';

  const executeAttack = (target: UnitRuntimeData | null) => {
    const launchY = playerClass === "Beginner" ? 0.55 : 1.35;
    _originVec.set(_charPos.x, _charPos.y + launchY, _charPos.z);
    camera.getWorldDirection(_camDir);

    if (target) {
      _camDir
        .set(
          aimTargetX[0] - _charPos.x,
          aimTargetY[0] - (_charPos.y + launchY),
          aimTargetZ[0] - _charPos.z
        )
        .normalize();
    } else {
      _camDir.y = 0;
      _camDir.normalize();
    }

    _fwdVec.copy(_camDir).multiplyScalar(0.7);
    _originVec.add(_fwdVec);

    if (typeof (window as any).comboIndex === 'undefined') {
      (window as any).comboIndex = 0;
    }
    const combo = (window as any).comboIndex;
    (window as any).comboIndex = (combo + 1) % 3;

    const ctx = {
      charPos: _charPos,
      originVec: _originVec,
      camDir: _camDir,
      combo,
      playerStats,
      dealPlayerDamage,
      spawnVFX,
      camera,
      simTimeRef,
      mmSpellsRef,
      mmSpellPtr,
      fighterSpellsRef,
      fighterSpellPtr,
      assassinSpellsRef,
      assassinSpellPtr,
      tankSpellsRef,
      tankSpellPtr,
      spellsRef,
      spellsPtr,
      poolRef,
      grid,
      ecctrlRef,
      cameraShake: (window as any).cameraShake
    };

    executeClassAttack(playerClass, target as any, ctx);
  };

  // Check Input triggers
  if (isAttackInput && now - autoFireTimer[0] > attackDuration) {
    if (hasTarget[0]) {
      const dx = aimTargetX[0] - _charPos.x;
      const dz = aimTargetZ[0] - _charPos.z;
      const distSq = dx * dx + dz * dz;

      // Use standard range to initiate chase from normal input
      if (distSq > activeRangeSq) {
        charState[0] = 2; // CHASING
      } else {
        // Rotate character to face target instantly
        const worldTargetAngle = Math.atan2(
          aimTargetX[0] - _charPos.x,
          aimTargetZ[0] - _charPos.z
        );
        const fwd = _tempFwd.copy(_fwdAxis);
        fwd.applyQuaternion(characterRef.current!.quaternion);
        if (characterRef.current!.parent) {
          fwd.applyQuaternion(characterRef.current!.parent.quaternion);
        }
        const worldRot = Math.atan2(fwd.x, fwd.z);
        let angleDiff = worldTargetAngle - worldRot;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        characterRef.current!.rotation.y += angleDiff;

        // Start Attacking immediately
        charState[0] = 1; // ATTACKING
        attackTimer[0] = now;
        autoFireTimer[0] = now;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });

        // Hide toast
        const toastOk = document.getElementById('facing-alignment-alert');
        if (toastOk) toastOk.style.opacity = '0';

        executeAttack(nearestTarget);
      }
    } else {
      if ((window as any).isAutoAttacking) {
        // Stop auto-attacking if target is lost/dead
        (window as any).isAutoAttacking = false;
        (window as any).hasAttackIntent = false;
        charState[0] = 0;
      } else {
        // Swing at empty air
        charState[0] = 1; // ATTACKING
        attackTimer[0] = now;
        autoFireTimer[0] = now;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        executeAttack(null);
      }
    }
  }

  // Process Active States
  if (charState[0] === 1) {
    // == STATE: ATTACKING ==
    // Lock horizontal velocity
    const vel = characterStatus.linvel;
    ecctrlRef.current?.setLinVel({ x: 0, y: vel.y, z: 0 } as any);
    ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });

    // Face target dynamically
    if (hasTarget[0]) {
      const worldTargetAngle = Math.atan2(
        aimTargetX[0] - _charPos.x,
        aimTargetZ[0] - _charPos.z
      );
      const fwd = _tempFwd.copy(_fwdAxis);
      fwd.applyQuaternion(characterRef.current!.quaternion);
      if (characterRef.current!.parent) {
        fwd.applyQuaternion(characterRef.current!.parent.quaternion);
      }
      const worldRot = Math.atan2(fwd.x, fwd.z);
      let diff = worldTargetAngle - worldRot;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      characterRef.current!.rotation.y += diff * 15 * delta;
    }

    // Check if animation lock is over — CHAIN next attack immediately
    if (now - attackTimer[0] > attackDuration) {
      if (isMovingInput || keys.jump || !isAttackInput) {
        charState[0] = 0; // Return to normal
      } else if (hasTarget[0] && now - autoFireTimer[0] > attackDuration) {
        // Chain next attack immediately without going through top-level input check
        const dx = aimTargetX[0] - _charPos.x;
        const dz = aimTargetZ[0] - _charPos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq <= activeRangeSq) {
          attackTimer[0] = now;
          autoFireTimer[0] = now;
          executeAttack(nearestTarget);
        } else {
          charState[0] = 2; // Out of range, start chasing
        }
      }
    }
  } else if (charState[0] === 2) {
    // == STATE: CHASING ==
    if (isMovingInput || keys.jump) {
      charState[0] = 0;
      ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
    } else if (hasTarget[0]) {
      const dx = aimTargetX[0] - _charPos.x;
      const dz = aimTargetZ[0] - _charPos.z;
      const distSq = dx * dx + dz * dz;

      const effectiveRangeSq = activeRangeSq * 1.5;
      if (distSq <= effectiveRangeSq) {
        // Reached Target! Rotate character to face target instantly
        const worldTargetAngle = Math.atan2(
          aimTargetX[0] - _charPos.x,
          aimTargetZ[0] - _charPos.z
        );
        const fwd = _tempFwd.copy(_fwdAxis);
        fwd.applyQuaternion(characterRef.current!.quaternion);
        if (characterRef.current!.parent) {
          fwd.applyQuaternion(characterRef.current!.parent.quaternion);
        }
        const worldRot = Math.atan2(fwd.x, fwd.z);
        let angleDiff = worldTargetAngle - worldRot;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        characterRef.current!.rotation.y += angleDiff;

        if (now - autoFireTimer[0] > attackDuration) {
          charState[0] = 1;
          attackTimer[0] = now;
          autoFireTimer[0] = now;
          ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });

          const toastOk2 = document.getElementById('facing-alignment-alert');
          if (toastOk2) toastOk2.style.opacity = '0';

          executeAttack(nearestTarget);
        } else {
          ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        }
      } else {
        // Keep Chasing (Spoof Joystick Input to run to target)
        _chaseDir.set(dx, 0, dz).normalize();

        camera.getWorldDirection(_camProjDir);
        _camProjDir.y = 0;
        _camProjDir.normalize();

        _camRightDir.set(1, 0, 0).applyQuaternion(camera.quaternion);
        _camRightDir.y = 0;
        _camRightDir.normalize();

        const moveY = _chaseDir.dot(_camProjDir);
        const moveX = _chaseDir.dot(_camRightDir);

        ecctrlRef.current?.setMovement({
          joystick: { x: moveX, y: moveY },
          run: true
        });

        const resetLerpT = Math.min(1, 10 * delta);
        characterRef.current!.rotation.y += (0 - characterRef.current!.rotation.y) * resetLerpT;
      }
    } else {
      charState[0] = 0;
      ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
    }
  }
}
