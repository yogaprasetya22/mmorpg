# Panduan Penggunaan @jagres/mcp (World Editor MCP)

**@jagres/mcp** adalah server Model Context Protocol (MCP) yang bertindak sebagai jembatan antara AI Agent (seperti Claude Desktop atau Cursor) dan sistem editing dunia (World Editor) MMORPG ini. 

Server ini memiliki sistem *headless core* (tanpa dependensi browser/React), generator prosedural deterministik berbasis *seed*, dan fitur *live synchronization* via Server-Sent Events (SSE).

---

## 🛠️ Cara Menjalankan MCP Server

### 1. Menjalankan via Makefile (Direkomendasikan)
Kamu bisa menjalankan MCP Server bersamaan dengan seluruh service MMORPG lainnya (backend + frontend) menggunakan target perintah:
```bash
make run
```
Ini akan otomatis menjalankan MCP Server pada port **`3001`** dengan mode HTTP + SSE.

### 2. Menjalankan Secara Terpisah
Jika kamu hanya ingin menjalankan server MCP saja, jalankan:
```bash
make run-mcp
```
Atau secara manual menggunakan runtime `bun` di dalam direktori package:
```bash
cd packages/mcp
bun install
bun run src/server.ts --http --port 3001
```

---

## 🔌 Cara Integrasi dengan Aplikasi AI (Clients)

Agar AI Agent pilihanmu dapat menggunakan tool-tool pembuatan peta di dalam proyek ini, konfigurasikan MCP pada client kamu.

### A. Integrasi ke Claude Desktop
Buka file konfigurasi Claude Desktop di sistem operasimu:
*   **Linux/macOS**: `~/.config/Claude/claude_desktop_config.json`
*   **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Tambahkan konfigurasi server berikut:
```json
{
  "mcpServers": {
    "jagres-world-editor": {
      "command": "bun",
      "args": ["run", "packages/mcp/src/server.ts"],
      "cwd": "/home/yoga/Dokumen/game mmorpg"
    }
  }
}
```

### B. Integrasi ke Cursor IDE
1. Buka **Settings** di Cursor (`Ctrl + ,` or `Cmd + ,`).
2. Masuk ke menu **Features** > **MCP**.
3. Klik tombol **+ Add New MCP Server**.
4. Isi form dengan ketentuan berikut:
   *   **Name**: `world-editor`
   *   **Type**: `command`
   *   **Command**: `bun run packages/mcp/src/server.ts`
5. Atur direktori kerja (*CWD*) mengarah ke root project `/home/yoga/Dokumen/game mmorpg`.

---

## 📖 Ringkasan Kapabilitas (Tools, Resources, Prompts)

Ketika terintegrasi, AI dapat memanggil **18 Tools**, membaca **3 Resources**, dan memanfaatkan **3 Prompts** bawaan MCP:

### 1. Daftar Tools Utama

| Kategori | Nama Tool | Kegunaan | Parameter Penting |
| :--- | :--- | :--- | :--- |
| **Query** | `get_world` | Mengambil info peta aktif saat ini | - |
| | `find_nodes` | Mencari objek berdasarkan tipe/tag/nama | `type`, `tag`, `namePattern` |
| **Generasi** | `generate_village` | Membuat tata letak desa dengan pagar & sumur | `seed`, `center`, `radius`, `buildingCount` |
| | `generate_mountain_range` | Membuat barisan gunung dan perbukitan | `seed`, `center`, `peakCount`, `maxHeight` |
| | `generate_road` | Membuat jalan atau sungai bercabang | `seed`, `origin`, `destination`, `roadType` |
| | `paint_biome` | Membuat zona hutan/rawa/gurun/salju | `seed`, `type`, `center`, `radius`, `density` |
| **Edit** | `create_zone` | Membuat objek baru (rumah, pohon, dsb) | `type`, `name`, `position`, `scale` |
| | `update_node` | Menggeser, memutar, atau mengubah properti objek | `id`, `position`, `rotation`, `scale` |
| | `delete_node` | Menghapus objek beserta turunannya | `id` |
| **Sistem** | `undo` / `redo` | Membatalkan / mengulangi aksi terakhir | - |
| | `save_world` | Menyimpan perubahan ke database | - |

### 2. Resources (Data yang Dapat Dibaca AI)
*   `world://current` — Data snapshot JSON lengkap dari koordinat dan objek dunia saat ini.
*   `world://current/summary` — Statistik pembagian tipe objek di dunia.
*   `world://catalog/assets` — Katalog aset 3D yang sah yang tersedia untuk dipasang.

### 3. Prompts (Skenario Template untuk AI)
*   `from_brief` — Mengubah teks instruksi bebas pengguna menjadi blueprint rencana eksekusi.
*   `iterate_on_feedback` — Membantu AI merevisi peta berdasarkan komplain/masukan pengguna.

---

## 💻 Contoh Interaksi AI dengan MCP (Cara Pakai)

Jika integrasi sudah berhasil, kamu bisa langsung memberikan perintah teks biasa di chatbox Cursor/Claude seperti ini:

> **Kamu**: *"Tolong buatkan sebuah desa kecil berukuran radius 20 meter di tengah peta dengan seed 55. Tambahkan juga jalan setapak dari desa tersebut ke arah timur sejauh 30 meter."*

Secara otomatis, AI akan mendeteksi perintah tersebut dan memanggil serangkaian tool mcp di bawah kap:
1.  Memanggil `generate_village` dengan parameter `seed: 55` dan `center: {x: 0, y: 0, z: 0}`.
2.  Memanggil `generate_road` dengan `origin: {x: 0, y: 0, z: 0}` ke `destination: {x: 30, y: 0, z: 0}`.
3.  Memanggil `save_world` untuk menyimpan hasilnya secara langsung.
4.  Peta kamu di frontend browser akan ter-render secara real-time karena koneksi live sync SSE.
