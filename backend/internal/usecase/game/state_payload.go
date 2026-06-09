// REFACTORED FROM: game_usecase.go
// State payload builder — assembles the game tick broadcast payload.
package game

import "mmorpg-backend/internal/domain"

// GetStatePayload constructs the full game state for WebSocket broadcasting
func (u *gameUsecase) GetStatePayload() domain.GameStatePayload {
	// Snapshot player states under minimal read-lock
	u.playersMu.RLock()
	playerStates := make([]domain.PlayerNetworkState, 0, len(u.players))
	for _, p := range u.players {
		playerStates = append(playerStates, *p)
	}
	u.playersMu.RUnlock()

	// Enrich player states with Gold and Level from in-memory active player cache
	u.activePlayersMu.RLock()
	for i := range playerStates {
		if pData, exists := u.activePlayers[playerStates[i].ID]; exists {
			playerStates[i].Gold = pData.Gold
			playerStates[i].Level = pData.Level
			playerStates[i].ASPD = pData.ASPD
			playerStates[i].XP = pData.XP
			playerStates[i].HP = pData.HP
			playerStates[i].MaxHP = pData.MaxHP

			// Talent Stats
			playerStates[i].BasePOW = pData.BasePOW
			playerStates[i].BaseSTA = pData.BaseSTA
			playerStates[i].BaseWIS = pData.BaseWIS
			playerStates[i].BaseSPL = pData.BaseSPL
			playerStates[i].BaseCON = pData.BaseCON
			playerStates[i].BaseCRT = pData.BaseCRT
			playerStates[i].TalentPoints = pData.TalentPoints

			// Amplified Substats
			playerStates[i].PATK = pData.PATK
			playerStates[i].SMATK = pData.SMATK
			playerStates[i].RES = pData.RES
			playerStates[i].MRES = pData.MRES
			playerStates[i].HPLUS = pData.HRatePlus
			playerStates[i].CRATE = pData.CRatePlus

			// Base Primary Stats
			playerStates[i].BaseSTR = pData.BaseSTR
			playerStates[i].BaseAGI = pData.BaseAGI
			playerStates[i].BaseVIT = pData.BaseVIT
			playerStates[i].BaseINT = pData.BaseINT
			playerStates[i].BaseDEX = pData.BaseDEX
			playerStates[i].BaseLUK = pData.BaseLUK
			playerStates[i].StatPoints = pData.StatPoints

			// Derived Combat Stats
			playerStates[i].Attack = pData.Attack
			playerStates[i].MagicAttack = pData.MagicAttack
			playerStates[i].Defense = pData.Defense
			playerStates[i].MagicDefense = pData.MagicDefense
			playerStates[i].CriticalRate = pData.CriticalRate
			playerStates[i].Speed = pData.Speed
			playerStates[i].HIT = pData.HIT
			playerStates[i].FLEE = pData.FLEE
			playerStates[i].PerfectDodge = pData.PerfectDodge
			playerStates[i].CastTime = pData.CastTime
			playerStates[i].Debuff = pData.Debuff
			playerStates[i].CustomAvatarURL = pData.CustomAvatarURL
			playerStates[i].HairStyle = pData.HairStyle
			playerStates[i].HairColor = pData.HairColor
		}
	}
	u.activePlayersMu.RUnlock()

	// Build lean MonsterNetworkState slice — avoids serialising internal AI fields
	u.monstersMu.RLock()
	monsterStates := make([]domain.MonsterNetworkState, 0, len(u.monsters))
	for _, m := range u.monsters {
		monsterStates = append(monsterStates, domain.MonsterNetworkState{
			ID:             m.ID,
			Name:           m.Name,
			Type:           m.Type,
			X:              m.Position.X,
			Y:              m.Position.Y,
			Z:              m.Position.Z,
			HP:             m.HP,
			MaxHP:          m.MaxHP,
			IsDead:         m.IsDead,
			TargetPlayerID: m.TargetPlayerID,
			Animation:      m.Animation,
			AIState:        m.AIState,
		})
	}
	u.monstersMu.RUnlock()

	return domain.GameStatePayload{
		Players:  playerStates,
		Monsters: monsterStates,
	}
}
