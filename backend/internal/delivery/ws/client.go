package ws

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/vmihailenco/msgpack/v5"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for local testing
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	Hub *Hub

	// The websocket connection.
	Conn *websocket.Conn

	// Buffered channel of outbound messages.
	Send chan []byte

	// Player context info
	PlayerID string
	Username string
}

type WSIncomingMessage struct {
	Action    string  `json:"action"` // "move", "attack", "distribute_stat", "equip_item", "use_item", "cast_skill", "change_class"
	X         float32 `json:"x"`
	Y         float32 `json:"y"`
	Z         float32 `json:"z"`
	Rotation  float32 `json:"rotation"`
	Animation string  `json:"animation"`
	
	TargetType string `json:"targetType"` // "monster", "player"
	TargetID   string `json:"targetId"`
	Damage     float32 `json:"damage"`
	IsCrit     bool    `json:"isCrit"`

	// RPG Attributes Payload
	Stat         string `json:"stat"` // str, int, con, vit, wis, luk
	Amount       int    `json:"amount"`
	PlayerItemID string `json:"playerItemId"`
	SkillID      string `json:"skillId"`
	NewClass     string `json:"newClass"`
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()
	
	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	
	for {
		messageType, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		
		// Telemetry logger for non-move packets
		rawPayload := string(message)
		if !strings.Contains(rawPayload, `"action":"move"`) && messageType == websocket.TextMessage {
			fmt.Printf("📬 [WS TELEMETRY TEXT] Dari %s: %s\n", c.Username, rawPayload)
		}
		
		// Parse message action: supports both MessagePack binary and JSON text seamlessly
		var msg WSIncomingMessage
		var parseErr error
		if messageType == websocket.BinaryMessage {
			parseErr = msgpack.Unmarshal(message, &msg)
		} else {
			parseErr = json.Unmarshal(message, &msg)
		}
		if parseErr != nil {
			fmt.Printf("❌ [WS TELEMETRY ERROR] Gagal parse dari %s: %v | Raw: %s\n", c.Username, parseErr, rawPayload)
			continue
		}

		switch msg.Action {
		case "move":
			c.Hub.gameUsecase.UpdatePlayerMovement(c.PlayerID, msg.X, msg.Y, msg.Z, msg.Rotation, msg.Animation, msg.TargetID)
		case "attack":
			c.Hub.gameUsecase.HandlePlayerAttack(c.PlayerID, msg.TargetType, msg.TargetID, msg.Damage, msg.IsCrit)
		case "distribute_stat":
			c.Hub.gameUsecase.DistributeStatPoints(c.PlayerID, msg.Stat, msg.Amount)
		case "equip_item":
			c.Hub.gameUsecase.EquipPlayerItem(c.PlayerID, msg.PlayerItemID)
		case "use_item":
			c.Hub.gameUsecase.UseConsumable(c.PlayerID, msg.PlayerItemID)
		case "cast_skill":
			c.Hub.gameUsecase.CastPlayerSkill(c.PlayerID, msg.SkillID, msg.TargetID)
		case "change_class":
			c.Hub.gameUsecase.ChangeClass(c.PlayerID, msg.NewClass)
		default:
			if msg.Action == "" {
				c.Hub.gameUsecase.UpdatePlayerMovement(c.PlayerID, msg.X, msg.Y, msg.Z, msg.Rotation, msg.Animation, msg.TargetID)
			}
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	
	for {
		select {
		case message, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Coalesce: drain the channel and only send the absolute latest message
			latestMessage := message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				latestMessage = <-c.Send
			}

			// Write as BinaryMessage since we marshal using MessagePack binary
			w, err := c.Conn.NextWriter(websocket.BinaryMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(latestMessage)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
