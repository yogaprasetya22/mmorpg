package postgres

import (
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"mmorpg-backend/pkg/config"
)

func NewPostgreSQLConnection(cfg *config.Config) *gorm.DB {
	// Format DSN according to config settings
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})

	if err != nil {
		log.Fatalf("Gagal terhubung ke PostgreSQL: %v", err)
	}

	// Configure Connection Pool
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(10)  // Minimum idle connections
		sqlDB.SetMaxOpenConns(100) // Maximum open connections
	}

	fmt.Printf("✅ Sukses terhubung ke database PostgreSQL (%s:%s)\n", cfg.DBHost, cfg.DBPort)
	return db
}
