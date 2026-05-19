package game

import (
	"context"
	"mmorpg-backend/internal/domain"
)

func (u *gameUsecase) UpdatePlayerMovement(playerID string, x, y, z, rotation float32, animation string, targetID string) {
	u.playersMu.Lock()
	pState, exists := u.players[playerID]
	if exists {
		pState.X = x
		pState.Y = y
		pState.Z = z
		pState.Rotation = rotation
		pState.Animation = animation
		
		if targetID != "" {
			pState.TargetID = targetID
		} else if animation != "Attack" && animation != "Skill" {
			pState.TargetID = ""
		}
	}
	u.playersMu.Unlock()

	if !exists {
		return
	}

	// Update PositionComponent in ECS registry
	posComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Position")
	if found {
		pComponent := posComp.(*domain.PositionComponent)
		pComponent.X = x
		pComponent.Y = y
		pComponent.Z = z
		pComponent.Rotation = rotation
		pComponent.Animation = animation
	}

	// Cache to Redis State repository asynchronously (avoid blocking game updates)
	go func() {
		_ = u.stateRepo.SavePlayerState(context.Background(), pState)
	}()

	// Dynamically update coordinate persistence and current HP inside GORM/Redis active player profile
	u.activePlayersMu.Lock()
	pData, existsProfile := u.activePlayers[playerID]
	if existsProfile && pData != nil {
		pData.LastX = x
		pData.LastY = y
		pData.LastZ = z

		// Sync current HP from ECS registry if present
		if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
			h := healthComp.(*domain.HealthComponent)
			pData.HP = h.HP
		}

		// Save profile dynamically (extremely fast write-back caching handles this safely!)
		go func(p *domain.Player) {
			_ = u.playerRepo.Update(p)
		}(pData)
	}
	u.activePlayersMu.Unlock()
}
