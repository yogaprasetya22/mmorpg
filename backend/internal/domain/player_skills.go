// REFACTORED FROM: player.go
// PlayerSkill domain model — represents skills learned or unlocked by a player character.
// Separated from player.go to follow Single Responsibility Principle.
package domain

import "time"

// PlayerSkill represents skills learned or unlocked by the character
type PlayerSkill struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	PlayerID   string    `json:"player_id" gorm:"index;not null"`
	SkillID    string    `json:"skill_id" gorm:"not null"` // e.g. "strike", "heal", "fireball"
	Name       string    `json:"name" gorm:"not null"`
	Level      int       `json:"level" gorm:"default:1"`
	Type       string    `json:"type" gorm:"default:'active'"` // active, passive
	ManaCost   int       `json:"mana_cost" gorm:"default:0"`
	Cooldown   float32   `json:"cooldown" gorm:"default:0"`     // Live CD remaining
	MaxCD      float32   `json:"max_cooldown" gorm:"default:0"` // Base CD
	Damage     float32   `json:"damage" gorm:"default:0"`       // Base power multiplier
	IsUnlocked bool      `json:"is_unlocked" gorm:"default:true"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
