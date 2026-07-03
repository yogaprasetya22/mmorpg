# 🏛️ Jagres: Battle Simulator — Architecture Wiki

> **Project**: Server-authoritative 3D web MMORPG sandbox inspired by Ragnarok Online (iRO Renewal).
> **Stack**: Go backend (30Hz tick) + Next.js/React Three Fiber frontend (60 FPS).
> **Scale**: Targets 50 concurrent players + 35 monsters at 60 FPS on mid-range hardware.
> **Also known as**: "Ragnarok: The New World" (development codename).

Welcome to the internal architecture wiki for **Jagres: Battle Simulator**. This documentation covers the complete data flow from server-authoritative combat calculations through WebSocket synchronization to 3D rendering and animation playback.

> 📖 **High-level context:** [README.md](../../README.md) · [docs/Home.md](../../docs/Home.md) · [docs/Architecture.md](../../docs/Architecture.md) · [DONT_TOUCH.md](../../DONT_TOUCH.md)

---

## 🗺️ Wiki Navigation Map

```
wiki/architecture/
├── 📄 README.md                           ← (You are here)
├── 📄 00_context_bootstrap.md            ← Stage 0: Global Architecture, Tech Stack & DONT_TOUCH
├── 📄 01_backend_domain.md               ← Stage 1: Player Stats Struct & RecalculateStats
├── 📄 02_backend_combat.md               ← Stage 2: Authoritative Combat (HIT/FLEE, DEF, CRIT)
├── 📄 03_frontend_state.md               ← Stage 3: Client State & WebSocket Sync
├── 📄 04_frontend_combat_ui.md           ← Stage 4: ASPD Animation Sync & Damage HUD
├── 📄 05_database_migrations.md          ← Stage 5: GORM Migrations & Seeding
├── 📄 06_combat_formula_ref.md           ← Stage 6: iRO Renewal Formula Reference Sheet
├── 📄 07_network_sync_protocol.md        ← Stage 7: WebSocket Protocol & JSON Schema
├── 📄 08_avatar_configurator_integration.md ← Stage 8: Avatar Creator & Baked GLB Pipeline
├── 📄 09_animation_system.md             ← Stage 9: FBX Animation Pipeline & Rotation System
└── 📄 10_performance_optimization.md     ← Stage 10: 60 FPS Optimization Architecture
```

---

## 🎮 Project Overview

### Core Pillars

1. **Server-Authoritative Simulation**: All combat math, hit/miss rolls, and damage calculations run on the Go backend at 30Hz. The client is a "dumb terminal" that renders results — no client-side damage cheating possible.

2. **Browser-Based 3D World**: The entire game runs in-browser using WebGL via React Three Fiber. No downloads, no plugins. Custom painterly shaders, dynamic terrain sculpting, and real-time world editing.

3. **Low-Latency Multiplayer**: WebSocket (TCP) + KCP (UDP) dual transport with MessagePack binary serialization. Player state sync at 20Hz upload / 30Hz download.

4. **Ragnarok Online Combat**: Faithful iRO Renewal formulas — HIT vs FLEE accuracy, Hard + Soft DEF mitigation, Critical Hit Shield, ASPD-based attack speed, Variable/Fixed Cast Time.

### Character Classes

| Class    | Role           | Attack Animation           | Skill Animation               |
| -------- | -------------- | -------------------------- | ----------------------------- |
| Warrior  | Melee DPS      | Stable Sword Outward Slash | Magic Heal (cyclone VFX)      |
| Mage     | Ranged Caster  | Magic Heal                 | Magic Heal (meteor VFX)       |
| Priest   | Support/Tank   | Magic Heal                 | Magic Heal (sanctuary VFX)    |
| Thief    | Melee Assassin | Stable Sword Outward Slash | Magic Heal (teleport VFX)     |
| Beginner | Ranged MM      | Stable Sword Outward Slash | Magic Heal (bullet storm VFX) |

---

## 🔄 Combat Loop Lifecycle

Every attack follows this authoritative pipeline:

```
[CLIENT]                         [SERVER]                         [ALL CLIENTS]
   │                                │                                  │
   ├── 1. Auto-attack trigger       │                                  │
   │   (ASPD rate-limited)          │                                  │
   ├── 2. Send AttackRequest ──────>│                                  │
   │   { targetId, isCrit }         │                                  │
   │                                ├── 3. Rate-limit validation       │
   │                                │   (anti-speedhack check)         │
   │                                ├── 4. HIT vs FLEE roll           │
   │                                │   (authoritative accuracy)       │
   │                                ├── 5. DEF mitigation             │
   │                                │   (Hard A+B + Soft DEF)         │
   │                                ├── 6. Apply damage to DB         │
   │                                │   (GORM transaction)            │
   │                                ├── 7. Broadcast GameState ──────>│
   │                                │   { hp, damage, isCrit, isMiss }│
   │                                │                                  ├── 8. Spawn VFX
   │                                │                                  │   (critical/magic)
   │                                │                                  ├── 9. Damage HUD
   │<──────────── Update stats ─────│                                  │   (bouncing text)
```

---

## 🚨 Critical Areas (DONT_TOUCH)

The following systems have been deeply optimized and **must not be modified** without thorough understanding. Full details in [DONT_TOUCH.md](../../DONT_TOUCH.md).

### Red Zone — Never Change

| #   | System                            | Location               | Risk                          |
| --- | --------------------------------- | ---------------------- | ----------------------------- |
| 1   | Ground Detection (SHAPECAST)      | `GameCanvas.tsx`       | Character stuck on stairs     |
| 2   | MessagePack Decoder (main thread) | `useWebSocketGame.ts`  | CSP block, game dies          |
| 3   | Monster AI (lock-free FSM)        | `monster_ai.go`        | GC spike, server freeze       |
| 4   | Spatial Hash Grid (O(1) aggro)    | `game_usecase.go`      | CPU overload at 100+ monsters |
| 5   | Player Send Rate (20Hz cap)       | `PlayerController.tsx` | Network overload, rubberband  |

### Orange Zone — Change With Extreme Caution

| #   | System                           | Location                    | Risk                            |
| --- | -------------------------------- | --------------------------- | ------------------------------- |
| 6   | useFrame zero-allocation         | All renderers               | GC spike, FPS → 15              |
| 7   | Sort throttle (10Hz)             | Remote renderers            | Frame budget overrun            |
| 8   | Object pool reuse                | Remote renderers            | Heap fragmentation              |
| 9   | Locomotion root motion stripping | `AvatarModel.tsx`           | Animation snap-back glitch      |
| 10  | Two-layer rotation system        | `PlayerController.tsx`      | Character faces wrong direction |
| 11  | Zero-re-render architecture      | `RemotePlayersRenderer.tsx` | React reconciliation storm      |
| 12  | Terrain height cache             | `terrainCache.ts`           | 1,680 raycasts/sec              |
| 13  | Exponential smoothing            | Both remote renderers       | Object allocation storm         |

### Green Zone — Safe to Modify

- `app/arena/components/*.tsx` — UI overlays (chat, stats, HUD)
- `src/components/ui/*.tsx` — Non-3D UI components
- `backend/internal/delivery/http/` — REST API handlers
- `backend/internal/usecase/auth/` — Authentication logic
- `backend/internal/domain/*.go` — Struct definitions (backward-compatible)
- Asset files (`.glb`, `.fbx`, `.hdr`, `.png`) — freely addable

---

## 📚 Stage-by-Stage Implementation Guide

### [Stage 0: Global Architecture](00_context_bootstrap.md)

Directory structure, tech stack, dependency map, and DONT_TOUCH guardrails.

### [Stage 1: Backend Domain](01_backend_domain.md)

Player stat structs (STR-LUK + POW-CRT talents), `RecalculateStats()`, GORM auto-migration.

### [Stage 2: Backend Combat](02_backend_combat.md)

ASPD rate-limiting, HIT vs FLEE accuracy rolls, Critical Hit Shield, Hard + Soft DEF mitigation.

### [Stage 3: Frontend State](03_frontend_state.md)

Client stat allocation UI, WebSocket payload sync, `requestIdleCallback` polling.

### [Stage 4: Frontend Combat UI](04_frontend_combat_ui.md)

ASPD animation timescale sync, Variable/Fixed Cast Time bars, batched Damage HUD popups.

### [Stage 5: Database Migrations](05_database_migrations.md)

GORM auto-migration, column alias safety, seed data for new characters.

### [Stage 6: Formula Reference](06_combat_formula_ref.md)

Complete iRO Renewal math: Status ATK/MATK, DEF A+B, RES/MRES, HIT/FLEE, Perfect Dodge, VCT reduction.

### [Stage 7: Network Protocol](07_network_sync_protocol.md)

C2S packets (STAT_ALLOCATE, PLAYER_ATTACK), S2C packets (GAME_STATE_UPDATE, COMBAT_DAMAGE_EVENT), 30Hz broadcast cycle.

### [Stage 8: Avatar Configurator](08_avatar_configurator_integration.md)

Modular character creator, baked GLB pipeline for remote players, Draco + WebP compression.

### [Stage 9: Animation System](09_animation_system.md)

14 Mixamo FBX clips, root motion stripping, crossfade transitions, two-layer rotation system, idle camera-facing recovery.

### [Stage 10: Performance Optimization](10_performance_optimization.md)

Zero-re-render architecture, terrain cache, exponential smoothing, shared geometry, shadow culling, load testing.

---

## 🛠️ Development Commands

```bash
make run                  # Start backend + frontend
make seed-enemy           # Wipe DB + seed monsters + config
make check                # Go build + TypeScript check
make build                # Production build (both)
make loadtest-anim-stress # 20 players, animation diversity FSM
make loadtest             # 50 players, standard stress
make loadtest-extreme     # 120 players, maximum stress
```

---

_Last updated: 2026-06-10. For critical area details, see [DONT_TOUCH.md](../../DONT_TOUCH.md)._
