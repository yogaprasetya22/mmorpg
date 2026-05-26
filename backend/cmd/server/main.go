package main

import (
	"context"
	"fmt"
	"log"

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
	fmt.Println("🚀 Starting MMORPG Real-Time Game Backend...")

	// 1. Load Configurations
	cfg := config.LoadConfig()

	// 2. Connect to PostgreSQL Database via GORM
	db := postgres.NewPostgreSQLConnection(cfg)

	// 3. Auto Migrate PostgreSQL Database schemas
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

	// 4. Connect to Redis Position State Caching
	rdb := redis.NewRedisClient(cfg)
	stateRepo := redis.NewStateRepository(rdb)

	// 5. Initialize Core Domain Registry (ECS) & Repositories
	registry := domain.NewRegistry()
	playerRepo := postgres.NewCachedUserRepository(db, rdb)
	userRepo := postgres.NewAccountRepository(db)
	configRepo := postgres.NewConfigRepository(db)

	// Initialize AuthUsecase early so we can pass it to both HTTP/WS handlers and KCP Server
	authUsecase := auth.NewAuthUsecase(playerRepo, userRepo, cfg.JWTSecret)

	// 6. Initialize Game Simulation Engine and WS Hub with circular dependency resolution
	var hub *ws.Hub
	var kcpServer *kcp.KCPServer
	
	// Create Game Usecase with a callback to broadcast game state payloads through the Hub & KCP
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

	// 7. Start WebSocket Hub thread
	go hub.Run()

	// Instantiate and Start KCP Server for fast real-time UDP position synchronization
	kcpServer = kcp.NewKCPServer(gameUsecase, authUsecase)
	go kcpServer.Start(":9999") // Bind KCP to UDP Port 9999

	// 8. Start Authoritative Real-Time Tick Loop (30Hz)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	
	go gameUsecase.StartGameLoop(ctx)
	fmt.Println("🕹️  Authoritative Fixed Tick Loop (30Hz) started.")

	// 9. Initialize Delivery Handlers
	authHandler := http.NewAuthHandler(authUsecase)
	wsHandler := ws.NewGameHandler(hub, authUsecase, playerRepo)
	configHandler := http.NewConfigHandler(configRepo, db)

	// 10. Setup Gin Router & Run Server
	router := http.SetupRouter(authHandler, wsHandler, configHandler)

	addr := ":" + cfg.Port
	fmt.Printf("🌐 Server is running and listening on port %s\n", addr)
	
	if err := router.Run(addr); err != nil {
		log.Fatalf("❌ Gagal menjalankan HTTP server: %v", err)
	}
}
