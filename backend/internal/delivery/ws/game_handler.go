package ws

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"mmorpg-backend/internal/domain"
	"mmorpg-backend/internal/usecase/auth"
)

type GameHandler struct {
	hub         *Hub
	authUsecase auth.AuthUsecase
	playerRepo  domain.PlayerRepository
}

func NewGameHandler(hub *Hub, authUsecase auth.AuthUsecase, playerRepo domain.PlayerRepository) *GameHandler {
	return &GameHandler{
		hub:         hub,
		authUsecase: authUsecase,
		playerRepo:  playerRepo,
	}
}

func (h *GameHandler) ServeProfile(c *gin.Context) {
	tokenStr := c.Query("token")
	if tokenStr == "" {
		authHeader := c.GetHeader("Authorization")
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tokenStr = authHeader[7:]
		} else {
			tokenStr = authHeader
		}
	}
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak ditemukan"})
		return
	}

	userID, err := h.authUsecase.ValidateToken(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid: " + err.Error()})
		return
	}

	characterID := c.Query("character_id")
	if characterID == "" {
		// Fallback to first character if not specified
		chars, err := h.playerRepo.GetByUserID(userID)
		if err != nil || len(chars) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Karakter tidak ditemukan"})
			return
		}
		characterID = chars[0].ID
	}

	player, err := h.playerRepo.GetByID(characterID)
	if err != nil || player == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Karakter pemain tidak ditemukan"})
		return
	}

	if player.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Karakter bukan milik Anda"})
		return
	}

	// Always recalculate derived stats before serving the profile
	player.RecalculateStats()

	c.JSON(http.StatusOK, gin.H{
		"player": player,
	})
}

func (h *GameHandler) ServeWS(c *gin.Context) {
	// 1. Authenticate WebSocket connection via token parameter
	tokenStr := c.Query("token")
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token query parameter is required"})
		return
	}

	userID, err := h.authUsecase.ValidateToken(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid: " + err.Error()})
		return
	}

	characterID := c.Query("character_id")
	if characterID == "" {
		// Fallback to first character
		chars, err := h.playerRepo.GetByUserID(userID)
		if err != nil || len(chars) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "character_id is required"})
			return
		}
		characterID = chars[0].ID
	}

	// 2. Fetch player identity details from postgres repository
	player, err := h.playerRepo.GetByID(characterID)
	if err != nil || player == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Karakter pemain tidak ditemukan"})
		return
	}

	if player.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Karakter bukan milik Anda"})
		return
	}

	// 3. Upgrade connection to websocket protocol
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Printf("⚠️ Gagal meng-upgrade WebSocket: %v\n", err)
		return
	}

	client := &Client{
		Hub:      h.hub,
		Conn:     conn,
		Send:     make(chan []byte, sendBufSize),
		PlayerID: player.ID,
		Username: player.Username,
	}

	// Send to Hub register queue
	h.hub.Register <- client

	// Start reading and writing loops in background goroutines
	go client.WritePump()
	go client.ReadPump()

	fmt.Printf("🔌 WebSocket connection established for Player character: %s (%s)\n", player.Username, player.ID)
}
