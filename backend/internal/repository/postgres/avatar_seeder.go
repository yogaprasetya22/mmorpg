package postgres

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
	"mmorpg-backend/internal/domain"
)

// SeedAvatarData populates avatar_categories and avatar_assets tables with character customization data
func SeedAvatarData(db *gorm.DB) error {
	// Check if avatar data already exists
	var catCount int64
	db.Model(&domain.AvatarCategory{}).Count(&catCount)
	if catCount > 0 {
		fmt.Println("ℹ️  Avatar configurator data already populated. Skipping seeding.")
		return nil
	}

	fmt.Println("🌱 Seeding avatar configurator categories and assets...")

	// 1. Define categories
	categories := []domain.AvatarCategory{
		{
			ID: "cat_head", Name: "Head", Position: 1, Removable: false, StartingAsset: "asset_head_001",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#f5c6a5", "#e5b695", "#dbac8c", "#c69677", "#a17255", "#704831"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.01, 1.45, 1.0}, Target: []float64{0.0, 1.45, 0.0}},
			},
		},
		{
			ID: "cat_hair", Name: "Hair", Position: 2, Removable: true, StartingAsset: "asset_hair_001",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#2d2d2d", "#5c3d2e", "#8c6239", "#c69c6d", "#f26d5b", "#efc050", "#4ca64c", "#4c80a6", "#9966cc"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.01, 1.45, 1.0}, Target: []float64{0.0, 1.45, 0.0}},
			},
		},
		{
			ID: "cat_eyes", Name: "Eyes", Position: 3, Removable: false, StartingAsset: "asset_eyes_001",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#3c6285", "#517c5b", "#6a5342", "#8b5239", "#4c4c4c", "#945695"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.01, 1.48, 0.7}, Target: []float64{0.0, 1.48, 0.0}},
			},
		},
		{
			ID: "cat_eyebrow", Name: "EyeBrow", Position: 4, Removable: false, StartingAsset: "asset_eyebrow_001",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#2d2d2d", "#5c3d2e", "#8c6239", "#c69c6d"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.01, 1.49, 0.6}, Target: []float64{0.0, 1.49, 0.0}},
			},
		},
		{
			ID: "cat_nose", Name: "Nose", Position: 5, Removable: false, StartingAsset: "asset_nose_004",
			Expand: domain.AvatarExpand{
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.01, 1.45, 0.7}, Target: []float64{0.0, 1.45, 0.0}},
			},
		},
		{
			ID: "cat_facialhair", Name: "FacialHair", Position: 6, Removable: true, StartingAsset: "",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#2d2d2d", "#5c3d2e", "#8c6239", "#c69c6d"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.01, 1.40, 0.8}, Target: []float64{0.0, 1.40, 0.0}},
			},
		},
		{
			ID: "cat_outfit", Name: "Outfit", Position: 7, Removable: true, StartingAsset: "asset_outfit_001",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#4a6fa5", "#d62828", "#f77f00", "#fcbf49", "#eae2b7", "#31572c", "#4f5d75", "#2d3142"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.5, 1.0, 2.2}, Target: []float64{0.0, 1.0, 0.0}},
			},
		},
		{
			ID: "cat_top", Name: "Top", Position: 8, Removable: false, StartingAsset: "asset_top_001",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#4a6fa5", "#d62828", "#f77f00", "#fcbf49", "#eae2b7", "#31572c", "#4f5d75", "#2d3142"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.5, 1.1, 1.8}, Target: []float64{0.0, 1.1, 0.0}},
			},
		},
		{
			ID: "cat_bottom", Name: "Bottom", Position: 9, Removable: false, StartingAsset: "asset_bottom_001",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#4a6fa5", "#d62828", "#f77f00", "#fcbf49", "#eae2b7", "#31572c", "#4f5d75", "#2d3142"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.5, 0.7, 1.5}, Target: []float64{0.0, 0.7, 0.0}},
			},
		},
		{
			ID: "cat_shoes", Name: "Shoes", Position: 10, Removable: false, StartingAsset: "asset_shoes_001",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#1a1a1a", "#d62828", "#eae2b7", "#31572c", "#ffffff"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.4, 0.15, 1.2}, Target: []float64{0.0, 0.15, 0.0}},
			},
		},
		{
			ID: "cat_hat", Name: "Hat", Position: 11, Removable: true, StartingAsset: "",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#d62828", "#f77f00", "#fcbf49", "#eae2b7", "#31572c", "#1a1a1a", "#ffffff"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.01, 1.6, 1.2}, Target: []float64{0.0, 1.45, 0.0}},
			},
		},
		{
			ID: "cat_glasses", Name: "Glasses", Position: 12, Removable: true, StartingAsset: "",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#1a1a1a", "#d62828", "#fcbf49", "#31572c", "#ffffff"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.01, 1.48, 0.7}, Target: []float64{0.0, 1.48, 0.0}},
			},
		},
		{
			ID: "cat_earrings", Name: "Earrings", Position: 13, Removable: true, StartingAsset: "",
			Expand: domain.AvatarExpand{
				ColorPalette:    &domain.AvatarColorPalette{Colors: []string{"#fcbf49", "#eae2b7", "#ffffff", "#1a1a1a"}},
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.01, 1.46, 0.6}, Target: []float64{0.0, 1.45, 0.0}},
			},
		},
		{
			ID: "cat_weapon", Name: "Weapon", Position: 14, Removable: true, StartingAsset: "asset_weapon_sword",
			Expand: domain.AvatarExpand{
				CameraPlacement: &domain.AvatarCameraPlacement{Position: []float64{-0.6, 0.9, 1.8}, Target: []float64{0.0, 0.9, 0.0}},
			},
		},
	}

	for _, cat := range categories {
		if err := db.Create(&cat).Error; err != nil {
			return fmt.Errorf("failed to seed avatar category %s: %w", cat.Name, err)
		}
	}

	// 2. Define customization assets (auto-generated from GLB files)
	assetMappings := []struct {
		Category string
		Prefix   string
		Count    int
	}{
		{"cat_head", "Head", 4},
		{"cat_hair", "Hair", 11},
		{"cat_eyes", "Eyes", 12},
		{"cat_eyebrow", "EyeBrow", 10},
		{"cat_nose", "Nose", 4},
		{"cat_facialhair", "FacialHair", 7},
		{"cat_outfit", "Outfit", 4},
		{"cat_top", "Top", 3},
		{"cat_bottom", "Bottom", 3},
		{"cat_shoes", "Shoes", 3},
		{"cat_hat", "Hat", 7},
		{"cat_glasses", "Glasses", 4},
		{"cat_earrings", "Earring", 6},
	}

	for _, mapping := range assetMappings {
		for i := 1; i <= mapping.Count; i++ {
			assetID := fmt.Sprintf("asset_%s_%03d", strings.ToLower(mapping.Prefix), i)
			filename := fmt.Sprintf("%s.%03d.glb", mapping.Prefix, i)
			assetName := fmt.Sprintf("%s #%d", mapping.Prefix, i)
			// Determine subfolder by prefix
			var subfolder string
			switch mapping.Prefix {
			case "Head", "FaceMask", "PumpkinHead":
				subfolder = "heads"
			case "Hair", "Hat":
				subfolder = "hair_and_hats"
			case "Eyes", "EyeBrow", "Nose", "FacialHair":
				subfolder = "faces"
			case "Top", "Outfit", "WawaDress":
				subfolder = "tops"
			case "Bottom":
				subfolder = "bottoms"
			case "Earring", "Glasses", "Shoes":
				subfolder = "accessories"
			default:
				subfolder = "heads"
			}
			thumbnail := fmt.Sprintf("/assets/characters/thumbnails/%s.%03d.png", mapping.Prefix, i)

			// Special thumbnail overrides
			if mapping.Prefix == "Hat" && i == 7 {
				thumbnail = "/assets/characters/thumbnails/thumbnail_crown.png"
			} else if mapping.Prefix == "Outfit" && i == 1 {
				thumbnail = "/assets/characters/thumbnails/thumbnail_bunny.png"
			} else if mapping.Prefix == "Outfit" && i == 2 {
				thumbnail = "/assets/characters/thumbnails/thumbnail_wawadress.png"
			}

			// Define locked groups (assets that hide other categories when equipped)
			var lockedGroups domain.AvatarStringArray = []string{}
			if mapping.Prefix == "Hat" {
				lockedGroups = []string{"cat_hair"}
			} else if mapping.Prefix == "Outfit" {
				lockedGroups = []string{"cat_top", "cat_bottom"}
			}

			asset := domain.AvatarAsset{
				ID:           assetID,
				Name:         assetName,
				Group:        mapping.Category,
				LockedGroups: lockedGroups,
				URL:          fmt.Sprintf("/assets/characters/modular/%s/%s", subfolder, filename),
				Thumbnail:    thumbnail,
			}

			if err := db.Create(&asset).Error; err != nil {
				return fmt.Errorf("failed to seed avatar asset %s: %w", asset.Name, err)
			}
		}
	}

	// 3. Seed special assets
	specialAssets := []domain.AvatarAsset{
		{
			ID: "asset_special_wawadress", Name: "Wawa Dress Special", Group: "cat_outfit",
			LockedGroups: []string{"cat_top", "cat_bottom"},
			URL: "/assets/characters/modular/tops/WawaDress.glb", Thumbnail: "/assets/characters/thumbnails/thumbnail_wawadress.png",
		},
		{
			ID: "asset_special_facemask", Name: "Face Mask Accessory", Group: "cat_glasses",
			LockedGroups: []string{},
			URL: "/assets/characters/modular/heads/FaceMask.glb", Thumbnail: "/assets/characters/thumbnails/FaceMask.png",
		},
		{
			ID: "asset_special_pumpkin", Name: "Pumpkin Head Special", Group: "cat_hat",
			LockedGroups: []string{"cat_hair", "cat_glasses", "cat_earrings"},
			URL: "/assets/characters/modular/heads/PumpkinHead.glb", Thumbnail: "/assets/characters/thumbnails/PumpkinHead.png",
		},
	}

	for _, spec := range specialAssets {
		if err := db.Create(&spec).Error; err != nil {
			return fmt.Errorf("failed to seed special avatar asset %s: %w", spec.Name, err)
		}
	}

	// 4. Seed weapon assets
	weapons := []struct {
		ID, Name, Filename, Thumbnail string
	}{
		{"asset_weapon_sword", "Sword", "Sword.glb", "Sword.png"},
		{"asset_weapon_scythe", "Battle Scythe", "Battle_Scythe.glb", "Battle_Scythe.png"},
		{"asset_weapon_hammer", "Battle Hammer", "Battle_Hammer.glb", "Battle_Hammer.png"},
		{"asset_weapon_bow", "Battle Bow", "Battle_Bow.glb", "Battle_Bow.png"},
		{"asset_weapon_axe", "Battle Axe", "Battle_Axe.glb", "Battle_Axe.png"},
		{"asset_weapon_arrow", "Arrow", "Arrow.glb", "Arrow.png"},
	}

	for _, w := range weapons {
		asset := domain.AvatarAsset{
			ID:           w.ID,
			Name:         w.Name,
			Group:        "cat_weapon",
			LockedGroups: domain.AvatarStringArray{},
			URL:          fmt.Sprintf("/assets/items/weapons/%s", w.Filename),
			Thumbnail:    fmt.Sprintf("/assets/characters/thumbnails/%s", w.Thumbnail),
		}
		if err := db.Create(&asset).Error; err != nil {
			return fmt.Errorf("failed to seed weapon avatar asset %s: %w", w.Name, err)
		}
	}

	fmt.Println("✅ Success: Avatar configurator data seeded!")
	return nil
}
