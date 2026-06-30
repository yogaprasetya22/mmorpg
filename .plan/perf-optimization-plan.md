# Perf Optimization Plan — `frontend/`

Based on analysis of `pascalorg/editor` patterns vs current codebase.

## Current State Summary

| Area             | Current Approach                                                         | Gap vs Editor                                       |
| ---------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| Render loop      | R3F default (`frameloop: 'always'`) + `AdaptiveDpr`/`PerformanceMonitor` | No `frameloop: 'never'`, no frame limiter           |
| Geometry rebuild | React reconciliation on every prop change                                | No dirty-set, no imperative injection               |
| State management | Flat zustand store, frequent `set()` calls on animation                  | No dirty tracking, no temporal undo/redo            |
| Post-processing  | `three/examples` `EffectComposer` + `UnrealBloomPass`                    | WebGL path, no WebGPU/TSL                           |
| Scene graph      | React `<group>` + drei loaders                                           | No flat `Map<id, Object3D>` registry                |
| Drag/move        | React state → re-render                                                  | No live transform decoupling                        |
| Material system  | Inline THREE materials                                                   | No cached material library, no surface-role palette |
| FPS capping      | None (relies on V-Sync)                                                  | No software cap                                     |

---

## Phase 0 — Audit & Measurement (do first)

**Before any change, instrument to detect regressions.**

1. Add `r3f-perf` in embedded mode (already available as dep) to measure baseline:
    - FPS, CPU time, draw calls, triangles, memory.
2. Record baseline on reference scene (2000 objects + 50 trees + 10 monsters).
3. Define success criteria:
    - No frame drop below 50fps on target device.
    - Draw calls ≤ 500 (from current ~2000+).
    - JS heap steady, no growth over 5min.

---

## Phase 1 — Render Loop Control

### 1.1 Frame Limiter + `frameloop: 'never'`

**Problem:** R3F default loop runs every RAF, even when nothing changes. No FPS cap.

**Files to touch:**

- [`frontend/src/components/game/GameCanvas.tsx`](/frontend/src/components/game/GameCanvas.tsx:323)

**Changes:**

```tsx
// GameCanvas.tsx
<Canvas frameloop="never" ...>

// New component: <FrameLimiter fps={50} />
// Same pattern as editor's frame-limiter.tsx:
// - requestAnimationFrame self-loop
// - set({ frameloop: 'never' }) on mount
// - advance() at fixed interval
// - restore frameloop on unmount
```

**Skip:** Only when scene has pending animation (character movement, weather particles). Use `invalidate()` for those cases explicitly.

**Benefit:** Background tabs consume 0% CPU. Steady 50fps instead of 60-120 jitter.

### 1.2 Remove `AdaptiveDpr` + `PerformanceMonitor`

**Problem:** These add per-frame overhead checking FPS and adjusting DPR reactively. Frame limiter + fixed DPR cap is more predictable.

**Replace with:** Fixed DPR cap:

```tsx
const maxDpr = typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5
<Canvas dpr={[1, maxDpr]} ...>
```

**Benefit:** Lower fragment-shader cost on mobile (1.25× vs 2×). No runtime monitoring overhead.

---

## Phase 2 — State Architecture

### 2.1 Split Store — Scene Data vs Game State vs Ephemeral

**Problem:** `useStore` mixes game state (HP, kills, weather) with rendering concerns. One `set()` triggers React re-renders in unrelated components.

**New store split:**

| Store               | Purpose                                     | Update frequency |
| ------------------- | ------------------------------------------- | ---------------- |
| `useGameStore`      | Game logic: HP, kills, army counts, weather | Per second       |
| `useSceneStore`     | Scene graph: entities, positions, dirty set | Per frame        |
| `useLiveTransforms` | Drag/move ephemeral transforms              | Per RAF tick     |
| `useEditorStore`    | Editor state (already exists)               | On user action   |

**Files to create:**

- `frontend/src/store/use-game-store.ts` — game logic (migrate from useStore)
- `frontend/src/store/use-scene-store.ts` — scene entities + dirty set
- `frontend/src/store/use-live-transforms.ts` — drag overrides

**Key pattern (from editor's `use-live-transforms.ts`):**

```ts
// Ephemeral transform store — NOT part of undo/redo, NOT triggering React re-render
const useLiveTransforms = create<LiveTransformState>((set, get) => ({
    transforms: new Map(),
    set: (nodeId, transform) =>
        set((s) => {
            const next = new Map(s.transforms);
            next.set(nodeId, transform);
            return { transforms: next };
        }),
    get: (nodeId) => get().transforms.get(nodeId),
}));
```

### 2.2 Dirty Set for Entity Updates

**Problem:** When a monster moves, the component re-renders via React reconciliation. With 100 monsters, each movement triggers 100 React reconciles.

**Solution:** Add dirty entity set to scene store. System components read dirty set and update Three.js objects imperatively.

```ts
type SceneState = {
    entities: Record<string, SceneEntity>;
    dirtyEntities: Set<string>;
    markDirty: (id: string) => void;
    clearDirty: (id: string) => void;
    updateEntity: (id: string, data: Partial<SceneEntity>) => void;
};
```

**Render:** Components only mount an empty `<group>`. A `useFrame` system reads dirty entities and updates positions/materials imperatively via refs.

**Benefit:** 100 monster movements → 1 dirty set iteration → 0 React reconciliations.

### 2.3 RAF-Coalesced Dirty Marking

**Problem:** `updateEntity()` called 100 times in one frame → 100 `markDirty()` → 100 React notifications.

**Solution (from editor's `node-actions.ts:968`):**

```ts
let pendingRafId: number | null = null;
let pendingUpdates = new Set<string>();

function updateEntity(id: string, data: Partial<SceneEntity>) {
    // Apply data to store immediately (so reads are consistent)
    // But defer dirty marking to next RAF
    pendingUpdates.add(id);
    if (pendingRafId !== null) cancelAnimationFrame(pendingRafId);
    pendingRafId = requestAnimationFrame(() => {
        pendingUpdates.forEach((id) => get().markDirty(id));
        pendingUpdates.clear();
        pendingRafId = null;
    });
}
```

---

## Phase 3 — Rendering Architecture

### 3.1 Scene Registry — Flat `Map<id, Object3D>`

**Problem:** Currently React components hold their own refs. Systems can't find objects by ID without walking the DOM.

**New pattern (from editor's `scene-registry.ts`):**

```ts
export const sceneRegistry = {
    nodes: new Map<string, THREE.Object3D>(),
    byType: new Map<string, Set<string>>(),
    clear() {
        this.nodes.clear();
        this.byType.clear();
    },
};

// Hook for components to self-register
export function useRegistry(id: string, ref: React.RefObject<THREE.Object3D>) {
    useLayoutEffect(() => {
        if (!ref.current) return;
        sceneRegistry.nodes.set(id, ref.current);
        return () => {
            sceneRegistry.nodes.delete(id);
        };
    }, [id, ref]);
}
```

**Apply to:** Monsters (`RemoteMonstersRenderer`), players (`RemotePlayersRenderer`), items (`ModularMap`), projectiles.

### 3.2 Entity-Update System (Imperative Geometry)

**Problem:** When entity moves, React re-renders the component, which creates new JSX, which R3F diffs, which updates the Object3D. This is expensive per-entity.

**Solution:** Create a single `EntityUpdateSystem` component that runs in `useFrame`:

```tsx
const EntityUpdateSystem = () => {
    const dirtyEntities = useSceneStore((s) => s.dirtyEntities);
    const entities = useSceneStore((s) => s.entities);
    const clearDirty = useSceneStore((s) => s.clearDirty);

    useFrame(() => {
        if (dirtyEntities.size === 0) return;

        for (const id of dirtyEntities) {
            const entity = entities[id];
            const obj = sceneRegistry.nodes.get(id);
            if (!entity || !obj) continue;

            // Imperative update — no React involvement
            if (entity.position) obj.position.set(...entity.position);
            if (entity.rotation) obj.rotation.set(...entity.rotation);
            if (entity.scale) obj.scale.set(...entity.scale);
            if (entity.visible !== undefined) obj.visible = entity.visible;
        }

        clearDirty();
    });
};
```

**Benefit:** 0 React renders for position/rotation/scale updates. Dirty set ensures each entity processed once per frame regardless of how many updates happened.

### 3.3 Remove `SafePostProcessing` — Replace with Conditional Pass

**Problem:** `EffectComposer` + `UnrealBloomPass` costs ~2ms per frame even on mid-range. When potato mode kicks in, it's already too late.

**Solution:** Replace with:

- A conditional render that selects between `direct render` and `post-processed render` at the `useFrame` level.
- On mobile or low FPS, skip EffectComposer entirely (just `gl.render(scene, camera)`).
- Use `frameloop: 'never'` + manual `advance()` for both paths.

**Files:**

- `frontend/src/components/game/systems/OptimizedPostProcessing.tsx` (new, replaces SafePostProcessing)

```tsx
// Simplified pipeline decision tree
useFrame(() => {
    if (potatoMode) {
        gl.render(scene, camera); // No allocation
    } else {
        composer.render(); // Bloom + tone mapping
    }
});
```

---

## Phase 4 — Material & Asset Optimization

### 4.1 MeshStandardNodeMaterial → MeshLambertNodeMaterial for Vegetation

**Problem:** Vegetation uses `MeshStandardMaterial` which does PBR lighting calculations. Grass + bushes don't need specular.

**Change:** Use `MeshLambertMaterial` (or `MeshLambertNodeMaterial` if WebGPU) for:

- Grass, bushes, flowers, small rocks.
- Keep `MeshStandardMaterial` for player characters, monsters, buildings.

**Benefit:** ~30% fewer fragment shader instructions for vegetation draw calls.

### 4.2 Cached Material Library

**Problem:** Every item loads its own material instance. 2000 items → 2000 material instances.

**Solution (from editor's `materials.ts`):** Global material cache keyed by `(surfaceRole, colorPreset, sceneTheme)`.

```ts
const materialCache = new Map<string, Material>();

export function getCachedMaterial(
    key: string,
    factory: () => Material,
): Material {
    let mat = materialCache.get(key);
    if (!mat) {
        mat = factory();
        mat.userData.__cached = true;
        materialCache.set(key, mat);
    }
    return mat;
}
```

Mark cached materials with `userData.__cached = true` so the dispose function doesn't destroy shared materials.

### 4.3 Surface-Role Color Palette

**Problem:** Colors are hardcoded per asset. Changing scene theme requires editing each asset.

**Solution (from editor's `materials.ts:23-68`):** Define role-based palettes:

```ts
const PALETTES = {
  clay: { wall: '#dcd6c7', floor: '#cfc8b6', roof: '#b8ad96', ... },
  white: { wall: '#f4f3ef', floor: '#ece9e2', ... },
  blueprint: { wall: '#90a9c7', floor: '#7f98ba', ... },
}
```

Apply via userData `surfaceRole` on each mesh. A system traverses and swaps material when palette changes.

---

## Phase 5 — Post-Processing (WebGPU Upgrade Path)

### 5.1 WebGPU Detection + Dual Pipeline

**Problem:** Current code uses three/exjs EffectComposer (WebGL). No SSGI, no ink edges.

**Future path (not immediate):**

- Detect `navigator.gpu` at runtime.
- If WebGPU available: use three.js TSL pipeline with SSGI + screen-space ink + merged outline.
- If WebGL: use current EffectComposer or direct render.

**Files to create:**

- `frontend/src/lib/gpu-detect.ts`
- `frontend/src/lib/ink-edges.ts` (copy pattern from editor, adapted to three@0.183.2 TSL)
- `frontend/src/lib/merged-outline-node.ts`

**Note:** This is Phase 5 because three@0.183.2's TSL APIs differ from editor's three@0.184.0. Wait until the project upgrades three.js.

---

## Phase 6 — Spatial + Culling

### 6.1 Replace `globalRaycaster` with BVH-Based Scene Query

**Problem:** `globalRaycaster.ts` likely walks all objects linearly.

**Solution:** Use `three-mesh-bvh` (already a dependency) to build BVH for static geometry (terrain, buildings). Dynamic objects use `sceneRegistry.byType` for O(1) lookups by kind.

### 6.2 Improve ModularMap Sector Culling

**Current:** Distance-based (200m render, 60m physics). Good, but no frustum culling.

**Add:** Pass `camera.frustum` to sector check. Skip sectors outside frustum even if within 200m.

---

## Phase 7 — Memory & Disposal

### 7.1 Geometry/Material Dispose Discipline

**Problem:** When `ModularMap` reloads items, old geometries/materials leak.

**Solution:** Every geometry builder tags children with `userData.__fromGeometry: true`. Dispose function only disposes tagged children, leaves React-managed children alone.

### 7.2 Empty Draw Guard

**Problem:** WebGL can crash on draw with 0-vertex geometry (empty position buffer).

**Solution (from editor's `Viewer.tsx:133`):** Install a guard:

```ts
renderer.setRenderObjectFunction((object, scene, camera, geometry, material, group, ...) => {
  if (!hasDrawableGeometry(geometry)) return
  renderer.renderObject(object, scene, camera, geometry, material, group, ...)
})
```

---

## Execution Order

```
Phase 0: Instrument + measure baseline
    ↓
Phase 1: frameloop: 'never' + FrameLimiter + DPR cap
    ↓
Phase 2: Split stores + dirty set + RAF coalescing
    ↓
Phase 3: Scene registry + EntityUpdateSystem + conditional render
    ↓
Phase 4: Material cache + Lambert for vegetation + surface roles
    ↓
Phase 6: BVH culling + frustum sector culling
    ↓
Phase 7: Dispose discipline + empty draw guard
    ↓
Phase 5: WebGPU pipeline (after three upgrade)
```

---

## Success Metrics

| Metric                  | Before            | Target          |
| ----------------------- | ----------------- | --------------- |
| FPS (2000 objects)      | ~35-45            | 50+ steady      |
| Draw calls              | ~2000             | ≤400            |
| JS heap growth          | Growing over 5min | Flat over 10min |
| CPU time (frame)        | ~28ms             | ≤16ms           |
| Mobile (pointer:coarse) | Unplayable        | 30fps+          |
