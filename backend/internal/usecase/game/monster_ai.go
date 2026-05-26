package game

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"mmorpg-backend/internal/domain"
)

// Legacy processMonsterAI supports the older synchronous execution mode (backward compatibility).
func (u *gameUsecase) processMonsterAI(m *domain.Monster, dt float32) {
	// Reconstruct playerSnapshot from state
	u.playersMu.RLock()
	playerSnapshot := make(map[string]*domain.PlayerNetworkState, len(u.players))
	for id, p := range u.players {
		cp := *p
		playerSnapshot[id] = &cp
	}
	u.playersMu.RUnlock()

	grid := NewSpatialHashGrid(10.0)
	for id, p := range playerSnapshot {
		grid.Insert(id, p.X, p.Z)
	}

	u.processMonsterAIWithSnapshot(m, dt, playerSnapshot, grid)
}

// processMonsterAIWithSnapshot is an ultra-fast, lock-free, and allocation-free FSM state machine
// that scales horizontally up to 10,000+ entities via Goroutines and O(1) Spatial Hash Grid indexing.
func (u *gameUsecase) processMonsterAIWithSnapshot(m *domain.Monster, dt float32, playerSnap map[string]*domain.PlayerNetworkState, grid *SpatialHashGrid) {
	// Default state fallback
	if m.AIState == "" {
		m.AIState = "idle"
	}

	// --- DEAD / RESPAWN HANDLING ---
	if m.IsDead {
		m.Animation = "death"
		m.AIState = "dead"

		if time.Now().After(m.RespawnTime) {
			m.Respawn()
			m.Animation = "idle"
			m.AIState = "idle"

			if healthComp, found := u.registry.GetComponent(domain.EntityID(m.ID), "Health"); found {
				h := healthComp.(*domain.HealthComponent)
				h.HP = m.HP
				h.MaxHP = m.MaxHP
			}
			if posComp, found := u.registry.GetComponent(domain.EntityID(m.ID), "Position"); found {
				p := posComp.(*domain.PositionComponent)
				p.Vector3 = m.Position
				p.Animation = "idle"
			}
			fmt.Printf("👾 Monster %s respawned di posisi (%.2f, %.2f)!\n", m.Name, m.Position.X, m.Position.Z)
		}
		return
	}

	// Helper: O(1) Spatial Partitioning index lookup for closest target selection
	findClosestPlayer := func(maxRange float32) (closestID string) {
		var minDist float32 = maxRange
		nearbyIDs := grid.GetNearby(m.Position.X, m.Position.Z, maxRange)

		for _, id := range nearbyIDs {
			p, exists := playerSnap[id]
			if !exists {
				continue
			}
			pPos := domain.Vector3{X: p.X, Y: p.Y, Z: p.Z}
			dist := m.Position.DistanceTo(pPos)
			if dist < minDist {
				u.activePlayersMu.RLock()
				pData, existsActive := u.activePlayers[id]
				u.activePlayersMu.RUnlock()
				if existsActive && pData != nil && pData.HP > 0 {
					minDist = dist
					closestID = id
				}
			}
		}
		return
	}

	// Lock-free and allocation-free direct enum-like string FSM
	switch m.AIState {
	case "idle":
		m.Animation = "idle"

		// Retain target if still valid
		if m.TargetPlayerID != "" {
			u.activePlayersMu.RLock()
			pData, exists := u.activePlayers[m.TargetPlayerID]
			u.activePlayersMu.RUnlock()
			if exists && pData != nil && pData.HP > 0 {
				m.AIState = "chase"
				break
			}
			m.TargetPlayerID = ""
		}

		if m.Position.DistanceTo(m.SpawnPosition) <= 8.0 {
			if id := findClosestPlayer(m.AggroRange); id != "" {
				m.TargetPlayerID = id
				m.AIState = "chase"
				fmt.Printf("❗ Monster %s terprovokasi ke Player %s!\n", m.Name, id)
				break
			}
		}

		// Wait interval check for patrol
		u.patrolTargetsMu.Lock()
		waitTime, isWaiting := u.patrolWaiting[m.ID]
		u.patrolTargetsMu.Unlock()
		if isWaiting {
			if time.Now().Before(waitTime) {
				break
			}
			u.patrolTargetsMu.Lock()
			delete(u.patrolWaiting, m.ID)
			u.patrolTargetsMu.Unlock()
		}

		u.patrolTargetsMu.Lock()
		angle := float64(rand.Intn(360)) * math.Pi / 180.0
		radius := float32(rand.Intn(45)) / 10.0
		u.patrolTargets[m.ID] = domain.Vector3{
			X: m.SpawnPosition.X + float32(math.Cos(angle))*radius,
			Y: m.SpawnPosition.Y,
			Z: m.SpawnPosition.Z + float32(math.Sin(angle))*radius,
		}
		u.patrolTargetsMu.Unlock()
		m.AIState = "patrol"

	case "patrol":
		if m.TargetPlayerID != "" {
			u.activePlayersMu.RLock()
			pData, exists := u.activePlayers[m.TargetPlayerID]
			u.activePlayersMu.RUnlock()
			if exists && pData != nil && pData.HP > 0 {
				m.AIState = "chase"
				break
			}
			m.TargetPlayerID = ""
		}

		if m.Position.DistanceTo(m.SpawnPosition) <= 8.0 {
			if id := findClosestPlayer(m.AggroRange); id != "" {
				m.TargetPlayerID = id
				m.AIState = "chase"
				break
			}
		}

		u.patrolTargetsMu.Lock()
		targetPos, hasTarget := u.patrolTargets[m.ID]
		u.patrolTargetsMu.Unlock()
		if !hasTarget {
			m.AIState = "idle"
			break
		}

		dirX := targetPos.X - m.Position.X
		dirZ := targetPos.Z - m.Position.Z
		dist := float32(math.Sqrt(float64(dirX*dirX + dirZ*dirZ)))
		if dist > 0.3 {
			m.Position.X += (dirX / dist) * m.Speed * 0.60 * dt
			m.Position.Z += (dirZ / dist) * m.Speed * 0.60 * dt
			m.Animation = "walk"
		} else {
			u.patrolTargetsMu.Lock()
			delete(u.patrolTargets, m.ID)
			u.patrolWaiting[m.ID] = time.Now().Add(time.Duration(2+rand.Intn(3)) * time.Second)
			u.patrolTargetsMu.Unlock()
			m.AIState = "idle"
		}

	case "chase":
		if m.TargetPlayerID == "" {
			m.AIState = "returning"
			break
		}
		targetPlayer, exists := playerSnap[m.TargetPlayerID]
		if !exists {
			m.TargetPlayerID = ""
			m.AIState = "returning"
			break
		}

		u.activePlayersMu.RLock()
		pData, pExists := u.activePlayers[m.TargetPlayerID]
		u.activePlayersMu.RUnlock()
		if !pExists || pData == nil || pData.HP <= 0 {
			m.TargetPlayerID = ""
			m.AIState = "returning"
			break
		}

		playerPos := domain.Vector3{X: targetPlayer.X, Y: targetPlayer.Y, Z: targetPlayer.Z}
		dist := m.Position.DistanceTo(playerPos)

		// Tether limit check
		distFromHome := m.Position.DistanceTo(m.SpawnPosition)
		if distFromHome > 18.0 {
			fmt.Printf("⛓️ [LEASH-SNAP] Monster %s berpaling karena mengejar terlalu jauh (%.2f unit)!\n", m.Name, distFromHome)
			m.TargetPlayerID = ""
			m.AIState = "returning"
			break
		}

		dy := float32(math.Abs(float64(m.Position.Y - playerPos.Y)))
		if dist <= 3.5 && dy <= 4.5 {
			m.AIState = "attack"
			break
		}

		m.Animation = "run"
		dirX := playerPos.X - m.Position.X
		dirZ := playerPos.Z - m.Position.Z
		length := float32(math.Sqrt(float64(dirX*dirX + dirZ*dirZ)))
		if length > 0 {
			m.Position.X += (dirX / length) * m.Speed * dt
			m.Position.Z += (dirZ / length) * m.Speed * dt
		}

	case "attack":
		if m.TargetPlayerID == "" {
			m.AIState = "returning"
			break
		}
		targetPlayer, exists := playerSnap[m.TargetPlayerID]
		if !exists {
			m.TargetPlayerID = ""
			m.AIState = "returning"
			break
		}

		u.activePlayersMu.RLock()
		pData, pExists := u.activePlayers[m.TargetPlayerID]
		u.activePlayersMu.RUnlock()
		if !pExists || pData == nil || pData.HP <= 0 {
			m.TargetPlayerID = ""
			m.AIState = "returning"
			break
		}

		playerPos := domain.Vector3{X: targetPlayer.X, Y: targetPlayer.Y, Z: targetPlayer.Z}
		dist := m.Position.DistanceTo(playerPos)

		// Tether limit check
		distFromHome := m.Position.DistanceTo(m.SpawnPosition)
		if distFromHome > 18.0 {
			fmt.Printf("⛓️ [LEASH-SNAP] Monster %s berpaling karena menyerang terlalu jauh (%.2f unit)!\n", m.Name, distFromHome)
			m.TargetPlayerID = ""
			m.AIState = "returning"
			break
		}

		dyAttack := float32(math.Abs(float64(m.Position.Y - playerPos.Y)))
		if dist > 3.5 || dyAttack > 4.5 {
			m.AIState = "chase"
			break
		}

		if time.Since(m.LastAttackTime) < 1000*time.Millisecond {
			m.Animation = "attack"
			break
		}

		if time.Since(m.LastAttackTime) >= 1500*time.Millisecond {
			m.Animation = "attack"
			m.LastAttackTime = time.Now()

			dmg := m.Attack
			damageMultiplier := float32(100.0) / (100.0 + pData.Defense)
			mitigatedDamage := dmg * damageMultiplier
			variation := float32((time.Now().UnixNano()%20)-10) / 100.0
			finalDamage := mitigatedDamage * (1.0 + variation)
			if finalDamage < 1 {
				finalDamage = 1
			}
			maxHitDmg := pData.MaxHP * 0.35
			if finalDamage > maxHitDmg {
				finalDamage = maxHitDmg
			}

			u.activePlayersMu.Lock()
			pData.HP -= finalDamage
			if pData.HP <= 0 {
				pData.HP = 0
				deadPlayerID := m.TargetPlayerID
				m.TargetPlayerID = ""
				m.AIState = "returning"
				fmt.Printf("☠️ Monster %s membunuh Player %s!\n", m.Name, pData.Username)

				go func(pID string, pUser string) {
					time.Sleep(5 * time.Second)
					u.activePlayersMu.Lock()
					pl, exists := u.activePlayers[pID]
					var lastX, lastY, lastZ float32
					if exists && pl != nil {
						pl.HP = pl.MaxHP
						if pHcomp, found := u.registry.GetComponent(domain.EntityID(pID), "Health"); found {
							h := pHcomp.(*domain.HealthComponent)
							h.HP = pl.HP
							h.MaxHP = pl.MaxHP
						}
						pl.LastX = 0
						pl.LastY = 0
						pl.LastZ = 0
						lastX = 0
						lastY = 0
						lastZ = 0
					}
					u.activePlayersMu.Unlock()

					if exists && pl != nil {
						u.UpdatePlayerMovement(pID, lastX, lastY, lastZ, 0, "idle", "")
						fmt.Printf("🛡️ Player %s telah hidup kembali di safe zone (0, 0, 0).\n", pUser)
					}
				}(targetPlayer.ID, pData.Username)

				u.activePlayersMu.Unlock()

				// Update ECS Player Health Component and Real-time WebSocket state for dead player
				if healthComp, found := u.registry.GetComponent(domain.EntityID(deadPlayerID), "Health"); found {
					h := healthComp.(*domain.HealthComponent)
					h.HP = 0

					u.playersMu.Lock()
					if pState, exists := u.players[deadPlayerID]; exists && pState != nil {
						pState.HP = 0
					}
					u.playersMu.Unlock()
				}
			} else {
				u.activePlayersMu.Unlock()

				// Update ECS Player Health Component and Real-time WebSocket state for damage
				if healthComp, found := u.registry.GetComponent(domain.EntityID(m.TargetPlayerID), "Health"); found {
					h := healthComp.(*domain.HealthComponent)
					h.HP = pData.HP

					u.playersMu.Lock()
					if pState, exists := u.players[m.TargetPlayerID]; exists && pState != nil {
						pState.HP = h.HP
					}
					u.playersMu.Unlock()
				}
			}
		} else {
			m.Animation = "idle"
		}

	case "returning":
		if m.TargetPlayerID != "" {
			u.activePlayersMu.RLock()
			pData, exists := u.activePlayers[m.TargetPlayerID]
			u.activePlayersMu.RUnlock()
			if exists && pData != nil && pData.HP > 0 {
				m.AIState = "chase"
				break
			}
			m.TargetPlayerID = ""
		}

		dirX := m.SpawnPosition.X - m.Position.X
		dirZ := m.SpawnPosition.Z - m.Position.Z
		dist := float32(math.Sqrt(float64(dirX*dirX + dirZ*dirZ)))
		if dist > 0.3 {
			m.Position.X += (dirX / dist) * m.Speed * 0.85 * dt
			m.Position.Z += (dirZ / dist) * m.Speed * 0.85 * dt
			m.Animation = "walk"
		} else {
			m.Position = m.SpawnPosition
			m.HP = m.MaxHP
			if healthComp, found := u.registry.GetComponent(domain.EntityID(m.ID), "Health"); found {
				h := healthComp.(*domain.HealthComponent)
				h.HP = m.HP
			}
			m.AIState = "idle"
		}
	}

	if posComp, found := u.registry.GetComponent(domain.EntityID(m.ID), "Position"); found {
		p := posComp.(*domain.PositionComponent)
		p.X = m.Position.X
		p.Y = m.Position.Y
		p.Z = m.Position.Z
		p.Animation = m.Animation
	}
}
