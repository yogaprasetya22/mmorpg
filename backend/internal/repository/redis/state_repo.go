package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"mmorpg-backend/internal/domain"
	"mmorpg-backend/pkg/config"
)

type StateRepository interface {
	SavePlayerState(ctx context.Context, state *domain.PlayerNetworkState) error
	GetPlayerState(ctx context.Context, playerID string) (*domain.PlayerNetworkState, error)
	GetAllPlayerStates(ctx context.Context) ([]domain.PlayerNetworkState, error)
	DeletePlayerState(ctx context.Context, playerID string) error
}

type stateRepo struct {
	client *redis.Client
	key    string
}

func NewRedisClient(cfg *config.Config) *redis.Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort),
		Password: cfg.RedisPassword,
		DB:       0, // Default DB
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		fmt.Printf("⚠️ Gagal terhubung ke Redis: %v. Menggunakan mode memori lokal.\n", err)
	} else {
		fmt.Printf("✅ Sukses terhubung ke database Redis (%s:%s)\n", cfg.RedisHost, cfg.RedisPort)
	}

	return rdb
}

func NewStateRepository(client *redis.Client) StateRepository {
	return &stateRepo{
		client: client,
		key:    "player:states",
	}
}

func (r *stateRepo) SavePlayerState(ctx context.Context, state *domain.PlayerNetworkState) error {
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return r.client.HSet(ctx, r.key, state.ID, data).Err()
}

func (r *stateRepo) GetPlayerState(ctx context.Context, playerID string) (*domain.PlayerNetworkState, error) {
	data, err := r.client.HGet(ctx, r.key, playerID).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}

	var state domain.PlayerNetworkState
	if err := json.Unmarshal([]byte(data), &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (r *stateRepo) GetAllPlayerStates(ctx context.Context) ([]domain.PlayerNetworkState, error) {
	res, err := r.client.HGetAll(ctx, r.key).Result()
	if err != nil {
		return nil, err
	}

	var states []domain.PlayerNetworkState
	for _, val := range res {
		var state domain.PlayerNetworkState
		if err := json.Unmarshal([]byte(val), &state); err == nil {
			states = append(states, state)
		}
	}
	return states, nil
}

func (r *stateRepo) DeletePlayerState(ctx context.Context, playerID string) error {
	return r.client.HDel(ctx, r.key, playerID).Err()
}
