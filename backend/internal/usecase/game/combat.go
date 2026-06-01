package game

import (
	"fmt"
	"math/rand"
	"time"

	"mmorpg-backend/internal/domain"
)

func (u *gameUsecase) HandlePlayerAttack(playerID string, targetType string, targetID string, clientDmg float32, isCrit bool) {
	fmt.Printf("⚔️ [DEBUG COMBAT] Player %s menyerang %s (ID: %s) | Dmg: %.2f | Crit: %v\n", playerID, targetType, targetID, clientDmg, isCrit)

	u.playersMu.Lock()
	if pState, exists := u.players[playerID]; exists {
		pState.TargetID = targetID
	}
	u.playersMu.Unlock()

	// 1. Get attacker position
	posComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Position")
	if !found {
		fmt.Printf("⚠️ [DEBUG COMBAT CANCEL] PositionComponent tidak ditemukan untuk player ID %s!\n", playerID)
		return
	}
	playerPos := posComp.(*domain.PositionComponent).Vector3

	// 2. Fetch player stats from fast in-memory cache to compute authoritative damage
	u.activePlayersMu.RLock()
	playerData, exists := u.activePlayers[playerID]
	u.activePlayersMu.RUnlock()
	if !exists || playerData == nil {
		fmt.Printf("⚠️ [DEBUG COMBAT CANCEL] Player ID %s tidak ditemukan di activePlayers cache!\n", playerID)
		return
	}

	if playerData.HP <= 0 {
		fmt.Printf("⚠️ Player %s tidak dapat menyerang karena sudah mati.\n", playerData.Username)
		return
	}

	// Authoritative Attack Rate-Limiting based on dynamic ASPD (Ragnarok Renewal / New World style)
	// Formula matches frontend: hitsPerSecond = 1 + (ASPD% / 125)
	// With new RO Renewal ASPD scale (0-1000%), this gives 1-9 hits/sec
	hitsPerSecond := 1.0 + (float64(playerData.ASPD) / 125.0)
	cooldownMs := time.Duration(1000.0/hitsPerSecond) * time.Millisecond
	buffer := 30 * time.Millisecond // Reduced buffer for more responsive combat

	u.activePlayersMu.Lock()
	if !playerData.LastBasicAttackTime.IsZero() && time.Since(playerData.LastBasicAttackTime) < cooldownMs-buffer {
		u.activePlayersMu.Unlock()
		fmt.Printf("⚠️ Authoritative Attack Blocked (Speedhacking prevention): Player %s attack too fast! Cooldown remaining: %v\n", playerData.Username, cooldownMs-time.Since(playerData.LastBasicAttackTime))
		return
	}
	playerData.LastBasicAttackTime = time.Now()

	// Lift spawn protection early when player starts attacking
	if !playerData.SpawnProtectedUntil.IsZero() && time.Now().Before(playerData.SpawnProtectedUntil) {
		playerData.SpawnProtectedUntil = time.Time{}
		fmt.Printf("🛡️ Player %s menyerang, perlindungan spawn dinonaktifkan awal.\n", playerData.Username)
	}
	u.activePlayersMu.Unlock()

	if targetType == "monster" {
		u.monstersMu.Lock()
		monster, exists := u.monsters[targetID]
		if !exists || monster.IsDead {
			u.monstersMu.Unlock()
			isDeadState := false
			if monster != nil {
				isDeadState = monster.IsDead
			}
			fmt.Printf("⚠️ [DEBUG COMBAT CANCEL] Monster ID %s exists=%v | IsDead=%v\n", targetID, exists, isDeadState)
			return
		}

		// RO-X Mechanic: If monster is returning home after leash break, it is invulnerable
		if monster.AIState == "returning" {
			u.monstersMu.Unlock()
			fmt.Printf("🛡️ [COMBAT CANCEL] Monster %s kebal (INVULNERABLE) karena sedang kembali ke sarang!\n", monster.Name)
			return
		}

		// authoritative range verification synced with frontend AUTO_AIM_RADIUS (40.0)
		// Using 55.0 to be forgiving of network/physics latency between client and server
		dist := playerPos.DistanceTo(monster.Position)
		if dist > 55.0 { // Maximum allowed combat range for validation
			u.monstersMu.Unlock()
			fmt.Printf("⚠️ Serangan dibatalkan: Jarak player ke monster %s terlalu jauh (%.2f unit)\n", monster.Name, dist)
			return
		}

		// Fallback monster stats scaling for iRO Wiki calculations
		targetLevel := monster.Level
		targetLUK := monster.Level
		targetDefense := monster.Defense // hard defense (soft defense subtracted separately)
		targetSoftDEF := float32(monster.Level) * 0.5
		targetRES := monster.Level / 2

		// Standard physical attack (non-Mage, non-crit) HIT vs FLEE check
		if playerData.Class != "Mage" {
			// 1. Perfect Dodge check (1% + 1% per 10 LUK)
			perfectDodgeChance := 1.0 + float32(targetLUK)/10.0
			if rand.Float32()*100.0 < perfectDodgeChance {
				// Perfect Dodge succeeded! Trigger MISS visual event.
				u.monstersMu.Unlock()
				u.eventCallback("combat_damage_event", map[string]interface{}{
					"attackerId": playerID,
					"targetId":   targetID,
					"targetType": targetType,
					"damage":     0,
					"isCrit":     false,
					"isMiss":     true,
					"isMagic":    false,
				})
				fmt.Printf("💨 MISS (Perfect Dodge): Player %s -> Monster %s\n", playerData.Username, monster.Name)
				return
			}

			// 2. HIT vs FLEE check (HitRate = 100 + AttackerHIT - TargetFLEE)
			// Monster FLEE = 100 + Level + AGI + LUK/5. For monster, fallback AGI = Level, LUK = Level
			targetFLEE := 100 + monster.Level + monster.Level + (monster.Level / 5)
			hitRate := 100 + playerData.HIT - targetFLEE
			if hitRate < 5 {
				hitRate = 5
			} else if hitRate > 95 {
				hitRate = 95
			}

			if rand.Float32()*100.0 > float32(hitRate) {
				// Attack missed! Trigger MISS visual event.
				u.monstersMu.Unlock()
				u.eventCallback("combat_damage_event", map[string]interface{}{
					"attackerId": playerID,
					"targetId":   targetID,
					"targetType": targetType,
					"damage":     0,
					"isCrit":     false,
					"isMiss":     true,
					"isMagic":    false,
				})
				fmt.Printf("💨 MISS: Player %s -> Monster %s (HitRate: %d%%)\n", playerData.Username, monster.Name, hitRate)
				return
			}
		}

		// Calculate damage authoritatively
		var finalDamage float32
		var isCritRaw bool
		finalDamage, isCritRaw = playerData.CalculateDamageTo(
			targetLevel,
			targetLUK,
			targetDefense,
			targetSoftDEF,
			targetRES,
		)
		isCrit = isCritRaw

		// Hard cap — only apply to Boss types to prevent instant-melting
		if monster.Type == "boss" {
			maxHitDmg := monster.MaxHP * 0.35
			if finalDamage > maxHitDmg {
				finalDamage = maxHitDmg
			}
		}

		critLabel := ""
		if isCrit {
			critLabel = "🔥 CRITICAL! "
		}

		fmt.Printf("%s⚔️ Authoritative Hit: Player %s -> Monster %s (Damage: %.2f, HP: %.2f/%.2f)\n",
			critLabel, playerData.Username, monster.Name, finalDamage, monster.HP-finalDamage, monster.MaxHP)

		monster.TakeDamage(finalDamage)

		// Broadcast combat event immediately to WebSocket hub
		u.eventCallback("combat_damage_event", map[string]interface{}{
			"attackerId": playerID,
			"targetId":   targetID,
			"targetType": targetType,
			"damage":     finalDamage,
			"isCrit":     isCrit,
			"isMiss":     false,
			"isMagic":    playerData.Class == "Mage",
		})

		// Automatically aggro the attacker (Dynamic Threat-Swapping generation)
		if !monster.IsDead {
			if monster.TargetPlayerID == "" {
				monster.TargetPlayerID = playerID
				fmt.Printf("❗ Monster %s membalas serangan (Aggro) ke Player %s!\n", monster.Name, playerData.Username)
			} else if monster.TargetPlayerID != playerID && rand.Float32() < 0.35 {
				monster.TargetPlayerID = playerID
				fmt.Printf("🔄 Threat Swap! Monster %s berpindah target mengejar Player %s!\n", monster.Name, playerData.Username)
			}
		}

		// Update HP in ECS
		if healthComp, found := u.registry.GetComponent(domain.EntityID(targetID), "Health"); found {
			h := healthComp.(*domain.HealthComponent)
			h.HP = monster.HP
		}

		if monster.IsDead {
			// Delegate XP, Gold, Quest progress, and Level-up to shared handler
			// (eliminates code duplication with CastPlayerSkill — see player_skills_uc.go)
			u.handleMonsterKillRewards(playerID, playerData, monster)
		}

		u.monstersMu.Unlock()
	} else if targetType == "player" {
		// PvP Combat Authoritative checks
		u.playersMu.RLock()
		_, targetExists := u.players[targetID]
		u.playersMu.RUnlock()

		if !targetExists {
			return
		}

		u.activePlayersMu.RLock()
		targetData, targetExists := u.activePlayers[targetID]
		u.activePlayersMu.RUnlock()
		if !targetExists || targetData == nil || targetData.HP <= 0 {
			return
		}

		// Range check
		targetPosComp, found := u.registry.GetComponent(domain.EntityID(targetID), "Position")
		if !found {
			return
		}
		targetPos := targetPosComp.(*domain.PositionComponent).Vector3
		dist := playerPos.DistanceTo(targetPos)
		if dist > 45.0 {
			return
		}

		// Derive exact stats for PvP target
		targetLevel := targetData.Level
		targetLUK := targetData.LUK
		targetDefense := targetData.Defense
		if playerData.Class == "Mage" {
			targetDefense = targetData.MagicDefense
		}
		targetSoftDEF := float32(targetData.VIT)/2.0 + float32(targetData.AGI)/5.0 + float32(targetData.Level)/15.0 + 10.0
		if playerData.Class == "Mage" {
			targetSoftDEF = float32(targetData.INT) + float32(targetData.VIT/5.0) + float32(targetData.DEX/5.0) + float32(targetData.Level)/4.0 + 10.0
		}
		targetRES := targetData.RES
		if playerData.Class == "Mage" {
			targetRES = targetData.MRES
		}

		// Standard physical attack (non-Mage, non-crit) HIT check
		if playerData.Class != "Mage" {
			// 1. Perfect Dodge check
			perfectDodgeChance := targetData.PerfectDodge
			if rand.Float32()*100.0 < perfectDodgeChance {
				// Perfect Dodge succeeded!
				u.eventCallback("combat_damage_event", map[string]interface{}{
					"attackerId": playerID,
					"targetId":   targetID,
					"targetType": targetType,
					"damage":     0,
					"isCrit":     false,
					"isMiss":     true,
					"isMagic":    false,
				})
				fmt.Printf("💨 MISS (Perfect Dodge): Player %s -> Player %s\n", playerData.Username, targetData.Username)
				return
			}

			// 2. HIT vs FLEE check
			hitRate := 100 + playerData.HIT - targetData.FLEE
			if hitRate < 5 {
				hitRate = 5
			} else if hitRate > 95 {
				hitRate = 95
			}

			if rand.Float32()*100.0 > float32(hitRate) {
				// MISSED!
				u.eventCallback("combat_damage_event", map[string]interface{}{
					"attackerId": playerID,
					"targetId":   targetID,
					"targetType": targetType,
					"damage":     0,
					"isCrit":     false,
					"isMiss":     true,
					"isMagic":    false,
				})
				fmt.Printf("💨 MISS: Player %s -> Player %s (HitRate: %d%%)\n", playerData.Username, targetData.Username, hitRate)
				return
			}
		}

		// Authoritative domain-derived class damage formula calculation (adjusted by PvP multiplier 0.7)
		dmgVal, isCritRaw := playerData.CalculateDamageTo(
			targetLevel,
			targetLUK,
			targetDefense,
			targetSoftDEF,
			targetRES,
		)
		isCrit = isCritRaw
		finalDamage := dmgVal * 0.7

		// Hard cap — no single hit can exceed 35% of target's max HP like Jagres
		maxHitDmg := targetData.MaxHP * 0.35
		if finalDamage > maxHitDmg {
			finalDamage = maxHitDmg
		}

		critLabel := ""
		if isCrit {
			critLabel = "🔥 CRITICAL! "
		}

		fmt.Printf("%s⚔️ PvP Hit: Player %s -> Player %s (Damage: %.2f, Target HP: %.2f/%.2f)\n",
			critLabel, playerData.Username, targetData.Username, finalDamage, targetData.HP-finalDamage, targetData.MaxHP)

		// Broadcast combat event immediately to WebSocket hub
		u.eventCallback("combat_damage_event", map[string]interface{}{
			"attackerId": playerID,
			"targetId":   targetID,
			"targetType": targetType,
			"damage":     finalDamage,
			"isCrit":     isCrit,
			"isMiss":     false,
			"isMagic":    playerData.Class == "Mage",
		})

		u.activePlayersMu.Lock()
		targetData.HP -= finalDamage
		if targetData.HP <= 0 {
			targetData.HP = 0
			fmt.Printf("☠️ Player %s mengalahkan %s dalam duel PvP!\n", playerData.Username, targetData.Username)

			// Penalty/respawn handler: restore health and respawn at spawn coordinates
			go func(tID string, tUser string) {
				time.Sleep(3 * time.Second)
				u.activePlayersMu.Lock()
				tData, exists := u.activePlayers[tID]
				var lastX, lastY, lastZ float32
				if exists && tData != nil {
					tData.HP = tData.MaxHP

					// Update player HP in ECS registry
					if pHcomp, found := u.registry.GetComponent(domain.EntityID(tID), "Health"); found {
						h := pHcomp.(*domain.HealthComponent)
						h.HP = tData.HP
						h.MaxHP = tData.MaxHP
					}
					// Reset coordinates to safe zone (0, 0, 0) to avoid spawn/death loops
					tData.LastX = 0
					tData.LastY = 0
					tData.LastZ = 0
					lastX = 0
					lastY = 0
					lastZ = 0
				}
				u.activePlayersMu.Unlock() // Release activePlayersMu lock before calling UpdatePlayerMovement to prevent recursive deadlock

				if exists && tData != nil {
					// Move player back to their last exited/saved coordinates in registry and Redis
					u.UpdatePlayerMovement(tID, lastX, lastY, lastZ, 0, "idle", "")
					fmt.Printf("🛡️ Player %s telah hidup kembali di safe zone (0, 0, 0).\n", tUser)
				}
			}(targetID, targetData.Username)
		}
		u.activePlayersMu.Unlock()

		// Update HP in ECS
		if healthComp, found := u.registry.GetComponent(domain.EntityID(targetID), "Health"); found {
			h := healthComp.(*domain.HealthComponent)
			h.HP = targetData.HP
		}
	}
}

// SimulateMonstersTick telah dipindah ke game_usecase.go dengan implementasi
// processMonsterAIWithSnapshot yang lock-free menggunakan player snapshot.
