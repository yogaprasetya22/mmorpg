package postgres

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/gorm"
	"mmorpg-backend/internal/domain"
)

// SeedConfigurations populates the database with initial configurations from the constants file if empty
func SeedConfigurations(db *gorm.DB) error {
	// 1. Seed ClassConfigs
	var classCount int64
	if err := db.Model(&domain.ClassConfig{}).Count(&classCount).Error; err != nil {
		return err
	}

	if classCount == 0 {
		fmt.Println("🌱 Seeding default class balance configurations into database...")
		defaultClasses := []domain.ClassConfig{
			{
				ID:                 "fighter",
				HP:                 8.5,
				HPRegen:            0.22,
				ATK:                2.8,
				PhysicalDefense:    65,
				MagicDefense:       45,
				PhysicalPen:        15,
				MagicPen:           0,
				Lifesteal:          0.15,
				SpellVamp:          0.05,
				MoveSpeedMult:      1.1,
				AttackSpeedMult:    1.2,
				CritChance:         0.2,
				CritDamage:         2.2,
				Range:              4.5,
				Tenacity:           0.25,
				CooldownReduction:  0.1,
				SkillCooldown:      6000,
				SkillRange:         4.0,
				SkillDuration:      2500,
				AISeparation:       1.0,
				AIEncirclement:     1.2,
				AISwagger:          0.2,
				AIPerceptionRadius: 3600,
				AIChaseRange:       10.0,
			},
			{
				ID:                 "tank",
				HP:                 12.5,
				HPRegen:            0.45,
				ATK:                1.5,
				PhysicalDefense:    110,
				MagicDefense:       95,
				PhysicalPen:        0,
				MagicPen:           0,
				Lifesteal:          0.0,
				SpellVamp:          0.0,
				MoveSpeedMult:      1.0,
				AttackSpeedMult:    0.85,
				CritChance:         0.05,
				CritDamage:         1.5,
				Range:              4.0,
				Tenacity:           0.6,
				CooldownReduction:  0.2,
				SkillCooldown:      25000,
				SkillRange:         0.0,
				SkillDuration:      4000,
				AISeparation:       1.5,
				AIEncirclement:     1.0,
				AISwagger:          0.1,
				AIPerceptionRadius: 2500,
				AIChaseRange:       6.0,
			},
			{
				ID:                 "mage",
				HP:                 3.8,
				HPRegen:            0.1,
				ATK:                5.2,
				PhysicalDefense:    15,
				MagicDefense:       45,
				PhysicalPen:        0,
				MagicPen:           45,
				Lifesteal:          0.0,
				SpellVamp:          0.35,
				MoveSpeedMult:      0.9,
				AttackSpeedMult:    0.45,
				CritChance:         0.1,
				CritDamage:         2.0,
				Range:              15.0,
				Tenacity:           0.0,
				CooldownReduction:  0.15,
				SkillCooldown:      7500,
				SkillRange:         12.0,
				SkillDuration:      3000,
				AISeparation:       2.5,
				AIEncirclement:     1.5,
				AISwagger:          0.4,
				AIPerceptionRadius: 7225,
				AIChaseRange:       18.0,
			},
			{
				ID:                 "marksman",
				HP:                 3.2,
				HPRegen:            0.08,
				ATK:                2.8,
				PhysicalDefense:    25,
				MagicDefense:       25,
				PhysicalPen:        25,
				MagicPen:           0,
				Lifesteal:          0.25,
				SpellVamp:          0.0,
				MoveSpeedMult:      1.05,
				AttackSpeedMult:    1.6,
				CritChance:         0.45,
				CritDamage:         2.8,
				Range:              12.0,
				Tenacity:           0.0,
				CooldownReduction:  0.1,
				SkillCooldown:      22000,
				SkillRange:         10.0,
				SkillDuration:      4500,
				AISeparation:       2.8,
				AIEncirclement:     1.0,
				AISwagger:          0.3,
				AIPerceptionRadius: 8100,
				AIChaseRange:       12.0,
			},
			{
				ID:                 "assassin",
				HP:                 4.5,
				HPRegen:            0.15,
				ATK:                5.5,
				PhysicalDefense:    70,
				MagicDefense:       70,
				PhysicalPen:        45,
				MagicPen:           0,
				Lifesteal:          2.5,
				SpellVamp:          1.5,
				MoveSpeedMult:      1.4,
				AttackSpeedMult:    1.4,
				CritChance:         0.4,
				CritDamage:         4.0,
				Range:              4.0,
				Tenacity:           0.15,
				CooldownReduction:  0.25,
				SkillCooldown:      1200,
				SkillRange:         20.0,
				SkillDuration:      800,
				AISeparation:       1.2,
				AIEncirclement:     2.2,
				AISwagger:          1.0,
				AIPerceptionRadius: 150,
				AIChaseRange:       180,
			},
			{
				ID:                 "enemy_grunt",
				HP:                 5.0,
				HPRegen:            0.1,
				ATK:                2.0,
				PhysicalDefense:    30,
				MagicDefense:       30,
				PhysicalPen:        5,
				MagicPen:           0,
				Lifesteal:          0,
				SpellVamp:          0,
				MoveSpeedMult:      1.4, // FIX: Synced with frontend constants
				AttackSpeedMult:    1.2, // FIX: Snappier attacks
				CritChance:         0.1,
				CritDamage:         1.5,
				Range:              4.5,
				Tenacity:           0.1,
				CooldownReduction:  0,
				SkillCooldown:      8000,
				SkillRange:         4.5,
				SkillDuration:      1000,
				AISeparation:       1.5,
				AIEncirclement:     1.0,
				AISwagger:          0.8,
				AIPerceptionRadius: 6400,
				AIChaseRange:       15.0,
			},
			{
				ID:                 "enemy_boss",
				HP:                 40.0,
				HPRegen:            0.5,
				ATK:                6.0,
				PhysicalDefense:    120,
				MagicDefense:       120,
				PhysicalPen:        20,
				MagicPen:           0,
				Lifesteal:          0.1,
				SpellVamp:          0,
				MoveSpeedMult:      0.8, // FIX: Slightly faster boss
				AttackSpeedMult:    0.8, // FIX: Slightly faster attacks
				CritChance:         0.3,
				CritDamage:         2.0,
				Range:              6.0,
				Tenacity:           0.8,
				CooldownReduction:  0,
				SkillCooldown:      15000,
				SkillRange:         8.0,
				SkillDuration:      2500,
				AISeparation:       2.5,
				AIEncirclement:     0.5,
				AISwagger:          0.2,
				AIPerceptionRadius: 14400,
				AIChaseRange:       25.0,
			},
		}

		for _, cc := range defaultClasses {
			if err := db.Create(&cc).Error; err != nil {
				return fmt.Errorf("failed to seed class %s: %w", cc.ID, err)
			}
		}
		fmt.Println("✅ Success: Class configurations seeded!")
	}

	// 2. Seed SimulationSettings
	var settingsCount int64
	if err := db.Model(&domain.SimulationSetting{}).Count(&settingsCount).Error; err != nil {
		return err
	}

	if settingsCount == 0 {
		fmt.Println("🌱 Seeding default global simulation settings into database...")
		defaultSettings := domain.SimulationSetting{
			ID:                     "default",
			GlobalHpMultiplier:     1.0,
			GlobalSpeedMultiplier:   2.0,  // FIX: Synced with frontend constants
			GlobalDamageMultiplier:  1.8,  // FIX: Reduced from 2.4 to prevent 1-hit kills
			GlobalAttackCooldown:   1200, // FIX: Snappier combat
			CritChance:             0.55,
			PerceptionRadiusSq:     3600,
			SeparationRadius:       0.95,
			SeparationStrength:     0.08,
			EncirclementRadius:     0.75,
			EncirclementJitter:     0.15,
			RotationSmoothing:      0.12,
			LaneSwaggerAmp:         0.25,
			VictoryPauseMs:         650,
			LanePenalty:            800,
			BaseProximityBonus:     8000,
			BaseDefenseThreshold:   8,
			BaseAttackResponseBonus: 30000,
			BossPriorityBonus:      15000,
			LowHpBonus:             4000,
			LaneSpringFar:          0.7,
			LaneSpringNear:         0.4,
			LaneDriftThreshold:     2.0,
			TimeScale:              1.0,
			UnitScale:              0.5,
			VfxIntensity:           1.0,
			MaxUnits:               20,
			PotatoMode:             false,
			ActiveMapID:            "Starter Zone",
		}

		if err := db.Create(&defaultSettings).Error; err != nil {
			return fmt.Errorf("failed to seed default settings: %w", err)
		}
		fmt.Println("✅ Success: Global simulation settings seeded!")
	}

	// 3. Seed MonsterConfigs
	var monsterCount int64
	if err := db.Model(&domain.MonsterConfig{}).Count(&monsterCount).Error; err != nil {
		return err
	}

	if monsterCount == 0 {
		fmt.Println("🌱 Seeding default monster configs into database...")
		defaultMonsters := []domain.MonsterConfig{
			{
				Type:       "slime",
				Name:       "Jelly Slime",
				Level:      1,
				HP:         120,
				MaxHP:      120,
				Attack:     10,
				Defense:    3,
				Speed:      1.8,
				AggroRange: 10,
				GoldDrop:   6,
				XPDrop:     10,
			},
			{
				Type:       "default",
				Name:       "Wild Boar",
				Level:      2,
				HP:         220,
				MaxHP:      220,
				Attack:     18,
				Defense:    6,
				Speed:      3.0,
				AggroRange: 12,
				GoldDrop:   12,
				XPDrop:     18,
			},
			{
				Type:       "goblin",
				Name:       "Scavenger Goblin",
				Level:      3,
				HP:         280,
				MaxHP:      280,
				Attack:     25,
				Defense:    8,
				Speed:      3.4,
				AggroRange: 13,
				GoldDrop:   18,
				XPDrop:     25,
			},
			{
				Type:       "goblin_archer",
				Name:       "Goblin Scout Archer",
				Level:      5,
				HP:         450,
				MaxHP:      450,
				Attack:     38,
				Defense:    14,
				Speed:      2.8,
				AggroRange: 15,
				GoldDrop:   30,
				XPDrop:     40,
			},
			{
				Type:       "orc",
				Name:       "Orc Vanguard",
				Level:      7,
				HP:         700,
				MaxHP:      700,
				Attack:     55,
				Defense:    22,
				Speed:      2.8,
				AggroRange: 14,
				GoldDrop:   45,
				XPDrop:     60,
			},
			{
				Type:       "goblin_chief",
				Name:       "Elite Goblin Commander",
				Level:      10,
				HP:         1200,
				MaxHP:      1200,
				Attack:     85,
				Defense:    32,
				Speed:      2.6,
				AggroRange: 16,
				GoldDrop:   95,
				XPDrop:     120,
			},
			{
				Type:       "orc_berserker",
				Name:       "Raging Orc Berserker",
				Level:      12,
				HP:         1900,
				MaxHP:      1900,
				Attack:     145,
				Defense:    55,
				Speed:      2.5,
				AggroRange: 15,
				GoldDrop:   120,
				XPDrop:     180,
			},
			{
				Type:       "orc_shaman",
				Name:       "Mystic Orc Shaman",
				Level:      15,
				HP:         1600,
				MaxHP:      1600,
				Attack:     195,
				Defense:    45,
				Speed:      2.1,
				AggroRange: 18,
				GoldDrop:   180,
				XPDrop:     260,
			},
			{
				Type:       "skeleton",
				Name:       "Dark Skeleton Soldier",
				Level:      20,
				HP:         3000,
				MaxHP:      3000,
				Attack:     280,
				Defense:    110,
				Speed:      2.3,
				AggroRange: 16,
				GoldDrop:   350,
				XPDrop:     480,
			},
			{
				Type:       "boss",
				Name:       "Wicked Zombie Queen",
				Level:      50,
				HP:         25000,
				MaxHP:      25000,
				Attack:     1250,
				Defense:    420,
				Speed:      2.4,
				AggroRange: 25,
				GoldDrop:   2500,
				XPDrop:     5000,
			},
		}

		for _, m := range defaultMonsters {
			if err := db.Create(&m).Error; err != nil {
				return fmt.Errorf("failed to seed monster config %s: %w", m.Type, err)
			}
		}
		fmt.Println("✅ Success: Monster configurations seeded!")
	}

	// 4. Seed MapConfig for "Starter Zone"
	var mapCount int64
	if err := db.Model(&domain.MapConfig{}).Count(&mapCount).Error; err != nil {
		return err
	}
	if mapCount == 0 {
		fmt.Println("🌱 Seeding default Starter Zone map config...")
		starterMap := domain.MapConfig{
			ID:                "Starter Zone",
			Name:              "Starter Zone",
			GridSize:          1.0,
			GridEnabled:       true,
			TerrainHeight:     12.0,
			TerrainScale:      0.05,
			TerrainSeed:       0,
			TerrainSharpness:  2.0,
			TerrainMaterialID: "",
			TerrainColor:      "#3d5c36",
			Sky:               "sunset",
			Environment:       "STORM",
		}
		if err := db.Create(&starterMap).Error; err != nil {
			return fmt.Errorf("failed to seed starter map: %w", err)
		}
		fmt.Println("✅ Success: Starter Zone map configuration seeded!")
	}

	// 5. Seed Dynamic Assets
	if err := SeedAssets(db); err != nil {
		return err
	}

	return nil
}

func SeedAssets(db *gorm.DB) error {
	fmt.Println("🌱 Scanning and seeding dynamic environment assets...")

	// Target folders and their categories
	targets := []struct {
		dir      string
		category string
	}{
		{"asset-enverement", "env"},
		{"assets-env", "env"},
		{"assets-tree", "tree"},
		{"kingdom", "kingdom"},
	}

	// Find the correct base path (handling running from root or from cmd/server or cmd/seeder)
	basePaths := []string{
		"./assets-model",
		"../assets-model",
		"../../assets-model",
		"./backend/assets-model",
	}

	var assetsModelPath string
	for _, bp := range basePaths {
		if fi, err := os.Stat(bp); err == nil && fi.IsDir() {
			assetsModelPath = bp
			break
		}
	}

	if assetsModelPath == "" {
		fmt.Println("⚠️  Warning: assets-model directory not found, skipping asset scraping.")
		return nil
	}

	var seededCount int
	for _, target := range targets {
		dirPath := filepath.Join(assetsModelPath, target.dir)
		if fi, err := os.Stat(dirPath); err != nil || !fi.IsDir() {
			fmt.Printf("⚠️  Skipping missing directory: %s\n", dirPath)
			continue
		}

		err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".glb") {
				// Get relative path from assets-model root
				rel, err := filepath.Rel(assetsModelPath, path)
				if err != nil {
					return err
				}
				rel = filepath.ToSlash(rel)
				webPath := "/assets-model/" + rel

				// Format the name: remove extension and replace dashes/underscores with spaces
				nameWithoutExt := strings.TrimSuffix(info.Name(), filepath.Ext(info.Name()))
				prettifiedName := strings.Title(strings.ReplaceAll(strings.ReplaceAll(nameWithoutExt, "-", " "), "_", " "))

				// Save or update in database
				var existing domain.Asset
				err = db.Where("path = ?", webPath).First(&existing).Error
				if err != nil {
					if err == gorm.ErrRecordNotFound {
						// Create new asset
						newAsset := domain.Asset{
							Name:     prettifiedName,
							Path:     webPath,
							Category: target.category,
						}
						if err := db.Create(&newAsset).Error; err == nil {
							seededCount++
						}
					}
				} else {
					// Update existing asset properties
					existing.Name = prettifiedName
					existing.Category = target.category
					db.Save(&existing)
				}
			}
			return nil
		})
		if err != nil {
			return fmt.Errorf("failed walking directory %s: %w", target.dir, err)
		}
	}

	fmt.Printf("✅ Success: Scraped and seeded %d dynamic assets to PostgreSQL database!\n", seededCount)
	return nil
}
