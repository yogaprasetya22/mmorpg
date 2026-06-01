package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"mmorpg-backend/internal/delivery/http"
	"mmorpg-backend/internal/delivery/kcp"
	"mmorpg-backend/internal/delivery/ws"
	"mmorpg-backend/internal/domain"
	"mmorpg-backend/internal/repository/postgres"
	"mmorpg-backend/internal/repository/redis"
	"mmorpg-backend/internal/usecase/auth"
	"mmorpg-backend/internal/usecase/game"
	"mmorpg-backend/pkg/config"
)

func main() {
	serviceType := os.Getenv("SERVICE_TYPE")
	if serviceType == "" {
		serviceType = "monolith"
	}
	fmt.Printf("🚀 Starting MMORPG Real-Time Game Backend in [%s] mode...\n", serviceType)

	// 1. Load Configurations
	cfg := config.LoadConfig()

	// 2. Connect to PostgreSQL Database via GORM
	db := postgres.NewPostgreSQLConnection(cfg)

	// In API or Monolith mode, perform auto migrations & seeding
	if serviceType == "monolith" || serviceType == "api" {
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
		)
		if err != nil {
			log.Fatalf("❌ Gagal melakukan auto-migrasi database: %v", err)
		}
		fmt.Println("💾 Database schemas auto-migrated successfully!")

		// Seed initial balance configurations if database tables are unpopulated
		if err := postgres.SeedConfigurations(db); err != nil {
			log.Fatalf("❌ Gagal melakukan seeding database: %v", err)
		}
	}

	// 4. Connect to Redis Position State Caching
	rdb := redis.NewRedisClient(cfg)
	stateRepo := redis.NewStateRepository(rdb)

	// 5. Initialize Repositories
	playerRepo := postgres.NewCachedUserRepository(db, rdb)
	userRepo := postgres.NewAccountRepository(db)
	configRepo := postgres.NewConfigRepository(db)

	authUsecase := auth.NewAuthUsecase(playerRepo, userRepo, cfg.JWTSecret)

	// 6. Branch according to serviceType
	if serviceType == "api" {
		authHandler := http.NewAuthHandler(authUsecase)
		configHandler := http.NewConfigHandler(configRepo, db)

		router := http.SetupAPIRouter(authHandler, configHandler)
		
		// Run API microservice on Port 8081 (default) or custom port
		port := os.Getenv("API_PORT")
		if port == "" {
			port = "8081"
		}
		addr := ":" + port
		fmt.Printf("🌐 API Microservice is running and listening on port %s\n", addr)
		if err := router.Run(addr); err != nil {
			log.Fatalf("❌ Gagal menjalankan API HTTP server: %v", err)
		}
		return
	}

	// For Monolith or Game mode, we run the ECS Engine & Websockets/KCP servers
	registry := domain.NewRegistry()

	var hub *ws.Hub
	var kcpServer *kcp.KCPServer

	gameUsecase := game.NewGameUsecase(
		registry,
		playerRepo,
		stateRepo,
		configRepo,
		func(payload domain.GameStatePayload) {
			if hub != nil {
				hub.BroadcastGameState(payload)
			}
			if kcpServer != nil {
				kcpServer.BroadcastGameState(payload)
			}
		},
	)

	// Instantiate WebSockets Hub
	hub = ws.NewHub(gameUsecase)
	go hub.Run()

	// Register event callback to broadcast raw combat events dynamically to the Hub
	gameUsecase.SetEventCallback(func(eventType string, data interface{}) {
		if hub != nil {
			hub.BroadcastGenericJSON(map[string]interface{}{
				"type":      eventType,
				"timestamp": time.Now().UnixNano() / int64(time.Millisecond),
				"data":      data,
			})
		}
	})

	// KCP Server for fast real-time UDP synchronization
	kcpServer = kcp.NewKCPServer(gameUsecase, authUsecase)
	kcpPort := os.Getenv("KCP_PORT")
	if kcpPort == "" {
		kcpPort = "9999"
	}
	go kcpServer.Start(":" + kcpPort)

	// Start Authoritative Real-Time Tick Loop (30Hz)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	
	go gameUsecase.StartGameLoop(ctx)
	fmt.Println("🕹️  Authoritative Fixed Tick Loop (30Hz) started.")

	wsHandler := ws.NewGameHandler(hub, authUsecase, playerRepo)

	var router *gin.Engine
	if serviceType == "game" {
		apiServiceURL := os.Getenv("API_SERVICE_URL")
		if apiServiceURL == "" {
			apiServiceURL = "http://localhost:8081"
		}
		fmt.Printf("🌉 Gateway active: transparently proxying API traffic to %s\n", apiServiceURL)
		router = http.SetupGameRouter(wsHandler, apiServiceURL)
	} else {
		// monolith mode
		authHandler := http.NewAuthHandler(authUsecase)
		configHandler := http.NewConfigHandler(configRepo, db)
		router = http.SetupRouter(authHandler, wsHandler, configHandler)
	}

	addr := ":" + cfg.Port
	fmt.Printf("🌐 Gateway & Game Service is running and listening on port %s\n", addr)
	
	if err := router.Run(addr); err != nil {
		log.Fatalf("❌ Gagal menjalankan HTTP server: %v", err)
	}
}
