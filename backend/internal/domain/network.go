package domain

// PlayerNetworkState is the minimal real-time position + status snapshot sent to all clients.
// Only contains fields the renderer needs — keeps msgpack payload small.
type PlayerNetworkState struct {
	ID              string  `json:"id" msgpack:"id"`
	X               float32 `json:"x" msgpack:"x"`
	Y               float32 `json:"y" msgpack:"y"`
	Z               float32 `json:"z" msgpack:"z"`
	Rotation        float32 `json:"rotation" msgpack:"rotation"`
	Animation       string  `json:"animation" msgpack:"animation"`
	Class           string  `json:"class" msgpack:"class"`
	Gender          string  `json:"gender" msgpack:"gender"`
	Username        string  `json:"username" msgpack:"username"`
	TargetID        string  `json:"targetId" msgpack:"targetId"`
	HP              float32 `json:"hp" msgpack:"hp"`
	MaxHP           float32 `json:"maxHp" msgpack:"maxHp"`
	MP              float32 `json:"mp" msgpack:"mp"`
	MaxMP           float32 `json:"maxMp" msgpack:"maxMp"`
	Gold            int     `json:"gold" msgpack:"gold"`
	Level           int     `json:"level" msgpack:"level"`
	ASPD            float32 `json:"aspd" msgpack:"aspd"`
	XP              int     `json:"xp" msgpack:"xp"`
	CustomAvatarURL string  `json:"custom_avatar_url" msgpack:"custom_avatar_url"`
	HairStyle       int     `json:"hair_style" msgpack:"hair_style"`
	HairColor       string  `json:"hair_color" msgpack:"hair_color"`
	EquippedWeaponCategory string `json:"equipped_weapon_category" msgpack:"equipped_weapon_category"` // sword, bow, staff, dagger, mace

	// Talent Stats
	BasePOW      int `json:"base_pow" msgpack:"base_pow"`
	BaseSTA      int `json:"base_sta" msgpack:"base_sta"`
	BaseWIS      int `json:"base_wis" msgpack:"base_wis"`
	BaseSPL      int `json:"base_spl" msgpack:"base_spl"`
	BaseCON      int `json:"base_con" msgpack:"base_con"`
	BaseCRT      int `json:"base_crt" msgpack:"base_crt"`
	TalentPoints int `json:"talent_points" msgpack:"talent_points"`

	// Amplified Substats
	PATK  int `json:"p_atk" msgpack:"p_atk"`
	SMATK int `json:"s_matk" msgpack:"s_matk"`
	RES   int `json:"res" msgpack:"res"`
	MRES  int `json:"m_res" msgpack:"m_res"`
	HPLUS int `json:"h_plus" msgpack:"h_plus"`
	CRATE int `json:"c_rate" msgpack:"c_rate"`

	// Base Primary Stats
	BaseSTR    int `json:"base_str" msgpack:"base_str"`
	BaseAGI    int `json:"base_agi" msgpack:"base_agi"`
	BaseVIT    int `json:"base_vit" msgpack:"base_vit"`
	BaseINT    int `json:"base_int" msgpack:"base_int"`
	BaseDEX    int `json:"base_dex" msgpack:"base_dex"`
	BaseLUK    int `json:"base_luk" msgpack:"base_luk"`
	StatPoints int `json:"stat_points" msgpack:"stat_points"`

	// Derived Combat Stats
	Attack       float32 `json:"attack" msgpack:"attack"`
	MagicAttack  float32 `json:"magic_attack" msgpack:"magic_attack"`
	Defense      float32 `json:"defense" msgpack:"defense"`
	MagicDefense float32 `json:"magic_defense" msgpack:"magic_defense"`
	CriticalRate float32 `json:"critical_rate" msgpack:"critical_rate"`
	Speed        float32 `json:"speed" msgpack:"speed"`
	HIT          int     `json:"hit" msgpack:"hit"`
	FLEE         int     `json:"flee" msgpack:"flee"`
	PerfectDodge float32 `json:"perfect_dodge" msgpack:"perfect_dodge"`
	CastTime     float32 `json:"cast_time" msgpack:"cast_time"`
	Debuff       string  `json:"debuff" msgpack:"debuff"`
}

// MonsterNetworkState is the minimal monster snapshot broadcast over WebSocket each tick.
// Much smaller than the full domain.Monster struct — avoids serializing internal AI state,
// spawn position, defense, attack stats, etc. that the client never needs per frame.
type MonsterNetworkState struct {
	ID             string  `json:"id" msgpack:"id"`
	Name           string  `json:"name" msgpack:"name"`
	Type           string  `json:"type" msgpack:"type"`
	Level          int     `json:"level" msgpack:"level"`
	X              float32 `json:"x" msgpack:"x"`
	Y              float32 `json:"y" msgpack:"y"`
	Z              float32 `json:"z" msgpack:"z"`
	HP             float32 `json:"hp" msgpack:"hp"`
	MaxHP          float32 `json:"max_hp" msgpack:"max_hp"`
	IsDead         bool    `json:"is_dead" msgpack:"is_dead"`
	TargetPlayerID string  `json:"target_player_id" msgpack:"target_player_id"`
	Animation      string  `json:"animation" msgpack:"animation"`
	AIState        string  `json:"ai_state" msgpack:"ai_state"`
	CurrentSkill   string  `json:"current_skill" msgpack:"current_skill"` // Active skill being cast/used
}

// GameStatePayload is the full world snapshot broadcast to every connected client each tick.
// Uses MonsterNetworkState (not domain.Monster) to minimise serialisation cost.
type GameStatePayload struct {
	Players  []PlayerNetworkState  `json:"players" msgpack:"players"`
	Monsters []MonsterNetworkState `json:"monsters" msgpack:"monsters"`
}
