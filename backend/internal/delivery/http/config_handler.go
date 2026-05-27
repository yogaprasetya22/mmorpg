package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"mmorpg-backend/internal/domain"
)

type ConfigHandler struct {
	configRepo domain.ConfigRepository
	db         *gorm.DB
}

func NewConfigHandler(configRepo domain.ConfigRepository, db *gorm.DB) *ConfigHandler {
	return &ConfigHandler{
		configRepo: configRepo,
		db:         db,
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

// AssetInfo describes a 3D asset file served over the static URL pathway
type AssetInfo struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// GetAssetList queries all dynamic assets stored in the database Asset table
func (h *ConfigHandler) GetAssetList(c *gin.Context) {
	var dbAssets []domain.Asset
	if err := h.db.Order("name ASC").Find(&dbAssets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data asset dari database: " + err.Error()})
		return
	}

	var assets []AssetInfo
	for _, asset := range dbAssets {
		assets = append(assets, AssetInfo{
			Name: asset.Name,
			Path: asset.Path,
		})
	}

	c.JSON(http.StatusOK, assets)
}

type MapSettingsInput struct {
	GridSize      float64 `json:"gridSize"`
	GridEnabled   bool    `json:"gridEnabled"`
	TerrainConfig struct {
		Height    float64 `json:"height"`
		Scale     float64 `json:"scale"`
		Seed      int     `json:"seed"`
		Sharpness float64 `json:"sharpness"`
	} `json:"terrainConfig"`
	TerrainMaterialID string   `json:"terrainMaterialId"`
	TerrainColor      string   `json:"terrainColor"`
	Sky               string   `json:"sky"`
	Environment       string   `json:"environment"`
	LightIntensity    *float64 `json:"lightIntensity"`
	AmbientIntensity  *float64 `json:"ambientIntensity"`
	SunAngle          float64  `json:"sunAngle"`
	FogDensity        float64  `json:"fogDensity"`
}

type MapItemInput struct {
	ID    string    `json:"id"`
	Type  string    `json:"type"`
	Path  string    `json:"path"`
	Pos   []float64 `json:"pos"`
	Rot   []float64 `json:"rot"`
	Sca   []float64 `json:"sca"`
	Color string    `json:"color"`
}

type MapSaveInput struct {
	MapID      string           `json:"map_id"`
	Items      []MapItemInput   `json:"items"`
	Settings   MapSettingsInput `json:"settings"`
	PaintData  string           `json:"paintData"`
	SculptData string           `json:"sculptData"`
}

// SaveMap processes map-editor persistence updates into MapConfig and MapItem tables in GORM
func (h *ConfigHandler) SaveMap(c *gin.Context) {
	var input MapSaveInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON body tidak valid: " + err.Error()})
		return
	}

	mapID := input.MapID
	if mapID == "" {
		mapID = c.DefaultQuery("map_id", "Starter Zone")
	}

	// Replace existing items inside transactional context
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("map_config_id = ?", mapID).Delete(&domain.MapItem{}).Error; err != nil {
			return err
		}

		skyPreset := input.Settings.Sky
		if skyPreset == "" {
			skyPreset = "sunset"
		}

		envMode := input.Settings.Environment
		if envMode == "" {
			envMode = "STORM"
		}

		mapConfig := domain.MapConfig{
			ID:                mapID,
			Name:              mapID,
			GridSize:          input.Settings.GridSize,
			GridEnabled:       input.Settings.GridEnabled,
			TerrainHeight:     input.Settings.TerrainConfig.Height,
			TerrainScale:      input.Settings.TerrainConfig.Scale,
			TerrainSeed:       input.Settings.TerrainConfig.Seed,
			TerrainSharpness:  input.Settings.TerrainConfig.Sharpness,
			TerrainMaterialID: input.Settings.TerrainMaterialID,
			TerrainColor:      input.Settings.TerrainColor,
			Sky:               skyPreset,
			Environment:       envMode,
			LightIntensity:    input.Settings.LightIntensity,
			AmbientIntensity:  input.Settings.AmbientIntensity,
			SunAngle:          input.Settings.SunAngle,
			FogDensity:        input.Settings.FogDensity,
			PaintData:         input.PaintData,
			SculptData:        input.SculptData,
		}

		if err := tx.Save(&mapConfig).Error; err != nil {
			return err
		}

		for _, item := range input.Items {
			var px, py, pz, rx, ry, rz, sx, sy, sz float64
			if len(item.Pos) >= 3 {
				px, py, pz = item.Pos[0], item.Pos[1], item.Pos[2]
			}
			if len(item.Rot) >= 3 {
				rx, ry, rz = item.Rot[0], item.Rot[1], item.Rot[2]
			}
			if len(item.Sca) >= 3 {
				sx, sy, sz = item.Sca[0], item.Sca[1], item.Sca[2]
			}

			dbItem := domain.MapItem{
				ID:          item.ID,
				MapConfigID: mapConfig.ID,
				Type:        item.Type,
				Path:        item.Path,
				PosX:        px,
				PosY:        py,
				PosZ:        pz,
				RotX:        rx,
				RotY:        ry,
				RotZ:        rz,
				ScaX:        sx,
				ScaY:        sy,
				ScaZ:        sz,
				Color:       item.Color,
			}

			if err := tx.Create(&dbItem).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan peta ke database: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Peta '" + mapID + "' berhasil disimpan ke database!"})
}

// LoadMap reads map configuration and preload items list dynamically based on GORM Preload filter
func (h *ConfigHandler) LoadMap(c *gin.Context) {
	mapID := c.DefaultQuery("map_id", "Starter Zone")

	var mapConfig domain.MapConfig
	err := h.db.Preload("Items").First(&mapConfig, "id = ?", mapID).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, gin.H{
				"map_id": mapID,
				"items":  []interface{}{},
				"settings": gin.H{
					"gridSize":    1.0,
					"gridEnabled": true,
					"terrainConfig": gin.H{
						"height":    12.0,
						"scale":     0.05,
						"seed":      0,
						"sharpness": 2.0,
					},
					"terrainMaterialId": "",
					"terrainColor":      "#3d5c36",
					"sky":               "sunset",
				},
				"paintData":  "",
				"sculptData": "",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil peta dari database: " + err.Error()})
		return
	}

	itemsOut := make([]gin.H, 0, len(mapConfig.Items))
	for _, item := range mapConfig.Items {
		itemsOut = append(itemsOut, gin.H{
			"id":    item.ID,
			"type":  item.Type,
			"path":  item.Path,
			"pos":   []float64{item.PosX, item.PosY, item.PosZ},
			"rot":   []float64{item.RotX, item.RotY, item.RotZ},
			"sca":   []float64{item.ScaX, item.ScaY, item.ScaZ},
			"color": item.Color,
		})
	}

	c.JSON(http.StatusOK, gin.H{
			"map_id": mapConfig.ID,
			"items":  itemsOut,
			"settings": gin.H{
				"gridSize":    mapConfig.GridSize,
				"gridEnabled": mapConfig.GridEnabled,
				"terrainConfig": gin.H{
					"height":    mapConfig.TerrainHeight,
					"scale":     mapConfig.TerrainScale,
					"seed":      mapConfig.TerrainSeed,
					"sharpness": mapConfig.TerrainSharpness,
				},
				"terrainMaterialId": mapConfig.TerrainMaterialID,
				"terrainColor":      mapConfig.TerrainColor,
				"sky":               mapConfig.Sky,
				"environment":       mapConfig.Environment,
				"lightIntensity":    mapConfig.LightIntensity,
				"ambientIntensity":  mapConfig.AmbientIntensity,
				"sunAngle":          mapConfig.SunAngle,
				"fogDensity":        mapConfig.FogDensity,
			},
			"paintData":  mapConfig.PaintData,
			"sculptData": mapConfig.SculptData,
		})
}

// ListMaps lists metadata for all existing maps saved inside GORM MapConfig
func (h *ConfigHandler) ListMaps(c *gin.Context) {
	type MapMeta struct {
		ID        string    `json:"id"`
		Name      string    `json:"name"`
		UpdatedAt time.Time `json:"updated_at"`
	}

	var maps []MapMeta
	if err := h.db.Model(&domain.MapConfig{}).Select("id, name, updated_at").Find(&maps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar peta: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, maps)
}

// DeleteMap deletes the specified MapConfig and MapItems from GORM
func (h *ConfigHandler) DeleteMap(c *gin.Context) {
	mapID := c.Query("map_id")
	if mapID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID peta tidak boleh kosong"})
		return
	}

	var totalMaps int64
	if err := h.db.Model(&domain.MapConfig{}).Count(&totalMaps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memeriksa jumlah peta: " + err.Error()})
		return
	}
	if totalMaps <= 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus peta terakhir. Harus ada minimal satu peta di sistem."})
		return
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("map_config_id = ?", mapID).Delete(&domain.MapItem{}).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", mapID).Delete(&domain.MapConfig{}).Error; err != nil {
			return err
		}

		// Update simulation settings if the deleted map was active
		var settings domain.SimulationSetting
		if err := tx.Where("id = ?", "default").First(&settings).Error; err == nil {
			if settings.ActiveMapID == mapID {
				var fallbackMap domain.MapConfig
				if err := tx.Where("id != ?", mapID).First(&fallbackMap).Error; err == nil {
					settings.ActiveMapID = fallbackMap.ID
					if err := tx.Save(&settings).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus peta: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Peta berhasil dihapus", "map_id": mapID})
}

// DeepSeek integration structs
type DeepSeekMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type DeepSeekRequest struct {
	Model       string            `json:"model"`
	Messages    []DeepSeekMessage `json:"messages"`
	Temperature float64           `json:"temperature"`
}

type DeepSeekChoice struct {
	Message DeepSeekMessage `json:"message"`
}

type DeepSeekResponse struct {
	Choices []DeepSeekChoice `json:"choices"`
}

type AIAssetInfo struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Category string `json:"category"`
}

type AIGenerateRequest struct {
	Prompt          string         `json:"prompt"`
	CurrentItems    []MapItemInput `json:"currentItems"`
	AvailableAssets []AIAssetInfo  `json:"availableAssets"`
}

type AISettingsResult struct {
	Sky              string  `json:"sky"`
	Environment      string  `json:"environment"`
	TerrainColor     string  `json:"terrainColor"`
	LightIntensity   float64 `json:"lightIntensity"`
	AmbientIntensity float64 `json:"ambientIntensity"`
	SunAngle         float64 `json:"sunAngle"`
	FogDensity       float64 `json:"fogDensity"`
}

type AIEnvironmentResult struct {
	Settings AISettingsResult `json:"settings"`
	Action   string           `json:"action"` // "append" | "replace"
	Items    []MapItemInput   `json:"items"`
}

// AIGenerateEnvironment utilizes DeepSeek Chat LLM to parse natural language prompts into MMORPG environment presets & object placement
func (h *ConfigHandler) AIGenerateEnvironment(c *gin.Context) {
	var req AIGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Permintaan tidak valid: " + err.Error()})
		return
	}

	if req.Prompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prompt deskripsi lingkungan tidak boleh kosong"})
		return
	}

	apiKey := os.Getenv("DEEPSEEK_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "DeepSeek API Key (DEEPSEEK_API_KEY) tidak ditemukan di konfigurasi env. Silakan tambahkan ke backend/.env"})
		return
	}

	// Format available assets list to give LLM high context accuracy
	assetsBytes, _ := json.MarshalIndent(req.AvailableAssets, "", "  ")
	assetsStr := string(assetsBytes)

	// Format current items
	currentItemsBytes, _ := json.MarshalIndent(req.CurrentItems, "", "  ")
	currentItemsStr := string(currentItemsBytes)
	if len(req.CurrentItems) == 0 {
		currentItemsStr = "[] (No items placed yet)"
	}

	systemPrompt := fmt.Sprintf(`You are a world-class 3D level designer for a fantasy MMORPG game world.
Your task is to interpret a user's natural language command and generate/modify the placement of 3D objects (meshes) and lighting environment settings.

Available 3D models in the asset library that you CAN place:
%s

Current objects already placed on the map:
%s

The map size is roughly 200m x 200m. The center is at coordinates [0, 0, 0].
You can place meshes by specifying:
- path: The exact model path from the library list above.
- type: The category of the model (usually matching the "category" in the library, e.g. "tree", "env", "kingdom").
- pos: [X, Y, Z] floats. Place Y at 0 unless it is stacked/floating (e.g. towers or walls on top of each other). X and Z must be between -90 and 90.
- rot: [X, Y, Z] rotation in radians (usually only Y rotation needs randomization: 0 to 6.28). Keep X and Z rot at 0 unless tilted.
- sca: [X, Y, Z] scale factors (typically 1.0, 1.0, 1.0. Trees can scale from 0.8 to 2.5; castles/towers from 1.5 to 3.5).

You must support operations like:
1. "banyak pohon dengan ukuran pas": Choose tree paths from the library and generate scattered, nicely randomized trees (X and Z at least 3m to 15m apart so they do not overlap) with random sizes (e.g. scales between 0.8 to 2.2).
2. "tambahkan rerumputan": Spawn scattered grass patches or rocks around the map.
3. "istana yang baik" or "istana megah": Pick kingdom building parts (walls, towers, gates, ruins) and align them logically to create a castle layout (e.g., walls forming a square/rectangle, towers at corners, a gate in the front).

You MUST respond ONLY with a raw JSON object containing these exact fields and matching types:
{
  "settings": {
    "sky": "sunset" | "night" | "dawn" | "day" | "storm",
    "environment": "STORM" | "WHIMSICAL",
    "terrainColor": "#HEX_COLOR" (appropriate ground color for the style/theme),
    "lightIntensity": float (0.1 to 5.0),
    "ambientIntensity": float (0.1 to 3.0),
    "sunAngle": float (0 to 360),
    "fogDensity": float (0.0001 to 0.05)
  },
  "action": "replace" | "append" (use "replace" if the user wants to start fresh, reset, or replace; use "append" if adding to what already exists),
  "items": [
    {
      "id": "unique_string_id" (generate a unique string ID for this item, e.g. "ai_tree_1"),
      "type": "tree" | "env" | "kingdom",
      "path": "exact_model_path",
      "pos": [x, y, z],
      "rot": [x, y, z],
      "sca": [x, y, z],
      "color": "#HEX_COLOR" (optional, keep empty)
    }
  ]
}

DO NOT include any markdown code blocks or triple backticks. Return ONLY the raw JSON string.`, assetsStr, currentItemsStr)

	deepSeekReq := DeepSeekRequest{
		Model: "deepseek-chat",
		Messages: []DeepSeekMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: req.Prompt},
		},
		Temperature: 0.6,
	}

	reqBytes, err := json.Marshal(deepSeekReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyusun payload AI: " + err.Error()})
		return
	}

	dialer := &net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
		Resolver: &net.Resolver{
			PreferGo: true,
			Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
				d := net.Dialer{
					Timeout: 5 * time.Second,
				}
				// Attempt Cloudflare Public DNS (1.1.1.1) first
				conn, err := d.DialContext(ctx, "udp", "1.1.1.1:53")
				if err != nil {
					// Fallback to Google Public DNS (8.8.8.8)
					conn, err = d.DialContext(ctx, "udp", "8.8.8.8:53")
				}
				if err != nil {
					// Final fallback to the local host's default resolver (e.g. systemd-resolved)
					return d.DialContext(ctx, network, address)
				}
				return conn, nil
			},
		},
	}

	transport := &http.Transport{
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	client := &http.Client{
		Transport: transport,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Second)
	defer cancel()

	var resp *http.Response
	var lastErr error

	// Robust Retry Loop (up to 3 times) for transient network or DNS timeouts
	for attempt := 1; attempt <= 3; attempt++ {
		// Re-instantiate request body buffer since it is consumed on each attempt
		httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.deepseek.com/v1/chat/completions", bytes.NewBuffer(reqBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat request HTTP ke DeepSeek: " + err.Error()})
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)

		log.Printf("[AI GATEWAY] Mengirim request ke DeepSeek API (Percobaan %d/3)...", attempt)
		resp, err = client.Do(httpReq)
		if err == nil {
			break
		}

		lastErr = err
		log.Printf("[AI GATEWAY] Percobaan %d gagal: %v", attempt, err)
		if attempt < 3 {
			// Sleep before retrying with small exponential backoff
			time.Sleep(time.Duration(attempt) * 1500 * time.Millisecond)
		}
	}

	if lastErr != nil && resp == nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal terhubung ke DeepSeek API setelah 3 percobaan: " + lastErr.Error()})
		return
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca balasan dari DeepSeek API: " + err.Error()})
		return
	}

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("DeepSeek API mengembalikan error (%d): %s", resp.StatusCode, string(respBytes))})
		return
	}

	var deepSeekResp DeepSeekResponse
	if err := json.Unmarshal(respBytes, &deepSeekResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengurai respons JSON DeepSeek: " + err.Error()})
		return
	}

	if len(deepSeekResp.Choices) == 0 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "DeepSeek API mengembalikan respons kosong"})
		return
	}

	content := deepSeekResp.Choices[0].Message.Content

	// Strip markdown code fences if DeepSeek returned them
	content = strings.TrimSpace(content)
	if strings.HasPrefix(content, "```") {
		lines := strings.Split(content, "\n")
		var clean []string
		for _, line := range lines {
			if !strings.HasPrefix(strings.TrimSpace(line), "```") {
				clean = append(clean, line)
			}
		}
		content = strings.Join(clean, "\n")
	}
	content = strings.TrimSpace(content)

	var result AIEnvironmentResult
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"error": "AI tidak mengembalikan format JSON lingkungan yang valid. Silakan coba deskripsi lain.",
			"raw":   content,
		})
		return
	}

	// Validate & Clamp settings for absolute stability
	if result.Settings.Sky != "sunset" && result.Settings.Sky != "night" && result.Settings.Sky != "dawn" && result.Settings.Sky != "day" && result.Settings.Sky != "storm" {
		result.Settings.Sky = "sunset"
	}
	if result.Settings.Environment != "STORM" && result.Settings.Environment != "WHIMSICAL" {
		result.Settings.Environment = "STORM"
	}
	if result.Settings.TerrainColor == "" {
		result.Settings.TerrainColor = "#3d5c36"
	}
	if result.Settings.LightIntensity < 0.1 {
		result.Settings.LightIntensity = 0.1
	} else if result.Settings.LightIntensity > 5.0 {
		result.Settings.LightIntensity = 5.0
	}
	if result.Settings.AmbientIntensity < 0.1 {
		result.Settings.AmbientIntensity = 0.1
	} else if result.Settings.AmbientIntensity > 3.0 {
		result.Settings.AmbientIntensity = 3.0
	}
	if result.Settings.SunAngle < 0 {
		result.Settings.SunAngle = 0
	} else if result.Settings.SunAngle > 360 {
		result.Settings.SunAngle = 360
	}
	if result.Settings.FogDensity < 0.0001 {
		result.Settings.FogDensity = 0.0001
	} else if result.Settings.FogDensity > 0.05 {
		result.Settings.FogDensity = 0.05
	}

	if result.Action != "replace" && result.Action != "append" {
		result.Action = "append"
	}

	// Clean & Clamp individual items
	clampedItems := []MapItemInput{}
	for i, item := range result.Items {
		// Enforce safety limit
		if i >= 120 {
			break
		}

		if item.ID == "" {
			item.ID = fmt.Sprintf("ai-%d-%d", time.Now().UnixNano(), i)
		}
		if item.Type == "" {
			item.Type = "env"
		}
		if item.Path == "" {
			continue
		}

		// Correct hallucinated paths using exact or fuzzy asset matching against available assets
		item.Path = findClosestAsset(item.Path, req.AvailableAssets)

		// Pos checks
		if len(item.Pos) != 3 {
			item.Pos = []float64{0, 0, 0}
		}
		for idx, val := range item.Pos {
			if idx == 1 { // Y axis
				if val < -10 {
					item.Pos[idx] = -10
				} else if val > 150 {
					item.Pos[idx] = 150
				}
			} else { // X & Z axes
				if val < -95 {
					item.Pos[idx] = -95
				} else if val > 95 {
					item.Pos[idx] = 95
				}
			}
		}

		// Rot checks
		if len(item.Rot) != 3 {
			item.Rot = []float64{0, 0, 0}
		}
		for idx, val := range item.Rot {
			if val < -6.28 {
				item.Rot[idx] = -6.28
			} else if val > 6.28 {
				item.Rot[idx] = 6.28
			}
		}

		// Scale checks
		if len(item.Sca) != 3 {
			item.Sca = []float64{1, 1, 1}
		}
		for idx, val := range item.Sca {
			if val < 0.1 {
				item.Sca[idx] = 0.1
			} else if val > 12.0 {
				item.Sca[idx] = 12.0
			}
		}

		clampedItems = append(clampedItems, item)
	}
	result.Items = clampedItems

	c.JSON(http.StatusOK, result)
}

// findClosestAsset parses a hallucinated path from the LLM and maps it to the closest valid asset in the database.
func findClosestAsset(aiPath string, availableAssets []AIAssetInfo) string {
	aiPathClean := strings.ToLower(strings.TrimSpace(aiPath))
	
	// 1. Exact path match
	for _, asset := range availableAssets {
		if strings.ToLower(asset.Path) == aiPathClean {
			return asset.Path
		}
	}
	
	// 2. Exact name match (AI used the filename/display name instead of the path)
	for _, asset := range availableAssets {
		if strings.ToLower(asset.Name) == aiPathClean {
			return asset.Path
		}
	}

	// 3. Substring name match
	for _, asset := range availableAssets {
		assetNameClean := strings.ToLower(asset.Name)
		if strings.Contains(aiPathClean, assetNameClean) || strings.Contains(assetNameClean, aiPathClean) {
			return asset.Path
		}
	}

	// 4. Token-based matching (score based on matching keywords in display name or path)
	var bestPath string
	bestScore := 0
	aiWords := strings.Fields(strings.ReplaceAll(strings.ReplaceAll(aiPathClean, "/", " "), "-", " "))
	
	for _, asset := range availableAssets {
		assetNameClean := strings.ToLower(asset.Name)
		score := 0
		for _, w := range aiWords {
			if w == "" || len(w) < 3 {
				continue
			}
			if strings.Contains(assetNameClean, w) {
				score += 5
			}
			if strings.Contains(strings.ToLower(asset.Path), w) {
				score += 1
			}
		}
		if score > bestScore {
			bestScore = score
			bestPath = asset.Path
		}
	}
	
	if bestScore > 0 {
		return bestPath
	}

	// 5. Semantic category fallback
	aiCategory := "env"
	if strings.Contains(aiPathClean, "tree") || strings.Contains(aiPathClean, "wood") || strings.Contains(aiPathClean, "pine") || strings.Contains(aiPathClean, "bush") {
		aiCategory = "tree"
	} else if strings.Contains(aiPathClean, "wall") || strings.Contains(aiPathClean, "gate") || strings.Contains(aiPathClean, "tower") || strings.Contains(aiPathClean, "castle") || strings.Contains(aiPathClean, "kingdom") {
		aiCategory = "kingdom"
	}
	
	for _, asset := range availableAssets {
		if asset.Category == aiCategory {
			return asset.Path
		}
	}

	// Final absolute fallback to first available asset
	if len(availableAssets) > 0 {
		return availableAssets[0].Path
	}
	
	return aiPath
}

