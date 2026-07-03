# 06. Combat Formula Reference Sheet

> **Tujuan**: Lembar spesifikasi matematika absolut (_mathematical reference cheat-sheet_) untuk seluruh perhitungan kalkulasi pertarungan di server MMORPG.

Dokumen ini mendokumentasikan persamaan matematika formal yang digunakan oleh backend Go di `Player.RecalculateStats()` dan combat usecases.

---

## ⚔️ 1. Persamaan Atribut Utama & Derived ATK

Derived Attack menentukan kapasitas kerusakan fisik atau magis murni sebelum dikurangi pertahanan musuh.

### A. Status ATK (Fisik)

Status ATK dibedakan berdasarkan kelas penyerang (Melee vs Ranged):

$$\text{Status ATK (Melee)} = \text{STR} + \lfloor\text{DEX} \div 5\rfloor + \lfloor\text{LUK} \div 3\rfloor + \lfloor\text{BaseLevel} \div 4\rfloor + (5 \times \text{POW}) + (1 \times \text{CON})$$

$$\text{Status ATK (Ranged)} = \text{DEX} + \lfloor\text{STR} \div 5\rfloor + \lfloor\text{LUK} \div 3\rfloor + \lfloor\text{BaseLevel} \div 4\rfloor + (5 \times \text{POW}) + (1 \times \text{CON})$$

### B. Status MATK (Magis)

MATK digunakan penuh untuk serangan sihir (misal: kelas _Mage_):

$$\text{Status MATK} = \text{INT} + \lfloor\text{DEX} \div 5\rfloor + \lfloor\text{LUK} \div 3\rfloor + \lfloor\text{BaseLevel} \div 4\rfloor + (5 \times \text{SPL}) + (1 \times \text{CON})$$

---

## 🛡️ 2. Pertahanan, Resistensi, & Pengurangan Kerusakan ($A + B$)

Total pengurangan kerusakan (_damage mitigation_) memadukan pertahanan fisik baju besi/gear (**Hard DEF**) dengan pertahanan ketahanan stat internal tubuh (**Soft DEF**).

### A. Pertahanan Fisik Dasar (DEF)

1.  **Soft DEF** (Berasal dari peningkatan VIT dan AGI pemain):
    $$\text{Soft DEF} = \frac{\text{VIT}}{2} + \frac{\text{AGI}}{5} + \frac{\text{BaseLevel}}{15}$$
2.  **Hard DEF** (Berasal dari total pertahanan item/armor yang dilengkapi).
3.  **Damage Reduction Multiplier** (Persentase pengurangan Hard DEF):
    $$\text{Hard DEF Multiplier} = 1.0 - \left( \frac{\text{Hard DEF}}{\text{Hard DEF} + 4000} \right)$$
4.  **Formula Kerusakan Fisik Akhir**:
    $$\text{Damage Received} = (\text{Damage Input} \times \text{Hard DEF Multiplier}) - \text{Soft DEF}$$

### B. Pertahanan Magis Dasar (MDEF)

1.  **Soft MDEF** (Berasal dari peningkatan INT, VIT, dan DEX):
    $$\text{Soft MDEF} = \text{INT} + \frac{\text{VIT}}{5} + \frac{\text{DEX}}{5} + \frac{\text{BaseLevel}}{4}$$
2.  **Hard MDEF** (Berasal dari equipment / jubah sihir).
3.  **Damage Reduction Multiplier** (Persentase pengurangan Hard MDEF):
    $$\text{Hard MDEF Multiplier} = 1.0 - \left( \frac{\text{Hard MDEF}}{\text{Hard MDEF} + 1000} \right)$$
4.  **Formula Kerusakan Magis Akhir**:
    $$\text{Magic Damage Received} = (\text{Damage Input} \times \text{Hard MDEF Multiplier}) - \text{Soft MDEF}$$

---

## 🎯 3. Akurasi, Hindaran, & Peluang Critical

### A. Peluang Hit Fisik (HIT vs FLEE)

Serangan fisik biasa dapat meleset (_Miss_) berdasarkan rasio perbandingan statistik akurasi penyerang (**HIT**) vs hindaran target (**FLEE**):

$$\text{Attacker HIT} = 175 + \text{BaseLevel} + \text{DEX} + \lfloor\text{LUK} \div 3\rfloor + (2 \times \text{CON})$$

$$\text{Defender FLEE} = 100 + \text{BaseLevel} + \text{AGI} + \lfloor\text{LUK} \div 5\rfloor + (2 \times \text{CON})$$

$$\text{Peluang Sukses Hit (\%)} = \text{Attacker HIT} - \text{Defender FLEE}$$

> [!NOTE]
> Peluang sukses hit dibatasi secara authoritative di server minimal 5% (selalu ada peluang kecil kena) dan maksimal 95% (selalu ada peluang kecil meleset).

### B. Peluang Serangan Critical (CRIT)

Serangan critical mengabaikan Flee target (selalu 100% kena), namun peluang kemunculannya dapat diredam oleh statistik LUK pertahanan musuh (**Critical Hit Shield**):

$$\text{Attacker Raw CRIT (\%)} = 1.0\% + \frac{\text{LUK}}{3}$$

$$\text{Defender Crit Shield (\%)} = \lfloor\text{DefenderLevel} \div 15\rfloor + \lfloor\text{DefenderLUK} \div 5\rfloor$$

$$\text{Effective Critical Chance (\%)} = \text{Attacker Raw CRIT} - \text{Defender Crit Shield}$$

---

## ⚡ 4. Waktu Rapal (Cast Time) & ASPD

### A. Variable Cast Time (VCT)

Sisa persentase variable cast time menyusut secara eksponensial seiring meningkatnya DEX dan INT:

$$\text{VCT multiplier} = 1.0 - \sqrt{\frac{\text{DEX} \times 2 + \text{INT}}{530}}$$

> [!IMPORTANT]
> Ketika total $(\text{DEX} \times 2 + \text{INT}) \ge 530$, Variable Cast Time bernilai **0 detik (Instant Cast)**.

### B. Kecepatan Serang (ASPD)

ASPD berskala 0 hingga 200 dengan batas maksimal di angka 193:

$$\text{ASPD} = 200 - (200 - \text{BaseASPD}) \times \left(1.0 - \frac{\text{AGI} \times 4 + \text{DEX}}{1000}\right)$$

Lembar rumus ini menjadi fondasi validasi seluruh data logika combat demi menjamin keseimbangan (_balance_) pertarungan jangka panjang di game Anda!

---

➡️ **Langkah Berikutnya**: Lanjutkan ke [Tahap 7: Network Sync Protocol](07_network_sync_protocol.md) untuk mempelajari struktur payload paket WebSocket!

---

**📚 Dokumen Terkait**: [README.md](../../README.md) · [docs/Home.md](../../docs/Home.md) · [docs/Architecture.md](../../docs/Architecture.md) · [DONT_TOUCH.md](../../DONT_TOUCH.md)
