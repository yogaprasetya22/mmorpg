package domain

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
)

// AvatarColorPalette stores available color options for a customization category
type AvatarColorPalette struct {
	Colors []string `json:"colors"`
}

// AvatarCameraPlacement stores camera position/target hints for a customization category
type AvatarCameraPlacement struct {
	Position []float64 `json:"position"`
	Target   []float64 `json:"target"`
}

// AvatarExpand stores optional metadata for a customization category (color palettes, camera hints)
type AvatarExpand struct {
	ColorPalette    *AvatarColorPalette    `json:"colorPalette,omitempty"`
	CameraPlacement *AvatarCameraPlacement `json:"cameraPlacement,omitempty"`
}

// GORM driver interface for AvatarExpand JSON scanning/valuing
func (e AvatarExpand) Value() (driver.Value, error) {
	return json.Marshal(e)
}

func (e *AvatarExpand) Scan(src interface{}) error {
	bytes, ok := src.([]byte)
	if !ok {
		if str, ok := src.(string); ok {
			bytes = []byte(str)
		} else {
			return errors.New("type assertion to []byte/string failed for AvatarExpand")
		}
	}
	return json.Unmarshal(bytes, e)
}

// AvatarStringArray is a JSON-encoded string slice for GORM compatibility
type AvatarStringArray []string

func (sa AvatarStringArray) Value() (driver.Value, error) {
	return json.Marshal(sa)
}

func (sa *AvatarStringArray) Scan(src interface{}) error {
	bytes, ok := src.([]byte)
	if !ok {
		if str, ok := src.(string); ok {
			bytes = []byte(str)
		} else {
			return errors.New("type assertion to []byte/string failed for AvatarStringArray")
		}
	}
	return json.Unmarshal(bytes, sa)
}

// AvatarCategory represents a customization slot (e.g. "Head", "Hair", "Outfit")
type AvatarCategory struct {
	ID            string            `gorm:"primaryKey" json:"id"`
	Name          string            `json:"name"`
	Position      int               `json:"position"`
	Removable     bool              `json:"removable"`
	StartingAsset string            `json:"startingAsset"`
	Expand        AvatarExpand      `gorm:"type:text" json:"expand"`
	Assets        []AvatarAsset     `gorm:"-" json:"assets,omitempty"` // embedded dynamically in API response
}

// AvatarAsset represents a single 3D customization item (e.g. "Hair #1", "Sword")
type AvatarAsset struct {
	ID           string            `gorm:"primaryKey" json:"id"`
	Name         string            `json:"name"`
	Group        string            `json:"group"` // AvatarCategory ID
	LockedGroups AvatarStringArray `gorm:"type:text" json:"lockedGroups"`
	URL          string            `json:"url"`
	Thumbnail    string            `json:"thumbnail"`
}
