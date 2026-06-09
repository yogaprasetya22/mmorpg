# 🎨 08. Avatar Configurator Integration & Optimization

> **Status**: Panduan arsitektur untuk menggabungkan Character Creator ke dalam dunia game MMORPG utama menggunakan microservice gRPC dan teknik optimasi render.

Dokumen ini menjelaskan rancangan sistem terperinci untuk memindahkan fitur **Character Creation** (dari project `game mmorpg character`) ke dalam project utama **Game MMORPG** (`game mmorpg`). Arsitektur ini dirancang untuk mencegah terjadinya *frame drops* (lag) di dunia multiplayer saat ratusan pemain berkumpul dengan pakaian kustom masing-masing.

---

## 🗺️ 1. Desain Arsitektur Sistem Hibrida (Hybrid Architecture)

Untuk menjaga performa rendering di client-side (Next.js + Tauri), kita menggunakan **pendekatan hibrida**:
1.  **Pemain Lokal (Local Player)**: Merender bagian tubuh secara **Modular Dinamis** (rambut, pakaian, sepatu, dll. terpisah) agar perubahan gear di layar sendiri terasa instan tanpa jeda loading.
2.  **Pemain Lain (Remote Players)**: Merender model **Statis Teroptimasi (Single Baked GLB)** yang telah digabungkan dan dikompresi (Draco + WebP) oleh microservice server untuk menekan *draw calls* seminimal mungkin.

```mermaid
graph TD
    %% Pembuatan Karakter / Ganti Baju %%
    subgraph Sisi Kustomisasi (Character Creation / Shop)
        A[Frontend Client: Pemain A] -->|Ganti Baju| B[Local Render: Modular Dinamis]
        A -->|Klik Save| C[Main Game Server: Go]
    end

    %% Sisi Backend & Baking %%
    subgraph Backend Pipeline
        C -->|gRPC: BakeAvatarRequest| D[Avatar Baker Service: Go/Node.js]
        D -->|Ambil Aset Mentah dari CDN| E[Merge Meshes & Textures]
        E -->|gltf-transform: Draco + WebP| F[Bake Single Optimized GLB]
        F -->|Upload| G[Object Storage / MinIO / S3]
        G -->|Return CDN URL| D
        D -->|gRPC: BakeAvatarResponse| C
    end

    %% Penyebaran ke Pemain Lain %%
    subgraph Dunia Game Multiplayer (Game World)
        C -->|WebSocket Broadcast: New GLB URL| H[Pemain Lain: Pemain B, C, D]
        H -->|Unduh Single GLB Terkompresi| G
        H -->|Render Ringan: 1 Draw Call| I[Remote Players Renderer]
    end
```

---

## 📡 2. Kontrak Komunikasi gRPC (`avatar_baker.proto`)

Untuk memisahkan beban CPU yang berat akibat penggabungan mesh 3D dari game server utama, kita membuat **Avatar Baker Service** terpisah sebagai microservice yang berkomunikasi lewat gRPC (Protobuf) dengan spesifikasi berikut:

```protobuf
syntax = "proto3";

package avatar;

option go_package = "./pb";

service AvatarBakerService {
  // Menerima daftar aset mentah kustomisasi, menggabungkannya,
  // mengompresinya, dan menyimpan hasil GLB tunggal ke storage.
  rpc BakeAvatar (BakeAvatarRequest) returns (BakeAvatarResponse);
}

message BakeAvatarRequest {
  string character_id = 1;
  string base_skeleton_url = 2; // Path ke Armature dasar (misal: /models/Armature.glb)
  repeated string equipped_asset_urls = 3; // Daftar URL file GLB pakaian/rambut/aksesori
  string skin_color = 4; // Kode warna hex untuk pewarnaan kulit
}

message BakeAvatarResponse {
  string character_id = 1;
  string optimized_glb_url = 2; // URL CDN untuk file GLB tunggal hasil optimasi
  int64 file_size_bytes = 3; // Ukuran file akhir setelah dikompresi Draco
  bool from_cache = 4; // True jika mengambil dari Redis cache
}
```

---

## ⚡ 3. Strategi Optimasi Jeda Visual (Visual Delay Mitigations)

Masalah utama saat menggunakan model statis yang di-*bake* di server adalah **jeda waktu 1-3 detik** untuk proses pembuatan dan pengunduhan GLB baru ketika pemain lain di dekat Anda mengganti pakaiannya. Kita menggunakan tiga teknik untuk mengatasinya:

### A. Perakitan Lokal Sementara (Client-side Proxy Swap)
*   **Mekanisme**: Begitu Pemain A ganti baju, server langsung menyiarkan data ID pakaian barunya via WebSocket (latensi ~20ms). Client Pemain B akan **langsung mencopot baju lama Pemain A dan merakit baju baru secara modular secara lokal** menggunakan aset mentah dari cache browser sebagai *proxy* sementara.
*   **Transisi**: Secara latar belakang (*background*), client mengunduh file hasil bake yang asli dari CDN. Setelah selesai diunduh, model modular sementara ditukar secara halus dengan model tunggal hasil bake.
*   **Dampak**: Perubahan baju terlihat **instan seketika** di mata pemain lain tanpa menunggu proses *bake* selesai.

### B. VFX Shroud (Efek Visual Penutup)
*   **Mekanisme**: Saat proses penukaran model proxy lokal ke model bake selesai, aktifkan efek visual shader (seperti kilatan cahaya sihir, kepulan asap, atau efek memudar perlahan/fade-in).
*   **Dampak**: Menyamarkan pergantian mesh agar tidak terlihat berkedip kasar (*pop-in*).

### C. Redis Caching Layer (Bypass Baking)
*   **Mekanisme**: Di dalam *Avatar Baker Service*, gunakan Redis untuk mencatat sidik jari (hash MD5) dari kombinasi pakaian yang pernah di-bake.
*   **Dampak**: Jika Pemain B memakai kombinasi pakaian yang sama dengan kombinasi populer yang pernah dibuat oleh pemain lain sebelumnya, server langsung mengembalikan URL hasil bake lama dalam **< 5 milidetik**, menghemat CPU server secara masif.

---

## 📂 4. Rincian Migrasi File Fisik & Porting Kode

Untuk memindahkan fitur dari project **Character Creation Standalone** (`game mmorpg character`) ke **Game MMORPG Next.js** (`game mmorpg`), lakukan pemindahan aset dan penyesuaian kode berikut:

### A. Migrasi File Aset Statis (3D Models & Thumbnails)
Pindahkan seluruh file aset agar disajikan secara lokal oleh Next.js untuk menghindari masalah CORS dan dependency url backend:

1.  **Skeleton & Animasi dasar**:
    *   Dari: `/game mmorpg character/public/models/Armature.glb` $\rightarrow$ Ke: `/game mmorpg/frontend/public/models/avatar/Armature.glb`
    *   Dari: `/game mmorpg character/public/models/Poses_1.glb` $\rightarrow$ Ke: `/game mmorpg/frontend/public/models/avatar/Poses_1.glb`
2.  **Item Pakaian & Aksesoris Modular**:
    *   Pindahkan seluruh file `.glb` dan gambar `.jpg`/`.png` dari folder `/game mmorpg character/backend/static/Assets/` $\rightarrow$ Ke folder `/game mmorpg/frontend/public/assets-model/avatar/`.

### B. Migrasi Komponen React & Penyesuaian React 19 / Next.js
Buat folder baru `/game mmorpg/frontend/src/components/game/avatar/` dan pindahkan berkas-berkas berikut dengan penyesuaian kode:

1.  **Tambahkan Direktif `'use client'`**:
    *   Karena Next.js menggunakan Server Components secara default, tambahkan `'use client';` di baris paling atas dari file `Avatar.tsx`, `Asset.tsx`, `CameraManager.tsx`, dan `UI.tsx`.
2.  **Perbaiki Path Aset & Environment**:
    *   Di `Avatar.tsx`:
        *   Ubah: `useGLTF("/models/Armature.glb")` $\rightarrow$ Menjadi: `useGLTF("/models/avatar/Armature.glb")`
        *   Ubah: `useGLTF("/models/Poses_1.glb")` $\rightarrow$ Menjadi: `useGLTF("/models/avatar/Poses_1.glb")`
    *   Ubah pemanggilan URL asset dinamis di dalam loop kustomisasi:
        *   Ubah: `url={BACKEND_URL + customization[key].asset!.url}` $\rightarrow$ Menjadi: `url={"/assets-model/avatar/" + filepath.Base(customization[key].asset!.url)}` (atau sesuaikan dengan file path lokal).
3.  **Hapus Deprecated / Unused Components**:
    *   Hapus komponen `LoadingAvatar` dari rendering di `Experience.tsx` dan hapus file `LoadingAvatar.tsx` untuk menyingkirkan tirai cahaya oranye/kuning.
4.  **Kompatibilitas React 19**:
    *   React 19 tidak lagi membutuhkan fungsi pembungkus `forwardRef()` untuk meneruskan refs. Jika ada component yang menggunakan `forwardRef`, ref tersebut dapat langsung diakses sebagai prop `ref` biasa.

### C. Penyelarasan Database & Seeder
Agar sistem game mengenali opsi pakaian kustomisasi:
1.  **Schema Migrations**:
    *   Tambahkan tabel baru di PostgreSQL (`game mmorpg/backend/internal/repository/postgres`):
        *   `avatar_categories` (menyimpan data slot kustomisasi seperti "Head", "Outfit", dll.).
        *   `avatar_assets` (menyimpan daftar item 3D kustomisasi dengan tautan URL GLB dan thumbnail-nya).
    *   Tambahkan kolom `custom_avatar_url` pada tabel `characters` utama.
2.  **Data Seeding**:
    *   Salin data inisialisasi awal yang terdefinisi pada `/game mmorpg character/backend/seeder.go` menjadi baris migrasi SQL atau script seeder PostgreSQL utama di folder `/game mmorpg/backend/pkg/database/` agar item-item pakaian langsung terisi di database baru.

---

## 📝 5. Rencana Implementasi & Daftar Tugas (Todo List)

Berikut adalah daftar tugas terperinci untuk menggabungkan modul kustomisasi ke dalam game MMORPG utama Anda:

### ✅ A. Sisi Frontend Next.js (`game mmorpg/frontend`)
- [ ] **Migrasi File Model 3D**:
  - Salin `/models/Armature.glb`, `/models/Poses_1.glb`, dan semua aset pakaian `.glb` dari project kustomisasi ke folder `/public/models/` di project MMORPG.
- [ ] **Membuat Halaman Pembuatan Karakter**:
  - Buat route baru di Next.js: `app/character-creation/page.tsx` untuk UI dan Canvas configurator.
- [ ] **Integrasi Komponen 3D R3F**:
  - Salin dan sesuaikan `Avatar.tsx`, `Asset.tsx`, dan `CameraManager.tsx` ke dalam folder `src/components/game/player/`.
  - Hapus referensi `LoadingAvatar` yang lama untuk menghilangkan efek silinder cahaya kuning/tirai yang mengganggu.
  - Sesuaikan import agar kompatibel dengan React 19 dan `@react-three/fiber` v9.
- [ ] **Penyempurnaan Kamera**:
  - Pastikan kamera `CameraManager` hanya melakukan inisialisasi ke posisi default sekali saja di awal (`hasInitialized.current`), tanpa me-reset posisi secara otomatis saat user memilih kategori kustomisasi baru.
- [ ] **Zustand Store Merge**:
  - Gabungkan logika state `store.ts` kustomisasi ke dalam store game utama (`src/state/useStore.ts`) atau buat store modular terpisah agar data kustomisasi tersimpan rapi.

### ✅ B. Sisi Backend & Microservice (`game mmorpg/backend`)
- [ ] **Membuat Avatar Baker Microservice**:
  - Inisialisasi service baru (bisa dalam Go atau Node.js) yang memproses penggabungan mesh.
  - Integrasikan pustaka `@gltf-transform/cli` atau `@gltf-transform/core` dengan perintah optimasi Draco + WebP texture:
    ```bash
    npx @gltf-transform/cli optimize input.glb output.glb --compress draco --texture-compress webp
    ```
- [ ] **Konfigurasi gRPC Server**:
  - Implementasikan protokol `avatar_baker.proto` pada Baker Service.
  - Hubungkan dengan Amazon S3, MinIO, atau sistem berkas statis server utama untuk menyimpan file `.glb` hasil optimasi.
- [ ] **Koneksi Game Server Utama (Go)**:
  - Buat gRPC client pada backend utama Go agar bisa memanggil gRPC server Baker Service saat pemain menekan tombol "Save Character".
  - Update skema database PostgreSQL untuk menyimpan kolom `custom_avatar_url` pada tabel `characters`.

### ✅ C. Sisi Dunia Game Multiplayer (Game World Integration)
- [ ] **Modifikasi PlayerController**:
  - Ubah `PlayerController.tsx` agar menggunakan komponen `Avatar` modular (Opsi A) khusus untuk karakter lokal (Pemain Sendiri).
- [ ] **Modifikasi Remote Players Renderer**:
  - Ubah `RemotePlayersRenderer.tsx` agar mengambil URL model dari WebSocket (misal: `player.custom_avatar_url` jika ada).
  - Jika URL kustom tersedia, render menggunakan file GLB statis tunggal tersebut. Jika tidak ada, gunakan default model bawaan (`Chef_Male.glb` atau `Knight_Golden_Male.glb`).
- [ ] **Implementasi Efek Transisi**:
  - Tambahkan efek visual partikel kilatan cahaya singkat di komponen player saat menerima sinyal pembaruan kostum baru untuk menyamarkan proses *swapping* model.

---

🏆 **Indeks Wiki Lengkap**:
*   [00. Global Architecture & Context Bootstrap](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/00_context_bootstrap.md)
*   [01. Tahap 1: Backend Domain & Recalculate Logic](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/01_backend_domain.md)
*   [02. Tahap 2: Backend Combat Usecase & Accuracy Checks](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/02_backend_combat.md)
*   [03. Tahap 3: Frontend Client State & WebSocket Allocation](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/03_frontend_state.md)
*   [04. Tahap 4: Frontend Combat UI & Animations](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/04_frontend_combat_ui.md)
*   [05. Tahap 5: Database Migrations & Data Seeding](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/05_database_migrations.md)
*   [06. Tahap 6: Lembar Rumus Matematika Combat](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/06_combat_formula_ref.md)
*   [07. Tahap 7: Protokol WebSocket & Skema JSON](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/07_network_sync_protocol.md)
*   [08. Tahap 8: Integrasi & Optimasi Modul Kustomisasi Avatar](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/08_avatar_configurator_integration.md)
