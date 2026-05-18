package http

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"mmorpg-backend/internal/usecase/auth"
)

type AuthHandler struct {
	authUsecase auth.AuthUsecase
}

func NewAuthHandler(authUsecase auth.AuthUsecase) *AuthHandler {
	return &AuthHandler{
		authUsecase: authUsecase,
	}
}

func (h *AuthHandler) GetUserIDFromToken(c *gin.Context) (string, bool) {
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
		return "", false
	}

	userID, err := h.authUsecase.ValidateToken(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid: " + err.Error()})
		return "", false
	}

	return userID, true
}

func (h *AuthHandler) Register(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	user, err := h.authUsecase.Register(input.Username, input.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Registrasi akun berhasil",
		"user":    user,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	token, user, err := h.authUsecase.Login(input.Username, input.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login berhasil",
		"token":   token,
		"user":    user,
	})
}

func (h *AuthHandler) ListCharacters(c *gin.Context) {
	userID, ok := h.GetUserIDFromToken(c)
	if !ok {
		return
	}

	characters, err := h.authUsecase.GetCharacters(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"characters": characters,
	})
}

func (h *AuthHandler) CreateCharacter(c *gin.Context) {
	userID, ok := h.GetUserIDFromToken(c)
	if !ok {
		return
	}

	var input struct {
		Name      string `json:"name" binding:"required"`
		Class     string `json:"class" binding:"required"`
		Gender    string `json:"gender" binding:"required"`
		HairStyle int    `json:"hair_style" binding:"required"`
		HairColor string `json:"hair_color" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	player, err := h.authUsecase.CreateCharacter(userID, input.Name, input.Class, input.Gender, input.HairStyle, input.HairColor)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Karakter berhasil dibuat",
		"player":  player,
	})
}

func (h *AuthHandler) InitializeGame(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"classes":     []string{"Beginner", "Warrior", "Mage", "Priest", "Thief"},
		"genders":     []string{"Male", "Female"},
		"hair_styles": []int{1, 2, 3},
		"hair_colors": []string{"#5A3E2D", "#C8B195", "#A64B2A", "#1F2937", "#3B82F6", "#EAB308", "#10B981"},
		"character_models": gin.H{
			"Male": gin.H{
				"Beginner": "/assets-model/Chef_Male.glb",
				"Warrior":  "/assets-model/Knight_Golden_Male.glb",
				"Mage":     "/assets-model/Wizard.glb",
				"Priest":   "/assets-model/Viking_Male.glb",
				"Thief":    "/assets-model/Ninja_Male.glb",
			},
			"Female": gin.H{
				"Beginner": "/assets-model/Chef_Female.glb",
				"Warrior":  "/assets-model/Knight_Golden_Female.glb",
				"Mage":     "/assets-model/Witch.glb",
				"Priest":   "/assets-model/Viking_Female.glb",
				"Thief":    "/assets-model/Ninja_Female.glb",
			},
		},
		"monster_models": gin.H{
			"goblin_male":   "/assets-model/Goblin_Male.glb",
			"goblin_female": "/assets-model/Goblin_Female.glb",
			"zombie_male":   "/assets-model/Zombie_Male.glb",
			"zombie_female": "/assets-model/Zombie_Female.glb",
		},
	})
}
