package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
	"mmorpg-backend/internal/domain"
)

type cachedUserRepo struct {
	postgresRepo domain.PlayerRepository
	db           *gorm.DB
	rdb          *redis.Client
	dirtyPlayers map[string]bool
	dirtyMu      sync.Mutex
}

// NewCachedUserRepository decorates the standard PlayerRepository with Redis caching and write-back batching.
func NewCachedUserRepository(db *gorm.DB, rdb *redis.Client) domain.PlayerRepository {
	postgresRepo := &userRepo{db: db}
	repo := &cachedUserRepo{
		postgresRepo: postgresRepo,
		db:           db,
		rdb:          rdb,
		dirtyPlayers: make(map[string]bool),
	}

	// Start Write-Back Sync Background Daemon
	go repo.startSyncLoop()

	return repo
}

func (c *cachedUserRepo) Create(player *domain.Player) error {
	// Creation is written immediately to PostgreSQL for safety/integrity,
	// and also cached to Redis.
	err := c.postgresRepo.Create(player)
	if err != nil {
		return err
	}

	ctx := context.Background()
	redisKey := "player:profile:" + player.ID
	if pData, err := json.Marshal(player); err == nil {
		c.rdb.Set(ctx, redisKey, pData, 24*time.Hour)
	}
	return nil
}

func (c *cachedUserRepo) GetByID(id string) (*domain.Player, error) {
	ctx := context.Background()
	redisKey := "player:profile:" + id
	
	// 1. Try fetching from active Redis cache first for extreme performance
	data, err := c.rdb.Get(ctx, redisKey).Result()
	if err == nil {
		var player domain.Player
		if err := json.Unmarshal([]byte(data), &player); err == nil {
			return &player, nil
		}
	}

	// 2. Fallback to PostgreSQL on cache miss
	player, err := c.postgresRepo.GetByID(id)
	if err == nil && player != nil {
		// Cache in Redis for future requests
		if pData, err := json.Marshal(player); err == nil {
			c.rdb.Set(ctx, redisKey, pData, 24*time.Hour)
		}
	}
	return player, err
}

func (c *cachedUserRepo) GetByUsername(username string) (*domain.Player, error) {
	// 1. Retrieve the profile from PostgreSQL
	player, err := c.postgresRepo.GetByUsername(username)
	if err == nil && player != nil {
		ctx := context.Background()
		redisKey := "player:profile:" + player.ID
		
		// 2. Cross-reference with Redis to ensure we load the absolute latest write-back state
		data, err := c.rdb.Get(ctx, redisKey).Result()
		if err == nil {
			var latestPlayer domain.Player
			if err := json.Unmarshal([]byte(data), &latestPlayer); err == nil {
				return &latestPlayer, nil
			}
		}
	}
	return player, err
}

func (c *cachedUserRepo) GetByUserID(userID string) ([]*domain.Player, error) {
	// Retrieve from PostgreSQL
	players, err := c.postgresRepo.GetByUserID(userID)
	if err != nil {
		return nil, err
	}

	// Cross-reference all found players with active Redis write-back caches
	ctx := context.Background()
	for i, player := range players {
		redisKey := "player:profile:" + player.ID
		data, err := c.rdb.Get(ctx, redisKey).Result()
		if err == nil {
			var latestPlayer domain.Player
			if err := json.Unmarshal([]byte(data), &latestPlayer); err == nil {
				players[i] = &latestPlayer
			}
		}
	}
	return players, nil
}

func (c *cachedUserRepo) Update(player *domain.Player) error {
	ctx := context.Background()
	redisKey := "player:profile:" + player.ID

	// 1. Marshal and store in Redis instantly (eliminates immediate database blocking I/O)
	data, err := json.Marshal(player)
	if err != nil {
		return err
	}
	if err := c.rdb.Set(ctx, redisKey, data, 24*time.Hour).Err(); err != nil {
		fmt.Printf("⚠️ [Write-Back Cache] Gagal menulis ke Redis, fallback langsung ke Postgres: %v\n", err)
		return c.postgresRepo.Update(player) // Direct fallback if Redis is unavailable
	}

	// 2. Mark character ID as dirty for background batch write-back
	c.dirtyMu.Lock()
	c.dirtyPlayers[player.ID] = true
	c.dirtyMu.Unlock()

	return nil
}

func (c *cachedUserRepo) startSyncLoop() {
	ticker := time.NewTicker(30 * time.Second)
	ctx := context.Background()
	for range ticker.C {
		c.FlushDirtyToPostgres(ctx)
	}
}

func (c *cachedUserRepo) FlushDirtyToPostgres(ctx context.Context) {
	c.dirtyMu.Lock()
	if len(c.dirtyPlayers) == 0 {
		c.dirtyMu.Unlock()
		return
	}

	// Copy and clean the active dirty registry
	playersToSync := make([]string, 0, len(c.dirtyPlayers))
	for pID := range c.dirtyPlayers {
		playersToSync = append(playersToSync, pID)
	}
	c.dirtyPlayers = make(map[string]bool)
	c.dirtyMu.Unlock()

	fmt.Printf("💾 [Write-Back Cache] Starting batch flush of %d players to PostgreSQL...\n", len(playersToSync))

	// Write back in a single database transaction for safety and maximum speed
	err := c.db.Transaction(func(tx *gorm.DB) error {
		for _, pID := range playersToSync {
			redisKey := "player:profile:" + pID
			data, err := c.rdb.Get(ctx, redisKey).Result()
			if err != nil {
				fmt.Printf("⚠️ [Write-Back Cache] Gagal mengambil data Redis untuk player %s: %v\n", pID, err)
				c.reMarkDirty(pID)
				continue
			}

			var player domain.Player
			if err := json.Unmarshal([]byte(data), &player); err != nil {
				fmt.Printf("⚠️ [Write-Back Cache] Gagal unmarshal player %s: %v\n", pID, err)
				continue
			}

			// Force GORM FullSaveAssociations to correctly update character profile and inventory/skills tables
			if err := tx.Session(&gorm.Session{FullSaveAssociations: true}).Save(&player).Error; err != nil {
				fmt.Printf("❌ [Write-Back Cache] Gagal menyimpan player %s ke PostgreSQL: %v\n", pID, err)
				c.reMarkDirty(pID)
				return err
			}
		}
		return nil
	})

	if err == nil {
		fmt.Printf("✅ [Write-Back Cache] Sukses mem-flush %d players ke PostgreSQL!\n", len(playersToSync))
	}
}

func (c *cachedUserRepo) reMarkDirty(playerID string) {
	c.dirtyMu.Lock()
	c.dirtyPlayers[playerID] = true
	c.dirtyMu.Unlock()
}
