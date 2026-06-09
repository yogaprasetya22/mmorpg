// REFACTORED: Extracted PlayerItem → player_items.go, PlayerSkill → player_skills.go,
// PlayerQuest + templates → player_quests.go, CalculateDamageTo + XP → player_combat.go.
// This file now contains only the Player struct, RecalculateStats, and PlayerRepository interface.
package domain

import (
	"math"
	"time"
)

// Player represents a persistent game character
type Player struct {
	ID       string `json:"id" gorm:"primaryKey"`
	UserID   string `json:"user_id" gorm:"index"`
	Username string `json:"username" gorm:"unique;not null"`
	Password string `json:"-" gorm:"default:''"`

	// Customization & Class
	Class     string `json:"class" gorm:"default:'Beginner'"` // Beginner, Warrior, Mage, Priest, Thief
	Gender    string `json:"gender" gorm:"default:'Male'"`
	HairStyle int    `json:"hair_style" gorm:"default:1"`
	HairColor       string `json:"hair_color" gorm:"default:'#5A3E2D'"`
	CustomAvatarURL string `json:"custom_avatar_url" gorm:"default:''"` // URL to baked GLB from Avatar Configurator

	// Level Progression
	Level int `json:"level" gorm:"default:1"`
	XP    int `json:"xp" gorm:"default:0"`
	Gold  int `json:"gold" gorm:"default:100"`

	// Core Attributes (Base allocated points, saved to DB)
	BaseSTR    int `json:"base_str" gorm:"column:str;default:10"`
	BaseAGI    int `json:"base_agi" gorm:"column:agi;default:10"`
	BaseVIT    int `json:"base_vit" gorm:"column:vit;default:10"`
	BaseINT    int `json:"base_int" gorm:"column:int;default:10"`
	BaseDEX    int `json:"base_dex" gorm:"column:dex;default:10"`
	BaseLUK    int `json:"base_luk" gorm:"column:luk;default:10"`
	StatPoints int `json:"stat_points" gorm:"default:0"` // Points available to allocate

	// Core Talent Attributes (Base allocated points, saved to DB)
	BasePOW      int `json:"base_pow" gorm:"column:pow;default:0"`
	BaseSTA      int `json:"base_sta" gorm:"column:sta;default:0"`
	BaseWIS      int `json:"base_wis" gorm:"column:wis;default:0"`
	BaseSPL      int `json:"base_spl" gorm:"column:spl;default:0"`
	BaseCON      int `json:"base_con" gorm:"column:con;default:0"`
	BaseCRT      int `json:"base_crt" gorm:"column:crt;default:0"`
	TalentPoints int `json:"talent_points" gorm:"column:talent_points;default:0"`

	// In-Memory Total Attributes (Base + Bonus, not saved to DB)
	STR int `json:"str" gorm:"-"`
	AGI int `json:"agi" gorm:"-"`
	VIT int `json:"vit" gorm:"-"`
	INT int `json:"int" gorm:"-"`
	DEX int `json:"dex" gorm:"-"`
	LUK int `json:"luk" gorm:"-"`

	// In-Memory Talent Attributes (Base + Bonus, not saved to DB)
	POW int `json:"pow" gorm:"-"`
	STA int `json:"sta" gorm:"-"`
	WIS int `json:"wis" gorm:"-"`
	SPL int `json:"spl" gorm:"-"`
	CON int `json:"con" gorm:"-"`
	CRT int `json:"crt" gorm:"-"`

	// In-Memory Bonus Attributes (aggregated from equipment and buffs, not saved to DB)
	BonusSTR int `json:"bonus_str" gorm:"-"`
	BonusAGI int `json:"bonus_agi" gorm:"-"`
	BonusVIT int `json:"bonus_vit" gorm:"-"`
	BonusINT int `json:"bonus_int" gorm:"-"`
	BonusDEX int `json:"bonus_dex" gorm:"-"`
	BonusLUK int `json:"bonus_luk" gorm:"-"`

	// In-Memory Bonus Talent Attributes (not saved to DB)
	BonusPOW int `json:"bonus_pow" gorm:"-"`
	BonusSTA int `json:"bonus_sta" gorm:"-"`
	BonusWIS int `json:"bonus_wis" gorm:"-"`
	BonusSPL int `json:"bonus_spl" gorm:"-"`
	BonusCON int `json:"bonus_con" gorm:"-"`
	BonusCRT int `json:"bonus_crt" gorm:"-"`

	// Dynamic Vitality Stats
	LastBasicAttackTime time.Time `json:"-" gorm:"-"`
	SpawnProtectedUntil time.Time `json:"-" gorm:"-"`

	// Dynamic Vitality Stats
	HP    float32 `json:"hp" gorm:"default:1000"`
	MaxHP float32 `json:"max_hp" gorm:"default:1000"`
	MP    float32 `json:"mp" gorm:"default:200"`
	MaxMP float32 `json:"max_mp" gorm:"default:200"`

	// Authoritative RPG Stats (Derived)
	Attack       float32 `json:"attack" gorm:"default:50"`
	MagicAttack  float32 `json:"magic_attack" gorm:"default:10"`
	Defense      float32 `json:"defense" gorm:"default:10"`
	MagicDefense float32 `json:"magic_defense" gorm:"default:10"`
	CriticalRate float32 `json:"critical_rate" gorm:"default:0.05"`
	Speed        float32 `json:"speed" gorm:"default:5.0"`
	ASPD         float32 `json:"aspd" gorm:"default:150"`

	// In-Memory Amplified Substats
	PATK      int `json:"p_atk" gorm:"-"`
	SMATK     int `json:"s_matk" gorm:"-"`
	RES       int `json:"res" gorm:"-"`
	MRES      int `json:"m_res" gorm:"-"`
	HRatePlus int `json:"h_plus" gorm:"-"`
	CRatePlus int `json:"c_rate" gorm:"-"`

	// RO Substats (In-Memory)
	HIT          int     `json:"hit" gorm:"-"`
	FLEE         int     `json:"flee" gorm:"-"`
	PerfectDodge float32 `json:"perfect_dodge" gorm:"-"`
	CastTime     float32 `json:"cast_time" gorm:"-"` // Cast speed multiplier (0.0 to 1.0)
	Debuff       string    `json:"debuff" gorm:"-"`
	DebuffUntil  time.Time `json:"-" gorm:"-"`
	DebuffImmuneUntil time.Time `json:"-" gorm:"-"`

	// Map Coordinate Persistence
	MapName string  `json:"map_name" gorm:"default:'Starter Zone'"`
	LastX   float32 `json:"last_x" gorm:"default:0"`
	LastY   float32 `json:"last_y" gorm:"default:0"`
	LastZ   float32 `json:"last_z" gorm:"default:0"`

	// Relational Associations
	Inventory []PlayerItem  `json:"inventory" gorm:"foreignKey:PlayerID;constraint:OnDelete:CASCADE"`
	Skills    []PlayerSkill `json:"skills" gorm:"foreignKey:PlayerID;constraint:OnDelete:CASCADE"`
	Quests    []PlayerQuest `json:"quests" gorm:"foreignKey:PlayerID;constraint:OnDelete:CASCADE"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RecalculateStats updates derived combat attributes based on Class, Attributes, Level and equipped Gear
func (p *Player) RecalculateStats() {
	// Safety check: ensure base stats have a minimum of 10 points
	if p.BaseSTR < 10 {
		p.BaseSTR = 10
	}
	if p.BaseAGI < 10 {
		p.BaseAGI = 10
	}
	if p.BaseVIT < 10 {
		p.BaseVIT = 10
	}
	if p.BaseINT < 10 {
		p.BaseINT = 10
	}
	if p.BaseDEX < 10 {
		p.BaseDEX = 10
	}
	if p.BaseLUK < 10 {
		p.BaseLUK = 10
	}

	// Safety check: ensure base talent stats have a minimum of 0 points
	if p.BasePOW < 0 {
		p.BasePOW = 0
	}
	if p.BaseSTA < 0 {
		p.BaseSTA = 0
	}
	if p.BaseWIS < 0 {
		p.BaseWIS = 0
	}
	if p.BaseSPL < 0 {
		p.BaseSPL = 0
	}
	if p.BaseCON < 0 {
		p.BaseCON = 0
	}
	if p.BaseCRT < 0 {
		p.BaseCRT = 0
	}

	// Reset bonuses
	p.BonusSTR = 0
	p.BonusAGI = 0
	p.BonusVIT = 0
	p.BonusINT = 0
	p.BonusDEX = 0
	p.BonusLUK = 0

	p.BonusPOW = 0
	p.BonusSTA = 0
	p.BonusWIS = 0
	p.BonusSPL = 0
	p.BonusCON = 0
	p.BonusCRT = 0

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

	p.POW = p.BasePOW + p.BonusPOW
	p.STA = p.BaseSTA + p.BonusSTA
	p.WIS = p.BaseWIS + p.BonusWIS
	p.SPL = p.BaseSPL + p.BonusSPL
	p.CON = p.BaseCON + p.BonusCON
	p.CRT = p.BaseCRT + p.BonusCRT

	// Compute Talent Stats Substat Amplifications
	p.PATK = p.POW * 1 + p.CON * 1
	p.SMATK = p.SPL * 1 + p.CON * 1
	p.RES = p.STA * 1 + (p.STA / 10) * 5
	p.MRES = p.WIS * 1 + (p.WIS / 10) * 5
	p.HRatePlus = p.CRT * 1
	p.CRatePlus = p.CRT * 1

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
	// Status ATK (Melee) = STR + floor(DEX/5) + floor(LUK/3) + floor(BaseLevel/4) + (POW * 5)
	// Status MATK = INT + floor(DEX/5) + floor(LUK/3) + floor(BaseLevel/4) + (SPL * 5)
	baseMeleeATK := float32(p.STR) + float32(p.DEX/5) + float32(p.LUK/3) + float32(p.Level/4) + float32(p.POW*5)
	baseMATK := float32(p.INT) + float32(p.DEX/5) + float32(p.LUK/3) + float32(p.Level/4) + float32(p.SPL*5)

	isRanged := p.Class == "Beginner" // Beginner uses gun/ranged (MM)
	if isRanged {
		p.Attack = float32(p.DEX) + float32(p.STR/5) + float32(p.LUK/3) + float32(p.Level/4) + float32(p.POW*5)
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
	classMult := float32(1.0)
	switch p.Class {
	case "Thief": // Assassin
		classMult = 1.4
	case "Warrior": // Fighter
		classMult = 1.1
	case "Mage":
		classMult = 0.9
	case "Beginner": // Marksman / MM
		classMult = 1.05
	case "Priest": // Tank
		classMult = 1.0
	}
	p.Speed = (5.0 + float32(p.AGI)*0.015) * classMult

	// 5. HIT & FLEE & PerfectDodge & CastTime calculation (100% iROWiki match, augmented with CON)
	p.HIT = 175 + p.Level + p.DEX + (p.LUK / 3) + (p.CON * 2)
	p.FLEE = 100 + p.Level + p.AGI + (p.LUK / 5) + (p.CON * 2)
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
	// Convert RO ASPD (130-193 scale) to our percentage scale (0-1000%)
	// roASPD 130 = 0%, roASPD 150 = ~317%, roASPD 180 = ~793%, roASPD 193 = 1000%
	roASPDMin := 130.0
	roASPDMax := 193.0
	percentASPD := ((roASPD - roASPDMin) / (roASPDMax - roASPDMin)) * 1000.0
	if percentASPD < 0 {
		percentASPD = 0
	}
	p.ASPD = float32(percentASPD)

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

// PlayerRepository defines the persistence contract for Player entities
type PlayerRepository interface {
	Create(player *Player) error
	GetByID(id string) (*Player, error)
	GetByUsername(username string) (*Player, error)
	GetByUserID(userID string) ([]*Player, error)
	Update(player *Player) error
}
