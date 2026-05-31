package domain

// PlayerNetworkState is the minimal real-time position + status snapshot sent to all clients.
// Only contains fields the renderer needs — keeps msgpack payload small.
type PlayerNetworkState struct {
	ID        string  `json:"id" msgpack:"id"`
	X         float32 `json:"x" msgpack:"x"`
	Y         float32 `json:"y" msgpack:"y"`
	Z         float32 `json:"z" msgpack:"z"`
	Rotation  float32 `json:"rotation" msgpack:"rotation"`
	Animation string  `json:"animation" msgpack:"animation"`
	Class     string  `json:"class" msgpack:"class"`
	Gender    string  `json:"gender" msgpack:"gender"`
	Username  string  `json:"username" msgpack:"username"`
	TargetID  string  `json:"targetId" msgpack:"targetId"`
	HP        float32 `json:"hp" msgpack:"hp"`
	MaxHP     float32 `json:"maxHp" msgpack:"maxHp"`
	Gold      int     `json:"gold" msgpack:"gold"`
	Level     int     `json:"level" msgpack:"level"`
	ASPD      float32 `json:"aspd" msgpack:"aspd"`
}

// MonsterNetworkState is the minimal monster snapshot broadcast over WebSocket each tick.
// Much smaller than the full domain.Monster struct — avoids serializing internal AI state,
// spawn position, defense, attack stats, etc. that the client never needs per frame.
type MonsterNetworkState struct {
	ID             string  `json:"id" msgpack:"id"`
	Name           string  `json:"name" msgpack:"name"`
	Type           string  `json:"type" msgpack:"type"`
	X              float32 `json:"x" msgpack:"x"`
	Y              float32 `json:"y" msgpack:"y"`
	Z              float32 `json:"z" msgpack:"z"`
	HP             float32 `json:"hp" msgpack:"hp"`
	MaxHP          float32 `json:"max_hp" msgpack:"max_hp"`
	IsDead         bool    `json:"is_dead" msgpack:"is_dead"`
	TargetPlayerID string  `json:"target_player_id" msgpack:"target_player_id"`
	Animation      string  `json:"animation" msgpack:"animation"`
	AIState        string  `json:"ai_state" msgpack:"ai_state"`
}

// GameStatePayload is the full world snapshot broadcast to every connected client each tick.
// Uses MonsterNetworkState (not domain.Monster) to minimise serialisation cost.
type GameStatePayload struct {
	Players  []PlayerNetworkState  `json:"players" msgpack:"players"`
	Monsters []MonsterNetworkState `json:"monsters" msgpack:"monsters"`
}
