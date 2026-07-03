# Troubleshooting

## Masalah Umum

### Error: `error TS6305: Output file has not been built from source`

**Penyebab**: TypeScript mencoba pakai `references` yang butuh file `.d.ts` dari `@jagres/shared`, tapi belum di-build.

**Solusi**:

```bash
cd packages/shared
bunx tsc --build
cd ../../frontend
bunx tsc --noEmit
```

Atau pastikan CI menjalankan build shared sebelum typecheck.

### Error: `RangeError: WebAssembly.instantiate(): Out of memory`

**Penyebab**: Mesh optimizer (meshoptimizer) kehabisan memori untuk model besar.

**Solusi**: Kurangi resolusi model atau naikkan RAM di konfigurasi browser/Docker.

### WebSocket disconnect terus-menerus

**Penyebab**: Koneksi tidak stabil atau server overload.

**Solusi**:

1. Cek `backend/logs` untuk error
2. Pastikan Redis running
3. Cek firewall — port 8080 harus terbuka
4. Kurangi jumlah player/monster di config

### Monster tidak muncul di arena

**Penyebab**: Seeder monster belum dijalankan, atau spawn interval kosong.

**Solusi**:

```bash
cd backend
go run ./cmd/seeder
# Restart server
go run ./cmd/server
```

### Three.js: "Cannot read properties of undefined (reading 'components')"

**Penyebab**: Dual instance Three.js — dua versi Three.js termuat bersamaan.

**Solusi**: Pastikan `overrides` di `package.json` aktif:

```json
"overrides": { "three": "$three" }
```

Juga cek `next.config.ts` — resolvenya harus pakai alias ke satu lokasi:

```typescript
resolveAlias: { "three": ["./node_modules/three"] }
```

### Error: `GojaRuntimeError: SharedArrayBuffer is not defined`

**Penyebab**: Next.js SSR tidak support `SharedArrayBuffer`.

**Solusi**: File sudah ada polyfill di `app/layout.tsx` untuk `ProgressEvent`. Pastikan tidak dihapus.

### "Failed to fetch" saat request ke backend

**Penyebab**: Backend tidak running atau CORS.

**Solusi**:

1. `curl http://localhost:8080/api/health`
2. Jika tidak ada response: `cd backend && go run ./cmd/server`
3. Jika CORS: pastikan backend mengizinkan origin frontend

### World Editor: objek tidak muncul di scene

**Penyebab**: Path aset salah atau model gagal loading.

**Solusi**:

1. Cek console browser — apakah ada 404 untuk file .glb?
2. Pastikan file ada di `backend/assets/`
3. Restart frontend

## Debug Mode

Frontend memiliki beberapa flag debug:

```typescript
// Di ArenaClient.tsx — set debug={true} di GameCanvas
<GameCanvas debug={true} ... />
```

Backend log level bisa diubah:

```bash
LOG_LEVEL=debug go run ./cmd/server
```

## Melaporkan Bug

Buka issue di GitHub dengan informasi:

1. Langkah reproduksi
2. Screenshot/console log
3. Browser & OS
4. Versi frontend + backend

---

## Related Docs

- [README.md](../README.md) — Gambaran proyek
- [🚨 DONT_TOUCH.md](../DONT_TOUCH.md) — Error symptom lookup table
- [🏗️ Arsitektur](Architecture.md) — Struktur kode
- [Wiki Arsitektur Detail](../wiki/architecture/README.md) — Deep architecture
