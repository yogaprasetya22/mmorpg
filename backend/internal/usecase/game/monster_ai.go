package game

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/looplab/fsm"
	"mmorpg-backend/internal/domain"
)

// getOrCreateMonsterFSM retrieves or instantiates a unique FSM state machine for a monster.
func (u *gameUsecase) getOrCreateMonsterFSM(m *domain.Monster) *fsm.FSM {
	u.fsmMu.Lock()
	defer u.fsmMu.Unlock()

	if f, exists := u.fsmMap[m.ID]; exists {
		return f
	}

	// Initialize new FSM for this monster
	f := fsm.NewFSM(
		"idle",
		fsm.Events{
			{Name: "patrol", Src: []string{"idle"}, Dst: "patrol"},
			{Name: "chase", Src: []string{"idle", "patrol", "returning"}, Dst: "chase"},
			{Name: "attack", Src: []string{"chase"}, Dst: "attack"},
			{Name: "chase_back", Src: []string{"attack"}, Dst: "chase"},
			{Name: "idle", Src: []string{"patrol", "returning", "attack", "chase"}, Dst: "idle"},
			{Name: "return", Src: []string{"chase", "attack", "patrol", "idle"}, Dst: "returning"},
			{Name: "die", Src: []string{"idle", "patrol", "chase", "attack", "returning"}, Dst: "dead"},
			{Name: "respawn", Src: []string{"dead"}, Dst: "idle"},
		},
		fsm.Callbacks{},
	)

	u.fsmMap[m.ID] = f
	return f
}

// processMonsterAI is a dedicated, specialized function to process the FSM AI state machine for a single monster.
func (u *gameUsecase) processMonsterAI(m *domain.Monster, dt float32) {
	// Retrieve authoritative FSM machine
	f := u.getOrCreateMonsterFSM(m)

	ctx := context.Background()

	// Force Die transition if dead
	if m.IsDead {
		if f.Current() != "dead" {
			_ = f.Event(ctx, "die")
		}
		m.Animation = "death"
		m.AIState = "dead"

		// Check for respawn
		if time.Now().After(m.RespawnTime) {
			m.Respawn()
			_ = f.Event(ctx, "respawn")
			m.Animation = "idle"
			m.AIState = "idle"

			// Update ECS Registry
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

	// Dynamic state-based execution
	switch f.Current() {
	case "idle":
		m.Animation = "idle"

		// AUTHORITATIVE TARGET LOCK: If already has a valid attacker locked, immediately chase!
		if m.TargetPlayerID != "" {
			u.activePlayersMu.RLock()
			pData, exists := u.activePlayers[m.TargetPlayerID]
			u.activePlayersMu.RUnlock()
			if exists && pData != nil && pData.HP > 0 {
				_ = f.Event(ctx, "chase")
				fmt.Printf("❗ [LOCK] Monster %s melanjutkan pertempuran dengan Player %s yang memukulnya!\n", m.Name, m.TargetPlayerID)
				break
			} else {
				m.TargetPlayerID = ""
			}
		}

		// Aggro check: Seek nearby active players
		var closestPlayerID string
		var minDistance float32 = m.AggroRange
		distFromHome := m.Position.DistanceTo(m.SpawnPosition)

		// Seek target only near spawn to avoid infinite pull abuses
		if distFromHome <= 8.0 {
			for _, p := range u.players {
				pPos := domain.Vector3{X: p.X, Y: p.Y, Z: p.Z}
				dist := m.Position.DistanceTo(pPos)
				if dist < minDistance {
					u.activePlayersMu.RLock()
					pData, exists := u.activePlayers[p.ID]
					u.activePlayersMu.RUnlock()
					if exists && pData != nil && pData.HP > 0 {
						minDistance = dist
						closestPlayerID = p.ID
					}
				}
			}
		}

		if closestPlayerID != "" {
			m.TargetPlayerID = closestPlayerID
			_ = f.Event(ctx, "chase")
			fmt.Printf("❗ Monster %s terprovokasi (Aggro) ke Player %s!\n", m.Name, closestPlayerID)
		} else {
			// Check patrol waiting interval
			u.patrolTargetsMu.Lock()
			waitTime, isWaiting := u.patrolWaiting[m.ID]
			u.patrolTargetsMu.Unlock()

			if isWaiting {
				if time.Now().Before(waitTime) {
					// Continue waiting
					break
				} else {
					u.patrolTargetsMu.Lock()
					delete(u.patrolWaiting, m.ID)
					u.patrolTargetsMu.Unlock()
				}
			}

			// Transition to Patrol: pick a random target point within 4.5 units of spawn position
			u.patrolTargetsMu.Lock()
			angle := float64(rand.Intn(360)) * math.Pi / 180.0
			radius := float32(rand.Intn(45)) / 10.0 // 0 to 4.5 units
			
			targetPos := domain.Vector3{
				X: m.SpawnPosition.X + float32(math.Cos(angle))*radius,
				Y: m.SpawnPosition.Y,
				Z: m.SpawnPosition.Z + float32(math.Sin(angle))*radius,
			}
			u.patrolTargets[m.ID] = targetPos
			u.patrolTargetsMu.Unlock()

			_ = f.Event(ctx, "patrol")
		}

	case "patrol":
		// AUTHORITATIVE TARGET LOCK: If already has a valid attacker locked, immediately chase!
		if m.TargetPlayerID != "" {
			u.activePlayersMu.RLock()
			pData, exists := u.activePlayers[m.TargetPlayerID]
			u.activePlayersMu.RUnlock()
			if exists && pData != nil && pData.HP > 0 {
				_ = f.Event(ctx, "chase")
				fmt.Printf("❗ [LOCK] Monster %s mengejar Player %s yang memukulnya!\n", m.Name, m.TargetPlayerID)
				break
			} else {
				m.TargetPlayerID = ""
			}
		}

		// Aggro check: Seek nearby active players
		var closestPlayerID string
		var minDistance float32 = m.AggroRange
		distFromHome := m.Position.DistanceTo(m.SpawnPosition)

		if distFromHome <= 8.0 {
			for _, p := range u.players {
				pPos := domain.Vector3{X: p.X, Y: p.Y, Z: p.Z}
				dist := m.Position.DistanceTo(pPos)
				if dist < minDistance {
					u.activePlayersMu.RLock()
					pData, exists := u.activePlayers[p.ID]
					u.activePlayersMu.RUnlock()
					if exists && pData != nil && pData.HP > 0 {
						minDistance = dist
						closestPlayerID = p.ID
					}
				}
			}
		}

		if closestPlayerID != "" {
			m.TargetPlayerID = closestPlayerID
			_ = f.Event(ctx, "chase")
			fmt.Printf("❗ Monster %s terprovokasi (Aggro) ke Player %s!\n", m.Name, closestPlayerID)
			break
		}

		// Move towards patrol target
		u.patrolTargetsMu.Lock()
		targetPos, hasTarget := u.patrolTargets[m.ID]
		u.patrolTargetsMu.Unlock()

		if !hasTarget {
			_ = f.Event(ctx, "idle")
			break
		}

		dirX := targetPos.X - m.Position.X
		dirZ := targetPos.Z - m.Position.Z
		dist := float32(math.Sqrt(float64(dirX*dirX + dirZ*dirZ)))

		if dist > 0.3 {
			m.Position.X += (dirX / dist) * m.Speed * 0.50 * dt
			m.Position.Z += (dirZ / dist) * m.Speed * 0.50 * dt
			m.Animation = "walk"
		} else {
			u.patrolTargetsMu.Lock()
			delete(u.patrolTargets, m.ID)
			u.patrolWaiting[m.ID] = time.Now().Add(time.Duration(3+rand.Intn(4)) * time.Second)
			u.patrolTargetsMu.Unlock()
			_ = f.Event(ctx, "idle")
		}

	case "chase":
		if m.TargetPlayerID == "" {
			_ = f.Event(ctx, "return")
			break
		}

		targetPlayer, exists := u.players[m.TargetPlayerID]
		if !exists {
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		playerPos := domain.Vector3{X: targetPlayer.X, Y: targetPlayer.Y, Z: targetPlayer.Z}
		dist := m.Position.DistanceTo(playerPos)

		// Leash distance check: distance from SpawnPosition
		distFromHome := m.Position.DistanceTo(m.SpawnPosition)
		if distFromHome > 18.0 {
			fmt.Printf("⛓️ [LEASH] Monster %s berpaling karena mengejar terlalu jauh dari spawn (%.2f unit)!\n", m.Name, distFromHome)
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		// If player died, reset
		u.activePlayersMu.RLock()
		pData, exists := u.activePlayers[m.TargetPlayerID]
		u.activePlayersMu.RUnlock()
		if !exists || pData == nil || pData.HP <= 0 {
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		// If in range: transition to attack
		if dist <= 3.5 {
			_ = f.Event(ctx, "attack")
			break
		}

		// Continue chasing
		m.Animation = "run"
		dirX := playerPos.X - m.Position.X
		dirZ := playerPos.Z - m.Position.Z
		length := float32(math.Sqrt(float64(dirX*dirX + dirZ*dirZ)))
		
		if length > 0 {
			dirX /= length
			dirZ /= length
			m.Position.X += dirX * m.Speed * dt
			m.Position.Z += dirZ * m.Speed * dt
		}

	case "attack":
		if m.TargetPlayerID == "" {
			_ = f.Event(ctx, "return")
			break
		}

		targetPlayer, exists := u.players[m.TargetPlayerID]
		if !exists {
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		playerPos := domain.Vector3{X: targetPlayer.X, Y: targetPlayer.Y, Z: targetPlayer.Z}
		dist := m.Position.DistanceTo(playerPos)

		// Leash distance check: distance from SpawnPosition
		distFromHome := m.Position.DistanceTo(m.SpawnPosition)
		if distFromHome > 18.0 {
			fmt.Printf("⛓️ [LEASH] Monster %s berpaling karena bertarung terlalu jauh dari spawn (%.2f unit)!\n", m.Name, distFromHome)
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		u.activePlayersMu.RLock()
		pData, exists := u.activePlayers[m.TargetPlayerID]
		u.activePlayersMu.RUnlock()
		if !exists || pData == nil || pData.HP <= 0 {
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		// If target moved out of range, chase back!
		if dist > 3.5 {
			_ = f.Event(ctx, "chase_back")
			break
		}

		// Authoritative Animation Lock: strike visual lasts 1000ms
		if time.Since(m.LastAttackTime) < 1000*time.Millisecond {
			m.Animation = "attack"
			break
		}

		// Cooldown execution (1.5 seconds)
		if time.Since(m.LastAttackTime) >= 1500*time.Millisecond {
			m.Animation = "attack"
			m.LastAttackTime = time.Now()

			// Apply strike damage with defense mitigation
			dmg := m.Attack
			damageMultiplier := float32(100.0) / (100.0 + pData.Defense)
			mitigatedDamage := dmg * damageMultiplier

			variation := float32((time.Now().UnixNano() % 20) - 10) / 100.0
			finalDamage := mitigatedDamage * (1.0 + variation)

			if finalDamage < 1 {
				finalDamage = 1
			}

			maxHitDmg := pData.MaxHP * 0.35
			if finalDamage > maxHitDmg {
				finalDamage = maxHitDmg
			}

			pData.HP -= finalDamage
			if pData.HP <= 0 {
				pData.HP = 0
				m.TargetPlayerID = ""
				_ = f.Event(ctx, "return")
				fmt.Printf("☠️ Monster %s membunuh Player %s!\n", m.Name, pData.Username)
				
				// Respawn player handler after 5s
				go func(pID string, pUser string) {
					time.Sleep(5 * time.Second)
					u.activePlayersMu.RLock()
					pl, exists := u.activePlayers[pID]
					u.activePlayersMu.RUnlock()
					if exists && pl != nil {
						pl.HP = pl.MaxHP
						_ = u.playerRepo.Update(pl)

						// Update player HP in ECS registry
						if pHcomp, found := u.registry.GetComponent(domain.EntityID(pID), "Health"); found {
							h := pHcomp.(*domain.HealthComponent)
							h.HP = pl.HP
							h.MaxHP = pl.MaxHP
						}

						// Move player back to their last exited/saved coordinates in registry and Redis
						u.UpdatePlayerMovement(pID, pl.LastX, pl.LastY, pl.LastZ, 0, "idle", "")
						fmt.Printf("🛡️ Player %s telah hidup kembali di koordinat terakhir (%f, %f, %f).\n", pUser, pl.LastX, pl.LastY, pl.LastZ)
					}
				}(targetPlayer.ID, pData.Username)
			}

			// Update ECS Player Health Component and Real-time WebSocket state
			if healthComp, found := u.registry.GetComponent(domain.EntityID(m.TargetPlayerID), "Health"); found {
				h := healthComp.(*domain.HealthComponent)
				h.HP = pData.HP

				u.playersMu.Lock()
				if pState, exists := u.players[m.TargetPlayerID]; exists && pState != nil {
					pState.HP = h.HP
				}
				u.playersMu.Unlock()
			}
		} else {
			// Look idle while waiting for attack cooldown tick
			m.Animation = "idle"
		}

	case "returning":
		// AUTHORITATIVE TARGET LOCK: If hit while returning, turn back and chase!
		if m.TargetPlayerID != "" {
			u.activePlayersMu.RLock()
			pData, exists := u.activePlayers[m.TargetPlayerID]
			u.activePlayersMu.RUnlock()
			if exists && pData != nil && pData.HP > 0 {
				_ = f.Event(ctx, "chase")
				fmt.Printf("❗ [LOCK] Monster %s dipukul saat kembali, berputar mengejar Player %s!\n", m.Name, m.TargetPlayerID)
				break
			} else {
				m.TargetPlayerID = ""
			}
		}
		
		dirX := m.SpawnPosition.X - m.Position.X
		dirZ := m.SpawnPosition.Z - m.Position.Z
		dist := float32(math.Sqrt(float64(dirX*dirX + dirZ*dirZ)))

		if dist > 0.3 {
			m.Position.X += (dirX / dist) * m.Speed * 0.85 * dt
			m.Position.Z += (dirZ / dist) * m.Speed * 0.85 * dt
			m.Animation = "walk"
		} else {
			// Spawn position reached safely
			m.Position = m.SpawnPosition
			m.HP = m.MaxHP
			if healthComp, found := u.registry.GetComponent(domain.EntityID(m.ID), "Health"); found {
				h := healthComp.(*domain.HealthComponent)
				h.HP = m.HP
			}
			_ = f.Event(ctx, "idle")
		}
	}

	// Always sync FSM current state name to domain.Monster field
	m.AIState = f.Current()

	// Synchronize Monster position and animation in ECS Registry
	if posComp, found := u.registry.GetComponent(domain.EntityID(m.ID), "Position"); found {
		p := posComp.(*domain.PositionComponent)
		p.X = m.Position.X
		p.Y = m.Position.Y
		p.Z = m.Position.Z
		p.Animation = m.Animation
	}
}

// processMonsterAIWithSnapshot adalah versi optimasi dari processMonsterAI yang
// menggunakan pre-captured snapshot dari player state untuk menghindari lock contention.
// Dipanggil dari SimulateMonstersTick dengan snapshot yang sudah dibuat sebelumnya.
func (u *gameUsecase) processMonsterAIWithSnapshot(m *domain.Monster, dt float32, playerSnap map[string]*domain.PlayerNetworkState) {
	f := u.getOrCreateMonsterFSM(m)
	ctx := context.Background()

	// --- DEAD / RESPAWN HANDLING ---
	if m.IsDead {
		if f.Current() != "dead" {
			_ = f.Event(ctx, "die")
		}
		m.Animation = "death"
		m.AIState = "dead"

		if time.Now().After(m.RespawnTime) {
			m.Respawn()
			_ = f.Event(ctx, "respawn")
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

	// Helper: cari player terdekat di snapshot
	findClosestPlayer := func(maxRange float32) (closestID string) {
		var minDist float32 = maxRange
		for id, p := range playerSnap {
			pPos := domain.Vector3{X: p.X, Y: p.Y, Z: p.Z}
			dist := m.Position.DistanceTo(pPos)
			if dist < minDist {
				// Cek apakah player masih hidup dari activePlayersMu (lightweight read)
				u.activePlayersMu.RLock()
				pData, exists := u.activePlayers[id]
				u.activePlayersMu.RUnlock()
				if exists && pData != nil && pData.HP > 0 {
					minDist = dist
					closestID = id
				}
			}
		}
		return
	}

	switch f.Current() {
	case "idle":
		m.Animation = "idle"

		// Pertahankan target lama jika masih valid
		if m.TargetPlayerID != "" {
			u.activePlayersMu.RLock()
			pData, exists := u.activePlayers[m.TargetPlayerID]
			u.activePlayersMu.RUnlock()
			if exists && pData != nil && pData.HP > 0 {
				_ = f.Event(ctx, "chase")
				break
			}
			m.TargetPlayerID = ""
		}

		if m.Position.DistanceTo(m.SpawnPosition) <= 8.0 {
			if id := findClosestPlayer(m.AggroRange); id != "" {
				m.TargetPlayerID = id
				_ = f.Event(ctx, "chase")
				fmt.Printf("❗ Monster %s terprovokasi ke Player %s!\n", m.Name, id)
				break
			}
		}

		// Patrol
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
		_ = f.Event(ctx, "patrol")

	case "patrol":
		if m.TargetPlayerID != "" {
			u.activePlayersMu.RLock()
			pData, exists := u.activePlayers[m.TargetPlayerID]
			u.activePlayersMu.RUnlock()
			if exists && pData != nil && pData.HP > 0 {
				_ = f.Event(ctx, "chase")
				break
			}
			m.TargetPlayerID = ""
		}

		if m.Position.DistanceTo(m.SpawnPosition) <= 8.0 {
			if id := findClosestPlayer(m.AggroRange); id != "" {
				m.TargetPlayerID = id
				_ = f.Event(ctx, "chase")
				break
			}
		}

		u.patrolTargetsMu.Lock()
		targetPos, hasTarget := u.patrolTargets[m.ID]
		u.patrolTargetsMu.Unlock()
		if !hasTarget {
			_ = f.Event(ctx, "idle")
			break
		}
		dirX := targetPos.X - m.Position.X
		dirZ := targetPos.Z - m.Position.Z
		dist := float32(math.Sqrt(float64(dirX*dirX + dirZ*dirZ)))
		if dist > 0.3 {
			// Patrol speed: 60% of base speed (lebih natural dan cukup terlihat)
			m.Position.X += (dirX / dist) * m.Speed * 0.60 * dt
			m.Position.Z += (dirZ / dist) * m.Speed * 0.60 * dt
			m.Animation = "walk"
		} else {
			u.patrolTargetsMu.Lock()
			delete(u.patrolTargets, m.ID)
			u.patrolWaiting[m.ID] = time.Now().Add(time.Duration(2+rand.Intn(3)) * time.Second)
			u.patrolTargetsMu.Unlock()
			_ = f.Event(ctx, "idle")
		}

	case "chase":
		if m.TargetPlayerID == "" {
			_ = f.Event(ctx, "return")
			break
		}
		targetPlayer, exists := playerSnap[m.TargetPlayerID]
		if !exists {
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		u.activePlayersMu.RLock()
		pData, pExists := u.activePlayers[m.TargetPlayerID]
		u.activePlayersMu.RUnlock()
		if !pExists || pData == nil || pData.HP <= 0 {
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		playerPos := domain.Vector3{X: targetPlayer.X, Y: targetPlayer.Y, Z: targetPlayer.Z}
		dist := m.Position.DistanceTo(playerPos)

		// Leash distance check: distance from SpawnPosition
		distFromHome := m.Position.DistanceTo(m.SpawnPosition)
		if distFromHome > 18.0 {
			fmt.Printf("⛓️ [LEASH-SNAP] Monster %s berpaling karena mengejar terlalu jauh dari spawn (%.2f unit)!\n", m.Name, distFromHome)
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		if dist <= 3.5 {
			_ = f.Event(ctx, "attack")
			break
		}

		// Chase speed: full speed (lebih responsif saat mengejar)
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
			_ = f.Event(ctx, "return")
			break
		}
		targetPlayer, exists := playerSnap[m.TargetPlayerID]
		if !exists {
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		u.activePlayersMu.RLock()
		pData, pExists := u.activePlayers[m.TargetPlayerID]
		u.activePlayersMu.RUnlock()
		if !pExists || pData == nil || pData.HP <= 0 {
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}

		playerPos := domain.Vector3{X: targetPlayer.X, Y: targetPlayer.Y, Z: targetPlayer.Z}
		dist := m.Position.DistanceTo(playerPos)

		// Leash distance check: distance from SpawnPosition
		distFromHome := m.Position.DistanceTo(m.SpawnPosition)
		if distFromHome > 18.0 {
			fmt.Printf("⛓️ [LEASH-SNAP] Monster %s berpaling karena bertarung terlalu jauh dari spawn (%.2f unit)!\n", m.Name, distFromHome)
			m.TargetPlayerID = ""
			_ = f.Event(ctx, "return")
			break
		}
		if dist > 3.5 {
			_ = f.Event(ctx, "chase_back")
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
				m.TargetPlayerID = ""
				_ = f.Event(ctx, "return")
				fmt.Printf("☠️ Monster %s membunuh Player %s!\n", m.Name, pData.Username)

				go func(pID string, pUser string) {
					time.Sleep(5 * time.Second)
					u.activePlayersMu.RLock()
					pl, exists := u.activePlayers[pID]
					u.activePlayersMu.RUnlock()
					if exists && pl != nil {
						pl.HP = pl.MaxHP
						_ = u.playerRepo.Update(pl)
						if pHcomp, found := u.registry.GetComponent(domain.EntityID(pID), "Health"); found {
							h := pHcomp.(*domain.HealthComponent)
							h.HP = pl.HP
							h.MaxHP = pl.MaxHP
						}
						u.UpdatePlayerMovement(pID, pl.LastX, pl.LastY, pl.LastZ, 0, "idle", "")
						fmt.Printf("🛡️ Player %s telah hidup kembali.\n", pUser)
					}
				}(targetPlayer.ID, pData.Username)
			}
			u.activePlayersMu.Unlock()

			// Update ECS Player Health Component and Real-time WebSocket state
			if healthComp, found := u.registry.GetComponent(domain.EntityID(m.TargetPlayerID), "Health"); found {
				h := healthComp.(*domain.HealthComponent)
				h.HP = pData.HP

				u.playersMu.Lock()
				if pState, exists := u.players[m.TargetPlayerID]; exists && pState != nil {
					pState.HP = h.HP
				}
				u.playersMu.Unlock()
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
				_ = f.Event(ctx, "chase")
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
			_ = f.Event(ctx, "idle")
		}
	}

	m.AIState = f.Current()

	if posComp, found := u.registry.GetComponent(domain.EntityID(m.ID), "Position"); found {
		p := posComp.(*domain.PositionComponent)
		p.X = m.Position.X
		p.Y = m.Position.Y
		p.Z = m.Position.Z
		p.Animation = m.Animation
	}
}

