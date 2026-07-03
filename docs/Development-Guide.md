# Panduan Development

## Coding Convention

### TypeScript / React

- **Strict mode**: `strict: true` di tsconfig
- **No unused locals/params**: `noUnusedLocals`, `noUnusedParameters` aktif
- **Path alias**: `@/` = `frontend/`, `@jagres/shared` = package shared
- **State management**: Zustand untuk global state, `useState` untuk lokal
- **3D components**: Functional component + hooks, hindari class component

### Go

Ikuti [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments):

- Error handling selalu dicek
- Gunakan goroutine pool untuk concurrent tasks
- Naming: `CamelCase` untuk export, `camelCase` untuk internal

## Testing

```bash
# Frontend (Playwright)
cd frontend
bunx playwright test

# Backend (Go test)
cd backend
go test ./...

# Load test
cd backend
go run ./cmd/loadtest
```

## Optimasi Performance

### Frontend (3D)

- **InstancedMesh** — untuk objek vegetasi massal (`InstancedVegetationRenderer.tsx`)
- **FrameLimiter** — batasi FPS di background tab
- **BVH** — `three-mesh-bvh` untuk raycasting 3x lebih cepat
- **Frustum culling** — objek di luar kamera tidak di-render
- **useMemo/useCallback** — cegah re-render tidak perlu
- **Dynamic imports** — komponen berat di-load `next/dynamic`

### Backend

- **Spatial hash grid** — cari entitas terdekat O(1) secara rata-rata
- **ECS** — data-oriented, cache-friendly
- **MessagePack** — serialisasi binary lebih kecil & cepat dari JSON
- **KCP** — reliable UDP untuk state sync

## Menambah Kelas Baru

1. Buat strategy di `frontend/src/core/combat/strategies/`
2. Tambah skill di file skill terkait
3. Daftarkan di `ClassCombatEngine.ts`
4. Tambah handling di backend `combat.go`

## Menambah Aset Baru

1. Upload .glb ke `backend/assets/environment/` (atau kategori sesuai)
2. Generate thumbnail: `cd frontend && bun run thumbs:gen`
3. Tambah entry di `packages/shared/src/asset-registry.ts`

## Git Workflow

```bash
main        ← production-ready
  └── dev   ← development branch
       └── feat/*   ← fitur baru
       └── fix/*    ← bug fix
       └── refactor/* ← refaktor
```

Commit messages pakai [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: tambah skill baru untuk Mage
fix: interpolasi posisi monster tidak mulus
refactor: pisahkan combat logic ke file terpisah
docs: update README dengan petunjuk instalasi
```

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable              | Default                  | Fungsi           |
| --------------------- | ------------------------ | ---------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080`  | Backend HTTP URL |
| `NEXT_PUBLIC_WS_URL`  | `ws://localhost:8080/ws` | WebSocket URL    |

### Backend (`backend/.env`)

| Variable      | Default          | Fungsi              |
| ------------- | ---------------- | ------------------- |
| `DB_HOST`     | `localhost`      | Host PostgreSQL     |
| `DB_PORT`     | `5432`           | Port PostgreSQL     |
| `DB_USER`     | `postgres`       | User PostgreSQL     |
| `DB_PASSWORD` | `postgres`       | Password PostgreSQL |
| `DB_NAME`     | `jagres`         | Nama database       |
| `REDIS_ADDR`  | `localhost:6379` | Address Redis       |
| `JWT_SECRET`  | `rahasia`        | Secret key JWT      |

---

## Related Docs

- [README.md](../README.md) — Gambaran proyek
- [🏗️ Arsitektur](Architecture.md) — Struktur kode & data flow
- [🚨 DONT_TOUCH.md](../DONT_TOUCH.md) — 26 zona kritis performa
- [Wiki Arsitektur Detail](../wiki/architecture/README.md) — Stage-by-stage
