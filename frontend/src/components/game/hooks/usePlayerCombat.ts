'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { characterStatus } from 'bvhecctrl';
import { UnitRuntimeData } from '@/src/core/domain/unit.types';
import { getProjectileSpawnConfig } from '../avatar/weaponConfigs';
import {
  executeClassAttack,
  executeClassSkill,
  CombatExecutionContext
} from '@/src/core/combat/ClassCombatEngine';
import {
  _charPos,
  _originVec,
  _camDir,
  _fwdVec,
  _fwdAxis,
  _tempFwd,
  _tempFwd2,
  _chaseDir,
  _camProjDir,
  _camRightDir,
  aimTargetX,
  aimTargetY,
  aimTargetZ,
  hasTarget,
  autoFireTimer,
  charState,
  attackTimer,
  SKILL_COOLDOWN,
} from '../PlayerController.buffers';

interface PlayerCombatProps {
  playerClass: string;
  playerStats: any;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean) => void;
  spawnVFX: (position: [number, number, number], type: string, color?: string) => void;
  camera: THREE.Camera;
  simTimeRef?: React.RefObject<number>;
  mmSpellsRef?: React.RefObject<any[]>;
  spellsRef?: React.RefObject<any[]>;
  fighterSpellsRef?: React.RefObject<any[]>;
  tankSpellsRef?: React.RefObject<any[]>;
  assassinSpellsRef?: React.RefObject<any[]>;
  poolRef: React.RefObject<any>;
  ecctrlRef: React.RefObject<any>;
  characterRef: React.RefObject<THREE.Group>;
}

export function usePlayerCombat({
  playerClass,
  playerStats,
  dealPlayerDamage,
  spawnVFX,
  camera,
  simTimeRef,
  mmSpellsRef,
  spellsRef,
  fighterSpellsRef,
  tankSpellsRef,
  assassinSpellsRef,
  poolRef,
  ecctrlRef,
  characterRef,
}: PlayerCombatProps) {
  const spellsPtr       = useRef(0);
  const mmSpellPtr      = useRef(0);
  const fighterSpellPtr = useRef(0);
  const tankSpellPtr    = useRef(0);
  const assassinSpellPtr = useRef(0);

  const executeAttack = (target: UnitRuntimeData | null) => {
    const spawnConfig = getProjectileSpawnConfig(playerClass);
    const launchY = spawnConfig.launchY;
    _originVec.set(_charPos.x, _charPos.y + launchY, _charPos.z);
    camera.getWorldDirection(_camDir);
    
    if (target) {
      _camDir.set(
        aimTargetX[0] - _charPos.x,
        aimTargetY[0] - (_charPos.y + launchY),
        aimTargetZ[0] - _charPos.z,
      ).normalize();
    } else {
      _camDir.y = 0;
      _camDir.normalize();
    }

    _fwdVec.copy(_camDir).multiplyScalar(spawnConfig.forwardOffset);
    _originVec.add(_fwdVec);

    if (typeof (window as any).comboIndex === 'undefined') {
      (window as any).comboIndex = 0;
    }
    const combo = (window as any).comboIndex;
    (window as any).comboIndex = (combo + 1) % 3;

    const ctx: CombatExecutionContext = {
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
      grid: (window as any).battleGrid,
      ecctrlRef,
      cameraShake: (window as any).cameraShake,
    };

    executeClassAttack(playerClass, target as any, ctx);
  };

  const tick = (
    delta: number,
    keys: any,
    nearestTarget: UnitRuntimeData | null,
    isMovingInput: boolean
  ) => {
    const now = performance.now();

    // ── Get dynamic active attack range squared ──
    let activeRangeSq = 81.0; // Marksman / MM (9.0m)
    if (playerClass === "Warrior") {
      activeRangeSq = 12.25;    // Fighter (3.5m)
    } else if (playerClass === "Thief") {
      activeRangeSq = 10.89;    // Assassin (3.3m)
    } else if (playerClass === "Priest") {
      activeRangeSq = 14.44;    // Tank (3.8m)
    } else if (playerClass === "Mage") {
      activeRangeSq = 64.0;     // Mage (8.0m)
    } else if (playerClass === "Beginner") {
      activeRangeSq = 81.0;     // MM (9.0m)
    }

    const isAttackInput = keys.action1 || (window as any).hasAttackIntent;
    if ((window as any).hasAttackIntent) {
      (window as any).hasAttackIntent = false;
    }

    // ── Execute Active Q Skill ──
    const isSkillInput = keys.skill;
    if (typeof (window as any).lastSkillTime === 'undefined') {
      (window as any).lastSkillTime = 0;
    }
    const lastSkillTime = (window as any).lastSkillTime;

    if (isSkillInput && now - lastSkillTime > SKILL_COOLDOWN) {
      if (!hasTarget[0] || !nearestTarget) {
        const alertBox = document.getElementById("no-target-alert");
        if (alertBox) {
          alertBox.style.opacity = "1";
          if ((window as any)._targetAlertTimeout) {
            clearTimeout((window as any)._targetAlertTimeout);
          }
          (window as any)._targetAlertTimeout = setTimeout(() => {
            alertBox.style.opacity = "0";
          }, 1200);
        }
        return;
      }

      // Face target angle check
      const worldTargetAngle = Math.atan2(aimTargetX[0] - _charPos.x, aimTargetZ[0] - _charPos.z);
      const fwd = _tempFwd.copy(_fwdAxis);
      fwd.applyQuaternion(characterRef.current!.quaternion);
      if (characterRef.current!.parent) {
        fwd.applyQuaternion(characterRef.current!.parent.quaternion);
      }
      const worldRot = Math.atan2(fwd.x, fwd.z);
      let angleDiff = worldTargetAngle - worldRot;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      if (Math.abs(angleDiff) < 0.6) {
        (window as any).lastSkillTime = now;

        const spawnConfig = getProjectileSpawnConfig(playerClass);
        const launchY = spawnConfig.launchY;
        _originVec.set(_charPos.x, _charPos.y + launchY, _charPos.z);
        camera.getWorldDirection(_camDir);
        _camDir.set(
          aimTargetX[0] - _charPos.x,
          aimTargetY[0] - (_charPos.y + launchY),
          aimTargetZ[0] - _charPos.z,
        ).normalize();
        _fwdVec.copy(_camDir).multiplyScalar(spawnConfig.forwardOffset);
        _originVec.add(_fwdVec);

        const ctx: CombatExecutionContext = {
          charPos: _charPos,
          originVec: _originVec,
          camDir: _camDir,
          combo: 0,
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
          grid: (window as any).battleGrid,
          ecctrlRef,
          cameraShake: (window as any).cameraShake,
        };

        executeClassSkill(playerClass, nearestTarget as any, ctx);
      } else {
        (window as any).pendingSkillExecution = true;
        charState[0] = 3; // TURNING_TO_TARGET
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        const toast = document.getElementById("facing-alignment-alert");
        if (toast) {
          toast.style.opacity = "1";
        }
      }
    }

    // Cooldown overlay HUD DOM sync
    const overlay = document.getElementById("skill-cooldown-overlay");
    if (overlay) {
      const elapsed = now - (window as any).lastSkillTime;
      if (elapsed < SKILL_COOLDOWN) {
        const remaining = ((SKILL_COOLDOWN - elapsed) / 1000).toFixed(1);
        overlay.innerText = `${remaining}S`;
        overlay.style.transform = "translateY(0%)";
      } else {
        overlay.style.transform = "translateY(100%)";
      }
    }

    // Passive visual effects spawner (deferred to setTimeout to prevent React stutter)
    if (typeof (window as any).lastPassiveTick === 'undefined') {
      (window as any).lastPassiveTick = 0;
    }
    if (now - (window as any).lastPassiveTick > 3000) {
      (window as any).lastPassiveTick = now;
      const snapPos: [number, number, number] = [_charPos.x, _charPos.y + 1.2, _charPos.z];
      const snapClass = playerClass;
      const snapHasTarget = !!aimTargetX[0];
      setTimeout(() => {
        if (snapClass === "Priest") {
          spawnVFX(snapPos, "magic", "#10b981");
        } else if (snapClass === "Warrior" && snapHasTarget) {
          spawnVFX(snapPos, "magic", "#f97316");
        }
      }, 0);
    }

    // ── Ragnarok Official ASPD Calculation ──
    const finalASPDPercent = playerStats?.aspd ?? playerStats?.ASPD ?? 150;
    const roASPD = 130 + (Math.min(1000, Math.max(0, finalASPDPercent)) / 1000) * 63;
    const hitsPerSecond = 50 / (200 - roASPD);
    const dynamicAttackInterval = 1000 / hitsPerSecond;

    // ── Input attack handler ──
    if (isAttackInput && now - autoFireTimer[0] > dynamicAttackInterval) {
      if (hasTarget[0]) {
        const dx = aimTargetX[0] - _charPos.x;
        const dz = aimTargetZ[0] - _charPos.z;
        const distSq = dx*dx + dz*dz;
        
        if (distSq > activeRangeSq) {
          charState[0] = 2; // CHASING
        } else {
          // Face target angle check
          const worldTargetAngle = Math.atan2(aimTargetX[0] - _charPos.x, aimTargetZ[0] - _charPos.z);
          const fwd = _tempFwd.copy(_fwdAxis);
          fwd.applyQuaternion(characterRef.current!.quaternion);
          if (characterRef.current!.parent) {
            fwd.applyQuaternion(characterRef.current!.parent.quaternion);
          }
          const worldRot = Math.atan2(fwd.x, fwd.z);
          let angleDiff = worldTargetAngle - worldRot;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

          if (Math.abs(angleDiff) < 0.6) {
            charState[0] = 1; // ATTACKING
            attackTimer[0] = now;
            autoFireTimer[0] = now;
            ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
            
            const toastOk = document.getElementById("facing-alignment-alert");
            if (toastOk) toastOk.style.opacity = "0";
            
            executeAttack(nearestTarget);
          } else {
            charState[0] = 3; // TURNING_TO_TARGET
            ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
            const toast = document.getElementById("facing-alignment-alert");
            if (toast) {
              toast.style.opacity = "1";
            }
          }
        }
      } else {
        charState[0] = 1; // ATTACKING (punches air)
        attackTimer[0] = now;
        autoFireTimer[0] = now;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        executeAttack(null);
      }
    }

    // ── Process Active Combat States ──
    if (charState[0] === 1) {
      // == STATE: ATTACKING ==
      if (isMovingInput || keys.jump) {
        charState[0] = 0; 
      } else {
        const vel = characterStatus.linvel;
        ecctrlRef.current?.setLinVel({ x: 0, y: vel.y, z: 0 } as any);
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        
        if (hasTarget[0]) {
          const worldTargetAngle = Math.atan2(aimTargetX[0] - _charPos.x, aimTargetZ[0] - _charPos.z);
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
      }
    } else if (charState[0] === 2) {
      // == STATE: CHASING ==
      if (isMovingInput || keys.jump) {
        charState[0] = 0;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
      } else if (hasTarget[0]) {
        const dx = aimTargetX[0] - _charPos.x;
        const dz = aimTargetZ[0] - _charPos.z;
        const distSq = dx*dx + dz*dz;
        
        const effectiveRangeSq = activeRangeSq * 1.5;
        if (distSq <= effectiveRangeSq) {
          const worldTargetAngle = Math.atan2(aimTargetX[0] - _charPos.x, aimTargetZ[0] - _charPos.z);
          const fwd = _tempFwd.copy(_fwdAxis);
          fwd.applyQuaternion(characterRef.current!.quaternion);
          if (characterRef.current!.parent) {
            fwd.applyQuaternion(characterRef.current!.parent.quaternion);
          }
          const worldRot = Math.atan2(fwd.x, fwd.z);
          let angleDiff = worldTargetAngle - worldRot;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

          if (Math.abs(angleDiff) < 0.6) {
            charState[0] = 1;
            attackTimer[0] = now;
            autoFireTimer[0] = now;
            ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
            const toastOk2 = document.getElementById("facing-alignment-alert");
            if (toastOk2) toastOk2.style.opacity = "0";
            executeAttack(nearestTarget);
          } else {
            charState[0] = 3;
            ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
            const toast = document.getElementById("facing-alignment-alert");
            if (toast) {
              toast.style.opacity = "1";
            }
          }
        } else {
          // Keep Chasing (Spoof Joystick Input)
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
    } else if (charState[0] === 3) {
      // == STATE: TURNING_TO_TARGET ==
      if (isMovingInput || keys.jump) {
        charState[0] = 0;
        (window as any).pendingSkillExecution = false;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        const toast = document.getElementById("facing-alignment-alert");
        if (toast) toast.style.opacity = "0";
      } else if (hasTarget[0]) {
        const vel = characterStatus.linvel;
        ecctrlRef.current?.setLinVel({ x: 0, y: vel.y, z: 0 } as any);
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        
        const worldTargetAngle = Math.atan2(aimTargetX[0] - _charPos.x, aimTargetZ[0] - _charPos.z);
        const fwd = _tempFwd.copy(_fwdAxis);
        fwd.applyQuaternion(characterRef.current!.quaternion);
        if (characterRef.current!.parent) {
          fwd.applyQuaternion(characterRef.current!.parent.quaternion);
        }
        const worldRot = Math.atan2(fwd.x, fwd.z);
        
        let diff = worldTargetAngle - worldRot;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        characterRef.current!.rotation.y += diff * 18 * delta;

        // Check if finished turning
        const fwdAfter = _tempFwd2.copy(_fwdAxis);
        fwdAfter.applyQuaternion(characterRef.current!.quaternion);
        if (characterRef.current!.parent) {
          fwdAfter.applyQuaternion(characterRef.current!.parent.quaternion);
        }
        const worldRotAfter = Math.atan2(fwdAfter.x, fwdAfter.z);
        let angleDiff = worldTargetAngle - worldRotAfter;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        
        if (Math.abs(angleDiff) < 0.6) {
          const toast = document.getElementById("facing-alignment-alert");
          if (toast) toast.style.opacity = "0";

          if ((window as any).pendingSkillExecution && nearestTarget) {
            (window as any).pendingSkillExecution = false;
            (window as any).lastSkillTime = performance.now();
            
            const spawnConfig = getProjectileSpawnConfig(playerClass);
            const launchY = spawnConfig.launchY;
            _originVec.set(_charPos.x, _charPos.y + launchY, _charPos.z);
            camera.getWorldDirection(_camDir);
            _camDir.set(
              aimTargetX[0] - _charPos.x,
              aimTargetY[0] - (_charPos.y + launchY),
              aimTargetZ[0] - _charPos.z,
            ).normalize();
            _fwdVec.copy(_camDir).multiplyScalar(spawnConfig.forwardOffset);
            _originVec.add(_fwdVec);
            
            const ctx: CombatExecutionContext = {
              charPos: _charPos,
              originVec: _originVec,
              camDir: _camDir,
              combo: 0,
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
              grid: (window as any).battleGrid,
              ecctrlRef,
              cameraShake: (window as any).cameraShake,
            };
            executeClassSkill(playerClass, nearestTarget as any, ctx);
            charState[0] = 0; // Completed
          } else {
            charState[0] = 1;
            attackTimer[0] = performance.now();
            autoFireTimer[0] = performance.now();
            executeAttack(nearestTarget);
          }
        }
      } else {
        charState[0] = 0;
        (window as any).pendingSkillExecution = false;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        const toast = document.getElementById("facing-alignment-alert");
        if (toast) toast.style.opacity = "0";
      }
    }
  };

  return { tick };
}
