# 🚨 DONT TOUCH ZONE — Panduan Lengkap Area Kritis

> **Proyek:** [Jagres: Battle Simulator](README.md) — Server-authoritative 3D web MMORPG sandbox
> **Stack:** Go backend (30Hz tick) + Next.js/React Three Fiber frontend (60 FPS)
>
> Dokumen ini adalah referensi **wajib baca** SEBELUM menyentuh kode apa pun.
> Setiap area terdaftar sudah **dioptimasi mendalam** via debugging & profiling.
> Mengubah area ini **tanpa alasan sangat kuat** → crash, frame drop, atau lag.
>
> 📖 **Konteks tambahan:**
>
> - [`README.md`](README.md) — High-level project overview, features, tech stack
> - [`docs/Home.md`](docs/Home.md) — Wiki-style documentation hub
> - [`docs/Architecture.md`](docs/Architecture.md) — Architecture deep-dive
> - [`frontend/app/world-editor/README.md`](frontend/app/world-editor/README.md) — World Editor feature spec
> - [`wiki/architecture/README.md`](wiki/architecture/README.md) — Step-by-step implementation wiki

---

## 📋 Daftar Isi

| No  | Area                                    | Lokasi File                                                              | Risiko Jika Diubah                               | Rujukan Arsitektur (Wiki)                                                                                                                          |
| --- | --------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ground Detection Method (BVH SHAPECAST) | `GameCanvas.tsx`                                                         | Karakter tersangkut tangga                       | [Stage 0: Context Bootstrap](wiki/architecture/00_context_bootstrap.md#a-aturan-sisi-frontend-client-side-constraints)                             |
| 2   | WebSocket MessagePack Decoder           | `useWebSocketGame.ts`                                                    | CSP block, game mati total                       | [Stage 7: Network Sync Protocol](wiki/architecture/07_network_sync_protocol.md)                                                                    |
| 3   | Monster AI State Machine (Lock-Free)    | `monster_ai.go`                                                          | GC spike server, lag 100+ monster                | [Stage 0: Context Bootstrap](wiki/architecture/00_context_bootstrap.md#b-aturan-sisi-backend-server-side-constraints)                              |
| 4   | 2D Spatial Hash Grid (O(1) Aggro)       | `game_usecase.go`, `monster_ai.go`                                       | CPU overload server, game freeze                 | [Stage 2: Backend Combat Usecase](wiki/architecture/02_backend_combat.md#langkah-4-menerapkan-formula-pengurangan-kerusakan-hard-vs-soft-def-a--b) |
| 5   | Player State Send Rate (20Hz / 50ms)    | `PlayerController.tsx` / hooks                                           | Rubberband, network overload                     | [Stage 7: Network Sync Protocol](wiki/architecture/07_network_sync_protocol.md)                                                                    |
| 6   | useFrame — Zero Allocation Rule         | `RemoteMonstersRenderer.tsx`, `RemotePlayersRenderer.tsx`, `Minimap.tsx` | GC spike, FPS drop ke 15                         | [Stage 4: Frontend Combat UI](wiki/architecture/04_frontend_combat_ui.md#langkah-3-mengoptimalkan-jittering--batching-damage-hud-popups)           |
| 7   | Sort Throttle 10Hz                      | `RemoteMonstersRenderer.tsx`, `RemotePlayersRenderer.tsx`                | Frame budget overrun                             | [Stage 4: Frontend Combat UI](wiki/architecture/04_frontend_combat_ui.md)                                                                          |
| 8   | Object Pool & Scratch Reuse             | `RemoteMonstersRenderer.tsx`, `RemotePlayersRenderer.tsx`                | Heap fragmentation                               | [Stage 4: Frontend Combat UI](wiki/architecture/04_frontend_combat_ui.md)                                                                          |
| 9   | requestIdleCallback (HTTP Polling)      | `ArenaClient.hooks.ts`                                                   | Main-thread stall, micro-stutter                 | [Stage 3: Frontend Client State](wiki/architecture/03_frontend_state.md)                                                                           |
| 10  | LOD & Culling Thresholds                | `RemoteMonstersRenderer.tsx`, `RemotePlayersRenderer.tsx`                | GPU/CPU overload di keramaian                    | [Stage 4: Frontend Combat UI](wiki/architecture/04_frontend_combat_ui.md)                                                                          |
| 11  | DataTextureLoader Monkey-Patch          | `GameCanvas.tsx`                                                         | Crash `TypeError: error is not a function`       | [Stage 4: Frontend Combat UI](wiki/architecture/04_frontend_combat_ui.md)                                                                          |
| 12  | EnvironmentErrorBoundary                | `StormEnvironment.tsx`                                                   | Crash tak tertangkap saat asset gagal            | [Stage 4: Frontend Combat UI](wiki/architecture/04_frontend_combat_ui.md)                                                                          |
| 13  | sanitizeCanvasData                      | `useEditorStore.ts`                                                      | 404 EXR/JSON dikirim ke Three.js                 | [Stage 3: Frontend Client State](wiki/architecture/03_frontend_state.md)                                                                           |
| 14  | WS Hub Sync Fan-Out (Non-Blocking)      | `hub.go`                                                                 | Goroutine explosion, memory leak                 | [Stage 7: Network Sync Protocol](wiki/architecture/07_network_sync_protocol.md)                                                                    |
| 15  | Monster Leash & Respawn Logic           | `monster_ai.go`                                                          | Monster exploit, health reset failure            | [Stage 2: Backend Combat Usecase](wiki/architecture/02_backend_combat.md)                                                                          |
| 16  | AdaptivePerformanceOptimizer            | `AdaptivePerformanceOptimizer.tsx`                                       | Bloom/shadow tidak mati saat FPS drop            | [Stage 4: Frontend Combat UI](wiki/architecture/04_frontend_combat_ui.md)                                                                          |
| 17  | Locomotion Root Motion Stripping        | `AvatarModel.tsx`                                                        | Animation snap-back / teleport glitch            | [Stage 9: Animation System](wiki/architecture/09_animation_system.md)                                                                              |
| 18  | Two-Layer Rotation System               | `PlayerController.tsx`, `usePlayerTargeting.ts`                          | Character faces wrong direction                  | [Stage 9: Animation System](wiki/architecture/09_animation_system.md)                                                                              |
| 19  | Zero-Re-Render Architecture             | `RemotePlayersRenderer.tsx`, `AvatarModel.tsx`                           | React reconciliation storm (500+ re-renders/sec) | [Stage 10: Performance](wiki/architecture/10_performance_optimization.md)                                                                          |
| 20  | Terrain Height Spatial Cache            | `terrainCache.ts`, both remote renderers                                 | 1,680 BVH raycasts/sec → FPS drop                | [Stage 10: Performance](wiki/architecture/10_performance_optimization.md)                                                                          |
| 21  | Exponential Smoothing Interpolation     | `RemotePlayersRenderer.tsx`                                              | Object allocation storm (560 alloc/sec)          | [Stage 10: Performance](wiki/architecture/10_performance_optimization.md)                                                                          |
| 22  | sanitizeAssetPath / Dynamic Assets      | `useEditorStore.ts`, `config_handler.go`                                 | 404 GLB/Assets dikirim ke Three.js               | [Stage 3: Frontend Client State](wiki/architecture/03_frontend_state.md)                                                                           |

---

## 🔴 ZONA MERAH — JANGAN PERNAH DIUBAH

### 1. 🦿 Ground Detection Method — `SHAPECAST`

**File:** `frontend/src/components/game/GameCanvas.tsx`

```
ecctrlProps={{ floorDetectionMethod: "SHAPECAST" }}
```

**Jangan ubah ke:** `RAYCAST` atau `BOTH`

| Jika diubah ke | Efek                                                               |
| -------------- | ------------------------------------------------------------------ |
| `RAYCAST`      | Ray tidak bervolume → karakter tersangkut anak tangga / prop tipis |
| `BOTH`         | BVH dihitung dua kali per frame → frame drop langsung parah        |

**Alasan dipertahankan:** SHAPECAST menggunakan capsule volume penuh untuk sweeping, cocok untuk terrain berundak dan bangunan dengan collider tipis di codebase ini.

---

### 2. 📦 WebSocket MessagePack Decoder — Main Thread Local

**File:** `frontend/src/hooks/useWebSocketGame.ts`

```typescript
import { decode } from "@msgpack/msgpack"; // local, bukan CDN
// decode() dipanggil langsung di onmessage handler — BUKAN di Web Worker
```

**Jangan:**

- Pindahkan ke Web Worker menggunakan `importScripts` dari CDN eksternal
- Ganti dengan JSON parsing mentah
- Tambahkan `new TextDecoder()` di luar scope yang ada

**Alasan:** Decoding lokal `@msgpack/msgpack` hanya **<0.05ms** per pesan. Browser memblokir CDN eksternal di dalam blob Worker karena **Content Security Policy (CSP)**. Memindahkan ke Worker akan mematikan game seluruhnya di production.

---

### 3. ⚙️ Monster AI State Machine — Lock-Free FSM

**File:** `backend/internal/usecase/game/monster_ai.go`

```go
// AIState langsung diubah via field struct — TANPA mutex global
m.AIState = "chasing"
m.TargetPlayerID = playerID
```

**Jangan:**

- Pasang library `looplab/fsm` atau sejenisnya
- Tambahkan `sync.Mutex` / `sync.RWMutex` global di setiap transisi state
- Buat channel baru untuk setiap event state monster

**Alasan:** Library FSM eksternal mengalokasikan **ribuan objek Go per detik** per monster. Dengan 100+ monster aktif ini langsung memicu GC spike yang membekukan server selama 10-50ms setiap beberapa detik.

---

### 4. 🗺️ 2D Spatial Hash Grid — O(1) Aggro Lookup

**Files:** `backend/internal/usecase/game/game_usecase.go`, `monster_ai.go`

```go
// Grid dengan cell size 10.0 unit
grid.Insert(playerID, player.X, player.Z)
nearby := grid.Query(monster.X, monster.Z, aggroRadius)
```

**Jangan:**

- Kembalikan ke loop linear O(N) yang membandingkan semua monster ke semua player
- Kurangi cell size di bawah 8.0 unit (terlalu banyak cell, overhead insert meningkat)
- Hapus grid dan gunakan database query untuk lookup proximity

**Alasan:** Dengan 100 monster × 30 player, loop linear = **3.000 perbandingan per tick × 30 tick/detik = 90.000 operasi/detik**. Spatial Hash Grid mengurangi ini menjadi **rata-rata 5-15 query per monster**, yaitu 95%+ lebih efisien.

---

### 5. 📡 Player State Send Rate — 20Hz Hard Cap

**File:** `frontend/src/components/game/PlayerController.tsx` (atau hook terkait)

```typescript
const SEND_INTERVAL_MS = 50; // 20Hz — DONT TOUCH
// Dengan deduplication: hanya kirim jika posisi benar-benar berubah
```

**Jangan:**

- Naikkan ke 60Hz (16ms interval)
- Matikan deduplication perubahan gerakan
- Kirim state meskipun player diam

**Alasan:** 60Hz × payload msgpack ~200 bytes × 30 player = **360KB/s upload per player**. Di 20Hz dengan dedup = **~40-80KB/s hanya saat bergerak**. Overload WebSocket buffer menyebabkan latency naik → karakter lain bergerak tersendat (_rubberband_).

---

## 🟠 ZONA ORANYE — KRITIS, HANYA UBAH DENGAN SANGAT HATI-HATI

### 6. 🎮 useFrame — Zero Allocation Rule

**Files yang terdampak:**

- `frontend/src/components/game/RemoteMonstersRenderer.tsx`
- `frontend/src/components/game/RemotePlayersRenderer.tsx`
- `frontend/src/components/game/Minimap.tsx`

**Aturan wajib di dalam `useFrame()`:**

```typescript
// ❌ DILARANG — membuat objek baru 60x per detik
const vec = new THREE.Vector3(x, y, z);
const ids = monsters.filter(m => m.active);
setActiveMonsterIds([...newIds]);

// ✅ WAJIB — gunakan scratch object dan ref
const _vec = new THREE.Vector3(); // deklarasi di LUAR komponen
// Di dalam useFrame:
_vec.set(x, y, z);
scratchIds.length = 0;
for (let i = 0; i < monsters.length; i++) { ... }
if (changed) setActiveMonsterIds(scratchIds);
```

**Konsekuensi jika dilanggar:**

- Setiap `new THREE.Vector3()` dalam loop = **alokasi heap 60x/detik**
- V8 GC membekukan JS thread → **FPS drop dari 60 ke 15 selama 1-3 frame**
- Terasa sebagai "micro-jank" yang berulang setiap beberapa detik

---

### 7. ⏱️ Sort Throttle — Maksimal 10Hz

**Files:** `RemoteMonstersRenderer.tsx`, `RemotePlayersRenderer.tsx`

```typescript
const SORT_INTERVAL = 0.1; // 10Hz — DONT TOUCH
if (state.clock.elapsedTime - lastSortTime.current >= SORT_INTERVAL) {
    scratch.sort(byDistSq);
    lastSortTime.current = state.clock.elapsedTime;
}
```

**Jangan:**

- Naikkan frekuensi sort ke setiap frame (60Hz sort)
- Gunakan `.sort()` array baru setiap frame
- Pindahkan sort ke dalam loop render mesh

**Alasan:** Sort O(N log N) terhadap 35 monster setiap frame = **60 × 35 × log(35) ≈ 10.500 operasi/detik** hanya untuk urutan prioritas. Pada 10Hz = **350 operasi/detik**. Perbedaannya adalah 30× overhead CPU.

---

### 8. 🪣 Object Pool & Scratch Reuse

**Files:** `RemoteMonstersRenderer.tsx`, `RemotePlayersRenderer.tsx`

```typescript
// Pool diinisialisasi sekali, di luar component
const _sortObjPool: { id: string; distSq: number }[] = Array.from(
    { length: 50 },
    () => ({ id: "", distSq: 0 }),
);
const _sortPlayerObjPool: { id: string; distSq: number }[] = Array.from(
    { length: 30 },
    () => ({ id: "", distSq: 0 }),
);
```

**Jangan:**

- Ganti dengan `.push({ id, distSq })` — ini membuat objek baru
- Buat pool dengan `new Array()` di dalam komponen
- Reset pool dengan `pool = []` (membuang seluruh pool)

**Cara penggunaan yang benar:**

```typescript
// ✅ Reuse slot pool
const obj = _sortObjPool[i];
obj.id = monsterId;
obj.distSq = dx * dx + dz * dz;
```

---

### 9. 💤 requestIdleCallback — HTTP Background Polling

**File:** `frontend/app/arena/ArenaClient.hooks.ts`

```typescript
// ── PROFILE POLLING: requestIdleCallback (DONT-TOUCH: never setInterval) ──
const idleHandle = requestIdleCallback(
    (deadline) => {
        if (deadline.timeRemaining() > 5) {
            // fetch XP/Gold/Level update di sini
        }
    },
    { timeout: 3000 },
);
```

**Jangan:**

- Ganti dengan `setInterval(fn, 3000)`
- Pindahkan fetch ke dalam `useFrame`
- Jadwalkan ulang sebelum deadline selesai

**Alasan:** `setInterval` di-fire tanpa peduli apakah main thread sedang sibuk rendering. Ini langsung memotong frame budget di tengah render pass → **micro-stutter 5-15ms** yang terasa sebagai input lag. `requestIdleCallback` hanya berjalan saat browser benar-benar idle.

---

### 10. 👁️ LOD & Culling Thresholds

**Files:** `RemoteMonstersRenderer.tsx`, `RemotePlayersRenderer.tsx`

```typescript
// Monster LOD distances (jangan kurangi nilai ini)
const MONSTER_FAR_SQ = 80 * 80; // 6400 — beyond this: cull
const MONSTER_MED_FAR_SQ = 45 * 45; // 2025 — low-poly anim pause

// Adaptive density caps (jangan hapus batas ini)
const CAP_CLOSE = 12; // maks monster yang di-render dalam radius dekat
const CAP_MED = 8;
const CAP_FAR = 5;
```

**Jangan:**

- Hapus visibility check (`visible = false`)
- Hapus animation pause untuk entitas jauh (`action.paused = true`)
- Naikkan cap density secara permanen

**Alasan:** Tanpa culling, semua 35 monster aktif melakukan skinned mesh update setiap frame. Di GPU terbatas (laptop, integrated), ini langsung menurunkan FPS dari 60 ke 25-30.

---

### 11. 🩹 THREE.DataTextureLoader Monkey-Patch

**File:** `frontend/src/components/game/GameCanvas.tsx`

```typescript
// Monkey-patch THREE.DataTextureLoader to fix multiple bugs in Three.js core...
if (typeof window !== 'undefined' && THREE.DataTextureLoader) {
  THREE.DataTextureLoader.prototype.load = function (...) {
    // ... full reimplementation with return on parse failure
  };
}
```

**Jangan:**

- Hapus patch ini
- Kembalikan ke implementasi Three.js original
- Pindahkan ke file lain yang di-load belakangan

**Alasan:** Three.js core (v170+) memiliki **dua bug simultan** di `DataTextureLoader.load()`:

1. Jika `onError` tidak didefinisikan → mencoba `error(error)` yang crash `TypeError: error is not a function`
2. Jika `onError` didefinisikan → tidak ada `return` setelah memanggil `onError`, menyebabkan crash berantai `Cannot read properties of undefined (reading 'image')`

---

### 12. 🛡️ EnvironmentErrorBoundary

**File:** `frontend/src/components/game/environment/StormEnvironment.tsx`

```tsx
class EnvironmentErrorBoundary extends Component<...> {
  componentDidCatch(error: Error) {
    this.props.onCatch(error);   // → setSkyLoadFailed(true)
  }
  render() {
    if (this.state.hasError) return null; // fallback aman
    return this.props.children;
  }
}
// Usage:
<EnvironmentErrorBoundary onCatch={() => setSkyLoadFailed(true)}>
  <Environment files={skyFile} background blur={0} />
</EnvironmentErrorBoundary>
```

**Jangan:**

- Hapus `EnvironmentErrorBoundary` dan langsung render `<Environment>`
- Gunakan prop `onError` di `<Environment>` — prop ini **tidak ada** di type definitions `@react-three/drei`
- Tangkap error dari `<Environment>` dengan try-catch biasa (tidak akan bekerja untuk R3F)

**Alasan:** React Three Fiber tidak mendukung `try-catch` normal untuk menangkap error di dalam R3F component tree. ErrorBoundary adalah satu-satunya cara yang valid. Tanpa ini, satu file `.hdr/.exr` yang gagal di-fetch akan membunuh seluruh 3D canvas.

---

### 13. 🧹 sanitizeCanvasData — EditorStore

**File:** `frontend/src/state/useEditorStore.ts`

```typescript
const sanitizeCanvasData = (data: string | null | undefined): string | null => {
    if (!data || typeof data !== "string") return null;
    const trimmed = data.trim();
    if (trimmed.startsWith("data:image/")) return trimmed; // format valid
    if (trimmed.startsWith("{")) {
        // format lama JSON
        try {
            const parsed = JSON.parse(trimmed);
            const composite = parsed.composite;
            if (
                typeof composite === "string" &&
                composite.startsWith("data:image/")
            )
                return composite; // recovery berhasil
        } catch (e) {
            /* ignored */
        }
    }
    console.warn("[EditorStore] Invalid canvas data...");
    return null;
};
```

**Jangan:**

- Hapus atau sederhanakan fungsi ini ke sekedar string check
- Simpan `paintData`/`sculptData` sebagai JSON object (bukan string)
- Lewatkan fungsi ini saat memuat data dari database atau localStorage

**Alasan:** Database bisa menyimpan data lama dalam format JSON `{"composite":"data:image/..."}`. Tanpa sanitasi, Three.js akan mencoba menggunakan string JSON itu sebagai URL → **HTTP 404 request ke path JSON** → crash. Fungsi ini juga _me-recover_ data lama tanpa membuang progress painting user.

---

### 14. 📤 WS Hub Fan-Out — Non-Blocking Sync Loop

**File:** `backend/internal/delivery/ws/hub.go`

```go
// Broadcast ke semua client — TANPA goroutine per client
for client := range h.clients {
    select {
    case client.send <- message:  // O(1) buffered send
    default:
        // Client buffer penuh → drop (non-blocking)
        close(client.send)
        delete(h.clients, client)
    }
}
```

**Jangan:**

- Bungkus dalam `go func()` per client
- Tambahkan `sync.WaitGroup` untuk menunggu semua send selesai
- Ganti buffered channel dengan unbuffered

**Alasan:** Spawning goroutine per-broadcast = **O(N) goroutine allocation** setiap 33ms. Dengan 50 client aktif = **1.500 goroutine/detik** yang perlu di-schedule oleh Go runtime. Ini menyebabkan GC pressure dan scheduling latency yang menaikkan p99 broadcast delay dari <1ms ke 5-20ms.

---

### 15. 🧟 Monster Leash & Respawn Logic

**File:** `backend/internal/usecase/game/monster_ai.go`

```go
// Leash check — monster kembali jika terlalu jauh dari spawn
dist := Distance(m.Position, m.SpawnPosition)
if dist > LEASH_RANGE { // 18.0 unit
    m.TargetPlayerID = ""
    m.HP = m.MaxHP          // reset HP penuh
    m.AIState = "returning"
}

// Respawn — SELALU ke SpawnPosition, BUKAN ke posisi mati
m.Position = m.SpawnPosition // ← JANGAN diubah ke posisi kematian
```

**Jangan:**

- Simpan posisi kematian monster sebagai spawn point baru
- Hapus leash check untuk monster "lebih kuat"
- Kurangi `LEASH_RANGE` di bawah 12 unit (monster terlalu agresif kembali)

**Alasan:** Tanpa leash yang benar, player bisa _kiting_ monster keluar map. Tanpa reset HP saat leash, monster bisa kembali dengan HP rendah dan di-exploit untuk farming tanpa risiko.

---

### 16. 📊 AdaptivePerformanceOptimizer

**File:** `frontend/src/components/game/AdaptivePerformanceOptimizer.tsx`

```typescript
// Rolling FPS monitor — matikan bloom & shadow jika FPS < 53 selama 3 detik
if (rollingAvg < FPS_THRESHOLD && lowFpsStreak > LOW_FPS_DURATION) {
    disableBloom();
    disableShadows();
}
```

**Jangan:**

- Hapus komponen ini dari `GameCanvas.tsx`
- Naikkan `FPS_THRESHOLD` ke 58+ (terlalu sensitif, matikan efek prematur)
- Kurangi `LOW_FPS_DURATION` di bawah 2 detik (false positive saat loading)

**Alasan:** Bloom post-processing dan shadow map adalah **dua konsumen GPU terbesar** di pipeline ini. Tanpa auto-disable, user dengan GPU terbatas (Intel HD, GTX 950) akan mengalami FPS konstan 25-35 tanpa bisa bermain.

---

## 🟡 ZONA KUNING — Hati-Hati, Bisa Diubah Tapi Ada Aturan

### A. Ukuran Shadow Map

**File:** `frontend/src/components/game/environment/WhimsicalDiorama.tsx`, `StormEnvironment.tsx`

```tsx
shadow-mapSize-width={2048}
shadow-mapSize-height={2048}
```

- ✅ Boleh diturunkan ke `1024` untuk performa lebih baik
- ❌ Jangan naikkan ke `4096` — VRAM usage 4× lipat, crash di GPU 2GB

### B. Tick Rate Server (30Hz)

**File:** `backend/internal/usecase/game/game_loop.go`

```go
ticker := time.NewTicker(33 * time.Millisecond) // 30Hz
```

- ✅ Boleh diturunkan ke `50ms` (20Hz) jika server overload
- ❌ Jangan naikkan ke `16ms` (60Hz) tanpa menguji beban penuh — payload WS melonjak 2×

### C. Terrain Geometry Resolution

**File:** `StormEnvironment.tsx`, `WhimsicalDiorama.tsx`

```typescript
const segs = potatoMode ? 64 : 128;
const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
```

- ✅ Boleh tambah potato threshold untuk device baru
- ❌ Jangan naikkan `128` ke `256` di non-potato mode — vertex count naik 4× (16.384 → 65.536 vertex)

### D. BVH Tree Configuration

**File:** `StormEnvironment.tsx`, `WhimsicalDiorama.tsx`

```typescript
geo.computeBoundsTree({ maxDepth: 64, maxLeafSize: 5 });
```

- ✅ Boleh turunkan `maxDepth` ke `32` jika build BVH lambat
- ❌ Jangan naikkan `maxLeafSize` di atas `10` — raycast menjadi inakurat

---

## 🟢 ZONA HIJAU — Modifikasi Dengan Pemahaman

> Area ini **bisa** dimodifikasi — tapi **pahami dulu arsitekturnya**.
> "Hijau" berarti **risiko lebih rendah** daripada Zona Merah/Kuning, bukan aman tanpa baca konteks.
> Lihat kolom `Rujukan Arsitektur (Wiki)` di tabel Daftar Isi untuk tiap area.

Berikut area yang relatif aman untuk ditambah/diubah:

- `frontend/app/arena/components/*.tsx` — UI overlay (chat, stats modal, HUD)
- `frontend/src/components/ui/*.tsx` — Komponen UI non-3D
- `backend/internal/delivery/http/config_handler.go` — REST API handler baru
- `backend/internal/usecase/auth/` — Logic autentikasi
- `backend/internal/domain/*.go` — Definisi struct (dengan syarat backward-compatible)
- `frontend/src/state/useEditorStore.ts` — Tambah state editor baru (asal tidak mengubah sanitizeCanvasData)
- `frontend/src/core/logic/environment/assetRegistry.ts` — Tambah material/asset baru
- Asset file `.glb`, `.hdr`, `.png` — Bebas ditambah ke `backend/assets-model/`
- `frontend/app/world-editor/` — Editor UI, modul baru

---

## 🔴 ZONA MERAH TAMBAHAN — Sistem Baru yang Kritis

### 17. 🎬 Locomotion Root Motion Stripping

**File:** `frontend/src/components/game/avatar/AvatarModel.tsx`

```typescript
// Locomotion clips: STRIP root Hips tracks entirely
if (isLocomotion) {
    clip.tracks = clip.tracks.filter((t) => {
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
        if (t.name.startsWith("Armature.")) return false;
        return true;
    });
}
```

**Jangan:**

- Keep Hips position tracks on locomotion clips — causes snap-back teleport on loop
- Keep Hips rotation tracks on locomotion clips — fights BVHEcctrl's rotation
- Apply root motion stripping to combat/death clips — they need root rotation for dramatic effect
- Remove the `LOCOMOTION_CLIPS` set — it controls which clips get stripped

**Alasan:** Mixamo FBX locomotion clips contain forward hip displacement. When the clip loops, position snaps back to origin causing visible "teleport backward". BVHEcctrl handles all world-space movement, so root tracks are redundant and harmful.

---

### 18. 🧭 Two-Layer Rotation System

**Files:** `PlayerController.tsx`, `player/usePlayerTargeting.ts`

```
BVHEcctrl "Model" group (PARENT)   ← Movement rotation + Idle camera-facing slerp
  └─ characterRef group (CHILD)    ← Attack target rotation (temporary, reset after attack)
       └─ AvatarModel (Armature)   ← Bone animations
```

**Jangan:**

- Rotate `characterRef` (child) when NOT attacking — compounds with parent, causes offset
- Rotate `ecctrlRef.current.model` (parent) during attack — fights BVHEcctrl
- Use `lookAt` for idle rotation — use `atan2(-camDir.z, camDir.x)` + `setFromAxisAngle` for pure Y quaternion
- Forget to reset `characterRef.current.rotation.y` to 0 after attack — accumulated rotation persists

**Child rotation reset (WAJIB ada saat charState[0] === 0):**

```typescript
if (charState[0] === 0 && characterRef.current) {
    const childRotY = characterRef.current.rotation.y;
    if (Math.abs(childRotY) > 0.001) {
        characterRef.current.rotation.y +=
            (0 - childRotY) * (1 - Math.exp(-12.0 * delta));
    }
}
```

**Alasan:** `usePlayerTargeting.ts` adds to `characterRef.rotation.y` every frame during attack to face the target. This accumulated rotation is NEVER automatically reset. Without the explicit lerp-to-zero, the child rotation compounds with the parent's idle slerp, causing the character to face the wrong direction.

---

### 19. 🚀 Zero-Re-Render Architecture

**Files:** `RemotePlayersRenderer.tsx`, `AvatarModel.tsx`

```typescript
// Per-frame values: useRef ONLY, never useState
const poseRef = useRef("Idle");
const timeScaleRef = useRef(1.0);
const avatarControlRef = useRef<AvatarHandle>(null);

// Animation changes via imperative handle (zero React involvement)
avatarControlRef.current?.setPose(nextPose);
avatarControlRef.current?.setTimeScale(nextTimeScale);
```

**Jangan:**

- Convert `poseRef`, `timeScaleRef`, or `animPausedRef` back to `useState` — triggers re-render storm
- Remove `skipAnimControl` prop from remote AvatarModel — internal useEffect would fight imperative control
- Remove the `AvatarHandle` imperative interface — it's the bridge for zero-re-render control
- Add React state for any value that changes more than once per second per player

**Alasan:** With 20 players, each `useState` for pose/timescale causes ~180 React re-renders/sec. Each re-render traverses AvatarModel → 8 AvatarAsset children. The imperative handle bypasses React entirely, updating Three.js AnimationAction objects directly.

---

### 20. 🗺️ Terrain Height Spatial Cache

**File:** `frontend/src/core/utils/terrainCache.ts`

```typescript
export function getCachedTerrainHeight(x, z, fallback) {
    const key = `${Math.round(x)},${Math.round(z)}`;
    const entry = cache.get(key);
    if (entry && performance.now() - entry.t < TTL_MS) return entry.h;
    const h = fallback();
    cache.set(key, { h, t: performance.now() });
    return h;
}
```

**Jangan:**

- Call raw `getGroundHeight()` or `getTerrainElevation()` directly in entity useFrame — always go through cache
- Reduce TTL below 1 second — terrain sculpt changes need to propagate
- Increase GRID above 2 metres — loses precision for steep slopes
- Remove the MAX_ENTRIES cap — prevents unbounded memory growth

**Alasan:** Without cache, 28 entities × 60fps = 1,680 BVH raycasts/sec. Each raycast is O(log N) tree traversal. The cache reduces this to ~20 lookups/sec (only on cache miss when entity moves to new grid cell).

---

### 21. 📐 Exponential Smoothing Interpolation

**File:** `RemotePlayersRenderer.tsx`

```typescript
// Replaces buffer-based interpolation (zero allocation)
const SMOOTH_TAU = 0.08; // converges ~90% in 160ms
const factor = 1 - Math.exp(-delta / SMOOTH_TAU);
smoothPos.current.x += (targetX - smoothPos.current.x) * factor;
```

**Jangan:**

- Reintroduce the state buffer array (`stateBufferRef`) — causes 560 object allocations/sec
- Use `array.push()` + `array.shift()` for network interpolation — GC pressure
- Change `SMOOTH_TAU` below 0.04 — too snappy, exposes 20Hz network jitter
- Change `SMOOTH_TAU` above 0.15 — too laggy, 300ms+ perceived delay

**Alasan:** The old buffer system allocated `{x, y, z, rotation, timestamp}` objects every network update (20Hz × 28 entities = 560/sec) plus `array.shift()` GC. Exponential smoothing achieves the same 160ms convergence with zero allocations.

---

### 22. 🎨 Multi-Layer Splat Texture — Dirty Flag

**File:** `frontend/src/components/game/environment/StormEnvironment.tsx`

- **Mekanisme**: Perubahan splat texture canvas di-upload ke GPU hanya 1 kali per frame di dalam hook `useFrame` menggunakan flag `dirtyPaintRef`.
- **Jangan**: Panggil `paintTexture.needsUpdate = true` di dalam _mouse/pointer event handlers_ langsung (seperti `onPointerMove`).
- **Alasan**: Melakukan update/upload texture ke GPU pada setiap pointer event akan menyebabkan drop FPS parah karena memory upload overhead pada event loop berkecepatan tinggi.

---

### 23. 🪓 Resolusi Sculpt 512x512 & Async BVH

**File:** `frontend/src/components/game/environment/StormEnvironment.tsx`

- **Mekanisme**: Resolusi sculpt canvas dan mesh menggunakan 512x512. Rekonstruksi BVH Tree `boundsTree.refit()` didefer secara asinkronus (tidak langsung memblokir event loop utama pointer).
- **Jangan**: Jalankan `boundsTree.refit()` atau `computeVertexNormals()` secara sinkron dalam thread `onPointerMove` event handler.
- **Alasan**: Mesh 512x512 memiliki jumlah vertex yang jauh lebih besar. Sinkronisasi refit BVH/hitung normal pada thread pointer move event loop langsung akan membekukan UI thread dan memicu stuttering hebat.

### 24. 🌲 Instanced Vegetation Rendering

**File:** `frontend/src/components/game/environment/InstancedVegetationRenderer.tsx`

- **Mekanisme**: Seluruh pohon, rumput, dan bebatuan kecil prosedural dikelompokkan berdasarkan model path dan dirender menggunakan `THREE.InstancedMesh` dengan **1 draw call per model path**.
- **Jangan**: Ubah kembali vegetasi menjadi mesh tunggal individual (`<primitive object={...} />` terpisah untuk setiap pohon).
- **Alasan**: Ratusan pohon individu akan menghasilkan ratusan draw calls yang menghancurkan performa GPU. Sistem instancing meminimalkan overhead rendering hingga 60 FPS stabil.

### 25. ⏳ R3F Canvas Delayed Mounting (Layout Synchronization)

**Files:** `AssetsLibraryModule.tsx`, `AssetPreviewCanvas.tsx`

- **Mekanisme**: Menunda inisialisasi `<Canvas>` selama 1200ms menggunakan timer `setTimeout` untuk menunggu hilangnya loading overlay dan stabilisasi dimensi layout CSS DOM.
- **Jangan**: Hapus delay `ready` state dan langsung render `<Canvas>` saat pertama kali component terpasang.
- **Alasan**: Rendering dynamic canvas di dalam flexbox/grid yang ukurannya belum terhitung (width/height 0px) saat load pertama membuat WebGL Renderer berukuran 0x0, memicu bug canvas kosong putih solid yang tidak responsif terhadap pergerakan mouse.

---

### 26. 🛡️ CanvasErrorBoundary & Fallback Render

**Files:** `AssetsLibraryModule.tsx`, `AssetPreviewCanvas.tsx`

- **Mekanisme**: Membungkus render model 3D `<PreviewModel>` di dalam canvas menggunakan error boundary penangkap pengecualian R3F / Three.js.
- **Jangan**: Render `<PreviewModel>` langsung tanpa pembungkus `<CanvasErrorBoundary>`.
- **Alasan**: File `.glb` yang rusak atau data yang corrupt akan memicu error parser GLTF. Tanpa pembatas error React, runtime R3F akan crash total dan membekukan sisa interaksi UI canvas.

---

## 🔍 Quick Reference: Simbol Error → Penyebab

| Error di Console                                        | Penyebab Paling Mungkin                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `TypeError: error is not a function`                    | Three.js DataTextureLoader bug → patch di `GameCanvas.tsx` dihapus            |
| `Cannot read properties of undefined (reading 'image')` | Sama seperti di atas — patch tidak ada atau parse EXR/HDR gagal               |
| `unhandledRejection: EXRLoader lossyDctDecode`          | File `.exr` dengan kompresi DWA di-load → semua asset harus `.hdr`/`.png`     |
| FPS tiba-tiba turun dari 60 ke 15 selama 1-2 frame      | `new THREE.Vector3()` atau `.filter()` masuk ke `useFrame`                    |
| Semua monster "teleport" ke satu titik                  | `SpawnPosition` ditimpa posisi kematian — lihat zona 15                       |
| Karakter tersangkut di tangga/ledge                     | `floorDetectionMethod` diubah dari `SHAPECAST`                                |
| Character slideshow / rubberband                        | Send rate player dinaikkan / dedup dimatikan                                  |
| Server hang saat 100+ monster aktif                     | Lock mutex ditambah ke monster FSM, atau loop O(N) aggro dikembalikan         |
| Game client mati total saat load                        | MessagePack decoder dipindah ke Web Worker CDN                                |
| Character "teleport backward" saat loop lari            | Hips position track tidak di-strip dari locomotion clip                       |
| Character menghadap arah salah setelah attack           | `characterRef.rotation.y` tidak di-reset ke 0 setelah `charState[0]` jadi 0   |
| FPS drop ke 33 dengan 20 player                         | `useState` dipakai untuk pose/timescale (harus `useRef` + imperative handle)  |
| Monster raycast FPS drop                                | `getGroundHeight` dipanggil langsung tanpa `getCachedTerrainHeight`           |
| Remote player movement tersendat                        | Buffer interpolation (`stateBufferRef`) dipakai — ganti exponential smoothing |
| Canvas 3D kosong/putih saat load pertama kali           | Mounting Canvas berjalan terlalu cepat (delay 1.2s dihapus/kurang)            |
| Canvas 3D freeze dengan error GLTF parser               | CanvasErrorBoundary dilepas pada component preview                            |

---

> [!CAUTION]
> Jika ragu apakah sebuah perubahan aman, **jalankan `make check` terlebih dahulu** dan pastikan tidak ada regression sebelum melanjutkan. Jika ada error baru yang muncul setelah perubahan — **revert langsung** menggunakan `git checkout -- <file>`.

---

_Dokumen ini diperbarui per: 2026-07-03. Referensi lengkap: [README.md](README.md) · [docs/Home.md](docs/Home.md) · [docs/Architecture.md](docs/Architecture.md) · [wiki/architecture/README.md](wiki/architecture/README.md)_
