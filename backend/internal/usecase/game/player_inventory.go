// REFACTORED FROM: game_usecase.go
// Player inventory management — EquipPlayerItem and UseConsumable.
package game

import (
	"fmt"
	"mmorpg-backend/internal/domain"
)

func (u *gameUsecase) EquipPlayerItem(playerID string, playerItemID string) {
	u.activePlayersMu.Lock()
	playerData, exists := u.activePlayers[playerID]
	if !exists || playerData == nil {
		u.activePlayersMu.Unlock()
		return
	}
	var targetItem *domain.PlayerItem
	var slotType string
	for i := range playerData.Inventory {
		if playerData.Inventory[i].ID == playerItemID {
			targetItem = &playerData.Inventory[i]
			slotType = targetItem.SlotType
			break
		}
	}
	if targetItem == nil || targetItem.Type != "equipment" {
		u.activePlayersMu.Unlock()
		return
	}
	// Unequip current equipped item in same slot
	for i := range playerData.Inventory {
		if playerData.Inventory[i].SlotType == slotType && playerData.Inventory[i].IsEquipped {
			playerData.Inventory[i].IsEquipped = false
		}
	}
	targetItem.IsEquipped = true
	playerData.RecalculateStats()
	u.activePlayersMu.Unlock()
	fmt.Printf("🛡️ Player %s equipped %s into slot %s.\n", playerData.Username, targetItem.Name, slotType)
}

func (u *gameUsecase) UseConsumable(playerID string, playerItemID string) {
	u.activePlayersMu.Lock()
	playerData, exists := u.activePlayers[playerID]
	if !exists || playerData == nil {
		u.activePlayersMu.Unlock()
		return
	}
	itemIdx := -1
	for i := range playerData.Inventory {
		if playerData.Inventory[i].ID == playerItemID {
			itemIdx = i
			break
		}
	}
	if itemIdx == -1 {
		u.activePlayersMu.Unlock()
		return
	}
	item := &playerData.Inventory[itemIdx]
	if item.Type != "consumable" || item.Quantity <= 0 {
		u.activePlayersMu.Unlock()
		return
	}
	hpHeal := item.AddHP
	mpHeal := item.AddMP
	playerData.HP += hpHeal
	if playerData.HP > playerData.MaxHP {
		playerData.HP = playerData.MaxHP
	}
	playerData.MP += mpHeal
	if playerData.MP > playerData.MaxMP {
		playerData.MP = playerData.MaxMP
	}
	item.Quantity--
	if item.Quantity <= 0 {
		playerData.Inventory = append(playerData.Inventory[:itemIdx], playerData.Inventory[itemIdx+1:]...)
	}
	u.activePlayersMu.Unlock()

	if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
		h := healthComp.(*domain.HealthComponent)
		h.HP = playerData.HP
	}
	fmt.Printf("🧪 Player %s used %s (+%.1f HP, +%.1f MP). HP: %.1f/%.1f\n",
		playerData.Username, item.Name, hpHeal, mpHeal, playerData.HP, playerData.MaxHP)
}
