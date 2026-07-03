# 05. GORM Database Migrations & Seeding

> **Tujuan**: Detailing langkah-langkah migrasi skema database GORM untuk PostgreSQL dan mekanisme seeding stat awal saat server booting.

Untuk memastikan penambahan variabel stat baru (termasuk pemisahan `BaseSTR` vs `STR` dan integrasi kolom Talent Stats) bertahan secara gigih (_persistent_) di PostgreSQL, backend menggunakan GORM AutoMigration.

---

## 🏗️ 1. Skema Relasional Database (PostgreSQL)

Setiap akun pemain memetakan satu baris data pada tabel `players`. GORM secara otomatis mendeteksi perubahan tipe data dan penambahan kolom baru pada struct `Player` di Go.

```
+-------------------------------------------------------------------------+
|                                 PLAYERS                                 |
+-------------------------------------------------------------------------+
| id (PK)         | varchar(255) | ID unik karakter                       |
| username        | varchar(255) | Username unik                          |
| class           | varchar(255) | Beginner, Warrior, Mage, Priest, Thief |
| level           | integer      | Level saat ini                         |
| xp              | integer      | Akumulasi XP                           |
| gold            | integer      | Akumulasi Gold                         |
| str             | integer      | Poin dasar Strength                    |
| agi             | integer      | Poin dasar Agility                     |
| vit             | integer      | Poin dasar Vitality                    |
| int             | integer      | Poin dasar Intelligence                |
| dex             | integer      | Poin dasar Dexterity                   |
| luk             | integer      | Poin dasar Luck                        |
| pow             | integer      | Poin dasar Power (Talent)              |
| sta             | integer      | Poin dasar Stamina (Talent)            |
| wis             | integer      | Poin dasar Wisdom (Talent)             |
| spl             | integer      | Poin dasar Spell (Talent)              |
| con             | integer      | Poin dasar Concentration (Talent)      |
| crt             | integer      | Poin dasar Creative (Talent)           |
| stat_points     | integer      | Sisa Poin Stat Primer                  |
| talent_points   | integer      | Sisa Poin Talent                       |
+-------------------------------------------------------------------------+
```

---

## 🛠️ 2. Langkah Detail Migrasi (Step-by-Step)

### Langkah 1: Registrasi Struct di Driver PostgreSQL

Buka file inisialisasi koneksi DB Anda di `@[backend/internal/repository/postgres/connection.go]`. GORM memerlukan pendaftaran entitas struct untuk memetakan kolom baru.

Pastikan fungsi AutoMigrate memuat daftarnya seperti ini:

```go
func NewPostgresDB(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// Memicu migrasi skema tabel secara otomatis saat server booting
	err = db.AutoMigrate(
		&domain.Player{},
		&domain.PlayerItem{},
		&domain.PlayerSkill{},
		&domain.PlayerQuest{},
	)
	if err != nil {
		return nil, err
	}

	return db, nil
}
```

### Langkah 2: Menangani Migrasi Kolom Lama ke Kolom Baru (Data Backfill)

Karena kolom `str`, `agi`, `vit`, `int`, `dex`, dan `luk` pada versi lama menyimpan poin alokasi dasar, migrasi ke `base_str`, `base_agi`, dll., memerlukan pemetaan tag kolom `gorm:"column:str"`.

```go
	BaseSTR    int `json:"base_str" gorm:"column:str;default:10"`
	BaseAGI    int `json:"base_agi" gorm:"column:agi;default:10"`
	BaseVIT    int `json:"base_vit" gorm:"column:vit;default:10"`
	BaseINT    int `json:"base_int" gorm:"column:int;default:10"`
	BaseDEX    int `json:"base_dex" gorm:"column:dex;default:10"`
	BaseLUK    int `json:"base_luk" gorm:"column:luk;default:10"`
```

- **Keuntungan**: Nama kolom fisik di database PostgreSQL tetap berupa `str`, `agi`, dll., namun dibaca ke dalam struct in-memory Go sebagai `BaseSTR`, `BaseAGI` untuk menghindari hilangnya data karakter pemain lama.

---

## 🧬 3. Mekanisme Seeding Stat Karakter Baru

Saat pemain mendaftar atau membuat karakter pertama kali, backend Go harus menyuntikkan statistik default di file `@[backend/internal/usecase/game/game_usecase.go]`.

Cari method `RegisterPlayer` (sekitar baris 330), pastikan pembuatan karakter default mengikuti data inisialisasi presisi berikut:

```go
		pData = &domain.Player{
			ID:           playerID,
			Username:     username,
			Class:        "Beginner",
			Gender:       "Male",
			HairStyle:    1,
			HairColor:    "#5A3E2D",
			Level:        1,
			XP:           0,
			Gold:         200,
			BaseSTR:      10,
			BaseAGI:      10,
			BaseVIT:      10,
			BaseINT:      10,
			BaseDEX:      10,
			BaseLUK:      10,
			BasePOW:      0,
			BaseSTA:      0,
			BaseWIS:      0,
			BaseSPL:      0,
			BaseCON:      0,
			BaseCRT:      0,
			StatPoints:   5,
			TalentPoints: 0, // Hanya diperoleh saat naik level ke kelas 4th
			HP:           1000,
			MaxHP:        1000,
			MP:           200,
			MaxMP:        200,
		}
```

Mekanisme ini menjamin transisi data skema database aman dari error ketiadaan kolom (_null columns constraint errors_) saat fitur tempur baru diaktifkan!

---

## 🧱 4. Skema & Seeding `assets` (Dynamic Assets & WebP Thumbnails)

Untuk mendukung dynamic assets rendering dan loading thumbnail WebP ringan di front-end, GORM mengelola tabel `assets`:

### Struct Model `Asset` (Go)

```go
type Asset struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"uniqueIndex" json:"name"`
	Path      string    `json:"path"`
	Category  string    `json:"category"` // "trees", "vegetation", "rocks", etc.
	Thumbnail string    `json:"thumbnail"` // Path ke /assets/thumbs/[modelName].webp
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
```

### Seeder Dinamis `backend/internal/repository/postgres/seeder.go`

Ketika server melakukan bootstrap (atau dijalankan via `make seed-enemy`), seeder memindai folder `.glb` di backend. Secara simultan, seeder melakukan lookup berkas `.webp` dengan nama yang sama di subdirektori `assets/thumbs/`:

1. Pemindaian rekursif file `.glb` di `./assets/environment/`.
2. Pencarian file thumbnail pendukung di `./assets/thumbs/[glbName].webp`.
3. Jika ditemukan, kolom `Thumbnail` akan diisi dengan path relatif `/assets/thumbs/[glbName].webp` sebelum disimpan ke PostgreSQL DB.
4. Data thumbnail ini disajikan oleh REST API `/api/config/assets` untuk mempercepat render UI grid di editor secara signifikan tanpa membebani memori dengan WebGL Canvas instansiasi dini.

---

➡️ **Langkah Berikutnya**: Lanjutkan ke [Tahap 6: Combat Formula Reference Sheet](06_combat_formula_ref.md) untuk mempelajari seluruh lembar contekan formula matematika pertempuran!

---

**📚 Dokumen Terkait**: [README.md](../../README.md) · [docs/Home.md](../../docs/Home.md) · [docs/Architecture.md](../../docs/Architecture.md) · [DONT_TOUCH.md](../../DONT_TOUCH.md)
