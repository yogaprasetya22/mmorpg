package http

import (
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"mmorpg-backend/internal/domain"
)

type ConfigHandler struct {
	configRepo domain.ConfigRepository
}

func NewConfigHandler(configRepo domain.ConfigRepository) *ConfigHandler {
	return &ConfigHandler{
		configRepo: configRepo,
	}
}

func (h *ConfigHandler) GetClassConfigs(c *gin.Context) {
	cfgs, err := h.configRepo.GetClassConfigs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data konfigurasi kelas: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfgs)
}

func (h *ConfigHandler) SaveClassConfig(c *gin.Context) {
	var input domain.ClassConfig
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	if err := h.configRepo.SaveClassConfig(&input); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan konfigurasi kelas: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Konfigurasi kelas berhasil disimpan",
		"config":  input,
	})
}

func (h *ConfigHandler) GetSimulationSettings(c *gin.Context) {
	cfg, err := h.configRepo.GetSimulationSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data pengaturan simulasi: " + err.Error()})
		return
	}
	if cfg == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pengaturan simulasi default belum diset"})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *ConfigHandler) SaveSimulationSettings(c *gin.Context) {
	var input domain.SimulationSetting
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	if err := h.configRepo.SaveSimulationSettings(&input); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan pengaturan simulasi: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Pengaturan simulasi berhasil disimpan",
		"config":  input,
	})
}

// SpawnRequest defines the query body for resolving unit spawns on the server
type SpawnRequest struct {
	Type         string `json:"type"`
	IsBoss       bool   `json:"is_boss"`
	ForcedClass  string `json:"forced_class"`
	ForcedRarity string `json:"forced_rarity"`
}

// SpawnResponse defines the response returned for a resolved unit spawn
type SpawnResponse struct {
	UnitClass string `json:"unit_class"`
	Rarity    string `json:"rarity"`
}

func pickWeightedRandom(items []string, weights []int) string {
	totalWeight := 0
	for _, w := range weights {
		totalWeight += w
	}
	if totalWeight <= 0 {
		return items[0]
	}
	// Seeded in init() or main()
	r := rand.Intn(totalWeight)
	currentSum := 0
	for i, w := range weights {
		currentSum += w
		if r < currentSum {
			return items[i]
		}
	}
	return items[0]
}

// ResolveSpawn resolves unit classes and rarities authoritative on the backend
func (h *ConfigHandler) ResolveSpawn(c *gin.Context) {
	var req SpawnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spawn request body: " + err.Error()})
		return
	}

	var unitClass string
	if req.ForcedClass != "" {
		unitClass = req.ForcedClass
	} else if req.Type == "enemy" {
		if req.IsBoss {
			unitClass = "enemy_boss"
		} else {
			unitClass = "enemy_grunt"
		}
	} else {
		// Player classes weighted distribution: fighter (35%), tank (35%), assassin (7%), marksman (11%), mage (12%)
		classes := []string{"fighter", "tank", "assassin", "marksman", "mage"}
		weights := []int{35, 35, 7, 11, 12}
		unitClass = pickWeightedRandom(classes, weights)
	}

	var rarity string
	if req.ForcedRarity != "" {
		rarity = req.ForcedRarity
	} else {
		// Common (95%), Elite (5%)
		rarities := []string{"common", "elite"}
		weights := []int{95, 5}
		rarity = pickWeightedRandom(rarities, weights)
	}

	// Force player to never be epic/legendary
	if req.Type == "player" && (rarity == "epic" || rarity == "legendary") {
		rarity = "elite"
	}

	c.JSON(http.StatusOK, SpawnResponse{
		UnitClass: unitClass,
		Rarity:    rarity,
	})
}

// KillEventRequest defines the authoritative kill event structure sent by the client simulation
type KillEventRequest struct {
	Killer       string `json:"killer"`
	Victim       string `json:"victim"`
	VictimType   string `json:"victim_type"`
	ProfileImage string `json:"profile_image"`
	Rarity       string `json:"rarity"`
}

// RegisterKillEvent handles and logs game simulation kill events centrally on the backend
func (h *ConfigHandler) RegisterKillEvent(c *gin.Context) {
	var req KillEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid kill event request body: " + err.Error()})
		return
	}

	// Centrally log/process authoritative kill event
	fmt.Printf("☠️ [AUTHORITATIVE KILL] %s (%s) was defeated by %s! Class Rarity: %s\n", req.Victim, req.VictimType, req.Killer, req.Rarity)

	c.JSON(http.StatusOK, gin.H{
		"status":    "logged",
		"timestamp": time.Now().Unix(),
	})
}

func (h *ConfigHandler) GetMonsterConfigs(c *gin.Context) {
	cfgs, err := h.configRepo.GetMonsterConfigs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data konfigurasi monster: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfgs)
}

func (h *ConfigHandler) SaveMonsterConfig(c *gin.Context) {
	var input domain.MonsterConfig
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid: " + err.Error()})
		return
	}

	if err := h.configRepo.SaveMonsterConfig(&input); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan konfigurasi monster: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Konfigurasi monster berhasil disimpan",
		"config":  input,
	})
}

func (h *ConfigHandler) DeleteMonsterConfig(c *gin.Context) {
	mType := c.Param("type")
	if mType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tipe monster tidak boleh kosong"})
		return
	}

	if err := h.configRepo.DeleteMonsterConfig(mType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus konfigurasi monster: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Konfigurasi monster berhasil dihapus",
	})
}

