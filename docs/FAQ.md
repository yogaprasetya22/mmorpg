# FAQ

## Apa itu Jagres: Battle Simulator?

Jagres adalah simulasi pertarungan 3D multipemain berbasis web. Pemain bisa bertarung melawan monster, naik level, mengganti kelas, dan membangun peta sendiri.

## Apakah harus punya akun?

Ya. Pendaftaran gratis — cukup username, password, dan pilih nama karakter.

## Berapa banyak pemain dalam satu arena?

Tidak ada batas tetap. Server bisa menangani 50-100+ pemain tergantung resource. Setiap pemain melihat semua pemain lain dan monster di arena yang sama.

## Bagaimana sistem kelas bekerja?

Setiap pemain mulai sebagai Beginner. Setelah level tertentu, bisa pilih kelas:

- **Warrior**: tank dengan pertahanan tinggi
- **Mage**: AoE damage dengan element
- **Archer**: critical, range, poison
- **Assassin**: burst damage, stealth
- **Priest**: heal dan support

Pergantian kelas bisa dilakukan kapan saja.

## Apa itu World Editor?

World Editor (Map Studio) adalah editor peta 3D di browser. Pemain bisa:

- Menempatkan objek (pohon, batu, bangunan)
- Mengubah tinggi terrain
- Menyemprot vegetasi
- Paint texture ke terrain

Hasil editan bisa di-save dan di-load kembali.

## Browser apa yang didukung?

| Browser         | Support                    |
| --------------- | -------------------------- |
| Chrome (≥ 120)  | ✅ Optimal                 |
| Firefox (≥ 120) | ✅                         |
| Edge (≥ 120)    | ✅                         |
| Safari (≥ 17)   | ⚠️ Mungkin ada issue WebGL |

## Apakah ada versi mobile?

Belum ada. UI belum responsif untuk layar kecil. Ini di roadmap.

## Bagaimana cara berkontribusi?

Lihat [Panduan Development](Development-Guide.md). Fork repo, buat branch, commit dengan conventional commit, buka PR.

## Stack teknologi apa yang dipakai?

- **Frontend**: Next.js 16, React 19, Three.js, React Three Fiber
- **Backend**: Go 1.25, Gin, WebSocket, donburi (ECS)
- **Database**: PostgreSQL, Redis
- **Serialisasi**: MessagePack

## Apakah ada plan untuk Steam atau desktop?

Ya — Tauri build ada di roadmap untuk release desktop.

## Proyek ini pakai lisensi apa?

MIT License.

---

## Related Docs

- [README.md](../README.md) — Gambaran proyek
- [🚨 DONT_TOUCH.md](../DONT_TOUCH.md) — Zona kritis performa
- [🏗️ Arsitektur](Architecture.md) — Struktur kode
- [Wiki Arsitektur Detail](../wiki/architecture/README.md) — Deep architecture
