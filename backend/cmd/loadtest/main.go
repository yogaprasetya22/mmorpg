package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/vmihailenco/msgpack/v5"
)

// Define local matching structures for WebSocket protocol
type WSIncomingMessage struct {
	Action    string  `json:"action" msgpack:"action"`
	X         float32 `json:"x" msgpack:"x"`
	Y         float32 `json:"y" msgpack:"y"`
	Z         float32 `json:"z" msgpack:"z"`
	Rotation  float32 `json:"rotation" msgpack:"rotation"`
	Animation string  `json:"animation" msgpack:"animation"`

	TargetType string  `json:"targetType" msgpack:"targetType"`
	TargetID   string  `json:"targetId" msgpack:"targetId"`
	Damage     float32 `json:"damage" msgpack:"damage"`
	IsCrit     bool    `json:"isCrit" msgpack:"isCrit"`
	SkillID    string  `json:"skillId" msgpack:"skillId"`
}

type PlayerNetworkState struct {
	ID        string  `msgpack:"id"`
	X         float32 `msgpack:"x"`
	Y         float32 `msgpack:"y"`
	Z         float32 `msgpack:"z"`
	Rotation  float32 `msgpack:"rotation"`
	Animation string  `msgpack:"animation"`
	Class     string  `msgpack:"class"`
	HP        float32 `msgpack:"hp"`
	MaxHP     float32 `msgpack:"maxHp"`
}

type MonsterNetworkState struct {
	ID        string  `msgpack:"id"`
	Name      string  `msgpack:"name"`
	Type      string  `msgpack:"type"`
	X         float32 `msgpack:"x"`
	Y         float32 `msgpack:"y"`
	Z         float32 `msgpack:"z"`
	HP        float32 `msgpack:"hp"`
	MaxHP     float32 `msgpack:"max_hp"`
	IsDead    bool    `msgpack:"is_dead"`
	Animation string  `msgpack:"animation"`
}

type GameStatePayload struct {
	Players  []PlayerNetworkState  `msgpack:"players"`
	Monsters []MonsterNetworkState `msgpack:"monsters"`
}

// Global metrics tracker
type Metrics struct {
	ConnsAttempted int64
	ConnsSuccess   int64
	ConnsFailed    int64
	MsgsSent       int64
	MsgsRecv       int64
	BytesSent      int64
	BytesRecv      int64
	AttackMsgsSent int64
	RttSumMs       int64
	RttCount       int64
}

var metrics Metrics

func main() {
	fmt.Println("🔥 Preparing MMORPG Backend Load Tester...")

	numPlayers := flag.Int("players", 50, "Number of concurrent players to simulate")
	hostUrl := flag.String("host", "http://localhost:8080", "Target server HTTP URL")
	runDuration := flag.Duration("duration", 45*time.Second, "Test run duration")
	enableAttack := flag.Bool("attack", true, "Enable simulated players to attack monsters")
	attackRate := flag.Int("attack-rate", 30, "Ticks between attacks (1 tick = 50ms)")
	radiusVal := flag.Float64("radius", 15.0, "Radius spread of player circle movement around spawn")
	flag.Parse()

	u, err := url.Parse(*hostUrl)
	if err != nil {
		fmt.Printf("❌ Invalid target host URL: %v\n", err)
		os.Exit(1)
	}

	wsScheme := "ws"
	if u.Scheme == "https" {
		wsScheme = "wss"
	}
	wsHost := u.Host

	fmt.Printf("🎯 Host: %s (WS: %s://%s)\n", *hostUrl, wsScheme, wsHost)
	fmt.Printf("👥 Players count: %d\n", *numPlayers)
	fmt.Printf("⚔️  Attacking enabled: %v (rate: every %d ticks)\n", *enableAttack, *attackRate)
	fmt.Printf("⭕ Radius spread: %.1f units\n", *radiusVal)
	fmt.Printf("⏳ Run duration: %s\n", *runDuration)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("\n🛑 Stopping load test early...")
		cancel()
	}()

	var wg sync.WaitGroup
	timestamp := time.Now().Unix() % 100000

	fmt.Printf("🔐 Step 1: Registering/Logging in %d simulated players...\n", *numPlayers)
	playersInfo := make([]struct {
		Token       string
		CharacterID string
		Username    string
	}, *numPlayers)

	client := &http.Client{Timeout: 5 * time.Second}

	var registerWg sync.WaitGroup
	registerWg.Add(*numPlayers)

	for i := 0; i < *numPlayers; i++ {
		go func(idx int) {
			defer registerWg.Done()
			username := fmt.Sprintf("stress_%d_%d", timestamp, idx)
			password := "stresspass123"

			// Register
			regPayload, _ := json.Marshal(map[string]string{
				"username": username,
				"password": password,
			})
			resp, err := client.Post(fmt.Sprintf("%s/api/auth/register", *hostUrl), "application/json", bytes.NewBuffer(regPayload))
			if err != nil {
				// Retry or login if already exists
			} else {
				_, _ = io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
			}

			// Login
			loginPayload, _ := json.Marshal(map[string]string{
				"username": username,
				"password": password,
			})
			resp, err = client.Post(fmt.Sprintf("%s/api/auth/login", *hostUrl), "application/json", bytes.NewBuffer(loginPayload))
			if err != nil {
				fmt.Printf("❌ Failed to log in player %d: %v\n", idx, err)
				return
			}
			defer resp.Body.Close()

			var loginResp struct {
				Token string `json:"token"`
			}
			_ = json.NewDecoder(resp.Body).Decode(&loginResp)

			if loginResp.Token == "" {
				fmt.Printf("❌ Login response token empty for player %d\n", idx)
				return
			}

			// List/Create character
			req, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/player/characters", *hostUrl), nil)
			req.Header.Set("Authorization", "Bearer "+loginResp.Token)
			charResp, err := client.Do(req)
			var charList struct {
				Characters []struct {
					ID string `json:"id"`
				} `json:"characters"`
			}
			if err == nil {
				_ = json.NewDecoder(charResp.Body).Decode(&charList)
				charResp.Body.Close()
			}

			charID := ""
			if len(charList.Characters) > 0 {
				charID = charList.Characters[0].ID
			} else {
				// Create a character with dynamic class spread
				classes := []string{"Warrior", "Mage", "Priest", "Thief"}
				selectedClass := classes[idx % len(classes)]

				charPayload, _ := json.Marshal(map[string]interface{}{
					"name":       fmt.Sprintf("char_%d_%d", timestamp, idx),
					"class":      selectedClass,
					"gender":     "Male",
					"hair_style": 1,
					"hair_color": "#5A3E2D",
				})
				req, _ := http.NewRequest("POST", fmt.Sprintf("%s/api/player/characters", *hostUrl), bytes.NewBuffer(charPayload))
				req.Header.Set("Authorization", "Bearer "+loginResp.Token)
				req.Header.Set("Content-Type", "application/json")
				createResp, err := client.Do(req)
				if err == nil {
					var createRes struct {
						Player struct {
							ID string `json:"id"`
						} `json:"player"`
					}
					_ = json.NewDecoder(createResp.Body).Decode(&createRes)
					createResp.Body.Close()
					charID = createRes.Player.ID
				}
			}

			if charID == "" {
				fmt.Printf("❌ Failed to resolve character ID for player %d\n", idx)
				return
			}

			playersInfo[idx].Token = loginResp.Token
			playersInfo[idx].CharacterID = charID
			playersInfo[idx].Username = username
		}(i)
	}

	registerWg.Wait()

	// Filter out failed logins
	activePlayers := 0
	for _, p := range playersInfo {
		if p.Token != "" && p.CharacterID != "" {
			activePlayers++
		}
	}

	if activePlayers == 0 {
		fmt.Println("❌ Error: No players could be logged in successfully. Exiting.")
		return
	}

	fmt.Printf("🔌 Step 2: Spawning %d connections on game WebSocket...\n", activePlayers)

	// Stat visualizer dashboard loop
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		start := time.Now()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				elapsed := time.Since(start).Seconds()
				recvKB := float64(atomic.LoadInt64(&metrics.BytesRecv)) / 1024.0
				sentKB := float64(atomic.LoadInt64(&metrics.BytesSent)) / 1024.0
				msgsRecv := atomic.LoadInt64(&metrics.MsgsRecv)
				msgsSent := atomic.LoadInt64(&metrics.MsgsSent)
				attacksSent := atomic.LoadInt64(&metrics.AttackMsgsSent)
				activeConns := atomic.LoadInt64(&metrics.ConnsSuccess)

				var avgRtt float64
				rttCount := atomic.LoadInt64(&metrics.RttCount)
				if rttCount > 0 {
					avgRtt = float64(atomic.LoadInt64(&metrics.RttSumMs)) / float64(rttCount)
				}

				// Clear console using standard ANSI codes
				fmt.Print("\033[H\033[2J")
				fmt.Println("=================================================================")
				fmt.Println("                  🎮  MMORPG REAL-TIME STRESS TEST  🎮           ")
				fmt.Println("=================================================================")
				fmt.Printf("⏱️  Running Duration : %.1fs / %s\n", elapsed, runDuration.String())
				fmt.Printf("🟢 Connected Clients : %d / %d\n", activeConns, activePlayers)
				fmt.Println("-----------------------------------------------------------------")
				fmt.Printf("📈 Messages Received: %-10d (%.1f Msgs/Sec)\n", msgsRecv, float64(msgsRecv)/elapsed)
				fmt.Printf("📉 Messages Sent    : %-10d (%.1f Msgs/Sec)\n", msgsSent, float64(msgsSent)/elapsed)
				fmt.Printf("⚔️  Attacks Fired   : %-10d (%.1f Attack/Sec)\n", attacksSent, float64(attacksSent)/elapsed)
				fmt.Println("-----------------------------------------------------------------")
				fmt.Printf("📥 Network RX Data  : %-10.2f KB (%.2f KB/s)\n", recvKB, recvKB/elapsed)
				fmt.Printf("📤 Network TX Data  : %-10.2f KB (%.2f KB/s)\n", sentKB, sentKB/elapsed)
				if avgRtt > 0 {
					fmt.Printf("⚡ Average RTT latency: %.2f ms\n", avgRtt)
				} else {
					fmt.Printf("⚡ Average RTT latency: -- ms (waiting ping)\n")
				}
				fmt.Println("=================================================================")
				// Draw simple visual load bar
				barWidth := 30
				percent := int((float64(activeConns) / float64(*numPlayers)) * float64(barWidth))
				fmt.Print("Load Level: [")
				for b := 0; b < barWidth; b++ {
					if b < percent {
						fmt.Print("█")
					} else {
						fmt.Print("░")
					}
				}
				fmt.Println("]")
			}
		}
	}()

	for i := 0; i < *numPlayers; i++ {
		p := playersInfo[i]
		if p.Token == "" || p.CharacterID == "" {
			continue
		}

		wg.Add(1)
		go func(idx int, token, charID, name string) {
			defer wg.Done()
			atomic.AddInt64(&metrics.ConnsAttempted, 1)

			dialer := websocket.Dialer{
				HandshakeTimeout: 5 * time.Second,
			}
			wsUrl := fmt.Sprintf("%s://%s/ws?token=%s&character_id=%s", wsScheme, wsHost, token, charID)

			conn, _, err := dialer.Dial(wsUrl, nil)
			if err != nil {
				atomic.AddInt64(&metrics.ConnsFailed, 1)
				return
			}
			atomic.AddInt64(&metrics.ConnsSuccess, 1)
			defer func() {
				conn.Close()
				atomic.AddInt64(&metrics.ConnsSuccess, -1)
			}()

			// Keep track of active monsters parsed from incoming GameState messages
			var monsterMutex sync.RWMutex
			var monsterIDs []string

			// Start WebSocket Reader goroutine
			readerCtx, readerCancel := context.WithCancel(ctx)
			defer readerCancel()

			go func() {
				for {
					select {
					case <-readerCtx.Done():
						return
					default:
						messageType, message, err := conn.ReadMessage()
						if err != nil {
							return
						}
						atomic.AddInt64(&metrics.MsgsRecv, 1)
						atomic.AddInt64(&metrics.BytesRecv, int64(len(message)))

						if messageType == websocket.BinaryMessage {
							var state GameStatePayload
							if err := msgpack.Unmarshal(message, &state); err == nil {
								// Extract alive monster IDs to attack
								var tempIDs []string
								for _, m := range state.Monsters {
									if !m.IsDead {
										tempIDs = append(tempIDs, m.ID)
									}
								}
								monsterMutex.Lock()
								monsterIDs = tempIDs
								monsterMutex.Unlock()
							}
						}
					}
				}
			}()

			// Start simulation Loop (20Hz - every 50ms)
			tickRate := 50 * time.Millisecond
			ticker := time.NewTicker(tickRate)
			defer ticker.Stop()

			// Position simulation metrics
			var angle float64 = rand.Float64() * 2 * math.Pi
			radius := (*radiusVal) * (0.6 + rand.Float64()*0.8)
			centerX := 0.0
			centerZ := 0.0

			var attackCounter int = 0
			var animLockTicks int = 0
			var currentAnim string = "Run"

			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					// Circle movement path simulation (only if not animation locked)
					var px, pz float64
					var rotY float32

					if animLockTicks > 0 {
						animLockTicks--
						// Stay in current animation and position to simulate realistic animation locking
						px = centerX + radius*math.Cos(angle)
						pz = centerZ + radius*math.Sin(angle)
						rotY = float32(-angle + math.Pi/2)
					} else {
						angle += 0.05
						px = centerX + radius*math.Cos(angle)
						pz = centerZ + radius*math.Sin(angle)
						rotY = float32(-angle + math.Pi/2)
						currentAnim = "Run"
					}

					// Send client movement
					moveMsg := WSIncomingMessage{
						Action:    "move",
						X:         float32(px),
						Y:         0.0,
						Z:         float32(pz),
						Rotation:  rotY,
						Animation: currentAnim,
					}

					data, err := json.Marshal(moveMsg)
					if err == nil {
						_ = conn.SetWriteDeadline(time.Now().Add(1 * time.Second))
						err = conn.WriteMessage(websocket.TextMessage, data)
						if err != nil {
							return
						}
						atomic.AddInt64(&metrics.MsgsSent, 1)
						atomic.AddInt64(&metrics.BytesSent, int64(len(data)))
					}

					// Periodic attack
					attackCounter++
					if *enableAttack && attackCounter >= *attackRate && animLockTicks == 0 {
						attackCounter = 0
						monsterMutex.RLock()
						targetID := ""
						if len(monsterIDs) > 0 {
							targetID = monsterIDs[rand.Intn(len(monsterIDs))]
						}
						monsterMutex.RUnlock()

						if targetID != "" {
							isCrit := rand.Float64() < 0.15
							dmg := float32(100 + rand.Intn(100))
							if isCrit {
								dmg *= 1.5
							}

							// 30% chance to cast a class active skill, 70% chance standard attack
							if rand.Float64() < 0.30 {
								// Skill Cast Action
								skillId := "strike"
								if idx%2 == 0 {
									skillId = "heal"
								}

								currentAnim = "Skill"
								animLockTicks = 12

								// Immediately send movement packet with "Skill" animation
								moveMsg.Animation = currentAnim
								moveData, _ := json.Marshal(moveMsg)
								_ = conn.SetWriteDeadline(time.Now().Add(1 * time.Second))
								_ = conn.WriteMessage(websocket.TextMessage, moveData)

								skillMsg := WSIncomingMessage{
									Action:     "cast_skill",
									TargetType: "monster",
									TargetID:   targetID,
									SkillID:    skillId,
								}
								skillData, err := json.Marshal(skillMsg)
								if err == nil {
									_ = conn.SetWriteDeadline(time.Now().Add(1 * time.Second))
									_ = conn.WriteMessage(websocket.TextMessage, skillData)
									atomic.AddInt64(&metrics.MsgsSent, 1)
									atomic.AddInt64(&metrics.BytesSent, int64(len(skillData)))
								}
							} else {
								// Standard Attack Action
								currentAnim = "Attack"
								animLockTicks = 8

								// Immediately send movement packet with "Attack" animation
								moveMsg.Animation = currentAnim
								moveData, _ := json.Marshal(moveMsg)
								_ = conn.SetWriteDeadline(time.Now().Add(1 * time.Second))
								_ = conn.WriteMessage(websocket.TextMessage, moveData)

								attackMsg := WSIncomingMessage{
									Action:     "attack",
									TargetType: "monster",
									TargetID:   targetID,
									Damage:     dmg,
									IsCrit:     isCrit,
								}
								atkData, err := json.Marshal(attackMsg)
								if err == nil {
									_ = conn.SetWriteDeadline(time.Now().Add(1 * time.Second))
									err = conn.WriteMessage(websocket.TextMessage, atkData)
									if err == nil {
										atomic.AddInt64(&metrics.MsgsSent, 1)
										atomic.AddInt64(&metrics.AttackMsgsSent, 1)
										atomic.AddInt64(&metrics.BytesSent, int64(len(atkData)))
									}
								}
							}
						}
					}
				}
			}
		}(i, p.Token, p.CharacterID, p.Username)

		// Smooth connect throttle
		time.Sleep(30 * time.Millisecond)
	}

	// Wait for completion timer or Ctrl+C
	select {
	case <-time.After(*runDuration):
		fmt.Println("\n⏳ Load test execution duration finished.")
		cancel()
	case <-ctx.Done():
	}

	wg.Wait()
	fmt.Println("\n🏁 Stress test terminated successfully. All connections cleaned up.")
}
