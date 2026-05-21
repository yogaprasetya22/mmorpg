package ws

import (
	"fmt"
	"sync"

	"github.com/vmihailenco/msgpack/v5"
	"mmorpg-backend/internal/domain"
	"mmorpg-backend/internal/usecase/game"
)

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
		Broadcast:   make(chan []byte, 4), // small buffer to decouple game loop from hub goroutine
		Register:    make(chan *Client, 16),
		Unregister:  make(chan *Client, 16),
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

			// Fan-out to each client in parallel — one slow client can't block others
			var wg sync.WaitGroup
			for _, client := range targets {
				wg.Add(1)
				go func(c *Client) {
					defer wg.Done()
					select {
					case c.Send <- message:
					default:
						// Client send buffer full — drop frame for this client only
					}
				}(client)
			}
			wg.Wait()
		}
	}
}

func (h *Hub) BroadcastGameState(payload domain.GameStatePayload) {
	data, err := msgpack.Marshal(payload)
	if err != nil {
		return
	}

	// Non-blocking send to broadcast channel
	select {
	case h.Broadcast <- data:
	default:
		// Drop frame if broadcast queue is backed up (game loop is faster than network)
	}
}
