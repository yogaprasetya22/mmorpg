package domain

import "time"

type Asset struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Name      string    `json:"name"`
	Path      string    `json:"path" gorm:"uniqueIndex"`
	Category  string    `json:"category"` // kingdom, env, tree
	Thumbnail string    `json:"thumbnail"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
