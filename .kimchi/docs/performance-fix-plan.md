# Performance Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce frame drop and lag when the map is dense with hundreds of objects (vegetation, editor-placed props, etc.) by optimizing shadow rendering, frustum culling, camera occlusion raycasting, and adaptive performance reactivity.

**Architecture:** Apply targeted, safe performance optimizations to the rendering pipeline while respecting all red zones in `DONT_TOUCH.md`. Changes are confined to shadow flags, frustum culling, occlusion-manager throttling, and adaptive-performance thresholds. No changes to core movement, networking, physics shapes, or lock-free FSM.

**Tech Stack:** Next.js, React Three Fiber, Three.js, TypeScript, Tailwind, Go backend (untouched).

---

## Scope

Only frontend rendering optimizations that do **not** touch any `DONT_TOUCH.md` red zones:

- ✅ Shadow rendering (zona kuning/hijau)
- ✅ Frustum culling flags (zona hijau)
- ✅ Camera occlusion raycast frequency & distance (zona hijau)
- ✅ Adaptive performance reaction time (zona hijau)

- ❌ Will NOT touch: SHAPECAST, MessagePack decoder, monster AI FSM, spatial hash grid, player send rate, zero-allocation useFrame rules, sort throttle, object pools, requestIdleCallback, LOD thresholds, DataTextureLoader patch, EnvironmentErrorBoundary, sanitizeCanvasData, WS hub fan-out, monster leash/respawn, terrain BVH config, root motion stripping, two-layer rotation, zero-re-render architecture, terrain cache, exponential smoothing interpolation.

---

## Task 1: Shadow Optimization in ModularMap

**Files:**
- Modify: `frontend/src/components/game/environment/ModularMap.tsx`

**Problem:** Every editor-placed object has both `castShadow` and `receiveShadow`, plus `frustumCulled={false}`. Dense editor maps flood the shadow map with many small objects.

**Change:**
1. Disable `receiveShadow` for `InstancedMeshPart` (small/editor props rarely need to receive shadows).
2. Keep `castShadow` for visual correctness but allow the renderer to cull it normally.
3. Set `frustumCulled={true}` instead of `false`.

**Expected impact:** Fewer shadow map pixels rendered for props, fewer full-scene draw calls.

---

## Task 2: Shadow Optimization in Procedural Vegetation

**Files:**
- Modify: `frontend/src/components/game/environment/effects/Forest.tsx`
- Modify: `frontend/src/components/game/environment/effects/InstancedTrees.tsx`
- Modify: `frontend/src/components/game/environment/InstancedVegetationRenderer.tsx`

**Problem:** All procedural trees and vegetation have `castShadow` + `receiveShadow`. Receiving shadows on thousands of leaves/grass blades is very expensive and visually marginal.

**Changes:**
1. `Forest.tsx` `TreePartInstanced`: keep `castShadow`, set `receiveShadow={false}`.
2. `InstancedTrees.tsx`: keep `castShadow`, set `receiveShadow={false}`.
3. `InstancedVegetationRenderer.tsx` `InstancedGroup`: keep `castShadow`, set `receiveShadow={false}`.

**Expected impact:** Shadow map only writes caster depth, skips costly receiver shading on vegetation.

---

## Task 3: Directional Light Shadow Map Resolution

**Files:**
- Modify: `frontend/src/components/game/environment/StormEnvironment.tsx`
- Modify: `frontend/src/components/game/environment/WhimsicalDiorama.tsx`

**Problem:** Directional light uses 2048×2048 shadow map in gameplay (4096×2048 in editor in StormEnvironment). High-resolution shadow maps consume GPU memory and fill-rate heavily.

**Changes:**
1. `StormEnvironment.tsx`: keep editor at 4096×4096, set gameplay to 1024×1024 when `!isEditorOpen`.
2. `WhimsicalDiorama.tsx`: set gameplay shadow map to 1024×1024.

**Expected impact:** ~4× less shadow-map memory and fill-rate during normal play.

---

## Task 4: Camera Occlusion Manager Throttling & Distance Cap

**Files:**
- Modify: `frontend/src/components/game/systems/CameraOcclusionManager.tsx`

**Problem:** Raycasts every 3rd frame against all registered colliders, and ray extends all the way to the player with no distance cap.

**Changes:**
1. Change `frameCounter.current % 3 === 0` to `frameCounter.current % 6 === 0`.
2. Cap `_raycaster.far` to `Math.min(originalFar, 80)` so distant objects are never tested.

**Expected impact:** ~50% fewer occlusion raycasts; only nearby occluders considered.

---

## Task 5: Faster Adaptive Performance Reaction

**Files:**
- Modify: `frontend/src/components/game/AdaptivePerformanceOptimizer.tsx`

**Problem:** It waits 15 seconds of low FPS before disabling bloom/shadows. Users experience lag long before the system reacts.

**Changes:**
1. Reduce `struggleSeconds` threshold from `15` to `4`.
2. Reduce `healthySeconds` threshold from `8` to `4` so recovery is also faster.

**Expected impact:** System downgrades/restore visual fidelity within seconds instead of tens of seconds.

---

## Task 6: Verification

**Commands:**
1. Type check: `cd frontend && npx tsc --noEmit`
2. Lint: `cd frontend && npm run lint` (or `next lint`)
3. Build: `cd frontend && npm run build` (optional, may be slow)
4. Manual review: re-read each changed file to confirm no red-zone violations.

**Success criteria:**
- No TypeScript errors.
- No lint errors in changed files.
- `DONT_TOUCH.md` red zones untouched.
- Visual behavior: shadows still cast from vegetation but vegetation no longer receives them; props are frustum-culled; occlusion checks run less often.

---

## Rollback

If any regression occurs, revert files individually:
```bash
git checkout -- frontend/src/components/game/environment/ModularMap.tsx
git checkout -- frontend/src/components/game/environment/effects/Forest.tsx
git checkout -- frontend/src/components/game/environment/effects/InstancedTrees.tsx
git checkout -- frontend/src/components/game/environment/InstancedVegetationRenderer.tsx
git checkout -- frontend/src/components/game/environment/StormEnvironment.tsx
git checkout -- frontend/src/components/game/environment/WhimsicalDiorama.tsx
git checkout -- frontend/src/components/game/systems/CameraOcclusionManager.tsx
git checkout -- frontend/src/components/game/AdaptivePerformanceOptimizer.tsx
```
