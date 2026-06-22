# 🤖 Authoritative AI Assistant Pair-Programming Playbook

This document defines the strict, high-fidelity engineering directives that **every** AI pairing agent must read, acknowledge, and adhere to when contributing to this real-time multiplayer MMORPG ecosystem.

> [!NOTE]
> Before modifying any architecture, GORM database schema, or React Three Fiber pipeline, you MUST study the comprehensive tech stack and data layout blueprints documented in the main **[Project Blueprint (README.md)](README.md)**.

---

## 🎯 1. Core Engineering Philosophies

* **authoritative Server Architecture**: All gameplay mechanics (health pools, coordinate calculations, monster combat state-machines, movement updates) must remain authoritatively controlled on the Go backend server. The React/Three Fiber frontend serves solely as an interpolating visualization shell.
* **Pragmatic Persistence**: Do not store hardcoded paths, absolute local assets directory strings, or redundant network prefixes in GORM/PostgreSQL records. Save path strings in database columns as clean, portable relative formats (e.g., `/assets/environment/trees/Pine_1.glb`) and let the runtime load layers prepend absolute remote origins (`http://localhost:8080`) dynamically.
* **Zero Regression Standard**: Codebase modifications must not introduce compilation warnings, linting failures, or runtime crashes in either the Go server or the Next.js frontend app.

---

## 🛠️ 2. Dual-Engine Verification Protocol

After **every single modification, addition, or refactoring**, and **always as the final step before concluding your turn**, you MUST run both the authoritative verification and production build commands:
```bash
# 1. Verification checks (TypeScript & Backend compiler safety)
make check

# 2. Production build verification (Next.js production bundle & Go executable packaging)
make build
```

This ensures that the entire code compiles cleanly, has zero type regressions, and builds successfully into optimized production artifacts without any bundle or asset packing errors. All commands MUST pass with a green state (`Exit code: 0` / `Zero regression detected`) before concluding your turn.

---

## ⚡ 3. High-Performance Front-End Standards

To maintain a fluid **60 FPS** in complex 3D environments, all high-frequency calculations (e.g., Minimaps, floating health status, spatial tracking grids) MUST adhere to these performance patterns:
* **Decouple from React Lifecycle**: Do not use standard React state updates (`useState`/`useContext`) inside high-frequency execution loops (such as the main WebSocket stream or `useFrame`). Doing so triggers cascading re-renders, causing severe frame drops.
* **DOM Pooling & Ref caching**: Pool DOM elements lazily and manipulate them directly (via standard `ref.current.style` or manual DOM inserts) inside a single `requestAnimationFrame` loop.
* **Global Exposure**: Export low-latency state variables to the global `window` object (e.g., `window.localPlayerPos`) during frame ticks so secondary high-speed overlays can query coordinate states with zero overhead.
* **Player-Centric Shadow Mapping**: Directional lights must dynamically translate and center their shadow camera frustum directly on the local player's coordinate in real time. Downscale the shadow camera frustum bounds from `80m` to `30m` for razor-sharp shadows at a fraction of the GPU rendering cost.
* **Adaptive Graphics Quality Scaling**: Monitor the rolling FPS rate inside a lightweight `useFrame` tracker. If performance falls below a critical threshold (e.g., 53 FPS) for more than 3 consecutive seconds (which occurs under multiplayer load or side-by-side browser viewports), programmatically disable screen-space Bloom post-processing and disable the shadow map entirely to guarantee a fluid **60 FPS**.

---

## ⚡ 4. Low-Latency Go WebSocket Engineering

To maintain sub-millisecond network state propagation in multiplayer environments:
* **Direct Synchronous Broadcasts**: Avoid spawning temporary Go goroutines or allocating `sync.WaitGroup` synchronization blocks on every broadcast tick to client collections.
* **Non-Blocking Fan-Out**: Use direct, synchronous loops that perform a `select/default` send on buffered client channels. Since buffered channel writing is instantaneous (O(1)), this eliminates goroutine scheduling overhead, heap allocations, and garbage collection pauses.

---

## ⚡ 5. Authoritative Monster AI & State Control

To maintain reliable server-authoritative combat behavior and prevent player exploits:
* **Monster Respawning**: Monsters must always respawn back at their original `SpawnPosition` coordinate. Do not overwrite the `SpawnPosition` field with the coordinate of their death.
* **Leash & Tethering Limits**: Monsters must have a strict leash distance (e.g., 18.0 units) from their original spawn point. If a monster exceeds this limit during chase or attack, the server must automatically clear their target (`TargetPlayerID = ""`), restore their health to full (`HP = MaxHP`), sync the updated health component to the ECS registry, and transition them back to the `"returning"` FSM state.

---

## 💾 6. Authoritative Database Seeding & Setup

* **Idempotency Rule**: Seeding routines must be completely safe to execute repeatedly without causing duplicates. Wiping the old dataset before inserting fresh records is mandatory to maintain data cleanliness.
* **Command Standardization**: All database seed scripts must be linked to target-oriented CLI triggers. Use the authoritative Makefile trigger to run database seed updates:
  ```bash
  # Clears and initializes strategic monster configurations
  make seed-enemy
  ```

---

## 🌐 7. Live Server & Port Maintenance

* **Port Safety**: Do not leave stale server processes listening on port `8080` (Go GIN) or `3000` (Next.js). If you alter handlers, middlewares, or models:
  1. Find and cleanly terminate the old process using: `fuser -k 8080/tcp || true`
  2. Boot the new engine version to allow seamless schema auto-migrations: `go run cmd/server/main.go`
* **Zero Interruption**: Ensure the development server environment is kept healthy so the pair programmer can load the live scene inside their client viewport immediately.

---

## 🚀 8. Automated Git Delivery & Conventional Commits

Once the Go backend compiles with zero errors and the frontend TypeScript check passes with zero type-mismatches, you are authorized to stage, commit, and push changes.

### A. Stage Changes
Stage only the files that represent functional contributions (avoid tracking irrelevant build binaries or temporary logs):
```bash
git add .
```

### B. Conventional Commit Guidelines
Draft commit messages using the professional **Conventional Commits** standard:
* `feat: ...` for new features (e.g., `feat: serve and scan game props dynamically from backend GIN`)
* `fix: ...` for bug fixes (e.g., `fix: resolve relative path generation in asset scanner to prevent 404`)
* `refactor: ...` for structural rewrites with no behavioral change
* `perf: ...` for optimizations (e.g., throttling anim loops, instancing mesh groups)

### C. Authoritative Remote Sync
Push commits immediately to ensure the remote tracking branch `main` on GitHub remains synchronized in real time:
```bash
git push origin main
```

---

> [!IMPORTANT]
> **COMPILATION & SINK CHECK ARE NON-NEGOTIABLE.** Skipping any phase of this dual validation and deployment workflow is a violation of the development protocol.

---

## ⚡ 9. Anti-Lag & GC Performance Guard Rails (CRITICAL)

Untuk mencegah kembalinya masalah **Garbage Collection (GC) lag spikes** (drop FPS mendadak dari 60 ke 15 FPS selama 1 frame yang dipicu oleh engine pembeku V8 Javascript), aturan ketat performa di bawah ini **TIDAK BOLEH DIUBAH/DILANGGAR**:

### 🚫 Pantangan Keras di Render Loop (`useFrame`)
1. **Dilarang Alokasi Objek Baru**:
   * Jangan pernah menulis `new THREE.Vector3()`, `new THREE.Box3()`, atau instansiasi objek apa pun di dalam hook `useFrame()` atau fungsi yang dipanggil di dalamnya setiap frame.
   * Gunakan objek modular/global scratch yang telah dideklarasikan di luar component (seperti `_v3` atau `_sharedBox3`), atau gunakan `useMemo` sekali saja di level atas.
2. **Dilarang melakukan Array Spread, Filter, atau Map**:
   * Menghindari operasi spread `[...array]`, `.filter()`, dan `.map()` di dalam frame loop. Operasi ini membuat array baru di memory heap secara instan 60 kali per detik.
   * Gunakan array scratch yang dialokasikan di `useRef`, bersihkan dengan `.length = 0`, lalu isi ulang menggunakan manual loop (`for`).
3. **Dilarang memicu React State Re-render Berlebihan**:
   * Jangan memanggil `useState` (`setX()`) dari dalam loop `useFrame` secara langsung. Gunakan direct ref manipulation (`ref.current.position.set()`, dsb) untuk update visual mesh.
   * Sinkronisasi data ID monster hanya diperbolehkan menulis ke state (`setActiveMonsterIds`) jika dan hanya jika data roster benar-benar berubah (`changed == true`).

### ⏱️ Throttling dan Pembatasan Frekuensi (LOD & Adaptive Cap)
1. **LOD Jarak & Culling**:
   * Jaga threshold jarak lod (`MONSTER_FAR_SQ` & `MONSTER_MED_FAR_SQ` untuk monster, serta `FAR_SQ` & `MED_FAR_SQ` untuk remote players). Di atas batas ini, mesh wajib di-cull (`visible = false`) dan animasinya di-pause (`activeAction.current.paused = true`).
   * Jangan menghapus adaptive cap density yang membatasi render monster terdekat (cap 5/8/12) dan remote players terdekat (cap 8/12) di situasi keramaian tinggi.
2. **Penyortiran Teratur**:
   * Operasi penyortiran jarak monster (`scratch.sort()`) dan remote players (`scratchPlayerDistances.sort()`) sangat berat. Wajib di-throttle di frekuensi maksimal **10Hz** (`now - lastSortTime.current >= 0.10`) menggunakan penanda waktu dari `state.clock.elapsedTime`.
3. **Object Pooling Terhadap Sorting Scratch**:
   * Ketika melakukan sorting jarak, dilarang melakukan `.push({ id, distSq })` objek baru. Wajib memanfaatkan system pooling (`_sortObjPool` untuk monster dan `_sortPlayerObjPool` untuk remote players) untuk me-reuse penampung objek koordinat.
4. **Set Reuse untuk Visibility Registry**:
   * Gunakan registry `visiblePlayerIdsRef.current.clear()` langsung di dalam frame loop daripada menginstansiasi `new Set()` setiap frame untuk memantau visibilitas player lain.

### 🌐 Jaringan dan Background HTTP Polling
1. **Metode requestIdleCallback**:
   * Seluruh background HTTP fetch yang berulang (seperti update profil XP/Gold/Level di `ArenaClient.tsx`) wajib dijadwalkan menggunakan `requestIdleCallback` dengan toleransi idle budget minimal `>5ms`.
   * **Jangan pernah** menggantinya kembali menggunakan sinkronisasi `setInterval` mentah, karena hal tersebut akan memotong thread utama rendering di tengah jalan dan memicu micro-stuttering.
2. **Ambang Batas Lag Spike**:
   * Ambang deteksi lag spike performa diatur pada batas minimal **50ms**. Mengembalikan batas ini ke 33.33ms akan merekam derau micro-stuttering kecil yang tidak relevan dengan kenyamanan bermain user.

---

## 🚫 10. DONT-TOUCH ZONE: Sistem Kritis yang Haram Disenggol!

Untuk menjaga kestabilan 60 FPS dan latensi sub-milidetik yang sudah dicapai, arsitektur di bawah ini adalah **zona suci** yang **TIDAK BOLEH** diubah atau dimodifikasi tanpa analisis mendalam (lihat panduan pencegahan regresi lengkap di **[Stage 0: Global Architecture & Context Bootstrap](wiki/architecture/00_context_bootstrap.md)**):

### 1. Metode Deteksi Tanah & Tangga (`BVHEcctrl.config`)
* **Status Saat Ini:** Menggunakan `SHAPECAST` untuk deteksi pijakan bawah tanah.
* **Pantangan:** **Jangan pernah diubah kembali ke `RAYCAST` atau `BOTH`!**
  * Mengubah ke `RAYCAST` akan membuat karakter tersangkut (*stuck*) di anak tangga karena ray tidak bervolume.
  * Mengubah ke `BOTH` akan memproses kalkulasi BVH ganda yang langsung membuat frame rate client *drop* parah.
* **Rujukan Arsitektur:** Dijabarkan lengkap pada **[Stage 0: Context Bootstrap (Bab 3-A)](wiki/architecture/00_context_bootstrap.md#a-aturan-sisi-frontend-client-side-constraints)**.

### 2. Decoding WebSocket MessagePack (`useWebSocketGame.ts`)
* **Status Saat Ini:** Menggunakan library lokal `@msgpack/msgpack` secara sinkron langsung di main-thread.
* **Pantangan:** **Jangan pernah memindahkan kembali proses ini ke Web Worker menggunakan CDN eksternal (`importScripts`)!**
  * Browser memblokir pengunduhan skrip eksternal dari CDN luar di dalam blob worker karena aturan ketat **Content Security Policy (CSP)**.
  * Decoding lokal sangat cepat (hanya **<0.05ms** per pass) dan terbukti aman dari error sandbox browser.
* **Rujukan Arsitektur:** Dijabarkan lengkap pada **[Stage 7: Network Sync Protocol](wiki/architecture/07_network_sync_protocol.md)**.

### 3. Lock-Free Monster State Machine (`monster_ai.go`)
* **Status Saat Ini:** Menggunakan string/enum FSM bawaan langsung (`m.AIState`) tanpa lock mutex global dan tanpa alokasi heap baru.
* **Pantangan:** **Jangan pernah menggunakan kembali library `looplab/fsm` atau sejenisnya!**
  * Library eksternal tersebut memicu ribuan alokasi objek per detik pada runtime Go, yang menyebabkan *Garbage Collector spikes* dan menghabiskan resource server secara sia-sia saat melayani 100+ monster.
* **Rujukan Arsitektur:** Dijabarkan lengkap pada **[Stage 0: Context Bootstrap (Bab 3-B)](wiki/architecture/00_context_bootstrap.md#b-aturan-sisi-backend-server-side-constraints)**.

### 4. 2D Spatial Hash Grid Server-Side (`game_usecase.go` & `monster_ai.go`)
* **Status Saat Ini:** Menggunakan `SpatialHashGrid` dengan kerapatan 10.0 unit untuk lookup target terdekat musuh secara $O(1)$.
* **Pantangan:** **Jangan pernah mengembalikan logika pencarian target aggro musuh ke loop linier $O(N)$!**
  * Perbandingan posisi jarak ke seluruh player aktif secara berulang akan menyebabkan *CPU overload* parah di sisi backend seiring bertambahnya jumlah pemain aktif.
* **Rujukan Arsitektur:** Dijabarkan lengkap pada **[Stage 2: Backend Combat Usecase (Langkah 4)](wiki/architecture/02_backend_combat.md#langkah-4-menerapkan-formula-pengurangan-kerusakan-hard-vs-soft-def-a--b)**.

### 5. Throttle Pengiriman State Player Client (`sendPlayerState`)
* **Status Saat Ini:** Pengiriman posisi player ke server dibatasi keras pada frekuensi **20Hz (50ms)** dengan sistem deduplikasi perubahan gerakan.
* **Pantangan:** **Jangan pernah menaikkan frekuensi pengiriman ke 60Hz atau mematikan deduplikasi!**
  * Melakukan hal tersebut akan membanjiri buffer jaringan WebSocket, meningkatkan latensi ping secara drastis, dan menyebabkan karakter bergetar (*rubberbanding*) di layar pemain lain.
* **Rujukan Arsitektur:** Dijabarkan lengkap pada **[Stage 7: Network Sync Protocol](wiki/architecture/07_network_sync_protocol.md)**.

### 6. Multi-Layer Splat Texture — Dirty Flag
* **Status Saat Ini:** Perubahan splat texture canvas di-upload ke GPU hanya 1 kali per frame di dalam hook `useFrame` menggunakan flag `dirtyPaintRef`.
* **Pantangan:** **Jangan memanggil `paintTexture.needsUpdate = true` di dalam pointer event handlers langsung!**
  * Hal tersebut akan memicu drop FPS parah karena memory upload overhead pada event loop berkecepatan tinggi.

### 7. Resolusi Sculpt 512x512 & Async BVH
* **Status Saat Ini:** Resolusi sculpt canvas menggunakan 512x512. Rekonstruksi BVH Tree `boundsTree.refit()` didefer secara asinkronus (tidak langsung memblokir event loop utama pointer).
* **Pantangan:** **Jangan jalankan `boundsTree.refit()` atau `computeVertexNormals()` secara sinkron dalam thread `onPointerMove` event handler!**
  * Mesh resolusi tinggi memiliki vertex yang besar. Sinkronisasi refit BVH/hitung normal pada thread pointer move langsung akan membekukan UI thread.

### 8. Instanced Vegetation Rendering
* **Status Saat Ini:** Seluruh pohon, rumput, dan bebatuan kecil prosedural dikelompokkan berdasarkan model path dan dirender menggunakan `THREE.InstancedMesh` dengan 1 draw call per model path.
* **Pantangan:** **Jangan mengubah kembali vegetasi menjadi mesh tunggal individual!**
  * Ratusan pohon individu akan menghasilkan ratusan draw calls yang menghancurkan performa GPU. Sistem instancing meminimalkan overhead rendering hingga 60 FPS stabil.

