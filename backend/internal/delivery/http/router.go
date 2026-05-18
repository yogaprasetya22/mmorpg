package http

import (
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

		// Authoritative Game Endpoints (Resolved by Backend)
		api.POST("/game/spawn-resolve", configHandler.ResolveSpawn)
		api.POST("/game/kill-event", configHandler.RegisterKillEvent)
	}

	return r
}
