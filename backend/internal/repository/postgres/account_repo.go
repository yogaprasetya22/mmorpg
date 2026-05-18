package postgres

import (
	"errors"
	"gorm.io/gorm"
	"mmorpg-backend/internal/domain"
)

type accountRepo struct {
	db *gorm.DB
}

func NewAccountRepository(db *gorm.DB) domain.UserRepository {
	return &accountRepo{db: db}
}

func (r *accountRepo) Create(user *domain.User) error {
	return r.db.Create(user).Error
}

func (r *accountRepo) GetByID(id string) (*domain.User, error) {
	var user domain.User
	err := r.db.Preload("Players").First(&user, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *accountRepo) GetByUsername(username string) (*domain.User, error) {
	var user domain.User
	err := r.db.Preload("Players").First(&user, "username = ?", username).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}
