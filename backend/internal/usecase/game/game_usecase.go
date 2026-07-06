// REFACTORED: Methods extracted to dedicated files:
// - monster_spawner.go   → initMonsters, SpawnMonster
// - player_registry.go   → RegisterPlayer, UnregisterPlayer, GetActivePlayer
// - player_stats.go      → DistributeStatPoints, SyncPlayerStatsFromDB
// - player_inventory.go  → EquipPlayerItem, UseConsumable
// - player_skills_uc.go  → CastPlayerSkill, ChangeClass, handleMonsterKillRewards
// - state_payload.go     → GetStatePayload
// - spatial_grid.go      → SpatialHashGrid
// - combat.go            → HandlePlayerAttack
// - monster_ai.go        → processMonsterAIWithSnapshot
//
// This file retains only: Interface, struct, constructor, SetEventCallback, SimulateMonstersTick.
package game

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"time"

	"gorm.io/gorm"
	"mmorpg-backend/internal/domain"
	"mmorpg-backend/internal/repository/redis"
)

// GameUsecase defines the contract for all game logic operations
type GameUsecase interface {
	StartGameLoop(ctx context.Context)
	RegisterPlayer(playerID string, username string)
	UnregisterPlayer(playerID string)
	UpdatePlayerMovement(playerID string, x, y, z, rotation float32, animation string, targetID string)
	HandlePlayerAttack(playerID string, targetType string, targetID string, clientDmg float32, isCrit bool)
	GetStatePayload() domain.GameStatePayload
	SpawnMonster(name string, mType string, x, y, z float32) string

	// RPG Actions
	DistributeStatPoints(playerID string, stat string, amount int)
	EquipPlayerItem(playerID string, playerItemID string)
	UseConsumable(playerID string, playerItemID string)
	CastPlayerSkill(playerID string, skillID string, targetID string)
	ChangeClass(playerID string, newClass string)
	BuyItem(playerID string, catalogItemID string, quantity int) error
	SellItem(playerID string, playerItemID string) error
	RefineItem(playerID string, playerItemID string) error
	SyncPlayerStatsFromDB(playerID string) error
	UpdateMaxPlayerStats(playerID string)
	GetActivePlayer(playerID string) *domain.Player
	SetEventCallback(cb func(eventType string, data interface{}))

	// Rewards & Auction System
	ClaimDailyReward(playerID string) error
	ListAuctionItem(playerID string, playerItemID string, price int) error
	BuyoutAuctionItem(playerID string, auctionItemID string) error
	GetAuctionItems() ([]domain.AuctionItem, error)

	// Party Actions
	CreateParty(playerID string) string
	InviteToParty(leaderID string, targetID string) bool
	LeaveParty(playerID string)
}

type gameUsecase struct {
	db         *gorm.DB
	registry   *domain.Registry
	playerRepo domain.PlayerRepository
	stateRepo  redis.StateRepository
	configRepo domain.ConfigRepository

	players   map[string]*domain.PlayerNetworkState
	playersMu sync.RWMutex

	monsters   map[string]*domain.Monster
	monstersMu sync.RWMutex

	activePlayers   map[string]*domain.Player
	activePlayersMu sync.RWMutex

	parties   map[string]*Party
	partiesMu sync.RWMutex

	patrolTargets   map[string]domain.Vector3
	patrolWaiting   map[string]time.Time
	patrolTargetsMu sync.Mutex

	broadcastCallback func(payload domain.GameStatePayload)
	eventCallback     func(eventType string, data interface{})

	// Batched Redis position writer — avoids goroutine-per-move.
	redisWriteCh chan *domain.PlayerNetworkState
}

func NewGameUsecase(
	db *gorm.DB,
	registry *domain.Registry,
	playerRepo domain.PlayerRepository,
	stateRepo redis.StateRepository,
	configRepo domain.ConfigRepository,
	broadcastCallback func(payload domain.GameStatePayload),
) GameUsecase {
	u := &gameUsecase{
		db:                db,
		registry:          registry,
		playerRepo:        playerRepo,
		stateRepo:         stateRepo,
		configRepo:        configRepo,
		players:           make(map[string]*domain.PlayerNetworkState),
		monsters:          make(map[string]*domain.Monster),
		activePlayers:     make(map[string]*domain.Player),
		parties:           make(map[string]*Party),
		patrolTargets:     make(map[string]domain.Vector3),
		patrolWaiting:     make(map[string]time.Time),
		broadcastCallback: broadcastCallback,
		eventCallback:     func(eventType string, data interface{}) {}, // Fallback default
		redisWriteCh:      make(chan *domain.PlayerNetworkState, 256),
	}

	// Single goroutine draining redisWriteCh — replaces goroutine-per-move.
	go func() {
		for state := range u.redisWriteCh {
			_ = u.stateRepo.SavePlayerState(context.Background(), state)
		}
	}()

	// Pre-spawn monsters in the world (see monster_spawner.go)
	u.initMonsters()

	return u
}

func (u *gameUsecase) SetEventCallback(cb func(eventType string, data interface{})) {
	if cb != nil {
		u.eventCallback = cb
	}
}

// SimulateMonstersTick processes all monster AI state machines with snapshot-based lock-free architecture.
// It cleans up expired player debuffs, builds a spatial hash grid for O(1) aggro lookups,
// and dispatches monster AI processing either sequentially (≤8 monsters) or in parallel via worker pool.
func (u *gameUsecase) SimulateMonstersTick(dt float32) {
	// Clean up expired player debuffs under write lock
	u.activePlayersMu.Lock()
	for _, pData := range u.activePlayers {
		if pData.Debuff != "" {
			if !pData.DebuffUntil.IsZero() && time.Now().After(pData.DebuffUntil) {
				fmt.Printf("✅ DEBUG DEBUFF CLEARED: Player=%s, Debuff=%s, Until=%v, Now=%v\n", pData.Username, pData.Debuff, pData.DebuffUntil, time.Now())
				pData.Debuff = ""
				pData.DebuffUntil = time.Time{}
				pData.DebuffImmuneUntil = time.Now().Add(6 * time.Second)
			}
		}
	}
	u.activePlayersMu.Unlock()

	// Snapshot player positions first under short read-lock, then release
	u.playersMu.RLock()
	playerSnapshot := make(map[string]*domain.PlayerNetworkState, len(u.players))
	for id, p := range u.players {
		cp := *p // value copy — safe to read without lock after this
		playerSnapshot[id] = &cp
	}
	u.playersMu.RUnlock()

	// Build O(1) Spatial Hash Grid of player positions for ultra-fast aggro lookup
	grid := NewSpatialHashGrid(10.0)
	for id, p := range playerSnapshot {
		grid.Insert(id, p.X, p.Z)
	}

	// Snapshot monsters list (pointers — mutations below are still guarded per-monster)
	u.monstersMu.Lock()
	monsters := make([]*domain.Monster, 0, len(u.monsters))
	for _, m := range u.monsters {
		monsters = append(monsters, m)
	}
	u.monstersMu.Unlock()

	// With ≤8 monsters, sequential processing is fine and avoids goroutine overhead.
	if len(monsters) <= 8 {
		for _, m := range monsters {
			u.processMonsterAIWithSnapshot(m, dt, playerSnapshot, grid)
		}
		return
	}

	// Parallel monster AI — each monster is independent; use worker pool pattern.
	numWorkers := runtime.GOMAXPROCS(0)
	if numWorkers > len(monsters) {
		numWorkers = len(monsters)
	}

	work := make(chan *domain.Monster, len(monsters))
	for _, m := range monsters {
		work <- m
	}
	close(work)

	var wg sync.WaitGroup
	wg.Add(numWorkers)
	for i := 0; i < numWorkers; i++ {
		go func() {
			defer wg.Done()
			for m := range work {
				u.processMonsterAIWithSnapshot(m, dt, playerSnapshot, grid)
			}
		}()
	}
	wg.Wait()
}
