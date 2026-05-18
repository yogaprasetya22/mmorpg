package game

import (
	"context"
	"time"

	"mmorpg-backend/internal/domain"
)

func (u *gameUsecase) StartGameLoop(ctx context.Context) {
	// Fixed Tick Rate of 30Hz (33.3 milliseconds per frame)
	tickInterval := 33 * time.Millisecond
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	// Periodic autosave counter: 300 ticks = ~10 seconds
	autosaveCounter := 0

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Use a rock-solid fixed physics step (30Hz = 0.03333s) for the monster simulation.
			// This completely eliminates server-side speed spikes and thread scheduling jitter!
			fixedDt := float32(0.03333)

			// 1. Simulate Monster AI and movement for this tick
			u.SimulateMonstersTick(fixedDt)

			// 2. Fetch all real-time players and monsters states
			payload := u.GetStatePayload()

			// 3. Broadcast the game state to all active client WebSocket connections
			if u.broadcastCallback != nil {
				u.broadcastCallback(payload)
			}

			// 4. Perform periodic lightweight autosave of active players in the background
			autosaveCounter++
			if autosaveCounter >= 300 {
				autosaveCounter = 0
				u.autosaveActivePlayers()
			}
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
