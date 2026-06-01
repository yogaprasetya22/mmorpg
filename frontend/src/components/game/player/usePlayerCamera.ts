import * as THREE from 'three';
import {
  _charPos,
  _camDesired,
  _lookAt,
  _camTarget,
  _camDir,
  _fwdVec,
  _shoulderOffsetVec,
  _rayDir,
  _rayOrigin,
  _raycaster,
  camYaw,
  camPitch,
  camZoom,
  camZoomTarget,
  camPosX,
  camPosY,
  camPosZ,
  lookAtX,
  lookAtY,
  lookAtZ,
  hasCamInit,
  ZOOM_LERP,
  EYE_HEIGHT,
  SHOULDER_OFFSET
} from './buffers';

export function updatePlayerCamera(camera: THREE.Camera, delta: number) {
  // Lerp zoom
  camZoom[0] += (camZoomTarget[0] - camZoom[0]) * Math.min(1, ZOOM_LERP * delta);

  const cosPitch = Math.cos(camPitch[0]);
  const sinPitch = Math.sin(camPitch[0]);

  // Offset the target slightly to the shoulder for premium look
  _fwdVec.set(Math.sin(camYaw[0]), 0, Math.cos(camYaw[0])).normalize();
  const shoulderOffset = _shoulderOffsetVec
    .set(Math.cos(camYaw[0]), 0, -Math.sin(camYaw[0]))
    .multiplyScalar(SHOULDER_OFFSET);

  _camTarget.copy(_charPos).add(shoulderOffset);
  _camTarget.y += EYE_HEIGHT;

  _camDesired.set(
    _camTarget.x - Math.sin(camYaw[0]) * cosPitch * camZoom[0],
    _camTarget.y + sinPitch * camZoom[0],
    _camTarget.z - Math.cos(camYaw[0]) * cosPitch * camZoom[0]
  );

  // Camera Collision (Ghost Busting Walls/Trees)
  _rayOrigin.copy(_camTarget);
  _rayDir.subVectors(_camDesired, _rayOrigin).normalize();
  _raycaster.set(_rayOrigin, _rayDir);
  _raycaster.far = camZoom[0];

  const colliders = (window as any).globalNonInstancedColliders || [];
  const intersects = _raycaster.intersectObjects(colliders, false);

  if (intersects.length > 0) {
    const hitDist = intersects[0].distance;
    const safeDist = Math.max(0.4, hitDist - 0.4);
    _camDesired.copy(_rayOrigin).add(_rayDir.multiplyScalar(safeDist));

    // INSTANT SNAP on collision
    camPosX[0] = _camDesired.x;
    camPosY[0] = _camDesired.y;
    camPosZ[0] = _camDesired.z;
  }

  // PREVENT UNDERWORLD CAMERA (Hard Floor)
  if (colliders.length > 0) {
    const terrainHeightAtCam = (window as any).getGroundHeight
      ? (window as any).getGroundHeight(_camDesired.x, _camDesired.z, -1)
      : -1;
    if (_camDesired.y < terrainHeightAtCam + 0.6) {
      _camDesired.y = terrainHeightAtCam + 0.6;
      camPosY[0] = _camDesired.y;
    }
  }

  if (!hasCamInit[0]) {
    camPosX[0] = _camDesired.x;
    camPosY[0] = _camDesired.y;
    camPosZ[0] = _camDesired.z;
    lookAtX[0] = _camTarget.x;
    lookAtY[0] = _camTarget.y;
    lookAtZ[0] = _camTarget.z;
    hasCamInit[0] = 1;
  }

  // Lerp camera pos
  const lerpT = Math.min(1, 15 * delta);
  camPosX[0] += (_camDesired.x - camPosX[0]) * lerpT;
  camPosY[0] += (_camDesired.y - camPosY[0]) * lerpT;
  camPosZ[0] += (_camDesired.z - camPosZ[0]) * lerpT;

  // Apply Camera Shake
  if (typeof (window as any).shakeIntensity === 'undefined') {
    (window as any).shakeIntensity = 0.0;
  }
  const shake = (window as any).shakeIntensity;
  let shakeOffsetX = 0;
  let shakeOffsetY = 0;
  let shakeOffsetZ = 0;
  if (shake > 0.01) {
    shakeOffsetX = (Math.random() - 0.5) * shake;
    shakeOffsetY = (Math.random() - 0.5) * shake;
    shakeOffsetZ = (Math.random() - 0.5) * shake;
    (window as any).shakeIntensity = shake * 0.88; // decay shake
  }

  if (typeof (window as any).cameraShake !== 'function') {
    (window as any).cameraShake = (intensity: number) => {
      (window as any).shakeIntensity = intensity;
    };
  }

  camera.position.set(
    camPosX[0] + shakeOffsetX,
    camPosY[0] + shakeOffsetY,
    camPosZ[0] + shakeOffsetZ
  );

  // Lerp lookAt
  const lookT = Math.min(1, 20 * delta);
  lookAtX[0] += (_camTarget.x - lookAtX[0]) * lookT;
  lookAtY[0] += (_camTarget.y - lookAtY[0]) * lookT;
  lookAtZ[0] += (_camTarget.z - lookAtZ[0]) * lookT;
  _lookAt.set(lookAtX[0], lookAtY[0], lookAtZ[0]);
  camera.lookAt(_lookAt);
}
