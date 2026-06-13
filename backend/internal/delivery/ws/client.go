package ws

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"mmorpg-backend/internal/domain"

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

	// Maximum incoming message size — 1KB is plenty for move/attack/skill actions.
	// Previous 512 bytes could truncate some skill payloads.
	maxMessageSize = 1024
)

var upgrader = websocket.Upgrader{
	// Larger write buffer to amortize syscall overhead when sending ~2-4KB msgpack frames.
	ReadBufferSize:  2048,
	WriteBufferSize: 8192,
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
	// sendBufSize (32) prevents WritePump goroutine starvation under 50-player load.
	Send chan []byte

	// Player context info
	PlayerID string
	Username string
}

type WSIncomingMessage struct {
	Action    string  `json:"action" msgpack:"action"` // "move", "attack", "distribute_stat", "equip_item", "use_item", "cast_skill", "change_class", "telemetry_performance"
	X         float64 `json:"x" msgpack:"x"`
	Y         float64 `json:"y" msgpack:"y"`
	Z         float64 `json:"z" msgpack:"z"`
	Rotation  float64 `json:"rotation" msgpack:"rotation"`
	Animation string  `json:"animation" msgpack:"animation"`

	TargetType string  `json:"targetType" msgpack:"targetType"` // "monster", "player"
	TargetID   string  `json:"targetId" msgpack:"targetId"`
	Damage     float64 `json:"damage" msgpack:"damage"`
	IsCrit     bool    `json:"isCrit" msgpack:"isCrit"`

	// RPG Attributes Payload
	Stat         string `json:"stat" msgpack:"stat"` // str, int, con, vit, wis, luk
	Amount       int    `json:"amount" msgpack:"amount"`
	PlayerItemID string `json:"playerItemId" msgpack:"playerItemId"`
	SkillID      string `json:"skillId" msgpack:"skillId"`
	NewClass     string `json:"newClass" msgpack:"newClass"`
	Msg          string `json:"msg" msgpack:"msg"`

	// Telemetry Metrics Payload
	MinFPS       float64 `json:"min_fps" msgpack:"min_fps"`
	MaxFPS       float64 `json:"max_fps" msgpack:"max_fps"`
	AvgFPS       float64 `json:"avg_fps" msgpack:"avg_fps"`
	JitterMS     float64 `json:"jitter_ms" msgpack:"jitter_ms"`
	StutterCount int     `json:"stutter_count" msgpack:"stutter_count"`
	P99DtMS      float64 `json:"p99_dt_ms" msgpack:"p99_dt_ms"`
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
				fmt.Printf("⚠️ [WS] Unexpected close from %s: %v\n", c.Username, err)
			}
			break
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
			// Only log non-move parse errors to avoid flooding stdout at 20Hz
			if !strings.Contains(string(message), `"action":"move"`) {
				fmt.Printf("❌ [WS] Parse error from %s: %v\n", c.Username, parseErr)
			}
			continue
		}

		// Dispatch action — no logging on hot-path "move" actions
		switch msg.Action {
		case "move":
			c.Hub.gameUsecase.UpdatePlayerMovement(c.PlayerID, float32(msg.X), float32(msg.Y), float32(msg.Z), float32(msg.Rotation), msg.Animation, msg.TargetID)
		case "attack":
			c.Hub.gameUsecase.HandlePlayerAttack(c.PlayerID, msg.TargetType, msg.TargetID, float32(msg.Damage), msg.IsCrit)
		case "distribute_stat":
			c.Hub.gameUsecase.DistributeStatPoints(c.PlayerID, msg.Stat, msg.Amount)
		case "equip_item":
			c.Hub.gameUsecase.EquipPlayerItem(c.PlayerID, msg.PlayerItemID)
		case "use_item":
			c.Hub.gameUsecase.UseConsumable(c.PlayerID, msg.PlayerItemID)
		case "refine_item":
			if err := c.Hub.gameUsecase.RefineItem(c.PlayerID, msg.PlayerItemID); err != nil {
				fmt.Printf("⚠️ [WS] Refine failed for %s: %v\n", c.Username, err)
			}
		case "cast_skill":
			c.Hub.gameUsecase.CastPlayerSkill(c.PlayerID, msg.SkillID, msg.TargetID)
		case "change_class":
			c.Hub.gameUsecase.ChangeClass(c.PlayerID, msg.NewClass)
		case "buy_item":
			if err := c.Hub.gameUsecase.BuyItem(c.PlayerID, msg.PlayerItemID, msg.Amount); err != nil {
				fmt.Printf("⚠️ [WS] Buy failed for %s: %v\n", c.Username, err)
			}
		case "sell_item":
			if err := c.Hub.gameUsecase.SellItem(c.PlayerID, msg.PlayerItemID); err != nil {
				fmt.Printf("⚠️ [WS] Sell failed for %s: %v\n", c.Username, err)
			}
		case "create_party":
			c.Hub.gameUsecase.CreateParty(c.PlayerID)
		case "invite_party":
			c.Hub.gameUsecase.InviteToParty(c.PlayerID, msg.TargetID)
		case "leave_party":
			c.Hub.gameUsecase.LeaveParty(c.PlayerID)
		case "chat":
			if strings.HasPrefix(msg.Msg, "/reload") || strings.HasPrefix(msg.Msg, "/sync") {
				err := c.Hub.gameUsecase.SyncPlayerStatsFromDB(c.PlayerID)
				if err != nil {
					c.Hub.BroadcastChatMessage("Server", fmt.Sprintf("❌ Gagal sinkronisasi data database untuk %s: %v", c.Username, err))
				} else {
					c.Hub.BroadcastChatMessage("Server", fmt.Sprintf("🔄 Sukses sinkronisasi data database untuk %s!", c.Username))
				}
			} else if strings.HasPrefix(msg.Msg, "/godgear") {
				player := c.Hub.gameUsecase.GetActivePlayer(c.PlayerID)
				if player != nil {
					// Determine weapon item and category based on player class
					godWeaponID := "sword_iron"
					godWeaponCategory := "sword"
					godWeaponName := "Excalibur [Godly]"
					
					if player.Class == "Beginner" {
						godWeaponID = "bow_hunter"
						godWeaponCategory = "bow"
						godWeaponName = "Failnaught [Godly]"
					} else if player.Class == "Mage" {
						godWeaponID = "staff_magic"
						godWeaponCategory = "staff"
						godWeaponName = "Staff of Ra [Godly]"
					}

					// Spawning godly weapon
					excalibur := domain.PlayerItem{
						ID:             fmt.Sprintf("%s-god-weapon-%d", c.PlayerID, time.Now().UnixNano()%10000),
						PlayerID:       c.PlayerID,
						ItemID:         godWeaponID,
						WeaponCategory: godWeaponCategory,
						Name:           godWeaponName,
						Type:           "equipment",
						SlotType:       "weapon",
						Quantity:       1,
						IsEquipped:     false,
						AddAttack:      4800,
						AddHP:          1500,
						AddMP:          500,
					}
					// Spawning godly armor (Dragon Armor)
					armor := domain.PlayerItem{
						ID:         fmt.Sprintf("%s-god-armor-%d", c.PlayerID, time.Now().UnixNano()%10000),
						PlayerID:   c.PlayerID,
						ItemID:     "plate_armor",
						Name:       "Dragon Armor [Godly]",
						Type:       "equipment",
						SlotType:   "armor",
						Quantity:   1,
						IsEquipped: false,
						AddDefense: 800,
						AddHP:      3000,
						AddAttack:  500,
					}
					player.Inventory = append(player.Inventory, excalibur, armor)
					player.Gold += 100000
					player.RecalculateStats()
					c.Hub.BroadcastChatMessage("Server", fmt.Sprintf("🎁 Godly Gear (Excalibur + Dragon Armor) & 100k Zeny ditambahkan ke inventori %s!", c.Username))
				}
			} else {
				c.Hub.BroadcastChatMessage(c.Username, msg.Msg)
			}
		case "telemetry_performance":
			// Record client performance metrics in Prometheus vectors
			ClientFPSGauge.WithLabelValues(c.PlayerID, c.Username).Set(msg.AvgFPS)
			ClientFPSMinGauge.WithLabelValues(c.PlayerID, c.Username).Set(msg.MinFPS)
			ClientFPSMaxGauge.WithLabelValues(c.PlayerID, c.Username).Set(msg.MaxFPS)
			ClientFPSJitterGauge.WithLabelValues(c.PlayerID, c.Username).Set(msg.JitterMS)
			ClientStutterCounter.WithLabelValues(c.PlayerID, c.Username).Add(float64(msg.StutterCount))
			ClientP99DtGauge.WithLabelValues(c.PlayerID, c.Username).Set(msg.P99DtMS)
		default:
			if msg.Action == "" {
				c.Hub.gameUsecase.UpdatePlayerMovement(c.PlayerID, float32(msg.X), float32(msg.Y), float32(msg.Z), float32(msg.Rotation), msg.Animation, msg.TargetID)
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

			latestMessage := message
			isChat := len(latestMessage) > 0 && latestMessage[0] == '{'
			if isChat {
				w, err := c.Conn.NextWriter(websocket.TextMessage)
				if err != nil {
					return
				}
				_, _ = w.Write(latestMessage)
				_ = w.Close()
				continue
			}

			// Coalesce binary game states without losing chat messages
			n := len(c.Send)
			for i := 0; i < n; i++ {
				peekMsg := <-c.Send
				if len(peekMsg) > 0 && peekMsg[0] == '{' {
					// Found a chat message in queue. Write current game state first.
					w, err := c.Conn.NextWriter(websocket.BinaryMessage)
					if err == nil {
						_, _ = w.Write(latestMessage)
						_ = w.Close()
					}
					// Set latestMessage to the chat message and stop coalescing
					latestMessage = peekMsg
					break
				} else {
					latestMessage = peekMsg
				}
			}

			var msgType = websocket.BinaryMessage
			if len(latestMessage) > 0 && latestMessage[0] == '{' {
				msgType = websocket.TextMessage
			}
			w, err := c.Conn.NextWriter(msgType)
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
