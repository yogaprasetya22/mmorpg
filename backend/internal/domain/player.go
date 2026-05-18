package domain

import (
	"math/rand"
	"time"
)

// Player represents a persistent game character
type Player struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"user_id" gorm:"index"`
	Username  string    `json:"username" gorm:"unique;not null"`
	Password  string    `json:"-" gorm:"default:''"`
	
	// Customization & Class
	Class     string    `json:"class" gorm:"default:'Beginner'"` // Beginner, Warrior, Mage, Priest, Thief
	Gender    string    `json:"gender" gorm:"default:'Male'"`
	HairStyle int       `json:"hair_style" gorm:"default:1"`
	HairColor string    `json:"hair_color" gorm:"default:'#5A3E2D'"`

	// Level Progression
	Level     int       `json:"level" gorm:"default:1"`
	XP        int       `json:"xp" gorm:"default:0"`
	Gold      int       `json:"gold" gorm:"default:100"`

	// Core Attributes
	STR        int      `json:"str" gorm:"default:10"`        // Strength
	INT        int      `json:"int" gorm:"default:10"`        // Intelligence
	CON        int      `json:"con" gorm:"default:10"`        // Constitution
	VIT        int      `json:"vit" gorm:"default:10"`        // Vitality
	WIS        int      `json:"wis" gorm:"default:10"`        // Wisdom
	LUK        int      `json:"luk" gorm:"default:10"`        // Luck
	StatPoints int      `json:"stat_points" gorm:"default:0"` // Points available to allocate

	// Deprecated Attributes (kept for GORM backward compatibility/preventing database migration crashes)
	AGI int `json:"-" gorm:"default:10"`
	DEX int `json:"-" gorm:"default:10"`

	// Dynamic Vitality Stats
	HP        float32   `json:"hp" gorm:"default:1000"`
	MaxHP     float32   `json:"max_hp" gorm:"default:1000"`
	MP        float32   `json:"mp" gorm:"default:200"`
	MaxMP     float32   `json:"max_mp" gorm:"default:200"`

	// Authoritative RPG Stats (Derived)
	Attack       float32 `json:"attack" gorm:"default:50"`
	MagicAttack  float32 `json:"magic_attack" gorm:"default:10"`
	Defense      float32 `json:"defense" gorm:"default:10"`
	MagicDefense float32 `json:"magic_defense" gorm:"default:10"`
	CriticalRate float32 `json:"critical_rate" gorm:"default:0.05"`
	Speed        float32 `json:"speed" gorm:"default:5.0"`

	// Map Coordinate Persistence
	MapName   string    `json:"map_name" gorm:"default:'Starter Zone'"`
	LastX     float32   `json:"last_x" gorm:"default:0"`
	LastY     float32   `json:"last_y" gorm:"default:0"`
	LastZ     float32   `json:"last_z" gorm:"default:0"`

	// Relational Associations
	Inventory []PlayerItem  `json:"inventory" gorm:"foreignKey:PlayerID;constraint:OnDelete:CASCADE"`
	Skills    []PlayerSkill `json:"skills" gorm:"foreignKey:PlayerID;constraint:OnDelete:CASCADE"`
	Quests    []PlayerQuest `json:"quests" gorm:"foreignKey:PlayerID;constraint:OnDelete:CASCADE"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// PlayerItem represents an item inside a player's inventory bag or equipped slots
type PlayerItem struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	PlayerID   string    `json:"player_id" gorm:"index;not null"`
	ItemID     string    `json:"item_id" gorm:"not null"` // Blueprint key, e.g., "sword_starter", "potion_red"
	Name       string    `json:"name" gorm:"not null"`
	Type       string    `json:"type" gorm:"not null"` // equipment, consumable, material, quest
	SlotType   string    `json:"slot_type"`            // For equipment: weapon, shield, armor, helmet, boots, accessory
	Quantity   int       `json:"quantity" gorm:"default:1"`
	IsEquipped bool      `json:"is_equipped" gorm:"default:false"`
	SlotIndex  int       `json:"slot_index" gorm:"default:0"`

	// Stat Enhancements (Applied only when equipped)
	AddHP      float32   `json:"add_hp" gorm:"default:0"`
	AddMP      float32   `json:"add_mp" gorm:"default:0"`
	AddAttack  float32   `json:"add_attack" gorm:"default:0"`
	AddDefense float32   `json:"add_defense" gorm:"default:0"`

	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// PlayerSkill represents skills learned or unlocked by the character
type PlayerSkill struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	PlayerID   string    `json:"player_id" gorm:"index;not null"`
	SkillID    string    `json:"skill_id" gorm:"not null"` // e.g. "strike", "heal", "fireball"
	Name       string    `json:"name" gorm:"not null"`
	Level      int       `json:"level" gorm:"default:1"`
	Type       string    `json:"type" gorm:"default:'active'"` // active, passive
	ManaCost   int       `json:"mana_cost" gorm:"default:0"`
	Cooldown   float32   `json:"cooldown" gorm:"default:0"` // Live CD remaining
	MaxCD      float32   `json:"max_cooldown" gorm:"default:0"` // Base CD
	Damage     float32   `json:"damage" gorm:"default:0"` // Base power multiplier
	IsUnlocked bool      `json:"is_unlocked" gorm:"default:true"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// PlayerQuest represents quests accepted by the player character
type PlayerQuest struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	PlayerID    string    `json:"player_id" gorm:"index;not null"`
	QuestID     string    `json:"quest_id" gorm:"not null"`
	Title       string    `json:"title" gorm:"not null"`
	Status      string    `json:"status" gorm:"default:'active'"` // active, completed, failed
	Progress    int       `json:"progress" gorm:"default:0"`
	TargetCount int       `json:"target_count" gorm:"default:0"`
	RewardGold  int       `json:"reward_gold" gorm:"default:0"`
	RewardXP    int       `json:"reward_xp" gorm:"default:0"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// RecalculateStats updates derived combat attributes based on Class, Attributes, Level and equipped Gear
func (p *Player) RecalculateStats() {
	// 1. Calculate Base HP and MP from Level, CON, VIT, WIS, and INT
	p.MaxHP = 500 + float32(p.Level*100) + float32(p.CON*25) + float32(p.VIT*15)
	p.MaxMP = 100 + float32(p.Level*20) + float32(p.WIS*8) + float32(p.INT*12)

	// 2. Class Attack & MagicAttack Modifiers
	switch p.Class {
	case "Warrior":
		p.Attack = 30 + float32(p.Level*8) + float32(p.STR)*4.5 + float32(p.LUK)*1.5
		p.MagicAttack = 10 + float32(p.Level*2) + float32(p.INT)*1.0 + float32(p.WIS)*0.5
	case "Mage":
		p.Attack = 15 + float32(p.Level*4) + float32(p.STR)*0.5
		p.MagicAttack = 40 + float32(p.Level*10) + float32(p.INT)*5.0 + float32(p.WIS)*2.0
	case "Priest":
		p.Attack = 20 + float32(p.Level*5) + float32(p.STR)*1.5 + float32(p.LUK)*1.0
		p.MagicAttack = 25 + float32(p.Level*7) + float32(p.INT)*3.0 + float32(p.WIS)*1.5
	case "Thief":
		p.Attack = 25 + float32(p.Level*7) + float32(p.STR)*2.0 + float32(p.LUK)*3.5
		p.MagicAttack = 10 + float32(p.Level*2) + float32(p.INT)*1.0 + float32(p.WIS)*0.5
	default: // Beginner / Default
		p.Attack = 20 + float32(p.Level*5) + float32(p.STR)*2.0 + float32(p.LUK)*1.0
		p.MagicAttack = 10 + float32(p.Level*3) + float32(p.INT)*1.0 + float32(p.WIS)*0.5
	}

	// 3. Derived Defense & MagicDefense
	p.Defense = 10 + float32(p.Level*3) + float32(p.VIT)*2.0 + float32(p.CON)*1.0
	p.MagicDefense = 10 + float32(p.Level*2) + float32(p.WIS)*2.5 + float32(p.INT)*0.5

	// 4. LUK scaling for Critical Rate and Movement Speed
	p.CriticalRate = 0.05 + float32(p.LUK)*0.0025
	if p.CriticalRate > 0.80 {
		p.CriticalRate = 0.80 // Cap Critical Rate at 80%
	}
	p.Speed = 5.0 + float32(p.LUK)*0.02

	// 5. Accumulate item bonus values from all equipped items in the Inventory list
	for _, item := range p.Inventory {
		if item.IsEquipped {
			p.MaxHP += item.AddHP
			p.MaxMP += item.AddMP
			p.Attack += item.AddAttack
			p.Defense += item.AddDefense
		}
	}

	// 6. Safeguard HP/MP overflow/underflow boundary integrity
	if p.HP > p.MaxHP {
		p.HP = p.MaxHP
	}
	if p.MP > p.MaxMP {
		p.MP = p.MaxMP
	}
}

// CalculateDamageTo computes the authoritative damage dealt by this player to a target defense value.
// It returns the final damage value and a boolean indicating whether the attack was a critical hit.
func (p *Player) CalculateDamageTo(targetDefense float32) (float32, bool) {
	isCrit := false
	dmg := p.Attack

	// Mage deals damage derived from MagicAttack instead of physical Attack!
	if p.Class == "Mage" {
		dmg = p.MagicAttack
	}

	// Critical roll
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	if r.Float32() < p.CriticalRate {
		isCrit = true
		dmg *= 1.5
	}

	// Percentage damage reduction: 100 / (100 + defense)
	damageMultiplier := float32(100.0) / (100.0 + targetDefense)
	dmg = dmg * damageMultiplier

	// Add slight variance +/- 10%
	variation := (r.Float32()*0.20 - 0.10) * dmg
	dmg = dmg + variation

	if dmg < 1 {
		dmg = 1
	}

	return dmg, isCrit
}

type PlayerRepository interface {
	Create(player *Player) error
	GetByID(id string) (*Player, error)
	GetByUsername(username string) (*Player, error)
	GetByUserID(userID string) ([]*Player, error)
	Update(player *Player) error
}
