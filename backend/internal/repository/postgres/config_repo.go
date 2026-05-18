package postgres

import (
	"errors"
	"gorm.io/gorm"
	"mmorpg-backend/internal/domain"
)

type configRepo struct {
	db *gorm.DB
}

func NewConfigRepository(db *gorm.DB) domain.ConfigRepository {
	return &configRepo{db: db}
}

func (r *configRepo) GetClassConfigs() ([]domain.ClassConfig, error) {
	var cfgs []domain.ClassConfig
	err := r.db.Find(&cfgs).Error
	return cfgs, err
}

func (r *configRepo) GetClassConfig(classID string) (*domain.ClassConfig, error) {
	var cfg domain.ClassConfig
	err := r.db.First(&cfg, "id = ?", classID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &cfg, nil
}

func (r *configRepo) SaveClassConfig(cfg *domain.ClassConfig) error {
	return r.db.Save(cfg).Error
}

func (r *configRepo) GetSimulationSettings() (*domain.SimulationSetting, error) {
	var cfg domain.SimulationSetting
	err := r.db.First(&cfg, "id = ?", "default").Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &cfg, nil
}

func (r *configRepo) SaveSimulationSettings(cfg *domain.SimulationSetting) error {
	cfg.ID = "default" // Force ID to be "default"
	return r.db.Save(cfg).Error
}

func (r *configRepo) GetMonsterConfigs() ([]domain.MonsterConfig, error) {
	var cfgs []domain.MonsterConfig
	err := r.db.Find(&cfgs).Error
	return cfgs, err
}

func (r *configRepo) GetMonsterConfig(mType string) (*domain.MonsterConfig, error) {
	var cfg domain.MonsterConfig
	err := r.db.First(&cfg, "type = ?", mType).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &cfg, nil
}

func (r *configRepo) SaveMonsterConfig(cfg *domain.MonsterConfig) error {
	return r.db.Save(cfg).Error
}

func (r *configRepo) DeleteMonsterConfig(mType string) error {
	return r.db.Delete(&domain.MonsterConfig{}, "type = ?", mType).Error
}
