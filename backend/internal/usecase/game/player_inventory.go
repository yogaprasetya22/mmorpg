// REFACTORED FROM: game_usecase.go
// Player inventory management — EquipPlayerItem, UseConsumable, BuyItem, SellItem.
package game

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"mmorpg-backend/internal/domain"
)

// ShopCatalog defines hardcoded items available for purchase
var ShopCatalog = map[string]struct {
	Name           string
	Type           string
	SlotType       string
	WeaponCategory string
	Price          int
	AddHP          float32
	AddMP          float32
	AddAttack      float32
	AddDefense     float32
}{
	"potion_red":     {Name: "Red Potion", Type: "consumable", Price: 50, AddHP: 150},
	"potion_blue":    {Name: "Blue Potion", Type: "consumable", Price: 80, AddMP: 50},
	"potion_green":   {Name: "Green Potion", Type: "consumable", Price: 120, AddHP: 300, AddMP: 30},
	"sword_iron":     {Name: "Iron Sword", Type: "equipment", SlotType: "weapon", WeaponCategory: "sword", Price: 500, AddAttack: 30},
	"axe_iron":       {Name: "Iron Axe", Type: "equipment", SlotType: "weapon", WeaponCategory: "sword", Price: 650, AddAttack: 40},
	"bow_hunter":     {Name: "Hunter Bow", Type: "equipment", SlotType: "weapon", WeaponCategory: "bow", Price: 550, AddAttack: 35},
	"staff_magic":    {Name: "Magic Staff", Type: "equipment", SlotType: "weapon", WeaponCategory: "staff", Price: 800, AddAttack: 25, AddMP: 60},
	"leather_armor":  {Name: "Leather Armor", Type: "equipment", SlotType: "armor", Price: 400, AddDefense: 15},
	"chain_mail":     {Name: "Chain Mail", Type: "equipment", SlotType: "armor", Price: 1200, AddDefense: 30},
	"plate_armor":    {Name: "Plate Armor", Type: "equipment", SlotType: "armor", Price: 3500, AddHP: 100, AddDefense: 55},
	"iron_helm":      {Name: "Iron Helm", Type: "equipment", SlotType: "helmet", Price: 300, AddDefense: 10, AddHP: 30},
	"leather_boots":  {Name: "Leather Boots", Type: "equipment", SlotType: "boots", Price: 200, AddDefense: 8},
	"iron_shield":    {Name: "Iron Shield", Type: "equipment", SlotType: "shield", Price: 600, AddDefense: 20},
	"accessory_ring": {Name: "Power Ring", Type: "equipment", SlotType: "accessory", Price: 1500, AddAttack: 15, AddHP: 50},
}

// SellPriceRatio determines what fraction of buy price players get back
const SellPriceRatio = 0.5

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
	if targetItem.IsEquipped {
		targetItem.IsEquipped = false
		fmt.Printf("🛡️ Player %s unequipped %s from slot %s.\n", playerData.Username, targetItem.Name, slotType)
	} else {
		// Unequip current equipped item in same slot
		for i := range playerData.Inventory {
			if playerData.Inventory[i].SlotType == slotType && playerData.Inventory[i].IsEquipped {
				playerData.Inventory[i].IsEquipped = false
			}
		}
		targetItem.IsEquipped = true
		fmt.Printf("🛡️ Player %s equipped %s into slot %s.\n", playerData.Username, targetItem.Name, slotType)
	}
	u.updatePlayerCustomAvatar(playerData)
	playerData.RecalculateStats()
	u.activePlayersMu.Unlock()
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

// BuyItem purchases an item from the shop catalog using gold
func (u *gameUsecase) BuyItem(playerID string, catalogItemID string, quantity int) error {
	catalogEntry, exists := ShopCatalog[catalogItemID]
	if !exists {
		return fmt.Errorf("item %s not found in shop catalog", catalogItemID)
	}
	if quantity <= 0 {
		quantity = 1
	}
	totalCost := catalogEntry.Price * quantity

	u.activePlayersMu.Lock()
	playerData, pExists := u.activePlayers[playerID]
	if !pExists || playerData == nil {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("player not found")
	}
	if playerData.Gold < totalCost {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("insufficient gold (need %d, have %d)", totalCost, playerData.Gold)
	}
	playerData.Gold -= totalCost

	// Check if consumable already exists in inventory — stack quantity
	if catalogEntry.Type == "consumable" {
		for i := range playerData.Inventory {
			if playerData.Inventory[i].ItemID == catalogItemID && playerData.Inventory[i].Type == "consumable" {
				playerData.Inventory[i].Quantity += quantity
				u.activePlayersMu.Unlock()
				fmt.Printf("🛒 Player %s bought %dx %s (stacked). Gold: %d\n", playerData.Username, quantity, catalogEntry.Name, playerData.Gold)
				return nil
			}
		}
	}

	// Create new item
	for i := 0; i < quantity; i++ {
		itemID := fmt.Sprintf("%s-shop-%d", playerID, time.Now().UnixNano()%1000000+int64(i))
		newItem := domain.PlayerItem{
			ID:         itemID,
			PlayerID:   playerID,
			ItemID:     catalogItemID,
			Name:       catalogEntry.Name,
			Type:       catalogEntry.Type,
			SlotType:       catalogEntry.SlotType,
			WeaponCategory: catalogEntry.WeaponCategory,
			Quantity:   1,
			IsEquipped: false,
			AddHP:      catalogEntry.AddHP,
			AddMP:      catalogEntry.AddMP,
			AddAttack:  catalogEntry.AddAttack,
			AddDefense: catalogEntry.AddDefense,
		}
		if catalogEntry.Type == "consumable" {
			newItem.Quantity = quantity
		}
		playerData.Inventory = append(playerData.Inventory, newItem)
		if catalogEntry.Type == "consumable" {
			break // Already set quantity above
		}
	}
	u.activePlayersMu.Unlock()

	fmt.Printf("🛒 Player %s bought %dx %s for %d gold. Gold: %d\n", playerData.Username, quantity, catalogEntry.Name, totalCost, playerData.Gold)
	return nil
}

// SellItem sells a player's inventory item for gold (50% of catalog price)
func (u *gameUsecase) SellItem(playerID string, playerItemID string) error {
	u.activePlayersMu.Lock()
	playerData, pExists := u.activePlayers[playerID]
	if !pExists || playerData == nil {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("player not found")
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
		return fmt.Errorf("item not found in inventory")
	}

	item := &playerData.Inventory[itemIdx]
	if item.IsEquipped {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("cannot sell equipped item")
	}

	// Calculate sell price
	var sellPrice int
	if catalogEntry, exists := ShopCatalog[item.ItemID]; exists {
		sellPrice = int(float64(catalogEntry.Price) * SellPriceRatio)
	} else {
		// Dropped items: estimate price from stats
		sellPrice = int(item.AddAttack*5 + item.AddDefense*5 + item.AddHP*0.5 + item.AddMP*0.5 + 10)
	}

	playerData.Gold += sellPrice
	itemName := item.Name

	// Remove item
	playerData.Inventory = append(playerData.Inventory[:itemIdx], playerData.Inventory[itemIdx+1:]...)
	u.activePlayersMu.Unlock()

	fmt.Printf("💰 Player %s sold %s for %d gold. Gold: %d\n", playerData.Username, itemName, sellPrice, playerData.Gold)
	return nil
}

// RefineItem upgrades a player's equipment weapon or armor level
func (u *gameUsecase) RefineItem(playerID string, playerItemID string) error {
	u.activePlayersMu.Lock()
	playerData, pExists := u.activePlayers[playerID]
	if !pExists || playerData == nil {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("player not found")
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
		return fmt.Errorf("item not found in inventory")
	}

	item := &playerData.Inventory[itemIdx]
	if item.Type != "equipment" {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("only equipment can be refined")
	}

	cost := 1000 * (item.RefineLevel + 1)
	if playerData.Gold < cost {
		u.activePlayersMu.Unlock()
		return fmt.Errorf("insufficient gold (need %d, have %d)", cost, playerData.Gold)
	}

	playerData.Gold -= cost

	// Success rate logic
	var successRate float32
	switch {
	case item.RefineLevel < 4:
		successRate = 1.0 // Safe limit
	case item.RefineLevel == 4:
		successRate = 0.70
	case item.RefineLevel == 5:
		successRate = 0.60
	case item.RefineLevel == 6:
		successRate = 0.50
	case item.RefineLevel == 7:
		successRate = 0.40
	case item.RefineLevel == 8:
		successRate = 0.30
	default:
		successRate = 0.20
	}

	roll := float32(time.Now().UnixNano()%100) / 100.0
	success := roll < successRate
	oldName := item.Name
	oldRefine := item.RefineLevel

	var msgText string
	if success {
		item.RefineLevel++
		msgText = fmt.Sprintf("✨ TEMPA SUKSES! %s berhasil ditingkatkan dari +%d ke +%d!", oldName, oldRefine, item.RefineLevel)
		fmt.Printf("🛠️ %s\n", msgText)
	} else {
		// Failure
		if item.RefineLevel >= 8 {
			// Item breaks!
			msgText = fmt.Sprintf("💥 TEMPA GAGAL! %s hancur berkeping-keping saat dicoba tempa ke +%d!", oldName, oldRefine+1)
			playerData.Inventory = append(playerData.Inventory[:itemIdx], playerData.Inventory[itemIdx+1:]...)
			fmt.Printf("🛠️ %s\n", msgText)
		} else if item.RefineLevel >= 4 {
			item.RefineLevel--
			msgText = fmt.Sprintf("⚠️ TEMPA GAGAL! Tingkat refine %s turun dari +%d ke +%d!", oldName, oldRefine, item.RefineLevel)
			fmt.Printf("🛠️ %s\n", msgText)
		} else {
			msgText = fmt.Sprintf("⚠️ TEMPA GAGAL! %s gagal menempa, namun tingkat refine tetap +%d (Batas Aman).", oldName, oldRefine)
			fmt.Printf("🛠️ %s\n", msgText)
		}
	}

	playerData.RecalculateStats()
	u.activePlayersMu.Unlock()

	// Notify player over Chat system
	u.eventCallback("chat", map[string]interface{}{
		"name": "Pandai Besi",
		"msg":  msgText,
	})

	return nil
}

// updatePlayerCustomAvatar dynamically synchronizes the player's 3D avatar JSON string with currently equipped items
func (u *gameUsecase) updatePlayerCustomAvatar(player *domain.Player) {
	if player.CustomAvatarURL == "" {
		return
	}

	var avatarMap map[string]interface{}
	if err := json.Unmarshal([]byte(player.CustomAvatarURL), &avatarMap); err != nil {
		fmt.Printf("⚠️ Failed to parse CustomAvatarURL for %s: %v\n", player.Username, err)
		return
	}

	// Helper to set asset in avatar slot
	setSlotAsset := func(slotName string, assetID string, name string, url string) {
		if slotName == "" {
			return
		}
		if assetID == "" {
			avatarMap[slotName] = map[string]interface{}{
				"color": "",
				"asset": nil,
			}
		} else {
			avatarMap[slotName] = map[string]interface{}{
				"color": "",
				"asset": map[string]interface{}{
					"id":    assetID,
					"name":  name,
					"group": "cat_" + strings.ToLower(slotName),
					"url":   url,
				},
			}
		}
	}

	// 1. Find equipped items
	var equippedWeapon *domain.PlayerItem
	var equippedArmor *domain.PlayerItem
	var equippedHelm *domain.PlayerItem
	var equippedBoots *domain.PlayerItem

	for i := range player.Inventory {
		item := &player.Inventory[i]
		if item.IsEquipped {
			switch item.SlotType {
			case "weapon":
				equippedWeapon = item
			case "armor":
				equippedArmor = item
			case "helmet":
				equippedHelm = item
			case "boots":
				equippedBoots = item
			}
		}
	}

	// Update Weapon Slot
	if equippedWeapon != nil {
		var wID, wName, wURL string
		switch equippedWeapon.ItemID {
		case "sword_iron":
			wID, wName, wURL = "asset_weapon_sword", "Iron Sword", "/assets/items/weapons/Sword.glb"
		case "axe_iron":
			wID, wName, wURL = "asset_weapon_axe", "Iron Axe", "/assets/items/weapons/Battle_Axe.glb"
		case "bow_hunter":
			wID, wName, wURL = "asset_weapon_bow", "Hunter Bow", "/assets/items/weapons/Battle_Bow.glb"
		case "staff_magic":
			wID, wName, wURL = "asset_weapon_scythe", "Magic Staff", "/assets/items/weapons/Battle_Scythe.glb"
		case "sword_starter":
			wID, wName, wURL = "asset_weapon_sword", "Wooden Sword", "/assets/items/weapons/Sword.glb"
		case "bow_starter":
			wID, wName, wURL = "asset_weapon_bow", "Wooden Bow", "/assets/items/weapons/Battle_Bow.glb"
		case "staff_starter":
			wID, wName, wURL = "asset_weapon_scythe", "Wooden Staff", "/assets/items/weapons/Battle_Scythe.glb"
		case "mace_starter":
			wID, wName, wURL = "asset_weapon_hammer", "Wooden Mace", "/assets/items/weapons/Battle_Hammer.glb"
		case "dagger_starter":
			wID, wName, wURL = "asset_weapon_scythe", "Wooden Dagger", "/assets/items/weapons/Battle_Scythe.glb"
		default:
			// Fallback from category
			wCat := equippedWeapon.WeaponCategory
			if wCat == "bow" {
				wID, wName, wURL = "asset_weapon_bow", equippedWeapon.Name, "/assets/items/weapons/Battle_Bow.glb"
			} else if wCat == "staff" {
				wID, wName, wURL = "asset_weapon_scythe", equippedWeapon.Name, "/assets/items/weapons/Battle_Scythe.glb"
			} else if wCat == "mace" {
				wID, wName, wURL = "asset_weapon_hammer", equippedWeapon.Name, "/assets/items/weapons/Battle_Hammer.glb"
			} else {
				wID, wName, wURL = "asset_weapon_sword", equippedWeapon.Name, "/assets/items/weapons/Sword.glb"
			}
		}
		setSlotAsset("Weapon", wID, wName, wURL)
	} else {
		// Reset to default weapon based on class
		wID := "asset_weapon_sword"
		wURL := "/assets/items/weapons/Sword.glb"
		switch player.Class {
		case "Beginner":
			wID = "asset_weapon_bow"
			wURL = "/assets/items/weapons/Battle_Bow.glb"
		case "Mage":
			wID = "asset_weapon_scythe"
			wURL = "/assets/items/weapons/Battle_Scythe.glb"
		case "Priest":
			wID = "asset_weapon_hammer"
			wURL = "/assets/items/weapons/Battle_Hammer.glb"
		case "Thief":
			wID = "asset_weapon_scythe"
			wURL = "/assets/items/weapons/Battle_Scythe.glb"
		}
		setSlotAsset("Weapon", wID, player.Class, wURL)
	}

	// Update Outfit Slot
	if equippedArmor != nil {
		var oID, oName, oURL string
		switch equippedArmor.ItemID {
		case "leather_armor":
			oID, oName, oURL = "asset_outfit_002", "Leather Armor", "/assets/characters/modular/tops/Outfit.002.glb"
		case "chain_mail":
			oID, oName, oURL = "asset_outfit_003", "Chain Mail", "/assets/characters/modular/tops/Outfit.003.glb"
		case "plate_armor":
			oID, oName, oURL = "asset_outfit_004", "Plate Armor", "/assets/characters/modular/tops/Outfit.004.glb"
		default:
			oID, oName, oURL = "asset_outfit_001", "Outfit #1", "/assets/characters/modular/tops/Outfit.001.glb"
		}
		setSlotAsset("Outfit", oID, oName, oURL)
	} else {
		// Reset to default Outfit #1
		setSlotAsset("Outfit", "asset_outfit_001", "Outfit #1", "/assets/characters/modular/tops/Outfit.001.glb")
	}

	// Update Helmet Slot
	if equippedHelm != nil {
		var hID, hName, hURL string
		switch equippedHelm.ItemID {
		case "iron_helm":
			hID, hName, hURL = "asset_hat_001", "Iron Helm", "/assets/characters/modular/hair_and_hats/Hat.001.glb"
		default:
			hID, hName, hURL = "", "", ""
		}
		if hID != "" {
			setSlotAsset("Hat", hID, hName, hURL)
		} else {
			avatarMap["Hat"] = map[string]interface{}{"color": "", "asset": nil}
		}
	} else {
		avatarMap["Hat"] = map[string]interface{}{"color": "", "asset": nil}
	}

	// Update Shoes Slot
	if equippedBoots != nil {
		var sID, sName, sURL string
		switch equippedBoots.ItemID {
		case "leather_boots":
			sID, sName, sURL = "asset_shoes_002", "Leather Boots", "/assets/characters/modular/accessories/Shoes.002.glb"
		default:
			sID, sName, sURL = "asset_shoes_001", "Shoes #1", "/assets/characters/modular/accessories/Shoes.001.glb"
		}
		setSlotAsset("Shoes", sID, sName, sURL)
	} else {
		setSlotAsset("Shoes", "asset_shoes_001", "Shoes #1", "/assets/characters/modular/accessories/Shoes.001.glb")
	}

	// Stringify back
	newJSON, err := json.Marshal(avatarMap)
	if err == nil {
		player.CustomAvatarURL = string(newJSON)
	}
}
