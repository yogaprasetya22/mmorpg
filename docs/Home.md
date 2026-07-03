# Selamat Datang di Jagres Battle Simulator

**Jagres** adalah simulasi pertarungan 3D multipemain berbasis browser. Pemain bisa bertarung melawan monster secara real-time, meningkatkan karakter, dan membangun peta sendiri menggunakan editor 3D di dalam browser.

## Mulai Cepat

1. Ikuti panduan [Memulai](Getting-Started.md)
2. Baca [Arsitektur](Architecture.md) untuk memahami struktur kode
3. Lihat [Panduan Fitur](Gameplay-or-Feature-Guide.md) untuk gameplay

## Navigasi Wiki

| Halaman                                          | Isi                                |
| ------------------------------------------------ | ---------------------------------- |
| [🏠 Home](Home.md)                               | Halaman ini                        |
| [🏗️ Arsitektur](Architecture.md)                 | Struktur kode, ECS, data flow      |
| [🚀 Memulai](Getting-Started.md)                 | Instalasi, development, production |
| [🎮 Panduan Fitur](Gameplay-or-Feature-Guide.md) | Arena, World Editor, Avatar        |
| [🛠️ Panduan Development](Development-Guide.md)   | Coding convention, testing, tips   |
| [🔍 Troubleshooting](Troubleshooting.md)         | Masalah umum & solusi              |
| [❓ FAQ](FAQ.md)                                 | Pertanyaan umum                    |

## Teknologi Utama

| Lapisan     | Teknologi                                 |
| ----------- | ----------------------------------------- |
| Frontend    | Next.js 16 + React 19 + Three.js (R3F)    |
| Backend     | Go 1.25 + Gin + WebSocket + ECS (donburi) |
| Database    | PostgreSQL (GORM) + Redis                 |
| State       | Zustand (frontend)                        |
| Serialisasi | MessagePack (WebSocket)                   |

## Navigasi Cepat AI

AI agent harus baca **keempat hub** untuk konteks penuh:

- [📖 README.md](../README.md) — Gambaran proyek, setup, key files
- [🚨 DONT_TOUCH.md](../DONT_TOUCH.md) — 26 zona kritis performa & keamanan
- [🏛️ Wiki Arsitektur](../wiki/architecture/README.md) — Deep architecture untuk AI codegen

## Repo di GitHub

[https://github.com/your-org/mmorpg](https://github.com/your-org/mmorpg)
