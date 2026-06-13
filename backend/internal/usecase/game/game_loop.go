package game

import (
	"context"
	"time"

	"mmorpg-backend/internal/domain"
)

func (u *gameUsecase) StartGameLoop(ctx context.Context) {
	// Tick Rate 20Hz (50ms) — sweet spot antara smooth gameplay dan server overhead.
	// 30Hz terlalu agresif kalau ada banyak monster; 20Hz lebih ringan tapi masih
	// sangat smooth dengan client-side interpolation di frontend.
	tickInterval := 50 * time.Millisecond
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	// Autosave setiap ~10 detik (200 ticks @ 20Hz)
	autosaveCounter := 0

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Fixed physics step sesuai tick rate (50ms = 0.050s)
			fixedDt := float32(0.050)

			// 1. Simulate Monster AI and movement for this tick
			u.SimulateMonstersTick(fixedDt)

			// Regenerate player HP/MP once per second (20 ticks @ 20Hz)
			if autosaveCounter%20 == 0 {
				u.regeneratePlayers()
			}

			// 2. Fetch all real-time players and monsters states
			payload := u.GetStatePayload()
			
			// 3. Broadcast game state asynchronously agar game loop tidak block
			if u.broadcastCallback != nil {
				go u.broadcastCallback(payload)
			}

			// 4. Periodic autosave
			autosaveCounter++
			if autosaveCounter >= 200 {
				autosaveCounter = 0
				u.autosaveActivePlayers()
			}
		}
	}
}

// Thread-safe HP/MP regeneration for all active players
func (u *gameUsecase) regeneratePlayers() {
	u.activePlayersMu.Lock()
	defer u.activePlayersMu.Unlock()

	u.playersMu.Lock()
	defer u.playersMu.Unlock()

	for _, pData := range u.activePlayers {
		if pData.HP <= 0 {
			continue
		}

		// HP recovery based on VIT
		hpRegen := float32(2 + pData.VIT/10)
		pData.HP += hpRegen
		if pData.HP > pData.MaxHP {
			pData.HP = pData.MaxHP
		}

		// MP recovery based on INT
		mpRegen := float32(1 + pData.INT/10)
		pData.MP += mpRegen
		if pData.MP > pData.MaxMP {
			pData.MP = pData.MaxMP
		}

		// Sync updated HP to the network states and ECS
		if pState, exists := u.players[pData.ID]; exists {
			pState.HP = pData.HP
			pState.MP = pData.MP
		}

		if healthComp, found := u.registry.GetComponent(domain.EntityID(pData.ID), "Health"); found {
			h := healthComp.(*domain.HealthComponent)
			h.HP = pData.HP
		}
	}
}

// Thread-safe autosave for all active players in memory to Postgres
func (u *gameUsecase) autosaveActivePlayers() {
	u.activePlayersMu.RLock()
	if len(u.activePlayers) == 0 {
		u.activePlayersMu.RUnlock()
		return
	}

	// Copy pointers to avoid holding the lock during slow operations
	players := make([]*domain.Player, 0, len(u.activePlayers))
	for _, p := range u.activePlayers {
		players = append(players, p)
	}
	u.activePlayersMu.RUnlock()

	// Save each player asynchronously to avoid blocking the game tick loop
	for _, p := range players {
		go func(player *domain.Player) {
			_ = u.playerRepo.Update(player)
		}(p)
	}
}
