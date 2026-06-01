import * as THREE from 'three';
import { characterStatus } from 'bvhecctrl';
import { CastState } from './types';
import { animationSet } from './buffers';

export function handlePlayerDebuffs(
  now: number,
  delta: number,
  currentDebuff: string,
  castState: React.MutableRefObject<CastState>,
  stunVFXRef: React.RefObject<THREE.Group>,
  freezeVFXRef: React.RefObject<THREE.Mesh>,
  freezeBannerRef: React.RefObject<THREE.Group>,
  silenceVFXRef: React.RefObject<THREE.Group>,
  ecctrlRef: React.RefObject<any>,
  actions: Record<string, THREE.AnimationAction | null | undefined>,
  activeAction: React.MutableRefObject<THREE.AnimationAction | null>
): boolean {
  // Update debuff visuals (stars, ice blocks, silenced banner)
  if (stunVFXRef.current) {
    const active = currentDebuff === 'stun';
    stunVFXRef.current.visible = active;
    if (active) {
      stunVFXRef.current.rotation.y += delta * 4.0;
      stunVFXRef.current.position.y = 2.3 + Math.sin(now * 0.005) * 0.08;
    }
  }

  if (freezeVFXRef.current) {
    freezeVFXRef.current.visible = currentDebuff === 'freeze';
  }
  if (freezeBannerRef.current) {
    freezeBannerRef.current.visible = currentDebuff === 'freeze';
  }
  const freezeEl = document.getElementById('player-debuff-freeze');
  if (freezeEl) {
    freezeEl.style.display = currentDebuff === 'freeze' ? 'block' : 'none';
  }

  if (silenceVFXRef.current) {
    const active = currentDebuff === 'silence';
    silenceVFXRef.current.visible = active;
    if (active) {
      silenceVFXRef.current.position.y = 2.2 + Math.sin(now * 0.003) * 0.05;
    }
  }
  const silenceEl = document.getElementById('player-debuff-silence');
  if (silenceEl) {
    silenceEl.style.display = currentDebuff === 'silence' ? 'block' : 'none';
  }

  // If stunned or frozen, cancel casting, lock movement, and halt any normal combat actions
  if (currentDebuff === 'stun' || currentDebuff === 'freeze') {
    if (castState.current.isCasting) {
      castState.current.isCasting = false;
      const container = document.getElementById('player-cast-bar-container');
      if (container) container.classList.add('hidden');
    }
    // Lock player horizontal velocity
    const vel = characterStatus.linvel;
    ecctrlRef.current?.setLinVel({ x: 0, y: vel.y, z: 0 } as any);
    ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });

    // Force stun/freeze animations if available, or just pause animation
    const stunAnim = actions['Stun'] || actions[animationSet.idle];
    if (stunAnim && activeAction.current !== stunAnim) {
      stunAnim.reset().play();
      if (activeAction.current) activeAction.current.crossFadeTo(stunAnim, 0.1, true);
      activeAction.current = stunAnim;
    }

    return true; // Halt further state processing
  }

  return false;
}
