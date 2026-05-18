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
	clients    map[*Client]bool
	clientsMu  sync.RWMutex

	// Inbound messages from clients to broadcast (unused directly if server-authoritative tick)
	Broadcast  chan []byte

	// Register requests from the clients
	Register   chan *Client

	// Unregister requests from clients
	Unregister chan *Client

	// Game Engine Usecase
	gameUsecase game.GameUsecase
}

func NewHub(gameUsecase game.GameUsecase) *Hub {
	return &Hub{
		Broadcast:   make(chan []byte),
		Register:    make(chan *Client),
		Unregister:  make(chan *Client),
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
			h.clientsMu.RLock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					h.clientsMu.RUnlock()
					h.clientsMu.Lock()
					delete(h.clients, client)
					h.clientsMu.Unlock()
					h.clientsMu.RLock()
				}
			}
			h.clientsMu.RUnlock()
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
		// Drop frame if broadcast queue is backed up
	}
}
