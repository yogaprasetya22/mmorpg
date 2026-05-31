package domain

import "time"

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
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
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
	Animation      string    `json:"animation" msgpack:"animation"`        // Server-authoritative: "idle", "walk", "run", "attack", "death"
	AIState        string    `json:"ai_state" msgpack:"ai_state"`          // Authoritative FSM state: "idle", "patrol", "chase", "attack", "returning", "dead"
	IsDead         bool      `json:"is_dead" msgpack:"is_dead"`
	RespawnTime    time.Time `json:"respawn_time" msgpack:"respawn_time"`
	GoldDrop       int       `json:"gold_drop" msgpack:"gold_drop"`
	XPDrop         int       `json:"xp_drop" msgpack:"xp_drop"`
	LastAttackTime time.Time `json:"-" msgpack:"-"` // Tracks server-authoritative attack cooldown
	LastHitTime    time.Time `json:"-" msgpack:"-"` // Tracks server-authoritative stagger/flinch lock
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
}
