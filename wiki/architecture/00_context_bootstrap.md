# 🚀 00. Global Architecture & Context Bootstrap
> **Status**: Wajib dibaca oleh AI Agent atau pengembang baru untuk mem-bootstrap konteks proyek MMORPG ini dalam 3 detik.

Dokumen ini menjelaskan rancangan arsitektur utuh proyek game MMORPG Anda, mencakup susunan direktori, teknologi yang digunakan, serta batasan-batasan teknis kritis (*critical guardrails*) yang tidak boleh dilanggar berdasarkan analisis performa mendalam.

---

## 🗺️ 1. Peta Direktori Workspace (Workspace Folder Map)

Berikut adalah struktur folder utama proyek beserta deskripsi komponen yang dikandungnya:

```
game mmorpg/                             <-- Root Repositori
├── 📂 backend/                          <-- Authoritative Server-Side (Go)
│   ├── 📂 cmd/                          <-- Entry points server (REST API, WS, KCP)
│   └── 📂 internal/                     <-- Kebijakan domain & usecase internal
│       ├── 📂 delivery/                 <-- Transport layer (HTTP, WebSocket, KCP)
│       │   ├── 📂 ws/                   <-- ws/hub.go (Non-blocking fan-out), game_handler.go
│       │   └── 📂 kcp/                  <-- High-frequency UDP-based delivery
│       ├── 📂 domain/                   <-- player.go (Core stats & RecalculateStats), monster.go
│       ├── 📂 repository/               <-- Data access layers
│       │   ├── 📂 postgres/             <-- postgres/connection.go (GORM AutoMigrate)
│       │   └── 📂 redis/                <-- In-memory state caching (Player coordinates)
│       └── 📂 usecase/                  <-- Logic bisnis game
│           └── 📂 game/                 <-- combat.go, game_usecase.go, monster_ai.go (O(1) Spatial Hash Grid)
│
├── 📂 frontend/                         <-- Client-Side Interface (Next.js + R3F + Tailwind)
│   ├── 📂 app/                          <-- Next.js Pages & Layouts (app/arena/ background polling)
│   ├── 📂 public/                       <-- Static assets (Chef_Male.glb, textures)
│   └── 📂 src/                          <-- Konten Aplikasi Utama
│       ├── 📂 components/               <-- Komponen UI & Engine 3D
│       │   └── 📂 game/                 <-- GameCanvas.tsx (SHAPECAST), PlayerController.tsx (20Hz Cap)
│       │       ├── 📂 hooks/            <-- usePlayerCombat.ts, useWebSocketGame.ts (MsgPack Decoder)
│       │       └── 📂 systems/          <-- DamageHUDBatcher.tsx (Batching), VFXManager.tsx
│       ├── 📂 core/                     <-- Core logic, math, battle grids
│       └── 📂 state/                    <-- Store global (useStore.ts, useEditorStore.ts)
│
├── 📂 wiki/                             <-- Dokumentasi Arsitektur
│   └── 📂 architecture/                 <-- Lembar panduan implementasi 7 Tahap (00 - 07)
│
├── 📄 DONT_TOUCH.md                     <-- 🚨 PANDUAN KRITIS AREA OPTIMASI (Wajib Dibaca)
├── 📄 Makefile                          <-- Task runner (server build, dev run, port clean)
└── 📄 docker-compose.yml                <-- Setup DB PostgreSQL & Redis
```

---

## 🛠️ 2. Spesifikasi Teknologi (Tech Stack & Dependencies)

Game ini dibangun menggunakan teknologi mutakhir dengan arsitektur hibrida untuk latensi ultra-rendah:

| Layer | Teknologi Utama | Dependensi Utama | Keterangan |
|---|---|---|---|
| **Backend** | Go (Golang 1.21+) | `gorm.io/gorm`, `redis/go-redis` | ECS architecture, lock-free AI state machines |
| **Frontend** | React (Next.js 15) | `@react-three/fiber`, `@react-three/drei` | Engine 3D berbasis WebGL, pointer lock camera |
| **Networking** | WebSocket + KCP | `@msgpack/msgpack` | Serialisasi data MessagePack biner (hemat bandwidth) |
| **Database** | PostgreSQL 15 | GORM driver pgsql | Penyimpanan gigih data karakter (Quest, Inventory, Stats) |
| **Caching** | Redis | go-redis | Koordinat spasial real-time & sinkronisasi multi-node |

---

## 🚨 3. Batasan Desain & Aturan Optimasi Kritis (DONT_TOUCH Guardrails)

Untuk menjaga kestabilan server pada beban 100+ entitas dan 60 FPS stabil di sisi client, aturan optimasi dari `@[/home/yoga/Dokumen/game mmorpg/DONT_TOUCH.md]` berikut **harus dipatuhi secara absolut**:

### A. Aturan Sisi Frontend (Client-Side Constraints)
1.  **Zero-Allocation di `useFrame`**: 
    Jangan pernah membuat instansiasi objek baru (seperti `new THREE.Vector3()`, `array.filter()`, `array.map()`) di dalam frame loop `useFrame()`. Gunakan deklarasi *scratch object* di level modul luar dan bersihkan dengan loop konvensional.
2.  **Player Send Rate Cap (20Hz)**: 
    Paket koordinat gerakan pemain dikirim maksimal setiap **50ms** dengan fitur deduping gerakan (tidak mengirim jika diam) untuk mencegah penumpukan buffer WebSocket.
3.  **Ground Detection (SHAPECAST)**: 
    Selalu gunakan `SHAPECAST` untuk deteksi tanah pada `<PlayerController>` di `GameCanvas.tsx`. Jangan ganti ke `RAYCAST` (bisa membuat tersangkut prop tipis) atau `BOTH` (membuat double-calculation FPS drop parah).
4.  **Sort Throttle (10Hz)**: 
    Loop pengurutan jarak monster terdekat di `RemoteMonstersRenderer.tsx` dibatasi maksimal berjalan setiap 100ms, bukan setiap frame (60Hz).
5.  **Local MessagePack Decoder**: 
    Decoding biner MessagePack berjalan langsung di Main Thread lewat file lokal `@msgpack/msgpack`. Jangan memindahkannya ke Web Worker karena diblokir oleh CSP (Content Security Policy) browser di production.

### B. Aturan Sisi Backend (Server-Side Constraints)
1.  **Lock-Free Monster AI State Machine**: 
    Peralihan AIState monster dilakukan langsung lewat pengubahan field struct, tanpa memanggil mutex lock global atau pustaka State Machine eksternal untuk menghindari lonjakan alokasi memori GC (Garbage Collector).
2.  **O(1) Spatial Hash Grid**: 
    Pencarian target monster (aggro) menggunakan 2D Spatial Hash Grid berukuran cell 10.0 unit. Jangan kembalikan ke loop linear $O(N^2)$ yang dapat membekukan CPU server saat monster bertambah.
3.  **Buffered Non-Blocking WS Hub Fan-Out**: 
    Penyebaran paket *broadcast* koordinat pemain di `delivery/ws/hub.go` menggunakan buffered channel non-blocking. Klien yang lambat langsung di-drop untuk menghindari hambatan pada klien lain.

---

## 🔄 4. Jalur Alur Pertempuran (Combat Flow Lifecycle)

Di bawah ini adalah ilustrasi bagaimana data tempur mengalir melintasi seluruh modul utama proyek:

```
[FRONTEND CLIENT]
  │
  ├── 1. Deteksi Target (PlayerController.tsx query nearby grid)
  ├── 2. Input Attack / Auto-Attack (usePlayerCombat.ts)
  │      └── Hitung interval dynamic ASPD (1000 / hitsPerSecond)
  ├── 3. Transmisi Paket Attack (useWebSocketGame.ts send MessagePack)
  │
  v
[BACKEND GO SERVER]
  │
  ├── 4. WebSocket Game Handler (delivery/ws/game_handler.go decode msg)
  ├── 5. Usecase Combat (usecase/game/combat.go)
  │      ├── Cooldown rate-limit check (anti-speedhack)
  │      ├── Hit vs Flee accuracy roll (Authoritative dice check)
  │      ├── Crit Shield & C.RATE roll reduction (LUK-based check)
  │      └── A+B Defense & RES reduction (player.go CalculateDamageTo)
  ├── 6. Simpan Status HP (usecase database update)
  ├── 7. Broadcast Snapshot Per Tick 30Hz (delivery/ws/hub.go non-blocking)
  │
  v
[FRONTEND RENDERING]
  │
  ├── 8. GameStateUpdate Receiver (useWebSocketGame.ts msgpack decode)
  ├── 9. VFX Spawner (VFXManager.tsx trigger critical/magic impact)
  └── 10. Popup Damage (DamageHUDBatcher.tsx render bouncing text)
```

Dengan mengasimilasi panduan global arsitektur ini, Anda sekarang memiliki kendali dan pengetahuan utuh atas seluruh alur pergerakan logika di dalam proyek game MMORPG Anda!

---

🏆 **Indeks Wiki Lengkap**:
*   [01. Tahap 1: Backend Domain & Recalculate Logic](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/01_backend_domain.md)
*   [02. Tahap 2: Backend Combat Usecase & Accuracy Checks](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/02_backend_combat.md)
*   [03. Tahap 3: Frontend Client State & WebSocket Allocation](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/03_frontend_state.md)
*   [04. Tahap 4: Frontend Combat UI & Animations](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/04_frontend_combat_ui.md)
*   [05. Tahap 5: Database Migrations & Data Seeding](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/05_database_migrations.md)
*   [06. Tahap 6: Lembar Rumus Matematika Combat](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/06_combat_formula_ref.md)
*   [07. Tahap 7: Protokol WebSocket & Skema JSON](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/07_network_sync_protocol.md)
*   [08. Tahap 8: Integrasi & Optimasi Modul Kustomisasi Avatar](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/08_avatar_configurator_integration.md)
