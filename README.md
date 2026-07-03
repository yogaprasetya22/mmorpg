# Jagres: Battle Simulator

Simulasi pertarungan 3D multipemain berbasis browser. Pemain bertarung melawan monster di arena real-time, lengkap dengan sistem kelas, skill, perlengkapan, dan editor peta 3D.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev)
[![Go](https://img.shields.io/badge/Go-1.25-00ADD8)](https://go.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r183-000000)](https://threejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Fitur Utama

| Fitur                   | Deskripsi                                                                        |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Arena Multipemain**   | Pertarungan real-time WebSocket antara pemain vs monster                         |
| **Sistem Kelas**        | Beginner → Mage, Warrior, Archer, Assassin, Priest — tiap kelas punya skill unik |
| **Sistem ECS**          | Entity Component System di backend Go untuk ribuan unit                          |
| **World Editor**        | Editor peta 3D langsung di browser — tempatkan objek, vegetasi, terrain          |
| **Avatar Configurator** | Kostumisasi penampilan karakter (rambut, pakaian, senjata)                       |
| **Environment Dinamis** | Cuaca storm, angin, efek painterly grass                                         |
| **Inventory & Shop**    | Sistem perlengkapan, jual-beli antar pemain, refining item                       |

---

## Arsitektur Repository

```
mmorpg/
├── frontend/             # Next.js 16 + React 19 + Three.js (web client)
│   ├── app/              # Pages & routing
│   │   ├── arena/        # Mode pertarungan multipemain
│   │   ├── world-editor/ # Editor peta 3D
│   │   └── character-creation/ # Pembuatan karakter
│   ├── src/
│   │   ├── components/   # Komponen 3D (avatar, environment, systems)
│   │   ├── features/     # Fitur besar (terrain, world-editor)
│   │   ├── entities/     # Player controller, physics
│   │   ├── core/         # Combat engine, damage calculator, class strategies
│   │   ├── hooks/        # WebSocket game hooks
│   │   └── state/        # Zustand stores
│   └── packages/         # Shared package (types, terrain, materials)
│
├── backend/              # Go server (Gin + WebSocket + ECS)
│   ├── cmd/              # Entry points (server, seeder, loadtest)
│   ├── internal/
│   │   ├── domain/       # Entity definitions, ECS components
│   │   ├── usecase/game/ # Game logic (combat, AI, spawn, inventory)
│   │   ├── delivery/     # Transport layer (HTTP, WebSocket, KCP)
│   │   └── repository/   # Database layer (PostgreSQL, Redis)
│   └── pkg/config/       # Konfigurasi server
│
├── packages/shared/      # @jagres/shared — tipe bersama, terrain, material
│
├── data/worlds/          # Data peta editor (file JSON)
├── wiki/                 # Dokumentasi arsitektur
└── .github/workflows/    # CI pipeline
```

## 📚 Documentation

Project has **4 documentation hubs**. New AI agents should read **all 4** for full context:

| Hub                    | Path                                                         | Purpose                                                         |
| ---------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| **README.md**          | [`README.md`](README.md)                                     | This file — overview, setup, key files                          |
| **DONT_TOUCH.md**      | [`DONT_TOUCH.md`](DONT_TOUCH.md)                             | 26 critical zones — performance, safety, error lookup           |
| **docs/**              | [`docs/Home.md`](docs/Home.md)                               | Wiki-style docs — architecture, dev guide, FAQ, troubleshooting |
| **wiki/architecture/** | [`wiki/architecture/README.md`](wiki/architecture/README.md) | Deep architecture for AI codegen context                        |

---

## Separation of Concerns

| Modul                  | Tanggung Jawab                                              |
| ---------------------- | ----------------------------------------------------------- |
| **Frontend (Next.js)** | Rendering 3D, input pemain, UI/HUD, WebSocket client        |
| **Backend (Go)**       | Server game, ECS engine, AI monster, otorisasi, persistensi |
| **@jagres/shared**     | Tipe data bersama, fungsi terrain, material registry        |
| **World Editor**       | Visual scene builder dalam browser (Zustand store)          |
| **Combat Engine**      | Damage formulas, class strategies, skill execution          |

---

## Core Concepts

### Frontend — Scene & R3F

Arena dan World Editor sama-sama pakai [`GameCanvas`](frontend/src/components/game/GameCanvas.tsx) sebagai root Three.js. Komponen 3D menggunakan React Three Fiber dengan pola:

```
GameCanvas
├── Environment (StormEnvironment / EnvironmentMultiGlobal)
├── Terrain (StormTerrain + TerrainMaterial)
├── Player (PlayerController → ECController + animasi)
├── RemotePlayersRenderer
├── RemoteMonstersRenderer
└── Systems (FrameLimiter, PostProcessing, VFXManager, dll)
```

State global dikelola dengan Zustand store yang terpisah per domain:

- [`useEditorStore`](frontend/src/features/world-editor/store/useEditorStore.ts) — state editor peta (6 slices: selection, terrain, vegetation, environment, history, persistence)
- [`useAvatarConfiguratorStore`](frontend/src/state/useAvatarConfiguratorStore.ts) — state kostumisasi avatar
- [`useSceneStore`](frontend/src/store/useSceneStore.ts) — state scene 3D umum

### Backend — ECS & Game Loop

Backend memakai ECS (Entity Component System) via library [`donburi`](https://github.com/yohamta/donburi):

```
Game Loop (20 tick/detik)
├── UpdatePlayerMovement
├── ProcessMonsterAI (pathfinding + attack)
├── HandlePlayerAttack (damage calculation)
├── SpawnMonster (respawn logic)
└── BroadcastState → WebSocket → Semua client
```

Komponen ECS inti: `PositionComponent`, `HealthComponent`, `PlayerComponent`, `MonsterComponent`, `CombatComponent`.

### Combat Engine

Sistem pertarungan menggunakan pola Strategy untuk tiap kelas:

```
DamageCalculator.calculate(attacker, defender, skill)
    ↓
ClassStrategy.getDamageModifier()
    ├── WarriorStrategy  → +damage, stun chance
    ├── MageStrategy     → AoE, elemental
    ├── ArcherStrategy   → critical, range
    ├── AssassinStrategy → poison, backstab
    └── PriestStrategy   → heal, buff
```

---

## Data Flow

### Arena — Pertarungan Real-Time

```
User Input (keyboard/mouse)
       ↓
PlayerController (useFrame)
       ↓
WebSocket → Backend
       ↓
GameUsecase.HandlePlayerAttack()
       ↓
DamageCalculator → ECS update
       ↓
WebSocket ← State Broadcast (setiap tick)
       ↓
RemotePlayersRenderer / RemoteMonstersRenderer (interpolasi posisi)
```

### World Editor — Map Building

```
Pointer Event (click/drag)
       ↓
WorldEditor (raycaster → hover/select/place)
       ↓
useEditorStore (Zustand)
       ├── updateItemsWithHistory (undo/redo via history slice)
       ├── setBrushHoverPos (visual feedback)
       └── persistToStorage (auto-save ke localStorage)
       ↓
InstancedVegetationRenderer / GrassField / EditorItem (render ulang)
```

---

## Technology Stack

### Frontend

| Teknologi         | Versi | Fungsi                             |
| ----------------- | ----- | ---------------------------------- |
| Next.js           | 16.2  | Framework React SSR                |
| React             | 19.2  | UI library                         |
| Three.js          | 0.183 | WebGL 3D engine                    |
| React Three Fiber | 9.5   | React renderer untuk Three.js      |
| @react-three/drei | 10.7  | Utilities R3F                      |
| Zustand           | 5.0   | State management                   |
| Tailwind CSS      | 4.0   | Styling utility                    |
| msgpack           | 3.1   | Serialisasi binary untuk WebSocket |

### Backend

| Teknologi         | Versi | Fungsi                 |
| ----------------- | ----- | ---------------------- |
| Go                | 1.25  | Server language        |
| Gin               | 1.12  | HTTP framework         |
| gorilla/websocket | 1.5   | WebSocket              |
| donburi           | 1.15  | ECS framework          |
| PostgreSQL (GORM) | -     | Database utama         |
| Redis             | 9.19  | Caching & session      |
| KCP               | 5.6   | Reliable UDP transport |
| Prometheus        | 1.23  | Metrics                |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.2 (package manager & runtime)
- [Go](https://go.dev) ≥ 1.25
- PostgreSQL running di `localhost:5432`
- Redis running di `localhost:6379`

### Setup

```bash
# 1. Clone repo & masuk direktori
cd mmorpg

# 2. Install dependensi frontend
cd frontend && bun install && cd ..

# 3. Copy environment
cp .env.example frontend/.env.local

# 4. Setup database
createdb jagres
cd backend && go run ./cmd/seeder && cd ..

# 5. Jalankan backend
cd backend && go run ./cmd/server &
cd ..

# 6. Jalankan frontend
cd frontend && bun dev
```

Buka [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker build -t jagres-frontend ./frontend
docker run -p 3000:3000 jagres-frontend
```

### CI/CD

Pipeline GitHub Actions (`.github/workflows/ci.yml`):

1. Install dependensi
2. Build `@jagres/shared` (`bunx tsc --build`)
3. Typecheck frontend (`bunx tsc --noEmit`)
4. Lint frontend (`bun run lint`)
5. Build backend (`go build`)

---

## Key Files

### Frontend

| Path                                                                                                                             | Fungsi                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [`frontend/app/arena/ArenaClient.tsx`](frontend/app/arena/ArenaClient.tsx)                                                       | Halaman utama arena — compose semua komponen game      |
| [`frontend/src/components/game/GameCanvas.tsx`](frontend/src/components/game/GameCanvas.tsx)                                     | Root R3F Canvas — setup scene, camera, controls        |
| [`frontend/src/components/game/environment/StormEnvironment.tsx`](frontend/src/components/game/environment/StormEnvironment.tsx) | Environment storm dengan dynamic weather               |
| [`frontend/src/features/world-editor/ui/WorldEditor.tsx`](frontend/src/features/world-editor/ui/WorldEditor.tsx)                 | Editor peta 3D — raycaster, drag, spray, wheel handler |
| [`frontend/src/features/world-editor/store/useEditorStore.ts`](frontend/src/features/world-editor/store/useEditorStore.ts)       | Zustand store editor (6 slices)                        |
| [`frontend/src/core/combat/ClassCombatEngine.ts`](frontend/src/core/combat/ClassCombatEngine.ts)                                 | Combat engine dengan class strategies                  |
| [`frontend/src/entities/player/ui/PlayerController.tsx`](frontend/src/entities/player/ui/PlayerController.tsx)                   | Kontrol pemain (keyboard → ECController)               |
| [`frontend/src/entities/player/hooks/usePlayerPhysics.ts`](frontend/src/entities/player/hooks/usePlayerPhysics.ts)               | Fisika pemain (Rapier physics)                         |

### Backend

| Path                                                                                             | Fungsi                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------ |
| [`backend/cmd/server/main.go`](backend/cmd/server/main.go)                                       | Entry point server             |
| [`backend/internal/domain/ecs.go`](backend/internal/domain/ecs.go)                               | Definisi ECS components        |
| [`backend/internal/usecase/game/game_usecase.go`](backend/internal/usecase/game/game_usecase.go) | Game loop & use case interface |
| [`backend/internal/usecase/game/combat.go`](backend/internal/usecase/game/combat.go)             | Logika pertarungan             |
| [`backend/internal/usecase/game/monster_ai.go`](backend/internal/usecase/game/monster_ai.go)     | AI monster                     |
| [`backend/internal/delivery/ws/game_handler.go`](backend/internal/delivery/ws/game_handler.go)   | WebSocket handler              |
| [`backend/internal/delivery/http/router.go`](backend/internal/delivery/http/router.go)           | HTTP router (auth, config)     |

### Shared

| Path                                                                             | Fungsi                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------- |
| [`packages/shared/src/index.ts`](packages/shared/src/index.ts)                   | Entry point — export semua tipe & fungsi    |
| [`packages/shared/src/map-item.ts`](packages/shared/src/map-item.ts)             | Tipe `MapItem` + fungsi `sanitizeAssetPath` |
| [`packages/shared/src/asset-registry.ts`](packages/shared/src/asset-registry.ts) | Registry aset (500+ item) & material        |
| [`packages/shared/src/terrain-height.ts`](packages/shared/src/terrain-height.ts) | Fungsi ketinggian terrain                   |
| [`packages/shared/src/wind.ts`](packages/shared/src/wind.ts)                     | Shader uniforms untuk efek angin            |

---

## Roadmap

- [x] Arena multipemain dasar (movement, attack, monster AI)
- [x] Sistem kelas dengan 5 job
- [x] World Editor — place, drag, spray, undo/redo
- [x] Avatar configurator
- [x] Inventory & equipment system
- [ ] Quest system lengkap
- [ ] Raid boss mekanik
- [ ] Mobile support (responsive UI)
- [ ] Steam / Tauri desktop build

---

## Kontribusi

1. Fork repo
2. Buat branch fitur: `git checkout -b feat/fitur-keren`
3. Commit perubahan: `git commit -m 'feat: tambah fitur keren'`
4. Push: `git push origin feat/fitur-keren`
5. Buka Pull Request

Pastikan `bunx tsc --noEmit` dan `bun run lint` lulus sebelum PR.

---

## Lisensi

MIT License — lihat file [LICENSE](LICENSE) untuk detail.
