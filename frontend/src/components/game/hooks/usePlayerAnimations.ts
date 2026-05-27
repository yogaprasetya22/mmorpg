'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useAnimationStore, characterStatus } from 'bvhecctrl';
import { charState, ATTACK_DURATION, attackTimer } from '../PlayerController.buffers';

export const animationSet = {
  idle:  'Idle',
  walk:  'Walk',
  run:   'Run',
  jump:  'Jump',
  shoot: 'Shoot_OneHanded',
};

export const ecctrlAnimationSet: Record<string, string> = {
  IDLE:       animationSet.idle,
  WALK:       animationSet.walk,
  RUN:        animationSet.run,
  JUMP_START: animationSet.jump,
  JUMP_IDLE:  animationSet.jump,
  JUMP_FALL:  animationSet.jump,
  JUMP_LAND:  animationSet.idle,
};

export function usePlayerAnimations(
  actions: Record<string, THREE.AnimationAction | null>,
  activeAction: React.MutableRefObject<THREE.AnimationAction | null>,
  playerClass: string
) {
  const prevAnimStatus = useRef<string>("");

  const playDeathAnimation = () => {
    let deathAnim = 'Death';
    if (!actions[deathAnim] && actions['death']) deathAnim = 'death';
    if (!actions[deathAnim] && actions['Death_B']) deathAnim = 'Death_B';
    
    const deathAction = actions[deathAnim];
    if (deathAction) {
      if (deathAction !== activeAction.current) {
        deathAction.reset().setLoop(THREE.LoopOnce, 1);
        deathAction.clampWhenFinished = true;
        deathAction.fadeIn(0.15).play();
        if (activeAction.current) activeAction.current.crossFadeTo(deathAction, 0.2, true);
        activeAction.current = deathAction;
      }
    } else {
      const idleAction = actions[animationSet.idle];
      if (idleAction && idleAction !== activeAction.current) {
        idleAction.reset().fadeIn(0.2).play();
        if (activeAction.current) activeAction.current.crossFadeTo(idleAction, 0.2, true);
        activeAction.current = idleAction;
      }
    }
  };

  const tick = (_delta: number, isDead: boolean) => {
    if (isDead) {
      playDeathAnimation();
      return;
    }

    // == FORCED ATTACK/SKILL ANIMATIONS ==
    const now = performance.now();
    if (charState[0] === 1) {
      let targetAnim = animationSet.shoot;
      if (playerClass === "Warrior" || playerClass === "Thief" || playerClass === "Beginner") {
        if (actions['SwordSlash']) targetAnim = 'SwordSlash';
        else if (actions['1H_Melee_Attack_Chop']) targetAnim = '1H_Melee_Attack_Chop';
      }
      const shootAction = actions[targetAnim] || actions[animationSet.shoot];
      if (shootAction && shootAction !== activeAction.current) {
        shootAction.reset().play();
        if (activeAction.current) activeAction.current.crossFadeTo(shootAction, 0.1, true);
        activeAction.current = shootAction;
      }

      // Check if animation lock is over
      if (now - attackTimer[0] > ATTACK_DURATION) {
        charState[0] = 0; // Return to normal
      }
    } else {
      // == NORMAL STATE SKELETON SYNCHRONIZER ==
      const currentAnimStatus = useAnimationStore.getState().animationStatus;
      if (currentAnimStatus !== prevAnimStatus.current) {
        prevAnimStatus.current = currentAnimStatus;

        const animName   = ecctrlAnimationSet[currentAnimStatus] ?? animationSet.idle;
        const nextAction = actions[animName];

        if (nextAction && nextAction !== activeAction.current) {
          const isJump = animName.toLowerCase().includes('jump');
          const crossfadeDuration = isJump ? 0.04 : 0.12;

          nextAction.reset().play();
          if (activeAction.current) {
            activeAction.current.crossFadeTo(nextAction, crossfadeDuration, true);
          } else {
            nextAction.fadeIn(crossfadeDuration);
          }
          activeAction.current = nextAction;
        }
      }

      // Revert animation if stuck in shoot or attack poses
      const isStuckAttack = activeAction.current === actions[animationSet.shoot] ||
                            (actions['SwordSlash'] && activeAction.current === actions['SwordSlash']) ||
                            (actions['1H_Melee_Attack_Chop'] && activeAction.current === actions['1H_Melee_Attack_Chop']);
      if (isStuckAttack) {
        const animName   = ecctrlAnimationSet[currentAnimStatus ?? useAnimationStore.getState().animationStatus] ?? animationSet.idle;
        const nextAction = actions[animName];
        if (nextAction && nextAction !== activeAction.current) {
          nextAction.reset().fadeIn(0.1).play();
          if (activeAction.current) activeAction.current.crossFadeTo(nextAction, 0.12, true);
          activeAction.current = nextAction;
        }
      }
    }

    // Adjust playback timescale based on actual physical velocity
    if (activeAction.current) {
      const currentAnimStatus = useAnimationStore.getState().animationStatus;
      const desired = (ecctrlAnimationSet[currentAnimStatus] ?? animationSet.idle).toLowerCase();

      const linvel = characterStatus.linvel;
      const horizontalSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);

      if (desired.includes("walk")) {
        activeAction.current.timeScale = Math.max(0.4, Math.min(1.2, horizontalSpeed / 3.0));
      } else if (desired.includes("run")) {
        activeAction.current.timeScale = Math.max(0.4, Math.min(1.4, horizontalSpeed / 5.5));
      } else {
        activeAction.current.timeScale = 1.0;
      }
    }
  };

  return { tick };
}
