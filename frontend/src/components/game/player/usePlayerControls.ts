import { useEffect } from 'react';
import {
  camYaw,
  camPitch,
  camZoomTarget,
  isLeftClick,
  isRightClick,
  ZOOM_MIN,
  ZOOM_MAX
} from './buffers';

export function usePlayerControls(settingsRef: React.RefObject<any>) {
  useEffect(() => {
    // Mouse look (right-drag)
    const onMouseMove = (e: MouseEvent) => {
      if (!isRightClick[0]) return;
      const s = settingsRef.current?.mouseSensitivity ?? 0.002;
      camYaw[0] -= e.movementX * s;
      camPitch[0] -= e.movementY * s;
      camPitch[0] = Math.max(-0.4, Math.min(1.1, camPitch[0]));
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Only clear target or trigger if clicked INSIDE the 3D Canvas itself (not on UI buttons / HUD)
        const isCanvas = e.target && (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
        if (isCanvas) {
          isLeftClick[0] = 1;
          // Clear target if clicked on empty ground/space (not on a monster)
          setTimeout(() => {
            if (!(window as any).monsterClickedThisFrame) {
              (window as any).clickedTargetId = null;
              (window as any).hasAttackIntent = false;
            }
            (window as any).monsterClickedThisFrame = false;
          }, 30);
        }
      }
      if (e.button === 2) isRightClick[0] = 1;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isLeftClick[0] = 0;
      if (e.button === 2) isRightClick[0] = 0;
    };

    const preventContext = (e: MouseEvent) => {
      if (e.button === 2) e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        (window as any).clickedTargetId = null;
        (window as any).pendingSkillExecution = false;
      }
    };

    // Zoom (mouse wheel)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camZoomTarget[0] = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, camZoomTarget[0] + e.deltaY * 0.01 * 2.0)
      );
    };

    // Pointer lock: when locked treat any movement as camera look
    const onPointerLockMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      const s = settingsRef.current?.mouseSensitivity ?? 0.002;
      camYaw[0] -= e.movementX * s;
      camPitch[0] -= e.movementY * s;
      camPitch[0] = Math.max(-0.4, Math.min(1.1, camPitch[0]));
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousemove', onPointerLockMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('contextmenu', preventContext);
    window.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousemove', onPointerLockMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('contextmenu', preventContext);
      window.removeEventListener('wheel', onWheel);
    };
  }, [settingsRef]);
}
