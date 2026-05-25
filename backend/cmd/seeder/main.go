package main

import (
	"fmt"
	"log"

	"gorm.io/gorm"
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

	// 3. Safe delete existing configurations to force fresh re-seeding
	fmt.Println("🧹 Clearing existing configurations from PostgreSQL...")
	if err := db.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&domain.MonsterConfig{}).Error; err != nil {
		log.Fatalf("❌ Gagal membersihkan monster_configs lama: %v", err)
	}
	if err := db.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&domain.SimulationSetting{}).Error; err != nil {
		log.Fatalf("❌ Gagal membersihkan simulation_settings lama: %v", err)
	}
	if err := db.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&domain.ClassConfig{}).Error; err != nil {
		log.Fatalf("❌ Gagal membersihkan class_configs lama: %v", err)
	}

	// 4. Trigger database configurations seed
	if err := postgres.SeedConfigurations(db); err != nil {
		log.Fatalf("❌ Gagal melakukan seeding database: %v", err)
	}

	fmt.Println("🚀 Seeding musuh baru yang bervariasi selesai dengan SUKSES!")
}
