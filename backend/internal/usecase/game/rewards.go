package game

import (
	"fmt"
	"time"

	"mmorpg-backend/internal/domain"
)

// DailyReward defines a reward structure
type DailyReward struct {
	Day         int    `json:"day"`
	Name        string `json:"name"`
	Type        string `json:"type"` // "zeny", "item"
	ItemID      string `json:"item_id,omitempty"`
	Quantity    int    `json:"quantity"`
	Description string `json:"description"`
}

var DailyRewardsList = []DailyReward{
	{Day: 1, Name: "Zeny Pemula", Type: "zeny", Quantity: 500, Description: "500 Zeny untuk belanja kebutuhan awal."},
	{Day: 2, Name: "Ramuan Merah", Type: "item", ItemID: "potion_red", Quantity: 5, Description: "5x Red Potion untuk memulihkan HP."},
	{Day: 3, Name: "Zeny Prajurit", Type: "zeny", Quantity: 1000, Description: "1000 Zeny untuk upgrade perlengkapan."},
	{Day: 4, Name: "Ramuan Biru", Type: "item", ItemID: "potion_blue", Quantity: 5, Description: "5x Blue Potion untuk memulihkan MP."},
	{Day: 5, Name: "Zeny Ksatria", Type: "zeny", Quantity: 2000, Description: "2000 Zeny untuk persiapan petualangan besar."},
	{Day: 6, Name: "Ramuan Hijau", Type: "item", ItemID: "potion_green", Quantity: 5, Description: "5x Green Potion untuk HP & MP."},
	{Day: 7, Name: "Cincin Kekuatan", Type: "item", ItemID: "accessory_ring", Quantity: 1, Description: "Cincin penambah kekuatan fisik. ATK +15, Max HP +50."},
}

func (u *gameUsecase) ClaimDailyReward(playerID string) error {
	u.activePlayersMu.Lock()
	playerData, exists := u.activePlayers[playerID]
	if !exists || playerData == nil {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("player tidak ditemukan")
	}

	now := time.Now()
	if playerData.LastDailyClaim != nil {
		// Check if it's been at least 20 hours since last claim
		cooldown := 20 * time.Hour
		nextClaimTime := playerData.LastDailyClaim.Add(cooldown)
		if now.Before(nextClaimTime) {
			u.activePlayersMu.Unlock()
			remaining := nextClaimTime.Sub(now).Round(time.Minute)
			return fmt.Errorf("reward belum siap. Mohon tunggu %s lagi", remaining.String())
		}
	}

	// Increment day count
	playerData.CheckInCount++
	if playerData.CheckInCount > 7 {
		playerData.CheckInCount = 1
	}

	reward := DailyRewardsList[playerData.CheckInCount-1]

	// Apply reward
	if reward.Type == "zeny" {
		playerData.Gold += reward.Quantity
	} else if reward.Type == "item" {
		// Find config details for the item
		itemDetail, ok := ShopCatalog[reward.ItemID]
		if ok {
			playerData.Inventory = append(playerData.Inventory, domain.PlayerItem{
				ID:             fmt.Sprintf("%s-%s-%d", playerID, reward.ItemID, time.Now().UnixNano()%100000),
				PlayerID:       playerID,
				ItemID:         reward.ItemID,
				Name:           itemDetail.Name,
				Type:           itemDetail.Type,
				SlotType:       itemDetail.SlotType,
				WeaponCategory: itemDetail.WeaponCategory,
				Quantity:       reward.Quantity,
				IsEquipped:     false,
				AddHP:          itemDetail.AddHP,
				AddMP:          itemDetail.AddMP,
				AddAttack:      itemDetail.AddAttack,
				AddDefense:     itemDetail.AddDefense,
			})
		}
	}

	playerData.LastDailyClaim = &now
	playerData.RecalculateStats()
	_ = u.playerRepo.Update(playerData)
	u.activePlayersMu.Unlock()

	// Notify player over chat
	msgText := fmt.Sprintf("🎁 %s berhasil mengklaim Daily Reward Hari ke-%d: %s!", playerData.Username, playerData.CheckInCount, reward.Name)
	u.eventCallback("chat", map[string]interface{}{
		"name": "Sistem Reward",
		"msg":  msgText,
	})

	// Send an event back to update player client rewards UI state
	u.eventCallback("reward_claimed_success", map[string]interface{}{
		"player_id":        playerID,
		"check_in_count":   playerData.CheckInCount,
		"last_daily_claim": playerData.LastDailyClaim,
	})

	return nil
}
