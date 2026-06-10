import * as THREE from 'three';

// ─── ZERO-ALLOC MATH OBJECTS (module-level = never GC'd) ─────────────────────
export const _charPos = new THREE.Vector3();
export const _camDesired = new THREE.Vector3();
export const _lookAt = new THREE.Vector3();
export const _camTarget = new THREE.Vector3();
export const _camDir = new THREE.Vector3();
export const _originVec = new THREE.Vector3();
export const _fwdVec = new THREE.Vector3();
export const _fwdAxis = new THREE.Vector3(0, 0, 1);
export const _tempFwd = new THREE.Vector3();
export const _shoulderOffsetVec = new THREE.Vector3();

// Snappy Jump Gating Math Objects
export const _velVec = new THREE.Vector3();
export const _downRayOrigin = new THREE.Vector3();
export const _downRayDir = new THREE.Vector3(0, -1, 0);
export const _downRaycaster = new THREE.Raycaster();

// Camera Collision Check
export const _rayDir = new THREE.Vector3();
export const _rayOrigin = new THREE.Vector3();
export const _raycaster = new THREE.Raycaster();

// Chasing
export const _chaseDir = new THREE.Vector3();
export const _camProjDir = new THREE.Vector3();
export const _camRightDir = new THREE.Vector3();

// Idle rotation recovery
export const _idleTargetQuat = new THREE.Quaternion();
export const _idleLookMatrix = new THREE.Matrix4();

// ─── ECS BUFFERS (TypedArrays — same-frame, no GC) ───────────────────────────
// Camera state
export const camYaw = new Float32Array(1);   // radians
export const camPitch = new Float32Array([0.3]);
export const camZoom = new Float32Array([5.0]);
export const camZoomTarget = new Float32Array([5.0]);
export const camPosX = new Float32Array(1);
export const camPosY = new Float32Array(1);
export const camPosZ = new Float32Array(1);
export const lookAtX = new Float32Array(1);
export const lookAtY = new Float32Array(1);
export const lookAtZ = new Float32Array(1);
export const hasCamInit = new Uint8Array(1);     // 0=false, 1=true

// Input state (written by DOM events, read by useFrame)
export const isRightClick = new Uint8Array(1);
export const isLeftClick = new Uint8Array(1);

// Auto-aim state
export const autoFireTimer = new Float64Array(1);   // last auto-fire time (ms)
export const aimTargetX = new Float32Array(1);
export const aimTargetY = new Float32Array(1);
export const aimTargetZ = new Float32Array(1);
export const hasTarget = new Uint8Array(1);     // 0=no target, 1=has target

// State machine
export const charState = new Uint8Array(1);     // 0=NORMAL, 1=ATTACKING, 2=CHASING
export const attackTimer = new Float64Array(1); // Time spent in attack animation

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
export const ZOOM_MIN = 1.5;
export const ZOOM_MAX = 20.0;
export const ZOOM_LERP = 8.0;
export const EYE_HEIGHT = 1.4;
export const SHOULDER_OFFSET = 0.0;
export const AUTO_AIM_RADIUS = 40.0;
export const AUTO_AIM_RSQ = AUTO_AIM_RADIUS * AUTO_AIM_RADIUS;

export const animationSet = {
  idle: 'Idle',
  walk: 'Walking',
  jog: 'Jogging',
  run: 'Slow Run',
  fastRun: 'Fast Run',
  runWithSword: 'Run With Sword',
  jump: 'Jump With Sword',
  attack: 'Stable Sword Outward Slash',
  skill: 'Magic Heal',
  hit: 'Light Hit To Head',
  stunned: 'Stunned',
  dizzy: 'Dizzy',
  death: 'Standing React Death Right',
  deathHeavy: 'Sword And Shield Death',
};

export const ecctrlAnimationSet: Record<string, string> = {
  IDLE: animationSet.idle,
  WALK: animationSet.walk,
  RUN: animationSet.run,
  JUMP_START: animationSet.jump,
  JUMP_IDLE: animationSet.jump,
  JUMP_FALL: animationSet.jump,
  JUMP_LAND: animationSet.idle,
};
