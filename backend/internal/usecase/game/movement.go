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

	// Update PositionComponent in ECS registry (in-memory, ultra-fast)
	posComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Position")
	if found {
		pComponent := posComp.(*domain.PositionComponent)
		pComponent.X = x
		pComponent.Y = y
		pComponent.Z = z
		pComponent.Rotation = rotation
		pComponent.Animation = animation
	}

	// Update last-known position in activePlayer (in-memory only, no DB write per frame)
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
	}
	u.activePlayersMu.Unlock()

	// Cache to Redis asynchronously (non-blocking, only network state not DB)
	go func() {
		_ = u.stateRepo.SavePlayerState(context.Background(), pState)
	}()

	// NOTE: Heavy GORM/Postgres DB write is intentionally removed from here.
	// Player coordinates are persisted during autosave every ~10 seconds AND on disconnect.
	// This eliminates hundreds of goroutine DB writes per second at 60Hz client movement.
}
