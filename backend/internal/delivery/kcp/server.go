package kcp

import (
	"fmt"
	"io"
	"log"
	"strings"
	"sync"

	"mmorpg-backend/internal/domain"
	"mmorpg-backend/internal/usecase/auth"
	"mmorpg-backend/internal/usecase/game"

	"github.com/vmihailenco/msgpack/v5"
	"github.com/xtaci/kcp-go/v5"
)

// KCPIncomingMessage mirrors WSIncomingMessage but is optimized for KCP
type KCPIncomingMessage struct {
	Action      string  `msgpack:"action"` // "auth", "move", "attack", "distribute_stat", "equip_item", "use_item", "cast_skill", "change_class", "chat"
	Token       string  `msgpack:"token"`
	CharacterID string  `msgpack:"character_id"`
	X           float64 `msgpack:"x"`
	Y           float64 `msgpack:"y"`
	Z           float64 `msgpack:"z"`
	Rotation    float64 `msgpack:"rotation"`
	Animation   string  `msgpack:"animation"`

	// Combat Payload
	TargetType string  `msgpack:"targetType"` // "monster", "player"
	TargetID   string  `msgpack:"targetId"`
	Damage     float64 `msgpack:"damage"`
	IsCrit     bool    `msgpack:"isCrit"`

	// RPG Attributes Payload
	Stat         string `msgpack:"stat"` // str, int, con, vit, wis, luk
	Amount       int    `msgpack:"amount"`
	PlayerItemID string `msgpack:"playerItemId"`
	SkillID      string `msgpack:"skillId"`
	NewClass     string `msgpack:"newClass"`
	Msg          string `msgpack:"msg"`
}

// KCPServer manages real-time high-speed UDP/KCP connections
type KCPServer struct {
	gameUsecase   game.GameUsecase
	authUsecase   auth.AuthUsecase
	sessions      map[string]*kcp.UDPSession // PlayerID -> Connection
	sessionsMu    sync.RWMutex
	chatCallback  func(sender string, msg string) // Bridge to WS Hub for cross-transport chat
	playerNames   map[string]string               // PlayerID -> Username for chat display
	playerNamesMu sync.RWMutex
}

// SetChatCallback injects a function to broadcast chat messages across transports (WS + KCP)
func (s *KCPServer) SetChatCallback(cb func(sender string, msg string)) {
	s.chatCallback = cb
}

// NewKCPServer creates a new instance of KCP Server
func NewKCPServer(gameUsecase game.GameUsecase, authUsecase auth.AuthUsecase) *KCPServer {
	return &KCPServer{
		gameUsecase: gameUsecase,
		authUsecase: authUsecase,
		sessions:    make(map[string]*kcp.UDPSession),
		playerNames: make(map[string]string),
	}
}

// Start binds and listens on KCP UDP port
func (s *KCPServer) Start(addr string) {
	listener, err := kcp.ListenWithOptions(addr, nil, 10, 3)
	if err != nil {
		log.Fatalf("❌ Gagal menjalankan KCP server di %s: %v", addr, err)
	}
	defer listener.Close()

	fmt.Printf("⚡ KCP Authoritative Server listening on UDP %s\n", addr)

	for {
		sess, err := listener.AcceptKCP()
		if err != nil {
			fmt.Printf("⚠️ [KCP] Gagal menerima koneksi: %v\n", err)
			continue
		}

		// Apply optimal gaming configuration for lowest possible latency:
		// nodelay=1 (NoDelay enabled)
		// interval=10ms (Internal update clock speed, default 40ms)
		// resend=2 (Fast retransmit triggers after 2 duplicate ACKs, instead of standard 4)
		// nc=1 (Disable congestion control to prevent flow throttling on packet loss)
		sess.SetNoDelay(1, 10, 2, 1)
		sess.SetWindowSize(128, 128)
		sess.SetMtu(1400)

		go s.handleSession(sess)
	}
}

// handleSession processes KCP session lifecycle
func (s *KCPServer) handleSession(sess *kcp.UDPSession) {
	defer sess.Close()

	var playerID string
	var authenticated bool

	// 1KB buffer is plenty for MMORPG actions
	buf := make([]byte, 1024)
	var username string

	for {
		n, err := sess.Read(buf)
		if err != nil {
			if err != io.EOF {
				// Don't flood logs with client disconnect warnings
			}
			break
		}

		var msg KCPIncomingMessage
		if err := msgpack.Unmarshal(buf[:n], &msg); err != nil {
			continue
		}

		if !authenticated {
			if msg.Action == "auth" {
				userID, err := s.authUsecase.ValidateToken(msg.Token)
				if err != nil {
					fmt.Printf("❌ [KCP] Gagal autentikasi token KCP: %v\n", err)
					break
				}
				_ = userID // Auth succeeded!

				playerID = msg.CharacterID
				authenticated = true

				// Resolve username from active player or fallback to ID
				if p := s.gameUsecase.GetActivePlayer(playerID); p != nil {
					username = p.Username
				} else {
					username = playerID
				}

				s.sessionsMu.Lock()
				s.sessions[playerID] = sess
				s.sessionsMu.Unlock()

				s.playerNamesMu.Lock()
				s.playerNames[playerID] = username
				s.playerNamesMu.Unlock()

				// Register in game simulation (if not registered already by WebSocket)
				// The backend GameUsecase handles double registration gracefully.
				s.gameUsecase.RegisterPlayer(playerID, username)

				// Send auth success reply over KCP
				reply, _ := msgpack.Marshal(map[string]interface{}{
					"action": "auth_ok",
					"status": "connected",
				})
				_, _ = sess.Write(reply)

				fmt.Printf("✅ [KCP] Player %s terhubung dan terautentikasi melalui UDP/KCP!\n", playerID)
			} else {
				// Drop non-auth messages for unauthenticated sessions
				continue
			}
		} else {
			// Process authenticated packets
			switch msg.Action {
			case "move":
				s.gameUsecase.UpdatePlayerMovement(
					playerID,
					float32(msg.X),
					float32(msg.Y),
					float32(msg.Z),
					float32(msg.Rotation),
					msg.Animation,
					msg.TargetID,
				)
			case "attack":
				s.gameUsecase.HandlePlayerAttack(playerID, msg.TargetType, msg.TargetID, float32(msg.Damage), msg.IsCrit)
			case "distribute_stat":
				s.gameUsecase.DistributeStatPoints(playerID, msg.Stat, msg.Amount)
			case "equip_item":
				s.gameUsecase.EquipPlayerItem(playerID, msg.PlayerItemID)
			case "use_item":
				s.gameUsecase.UseConsumable(playerID, msg.PlayerItemID)
			case "cast_skill":
				s.gameUsecase.CastPlayerSkill(playerID, msg.SkillID, msg.TargetID)
			case "change_class":
				s.gameUsecase.ChangeClass(playerID, msg.NewClass)
			case "buy_item":
				_ = s.gameUsecase.BuyItem(playerID, msg.PlayerItemID, msg.Amount)
			case "sell_item":
				_ = s.gameUsecase.SellItem(playerID, msg.PlayerItemID)
			case "create_party":
				s.gameUsecase.CreateParty(playerID)
			case "invite_party":
				s.gameUsecase.InviteToParty(playerID, msg.TargetID)
			case "leave_party":
				s.gameUsecase.LeaveParty(playerID)
			case "chat":
				if s.chatCallback != nil {
					if strings.HasPrefix(msg.Msg, "/reload") || strings.HasPrefix(msg.Msg, "/sync") {
						err := s.gameUsecase.SyncPlayerStatsFromDB(playerID)
						if err != nil {
							s.chatCallback("Server", fmt.Sprintf("❌ Gagal sinkronisasi data database untuk %s: %v", username, err))
						} else {
							s.chatCallback("Server", fmt.Sprintf("🔄 Sukses sinkronisasi data database untuk %s!", username))
						}
					} else {
						s.chatCallback(username, msg.Msg)
					}
				}
			default:
				if msg.Action == "" {
					s.gameUsecase.UpdatePlayerMovement(
						playerID,
						float32(msg.X),
						float32(msg.Y),
						float32(msg.Z),
						float32(msg.Rotation),
						msg.Animation,
						msg.TargetID,
					)
				}
			}
		}
	}

	// Cleanup on disconnect — MUST unregister from game simulation to prevent ghost players
	if playerID != "" {
		s.sessionsMu.Lock()
		delete(s.sessions, playerID)
		s.sessionsMu.Unlock()

		s.playerNamesMu.Lock()
		delete(s.playerNames, playerID)
		s.playerNamesMu.Unlock()

		// Critical: remove player from the authoritative game simulation
		s.gameUsecase.UnregisterPlayer(playerID)

		fmt.Printf("❌ [KCP] Player %s (%s) terputus dan di-unregister dari simulasi\n", username, playerID)
	}
}

// BroadcastGenericJSON sends a JSON event (combat events, chat, etc.) to all KCP sessions
func (s *KCPServer) BroadcastGenericJSON(payload interface{}) {
	s.sessionsMu.RLock()
	defer s.sessionsMu.RUnlock()

	if len(s.sessions) == 0 {
		return
	}

	data, err := msgpack.Marshal(payload)
	if err != nil {
		return
	}

	for _, sess := range s.sessions {
		_, _ = sess.Write(data)
	}
}

// BroadcastGameState sends authoritative Tick game states to all UDP/KCP players
func (s *KCPServer) BroadcastGameState(payload domain.GameStatePayload) {
	s.sessionsMu.RLock()
	defer s.sessionsMu.RUnlock()

	if len(s.sessions) == 0 {
		return
	}

	data, err := msgpack.Marshal(payload)
	if err != nil {
		return
	}

	for _, sess := range s.sessions {
		// Non-blocking UDP send
		_, _ = sess.Write(data)
	}
}
