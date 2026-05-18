package postgres

import (
	"errors"
	"gorm.io/gorm"
	"mmorpg-backend/internal/domain"
)

type userRepo struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) domain.PlayerRepository {
	return &userRepo{db: db}
}

func (r *userRepo) Create(player *domain.Player) error {
	// Full save associations ensures initial inventory/skills/quests are saved at creation
	return r.db.Session(&gorm.Session{FullSaveAssociations: true}).Create(player).Error
}

func (r *userRepo) GetByID(id string) (*domain.Player, error) {
	var player domain.Player
	// Preload the related arrays so player items, skills, and quests are loaded
	err := r.db.Preload("Inventory").Preload("Skills").Preload("Quests").First(&player, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &player, nil
}

func (r *userRepo) GetByUsername(username string) (*domain.Player, error) {
	var player domain.Player
	// Preload the related arrays
	err := r.db.Preload("Inventory").Preload("Skills").Preload("Quests").First(&player, "username = ?", username).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &player, nil
}

func (r *userRepo) GetByUserID(userID string) ([]*domain.Player, error) {
	var players []*domain.Player
	err := r.db.Preload("Inventory").Preload("Skills").Preload("Quests").Find(&players, "user_id = ?", userID).Error
	if err != nil {
		return nil, err
	}
	return players, nil
}

func (r *userRepo) Update(player *domain.Player) error {
	// Use FullSaveAssociations: true to also save updates in items, skills, and quests graphs
	return r.db.Session(&gorm.Session{FullSaveAssociations: true}).Save(player).Error
}
