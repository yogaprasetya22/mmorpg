# Panduan Fitur

## Arena Multipemain

Arena adalah mode utama Jagres — pertarungan real-time melawan monster di peta 3D.

### Cara Main

1. **Login** — buat akun atau login
2. **Pilih Karakter** — pilih karakter yang sudah dibuat
3. **Masuk Arena** — karakter muncul di peta, monster mulai muncul
4. **Bertarung** — klik kiri pada monster untuk menyerang

### Kontrol

| Tombol    | Aksi                    |
| --------- | ----------------------- |
| W A S D   | Gerak                   |
| Spasi     | Lompat                  |
| Shift     | Lari                    |
| Klik Kiri | Serang target           |
| Tab       | Target monster terdekat |
| 1-5       | Gunakan skill           |
| I         | Buka inventory          |
| C         | Buka karakter stat      |
| M         | Buka minimap            |

### Sistem Kelas

| Kelas    | Peran      | Skill Utama                       |
| -------- | ---------- | --------------------------------- |
| Beginner | Dasar      | Basic attack                      |
| Warrior  | Tank/DPS   | Power Strike, Taunt, Stun         |
| Mage     | AoE Caster | Fireball, Frost Nova, Blizzard    |
| Archer   | Range DPS  | Arrow Volley, Snipe, Poison Arrow |
| Assassin | Burst DPS  | Backstab, Poison, Stealth         |
| Priest   | Healer     | Heal, Buff, Cleanse               |

Naik level → dapat poin stat → distribusikan STR/AGI/INT/VIT/DEX.

### Monster

Monster muncul secara periodik di arena. Tiap monster punya:

- HP, Attack Power, Defense
- AI: patrol → detect → chase → attack
- Tipe: normal, elite, boss

## World Editor (Map Studio)

Editor peta 3D langsung di browser.

### Akses

Buka `/world-editor` di browser.

### Cara Pakai

| Aksi                 | Cara                                   |
| -------------------- | -------------------------------------- |
| **Tempat objek**     | Pilih aset dari library → klik terrain |
| **Drag objek**       | Klik objek → drag ke posisi baru       |
| **Putar objek**      | Alt + scroll (ubah rotasi)             |
| **Scale objek**      | Shift + Alt + scroll                   |
| **Naik/turun objek** | Ctrl + scroll                          |
| **Hapus objek**      | Pilih → Delete                         |
| **Undo/Redo**        | Ctrl+Z / Ctrl+Y                        |

### Mode

| Mode                 | Fungsi                                           |
| -------------------- | ------------------------------------------------ |
| **Place**            | Tempatkan aset satu per satu                     |
| **Paint**            | Cat terrain dengan brush mask                    |
| **Sculpt**           | Ubah tinggi terrain (raise/lower/smooth/flatten) |
| **Vegetation Spray** | Semprot vegetasi massal                          |

### Vegetasi

Pilih tema vegetasi → atur density, radius, slope filter → klik & drag untuk menyemprot.

## Avatar Configurator

Kostumisasi karakter:

- Rambut (style + warna)
- Pakaian (atasan, bawahan)
- Senjata
- Skin tone

Perubahan langsung terlihat di preview 3D.

## Inventory & Equipment

| Fitur      | Fungsi                       |
| ---------- | ---------------------------- |
| Inventory  | Lihat item yang dimiliki     |
| Equip      | Pakai senjata/baju/aksesoris |
| Shop       | Beli item dari NPC           |
| Auction    | Jual/beli item antar pemain  |
| Refine     | Tingkatkan level senjata     |
| Consumable | Pakai potion, scroll         |

---

## Related Docs

- [README.md](../README.md) — Gambaran proyek
- [🚨 DONT_TOUCH.md](../DONT_TOUCH.md) — Zona kritis performa
- [Wiki Arsitektur](../wiki/architecture/README.md) — Detail implementasi
