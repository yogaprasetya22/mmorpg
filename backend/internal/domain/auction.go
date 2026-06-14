package domain

import "time"

// AuctionItem represents an item listed for sale on the player-to-player marketplace.
type AuctionItem struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	SellerID    string    `json:"seller_id" gorm:"index;not null"`
	SellerName  string    `json:"seller_name"`
	ItemID      string    `json:"item_id" gorm:"not null"`
	Name        string    `json:"name" gorm:"not null"`
	Type        string    `json:"type"`
	SlotType    string    `json:"slot_type"`
	Quantity    int       `json:"quantity" gorm:"default:1"`
	RefineLevel int       `json:"refine_level" gorm:"default:0"`
	AddHP       float32   `json:"add_hp"`
	AddMP       float32   `json:"add_mp"`
	AddAttack   float32   `json:"add_attack"`
	AddDefense  float32   `json:"add_defense"`
	Price       int       `json:"price" gorm:"not null"`
	CreatedAt   time.Time `json:"created_at"`
}
