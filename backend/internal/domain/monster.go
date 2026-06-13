package domain

import (
	"encoding/json"
	"time"
)

// DropEntry represents a single item that can drop from a monster
type DropEntry struct {
	ItemID     string  `json:"item_id"`
	Name       string  `json:"name"`
	Type       string  `json:"type"`      // equipment, consumable, material
	SlotType   string  `json:"slot_type"` // weapon, armor, helmet, boots, accessory (for equipment)
	Chance     float32 `json:"chance"`    // 0.0–1.0 drop probability
	Quantity   int     `json:"quantity"`  // how many drop on success
	AddHP      float32 `json:"add_hp"`
	AddMP      float32 `json:"add_mp"`
	AddAttack  float32 `json:"add_attack"`
	AddDefense float32 `json:"add_defense"`
}

// MonsterSkill represents a single skill that a monster can use in combat.
// Stored as JSON in the database and parsed at runtime.
type MonsterSkill struct {
	Name         string  `json:"name"`           // e.g., "Poison Spit", "Charge", "Dark Nova"
	Type         string  `json:"type"`           // melee, ranged, aoe, buff
	CooldownMs   int     `json:"cooldown_ms"`    // cooldown in milliseconds
	Range        float32 `json:"range"`          // skill activation range in world units
	DamageMult   float32 `json:"damage_mult"`    // multiplier on base Attack (1.0 = same as basic attack)
	Effect       string  `json:"effect"`         // poison, bleed, stun, slow, knockback, atk_buff, def_buff, lifesteal, none
	EffectDurSec float32 `json:"effect_dur_sec"` // duration of the effect in seconds
	EffectValue  float32 `json:"effect_value"`   // effect magnitude (e.g., DoT damage/sec, buff %, slow %)
	AoERadius    float32 `json:"aoe_radius"`     // for aoe type: radius of area-of-effect
	Hits         int     `json:"hits"`           // number of hits (for multi-hit skills like Rampage)
}

// MonsterConfig represents the dynamic database configuration for a monster type
type MonsterConfig struct {
	Type       string    `json:"type" gorm:"primaryKey"` // e.g., "goblin", "orc", "slime", "boss"
	Name       string    `json:"name"`
	Level      int       `json:"level"`
	HP         float32   `json:"hp"`
	MaxHP      float32   `json:"max_hp"`
	Attack     float32   `json:"attack"`
	Defense    float32   `json:"defense"`
	Speed      float32   `json:"speed"`
	AggroRange float32   `json:"aggro_range"`
	GoldDrop   int       `json:"gold_drop"`
	XPDrop     int       `json:"xp_drop"`
	DropTable  string    `json:"drop_table" gorm:"type:text"` // JSON array of DropEntry
	Skills     string    `json:"skills" gorm:"type:text"`     // JSON array of MonsterSkill
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// ParseDropTable parses the JSON drop table string into structured entries
func (m *MonsterConfig) ParseDropTable() []DropEntry {
	if m.DropTable == "" {
		return nil
	}
	var entries []DropEntry
	if err := json.Unmarshal([]byte(m.DropTable), &entries); err != nil {
		return nil
	}
	return entries
}

// ParseSkills parses the JSON skills string into structured MonsterSkill entries
func (m *MonsterConfig) ParseSkills() []MonsterSkill {
	if m.Skills == "" {
		return nil
	}
	var skills []MonsterSkill
	if err := json.Unmarshal([]byte(m.Skills), &skills); err != nil {
		return nil
	}
	return skills
}

type Monster struct {
	ID             string    `json:"id" msgpack:"id"`
	Name           string    `json:"name" msgpack:"name"`
	Type           string    `json:"type" msgpack:"type"` // e.g., "goblin", "orc", "boss"
	Level          int       `json:"level" msgpack:"level"`
	Position       Vector3   `json:"position" msgpack:"position"`
	SpawnPosition  Vector3   `json:"spawn_position" msgpack:"spawn_position"`
	HP             float32   `json:"hp" msgpack:"hp"`
	MaxHP          float32   `json:"max_hp" msgpack:"max_hp"`
	Attack         float32   `json:"attack" msgpack:"attack"`
	Defense        float32   `json:"defense" msgpack:"defense"` // Reduces damage taken
	Speed          float32   `json:"speed" msgpack:"speed"`
	AggroRange     float32   `json:"aggro_range" msgpack:"aggro_range"`
	TargetPlayerID string    `json:"target_player_id" msgpack:"target_player_id"` // ID of the player currently targeted
	Animation      string    `json:"animation" msgpack:"animation"`               // Server-authoritative: "idle", "walk", "run", "attack", "death"
	AIState        string    `json:"ai_state" msgpack:"ai_state"`                 // Authoritative FSM state: "idle", "patrol", "chase", "attack", "casting", "returning", "dead"
	IsDead         bool      `json:"is_dead" msgpack:"is_dead"`
	RespawnTime    time.Time `json:"respawn_time" msgpack:"respawn_time"`
	GoldDrop       int       `json:"gold_drop" msgpack:"gold_drop"`
	XPDrop         int       `json:"xp_drop" msgpack:"xp_drop"`
	LastAttackTime time.Time `json:"-" msgpack:"-"` // Tracks server-authoritative attack cooldown
	LastHitTime    time.Time `json:"-" msgpack:"-"` // Tracks server-authoritative stagger/flinch lock

	// ─── Skill System ────────────────────────────────────────────────────────────
	Skills          []MonsterSkill       `json:"-" msgpack:"-"`                         // Parsed from MonsterConfig.Skills at spawn time
	SkillCooldowns  map[string]time.Time `json:"-" msgpack:"-"`                         // Per-skill cooldown expiry timestamps
	CurrentSkill    string               `json:"current_skill" msgpack:"current_skill"` // Currently executing skill name (broadcast to clients)
	CastEndTime     time.Time            `json:"-" msgpack:"-"`                         // When the current cast finishes
	BuffAttackMult  float32              `json:"-" msgpack:"-"`                         // Active attack buff multiplier (1.0 = no buff)
	BuffDefenseMult float32              `json:"-" msgpack:"-"`                         // Active defense buff multiplier (1.0 = no buff)
	BuffExpiresAt   time.Time            `json:"-" msgpack:"-"`                         // When the active buff expires
	IsRanged        bool                 `json:"-" msgpack:"-"`                         // Whether this monster prefers ranged combat
	PreferredRange  float32              `json:"-" msgpack:"-"`                         // Preferred combat distance for ranged monsters
}

func (m *Monster) TakeDamage(amount float32) {
	if m.IsDead {
		return
	}
	m.HP -= amount
	m.LastHitTime = time.Now()
	if m.HP <= 0 {
		m.HP = 0
		m.IsDead = true
		m.RespawnTime = time.Now().Add(10 * time.Second) // 10 second respawn timer
		m.AIState = "dead"
	}
}

func (m *Monster) Respawn() {
	m.HP = m.MaxHP
	m.Position = m.SpawnPosition
	m.IsDead = false
	m.TargetPlayerID = ""
	m.AIState = "idle"
	m.CurrentSkill = ""
	m.BuffAttackMult = 1.0
	m.BuffDefenseMult = 1.0
	// Reset all skill cooldowns on respawn
	for k := range m.SkillCooldowns {
		delete(m.SkillCooldowns, k)
	}
}
