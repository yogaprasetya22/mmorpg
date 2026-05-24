package kcp

import (
	"fmt"
	"io"
	"log"
	"sync"

	"github.com/vmihailenco/msgpack/v5"
	"github.com/xtaci/kcp-go/v5"
	"mmorpg-backend/internal/domain"
	"mmorpg-backend/internal/usecase/auth"
	"mmorpg-backend/internal/usecase/game"
)

// KCPIncomingMessage mirrors WSIncomingMessage but is optimized for KCP
type KCPIncomingMessage struct {
	Action      string  `msgpack:"action"` // "auth", "move"
	Token       string  `msgpack:"token"`
	CharacterID string  `msgpack:"character_id"`
	X           float64 `msgpack:"x"`
	Y           float64 `msgpack:"y"`
	Z           float64 `msgpack:"z"`
	Rotation    float64 `msgpack:"rotation"`
	Animation   string  `msgpack:"animation"`
	TargetID    string  `msgpack:"targetId"`
}

// KCPServer manages real-time high-speed UDP/KCP connections
type KCPServer struct {
	gameUsecase game.GameUsecase
	authUsecase auth.AuthUsecase
	sessions    map[string]*kcp.UDPSession // PlayerID -> Connection
	sessionsMu  sync.RWMutex
}

// NewKCPServer creates a new instance of KCP Server
func NewKCPServer(gameUsecase game.GameUsecase, authUsecase auth.AuthUsecase) *KCPServer {
	return &KCPServer{
		gameUsecase: gameUsecase,
		authUsecase: authUsecase,
		sessions:    make(map[string]*kcp.UDPSession),
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

				s.sessionsMu.Lock()
				s.sessions[playerID] = sess
				s.sessionsMu.Unlock()

				// Register in game simulation (if not registered already by WebSocket)
				// The backend GameUsecase handles double registration gracefully.
				s.gameUsecase.RegisterPlayer(playerID, "KCPPlayer")

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
			}
		}
	}

	// Cleanup on disconnect
	if playerID != "" {
		s.sessionsMu.Lock()
		delete(s.sessions, playerID)
		s.sessionsMu.Unlock()
		
		fmt.Printf("❌ [KCP] Player %s terputus dari UDP/KCP\n", playerID)
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
