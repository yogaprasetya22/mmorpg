// REFACTORED FROM: player.go
// PlayerItem domain model — represents inventory items owned by a player character.
// Separated from player.go to follow Single Responsibility Principle.
package domain

import "time"

// PlayerItem represents an item inside a player's inventory bag or equipped slots
type PlayerItem struct {
	ID         string `json:"id" gorm:"primaryKey"`
	PlayerID   string `json:"player_id" gorm:"index;not null"`
	ItemID     string `json:"item_id" gorm:"not null"` // Blueprint key, e.g., "sword_starter", "potion_red"
	Name       string `json:"name" gorm:"not null"`
	Type       string `json:"type" gorm:"not null"` // equipment, consumable, material, quest
	SlotType       string `json:"slot_type"`              // For equipment: weapon, shield, armor, helmet, boots, accessory
	WeaponCategory string `json:"weapon_category"`        // For weapons: sword, bow, staff, dagger, mace — determines hand placement & animation
	Quantity       int    `json:"quantity" gorm:"default:1"`
	IsEquipped bool   `json:"is_equipped" gorm:"default:false"`
	SlotIndex  int    `json:"slot_index" gorm:"default:0"`
	RefineLevel int    `json:"refine_level" gorm:"default:0"`

	// Stat Enhancements (Applied only when equipped)
	AddHP      float32 `json:"add_hp" gorm:"default:0"`
	AddMP      float32 `json:"add_mp" gorm:"default:0"`
	AddAttack  float32 `json:"add_attack" gorm:"default:0"`
	AddDefense float32 `json:"add_defense" gorm:"default:0"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
