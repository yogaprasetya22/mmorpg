# 07. Network Sync Protocol

> **Tujuan**: Menjabarkan spesifikasi payload paket data WebSocket (JSON), siklus sinkronisasi state per-tick, dan skema transmisi tempur antara client Next.js dan server Go.

Untuk mendukung sinkronisasi multipemain (_multiplayer synchronization_), pertukaran data tempur dilakukan secara real-time melalui WebSocket KCP/WS pada port default server.

---

## 📡 1. Siklus Broadcast State Server (Tick Rate)

Server menyiarkan seluruh snapshot koordinat posisi entitas dan status HP di dalam dunia game setiap **30 kali per detik (33.3ms per tick)**.

```
       [Client 1]                [Server Go]                [Client 2]
           |                          |                         |
           |-- 1. PlayerAttackRequest |                         |
           |   (Target: enemy_09)     |                         |
           |------------------------->|                         |
           |                          |-- 2. Proses Hit & DB    |
           |                          |   (GORM Transaction)    |
           |                          |                         |
           |                          |-- 3. Broadcast Snapshot |
           |                          |   (HP: 850/1000)        |
           |<-------------------------|------------------------>|
           |   (Spawn VFX critical)   |    (Spawn VFX critical) |
```

---

## 📦 2. Definisi Payload Paket Data (JSON Schema)

### A. Paket Client ke Server (C2S Packets)

#### 1. `STAT_ALLOCATE_REQUEST`

Dikirim oleh client saat pemain menekan tombol alokasi atribut di menu karakter:

```json
{
    "type": "STAT_ALLOCATE_REQUEST",
    "payload": {
        "stat_name": "str"
    }
}
```

- `stat_name` enum: `"str"`, `"agi"`, `"vit"`, `"int"`, `"dex"`, `"luk"`, `"pow"`, `"sta"`, `"wis"`, `"spl"`, `"con"`, `"crt"`.

#### 2. `PLAYER_ATTACK_REQUEST`

Dikirim oleh client saat melakukan auto-attack biasa:

```json
{
    "type": "PLAYER_ATTACK_REQUEST",
    "payload": {
        "target_id": "monster_goblin_99",
        "target_type": "monster",
        "client_damage": 182.5,
        "is_crit": false
    }
}
```

---

### B. Paket Server ke Client (S2C Packets)

#### 1. `GAME_STATE_UPDATE` (Broadcast Snapshot Per Tick)

Dikirim oleh server setiap 33ms untuk memperbarui kedudukan seluruh entitas aktif:

```json
{
    "type": "GAME_STATE_UPDATE",
    "payload": {
        "players": [
            {
                "id": "player_alex_01",
                "username": "Alex",
                "class": "Warrior",
                "x": 120.45,
                "y": 14.2,
                "z": -45.12,
                "rotation": 1.57,
                "animation": "Attack",
                "hp": 950.0,
                "max_hp": 1200.0,
                "aspd": 380.0,
                "level": 4,
                "gold": 1250
            }
        ],
        "monsters": [
            {
                "id": "monster_goblin_99",
                "name": "Goblin",
                "type": "goblin",
                "x": 121.1,
                "y": 14.2,
                "z": -44.8,
                "hp": 320.0,
                "max_hp": 500.0,
                "is_dead": false,
                "target_player_id": "player_alex_01",
                "animation": "Hit",
                "ai_state": "chasing"
            }
        ]
    }
}
```

#### 2. `COMBAT_DAMAGE_EVENT`

Dikirim seketika (_instant event_) saat kalkulasi damage terjadi untuk memicu trigger efek visual:

```json
{
    "type": "COMBAT_DAMAGE_EVENT",
    "payload": {
        "attacker_id": "player_alex_01",
        "target_id": "monster_goblin_99",
        "damage_dealt": 182.5,
        "is_crit": false,
        "is_miss": false,
        "effect_color": "#ff3333"
    }
}
```

#### 3. `PLAYER_LEVEL_UP`

Dikirim ke client penerima bersangkutan saat XP mencapai batas maksimum untuk memicu selebrasi grafis:

```json
{
    "type": "PLAYER_LEVEL_UP",
    "payload": {
        "player_id": "player_alex_01",
        "new_level": 5,
        "stat_points_added": 5,
        "talent_points_added": 0
    }
}
```

Dengan standarisasi antarmuka payload jaringan ini, integrasi multipemain game Anda dapat dikembangkan secara berkelanjutan tanpa resiko disorientasi data paket!

---

🏆 **Seluruh Lembar Wiki Selesai**: Kembali ke [Menu Utama Wiki](README.md) untuk meninjau peta navigasi arsitektur pertempuran game Anda secara penuh!

---

**📚 Dokumen Terkait**: [README.md](../../README.md) · [docs/Home.md](../../docs/Home.md) · [docs/Architecture.md](../../docs/Architecture.md) · [DONT_TOUCH.md](../../DONT_TOUCH.md)
