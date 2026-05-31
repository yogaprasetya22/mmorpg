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
	if !playerData.LastBasicAttackTime.IsZero() && time.Since(playerData.LastBasicAttackTime) < cooldownMs - buffer {
		u.activePlayersMu.Unlock()
		fmt.Printf("⚠️ Authoritative Attack Blocked (Speedhacking prevention): Player %s attack too fast! Cooldown remaining: %v\n", playerData.Username, cooldownMs - time.Since(playerData.LastBasicAttackTime))
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

		// Authoritative domain-derived class damage formula calculation
		var finalDamage float32
		if clientDmg > 0 {
			finalDamage = clientDmg
		} else {
			var isCritRaw bool
			finalDamage, isCritRaw = playerData.CalculateDamageTo(monster.Defense)
			isCrit = isCritRaw
		}

		// Hard cap — only apply to Boss types to prevent instant-melting by hyper-geared players. Standard monsters can be one-shot cleanly!
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
			fmt.Printf("💀 Monster %s terbunuh oleh %s! Drop: Gold +%d, XP +%d\n",
				monster.Name, playerData.Username, monster.GoldDrop, monster.XPDrop)
			
			// Lock active players write lock to safely modify state in RAM
			u.activePlayersMu.Lock()
			// Reward XP & Gold
			playerData.XP += monster.XPDrop
			playerData.Gold += monster.GoldDrop

			// Check Quest Progress for target monster type
			for i := range playerData.Quests {
				q := &playerData.Quests[i]
				if q.QuestID == "quest_goblin" && monster.Type == "goblin" && q.Status == "active" {
					q.Progress++
					if q.Progress >= q.TargetCount {
						q.Progress = q.TargetCount
						q.Status = "completed"
						playerData.Gold += q.RewardGold
						playerData.XP += q.RewardXP
						fmt.Printf("🏆 QUEST COMPLETE: %s! Reward: +%d Gold, +%d XP\n", q.Title, q.RewardGold, q.RewardXP)
					}
				}
			}

			// Handle level up
			xpNeeded := playerData.Level * 100
			if playerData.XP >= xpNeeded {
				playerData.Level++
				playerData.XP -= xpNeeded
				playerData.StatPoints += 5 // 5 stat points to allocate!
				playerData.RecalculateStats()
				playerData.HP = playerData.MaxHP
				playerData.MP = playerData.MaxMP
				fmt.Printf("🌟 LEVEL UP! Player %s naik ke level %d! +5 Stat Points!\n", playerData.Username, playerData.Level)
			}
			u.activePlayersMu.Unlock()

			// Update player HP in ECS registry
			if pHcomp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
				h := pHcomp.(*domain.HealthComponent)
				h.HP = playerData.HP
				h.MaxHP = playerData.MaxHP
			}
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

		// Authoritative domain-derived class damage formula calculation (adjusted by PvP multiplier 0.7)
		var finalDamage float32
		if clientDmg > 0 {
			finalDamage = clientDmg * 0.7
		} else {
			dmgVal, isCritRaw := playerData.CalculateDamageTo(targetData.Defense)
			isCrit = isCritRaw
			finalDamage = dmgVal * 0.7
		}

		// Hard cap — no single hit can exceed 35% of target's max HP like seal-m
		maxHitDmg := targetData.MaxHP * 0.35
		if finalDamage > maxHitDmg {
			finalDamage = maxHitDmg
		}

		critLabel := ""
		if isCrit {
			critLabel = "🔥 CRITICAL! "
		}

		fmt.Printf("%s⚔️ PvP Hit: Player %s -> Player %s (Damage: %.2f, Target HP: %.2f/%.2f)\n",
			critLabel, playerData.Username, targetData.Username, finalDamage, targetData.HP - finalDamage, targetData.MaxHP)

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

