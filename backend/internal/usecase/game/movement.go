package game

import (
	"fmt"
	"math"
	"time"

	"mmorpg-backend/internal/domain"
)

func (u *gameUsecase) UpdatePlayerMovement(playerID string, x, y, z, rotation float32, animation string, targetID string) {
	// Debuff enforcement: stun/freeze blocks movement updates
	u.activePlayersMu.RLock()
	pData, existsProfile := u.activePlayers[playerID]
	if existsProfile && pData != nil && (pData.Debuff == "stun" || pData.Debuff == "freeze") && time.Now().Before(pData.DebuffUntil) {
		u.activePlayersMu.RUnlock()
		return // Block movement while stunned/frozen
	}
	u.activePlayersMu.RUnlock()

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
	pData, existsProfile = u.activePlayers[playerID]
	if existsProfile && pData != nil {
		// Lift spawn protection early if player moves actively (>2.0 units)
		if !pData.SpawnProtectedUntil.IsZero() && time.Now().Before(pData.SpawnProtectedUntil) {
			dx := float64(x - pData.LastX)
			dz := float64(z - pData.LastZ)
			if math.Sqrt(dx*dx+dz*dz) > 2.0 {
				pData.SpawnProtectedUntil = time.Time{} // Lift early
				fmt.Printf("🛡️ Player %s mulai bergerak, perlindungan spawn dinonaktifkan awal.\n", pData.Username)
			}
		}

		pData.LastX = x
		pData.LastY = y
		pData.LastZ = z

		// Sync current HP from ECS registry if present
		if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
			h := healthComp.(*domain.HealthComponent)
			pData.HP = h.HP

			// Synchronize immediately to the real-time WebSocket state!
			u.playersMu.Lock()
			if pState != nil {
				pState.HP = h.HP
				pState.MaxHP = h.MaxHP
			}
			u.playersMu.Unlock()
		}
	}
	u.activePlayersMu.Unlock()

	// Cache to Redis via batcher channel — no goroutine-per-move.
	// Drops if batcher saturated (Redis slow); positions are approximate anyway.
	select {
	case u.redisWriteCh <- pState:
	default:
	}

	// NOTE: Heavy GORM/Postgres DB write is intentionally removed from here.
	// Player coordinates are persisted during autosave every ~10 seconds AND on disconnect.
	// This eliminates hundreds of goroutine DB writes per second at 60Hz client movement.
}
