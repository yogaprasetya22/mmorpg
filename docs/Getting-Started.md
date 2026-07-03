# Memulai

## Prasyarat

Pastikan sudah terinstall:

| Software              | Versi Minimal | Cek                   |
| --------------------- | ------------- | --------------------- |
| [Bun](https://bun.sh) | ≥ 1.2         | `bun --version`       |
| [Go](https://go.dev)  | ≥ 1.25        | `go version`          |
| PostgreSQL            | ≥ 14          | `psql --version`      |
| Redis                 | ≥ 7           | `redis-cli --version` |

## Setup Database

```bash
# Buat database
createdb jagres

# Jalankan seeder (membuat tabel + data awal)
cd backend
go run ./cmd/seeder
cd ..
```

## Konfigurasi

Copy file environment:

```bash
cp .env.example frontend/.env.local
```

Isi `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

Backend membaca env dari `backend/.env`:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=jagres
REDIS_ADDR=localhost:6379
JWT_SECRET=rahasia
```

## Development

### 1. Jalankan Backend

```bash
cd backend
go run ./cmd/server
```

Server mulai di `http://localhost:8080`. Endpoint:

- `GET /api/health` — health check
- `GET /api/config/monsters` — konfigurasi monster
- `WS /ws` — WebSocket game

### 2. Jalankan Frontend

```bash
cd frontend
bun install   # (cukup sekali)
bun dev
```

Buka [http://localhost:3000](http://localhost:3000).

### 3. Akses Aplikasi

| Halaman            | URL                   | Fungsi                        |
| ------------------ | --------------------- | ----------------------------- |
| Landing            | `/`                   | Halaman depan dengan showcase |
| Arena              | `/arena`              | Pertarungan multipemain       |
| World Editor       | `/world-editor`       | Editor peta 3D                |
| Character Creation | `/character-creation` | Buat karakter baru            |

### Hot Reload

- **Frontend**: Next.js dev server — edit file → refresh otomatis
- **Backend**: Pakai `air` untuk live reload:

```bash
cd backend
go install github.com/air-verse/air@latest
air
```

## Production Build

### Frontend

```bash
cd frontend
bun run build
bun run start   # http://localhost:3000
```

Atau pakai Docker:

```bash
cd frontend
docker build -t jagres-frontend .
docker run -p 3000:3000 jagres-frontend
```

### Backend

```bash
cd backend
go build -o server ./cmd/server
./server
```

## Verifikasi Setup

1. Backend running: `curl http://localhost:8080/api/health` → `{"status":"ok"}`
2. Frontend running: buka `http://localhost:3000` → landing page muncul
3. WebSocket: buka `http://localhost:3000/arena` → login & masuk arena

## CI Pipeline

GitHub Actions menjalankan:

```
bun install → build @jagres/shared → tsc --noEmit → eslint → go build
```

---

## Related Docs

- [README.md](../README.md) — Gambaran proyek & key files
- [🏗️ Arsitektur](Architecture.md) — Struktur kode & data flow
- [🚨 DONT_TOUCH.md](../DONT_TOUCH.md) — Zona kritis performa
- [🏛️ Wiki Arsitektur](../wiki/architecture/README.md) — Deep architecture
