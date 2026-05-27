package ws

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/vmihailenco/msgpack/v5"
	"mmorpg-backend/internal/domain"
	"mmorpg-backend/internal/usecase/game"
)

// sendBufSize — large enough for 50 concurrent clients without dropping frames at 20Hz tick.
// 50ms tick @ 20Hz = each client's goroutine should never queue more than ~3 frames.
// 32 slots provides ample headroom even under transient network spikes.
const sendBufSize = 32

type Hub struct {
	// Registered connections
	clients   map[*Client]bool
	clientsMu sync.RWMutex

	// Inbound messages from clients to broadcast (unused directly if server-authoritative tick)
	Broadcast chan []byte

	// Register requests from the clients
	Register chan *Client

	// Unregister requests from clients
	Unregister chan *Client

	// Game Engine Usecase
	gameUsecase game.GameUsecase
}

func NewHub(gameUsecase game.GameUsecase) *Hub {
	return &Hub{
		// Broadcast buffer sized to handle bursts without stalling the game loop goroutine.
		// With 50 players, fan-out per tick takes ~1-5ms; a buffer of 16 prevents back-pressure.
		Broadcast:   make(chan []byte, 16),
		Register:    make(chan *Client, 32),
		Unregister:  make(chan *Client, 32),
		clients:     make(map[*Client]bool),
		gameUsecase: gameUsecase,
	}
}

func (h *Hub) Run() {
	fmt.Println("🌐 WebSocket Hub is running...")
	for {
		select {
		case client := <-h.Register:
			h.clientsMu.Lock()
			h.clients[client] = true
			h.clientsMu.Unlock()

			// Register player into the simulation engine
			h.gameUsecase.RegisterPlayer(client.PlayerID, client.Username)

		case client := <-h.Unregister:
			h.clientsMu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)

				// Unregister player from the simulation engine
				h.gameUsecase.UnregisterPlayer(client.PlayerID)
			}
			h.clientsMu.Unlock()

		case message := <-h.Broadcast:
			// Snapshot client list under read-lock (very fast)
			h.clientsMu.RLock()
			targets := make([]*Client, 0, len(h.clients))
			for client := range h.clients {
				targets = append(targets, client)
			}
			h.clientsMu.RUnlock()

			// Fan-out: dispatch to each client's send goroutine concurrently.
			// Each client's WritePump reads from its own Send channel — no blocking here.
			// Non-blocking send: if buffer is full, the client is lagging — drop frame for that client only.
			for _, client := range targets {
				select {
				case client.Send <- message:
				default:
					// Client send buffer full — drop this frame for this slow client only.
					// This protects fast clients from being held back by one slow connection.
				}
			}
		}
	}
}

func (h *Hub) BroadcastGameState(payload domain.GameStatePayload) {
	data, err := msgpack.Marshal(payload)
	if err != nil {
		return
	}

	// Non-blocking send to broadcast channel.
	// If the hub is still processing the previous broadcast (unlikely at 20Hz),
	// drop this frame rather than stalling the game loop goroutine.
	select {
	case h.Broadcast <- data:
	default:
		// Game loop is producing faster than hub can fan-out — drop frame
	}
}

// BroadcastChatMessage sends a text-based JSON chat message to all connected clients immediately.
func (h *Hub) BroadcastChatMessage(sender string, msg string) {
	payload := map[string]string{
		"type": "chat",
		"name": sender,
		"msg":  msg,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()

	for client := range h.clients {
		select {
		case client.Send <- data:
		default:
			// Non-blocking send to prevent one slow client from lagging the chat stream
		}
	}
}
