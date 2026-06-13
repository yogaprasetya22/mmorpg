// REFACTORED FROM: game_usecase.go
// Player skill casting and class change logic.
package game

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"mmorpg-backend/internal/domain"
)

func (u *gameUsecase) CastPlayerSkill(playerID string, skillID string, targetID string) {
	u.activePlayersMu.Lock()
	playerData, exists := u.activePlayers[playerID]
	u.activePlayersMu.Unlock()
	if !exists || playerData == nil {
		return
	}
	u.playersMu.Lock()
	if pState, exists := u.players[playerID]; exists {
		pState.TargetID = targetID
	}
	u.playersMu.Unlock()

	var targetSkill *domain.PlayerSkill
	for i := range playerData.Skills {
		if playerData.Skills[i].SkillID == skillID {
			targetSkill = &playerData.Skills[i]
			break
		}
	}
	if targetSkill == nil || !targetSkill.IsUnlocked {
		return
	}
	if playerData.HP <= 0 {
		return
	}

	// Debuff enforcement: stun/freeze blocks all skills, silence blocks casting
	if (playerData.Debuff == "stun" || playerData.Debuff == "freeze" || playerData.Debuff == "silence") && time.Now().Before(playerData.DebuffUntil) {
		fmt.Printf("🚫 Player %s tidak dapat cast skill karena sedang %s!\n", playerData.Username, playerData.Debuff)
		return
	}
	if playerData.MP < float32(targetSkill.ManaCost) {
		fmt.Printf("⚠️ Player %s tidak memiliki cukup MP untuk %s (%d MP)\n", playerData.Username, targetSkill.Name, targetSkill.ManaCost)
		return
	}

	posComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Position")
	if !found {
		return
	}
	playerPos := posComp.(*domain.PositionComponent).Vector3

	// Deduct Mana Cost
	u.activePlayersMu.Lock()
	playerData.MP -= float32(targetSkill.ManaCost)
	u.activePlayersMu.Unlock()

	// 1. Lesser Heal Support logic
	if skillID == "heal" {
		u.activePlayersMu.Lock()
		healPower := targetSkill.Damage
		playerData.HP += healPower
		if playerData.HP > playerData.MaxHP {
			playerData.HP = playerData.MaxHP
		}
		u.activePlayersMu.Unlock()
		if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
			h := healthComp.(*domain.HealthComponent)
			h.HP = playerData.HP
		}
		fmt.Printf("✨ Player %s cast %s (+%.1f HP, Cost: %d MP). HP: %.1f/%.1f\n",
			playerData.Username, targetSkill.Name, healPower, targetSkill.ManaCost, playerData.HP, playerData.MaxHP)
		return
	}

	// 1b. Buff skills: war_cry (+20% ATK), blessing (+15% HIT)
	if skillID == "war_cry" || skillID == "blessing" {
		buffType := skillID
		buffValue := float32(0.20) // 20% ATK boost
		if skillID == "blessing" {
			buffValue = 0.15 // 15% HIT boost
		}
		u.activePlayersMu.Lock()
		playerData.Buffs = append(playerData.Buffs, domain.ActiveBuff{
			Type:      buffType,
			Value:     buffValue,
			ExpiresAt: time.Now().Add(30 * time.Second),
		})
		u.activePlayersMu.Unlock()
		fmt.Printf("💪 Player %s activated %s! Buff active for 30s.\n", playerData.Username, targetSkill.Name)
		u.eventCallback("buff_event", map[string]interface{}{
			"playerId": playerID,
			"buff":     buffType,
			"value":    buffValue,
			"duration": 30,
		})
		return
	}

	// 1c. Stealth: invulnerable for 3 seconds
	if skillID == "stealth" {
		u.activePlayersMu.Lock()
		playerData.IsStealthed = true
		playerData.StealthUntil = time.Now().Add(3 * time.Second)
		u.activePlayersMu.Unlock()
		fmt.Printf("👤 Player %s entered stealth for 3s!\n", playerData.Username)
		u.eventCallback("stealth_event", map[string]interface{}{
			"playerId": playerID,
			"duration": 3,
		})
		return
	}

	// 2. Damage Active spell attack logic
	u.monstersMu.Lock()
	monster, mExists := u.monsters[targetID]
	if !mExists || monster.IsDead {
		u.monstersMu.Unlock()
		return
	}
	dist := playerPos.DistanceTo(monster.Position)
	if dist > 55.0 {
		u.monstersMu.Unlock()
		fmt.Printf("⚠️ Cast %s gagal: Target %s terlalu jauh (%.2f unit)\n", targetSkill.Name, monster.Name, dist)
		return
	}

	baseAttack := playerData.Attack
	if targetSkill.SkillID == "fireball" {
		baseAttack = playerData.MagicAttack
	}
	skillDamage := baseAttack * targetSkill.Damage
	damageMultiplier := float32(100.0) / (100.0 + monster.Defense)
	dmg := skillDamage * damageMultiplier
	variation := float32((time.Now().UnixNano()%20)-10) / 100.0
	finalDamage := dmg * (1.0 + variation)

	isCrit := false
	if rand.Float32() < playerData.CriticalRate {
		isCrit = true
		finalDamage *= 1.5
	}
	if finalDamage < 1 {
		finalDamage = 1
	}
	maxHitDmg := monster.MaxHP * 0.35
	if finalDamage > maxHitDmg {
		finalDamage = maxHitDmg
	}
	critLabel := ""
	if isCrit {
		critLabel = "🔥 CRITICAL! "
	}
	fmt.Printf("%s✨ Skill Cast: Player %s -> Monster %s with %s (Damage: %.2f, HP: %.2f/%.2f)\n",
		critLabel, playerData.Username, monster.Name, targetSkill.Name, finalDamage, monster.HP-finalDamage, monster.MaxHP)

	monster.TakeDamage(finalDamage)
	if healthComp, found := u.registry.GetComponent(domain.EntityID(targetID), "Health"); found {
		h := healthComp.(*domain.HealthComponent)
		h.HP = monster.HP
	}

	if monster.IsDead {
		u.handleMonsterKillRewards(playerID, playerData, monster)
	}
	u.monstersMu.Unlock()
}

func (u *gameUsecase) ChangeClass(playerID string, newClass string) {
	u.activePlayersMu.Lock()
	playerData, exists := u.activePlayers[playerID]
	if !exists || playerData == nil {
		u.activePlayersMu.Unlock()
		return
	}
	validClasses := map[string]bool{"Warrior": true, "Mage": true, "Priest": true, "Thief": true}
	if !validClasses[newClass] || playerData.Class != "Beginner" {
		u.activePlayersMu.Unlock()
		return
	}
	playerData.Class = newClass
	switch newClass {
	case "Mage":
		playerData.Skills = append(playerData.Skills, domain.PlayerSkill{
			ID: playerID + "-skill-fireball", PlayerID: playerID,
			SkillID: "fireball", Name: "Fireball Strike", Level: 1, Type: "active",
			ManaCost: 30, MaxCD: 4.0, Damage: 2.5, IsUnlocked: true,
		})
	}
	playerData.RecalculateStats()
	playerData.HP = playerData.MaxHP
	playerData.MP = playerData.MaxMP
	u.activePlayersMu.Unlock()

	u.playersMu.Lock()
	if pState, exists := u.players[playerID]; exists {
		pState.Class = newClass
	}
	u.playersMu.Unlock()

	if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
		h := healthComp.(*domain.HealthComponent)
		h.MaxHP = playerData.MaxHP
		h.HP = playerData.HP
	}
	fmt.Printf("⚔️ Player %s changed class to %s! Attributes recalculated.\n", playerData.Username, newClass)
}

// handleMonsterKillRewards is a shared helper for quest progress, XP, gold, item drops, and level-up on monster death.
// Used by both HandlePlayerAttack (combat.go) and CastPlayerSkill.
func (u *gameUsecase) handleMonsterKillRewards(playerID string, playerData *domain.Player, monster *domain.Monster) {
	u.activePlayersMu.Lock()
	xpGained := playerData.CalculateXPGain(monster.Level, monster.XPDrop)
	playerData.XP += xpGained
	playerData.Gold += monster.GoldDrop

	fmt.Printf("💀 Monster %s killed by %s! Drop: Gold +%d, XP +%d (Scaled: %d)\n",
		monster.Name, playerData.Username, monster.GoldDrop, monster.XPDrop, xpGained)

	// ── Item Drop System: roll drop table from monster config ──
	if cfg, err := u.configRepo.GetMonsterConfig(monster.Type); err == nil && cfg != nil {
		drops := cfg.ParseDropTable()
		for _, drop := range drops {
			if rand.Float32() < drop.Chance {
				qty := drop.Quantity
				if qty <= 0 {
					qty = 1
				}
				itemID := fmt.Sprintf("%s-drop-%d", playerID, time.Now().UnixNano()%1000000)
				// ── Randomized Stat rolls for Equipment drops ──
				var addHP, addMP, addAttack, addDefense float32
				itemName := drop.Name
				if drop.Type == "equipment" {
					// Roll quality multiplier between 0.8 and 1.6
					qualityMult := 0.8 + rand.Float32()*0.8
					addHP = float32(int(drop.AddHP * qualityMult))
					addMP = float32(int(drop.AddMP * qualityMult))
					addAttack = float32(int(drop.AddAttack * qualityMult))
					addDefense = float32(int(drop.AddDefense * qualityMult))

					// If base attack is 0 but item is a weapon, add a tiny bonus
					if addAttack == 0 && drop.SlotType == "weapon" {
						addAttack = float32(rand.Intn(10) + 5)
					}
					// If defense is 0 but it's armor/boots/helm/shield, add a tiny bonus
					if addDefense == 0 && (drop.SlotType == "armor" || drop.SlotType == "boots" || drop.SlotType == "helmet" || drop.SlotType == "shield") {
						addDefense = float32(rand.Intn(6) + 2)
					}

					// Append quality suffix to name
					if qualityMult >= 1.4 {
						itemName = fmt.Sprintf("%s [Legendary]", drop.Name)
					} else if qualityMult >= 1.2 {
						itemName = fmt.Sprintf("%s [Rare]", drop.Name)
					} else if qualityMult < 0.95 {
						itemName = fmt.Sprintf("%s [Broken]", drop.Name)
					}
				} else {
					addHP = drop.AddHP
					addMP = drop.AddMP
					addAttack = drop.AddAttack
					addDefense = drop.AddDefense
				}

				newItem := domain.PlayerItem{
					ID:         itemID,
					PlayerID:   playerID,
					ItemID:     drop.ItemID,
					Name:       itemName,
					Type:       drop.Type,
					SlotType:   drop.SlotType,
					Quantity:   qty,
					IsEquipped: false,
					AddHP:      addHP,
					AddMP:      addMP,
					AddAttack:  addAttack,
					AddDefense: addDefense,
				}
				playerData.Inventory = append(playerData.Inventory, newItem)
				fmt.Printf("🎁 ITEM DROP: %s looted [%s] from %s! Stats: ATK+%.0f DEF+%.0f HP+%.0f\n", 
					playerData.Username, itemName, monster.Name, addAttack, addDefense, addHP)

				// Broadcast drop event to frontend
				u.eventCallback("item_drop_event", map[string]interface{}{
					"playerId":   playerID,
					"itemId":     itemID,
					"itemName":   itemName,
					"itemType":   drop.Type,
					"quantity":   qty,
					"monster":    monster.Name,
					"addAttack":  addAttack,
					"addDefense": addDefense,
					"addHp":      addHP,
					"addMp":      addMP,
				})
			}
		}
	}

	// Check active Quest Targets progress
	hasActiveAfter := false
	for i := range playerData.Quests {
		q := &playerData.Quests[i]
		isMatch := strings.Contains(strings.ToLower(q.QuestID), strings.ToLower(monster.Type)) ||
			(monster.Type == "default" && strings.Contains(strings.ToLower(q.QuestID), "boar"))
		if isMatch && q.Status == "active" {
			q.Progress++
			if q.Progress >= q.TargetCount {
				q.Progress = q.TargetCount
				q.Status = "completed"
				playerData.Gold += q.RewardGold
				playerData.XP += q.RewardXP
				fmt.Printf("🏆 QUEST COMPLETE: %s! Reward: +%d Gold, +%d XP\n", q.Title, q.RewardGold, q.RewardXP)
				// Auto-assign next story quest if a story quest was just completed
				if q.Type == "story" {
					playerData.AssignStoryQuest()
				}
			} else {
				hasActiveAfter = true
			}
		} else if q.Status == "active" {
			hasActiveAfter = true
		}
	}
	if !hasActiveAfter {
		playerData.GenerateDailyQuests()
	}

	// Handle level up sequence (supports multiple level ups)
	for {
		xpNeeded := domain.GetRequiredXP(playerData.Level)
		if playerData.XP >= xpNeeded {
			playerData.Level++
			playerData.XP -= xpNeeded
			playerData.StatPoints += 5
			if playerData.Level >= 200 {
				playerData.TalentPoints += 1
			}
			playerData.RecalculateStats()
			playerData.HP = playerData.MaxHP
			playerData.MP = playerData.MaxMP
			fmt.Printf("🌟 LEVEL UP! Player %s -> Level %d! +5 StatPoints, TalentPts: %d\n", playerData.Username, playerData.Level, playerData.TalentPoints)
		} else {
			break
		}
	}
	u.activePlayersMu.Unlock()

	// Distribute shared party XP to nearby party members
	u.distributePartyXP(playerID, xpGained, monster.Position)

	// Sync player HP to ECS registry
	if pHcomp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
		h := pHcomp.(*domain.HealthComponent)
		h.HP = playerData.HP
		h.MaxHP = playerData.MaxHP
	}
}
