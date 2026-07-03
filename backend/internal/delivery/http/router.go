package http

import (
	"log"
	"net/http/httputil"
	"net/url"
	"time"

	"mmorpg-backend/internal/delivery/ws"
	"mmorpg-backend/internal/repository/postgres"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gorm.io/gorm"
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

// RequireAuth returns a Gin middleware that validates JWT tokens for admin/config endpoints
func RequireAuth(authHandler *AuthHandler) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, ok := authHandler.GetUserIDFromToken(c)
		if !ok {
			c.Abort()
			return
		}
		c.Next()
	}
}

func SetupRouter(authHandler *AuthHandler, wsHandler *ws.GameHandler, configHandler *ConfigHandler, db ...*gorm.DB) *gin.Engine {
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

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Serve assets folder statically over HTTP from the backend
	r.Static("/assets", "./assets")
	r.Static("/assets-model", "./assets/characters/npcs")

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

		// Dynamic Balance Configurations (READ: public, WRITE: authenticated)
		api.GET("/config/classes", configHandler.GetClassConfigs)
		api.GET("/config/settings", configHandler.GetSimulationSettings)
		api.GET("/config/monsters", configHandler.GetMonsterConfigs)
		api.GET("/config/assets", configHandler.GetAssetList)

		// Authenticated admin routes for config mutations
		admin := api.Group("/", RequireAuth(authHandler))
		{
			admin.POST("/config/classes", configHandler.SaveClassConfig)
			admin.POST("/config/settings", configHandler.SaveSimulationSettings)
			admin.POST("/config/monsters", configHandler.SaveMonsterConfig)
			admin.DELETE("/config/monsters/:type", configHandler.DeleteMonsterConfig)
		}
		api.GET("/world-editor/maps", configHandler.ListMaps)
		api.GET("/world-editor/load", configHandler.LoadMap)
		api.POST("/world-editor/save", configHandler.SaveMap)
		api.DELETE("/world-editor/delete", configHandler.DeleteMap)
		api.POST("/world-editor/ai-generate", configHandler.AIGenerateEnvironment)

		// Authoritative Game Endpoints (Resolved by Backend)
		api.POST("/game/spawn-resolve", configHandler.ResolveSpawn)
		api.POST("/game/kill-event", configHandler.RegisterKillEvent)

		// Avatar Configurator Endpoints
		if len(db) > 0 && db[0] != nil {
			avatar := api.Group("/avatar")
			{
				avatar.GET("/categories", postgres.GetAvatarCategories(db[0]))
				avatar.GET("/assets", postgres.GetAvatarAssets(db[0]))
			}
		}
	}

	return r
}

// SetupAPIRouter configures the HTTP routes exclusively for the API Microservice
func SetupAPIRouter(authHandler *AuthHandler, configHandler *ConfigHandler, db ...*gorm.DB) *gin.Engine {
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

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	r.Static("/assets", "./assets")
	r.Static("/assets-model", "./assets/characters/npcs")

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

		// Avatar Configurator Endpoints
		if len(db) > 0 && db[0] != nil {
			avatar := api.Group("/avatar")
			{
				avatar.GET("/categories", postgres.GetAvatarCategories(db[0]))
				avatar.GET("/assets", postgres.GetAvatarAssets(db[0]))
			}
		}
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

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

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
