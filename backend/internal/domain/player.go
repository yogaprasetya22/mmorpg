package domain

import (
	"math"
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

	// Core Attributes (Base allocated points, saved to DB)
	BaseSTR    int      `json:"base_str" gorm:"column:str;default:10"`
	BaseAGI    int      `json:"base_agi" gorm:"column:agi;default:10"`
	BaseVIT    int      `json:"base_vit" gorm:"column:vit;default:10"`
	BaseINT    int      `json:"base_int" gorm:"column:int;default:10"`
	BaseDEX    int      `json:"base_dex" gorm:"column:dex;default:10"`
	BaseLUK    int      `json:"base_luk" gorm:"column:luk;default:10"`
	StatPoints int      `json:"stat_points" gorm:"default:0"` // Points available to allocate

	// In-Memory Total Attributes (Base + Bonus, not saved to DB)
	STR        int      `json:"str" gorm:"-"`
	AGI        int      `json:"agi" gorm:"-"`
	VIT        int      `json:"vit" gorm:"-"`
	INT        int      `json:"int" gorm:"-"`
	DEX        int      `json:"dex" gorm:"-"`
	LUK        int      `json:"luk" gorm:"-"`

	// In-Memory Bonus Attributes (aggregated from equipment and buffs, not saved to DB)
	BonusSTR   int      `json:"bonus_str" gorm:"-"`
	BonusAGI   int      `json:"bonus_agi" gorm:"-"`
	BonusVIT   int      `json:"bonus_vit" gorm:"-"`
	BonusINT   int      `json:"bonus_int" gorm:"-"`
	BonusDEX   int      `json:"bonus_dex" gorm:"-"`
	BonusLUK   int      `json:"bonus_luk" gorm:"-"`

	// Dynamic Vitality Stats
	LastBasicAttackTime time.Time `json:"-" gorm:"-"`
	SpawnProtectedUntil time.Time `json:"-" gorm:"-"`

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
	ASPD         float32 `json:"aspd" gorm:"default:150"`
	
	// RO Substats (In-Memory)
	HIT          int     `json:"hit" gorm:"-"`
	FLEE         int     `json:"flee" gorm:"-"`
	PerfectDodge float32 `json:"perfect_dodge" gorm:"-"`
	CastTime     float32 `json:"cast_time" gorm:"-"` // Cast speed multiplier (0.0 to 1.0)

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
	// Safety check: ensure base stats have a minimum of 10 points
	if p.BaseSTR < 10 { p.BaseSTR = 10 }
	if p.BaseAGI < 10 { p.BaseAGI = 10 }
	if p.BaseVIT < 10 { p.BaseVIT = 10 }
	if p.BaseINT < 10 { p.BaseINT = 10 }
	if p.BaseDEX < 10 { p.BaseDEX = 10 }
	if p.BaseLUK < 10 { p.BaseLUK = 10 }

	// Reset bonuses
	p.BonusSTR = 0
	p.BonusAGI = 0
	p.BonusVIT = 0
	p.BonusINT = 0
	p.BonusDEX = 0
	p.BonusLUK = 0

	// Apply class job bonuses
	switch p.Class {
	case "Warrior":
		p.BonusSTR += 5
		p.BonusVIT += 5
	case "Mage":
		p.BonusINT += 8
		p.BonusDEX += 2
	case "Priest":
		p.BonusINT += 5
		p.BonusVIT += 5
	case "Thief":
		p.BonusAGI += 8
	}

	// Calculate final attributes (Base + Bonus)
	p.STR = p.BaseSTR + p.BonusSTR
	p.AGI = p.BaseAGI + p.BonusAGI
	p.VIT = p.BaseVIT + p.BonusVIT
	p.INT = p.BaseINT + p.BonusINT
	p.DEX = p.BaseDEX + p.BonusDEX
	p.LUK = p.BaseLUK + p.BonusLUK

	// 1. Calculate Base HP and MP from Level, VIT and INT using official iRO Wiki principles:
	// MaxHP = BaseHP * (1 + VIT / 100). Base HP is dependent on Class and Level.
	baseHP := float32(500 + p.Level*100)
	if p.Class == "Warrior" {
		baseHP = float32(700 + p.Level*140)
	} else if p.Class == "Thief" {
		baseHP = float32(550 + p.Level*105)
	} else if p.Class == "Mage" {
		baseHP = float32(400 + p.Level*75)
	}
	p.MaxHP = baseHP * (1.0 + float32(p.VIT)/100.0)

	// MaxSP (MP) = BaseSP * (1 + INT / 100). Base SP is dependent on Class and Level.
	baseSP := float32(100 + p.Level*20)
	if p.Class == "Mage" {
		baseSP = float32(150 + p.Level*35)
	} else if p.Class == "Priest" {
		baseSP = float32(120 + p.Level*28)
	}
	p.MaxMP = baseSP * (1.0 + float32(p.INT)/100.0)

	// 2. Class Attack & MagicAttack Modifiers following iRO Renewal formulas:
	// Status ATK (Melee) = STR + floor(DEX/5) + floor(LUK/3) + floor(BaseLevel/4)
	// Status MATK = INT + floor(DEX/5) + floor(LUK/3) + floor(BaseLevel/4)
	baseMeleeATK := float32(p.STR) + float32(p.DEX/5) + float32(p.LUK/3) + float32(p.Level/4)
	baseMATK := float32(p.INT) + float32(p.DEX/5) + float32(p.LUK/3) + float32(p.Level/4)

	isRanged := p.Class == "Beginner" // Beginner uses gun/ranged (MM)
	if isRanged {
		p.Attack = float32(p.DEX) + float32(p.STR/5) + float32(p.LUK/3) + float32(p.Level/4)
	} else {
		p.Attack = baseMeleeATK
	}
	p.MagicAttack = baseMATK

	// Apply class base additions
	switch p.Class {
	case "Warrior":
		p.Attack += 35.0 + float32(p.Level)*2.0
		p.MagicAttack += 10.0
	case "Mage":
		p.MagicAttack += 50.0 + float32(p.Level)*3.0
	case "Priest":
		p.Attack += 20.0 + float32(p.Level)
		p.MagicAttack += 30.0 + float32(p.Level)*2.0
	case "Thief":
		p.Attack += 30.0 + float32(p.Level)*1.5
		p.MagicAttack += 10.0
	default: // Beginner / Default
		p.Attack += 15.0
		p.MagicAttack += 10.0
	}

	// 3. Derived Defense & MagicDefense based on official iRO soft DEF/MDEF:
	// Soft DEF = VIT/2 + AGI/5 + BaseLevel/15
	// Soft MDEF = INT + VIT/5 + DEX/5 + BaseLevel/4
	p.Defense = float32(p.VIT)/2.0 + float32(p.AGI)/5.0 + float32(p.Level)/15.0 + 10.0
	p.MagicDefense = float32(p.INT) + float32(p.VIT/5.0) + float32(p.DEX/5.0) + float32(p.Level/4.0) + 10.0

	// 4. iRO LUK scaling for Critical Rate (1 + LUK/3)% and AGI scaling for Movement Speed
	p.CriticalRate = 0.01 * (1.0 + float32(p.LUK)/3.0)
	if p.CriticalRate > 0.80 {
		p.CriticalRate = 0.80 // Cap Critical Rate at 80%
	}
	p.Speed = 5.0 + float32(p.AGI)*0.015

	// 5. HIT & FLEE & PerfectDodge & CastTime calculation (100% iROWiki match)
	p.HIT = 175 + p.Level + p.DEX + (p.LUK / 3)
	p.FLEE = 100 + p.Level + p.AGI + (p.LUK / 5)
	p.PerfectDodge = 1.0 + float32(p.LUK)/10.0 // 1% + 1% per 10 LUK

	castFactor := float64(p.DEX*2+p.INT) / 530.0
	if castFactor >= 1.0 {
		p.CastTime = 0.0
	} else {
		p.CastTime = float32(1.0 - math.Sqrt(castFactor))
	}

	// === ASPD CALCULATOR (Ragnarok Renewal / New World style) ===
	// Official RO Renewal: ASPD = 200 - (200 - BaseASPD) * (1 - (AGI*4+DEX)/1000)
	// BaseASPD varies by class (unarmed). Higher = faster base.
	baseASPD := 145.0 // Default (Beginner)
	switch p.Class {
	case "Thief":
		baseASPD = 160.0
	case "Warrior":
		baseASPD = 150.0
	case "Mage":
		baseASPD = 140.0
	case "Priest":
		baseASPD = 140.0
	}
	// Calculate raw RO ASPD (scale 0-200, cap 193 like official RO)
	statBonus := (float64(p.AGI)*4.0 + float64(p.DEX)) / 1000.0
	if statBonus > 1.0 {
		statBonus = 1.0
	}
	roASPD := 200.0 - (200.0-baseASPD)*(1.0-statBonus)
	if roASPD > 193.0 {
		roASPD = 193.0 // Hard cap like RO
	}
	// Convert RO ASPD (0-200 scale) to our percentage scale (0-1000%)
	// roASPD 150 = ~300%, roASPD 180 = ~700%, roASPD 193 = ~1000%
	p.ASPD = float32((roASPD / 193.0) * 1000.0)

	// 6. Accumulate item bonus values from all equipped items in the Inventory list
	for _, item := range p.Inventory {
		if item.IsEquipped {
			p.MaxHP += item.AddHP
			p.MaxMP += item.AddMP
			p.Attack += item.AddAttack
			p.Defense += item.AddDefense
		}
	}

	// 7. Safeguard HP/MP overflow/underflow boundary integrity
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

	// Critical roll using global rand
	if rand.Float32() < p.CriticalRate {
		isCrit = true
		dmg *= 1.5
	}

	// Percentage damage reduction: 100 / (100 + defense)
	damageMultiplier := float32(100.0) / (100.0 + targetDefense)
	dmg = dmg * damageMultiplier

	// Add slight variance +/- 10%
	variation := (rand.Float32()*0.20 - 0.10) * dmg
	dmg = dmg + variation

	if dmg < 1 {
		dmg = 1
	}

	return dmg, isCrit
}

// GetRequiredXP returns the XP required to reach the next level based on an exponential curve.
func GetRequiredXP(level int) int {
	if level <= 0 {
		return 100
	}
	// Formula: 100 * level^1.8
	return int(math.Round(100.0 * math.Pow(float64(level), 1.8)))
}

// CalculateXPGain computes the final XP drop from a monster, applying a penalty/bonus based on level difference.
func (p *Player) CalculateXPGain(monsterLevel int, baseXP int) int {
	diff := monsterLevel - p.Level
	var multiplier float32

	switch {
	case diff >= 15:
		multiplier = 1.40
	case diff >= 10:
		multiplier = 1.25
	case diff >= 5:
		multiplier = 1.15
	case diff >= -5:
		multiplier = 1.00
	case diff >= -10:
		multiplier = 0.75
	case diff >= -15:
		multiplier = 0.35
	default:
		multiplier = 0.10
	}

	gained := float32(baseXP) * multiplier
	if gained < 1 {
		return 1
	}
	return int(math.Round(float64(gained)))
}

type QuestTemplate struct {
	QuestID     string
	Title       string
	MonsterType string
	MinLevel    int
	TargetCount int
	RewardGold  int
	RewardXP    int
}

var DailyQuestTemplates = []QuestTemplate{
	{
		QuestID:     "quest_slime",
		Title:       "Slime Purge",
		MonsterType: "slime",
		MinLevel:    1,
		TargetCount: 5,
		RewardGold:  60,
		RewardXP:    100,
	},
	{
		QuestID:     "quest_boar",
		Title:       "Boar Hunter",
		MonsterType: "default",
		MinLevel:    1,
		TargetCount: 4,
		RewardGold:  80,
		RewardXP:    150,
	},
	{
		QuestID:     "quest_goblin",
		Title:       "Goblin Menace",
		MonsterType: "goblin",
		MinLevel:    1,
		TargetCount: 3,
		RewardGold:  100,
		RewardXP:    200,
	},
	{
		QuestID:     "quest_goblin_archer",
		Title:       "Scout Cleanout",
		MonsterType: "goblin_archer",
		MinLevel:    4,
		TargetCount: 4,
		RewardGold:  150,
		RewardXP:    300,
	},
	{
		QuestID:     "quest_orc",
		Title:       "Orc Incursion",
		MonsterType: "orc",
		MinLevel:    6,
		TargetCount: 4,
		RewardGold:  200,
		RewardXP:    450,
	},
	{
		QuestID:     "quest_goblin_chief",
		Title:       "Goblin Commander",
		MonsterType: "goblin_chief",
		MinLevel:    8,
		TargetCount: 2,
		RewardGold:  300,
		RewardXP:    600,
	},
	{
		QuestID:     "quest_orc_berserker",
		Title:       "Orc Berserkers",
		MonsterType: "orc_berserker",
		MinLevel:    10,
		TargetCount: 3,
		RewardGold:  400,
		RewardXP:    850,
	},
	{
		QuestID:     "quest_orc_shaman",
		Title:       "Mages of the Horde",
		MonsterType: "orc_shaman",
		MinLevel:    12,
		TargetCount: 3,
		RewardGold:  500,
		RewardXP:    1200,
	},
	{
		QuestID:     "quest_skeleton",
		Title:       "Dark Skeleton Hunt",
		MonsterType: "skeleton",
		MinLevel:    15,
		TargetCount: 3,
		RewardGold:  800,
		RewardXP:    2000,
	},
	{
		QuestID:     "quest_boss",
		Title:       "Zombie Queen Slayer",
		MonsterType: "boss",
		MinLevel:    25,
		TargetCount: 1,
		RewardGold:  5000,
		RewardXP:    10000,
	},
}

func (p *Player) HasActiveQuests() bool {
	for _, q := range p.Quests {
		if q.Status == "active" {
			return true
		}
	}
	return false
}

func (p *Player) GenerateDailyQuests() {
	// Filter templates by player level
	var eligible []QuestTemplate
	for _, t := range DailyQuestTemplates {
		if p.Level >= t.MinLevel {
			eligible = append(eligible, t)
		}
	}

	if len(eligible) == 0 {
		return
	}

	// Pick a random template
	randIdx := rand.Intn(len(eligible))
	t := eligible[randIdx]

	// Create new quest
	questID := t.QuestID + "_" + time.Now().Format("20060102")
	
	p.Quests = []PlayerQuest{
		{
			ID:          p.ID + "-quest-" + time.Now().Format("150405"),
			PlayerID:    p.ID,
			QuestID:     questID,
			Title:       t.Title,
			Status:      "active",
			Progress:    0,
			TargetCount: t.TargetCount,
			RewardGold:  t.RewardGold,
			RewardXP:    t.RewardXP,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		},
	}
}

type PlayerRepository interface {
	Create(player *Player) error
	GetByID(id string) (*Player, error)
	GetByUsername(username string) (*Player, error)
	GetByUserID(userID string) ([]*Player, error)
	Update(player *Player) error
}
