# 🎮 MMORPG Real-Time Game Backend: Go Clean Architecture & Roadmap

Dokumentasi ini mendefinisikan rancangan arsitektur backend, struktur kode bersih (_Clean Architecture_), pilihan teknologi, integrasi database, integrasi sisi frontend, serta tahapan pengembangan (_phases_) untuk mengubah proyek saat ini menjadi game **Multiplayer Battle MMORPG** bergaya _Genshin Impact_ / _Jagres_.

---

## 🛠️ Pilihan Teknologi Utama

Untuk mencapai latensi rendah, throughput tinggi (100+ koneksi unit/detik), dan skalabilitas yang solid, kita menggunakan kombinasi teknologi berikut:

- **Go (Golang):** Bahasa utama backend karena keunggulan konkurensi (Goroutines), efisiensi penggunaan memori, serta nihilnya lonjakan Garbage Collection saat simulasi ECS densitas tinggi.
- **Gin Gonic (HTTP Web Framework):** Digunakan untuk menangani REST API statis berlatensi rendah (Registrasi, Login, Gacha, Manajemen Karakter).
- **Melody / Gorilla WebSockets:** Menangani koneksi jaringan real-time dua arah (_bi-directional_) berkecepatan tinggi antara klien Next.js dan server Go.
- **Protocol Buffers (Protobuf):** Untuk serialisasi pesan biner berukuran sangat mini untuk streaming data koordinat visual 3D.
- **Redis:** Caching posisi koordinat real-time tercepat dan manajemen antrean lobby (_Room matching_).
- **PostgreSQL:** Penyimpanan data persisten akun, level, item/inventory, dan statistik karakter.

---

## 🔌 Konfigurasi Database PostgreSQL (Go GORM)

Koneksi database PostgreSQL dikelola di layer infrastruktur/repository menggunakan GORM (Object-Relational Mapping Go) dengan spesifikasi kredensial lokal Anda:

- **Host:** `localhost`
- **Port:** `5432`
- **User:** `root`
- **Password:** ` ` _(Kosong)_
- **Database Name:** `mmorpg_db` _(Dapat disesuaikan)_

### Contoh Kode Koneksi GORM (`backend/internal/repository/postgres/connection.go`)

```go
package postgres

import (
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewPostgreSQLConnection() *gorm.DB {
	// Membentuk DSN (Data Source Name) sesuai spesifikasi kredensial lokal Anda
	dsn := "host=localhost user=root password= dbname=mmorpg_db port=5432 sslmode=disable TimeZone=Asia/Jakarta"

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("Gagal terhubung ke PostgreSQL: %v", err)
	}

	// Konfigurasi Connection Pool demi stabilitas performa tinggi
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(10)  // Jumlah koneksi standby minimum
		sqlDB.SetMaxOpenConns(100) // Batas maksimum koneksi terbuka simultan
	}

	fmt.Println("✅ Sukses terhubung ke database PostgreSQL (localhost:5432)")
	return db
}
```

---

## 📁 Struktur Bersih Kode Go (Clean Architecture)

Arsitektur ini memisahkan logika bisnis game secara ketat dari infrastruktur jaringan/database. Jika di kemudian hari Anda ingin mengganti WebSocket dengan WebRTC, Anda hanya perlu merombak folder `delivery/` tanpa menyentuh logika game inti di `domain/` dan `usecase/`.

```text
/home/yoga/Dokumen/game mmorpg/frontend/
├── .doc/
│   └── Backend.md                 # Berkas ini (Dokumentasi Arsitektur)
├── backend/                       # Seluruh Kode Server Go
│   ├── cmd/
│   │   └── server/
│   │       └── main.go            # Entry Point Aplikasi (Menginisialisasi seluruh dependency)
│   ├── internal/
│   │   ├── domain/                # 1. DOMAIN LAYER (Definisi Entity & Interface Dasar)
│   │   │   ├── player.go          # Struct Player, Inventaris, Senjata
│   │   │   ├── monster.go         # Struct Monster & Status AI
│   │   │   ├── vector.go          # Matematika Vector3 (X, Y, Z)
│   │   │   └── ecs.go             # Definisi Komponen & Entity untuk Real-time ECS
│   │   ├── usecase/               # 2. USECASE LAYER (Logika Bisnis Game & Aturan Simulasi)
│   │   │   ├── auth/
│   │   │   │   └── login.go       # Logika Autentikasi Pemain
│   │   │   └── game/
│   │   │       ├── game_loop.go   # Loop Utama Server (Fixed Tick Rate 30Hz)
│   │   │       ├── movement.go    # Sistem sinkronisasi pergerakan fisika
│   │   │       └── combat.go      # Sistem kalkulasi damage, targeting, dan HP
│   │   ├── repository/            # 3. REPOSITORY LAYER (Akses Database & Caching)
│   │   │   ├── postgres/
│   │   │   │   ├── connection.go  # Driver koneksi PostgreSQL local
│   │   │   │   └── user_repo.go   # CRUD Player ke PostgreSQL (GORM)
│   │   │   └── redis/
│   │   │       └── state_repo.go  # Simpan koordinat real-time cepat ke Redis
│   │   └── delivery/              # 4. DELIVERY LAYER (Handler Jaringan & Input/Output)
│   │       ├── http/
│   │       │   ├── router.go      # Setup Rute HTTP Gin
│   │       │   └── auth_handler.go# REST API Login/Register Handler
│   │       └── ws/
│   │           ├── client.go      # Mewakili satu koneksi aktif WebSocket
│   │           ├── hub.go         # Pengelola ruangan (Room/Lobby) & Distribusi pesan
│   │           └── game_handler.go# Menerjemahkan input biner bodi WebSocket ke ECS
│   ├── pkg/                       # 5. PACKAGES & UTILITIES (Dapat digunakan pihak luar)
│   │   ├── protobuf/
│   │   │   └── game.pb.go         # Kode hasil compile file .proto (Format data biner)
│   │   └── config/
│   │       └── config.go          # Parser environment variables (.env)
│   ├── go.mod
│   └── go.sum
```

---

## 💻 Panduan & Integrasi Sisi Frontend (Next.js)

Arah integrasi pada repositori Next.js Anda di `/home/yoga/Dokumen/game mmorpg/frontend` berpusat pada pembuatan _Custom Hook_ React WebSocket untuk menghubungkan input pergerakan lokal ke server.

### Berkas Integrasi Klien (`src/hooks/useWebSocketGame.ts`)

```typescript
import { useEffect, useRef } from "react";

export interface PlayerNetworkState {
    id: string;
    x: number;
    y: number;
    z: number;
    rotation: number;
    animation: string;
}

export const useWebSocketGame = (
    serverUrl: string,
    onStateReceived: (states: PlayerNetworkState[]) => void,
) => {
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Membuka koneksi WebSocket ke Server Go
        const ws = new WebSocket(serverUrl);
        ws.binaryType = "arraybuffer"; // Gunakan arraybuffer jika mentransfer Protobuf biner
        wsRef.current = ws;

        ws.onmessage = (event) => {
            if (typeof event.data === "string") {
                // Fallback jika menggunakan pesan JSON teks biasa
                const players = JSON.parse(event.data) as PlayerNetworkState[];
                onStateReceived(players);
            } else {
                // Tempat decode biner Protobuf (sangat direkomendasikan untuk produksi)
                // const decoded = GameState.decode(new Uint8Array(event.data));
            }
        };

        ws.onopen = () => console.log("✅ Terhubung ke Server Real-time Go");
        ws.onclose = () => console.log("❌ Koneksi Server Terputus");

        return () => {
            ws.close();
        };
    }, [serverUrl]);

    // Mengirim posisi karakter lokal ke server secara real-time
    const sendPlayerState = (state: Omit<PlayerNetworkState, "id">) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(state));
        }
    };

    return { sendPlayerState };
};
```

---

## 🎯 Pembagian Fase Pengembangan (Development Phases)

Untuk meminimalkan risiko kegagalan integrasi, pengembangan dibagi menjadi **3 Fase Terukur**:

### 🏁 FASE 1: Fondasi API, Autentikasi, & WebSocket Hub (Durasi: 1-2 Minggu)

Fase ini berfokus untuk membangun kerangka HTTP, sistem login, serta protokol WebSockets dasar.

- **Sisi Backend (Go + Gin):**
    1. Setup proyek Go, konfigurasi database lokal PostgreSQL (localhost:5432).
    2. Implementasi **REST API dengan Gin** untuk fitur Login dan Register (menggunakan JWT Token).
    3. Integrasi koneksi WebSocket pertama menggunakan Gin + Melody/Gorilla WebSocket.
    4. Membuat **WS Hub** untuk mengelola koneksi masuk, penanganan _disconnect_, serta pembagian ruang (Lobby/Room).
- **Sisi Klien (Next.js):**
    1. Membuat UI Login/Registrasi yang elegan.
    2. Integrasi context WebSocket di Next.js untuk menjaga status koneksi aktif saat game dimulai.

---

### 🎮 FASE 2: Sinkronisasi Pergerakan & State ECS Klien-Server (Durasi: 2-3 Minggu)

Fase terpenting di mana pergerakan karakter utama Anda (`PlayerController`) tersinkronisasi sempurna di layar pemain lain.

- **Sisi Backend (Go + Real-Time Loop):**
    1. Membuat **Fixed Tick Rate Loop (30 FPS / 30Hz)** di dalam thread server Go.
    2. Implementasi skema **Protocol Buffers (Protobuf)** untuk pesan posisi:
        ```protobuf
        message PlayerState {
          string id = 1;
          float x = 2;
          float y = 3;
          float z = 4;
          float rotation = 5;
          string animation = 6;
        }
        ```
    3. Integrasi **Redis** untuk caching posisi pemain tercepat. Setiap _tick_, posisi disebarkan (_broadcast_) ke semua pemain lain dalam ruangan tersebut.
- **Sisi Klien (Next.js + R3F + Bitecs):**
    1. Mengirim data posisi X, Y, Z karakter lokal ke WebSocket Server setiap kali bergerak via `sendPlayerState`.
    2. Menerima data koordinat biner pemain lain, lalu me-render visual karakter tersebut secara mulus menggunakan **Linear Interpolation (LERP)** agar gerakan tidak patah-patah meskipun latensi jaringan naik turun.

---

### ⚔️ FASE 3: Server-Authoritative Combat & Monster AI (Durasi: 3-4 Minggu)

Fase terakhir yang menyulap game menjadi simulasi duel MMORPG kompetitif seutuhnya.

- **Sisi Backend (Go + Logika ECS):**
    1. Membuat sistem deteksi tabrakan hit-box serangan pemain di server (Server-authoritative hits).
    2. Mengelola daur hidup Monster (Spawn, Movement, HP, Aggro Target) sepenuhnya dari memori Server Go.
    3. Server mendistribusikan koordinat musuh terdekat secara real-time ke semua pemain.
    4. Ketika monster mati, server Go mendistribusikan item drop/Gold dan memperbarui data _Experience_ karakter pemain langsung ke PostgreSQL Database.
- **Sisi Klien (Next.js):**
    1. Me-render monster 3D murni berdasarkan posisi biner yang disiarkan server.
    2. Menampilkan efek visual spell/sihir (`VFXManager`) lokal setiap kali server mengabarkan adanya serangan dari pemain lain atau monster.

---

## 💡 Contoh Implementasi Kode Bersih (Go Backend)

### 1. `internal/domain/player.go` (Domain Layer - Bebas Dependency)

```go
package domain

import "time"

type Player struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username" gorm:"unique;not null"`
	Password  string    `json:"-" gorm:"not null"`
	Level     int       `json:"level" gorm:"default:1"`
	HP        float32   `json:"hp" gorm:"default:1000"`
	MaxHP     float32   `json:"max_hp" gorm:"default:1000"`
	Attack    float32   `json:"attack" gorm:"default:50"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PlayerRepository interface {
	Create(player *Player) error
	GetByID(id string) (*Player, error)
	GetByUsername(username string) (*Player, error)
	Update(player *Player) error
}
```

### 2. `internal/delivery/http/auth_handler.go` (Delivery Layer - Framework Gin)

```go
package http

import (
	"net/http"
	"github.com/gin-gonic/gin"
	"tiktok-next-backend/internal/domain"
)

type AuthHandler struct {
	PlayerRepo domain.PlayerRepository
}

func NewAuthHandler(r *gin.Engine, repo domain.PlayerRepository) {
	handler := &AuthHandler{PlayerRepo: repo}
	r.POST("/api/auth/register", handler.Register)
}

func (h *AuthHandler) Register(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	player := &domain.Player{
		Username: input.Username,
		Password: input.Password, // Catatan: Selalu hash sandi di usecase sebelum disimpan!
	}

	if err := h.PlayerRepo.Create(player); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal registrasi pemain"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Registrasi berhasil", "player": player})
}
```

---

## 🎨 Tips Optimasi Tambahan

1. **Gunakan Connection Pool di Redis/GORM:** Hindari membuka-tutup koneksi database di setiap request. Konfigurasikan pooling di `connection.go`.
2. **Server Tick Rate Capping:** Batasi putaran sim loop maksimal di 30Hz atau 60Hz menggunakan `time.Ticker` Go untuk menghemat utilisasi CPU server.
