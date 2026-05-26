package domain

import "time"

type MapConfig struct {
	ID                string    `json:"id" gorm:"primaryKey"`
	Name              string    `json:"name"`
	GridSize          float64   `json:"grid_size" gorm:"default:1.0"`
	GridEnabled       bool      `json:"grid_enabled" gorm:"default:true"`
	TerrainHeight     float64   `json:"terrain_height" gorm:"default:12.0"`
	TerrainScale      float64   `json:"terrain_scale" gorm:"default:0.05"`
	TerrainSeed       int       `json:"terrain_seed" gorm:"default:0"`
	TerrainSharpness  float64   `json:"terrain_sharpness" gorm:"default:2.0"`
	TerrainMaterialID string    `json:"terrain_material_id" gorm:"default:''"`
	TerrainColor      string    `json:"terrain_color" gorm:"default:'#3d5c36'"`
	Sky               string    `json:"sky" gorm:"default:'sunset'"`
	Environment       string    `json:"environment" gorm:"default:'STORM'"`
	LightIntensity    *float64  `json:"light_intensity" gorm:"type:numeric"`
	AmbientIntensity  *float64  `json:"ambient_intensity" gorm:"type:numeric"`
	SunAngle          float64   `json:"sun_angle" gorm:"default:215.0"`
	FogDensity        float64   `json:"fog_density" gorm:"default:0.0025"`
	PaintData         string    `json:"paint_data" gorm:"type:text"`
	SculptData        string    `json:"sculpt_data" gorm:"type:text"`
	Items             []MapItem `json:"items" gorm:"foreignKey:MapConfigID;constraint:OnDelete:CASCADE"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type MapItem struct {
	ID          string  `json:"id" gorm:"primaryKey"`
	MapConfigID string  `json:"map_config_id" gorm:"index;not null"`
	Type        string  `json:"type"`
	Path        string  `json:"path"`
	PosX        float64 `json:"pos_x"`
	PosY        float64 `json:"pos_y"`
	PosZ        float64 `json:"pos_z"`
	RotX        float64 `json:"rot_x"`
	RotY        float64 `json:"rot_y"`
	RotZ        float64 `json:"rot_z"`
	ScaX        float64 `json:"sca_x"`
	ScaY        float64 `json:"sca_y"`
	ScaZ        float64 `json:"sca_z"`
	Color       string  `json:"color"`
}
