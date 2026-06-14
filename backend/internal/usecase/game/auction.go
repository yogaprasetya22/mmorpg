package game

import (
	"fmt"
	"time"

	"gorm.io/gorm"
	"mmorpg-backend/internal/domain"
)

// ListAuctionItem registers a player item to the global marketplace.
func (u *gameUsecase) ListAuctionItem(playerID string, playerItemID string, price int) error {
	if price <= 0 {
		return fmt.Errorf("harga harus lebih besar dari 0")
	}

	u.activePlayersMu.Lock()
	playerData, exists := u.activePlayers[playerID]
	if !exists || playerData == nil {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("player tidak ditemukan")
	}

	// Find item in inventory
	itemIdx := -1
	for i := range playerData.Inventory {
		if playerData.Inventory[i].ID == playerItemID {
			itemIdx = i
			break
		}
	}

	if itemIdx == -1 {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("item tidak ditemukan di inventory")
	}

	item := playerData.Inventory[itemIdx]
	if item.IsEquipped {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("tidak bisa menjual item yang sedang dipakai")
	}

	// Create AuctionItem record
	auctionItem := domain.AuctionItem{
		ID:          fmt.Sprintf("auc-%d", time.Now().UnixNano()),
		SellerID:    playerID,
		SellerName:  playerData.Username,
		ItemID:      item.ItemID,
		Name:        item.Name,
		Type:        item.Type,
		SlotType:    item.SlotType,
		Quantity:    item.Quantity,
		RefineLevel: item.RefineLevel,
		AddHP:          item.AddHP,
		AddMP:          item.AddMP,
		AddAttack:      item.AddAttack,
		AddDefense:     item.AddDefense,
		Price:       price,
		CreatedAt:   time.Now(),
	}

	// Remove item from player inventory
	playerData.Inventory = append(playerData.Inventory[:itemIdx], playerData.Inventory[itemIdx+1:]...)
	playerData.RecalculateStats()

	// Save player profile
	_ = u.playerRepo.Update(playerData)
	u.activePlayersMu.Unlock()

	// Write AuctionItem to DB
	if err := u.db.Create(&auctionItem).Error; err != nil {
		// Rollback inventory in memory by loading from DB
		_ = u.SyncPlayerStatsFromDB(playerID)
		return fmt.Errorf("gagal membuat lelang: %w", err)
	}

	// Broadcast success notifications
	u.eventCallback("chat", map[string]interface{}{
		"name": "Pelelangan",
		"msg":  fmt.Sprintf("⚖️ %s mendaftarkan %s (+%d) seharga %d Zeny ke Pelelangan!", playerData.Username, auctionItem.Name, auctionItem.RefineLevel, price),
	})

	u.eventCallback("auction_list_changed", nil)

	return nil
}

// BuyoutAuctionItem processes marketplace purchase transaction.
func (u *gameUsecase) BuyoutAuctionItem(playerID string, auctionItemID string) error {
	// Fetch AuctionItem
	var aucItem domain.AuctionItem
	if err := u.db.First(&aucItem, "id = ?", auctionItemID).Error; err != nil {
		return fmt.Errorf("barang lelang tidak ditemukan atau sudah terjual")
	}

	if aucItem.SellerID == playerID {
		return fmt.Errorf("anda tidak bisa membeli barang anda sendiri")
	}

	u.activePlayersMu.Lock()
	buyer, buyerExists := u.activePlayers[playerID]
	if !buyerExists || buyer == nil {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("buyer tidak ditemukan")
	}

	if buyer.Gold < aucItem.Price {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("zeny tidak mencukupi (butuh %d Zeny)", aucItem.Price)
	}

	// Process funds transfer
	buyer.Gold -= aucItem.Price

	// Create and append the purchased item
	boughtItem := domain.PlayerItem{
		ID:             fmt.Sprintf("%s-%s-%d", playerID, aucItem.ItemID, time.Now().UnixNano()%100000),
		PlayerID:       playerID,
		ItemID:         aucItem.ItemID,
		Name:           aucItem.Name,
		Type:           aucItem.Type,
		SlotType:       aucItem.SlotType,
		Quantity:       aucItem.Quantity,
		RefineLevel:    aucItem.RefineLevel,
		AddHP:          aucItem.AddHP,
		AddMP:          aucItem.AddMP,
		AddAttack:      aucItem.AddAttack,
		AddDefense:     aucItem.AddDefense,
		IsEquipped:     false,
	}
	buyer.Inventory = append(buyer.Inventory, boughtItem)
	buyer.RecalculateStats()

	// Save buyer
	_ = u.playerRepo.Update(buyer)
	u.activePlayersMu.Unlock()

	// Pay seller
	u.activePlayersMu.Lock()
	seller, sellerExists := u.activePlayers[aucItem.SellerID]
	if sellerExists && seller != nil {
		seller.Gold += aucItem.Price
		_ = u.playerRepo.Update(seller)
		u.activePlayersMu.Unlock()
	} else {
		u.activePlayersMu.Unlock()
		// Update offline seller's gold directly in DB
		u.db.Model(&domain.Player{}).Where("id = ?", aucItem.SellerID).UpdateColumn("gold", gorm.Expr("gold + ?", aucItem.Price))
	}

	// Delete from Auction database table
	u.db.Delete(&aucItem)

	// Broadcast success
	u.eventCallback("chat", map[string]interface{}{
		"name": "Pelelangan",
		"msg":  fmt.Sprintf("⚖️ %s telah membeli %s (+%d) seharga %d Zeny dari %s!", buyer.Username, aucItem.Name, aucItem.RefineLevel, aucItem.Price, aucItem.SellerName),
	})

	u.eventCallback("auction_list_changed", nil)

	return nil
}

// GetAuctionItems returns all active marketplace listings.
func (u *gameUsecase) GetAuctionItems() ([]domain.AuctionItem, error) {
	var items []domain.AuctionItem
	if err := u.db.Order("created_at desc").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}
