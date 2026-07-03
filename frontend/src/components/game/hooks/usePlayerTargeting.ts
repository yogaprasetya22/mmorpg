'use client';

import { useRef } from 'react';
import { UnitRuntimeData } from '@/src/core/domain/unit.types';
import {
  _charPos,
  aimTargetX,
  aimTargetY,
  aimTargetZ,
  hasTarget,
  AUTO_AIM_RADIUS,
  AUTO_AIM_RSQ,
} from '@/src/entities/player/buffers';

export function usePlayerTargeting(unitRegistry: React.RefObject<UnitRuntimeData[]> | undefined) {
  const lastNearestTargetId = useRef<string>("");

  const tick = () => {
    hasTarget[0] = 0;
    let nearestTarget: UnitRuntimeData | null = null;
    const grid = (window as any).battleGrid;

    // 1. Prioritize manual clicked target first
    const clickedId = (window as any).clickedTargetId;
    let clickedTarget: UnitRuntimeData | null = null;
    if (clickedId) {
      const units = unitRegistry?.current || [];
      const found = units.find(u => u.id === clickedId && u.type === 'enemy' && u.isActive && !u.isDying);
      if (found) {
        clickedTarget = found;
      } else {
        (window as any).clickedTargetId = null; // Clear target if it dies or is inactive
      }
    }

    if (clickedTarget) {
      aimTargetX[0] = clickedTarget.position[0];
      aimTargetY[0] = clickedTarget.position[1] + 1.2;
      aimTargetZ[0] = clickedTarget.position[2];
      hasTarget[0] = 1;
      nearestTarget = clickedTarget;
    } else if (grid) {
      // 2. Perform auto-aim spatial grid search
      const nearby = grid.queryRadius(_charPos.x, _charPos.z, AUTO_AIM_RADIUS);
      let closestDistSq = AUTO_AIM_RSQ;

      for (let i = 0; i < nearby.length; i++) {
        const u = nearby[i];
        if (u.type !== 'enemy' || !u.isActive || u.isDying) continue;

        const dx = _charPos.x - u.position[0];
        const dz = _charPos.z - u.position[2];
        const dSq = dx * dx + dz * dz;

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

    lastNearestTargetId.current = nearestTarget ? nearestTarget.id : "";
    return nearestTarget;
  };

  return { tick, lastNearestTargetId };
}
