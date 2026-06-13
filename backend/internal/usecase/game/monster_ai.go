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

func getMaxLeashRange(m *domain.Monster) float32 {
	maxLeash := float32(40.0) // 40.0 units leash distance for normal monsters to feel spacious and fun
	if m.Type == "boss" {
		maxLeash = 85.0 // Bosses have a huge battlefield range
	}
	// If monster is actively in combat (taken damage within last 4s), extend leash by 1.5x
	if time.Since(m.LastHitTime) < 4*time.Second {
		maxLeash *= 1.5
	}
	return maxLeash
}

// processMonsterAIWithSnapshot is an ultra-fast, lock-free, and allocation-free FSM state machine
// that scales horizontally up to 10,000+ entities via Goroutines and O(1) Spatial Hash Grid indexing.
func (u *gameUsecase) processMonsterAIWithSnapshot(m *domain.Monster, dt float32, playerSnap map[string]*domain.PlayerNetworkState, grid *SpatialHashGrid) {
	// Default state fallback
	if m.AIState == "" {
		m.AIState = "idle"
	}

	// ─── Buff Expiry Check (runs every tick) ───────────────────────────────────
	if !m.BuffExpiresAt.IsZero() && time.Now().After(m.BuffExpiresAt) {
		m.BuffAttackMult = 1.0
		m.BuffDefenseMult = 1.0
		m.BuffExpiresAt = time.Time{}
	}

	// Clear CurrentSkill after cast completes
	if m.CurrentSkill != "" && m.AIState != "casting" && m.AIState != "attack" {
		m.CurrentSkill = ""
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
				if existsActive && pData != nil && pData.HP > 0 && (pData.SpawnProtectedUntil.IsZero() || time.Now().After(pData.SpawnProtectedUntil)) {
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
			if exists && pData != nil && pData.HP > 0 && (pData.SpawnProtectedUntil.IsZero() || time.Now().After(pData.SpawnProtectedUntil)) {
				m.AIState = "chase"
				break
			}
			m.TargetPlayerID = ""
		}

		if id := findClosestPlayer(m.AggroRange); id != "" {
			m.TargetPlayerID = id
			m.AIState = "chase"
			fmt.Printf("❗ Monster %s terprovokasi ke Player %s!\n", m.Name, id)
			break
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
			if exists && pData != nil && pData.HP > 0 && (pData.SpawnProtectedUntil.IsZero() || time.Now().After(pData.SpawnProtectedUntil)) {
				m.AIState = "chase"
				break
			}
			m.TargetPlayerID = ""
		}

		if id := findClosestPlayer(m.AggroRange); id != "" {
			m.TargetPlayerID = id
			m.AIState = "chase"
			break
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
		if !pExists || pData == nil || pData.HP <= 0 || (!pData.SpawnProtectedUntil.IsZero() && time.Now().Before(pData.SpawnProtectedUntil)) {
			m.TargetPlayerID = ""
			m.AIState = "returning"
			break
		}

		playerPos := domain.Vector3{X: targetPlayer.X, Y: targetPlayer.Y, Z: targetPlayer.Z}
		dist := m.Position.DistanceTo(playerPos)

		// Tether limit check matching Ragnarok Online & ROX
		distFromHome := m.Position.DistanceTo(m.SpawnPosition)
		maxLeash := getMaxLeashRange(m)
		if distFromHome > maxLeash {
			fmt.Printf("⛓️ [LEASH-SNAP] Monster %s berpaling karena mengejar terlalu jauh (%.2f/%.2f unit)!\n", m.Name, distFromHome, maxLeash)
			m.TargetPlayerID = ""
			m.AIState = "returning"
			break
		}

		dy := float32(math.Abs(float64(m.Position.Y - playerPos.Y)))

		// ─── Ranged AI: prefer keeping distance, don't rush to melee ───────────
		if m.IsRanged {
			// Switch to attack if within preferred range
			if dist <= m.PreferredRange && dy <= 4.5 {
				m.AIState = "attack"
				break
			}
			// If target is too close (< 5 units), back away while chasing
			if dist < 5.0 {
				m.Animation = "run"
				dirX := m.Position.X - playerPos.X // reverse direction: move AWAY
				dirZ := m.Position.Z - playerPos.Z
				length := float32(math.Sqrt(float64(dirX*dirX + dirZ*dirZ)))
				if length > 0 {
					m.Position.X += (dirX / length) * m.Speed * 1.2 * dt
					m.Position.Z += (dirZ / length) * m.Speed * 1.2 * dt
				}
				break
			}
		}

		// Melee: switch to attack when close enough
		attackRange := float32(3.5)
		if m.Type == "boss" {
			attackRange = 4.5
		}
		if !m.IsRanged && dist <= attackRange && dy <= 4.5 {
			m.AIState = "attack"
			break
		}

		if time.Since(m.LastHitTime) < 220*time.Millisecond {
			m.Animation = "idle" // Stagger flinch visual lock
			break
		}

		m.Animation = "run"
		dirX := playerPos.X - m.Position.X
		dirZ := playerPos.Z - m.Position.Z
		length := float32(math.Sqrt(float64(dirX*dirX + dirZ*dirZ)))
		if length > 0 {
			// Chase speed: 1.6x base speed for responsive pursuit
			m.Position.X += (dirX / length) * m.Speed * 1.6 * dt
			m.Position.Z += (dirZ / length) * m.Speed * 1.6 * dt
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
		if !pExists || pData == nil || pData.HP <= 0 || (!pData.SpawnProtectedUntil.IsZero() && time.Now().Before(pData.SpawnProtectedUntil)) {
			m.TargetPlayerID = ""
			m.AIState = "returning"
			break
		}

		playerPos := domain.Vector3{X: targetPlayer.X, Y: targetPlayer.Y, Z: targetPlayer.Z}
		dist := m.Position.DistanceTo(playerPos)

		// Tether limit check matching Ragnarok Online & ROX
		distFromHome := m.Position.DistanceTo(m.SpawnPosition)
		maxLeash := getMaxLeashRange(m)
		if distFromHome > maxLeash {
			fmt.Printf("⛓️ [LEASH-SNAP] Monster %s berpaling karena menyerang terlalu jauh (%.2f/%.2f unit)!\n", m.Name, distFromHome, maxLeash)
			m.TargetPlayerID = ""
			m.AIState = "returning"
			break
		}

		dyAttack := float32(math.Abs(float64(m.Position.Y - playerPos.Y)))
		// Ranged monsters: break to chase if target is beyond preferred range
		if m.IsRanged {
			if dist > m.PreferredRange+2.0 || dyAttack > 4.5 {
				m.AIState = "chase"
				break
			}
		} else {
			// Melee: break to chase if target is beyond melee reach
			meleeRange := float32(3.5)
			if m.Type == "boss" {
				meleeRange = 4.5
			}
			if dist > meleeRange || dyAttack > 4.5 {
				m.AIState = "chase"
				break
			}
		}

		if time.Since(m.LastHitTime) < 220*time.Millisecond {
			m.Animation = "idle" // Stagger flinch visual lock prevents attack swings
			break
		}

		attackInterval := 1200 * time.Millisecond
		if m.Type == "boss" {
			attackInterval = 700 * time.Millisecond
		}

		if time.Since(m.LastAttackTime) < attackInterval {
			m.Animation = "attack"
			break
		}

		if time.Since(m.LastAttackTime) >= attackInterval {
			m.Animation = "attack"
			m.LastAttackTime = time.Now()

			// ─── Skill Selection: 30% chance to use a skill instead of basic attack ────
			var selectedSkill *domain.MonsterSkill
			if len(m.Skills) > 0 && rand.Float32() < 0.30 {
				now := time.Now()
				// Shuffle skill order for variety
				skillIndices := rand.Perm(len(m.Skills))
				for _, idx := range skillIndices {
					sk := &m.Skills[idx]
					cdExpiry, onCooldown := m.SkillCooldowns[sk.Name]
					if onCooldown && now.Before(cdExpiry) {
						continue
					}
					// Check skill range
					if sk.Type == "buff" || sk.Type == "heal" {
						selectedSkill = sk
						break
					}
					if dist <= sk.Range {
						selectedSkill = sk
						break
					}
				}
			}

			if selectedSkill != nil {
				// ─── Execute Monster Skill ────────────────────────────────────────
				sk := selectedSkill
				m.CurrentSkill = sk.Name
				m.SkillCooldowns[sk.Name] = time.Now().Add(time.Duration(sk.CooldownMs) * time.Millisecond)

				switch sk.Type {
				case "buff":
					// Self-buff: apply attack or defense multiplier
					switch sk.Effect {
					case "atk_buff":
						m.BuffAttackMult = 1.0 + sk.EffectValue
						m.BuffExpiresAt = time.Now().Add(time.Duration(float64(sk.EffectDurSec) * float64(time.Second)))
						fmt.Printf("🔥 SKILL: %s uses %s (+%.0f%% ATK for %.1fs)!\n", m.Name, sk.Name, sk.EffectValue*100, sk.EffectDurSec)
					case "def_buff":
						m.BuffDefenseMult = 1.0 + sk.EffectValue
						m.BuffExpiresAt = time.Now().Add(time.Duration(float64(sk.EffectDurSec) * float64(time.Second)))
						fmt.Printf("🛡️ SKILL: %s uses %s (+%.0f%% DEF for %.1fs)!\n", m.Name, sk.Name, sk.EffectValue*100, sk.EffectDurSec)
					case "heal":
						healAmount := m.MaxHP * sk.EffectValue
						m.HP += healAmount
						if m.HP > m.MaxHP {
							m.HP = m.MaxHP
						}
						if healthComp, found := u.registry.GetComponent(domain.EntityID(m.ID), "Health"); found {
							h := healthComp.(*domain.HealthComponent)
							h.HP = m.HP
						}
						fmt.Printf("💚 SKILL: %s uses %s (healed %.0f HP)!\n", m.Name, sk.Name, healAmount)
					}
					break // Buff skills don't deal damage, skip rest of attack

				case "melee", "ranged", "aoe":
					// Compute skill damage
					skillBaseDmg := m.Attack * sk.DamageMult * m.BuffAttackMult
					damageMultiplier := float32(100.0) / (100.0 + pData.Defense)
					mitigatedDamage := skillBaseDmg * damageMultiplier
					variation := float32((time.Now().UnixNano()%20)-10) / 100.0
					finalDamage := mitigatedDamage * (1.0 + variation)
					if finalDamage < 1 {
						finalDamage = 1
					}
					maxHitDmg := pData.MaxHP * 0.35
					if finalDamage > maxHitDmg {
						finalDamage = maxHitDmg
					}

					// Multi-hit skills: multiply total hits
					hits := sk.Hits
					if hits < 1 {
						hits = 1
					}
					totalDamage := finalDamage * float32(hits)

					u.activePlayersMu.Lock()
					if !pData.SpawnProtectedUntil.IsZero() && time.Now().Before(pData.SpawnProtectedUntil) {
						u.activePlayersMu.Unlock()
						break
					}
					pData.HP -= totalDamage

					// Apply skill effect to player
					if pData.HP > 0 && sk.Effect != "none" && sk.Effect != "" {
						u.applySkillEffect(m, pData, sk)
					}

					fmt.Printf("⚡ SKILL: %s uses %s on %s (%.0f dmg x%d = %.0f total)!\n",
						m.Name, sk.Name, pData.Username, finalDamage, hits, totalDamage)

					// Broadcast skill combat event
					u.eventCallback("combat_damage_event", map[string]interface{}{
						"attackerId":  m.ID,
						"targetId":    m.TargetPlayerID,
						"targetType":  "player",
						"damage":      totalDamage,
						"isCrit":      false,
						"isMiss":      false,
						"isMagic":     sk.Type == "ranged",
						"skillName":   sk.Name,
						"skillEffect": sk.Effect,
					})

					// Lifesteal effect: heal monster
					if sk.Effect == "lifesteal" && sk.EffectValue > 0 {
						healAmt := totalDamage * sk.EffectValue
						m.HP += healAmt
						if m.HP > m.MaxHP {
							m.HP = m.MaxHP
						}
						if healthComp, found := u.registry.GetComponent(domain.EntityID(m.ID), "Health"); found {
							h := healthComp.(*domain.HealthComponent)
							h.HP = m.HP
						}
					}

					// Handle player death from skill
					if pData.HP <= 0 {
						u.handleMonsterKillPlayer(m, pData, targetPlayer.ID)
						u.activePlayersMu.Unlock()
						break
					}
					u.activePlayersMu.Unlock()

					// Update ECS Player Health for skill damage
					if healthComp, found := u.registry.GetComponent(domain.EntityID(m.TargetPlayerID), "Health"); found {
						h := healthComp.(*domain.HealthComponent)
						h.HP = pData.HP
						u.playersMu.Lock()
						if pState, exists := u.players[m.TargetPlayerID]; exists && pState != nil {
							pState.HP = h.HP
						}
						u.playersMu.Unlock()
					}
					break // Skill executed, skip basic attack logic
				}
			} else {
				// ─── Basic Attack (no skill selected) ─────────────────────────────────
				dmg := m.Attack * m.BuffAttackMult
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
				if !pData.SpawnProtectedUntil.IsZero() && time.Now().Before(pData.SpawnProtectedUntil) {
					u.activePlayersMu.Unlock()
					fmt.Printf("🛡️ Player %s kebal karena masa perlindungan spawn aktif!\n", pData.Username)
					break
				}
				pData.HP -= finalDamage

				// Apply a status debuff if the player doesn't already have one, is alive, and is not immune:
				// - Boss: 10% chance
				// - Normal monster: 3% chance
				debuffChance := float32(0.03)
				if m.Type == "boss" {
					debuffChance = 0.10
				}
				isImmune := !pData.DebuffImmuneUntil.IsZero() && time.Now().Before(pData.DebuffImmuneUntil)

				if pData.HP > 0 && rand.Float32() < debuffChance && pData.Debuff == "" && !isImmune {
					debuffs := []string{"stun", "freeze", "silence"}
					selectedDebuff := debuffs[rand.Intn(len(debuffs))]

					durationSec := float32(1.0)
					if selectedDebuff == "stun" {
						reduction := float32(pData.BaseVIT) / 100.0
						if reduction > 0.9 {
							reduction = 0.9
						}
						durationSec = 1.0 * (1.0 - reduction)
					} else if selectedDebuff == "freeze" {
						reduction := float32(pData.BaseVIT) / 100.0
						if reduction > 0.9 {
							reduction = 0.9
						}
						durationSec = 1.2 * (1.0 - reduction)
					} else if selectedDebuff == "silence" {
						reduction := float32(pData.BaseINT) / 100.0
						if reduction > 0.9 {
							reduction = 0.9
						}
						durationSec = 1.5 * (1.0 - reduction)
					}

					if durationSec < 0.5 {
						durationSec = 0.5
					}

					pData.Debuff = selectedDebuff
					pData.DebuffUntil = time.Now().Add(time.Duration(float64(durationSec) * float64(time.Second)))
					fmt.Printf("🔥 DEBUFF: Monster %s memberi efek %s ke Player %s selama %.2fs!\n", m.Name, selectedDebuff, pData.Username, durationSec)
				}

				if pData.HP <= 0 {
					u.handleMonsterKillPlayer(m, pData, targetPlayer.ID)
					u.activePlayersMu.Unlock()

					// Update ECS
					if healthComp, found := u.registry.GetComponent(domain.EntityID(m.TargetPlayerID), "Health"); found {
						h := healthComp.(*domain.HealthComponent)
						h.HP = 0
						u.playersMu.Lock()
						if pState, exists := u.players[m.TargetPlayerID]; exists && pState != nil {
							pState.HP = 0
						}
						u.playersMu.Unlock()
					}
				} else {
					u.activePlayersMu.Unlock()

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
			} // end basic attack else
		} else {
			m.Animation = "idle"
		}

	case "returning":
		m.TargetPlayerID = "" // Completely ignore and drop any targets while returning

		// Rapidly heal/regenerate HP back to 100% while returning (25% MaxHP per second)
		if m.HP < m.MaxHP {
			m.HP += m.MaxHP * 0.25 * dt
			if m.HP > m.MaxHP {
				m.HP = m.MaxHP
			}
			// Synchronize ECS Health component in real-time
			if healthComp, found := u.registry.GetComponent(domain.EntityID(m.ID), "Health"); found {
				h := healthComp.(*domain.HealthComponent)
				h.HP = m.HP
			}
		}

		dirX := m.SpawnPosition.X - m.Position.X
		dirZ := m.SpawnPosition.Z - m.Position.Z
		dist := float32(math.Sqrt(float64(dirX*dirX + dirZ*dirZ)))
		if dist > 0.3 {
			// Return speed: 1.8x base speed (smoother than old 2.5x)
			m.Position.X += (dirX / dist) * m.Speed * 1.8 * dt
			m.Position.Z += (dirZ / dist) * m.Speed * 1.8 * dt
			m.Animation = "run"
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

// ─── Helper: applySkillEffect applies a monster skill's status effect to a player ────────
func (u *gameUsecase) applySkillEffect(m *domain.Monster, pData *domain.Player, sk *domain.MonsterSkill) {
	isImmune := !pData.DebuffImmuneUntil.IsZero() && time.Now().Before(pData.DebuffImmuneUntil)
	if isImmune || pData.Debuff != "" {
		return
	}

	switch sk.Effect {
	case "poison":
		// Poison DoT: apply as a debuff that damages over time
		pData.Debuff = "poison"
		pData.DebuffUntil = time.Now().Add(time.Duration(float64(sk.EffectDurSec) * float64(time.Second)))
		fmt.Printf("☣️ SKILL EFFECT: %s poisons %s for %.1fs (%.0f dmg/s)!\n", m.Name, pData.Username, sk.EffectDurSec, sk.EffectValue)
		// Start async DoT goroutine
		go u.applyDoT(pData, sk.EffectValue, sk.EffectDurSec)

	case "bleed":
		pData.Debuff = "bleed"
		pData.DebuffUntil = time.Now().Add(time.Duration(float64(sk.EffectDurSec) * float64(time.Second)))
		fmt.Printf("🩸 SKILL EFFECT: %s causes %s to bleed for %.1fs (%.0f dmg/s)!\n", m.Name, pData.Username, sk.EffectDurSec, sk.EffectValue)
		go u.applyDoT(pData, sk.EffectValue, sk.EffectDurSec)

	case "stun":
		// Stun: reduced by VIT
		reduction := float32(pData.BaseVIT) / 100.0
		if reduction > 0.9 {
			reduction = 0.9
		}
		durSec := sk.EffectDurSec * (1.0 - reduction)
		if durSec < 0.3 {
			durSec = 0.3
		}
		pData.Debuff = "stun"
		pData.DebuffUntil = time.Now().Add(time.Duration(float64(durSec) * float64(time.Second)))
		fmt.Printf("💫 SKILL EFFECT: %s stuns %s for %.2fs!\n", m.Name, pData.Username, durSec)

	case "slow":
		pData.Debuff = "slow"
		pData.DebuffUntil = time.Now().Add(time.Duration(float64(sk.EffectDurSec) * float64(time.Second)))
		fmt.Printf("🐌 SKILL EFFECT: %s slows %s for %.1fs (%.0f%%)!\n", m.Name, pData.Username, sk.EffectDurSec, sk.EffectValue*100)

	case "knockback":
		// Knockback: brief stun + push player away from monster
		pData.Debuff = "stun"
		pData.DebuffUntil = time.Now().Add(time.Duration(float64(sk.EffectDurSec) * float64(time.Second)))
		fmt.Printf("💥 SKILL EFFECT: %s knocks back %s!\n", m.Name, pData.Username)
	}
}

// applyDoT runs as a goroutine to apply damage-over-time effects (poison, bleed)
func (u *gameUsecase) applyDoT(pData *domain.Player, dmgPerSec float32, durSec float32) {
	ticks := int(durSec * 4) // 4 ticks per second
	if ticks < 1 {
		ticks = 1
	}
	tickDmg := dmgPerSec / 4.0
	interval := time.Duration(float64(time.Second) / 4.0)

	for i := 0; i < ticks; i++ {
		time.Sleep(interval)
		u.activePlayersMu.Lock()
		if pData.HP <= 0 || pData.Debuff == "" {
			u.activePlayersMu.Unlock()
			return
		}
		pData.HP -= tickDmg
		if pData.HP < 0 {
			pData.HP = 0
		}
		// Sync HP to ECS
		if healthComp, found := u.registry.GetComponent(domain.EntityID(pData.ID), "Health"); found {
			h := healthComp.(*domain.HealthComponent)
			h.HP = pData.HP
		}
		u.activePlayersMu.Unlock()
	}
}

// ─── Helper: handleMonsterKillPlayer handles player death + respawn from monster attack ──
func (u *gameUsecase) handleMonsterKillPlayer(m *domain.Monster, pData *domain.Player, playerNetID string) {
	pData.HP = 0
	m.TargetPlayerID = ""
	m.AIState = "returning"
	fmt.Printf("☠️ Monster %s membunuh Player %s!\n", m.Name, pData.Username)

	go func(pID string, pUser string) {
		time.Sleep(1500 * time.Millisecond)
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
			pl.LastY = 25.0
			pl.LastZ = 0
			pl.Debuff = ""
			pl.DebuffUntil = time.Time{}
			pl.DebuffImmuneUntil = time.Time{}
			pl.SpawnProtectedUntil = time.Now().Add(8 * time.Second)
			lastX = 0
			lastY = 25.0
			lastZ = 0
		}
		u.activePlayersMu.Unlock()

		if exists && pl != nil {
			u.UpdatePlayerMovement(pID, lastX, lastY, lastZ, 0, "idle", "")
			fmt.Printf("🛡️ Player %s telah hidup kembali di safe zone (0, 0, 0).\n", pUser)
		}
	}(playerNetID, pData.Username)
}
