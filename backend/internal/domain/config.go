package domain

import "time"

// ClassConfig represents the combat balance configuration for a specific unit class
type ClassConfig struct {
	ID                string    `json:"id" gorm:"primaryKey"` // e.g., "fighter", "tank", "mage", "marksman", "assassin", "enemy_grunt", "enemy_boss"
	HP                float32   `json:"hp"`
	HPRegen           float32   `json:"hp_regen"`
	ATK               float32   `json:"atk"`
	PhysicalDefense   float32   `json:"physical_defense"`
	MagicDefense      float32   `json:"magic_defense"`
	PhysicalPen       float32   `json:"physical_pen"`
	MagicPen          float32   `json:"magic_pen"`
	Lifesteal         float32   `json:"lifesteal"`
	SpellVamp         float32   `json:"spell_vamp"`
	MoveSpeedMult     float32   `json:"move_speed_mult"`
	AttackSpeedMult   float32   `json:"attack_speed_mult"`
	CritChance        float32   `json:"crit_chance"`
	CritDamage        float32   `json:"crit_damage"`
	Range             float32   `json:"range"`
	Tenacity          float32   `json:"tenacity"`
	CooldownReduction float32   `json:"cooldown_reduction"`
	SkillCooldown     float32   `json:"skill_cooldown"`
	SkillRange        float32   `json:"skill_range"`
	SkillDuration     float32   `json:"skill_duration"`

	// Flattened AI Behavior Configurations
	AISeparation       float32 `json:"ai_separation"`
	AIEncirclement     float32 `json:"ai_encirclement"`
	AISwagger          float32 `json:"ai_swagger"`
	AIPerceptionRadius float32 `json:"ai_perception_radius"`
	AIChaseRange       float32 `json:"ai_chase_range"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// SimulationSetting represents global combat engine settings
type SimulationSetting struct {
	ID                     string    `json:"id" gorm:"primaryKey;default:'default'"` // Active settings row ID: "default"
	GlobalHpMultiplier     float32   `json:"globalHpMultiplier"`
	GlobalSpeedMultiplier   float32   `json:"globalSpeedMultiplier"`
	GlobalDamageMultiplier  float32   `json:"globalDamageMultiplier"`
	GlobalAttackCooldown   float32   `json:"globalAttackCooldown"`
	CritChance             float32   `json:"critChance"`
	PerceptionRadiusSq     float32   `json:"perceptionRadiusSq"`
	SeparationRadius       float32   `json:"separationRadius"`
	SeparationStrength     float32   `json:"separationStrength"`
	EncirclementRadius     float32   `json:"encirclementRadius"`
	EncirclementJitter     float32   `json:"encirclementJitter"`
	RotationSmoothing      float32   `json:"rotationSmoothing"`
	LaneSwaggerAmp         float32   `json:"laneSwaggerAmp"`
	VictoryPauseMs         int       `json:"victoryPauseMs"`
	LanePenalty            int       `json:"lanePenalty"`
	BaseProximityBonus     int       `json:"baseProximityBonus"`
	BaseDefenseThreshold   int       `json:"baseDefenseThreshold"`
	BaseAttackResponseBonus int       `json:"baseAttackResponseBonus"`
	BossPriorityBonus      int       `json:"bossPriorityBonus"`
	LowHpBonus             int       `json:"lowHpBonus"`
	LaneSpringFar          float32   `json:"laneSpringFar"`
	LaneSpringNear         float32   `json:"laneSpringNear"`
	LaneDriftThreshold     float32   `json:"laneDriftThreshold"`
	TimeScale              float32   `json:"timeScale"`
	UnitScale              float32   `json:"unitScale"`
	VfxIntensity           float32   `json:"vfxIntensity"`
	MaxUnits               int       `json:"maxUnits"`
	PotatoMode             bool      `json:"potatoMode"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ConfigRepository interface for database operations
type ConfigRepository interface {
	GetClassConfigs() ([]ClassConfig, error)
	GetClassConfig(classID string) (*ClassConfig, error)
	SaveClassConfig(cfg *ClassConfig) error
	GetSimulationSettings() (*SimulationSetting, error)
	SaveSimulationSettings(cfg *SimulationSetting) error
	
	// Dynamic Monster Configurations
	GetMonsterConfigs() ([]MonsterConfig, error)
	GetMonsterConfig(mType string) (*MonsterConfig, error)
	SaveMonsterConfig(cfg *MonsterConfig) error
	DeleteMonsterConfig(mType string) error
}
