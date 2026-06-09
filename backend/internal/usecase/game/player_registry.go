// REFACTORED FROM: game_usecase.go
// Player lifecycle management — RegisterPlayer, UnregisterPlayer, GetActivePlayer.
// Handles player connection/disconnection, state caching, ECS entity creation, and DB persistence.
package game

import (
	"context"
	"fmt"
	"time"

	"mmorpg-backend/internal/domain"
)

// RegisterPlayer initializes a player in the game world on connection
func (u *gameUsecase) RegisterPlayer(playerID string, username string) {
	u.playersMu.Lock()
	defer u.playersMu.Unlock()

	// 1. Get stats from database once on login/connection
	pData, err := u.playerRepo.GetByID(playerID)
	if err != nil || pData == nil {
		// Create default player row if it doesn't exist
		pData = &domain.Player{
			ID:         playerID,
			Username:   username,
			Class:      "Beginner",
			Gender:     "Male",
			HairStyle:  1,
			HairColor:  "#5A3E2D",
			Level:      1,
			XP:         0,
			Gold:       200,
			BaseSTR:    10,
			BaseAGI:    10,
			BaseVIT:    10,
			BaseINT:    10,
			BaseDEX:    10,
			BaseLUK:    10,
			StatPoints: 5, // Stat points to distribute
			HP:         1000,
			MaxHP:      1000,
			MP:         200,
			MaxMP:      200,
			MapName:    "Starter Zone",
			LastX:      0,
			LastY:      0,
			LastZ:      0,
			Inventory: []domain.PlayerItem{
				{
					ID:         playerID + "-item-1",
					PlayerID:   playerID,
					ItemID:     "sword_starter",
					Name:       "Wooden Sword",
					Type:       "equipment",
					SlotType:   "weapon",
					Quantity:   1,
					IsEquipped: true,
					SlotIndex:  0,
					AddAttack:  15,
				},
				{
					ID:         playerID + "-item-2",
					PlayerID:   playerID,
					ItemID:     "potion_red",
					Name:       "Red Potion",
					Type:       "consumable",
					SlotIndex:  1,
					Quantity:   5,
					AddHP:      150,
				},
				{
					ID:         playerID + "-item-3",
					PlayerID:   playerID,
					ItemID:     "potion_blue",
					Name:       "Blue Potion",
					Type:       "consumable",
					SlotIndex:  2,
					Quantity:   5,
					AddMP:      50,
				},
			},
			Skills: []domain.PlayerSkill{
				{
					ID:         playerID + "-skill-1",
					PlayerID:   playerID,
					SkillID:    "strike",
					Name:       "Heavy Strike",
					Level:      1,
					Type:       "active",
					ManaCost:   15,
					MaxCD:      3.0,
					Damage:     1.5,
					IsUnlocked: true,
				},
				{
					ID:         playerID + "-skill-2",
					PlayerID:   playerID,
					SkillID:    "heal",
					Name:       "Lesser Heal",
					Level:      1,
					Type:       "active",
					ManaCost:   25,
					MaxCD:      6.0,
					Damage:     120, // Heal HP value
					IsUnlocked: true,
				},
			},
			Quests: []domain.PlayerQuest{
				{
					ID:          playerID + "-quest-1",
					PlayerID:    playerID,
					QuestID:     "quest_goblin",
					Title:       "Defeat Goblins",
					Status:      "active",
					Progress:    0,
					TargetCount: 3,
					RewardGold:  100,
					RewardXP:    150,
				},
			},
		}
		
		// Recalculate stats for correct attributes mapping
		pData.RecalculateStats()
		pData.HP = pData.MaxHP
		pData.MP = pData.MaxMP
		_ = u.playerRepo.Create(pData)
	}

	// CRITICAL: Always recalculate derived stats from base attributes for ALL players
	// This ensures ASPD, ATK, DEF, HIT, FLEE etc. are correctly derived from the
	// persisted base stats, even if the cached/DB values are stale.
	pData.RecalculateStats()

	// Respawn player on reconnect if they logged out dead (HP == 0)
	if pData.HP <= 0 {
		pData.HP = pData.MaxHP
		pData.LastX = 0
		pData.LastY = 25.0
		pData.LastZ = 0
		pData.Debuff = ""
		pData.DebuffUntil = time.Time{}
		pData.DebuffImmuneUntil = time.Time{}
		_ = u.playerRepo.Update(pData)
		fmt.Printf("🛡️ Player %s has been resurrected on login because they were dead. Relocated to (0, 25.0, 0).\n", username)
	}

	// 2. Cache player data in memory
	pData.SpawnProtectedUntil = time.Now().Add(25 * time.Second) // 25 seconds invulnerability to allow slow asset loading on the client
	u.activePlayersMu.Lock()
	u.activePlayers[playerID] = pData
	u.activePlayersMu.Unlock()

	// Initial starter state
	state := &domain.PlayerNetworkState{
		ID:        playerID,
		X:         pData.LastX,
		Y:         pData.LastY,
		Z:         pData.LastZ,
		Rotation:  0,
		Animation: "idle",
		Class:     pData.Class,
		Gender:    pData.Gender,
		Username:  pData.Username,
		HP:        pData.HP,
		MaxHP:     pData.MaxHP,
		Gold:      pData.Gold,
		Level:     pData.Level,
		ASPD:      pData.ASPD,
		XP:        pData.XP,
		CustomAvatarURL: pData.CustomAvatarURL,
		HairStyle: pData.HairStyle,
		HairColor: pData.HairColor,

		// Talent Stats
		BasePOW:      pData.BasePOW,
		BaseSTA:      pData.BaseSTA,
		BaseWIS:      pData.BaseWIS,
		BaseSPL:      pData.BaseSPL,
		BaseCON:      pData.BaseCON,
		BaseCRT:      pData.BaseCRT,
		TalentPoints: pData.TalentPoints,

		// Amplified Substats
		PATK:  pData.PATK,
		SMATK: pData.SMATK,
		RES:   pData.RES,
		MRES:  pData.MRES,
		HPLUS: pData.HRatePlus,
		CRATE: pData.CRatePlus,

		// Base Primary Stats
		BaseSTR:    pData.BaseSTR,
		BaseAGI:    pData.BaseAGI,
		BaseVIT:    pData.BaseVIT,
		BaseINT:    pData.BaseINT,
		BaseDEX:    pData.BaseDEX,
		BaseLUK:    pData.BaseLUK,
		StatPoints: pData.StatPoints,

		// Derived Combat Stats
		Attack:       pData.Attack,
		MagicAttack:  pData.MagicAttack,
		Defense:      pData.Defense,
		MagicDefense: pData.MagicDefense,
		CriticalRate: pData.CriticalRate,
		Speed:        pData.Speed,
		HIT:          pData.HIT,
		FLEE:         pData.FLEE,
		PerfectDodge: pData.PerfectDodge,
		CastTime:     pData.CastTime,
		Debuff:       pData.Debuff,
	}
	u.players[playerID] = state

	// Add to ECS Registry
	u.registry.CreateEntity(domain.EntityID(playerID))
	u.registry.AddComponent(domain.EntityID(playerID), &domain.PositionComponent{
		Vector3:   domain.Vector3{X: pData.LastX, Y: pData.LastY, Z: pData.LastZ},
		Rotation:  0,
		Animation: "idle",
	})
	u.registry.AddComponent(domain.EntityID(playerID), &domain.PlayerComponent{
		Username: username,
		Level:    pData.Level,
	})
	u.registry.AddComponent(domain.EntityID(playerID), &domain.HealthComponent{
		HP:    pData.HP,
		MaxHP: pData.MaxHP,
	})

	// Save initial position in Redis cache asynchronously
	go func() {
		_ = u.stateRepo.SavePlayerState(context.Background(), state)
	}()

	fmt.Printf("👤 Player %s (%s) registered and cached in memory!\n", username, playerID)
}

// GetActivePlayer returns the in-memory cached Player data for a connected player
func (u *gameUsecase) GetActivePlayer(playerID string) *domain.Player {
	u.activePlayersMu.RLock()
	defer u.activePlayersMu.RUnlock()
	return u.activePlayers[playerID]
}

// UnregisterPlayer removes a player from the game world and persists their final state
func (u *gameUsecase) UnregisterPlayer(playerID string) {
	u.playersMu.Lock()
	defer u.playersMu.Unlock()

	pState, stateExists := u.players[playerID]
	var lastX, lastY, lastZ float32
	if stateExists && pState != nil {
		lastX = pState.X
		lastY = pState.Y
		lastZ = pState.Z
	}

	delete(u.players, playerID)
	u.registry.DestroyEntity(domain.EntityID(playerID))

	// Clean up Redis position
	go func() {
		_ = u.stateRepo.DeletePlayerState(context.Background(), playerID)
	}()

	// Save final player data to GORM Postgres asynchronously on disconnect
	u.activePlayersMu.Lock()
	if pData, exists := u.activePlayers[playerID]; exists {
		if stateExists {
			pData.LastX = lastX
			pData.LastY = lastY
			pData.LastZ = lastZ
		}
		go func(p *domain.Player) {
			_ = u.playerRepo.Update(p)
		}(pData)
		delete(u.activePlayers, playerID)
	}
	u.activePlayersMu.Unlock()

	fmt.Printf("👤 Player %s left the game world. Final state flushed to DB.\n", playerID)
}
