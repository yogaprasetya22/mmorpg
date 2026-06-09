package main

import (
    "fmt"
    "log"

    "mmorpg-backend/internal/domain"
    "mmorpg-backend/internal/repository/postgres"
    "mmorpg-backend/pkg/config"
)

func main() {
    fmt.Println("🌱 Initializing Standalone Monster Seeder...")

    // 1. Load Database Configurations
    cfg := config.LoadConfig()

    // 2. Connect to GORM PostgreSQL
    db := postgres.NewPostgreSQLConnection(cfg)

    // 3. Drop all tables CASCADE to ensure zero remnants of deprecated columns & schemas
    fmt.Println("🧹 Dropping all existing database tables CASCADE for a 100% clean Ragnarok schema...")
    tables := []string{
        "player_skills",
        "player_quests",
        "player_items",
        "players",
        "users",
        "monster_configs",
        "simulation_settings",
        "class_configs",
        "map_configs",
        "map_items",
        "assets",
        "avatar_categories", // 👈 Tambahkan ini agar bersih total saat re-seed
        "avatar_assets",     // 👈 Tambahkan ini agar bersih total saat re-seed
    }
    for _, table := range tables {
        if err := db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s CASCADE", table)).Error; err != nil {
            log.Fatalf("❌ Gagal membersihkan tabel %s: %v", table, err)
        }
    }
    fmt.Println("✨ Database purged of all legacy fields.")

    // 4. Force safe schema AutoMigrate clean rebuild
    fmt.Println("🏗️  Rebuilding pristine iRO Stats schemas...")
    err := db.AutoMigrate(
        &domain.User{},
        &domain.Player{},
        &domain.PlayerItem{},
        &domain.PlayerSkill{},
        &domain.PlayerQuest{},
        &domain.ClassConfig{},
        &domain.SimulationSetting{},
        &domain.MonsterConfig{},
        &domain.MapConfig{},
        &domain.MapItem{},
        &domain.Asset{},
        &domain.AvatarCategory{}, // 👈 Daftarkan struct Category ke GORM
        &domain.AvatarAsset{},    // 👈 Daftarkan struct Asset ke GORM (sesuaikan dengan nama di domain)
    )
    if err != nil {
        log.Fatalf("❌ Gagal melakukan auto-migrasi skema bersih: %v", err)
    }

    // 5. Trigger database configurations seed
    if err := postgres.SeedConfigurations(db); err != nil {
        log.Fatalf("❌ Gagal melakukan seeding database konfigurasi: %v", err)
    }

    // 6. Trigger avatar configurator data seed
    if err := postgres.SeedAvatarData(db); err != nil {
        log.Fatalf("❌ Gagal melakukan seeding avatar data: %v", err)
    }

    fmt.Println("🚀 Seeding musuh dan avatar baru selesai dengan SUKSES! Database 100% bersih dan selaras dengan iRO Stats.")
}