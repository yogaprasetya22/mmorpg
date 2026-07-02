import * as THREE from 'three';
import { useAnimationStore, characterStatus } from 'bvhecctrl';
import { ecctrlAnimationSet, animationSet } from '../buffers';

export function updatePlayerAnimation(
  prevAnimStatus: React.MutableRefObject<string>,
  actions: Record<string, THREE.AnimationAction | null | undefined>,
  activeAction: React.MutableRefObject<THREE.AnimationAction | null>,
  isAttackingOrCasting: boolean,
  isCasting: boolean
) {
  // ─── FRAME-LOOP ANIMATION SYNCHRONIZER ───
  const currentAnimStatus = useAnimationStore.getState().animationStatus;
  const expectedAnimName = ecctrlAnimationSet[currentAnimStatus] ?? animationSet.idle;
  const expectedAction = actions[expectedAnimName];

  if (!isAttackingOrCasting) {
    if (currentAnimStatus !== prevAnimStatus.current) {
      prevAnimStatus.current = currentAnimStatus;
    }
    // If not attacking/casting, ensure we are playing the correct movement/idle animation
    if (expectedAction && activeAction.current !== expectedAction) {
      const isJump = expectedAnimName.toLowerCase().includes('jump');
      // Ultra-fast transition for jump (0.04s) so it feels instant;
      // standard crossfade (0.12s) for walk/run/idle to remain smooth.
      const crossfadeDuration = isJump ? 0.04 : 0.12;

      expectedAction.reset().play();
      if (activeAction.current) {
        activeAction.current.crossFadeTo(expectedAction, crossfadeDuration, true);
      } else {
        expectedAction.fadeIn(crossfadeDuration);
      }
      activeAction.current = expectedAction;
    }
  } else {
    // Track the physics animation status so that when we stop attacking, we know if it changed.
    if (currentAnimStatus !== prevAnimStatus.current) {
      prevAnimStatus.current = currentAnimStatus;
    }
  }

  // Adjust animation timescale dynamically to match actual physics velocity
  if (activeAction.current) {
    // Reuse prevAnimStatus.current
    const desired = (ecctrlAnimationSet[prevAnimStatus.current] ?? animationSet.idle).toLowerCase();

    const linvel = characterStatus.linvel;
    const horizontalSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);

    const isAttackAnim =
      activeAction.current === actions[animationSet.attack] ||
      (actions['SwordSlash'] && activeAction.current === actions['SwordSlash']) ||
      (actions['1H_Melee_Attack_Chop'] && activeAction.current === actions['1H_Melee_Attack_Chop']);

    if (isAttackAnim) {
      // Do not override attack animation timescale with movement speed calculations
    } else if (desired.includes('walk')) {
      activeAction.current.timeScale = Math.max(0.4, Math.min(1.2, horizontalSpeed / 3.0));
    } else if (desired.includes('run')) {
      activeAction.current.timeScale = Math.max(0.4, Math.min(1.4, horizontalSpeed / 5.5));
    } else if (!(window as any).pendingSkillExecution && !isCasting) {
      // Only reset to 1.0 if NOT attacking/casting (so we don't overwrite ASPD scaling!)
      activeAction.current.timeScale = 1.0;
    }
  }
}
