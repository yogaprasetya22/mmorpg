# 01. Backend Domain & Struct Modifications

> **Tujuan**: Mengintegrasikan Talent Stats (POW, STA, WIS, SPL, CON, CRT) ke domain player Go dan merefaktor formula `RecalculateStats` agar sesuai iRO Renewal.

Sistem statistik dasar Go backend saat ini berada di file `@[backend/internal/domain/player.go]`. Pada tahap pertama ini, kita akan menambahkan field Talent Stats baru serta memperbarui alur kalkulasi statistik in-memory character.

---

## 🛠️ Langkah Demi Langkah (Step-by-Step)

### Langkah 1: Menambahkan Field Atribut Baru pada Struct `Player`

Buka file `@[backend/internal/domain/player.go]`. Kita perlu memodifikasi struct `Player` untuk menambahkan kolom penyimpanan database (GORM) dan in-memory variables.

Cari bagian di mana statistik dasar STR-LUK berada (sekitar baris 28-51), lalu tambahkan baris-baris kode berikut:

```go
	// =========================================================================
	// TAHAP 1: CORE TALENT ATTRIBUTES (Base allocated points, saved to DB)
	// =========================================================================
	BasePOW      int      `json:"base_pow" gorm:"column:pow;default:0"`
	BaseSTA      int      `json:"base_sta" gorm:"column:sta;default:0"`
	BaseWIS      int      `json:"base_wis" gorm:"column:wis;default:0"`
	BaseSPL      int      `json:"base_spl" gorm:"column:spl;default:0"`
	BaseCON      int      `json:"base_con" gorm:"column:con;default:0"`
	BaseCRT      int      `json:"base_crt" gorm:"column:crt;default:0"`
	TalentPoints int      `json:"talent_points" gorm:"default:0"` // Tersedia untuk dialokasikan

	// In-Memory Total Talent Attributes (Base + Bonus, not saved to DB)
	POW          int      `json:"pow" gorm:"-"`
	STA          int      `json:"sta" gorm:"-"`
	WIS          int      `json:"wis" gorm:"-"`
	SPL          int      `json:"spl" gorm:"-"`
	CON          int      `json:"con" gorm:"-"`
	CRT          int      `json:"crt" gorm:"-"`

	// In-Memory Amplified Substats (RO Renewal 4th Class, not saved to DB)
	PATK         int      `json:"p_atk" gorm:"-"`      // Power ATK % amplification
	SMATK        int      `json:"s_matk" gorm:"-"`     // Spell MATK % amplification
	RES          int      `json:"res" gorm:"-"`        // Physical Resistance
	MRES         int      `json:"m_res" gorm:"-"`       // Magic Resistance
	HPLUS        int      `json:"h_plus" gorm:"-"`      // Heal Plus %
	CRATE        int      `json:"c_rate" gorm:"-"`      // Critical Damage Rate %
```

---

### Langkah 2: Mengimplementasikan Logika Reset & Alokasi pada `RecalculateStats()`

Temukan method `func (p *Player) RecalculateStats()` pada baris 147. Kita perlu memperbaruinya agar:

1.  Menyediakan pengaman batas nilai minimum poin Talent Stats.
2.  Menghitung akumulasi in-memory Talent Stats.
3.  Mengintegrasikan pengaruh Talent Stats ke status pertempuran dasar.

Modifikasi method tersebut seperti potongan kode berikut:

```diff
 func (p *Player) RecalculateStats() {
 	// Safety check: ensure base stats have a minimum of 10 points
 	if p.BaseSTR < 10 {
 		p.BaseSTR = 10
 	}
 	if p.BaseAGI < 10 {
 		p.BaseAGI = 10
 	}
 	if p.BaseVIT < 10 {
 		p.BaseVIT = 10
 	}
 	if p.BaseINT < 10 {
 		p.BaseINT = 10
 	}
 	if p.BaseDEX < 10 {
 		p.BaseDEX = 10
 	}
 	if p.BaseLUK < 10 {
 		p.BaseLUK = 10
 	}

+	// Safety check: ensure base talent stats are non-negative
+	if p.BasePOW < 0 {
+		p.BasePOW = 0
+	}
+	if p.BaseSTA < 0 {
+		p.BaseSTA = 0
+	}
+	if p.BaseWIS < 0 {
+		p.BaseWIS = 0
+	}
+	if p.BaseSPL < 0 {
+		p.BaseSPL = 0
+	}
+	if p.BaseCON < 0 {
+		p.BaseCON = 0
+	}
+	if p.BaseCRT < 0 {
+		p.BaseCRT = 0
+	}
+
 	// Reset bonuses
 	p.BonusSTR = 0
 	p.BonusAGI = 0
 	p.BonusVIT = 0
 	p.BonusINT = 0
 	p.BonusDEX = 0
 	p.BonusLUK = 0

 	// Apply class job bonuses
 	switch p.Class {
 	case "Warrior":
 		p.BonusSTR += 5
 		p.BonusVIT += 5
 	case "Mage":
 		p.BonusINT += 8
 		p.BonusDEX += 2
 	case "Priest":
 		p.BonusINT += 5
 		p.BonusVIT += 5
 	case "Thief":
 		p.BonusAGI += 8
 	}

 	// Calculate final attributes (Base + Bonus)
 	p.STR = p.BaseSTR + p.BonusSTR
 	p.AGI = p.BaseAGI + p.BonusAGI
 	p.VIT = p.BaseVIT + p.BonusVIT
 	p.INT = p.BaseINT + p.BonusINT
 	p.DEX = p.BaseDEX + p.BonusDEX
 	p.LUK = p.BaseLUK + p.BonusLUK

+	// Calculate final talent attributes (Base + Item/Buff Bonus if any)
+	p.POW = p.BasePOW
+	p.STA = p.BaseSTA
+	p.WIS = p.BaseWIS
+	p.SPL = p.BaseSPL
+	p.CON = p.BaseCON
+	p.CRT = p.BaseCRT
+
+	// Calculate Amplified Substats from Talent Stats
+	p.PATK = p.POW + p.CON
+	p.SMATK = p.SPL + p.CON
+	p.RES = p.STA * 1 // RES = 1 per point of STA
+	p.MRES = p.WIS * 1 // MRES = 1 per point of WIS
+	p.HPLUS = p.CRT    // HPLUS = 1% per point of CRT
+	p.CRATE = p.CRT    // CRATE = 1% per point of CRT
+
 	// 1. Calculate Base HP and MP from Level, VIT and INT using official iRO Wiki principles:
 	baseHP := float32(500 + p.Level*100)
 	if p.Class == "Warrior" {
 		baseHP = float32(700 + p.Level*140)
 	} else if p.Class == "Thief" {
 		baseHP = float32(550 + p.Level*105)
 	} else if p.Class == "Mage" {
 		baseHP = float32(400 + p.Level*75)
 	}
 	p.MaxHP = baseHP * (1.0 + float32(p.VIT)/100.0)
```

---

### Langkah 3: Menyesuaikan Formula Akurasi (HIT & FLEE) dengan CON

Di dalam `RecalculateStats()`, perbarui bagian perhitungan `p.HIT` dan `p.FLEE` agar mengikutsertakan nilai `CON` (Concentration) yang memberikan bonus $+2$ poin per tingkat:

```diff
 	// 5. HIT & FLEE & PerfectDodge & CastTime calculation (100% iROWiki match)
-	p.HIT = 175 + p.Level + p.DEX + (p.LUK / 3)
-	p.FLEE = 100 + p.Level + p.AGI + (p.LUK / 5)
+	p.HIT = 175 + p.Level + p.DEX + (p.LUK / 3) + (2 * p.CON)
+	p.FLEE = 100 + p.Level + p.AGI + (p.LUK / 5) + (2 * p.CON)
```

---

### Langkah 4: Sinkronisasi Database Migrasi (GORM)

Agar kolom baru (`pow`, `sta`, `wis`, `spl`, `con`, `crt`, `talent_points`) ditambahkan secara otomatis pada tabel database PostgreSQL Anda saat server dijalankan, pastikan file inisialisasi server `@[backend/internal/repository/postgres/connection.go]` memanggil auto-migrate untuk entitas player:

```go
// Contoh potongan kode setup di repository postgres
db.AutoMigrate(&domain.Player{}, &domain.PlayerItem{}, &domain.PlayerSkill{}, &domain.PlayerQuest{})
```

Dengan langkah-langkah di atas, fondasi arsitektur stat di backend telah siap untuk menangani formula pertempuran lanjut!

---

➡️ **Langkah Berikutnya**: Lanjutkan ke [Tahap 2: Backend Combat Usecase](02_backend_combat.md) untuk menerapkan formula pertahanan fisik Hard/Soft DEF dan validasi akurasi _authoritative_!

---

**📚 Dokumen Terkait**: [README.md](../../README.md) · [docs/Home.md](../../docs/Home.md) · [docs/Architecture.md](../../docs/Architecture.md) · [DONT_TOUCH.md](../../DONT_TOUCH.md)
