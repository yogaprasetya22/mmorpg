package domain

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
}

type GameStatePayload struct {
	Players  []PlayerNetworkState `json:"players" msgpack:"players"`
	Monsters []Monster            `json:"monsters" msgpack:"monsters"`
}
