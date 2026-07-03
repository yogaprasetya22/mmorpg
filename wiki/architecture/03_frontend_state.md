# 03. Frontend Client State & WebSocket Allocation

> **Tujuan**: Membangun panel antarmuka alokasi stat baru (POW, STA, WIS, SPL, CON, CRT) dan menyinkronkan data atribut menggunakan paket payload WebSocket real-time.

Sisi client game MMORPG Anda berjalan menggunakan kerangka kerja **React/Next.js/TSX**. Pada tahap ketiga ini, kita akan merancang UI karakter yang dinamis untuk menambahkan poin stat baru dan mengirimkannya ke server game.

---

## 🛠️ Langkah Demi Langkah (Step-by-Step)

### Langkah 1: Memperbarui State Management Lokal (`src/state/useStore.ts`)

Buka file state utama client Anda (`@[frontend/src/state/useStore.ts]`). Kita harus memastikan model data pemain di client mengenali variabel Talent Stats baru.

Tambahkan interface property baru pada `PlayerStats` di client:

```typescript
export interface PlayerStats {
    level: number;
    xp: number;
    gold: number;
    base_str: number;
    base_agi: number;
    base_vit: number;
    base_int: number;
    base_dex: number;
    base_luk: number;

    // TAHAP 3: TALENT STATS
    base_pow: number;
    base_sta: number;
    base_wis: number;
    base_spl: number;
    base_con: number;
    base_crt: number;
    talent_points: number;

    // Amplified Substats
    p_atk: number;
    s_matk: number;
    res: number;
    m_res: number;
    h_plus: number;
    c_rate: number;
}
```

---

### Langkah 2: Merancang UI Allocation Panel (`src/components/ui/StatAllocationPanel.tsx`)

Buat sebuah komponen UI baru bernama `StatAllocationPanel.tsx` untuk menangani tombol alokasi stat primer dan sekunder. Gunakan gaya premium modern gelap dengan aksen bersinar (_glassmorphism style_):

```tsx
import React from "react";

interface StatRowProps {
    name: string;
    value: number;
    onAllocate: () => void;
    disabled: boolean;
}

const StatRow: React.FC<StatRowProps> = ({
    name,
    value,
    onAllocate,
    disabled,
}) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-800">
        <span className="font-bold text-gray-300 tracking-wide">{name}</span>
        <div className="flex items-center gap-3">
            <span className="text-xl font-extrabold text-white font-mono">
                {value}
            </span>
            <button
                onClick={onAllocate}
                disabled={disabled}
                className="w-7 h-7 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 text-black font-black rounded cursor-pointer transition-all active:scale-95"
            >
                +
            </button>
        </div>
    </div>
);

export const StatAllocationPanel: React.FC<{
    playerStats: any;
    onSendAllocation: (stat: string) => void;
}> = ({ playerStats, onSendAllocation }) => {
    const statPoints = playerStats?.stat_points ?? 0;
    const talentPoints = playerStats?.talent_points ?? 0;

    return (
        <div className="w-80 p-5 rounded-2xl bg-black/80 backdrop-blur-md border border-gray-800 shadow-2xl">
            {/* HEADER SECTION */}
            <h2 className="text-lg font-black tracking-tight text-white mb-4 border-b border-gray-700 pb-2">
                CHARACTER ATTRIBUTES
            </h2>

            {/* CORE STAT POINTS */}
            <div className="mb-6">
                <div className="text-xs font-semibold text-emerald-400 mb-2">
                    Available Stat Points:{" "}
                    <span className="font-bold font-mono text-sm">
                        {statPoints}
                    </span>
                </div>
                <StatRow
                    name="Strength (STR)"
                    value={playerStats?.base_str ?? 10}
                    onAllocate={() => onSendAllocation("str")}
                    disabled={statPoints <= 0}
                />
                <StatRow
                    name="Agility (AGI)"
                    value={playerStats?.base_agi ?? 10}
                    onAllocate={() => onSendAllocation("agi")}
                    disabled={statPoints <= 0}
                />
                <StatRow
                    name="Vitality (VIT)"
                    value={playerStats?.base_vit ?? 10}
                    onAllocate={() => onSendAllocation("vit")}
                    disabled={statPoints <= 0}
                />
                <StatRow
                    name="Intelligence (INT)"
                    value={playerStats?.base_int ?? 10}
                    onAllocate={() => onSendAllocation("int")}
                    disabled={statPoints <= 0}
                />
                <StatRow
                    name="Dexterity (DEX)"
                    value={playerStats?.base_dex ?? 10}
                    onAllocate={() => onSendAllocation("dex")}
                    disabled={statPoints <= 0}
                />
                <StatRow
                    name="Luck (LUK)"
                    value={playerStats?.base_luk ?? 10}
                    onAllocate={() => onSendAllocation("luk")}
                    disabled={statPoints <= 0}
                />
            </div>

            {/* TALENT STAT POINTS */}
            <div>
                <div className="text-xs font-semibold text-purple-400 mb-2">
                    Available Talent Points:{" "}
                    <span className="font-bold font-mono text-sm">
                        {talentPoints}
                    </span>
                </div>
                <StatRow
                    name="Power (POW)"
                    value={playerStats?.base_pow ?? 0}
                    onAllocate={() => onSendAllocation("pow")}
                    disabled={talentPoints <= 0}
                />
                <StatRow
                    name="Stamina (STA)"
                    value={playerStats?.base_sta ?? 0}
                    onAllocate={() => onSendAllocation("sta")}
                    disabled={talentPoints <= 0}
                />
                <StatRow
                    name="Wisdom (WIS)"
                    value={playerStats?.base_wis ?? 0}
                    onAllocate={() => onSendAllocation("wis")}
                    disabled={talentPoints <= 0}
                />
                <StatRow
                    name="Spell (SPL)"
                    value={playerStats?.base_spl ?? 0}
                    onAllocate={() => onSendAllocation("spl")}
                    disabled={talentPoints <= 0}
                />
                <StatRow
                    name="Concentration (CON)"
                    value={playerStats?.base_con ?? 0}
                    onAllocate={() => onSendAllocation("con")}
                    disabled={talentPoints <= 0}
                />
                <StatRow
                    name="Creative (CRT)"
                    value={playerStats?.base_crt ?? 0}
                    onAllocate={() => onSendAllocation("crt")}
                    disabled={talentPoints <= 0}
                />
            </div>
        </div>
    );
};
```

---

### Langkah 3: Mengirim Payload WebSocket untuk Alokasi Stat

Ketika pemain menekan tombol `+` pada panel, client harus mengirim paket WebSocket yang berisi permintaan penambahan poin statistik dasar/talent secara real-time.

Hubungkan method `onSendAllocation` ke client-network handler Anda:

```typescript
const handleStatAllocation = (targetStat: string) => {
    if (
        websocketConnection &&
        websocketConnection.readyState === WebSocket.OPEN
    ) {
        const payload = {
            type: "STAT_ALLOCATE_REQUEST",
            payload: {
                stat_name: targetStat, // "str" | "pow" | "con" etc.
            },
        };
        websocketConnection.send(JSON.stringify(payload));
    }
};
```

---

### Langkah 4: Menangani Payload Otoritatif di Sisi Server (`game_handler.go`)

Di sisi backend Go, file `@[backend/internal/delivery/ws/game_handler.go]` bertindak menangani parsing websocket packet JSON.

Tambahkan logika case baru untuk memproses permintaan `STAT_ALLOCATE_REQUEST`:

```go
case "STAT_ALLOCATE_REQUEST":
    var req struct {
        StatName string `json:"stat_name"`
    }
    if err := json.Unmarshal(msg.Payload, &req); err != nil {
        return
    }

    u.activePlayersMu.Lock()
    player, exists := u.activePlayers[playerID]
    if exists && player != nil {
        // Logika alokasi stat primer
        if player.StatPoints > 0 {
            switch req.StatName {
            case "str": player.BaseSTR++; player.StatPoints--
            case "agi": player.BaseAGI++; player.StatPoints--
            case "vit": player.BaseVIT++; player.StatPoints--
            case "int": player.BaseINT++; player.StatPoints--
            case "dex": player.BaseDEX++; player.StatPoints--
            case "luk": player.BaseLUK++; player.StatPoints--
            }
        }

        // Logika alokasi talent stats
        if player.TalentPoints > 0 {
            switch req.StatName {
            case "pow": player.BasePOW++; player.TalentPoints--
            case "sta": player.BaseSTA++; player.TalentPoints--
            case "wis": player.BaseWIS++; player.TalentPoints--
            case "spl": player.BaseSPL++; player.TalentPoints--
            case "con": player.BaseCON++; player.TalentPoints--
            case "crt": player.BaseCRT++; player.TalentPoints--
            }
        }

        // Selalu hitung ulang semua derived combat stats secara real-time
        player.RecalculateStats()
    }
    u.activePlayersMu.Unlock()
```

Dengan langkah di atas, sinkronisasi state statistik dua arah antara client dan server berjalan mulus dan aman!

---

➡️ **Langkah Berikutnya**: Lanjutkan ke [Tahap 4: Frontend Combat UI & VFX](04_frontend_combat_ui.md) untuk menyinkronkan kecepatan animasi serang ASPD dan rendering progress bar casting terpisah!

---

**📚 Dokumen Terkait**: [README.md](../../README.md) · [docs/Home.md](../../docs/Home.md) · [docs/Architecture.md](../../docs/Architecture.md) · [DONT_TOUCH.md](../../DONT_TOUCH.md)
