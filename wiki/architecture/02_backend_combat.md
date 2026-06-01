# 02. Backend Combat Usecase & Authoritative Validation
> **Tujuan**: Menerapkan validasi rate-limit dynamic ASPD, perhitungan akurasi fisik (HIT vs FLEE), *Critical Hit Shield*, dan formula mitigasi Hard DEF vs. Soft DEF ($A + B$) secara authoritative di sisi server.

Semua logika pemrosesan combat server berada di file `@[/home/yoga/Dokumen/game mmorpg/backend/internal/usecase/game/combat.go]`. Pada tahap kedua ini, kita akan merefaktor alur penanganan serangan pemain agar 100% aman dan akurat secara matematis.

---

## 🛠️ Langkah Demi Langkah (Step-by-Step)

### Langkah 1: Refaktor Authoritative Attack Cooldown (Rate-Limiting)

Backend membutuhkan sistem anti-speedhack yang handal namun tetap fleksibel terhadap toleransi latensi jaringan (*network jitter*).

Cari baris kode penanganan cooldown di dalam method `HandlePlayerAttack` (sekitar baris 43-63):

```go
	// Authoritative Attack Rate-Limiting based on dynamic ASPD (Ragnarok Renewal / New World style)
	hitsPerSecond := 1.0 + (float64(playerData.ASPD) / 125.0)
	cooldownMs := time.Duration(1000.0/hitsPerSecond) * time.Millisecond
	buffer := 30 * time.Millisecond // Jitter tolerance buffer
```

Pastikan backend mencatat `LastBasicAttackTime` dengan menyertakan toleransi `buffer` agar player dengan ASPD tinggi tidak terblokir secara salah akibat fluktuasi ping jaringan.

---

### Langkah 2: Mengintegrasikan Authoritative Hit vs. Flee Roll (Akurasi)

Saat ini, server langsung memproses damage tanpa memeriksa apakah serangan tersebut berhasil mendarat (*Hit*) atau meleset (*Miss*). Kita akan menerapkan dadu acak peluang akurasi fisik.

Tambahkan potongan logika di bawah ini sebelum perhitungan damage akhir (sekitar baris 94):

```go
		// =========================================================================
		// TAHAP 2: AUTHORITATIVE HIT vs FLEE COMBAT ROLL
		// =========================================================================
		isCritRaw := rand.Float32() < playerData.CriticalRate
		isHit := true

		if !isCritRaw {
			// Kurangi akurasi penyerang dengan flee rate pertahanan target
			hitChance := playerData.HIT - monster.Flee
			roll := rand.Intn(100)

			// Peluang Hit dibatasi minimal 5% dan maksimal 95% (Failsafe)
			if hitChance < 5 { hitChance = 5 }
			if hitChance > 95 { hitChance = 95 }

			if roll >= hitChance {
				isHit = false
			}
		}

		if !isHit {
			fmt.Printf("💨 MISS: Player %s -> Monster %s (Akurasi meleset! Roll gagal)\n", playerData.Username, monster.Name)
			// Broadcast paket MISS ke client (Damage = 0)
			u.broadcastDamageUpdate(playerID, targetID, 0, false, true, "MISS")
			u.monstersMu.Unlock()
			return
		}
```

---

### Langkah 3: Menerapkan Pengaruh Critical Hit Shield & C.RATE

Statistik `LUK` target berfungsi memberikan resistensi critical. Kita harus mengurangi peluang critical penyerang dengan *Critical Hit Shield* pertahanan musuh sebelum melakukan roll dadu critical.

Modifikasi method `CalculateDamageTo` di file `@[/home/yoga/Dokumen/game mmorpg/backend/internal/domain/player.go]` (baris 313):

```diff
-func (p *Player) CalculateDamageTo(targetDefense float32) (float32, bool) {
+func (p *Player) CalculateDamageTo(targetDefense float32, targetLUK int, targetLevel int, targetCRatePlus int) (float32, bool) {
 	isCrit := false
 	dmg := p.Attack
 
 	// Mage deals damage derived from MagicAttack instead of physical Attack!
 	if p.Class == "Mage" {
 		dmg = p.MagicAttack
 	}
 
-	// Critical roll using global rand
-	if rand.Float32() < p.CriticalRate {
+	// Hitung Critical Hit Shield milik target
+	critShield := float32(targetLevel/15) + float32(targetLUK/5)
+	effectiveCritRate := p.CriticalRate - (critShield * 0.01)
+	if effectiveCritRate < 0 { effectiveCritRate = 0 }
+
+	// Critical roll menggunakan peluang bersih
+	if rand.Float32() < effectiveCritRate {
 		isCrit = true
-		dmg *= 1.5
+		// Amplifikasi damage critical dipengaruhi oleh C.RATE (CRT)
+		critMultiplier := 1.40 + (float32(p.CRatePlus) * 0.01)
+		dmg *= critMultiplier
 	}
```

---

### Langkah 4: Menerapkan Formula Pengurangan Kerusakan Hard vs. Soft DEF ($A + B$)

Modifikasi bagian kalkulasi pengurangan damage di file `@[/home/yoga/Dokumen/game mmorpg/backend/internal/domain/player.go]` agar mendukung pembagian **Soft DEF ($A$)** dan **Hard DEF ($B$)** secara nyata:

```go
	// =========================================================================
	// TAHAP 2: HARD DEF vs SOFT DEF (A + B) DAMAGE MITIGATION FORMULA
	// =========================================================================
	// Target Defense dilewatkan sebagai Hard DEF (berasal dari perlengkapan/armor)
	hardDEF := targetDefense
	
	// Soft DEF (berasal dari VIT stat internal target)
	softDEF := float32(p.VIT)/2.0 + float32(p.AGI)/5.0
	
	// 1. Terapkan pengurangan persentase Hard DEF
	var damageMultiplier float32 = 1.0
	if hardDEF > 0 {
		damageMultiplier = 1.0 - (hardDEF / (hardDEF + 4000.0))
	}
	dmg = dmg * damageMultiplier

	// 2. Terapkan pengurangan nominal flat Soft DEF
	dmg = dmg - softDEF

	// Minimal damage selalu 1 (agar pukulan tidak bernilai negatif/pulih)
	if dmg < 1 { dmg = 1 }
```

---

### Langkah 5: Menerapkan Penyerapan RES & M.RES (4th Class Combat)

Setelah mendapatkan damage bersih dari pengurangan DEF dasar, terapkan penyerapan tingkat lanjut berbasis persentase menggunakan RES (Physical Resistance) atau M.RES (Magic Resistance) untuk PvP/Monster level tinggi:

```go
	// Physical Resist (RES)
	resReduction := float32(targetCRatePlus) * 0.001 // Contoh scaling 0.1% per RES
	dmg = dmg * (1.0 - resReduction)
```

Dengan mengintegrasikan logika tempur tingkat lanjut ini, server game Anda sekarang memiliki tingkat konsistensi dan keamanan mekanik setingkat dengan engine MMO profesional!

---

➡️ **Langkah Berikutnya**: Lanjutkan ke [Tahap 3: Frontend State & WebSocket Sync](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/03_frontend_state.md) untuk mendesain visualisasi antarmuka stat baru dan payload sinkronisasi WebSocket!
