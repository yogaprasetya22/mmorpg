// REFACTORED FROM: game_usecase.go
// Player stat distribution and DB synchronization.
package game

import (
	"fmt"
	"mmorpg-backend/internal/domain"
)

func (u *gameUsecase) DistributeStatPoints(playerID string, stat string, amount int) {
	u.activePlayersMu.Lock()
	playerData, exists := u.activePlayers[playerID]
	if !exists || playerData == nil {
		u.activePlayersMu.Unlock()
		return
	}
	isTalentStat := stat == "pow" || stat == "sta" || stat == "wis" || stat == "spl" || stat == "con" || stat == "crt"
	if isTalentStat {
		if playerData.TalentPoints < amount || amount <= 0 {
			u.activePlayersMu.Unlock()
			return
		}
	} else {
		if playerData.StatPoints < amount || amount <= 0 {
			u.activePlayersMu.Unlock()
			return
		}
	}
	switch stat {
	case "str":
		playerData.BaseSTR += amount
	case "agi":
		playerData.BaseAGI += amount
	case "vit":
		playerData.BaseVIT += amount
	case "int":
		playerData.BaseINT += amount
	case "dex":
		playerData.BaseDEX += amount
	case "luk":
		playerData.BaseLUK += amount
	case "pow":
		playerData.BasePOW += amount
	case "sta":
		playerData.BaseSTA += amount
	case "wis":
		playerData.BaseWIS += amount
	case "spl":
		playerData.BaseSPL += amount
	case "con":
		playerData.BaseCON += amount
	case "crt":
		playerData.BaseCRT += amount
	default:
		u.activePlayersMu.Unlock()
		return
	}
	if isTalentStat {
		playerData.TalentPoints -= amount
	} else {
		playerData.StatPoints -= amount
	}
	playerData.RecalculateStats()
	_ = u.playerRepo.Update(playerData)
	u.activePlayersMu.Unlock()

	if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
		h := healthComp.(*domain.HealthComponent)
		h.MaxHP = playerData.MaxHP
		if h.HP > playerData.MaxHP {
			h.HP = playerData.MaxHP
		}
	}
	fmt.Printf("💪 Player %s distributed %d points into %s. New values: (STR=%d, AGI=%d, VIT=%d, INT=%d, DEX=%d, LUK=%d, POW=%d, STA=%d, WIS=%d, SPL=%d, CON=%d, CRT=%d, StatPoints=%d, TalentPoints=%d)\n",
		playerData.Username, amount, stat, playerData.STR, playerData.AGI, playerData.VIT, playerData.INT, playerData.DEX, playerData.LUK, playerData.POW, playerData.STA, playerData.WIS, playerData.SPL, playerData.CON, playerData.CRT, playerData.StatPoints, playerData.TalentPoints)
}

func (u *gameUsecase) SyncPlayerStatsFromDB(playerID string) error {
	u.activePlayersMu.Lock()
	defer u.activePlayersMu.Unlock()
	pData, err := u.playerRepo.GetByID(playerID)
	if err != nil {
		return err
	}
	pData.RecalculateStats()
	if currentActive, exists := u.activePlayers[playerID]; exists {
		hp := currentActive.HP
		mp := currentActive.MP
		if hp > pData.MaxHP { hp = pData.MaxHP }
		if mp > pData.MaxMP { mp = pData.MaxMP }
		pData.HP = hp
		pData.MP = mp
		pData.SpawnProtectedUntil = currentActive.SpawnProtectedUntil
	} else {
		pData.HP = pData.MaxHP
		pData.MP = pData.MaxMP
	}
	u.activePlayers[playerID] = pData
	u.playersMu.Lock()
	if netState, exists := u.players[playerID]; exists {
		netState.Class = pData.Class
		netState.HP = pData.HP
		netState.MaxHP = pData.MaxHP
		netState.Gold = pData.Gold
		netState.Level = pData.Level
		netState.ASPD = pData.ASPD
		netState.XP = pData.XP
	}
	u.playersMu.Unlock()
	if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
		h := healthComp.(*domain.HealthComponent)
		h.MaxHP = pData.MaxHP
		h.HP = pData.HP
	}
	fmt.Printf("🔄 DB Sync: Player %s stats re-read from PostgreSQL. AGI=%d, DEX=%d, ASPD=%.2f\n",
		playerID, pData.AGI, pData.DEX, pData.ASPD)
	return nil
}
