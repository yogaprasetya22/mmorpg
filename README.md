# 🎮 Real-Time 3D Multiplayer MMORPG Sandbox

Welcome to the official repository of your high-performance, server-authoritative 3D multiplayer MMORPG sandbox! This project is built using a modern, reactive tech stack featuring a fast Go-based simulation server and an interactive 3D web-browser viewport.

---

## 🚀 1. The Core Vision

This project is a **Next-Generation 3D Web MMORPG and Sandbox World Editor**. The entire experience runs directly inside any modern browser without plugins, powered by hardware-accelerated 3D graphics and low-latency client-server synchronization.

### Key Pillars:
1. **Server-Authoritative Real-Time Simulation**: Position updates, AI states, threat calculations, and health bars are verified and computed on the Go server at a **30Hz fixed tick rate** and synchronized via low-latency WebSockets.
2. **Dynamic World Editor (No Re-deploys)**: Developers and creators can build worlds in real-time by painting terrain elevations, styling ground textures, placing architectural props, and configuring monster spawners directly inside the browser. Changes are persisted in a PostgreSQL database and immediately visible to all active players.
3. **High-Performance Rendering Engine**: Implements an **Entity-Component System (ECS)** in React Three Fiber to pool SkinnedMesh objects lazily. This allows rendering hundreds of active combatants, players, and terrain props smoothly at 60+ FPS, even on low-end hardware.

---

## 🛠️ 2. Comprehensive Tech Stack

The architecture is divided into a high-concurrency server and a reactive, interactive 3D client:

```
+-----------------------------------------------------------+
|               React Three Fiber / ECS Client              |
+-----------------------------+-----------------------------+
                              |
             (HTTP REST)      |      (WebSockets JSON)
       +----------------------+----------------------+
       |                                             |
       v                                             v
+------+----------------------+             +--------+------+
|     Go Gin API Server       |             | Go WS Tick Hub|
+--------------+--------------+             +--------+------+
               |                                     |
               | (GORM Migrations)                   | (Session States)
               v                                     v
+--------------+--------------+             +--------+------+
|        PostgreSQL DB        |             |  Redis Cache  |
+-----------------------------+             +---------------+
```

### 🔹 The Backend (Go Engine)
* **Gin Gonic**: High-speed, lightweight HTTP routing engine serving dynamic config REST APIs.
* **WebSocket Hub**: Full-duplex communication channel handling client-server message serialization at 33.3ms ticks (30Hz).
* **GORM (ORM)**: Auto-migrates SQL schemas and handles deep queries for players, map layouts, item coordinates, and monster spawns.
* **PostgreSQL**: Hard persistence layer storing player positions, persistent maps, terrain structures, and item states.
* **Redis**: In-memory cache layer for player session states, dynamic spatial grids, and fast state replication.

### 🔹 The Frontend (Next.js 3D Viewport)
* **Next.js (App Router)**: Modern React skeleton providing client-side page routing, server-rendered layouts, and API proxy routes.
* **React Three Fiber (R3F) & Three.js**: Canvas renderer managing three-dimensional vectors, painterly post-processing shaders, shadows, and materials.
* **Zustand**: Clean, centralized client-side state machine managing active editor tools, items, map loads, and UI options.
* **Bitecs (ECS)**: A flat-array, high-performance Entity-Component System that drives massive crowd animations and coordinate updates in the rendering loop.

---

## 💾 3. Database Schema Blueprint

The PostgreSQL relational database is structured to support dynamic mapping and persistent player locations:

### 👤 `characters` (Player Records)
Tracks individual players, their leveling states, and their persistent physical presence:
* `id` (Primary Key)
* `username` / `character_name`
* `class` (Fighter, Tank, Mage, Marksman, Assassin)
* `x`, `y`, `z` (Coordinates) — **Saves player spawn coordinates on logout so they respawn exactly where they exited**
* `hp`, `max_hp`, `level`, `exp`

### 🗺️ `map_configs` (Map Configuration Layer)
Stores the physical properties of multi-map zones:
* `id` / `map_id` (e.g., `"Starter Zone"`, `"Castle Arena"`)
* `name` (Readable title)
* `paint_data` (Base64 string representing dynamic painted ground textures)
* `sculpt_data` (Base64 heightmap image string representing dynamic terrain elevations)
* `terrain_color` (Hex or color index for background thematic blending)

### 🧱 `map_items` (Placed Dynamic World Objects)
Tracks every 3D model placed in the sandbox:
* `id` (Primary Key)
* `map_config_id` (Foreign Key referencing `map_configs`)
* `path` (Pristine relative pathway, e.g., `/assets-model/kingdom/wall.glb`)
* `pos_x`, `pos_y`, `pos_z` (Position coordinates)
* `rot_x`, `rot_y`, `rot_z` (Rotation quaternions or Euler angles)
* `scale_x`, `scale_y`, `scale_z` (Scale vectors)

### 👾 `monster_configs` (Monster Attributes)
Maintains individual stats of monster classes:
* `type` (Primary Key, e.g., `"enemy_grunt"`, `"enemy_boss"`)
* `base_hp`, `speed`, `damage`
* `leash_range` (Max distance before returning spawn point)

---

## 🌟 4. Advanced Systems Already Built

1. **Dynamic Asset Scanner**: The backend recursively crawls `./assets-model` to dynamically deliver available `.glb` files over an API. This allows developers to add new assets by just putting a file in a folder.
2. **Authoritative AI State Machine**: Monsters operate on a server-controlled AI cycle:
   * **Patrolling**: Wandering around spawn points.
   * **Chasing**: Locking onto target players using a robust aggro system (first strike generates lock).
   * **Returning Home**: If a player runs too far (violating `leash_range`), the monster walks smoothly back to its spawn anchor at 85% speed, ignoring further threat until reset.
3. **Persistent World Coordinates**: The server saves player positions on exit, meaning players return to their last exact coordinates upon logging back in.
4. **Painterly Aesthetics**: The custom rendering pipeline uses painterly outline styling, soft shadows, and instanced ground shaders, creating a beautiful and premium stylized fantasy visual.
5. **Deterministic GORM 10-Enemy Spawner & Seeder**: Replaced randomized monster spawns with a strategic, hard-coded layout of 10 distinct monster types at fixed coordinates. Integrated a standalone seeder tool in `backend/cmd/seeder/main.go` and mapped it to a clean `make seed-enemy` CLI workflow.
6. **High-Performance Tactical Minimap**: A state-of-the-art `<Minimap />` component built with DOM pooling and a `requestAnimationFrame` render loop to track up to 35 monsters and 12 players at 60 FPS without React lifecycle re-rendering overhead.
7. **Ultra-Low Latency HP & Death Sync**: Synchronizes player health authoritatively over 20Hz WebSocket updates. On death, characters have their physics capsule movements completely paused to eliminate sliding bugs, while the camera smoothly maintains focus on the fallen player.

---

> [!TIP]
> **To add new maps, assets, or monsters**: Simply drop new `.glb` files into the backend `assets-model` folder, configure a spawn point using the World Editor, and the server will automatically distribute them across the multiplayer canvas!

---

## ⚙️ 5. Unified Command-Line (CLI) Interface

The repository features an authoritative `Makefile` to simplify all development, verification, seeding, and production build tasks:

### Development & Simulation
```bash
# Start both Go backend and Next.js frontend concurrently
make run

# Start only the authoritative Go backend
make run-backend

# Start only the React/Three Fiber frontend
make run-frontend

# Cleanly terminate any running processes on ports 8080 or 3000
make kill
```

### Seeding & Data Setup
```bash
# Force wipe and freshly seed the 10 varied enemy configurations
make seed-enemy
```

### Verification & Testing
```bash
# Execute dual-engine compilation and Next.js TypeScript type-safety check
make check
```

### Production Builds
```bash
# Build both Go backend and Next.js frontend for production
make build

# Compile the Go backend binary into backend/build/server
make build-backend

# Generate the Next.js frontend production bundle
make build-frontend

# Remove all compiled binary artifacts
make clean
```

---

## 🤖 6. AI Assistant Pair-Programming Guide
If you are developing this codebase alongside an AI assistant, ensure that the agent reads and strictly adheres to the authoritative compilation and deployment checks specified in:
👉 **[AI Assistant Pairing Rules & Instructions (SKILL.md)](SKILL.md)**
