package http

import (
	"log"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"mmorpg-backend/internal/delivery/ws"
)

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func SetupRouter(authHandler *AuthHandler, wsHandler *ws.GameHandler, configHandler *ConfigHandler) *gin.Engine {
	r := gin.New()
	
	// Add middlewares
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	r.Use(CORSMiddleware())

	// Public routes
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "healthy",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// Serve assets-model folder statically over HTTP from the backend
	r.Static("/assets-model", "./assets-model")

	// WebSocket Game Route
	r.GET("/ws", wsHandler.ServeWS)

	api := r.Group("/api")
	{
		api.GET("/initialize", authHandler.InitializeGame)

		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		// Character selection and creation
		api.GET("/player/characters", authHandler.ListCharacters)
		api.POST("/player/characters", authHandler.CreateCharacter)

		api.GET("/player/profile", wsHandler.ServeProfile)

		// Dynamic Balance Configurations
		api.GET("/config/classes", configHandler.GetClassConfigs)
		api.POST("/config/classes", configHandler.SaveClassConfig)
		api.GET("/config/settings", configHandler.GetSimulationSettings)
		api.POST("/config/settings", configHandler.SaveSimulationSettings)
		api.GET("/config/monsters", configHandler.GetMonsterConfigs)
		api.POST("/config/monsters", configHandler.SaveMonsterConfig)
		api.DELETE("/config/monsters/:type", configHandler.DeleteMonsterConfig)

		// Dynamic Map & Assets configurations
		api.GET("/config/assets", configHandler.GetAssetList)
		api.GET("/world-editor/maps", configHandler.ListMaps)
		api.GET("/world-editor/load", configHandler.LoadMap)
		api.POST("/world-editor/save", configHandler.SaveMap)
		api.DELETE("/world-editor/delete", configHandler.DeleteMap)
		api.POST("/world-editor/ai-generate", configHandler.AIGenerateEnvironment)

		// Authoritative Game Endpoints (Resolved by Backend)
		api.POST("/game/spawn-resolve", configHandler.ResolveSpawn)
		api.POST("/game/kill-event", configHandler.RegisterKillEvent)
	}

	return r
}

// SetupAPIRouter configures the HTTP routes exclusively for the API Microservice
func SetupAPIRouter(authHandler *AuthHandler, configHandler *ConfigHandler) *gin.Engine {
	r := gin.New()
	
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	r.Use(CORSMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "healthy_api",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	r.Static("/assets-model", "./assets-model")

	api := r.Group("/api")
	{
		api.GET("/initialize", authHandler.InitializeGame)

		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		api.GET("/player/characters", authHandler.ListCharacters)
		api.POST("/player/characters", authHandler.CreateCharacter)

		api.GET("/config/classes", configHandler.GetClassConfigs)
		api.POST("/config/classes", configHandler.SaveClassConfig)
		api.GET("/config/settings", configHandler.GetSimulationSettings)
		api.POST("/config/settings", configHandler.SaveSimulationSettings)
		api.GET("/config/monsters", configHandler.GetMonsterConfigs)
		api.POST("/config/monsters", configHandler.SaveMonsterConfig)
		api.DELETE("/config/monsters/:type", configHandler.DeleteMonsterConfig)

		api.GET("/config/assets", configHandler.GetAssetList)
		api.GET("/world-editor/maps", configHandler.ListMaps)
		api.GET("/world-editor/load", configHandler.LoadMap)
		api.POST("/world-editor/save", configHandler.SaveMap)
		api.DELETE("/world-editor/delete", configHandler.DeleteMap)
		api.POST("/world-editor/ai-generate", configHandler.AIGenerateEnvironment)

		api.POST("/game/spawn-resolve", configHandler.ResolveSpawn)
		api.POST("/game/kill-event", configHandler.RegisterKillEvent)
	}

	return r
}

// SetupGameRouter configures the WebSocket sync engine and transparently proxies other requests
func SetupGameRouter(wsHandler *ws.GameHandler, apiServiceURL string) *gin.Engine {
	r := gin.New()
	
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "healthy_game",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// Configure proxy for all database/config queries to transparently flow to the API Service
	target, err := url.Parse(apiServiceURL)
	if err != nil {
		log.Printf("❌ Invalid API Service URL for gateway reverse proxy: %v", err)
	} else {
		proxy := httputil.NewSingleHostReverseProxy(target)
		r.Use(func(c *gin.Context) {
			path := c.Request.URL.Path
			// Handled natively by this service
			if path == "/ws" || path == "/api/player/profile" || path == "/health" {
				c.Next()
				return
			}
			// Forward seamlessly to the API microservice
			c.Request.Host = target.Host
			proxy.ServeHTTP(c.Writer, c.Request)
			c.Abort()
		})
	}

	// Real-Time WS Sync
	r.GET("/ws", CORSMiddleware(), wsHandler.ServeWS)

	api := r.Group("/api")
	api.Use(CORSMiddleware())
	{
		api.GET("/player/profile", wsHandler.ServeProfile)
	}

	return r
}
