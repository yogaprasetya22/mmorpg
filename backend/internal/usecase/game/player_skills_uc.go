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
	variation := float32((time.Now().UnixNano() % 20) - 10) / 100.0
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

// handleMonsterKillRewards is a shared helper for quest progress, XP, gold, and level-up on monster death.
// Used by both HandlePlayerAttack (combat.go) and CastPlayerSkill.
func (u *gameUsecase) handleMonsterKillRewards(playerID string, playerData *domain.Player, monster *domain.Monster) {
	u.activePlayersMu.Lock()
	xpGained := playerData.CalculateXPGain(monster.Level, monster.XPDrop)
	playerData.XP += xpGained
	playerData.Gold += monster.GoldDrop

	fmt.Printf("💀 Monster %s killed by %s! Drop: Gold +%d, XP +%d (Scaled: %d)\n",
		monster.Name, playerData.Username, monster.GoldDrop, monster.XPDrop, xpGained)

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

	// Sync player HP to ECS registry
	if pHcomp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
		h := pHcomp.(*domain.HealthComponent)
		h.HP = playerData.HP
		h.MaxHP = playerData.MaxHP
	}
}
