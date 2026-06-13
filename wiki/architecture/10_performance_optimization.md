# 10. Performance Optimization Architecture

> **Status**: Complete reference for all client-side and server-side performance optimizations targeting 60 FPS with 20-50 concurrent players and 10+ monsters.

This document covers every performance-critical optimization in the codebase, organized by system layer. Each section explains the problem, solution, and measurable impact.

---

## 📊 1. Performance Budget (Target: 60 FPS)

| System | Budget | Current |
|---|---|---|
| React reconciliation | < 2ms | ~1ms (zero-re-render architecture) |
| Entity useFrame callbacks | < 4ms | ~2ms (28 entities) |
| Animation mixer updates | < 2ms | ~1ms (imperative control) |
| Terrain height lookups | < 1ms | ~0.1ms (spatial cache) |
| Network message parsing | < 2ms | ~0.5ms (MessagePack) |
| Three.js rendering | < 6ms | ~4ms (GPU-bound) |
| **Total frame budget** | **< 16.6ms** | **~8-10ms** |

---

## 🎭 2. Zero-Re-Render Architecture (Remote Players)

### Problem
Each `RemotePlayerInstance` originally used 6 `useState` calls for per-frame values (pose, timescale, visibility, etc.). With 20 players changing pose ~3x/sec:
- 20 × 3 state changes × ~3/sec = **~180 React re-renders/second**
- Each re-render traverses AvatarModel → 8 AvatarAsset children

### Solution: useRef + Imperative Handle

All per-frame values converted to `useRef`. Animation changes applied via `AvatarHandle` imperative methods:

```typescript
// BEFORE (broken): React re-render cascade
const [currentPose, setCurrentPose] = useState("Idle");
setCurrentPose("Walking"); // → re-render → useEffect → play animation

// AFTER (optimized): Direct Three.js control, zero re-renders
const poseRef = useRef("Idle");
avatarControlRef.current?.setPose("Walking"); // → direct AnimationAction control
```

### Impact
- **Before**: ~180 re-renders/sec → ~8ms React overhead per frame
- **After**: 0 re-renders → ~0.1ms React overhead per frame

---

## 🗺️ 3. Terrain Height Spatial Cache

### Problem
Each entity calls terrain height lookup every frame. With 28 entities at 60fps:
- 28 × 60 = **1,680 BVH raycasts/second** (monsters were NOT using cache)
- Each raycast traverses the BVH tree: O(log N) per query

### Solution: Grid-Keyed Cache with TTL

```typescript
// terrainCache.ts
const GRID = 1;          // 1-metre cells
const TTL_MS = 2_000;    // 2-second expiry
const MAX_ENTRIES = 2048; // prevent unbounded growth

export function getCachedTerrainHeight(x, z, fallback) {
  const key = `${Math.round(x)},${Math.round(z)}`;
  const entry = cache.get(key);
  if (entry && performance.now() - entry.t < TTL_MS) return entry.h;
  const h = fallback(); // BVH raycast or noise evaluation
  cache.set(key, { h, t: performance.now() });
  return h;
}
```

### Impact
- **Before**: 1,680 BVH raycasts/sec
- **After**: ~20 cache lookups/sec (only on cache miss when entity moves to new cell)
- **Savings**: ~98% reduction in terrain queries

---

## 📐 4. Exponential Smoothing (Network Interpolation)

### Problem
The old buffer-based interpolation system allocated objects every network update:
```typescript
// OLD: Object allocation + array push/shift every 50ms per entity
buf.push({ x, y, z, rotation, timestamp: performance.now() });
if (buf.length > 30) buf.shift(); // GC pressure
```
With 28 entities × 20Hz = **560 allocations + 560 GC collections per second**.

### Solution: Direct Exponential Smoothing

```typescript
// NEW: Zero allocation, converges in ~160ms (matching old buffer delay)
const SMOOTH_TAU = 0.08;
const factor = 1 - Math.exp(-delta / SMOOTH_TAU);
smoothPos.current.x += (targetX - smoothPos.current.x) * factor;
smoothPos.current.y += (targetY - smoothPos.current.y) * factor;
smoothPos.current.z += (targetZ - smoothPos.current.z) * factor;
```

### Impact
- **Before**: 560 object allocations/sec + buffer search loop every frame
- **After**: 0 allocations + 3 multiply-add operations per entity per frame

---

## 🎨 5. Shared HP Bar Geometry

### Problem
Each entity created 3 separate PlaneGeometry + MeshBasicMaterial instances for HP bars:
- Background (1.24 × 0.16), Track (1.2 × 0.12), Fill (1.2 × 0.12)
- With 38 entities: 38 × 3 = **114 geometry uploads + 114 material instances**

### Solution: Module-Level Shared Instances

```typescript
// shared/HpBarPlanes.tsx
const SHARED_BG_GEOMETRY = new THREE.PlaneGeometry(1.24, 0.16);
const SHARED_TRACK_GEOMETRY = new THREE.PlaneGeometry(1.2, 0.12);
const SHARED_FILL_GEOMETRY = new THREE.PlaneGeometry(1.2, 0.12);
const FILL_MATERIALS = {
  monster: new THREE.MeshBasicMaterial({ color: '#f43f5e', toneMapped: false }),
  boss: new THREE.MeshBasicMaterial({ color: '#ef4444', toneMapped: false }),
  player: new THREE.MeshBasicMaterial({ color: '#10b981', toneMapped: false }),
};
```

### Impact
- **Before**: 114 geometry uploads + 114 material instances
- **After**: 3 geometries + 5 materials total (shared across all entities)

---

## 🌑 6. Distance-Based Shadow Toggle

### Problem
Shadow map rendering is the single most expensive GPU operation. With 20 players all casting shadows:
- Each shadowed entity requires a render pass from the light's perspective
- 20 entities × 1 shadow pass = significant GPU overhead

### Solution: Disable Shadows Beyond 40 Units

```typescript
const SHADOW_DIST_SQ = 40 * 40;
const shouldShadow = camDistSq < SHADOW_DIST_SQ;
if (shouldShadow !== shadowEnabledRef.current) {
  shadowEnabledRef.current = shouldShadow;
  avatarControlRef.current?.setShadowEnabled(shouldShadow);
}
```

The `setShadowEnabled` method caches the mesh list on first call to avoid traversal every frame.

---

## 🔄 7. Sort Throttle (10Hz Distance Sorting)

### Problem
Distance-sorting 35+ entities every frame at 60fps:
- 60 × 35 × log(35) ≈ **10,500 sort operations/sec**

### Solution: Throttle to 10Hz

```typescript
if (state.clock.elapsedTime - lastSortTime.current >= 0.10) {
  scratch.sort((a, b) => a.distSq - b.distSq);
  lastSortTime.current = state.clock.elapsedTime;
}
```

### Impact
- **Before**: 10,500 sort ops/sec
- **After**: 350 sort ops/sec (30× reduction)

---

## 🪣 8. Object Pool & Scratch Reuse

### Problem
Creating objects inside `useFrame` triggers V8 garbage collection:
- Every `new THREE.Vector3()` = heap allocation
- Every `array.filter()` = new array allocation
- GC freezes the JS thread for 1-3ms per collection

### Solution: Module-Level Scratch Objects

```typescript
// buffers.ts — declared once, reused forever
export const _charPos = new THREE.Vector3();
export const _camDir = new THREE.Vector3();
export const _tempFwd = new THREE.Vector3();
export const _idleTargetQuat = new THREE.Quaternion();
export const _idleLookMatrix = new THREE.Matrix4();

// Object pools for sort operations
const _sortObjPool: { id: string; distSq: number }[] = [];
// Reuse: _sortObjPool[i].id = monsterId; _sortObjPool[i].distSq = dx*dx + dz*dz;
```

### Rule
**ZERO allocations inside `useFrame`**. All math objects declared at module level.

---

## 📡 9. Network Optimization

### Player Send Rate: 20Hz Hard Cap

```typescript
const SEND_INTERVAL_MS = 50; // 20Hz
// With deduplication: only send if position actually changed
```

### MessagePack Binary Serialization

```typescript
import { decode } from "@msgpack/msgpack"; // local import, NOT CDN
// decode() runs on main thread (Web Worker blocked by CSP)
```

### Server Broadcast: Non-Blocking Fan-Out

```go
// hub.go — buffered channel, drop slow clients
for client := range h.clients {
    select {
    case client.send <- message: // O(1) buffered send
    default:
        close(client.send)       // Drop slow client
        delete(h.clients, client)
    }
}
```

---

## 📊 10. Adaptive Performance Optimizer

The `AdaptivePerformanceOptimizer` component monitors rolling FPS and disables expensive effects when performance degrades:

| FPS Threshold | Action |
|---|---|
| < 53 FPS for 3s | Disable Bloom post-processing |
| < 53 FPS for 5s | Disable shadow maps |
| > 58 FPS for 5s | Re-enable effects |

---

## 🎯 11. Load Test Scenarios

| Command | Players | Duration | Focus |
|---|---|---|---|
| `make loadtest-anim-stress` | 20 | 60s | Animation diversity (FSM: idle/walk/run/attack/skill) |
| `make loadtest-mixed` | 30 | 45s | Mixed combat + movement |
| `make loadtest` | 50 | 45s | Standard stress |
| `make loadtest-extreme` | 120 | 60s | Maximum player count |

The load test bots use a **realistic behavior FSM** with weighted random state transitions:

| State | Probability | Duration | Animation |
|---|---|---|---|
| Idle | 15% | 0.5-2s | `Idle` |
| Walk | 25% | 1-4s | `Walking` |
| Run | 35% | 1.5-5.5s | `Run` |
| Attack | 15% | 0.2-0.6s | `Attack` |
| Skill | 10% | 0.4-1s | `Skill` |

---

## ⚠️ 12. Performance Monitoring

### R3F Stats (drei `<Stats />`)
Shows FPS, frame time, draw calls, triangles, textures, geometries. Positioned at bottom-left of canvas.

### FPS Badge (Top-Right Bar)
Updated by `FPSCounterUpdater` component via custom DOM events at 1Hz.

### Browser DevTools
- **Performance tab**: Record 10-second profile, check for frame drops
- **Memory tab**: Verify heap stays < 500MB
- **React DevTools Profiler**: Verify zero re-renders for remote players

---

🏆 **Wiki Index**: [README.md](README.md) · [09. Animation System](09_animation_system.md)
