# 09. Animation System Architecture

> **Status**: Complete reference for the Mixamo FBX animation pipeline, root motion handling, crossfade transitions, and character rotation system.

The animation system loads Mixamo FBX clips, processes them for compatibility with the BVHEcctrl physics controller, and plays them on modular avatar skeletons with zero-React-re-render imperative control.

---

## 🗺️ 1. Animation Pipeline Overview

```
[Mixamo FBX Files]
  │
  ├── 14 animation clips (locomotion, combat, damage, death)
  │
  v
[FBX Loader + Processing]  (AvatarModel.tsx → loadFBXAnimations)
  │
  ├── Hips rotation correction (-90° X-axis premultiply)
  ├── Hips position offset (-8.11 Z-axis ground alignment)
  ├── Locomotion clips: STRIP root Hips position + rotation tracks
  ├── Combat clips: KEEP root tracks with correction
  ├── Armature.* tracks: PRUNED (prevent React group override)
  │
  v
[AnimationMixer]  (per AvatarModel instance via useAnimations)
  │
  ├── Imperative control via AvatarHandle (setPose, setTimeScale, setPaused)
  ├── Crossfade transitions (locomotion: 0.25s, combat: 0.12s)
  ├── Exponential timescale smoothing (lerp factor 0.15)
  │
  v
[Skeleton Rendering]  (SkinnedMesh with cloned bones per player)
```

---

## 📁 2. Animation Clip Inventory

| Name                         | Category   | File Path                               | Root Motion  |
| ---------------------------- | ---------- | --------------------------------------- | ------------ |
| `Idle`                       | Locomotion | `locomotion/idle.fbx`                   | **Stripped** |
| `Walking`                    | Locomotion | `locomotion/walking.fbx`                | **Stripped** |
| `Jogging`                    | Locomotion | `locomotion/jogging.fbx`                | **Stripped** |
| `Slow Run`                   | Locomotion | `locomotion/slow_run.fbx`               | **Stripped** |
| `Run With Sword`             | Locomotion | `locomotion/run_with_sword.fbx`         | **Stripped** |
| `Fast Run`                   | Locomotion | `locomotion/fast_run.fbx`               | **Stripped** |
| `Jump With Sword`            | Locomotion | `locomotion/jump_with_sword.fbx`        | **Stripped** |
| `Stable Sword Outward Slash` | Combat     | `combat/stable_sword_outward_slash.fbx` | Kept         |
| `Magic Heal`                 | Combat     | `combat/magic_heal.fbx`                 | Kept         |
| `Light Hit To Head`          | Damage     | `damage/light_hit_to_head.fbx`          | Kept         |
| `Stunned`                    | Debuff     | `locomotion/stunned.fbx`                | **Stripped** |
| `Dizzy`                      | Debuff     | `locomotion/dizzy.fbx`                  | **Stripped** |
| `Standing React Death Right` | Death      | `damage/standing_react_death_right.fbx` | Kept         |
| `Sword And Shield Death`     | Death      | `damage/sword_and_shield_death.fbx`     | Kept         |

### Why Strip Root Motion from Locomotion?

Mixamo FBX locomotion clips contain **Hips position tracks** that move the character forward in animation space. When the clip loops, the position snaps back to origin, causing a visible "teleport backward" glitch. The Hips rotation track also fights BVHEcctrl's own rotation control.

**Solution**: For locomotion clips, both `mixamorig:Hips.position` and `mixamorig:Hips.quaternion` tracks are removed entirely. BVHEcctrl handles all world-space movement and rotation. Internal bone tracks (legs, arms, spine) are kept for the visual animation.

```typescript
// Locomotion clips: strip root tracks
clip.tracks = clip.tracks.filter((t) => {
    if (t.name.startsWith("Armature.")) return false;
    if (
        t.name === "mixamorigHips.position" ||
        t.name === "mixamorig:Hips.position"
    )
        return false;
    if (
        t.name === "mixamorigHips.quaternion" ||
        t.name === "mixamorig:Hips.quaternion"
    )
        return false;
    return true;
});
```

---

## 🔄 3. Crossfade Transition System

Animation transitions use Three.js `crossFadeTo` with an `activeActionRef` tracker to avoid the "parallel play" artifact where both clips fight each other.

### Transition Durations

| Transition Type         | Duration         | Rationale                                          |
| ----------------------- | ---------------- | -------------------------------------------------- |
| Locomotion ↔ Locomotion | **0.25s**        | Longer blend avoids "stiff standing pose" artifact |
| Combat ↔ Any            | **0.12s**        | Snappy response for attack/damage feedback         |
| First animation         | **0.15s** fadeIn | Gentle initial appearance                          |

### Transition Code Pattern (AvatarModel.tsx)

```typescript
useImperativeHandle(
    controlRef,
    () => ({
        setPose: (newPose: string) => {
            if (prevPoseRef.current === newPose) return;
            const nextAction = actions[newPose];
            const currentAction = activeActionRef.current;

            if (currentAction && currentAction !== nextAction) {
                const isLoco =
                    locomotionPoses.has(prevPoseRef.current) &&
                    locomotionPoses.has(newPose);
                const dur = isLoco ? 0.25 : 0.12;
                nextAction
                    .reset()
                    .setEffectiveTimeScale(1)
                    .setEffectiveWeight(1);
                currentAction.crossFadeTo(nextAction, dur, true);
                nextAction.fadeIn(dur).play();
            } else if (!currentAction) {
                nextAction.reset().fadeIn(0.15).play();
            }

            activeActionRef.current = nextAction;
            prevPoseRef.current = newPose;
        },
        // ...
    }),
    [actions],
);
```

---

## 🎮 4. Animation State Mapping

### Local Player (PlayerController.tsx)

The local player's animation state is determined by a priority chain:

```
1. Dead?              → "Death" / "Sword And Shield Death" (class-dependent)
2. Stunned/Frozen?    → "Stun" / "Dizzy"
3. Attacking?         → "Attack" → "Stable Sword Outward Slash" / "Magic Heal" (class)
4. Casting Skill?     → "Skill" → "Magic Heal"
5. BVHEcctrl Status:
   - IDLE             → "Idle"
   - WALK             → "Walking"
   - RUN              → "Slow Run" / "Run With Sword" (has weapon?)
   - JUMP_*           → "Jump With Sword"
```

### Remote Players (RemotePlayersRenderer.tsx)

Remote players receive animation state strings from the server and map them via `mapGameAnimationToAvatarPose()`:

```typescript
// Server sends: "Idle", "Walk", "Run", "Attack", "Skill", "Death", "Stun"
// Client maps to clip names:
"Walk"   → "Walking"
"Run"    → hasWeapon ? "Run With Sword" : "Slow Run"
"Attack" → class === Mage|Priest ? "Magic Heal" : "Stable Sword Outward Slash"
"Skill"  → "Magic Heal"
"Stun"   → "Stunned"
```

### Animation Timescale Sync

Locomotion animation speed is dynamically synced to the character's physics velocity:

| Pose                      | Timescale Formula                      |
| ------------------------- | -------------------------------------- |
| Walking                   | `max(0.3, min(1.4, speed / 1.8))`      |
| Jogging                   | `max(0.4, min(1.2, speed / 3.0))`      |
| Slow Run / Run With Sword | `max(0.4, min(2.8, speed / 3.2))`      |
| Attack (Sword Slash)      | `hitsPerSecond * 1.2` (synced to ASPD) |

All timescale changes use smooth interpolation: `currentLerp += (target - current) * 0.15`.

---

## 🧭 5. Character Rotation System (Two-Layer Architecture)

The character's rotation uses a **two-layer system** to separate movement rotation from attack targeting:

```
BVHEcctrl "Model" group (PARENT)     ← Movement rotation + Idle camera-facing
  └─ characterRef group (CHILD)      ← Attack target rotation (temporary)
       └─ AvatarModel (Armature)     ← Bone animations
```

### Layer Responsibilities

| Layer                    | Controller             | When Active    | Rotation Axis     |
| ------------------------ | ---------------------- | -------------- | ----------------- |
| **Parent** (model group) | BVHEcctrl + idle slerp | Moving + Idle  | Y-axis quaternion |
| **Child** (characterRef) | usePlayerTargeting     | Attacking only | Y-axis Euler      |

### Idle Camera-Facing Recovery

When the character stops moving (speed < 0.5) and is not attacking, the parent model group smoothly slerps to face the camera direction:

```typescript
// Character visual forward is +X in model group space
// BVHEcctrl lookAt convention: lookAt(inputDir, origin, up) orients +X toward inputDir
// Target angle: θ = atan2(-camDir.z, camDir.x)
const targetAngle = Math.atan2(-camDir.x, -camDir.z);
_idleTargetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
modelGroup.quaternion.slerp(_idleTargetQuat, 1 - Math.exp(-8.0 * delta));
```

### Child Rotation Reset

During attacks, `usePlayerTargeting.ts` accumulates Y rotation on `characterRef.current.rotation.y` to face the target. After the attack ends, this accumulated rotation is smoothly lerped back to 0:

```typescript
// Reset child rotation when not attacking (charState[0] === 0)
if (Math.abs(childRotY) > 0.001) {
    const resetFactor = 1 - Math.exp(-12.0 * delta);
    characterRef.current.rotation.y += (0 - childRotY) * resetFactor;
}
```

---

## ⚠️ 6. Critical Rules (DONT_TOUCH)

1. **NEVER add `new THREE.Vector3()` inside `useFrame`** — use module-level scratch objects
2. **NEVER keep Hips position/rotation tracks on locomotion clips** — causes snap-back glitch
3. **NEVER rotate `characterRef` when not attacking** — compounds with parent rotation
4. **NEVER use `lookAt` for idle rotation** — use `atan2` + `setFromAxisAngle` for pure Y-axis quaternion
5. **NEVER set `skipAnimControl` to false for remote players** — they use imperative control

---

🏆 **Wiki Index**: [README.md](README.md) · [10. Performance Optimization](10_performance_optimization.md) · 📖 [docs/Home.md](../../docs/Home.md)
