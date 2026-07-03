# Arsitektur Jagres

## Gambaran Besar

Proyek ini terdiri dari **dua aplikasi utama** + **satu package bersama**:

```
┌────────────────────────────────────────────────────┐
│                    Frontend                         │
│           Next.js 16 + React 19 + R3F              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   Arena   │  │  World   │  │  Avatar Config   │  │
│  │ Multiplayer│  │  Editor  │  │  Character       │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│             ┌────────────────────┐                  │
│             │  GameCanvas (R3F)  │                  │
│             └────────────────────┘                  │
└──────────────────────┬─────────────────────────────┘
                       │ WebSocket (msgpack)
                       ▼
┌────────────────────────────────────────────────────┐
│                    Backend (Go)                     │
│  ┌────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  HTTP  │  │  WebSocket   │  │  Game Loop      │  │
│  │  (Gin)  │  │  Handler     │  │  (20 tps)      │  │
│  └────────┘  └──────────────┘  │  ┌──────────┐   │  │
│                                │  │ ECS      │   │  │
│  ┌──────────────────────────┐  │  │ (donburi) │   │  │
│  │  GameUsecase             │  │  └──────────┘   │  │
│  │  (combat, AI, inventory)  │  └────────────────┘  │
│  └──────────────────────────┘                       │
│  ┌────────────┐  ┌────────────────────────────────┐ │
│  │ PostgreSQL │  │  Redis                         │ │
│  │ (GORM)     │  │  (session, cache, pub/sub)     │ │
│  └────────────┘  └────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

## Struktur Direktori

### Frontend (`frontend/`)

| Direktori              | Isi                                                            |
| ---------------------- | -------------------------------------------------------------- |
| `app/`                 | Halaman Next.js (arena, world-editor, character-creation)      |
| `app/arena/`           | Halaman utama pertarungan + komponen UI (chat, HUD, inventory) |
| `src/components/game/` | Komponen 3D inti (GameCanvas, Environment, Avatar, Systems)    |
| `src/features/`        | Fitur besar (terrain, world-editor)                            |
| `src/entities/`        | Player controller, hooks, tipe                                 |
| `src/core/`            | Combat engine, damage calculator, class strategies             |
| `src/state/`           | Zustand stores (scene, avatar configurator)                    |
| `src/hooks/`           | WebSocket game hook                                            |

### Backend (`backend/`)

| Direktori                | Isi                                       |
| ------------------------ | ----------------------------------------- |
| `cmd/server/`            | Entry point server                        |
| `cmd/seeder/`            | Seeder database                           |
| `internal/domain/`       | Entity definitions, ECS components        |
| `internal/usecase/game/` | Game logic (combat, AI, spawn, inventory) |
| `internal/delivery/`     | Transport layer (HTTP, WebSocket, KCP)    |
| `internal/repository/`   | Database layer                            |

### Shared (`packages/shared/`)

Package `@jagres/shared` berisi tipe dan utilitas yang dipakai frontend dan editor:

| File                         | Fungsi                                      |
| ---------------------------- | ------------------------------------------- |
| `src/map-item.ts`            | Tipe `MapItem` — representasi objek di peta |
| `src/asset-registry.ts`      | 500+ aset & material                        |
| `src/terrain-height.ts`      | Fungsi ketinggian terrain                   |
| `src/wind.ts`                | Efek angin (shader uniforms)                |
| `src/painterly-materials.ts` | Material painterly style                    |

## ECS di Backend

Kita pakai ECS (Entity Component System) via library [`donburi`](https://github.com/yohamta/donburi).

### Komponen

```go
PositionComponent { X, Y, Z, Rotation, Animation }
HealthComponent   { HP, MaxHP }
PlayerComponent   { Username, Level, Class }
MonsterComponent  { MonsterType, AIState, AggroRange }
CombatComponent   { AttackPower, Defense, SkillCooldowns }
```

### Game Loop (20 tps)

```
Tick ke-n:
1. Baca input dari WebSocket (movement, attack)
2. Update posisi semua entitas
3. Proses AI monster (cari target, serang)
4. Hitung damage untuk serangan yang masuk
5. Respawn monster yang mati
6. Broadcast state ke semua client
```

## Zustand Stores (Frontend)

| Store                        | Irisan   | Fungsi                                                            |
| ---------------------------- | -------- | ----------------------------------------------------------------- |
| `useEditorStore`             | 6 slices | Selection, terrain, vegetation, environment, history, persistence |
| `useAvatarConfiguratorStore` | -        | Kostumisasi avatar (rambut, skin, senjata)                        |
| `useSceneStore`              | -        | Manajemen scene 3D umum                                           |

### Pola Slice (untuk `useEditorStore`)

Setiap slice adalah `StateCreator` Zustand yang digabung:

```typescript
export const useEditorStore = create<EditorStore>()(
    subscribeWithSelector((...args) => ({
        ...createSelectionSlice(...args),
        ...createTerrainSlice(...args),
        ...createVegetationSlice(...args),
        ...createEnvironmentSlice(...args),
        ...createHistorySlice(...args),
        ...createPersistenceSlice(...args),
    })),
);
```

## Data Flow

### Arena

```
Input Pemain (keyboard)
    → PlayerController.tsx
    → WebSocket.send(playerState)
    → Backend: UpdatePlayerMovement()
    → Game Loop tick
    → WebSocket.broadcast(state)
    → RemotePlayersRenderer / RemoteMonstersRenderer (interpolasi)
```

### World Editor

```
Mouse click/drag
    → WorldEditor.tsx (raycaster)
    → useEditorStore (state update + history)
    → React re-render komponen 3D
```

---

## Related Documentation

- [🚨 DONT_TOUCH.md](../DONT_TOUCH.md) — 26 critical performance zones
- [🏛️ Arsitektur Wiki (Detail)](../wiki/architecture/README.md) — Stage-by-stage architecture
