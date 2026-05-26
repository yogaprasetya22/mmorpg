package http

import (
	"fmt"
	"math/rand"
	"net/http"
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

