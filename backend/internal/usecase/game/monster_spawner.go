// REFACTORED FROM: game_usecase.go
// Monster spawning logic — initMonsters and SpawnMonster methods.
// Handles initial world population and dynamic monster creation from DB configs.
package game

import (
	"fmt"
	"math"
	"math/rand"
	"os"
	"strconv"

	"mmorpg-backend/internal/domain"
)

// initMonsters pre-spawns monsters across the world map using database configurations
func (u *gameUsecase) initMonsters() {
	rand.Seed(0) // Seeded externally in NewGameUsecase; kept for safety

	// Fetch all monster configurations from PostgreSQL GORM database
	configs, err := u.configRepo.GetMonsterConfigs()
	if err != nil || len(configs) == 0 {
		fmt.Printf("⚠️ Gagal mengambil konfigurasi monster dari database (atau kosong): %v. Menggunakan fallback spawn!\n", err)
		u.SpawnMonster("Wicked Zombie Queen", "boss", 0.0, 0.0, 10.0)
		u.SpawnMonster("Jelly Slime", "slime", -25.0, 0.0, -25.0)
		u.SpawnMonster("Wild Boar", "default", 25.0, 0.0, -25.0)
		u.SpawnMonster("Scavenger Goblin", "goblin", -25.0, 0.0, 25.0)
		u.SpawnMonster("Goblin Scout Archer", "goblin_archer", 25.0, 0.0, 25.0)
		u.SpawnMonster("Orc Vanguard", "orc", 0.0, 0.0, -35.0)
		u.SpawnMonster("Elite Goblin Commander", "goblin_chief", -35.0, 0.0, 0.0)
		u.SpawnMonster("Raging Orc Berserker", "orc_berserker", 35.0, 0.0, 0.0)
		u.SpawnMonster("Mystic Orc Shaman", "orc_shaman", 0.0, 0.0, 35.0)
		u.SpawnMonster("Dark Skeleton Soldier", "skeleton", -15.0, 0.0, 15.0)
		return
	}

	fmt.Printf("🌱 Menghidupkan 10 spawner monster dinamis bervariasi berdasarkan database GORM (%d tipe terdaftar)...\n", len(configs))

	// Define 10 distinct coordinates spread across the world map
	spawns := []struct {
		mType string
		x     float32
		z     float32
	}{
		{"boss", 0.0, 10.0},
		{"slime", -25.0, -25.0},
		{"default", 25.0, -25.0},
		{"goblin", -25.0, 25.0},
		{"goblin_archer", 25.0, 25.0},
		{"orc", 0.0, -35.0},
		{"goblin_chief", -35.0, 0.0},
		{"orc_berserker", 35.0, 0.0},
		{"orc_shaman", 0.0, 35.0},
		{"skeleton", -15.0, 15.0},
	}

	// Create a fast lookup map for configs
	configMap := make(map[string]domain.MonsterConfig)
	for _, cfg := range configs {
		configMap[cfg.Type] = cfg
	}

	spawnedCount := 0
	for _, s := range spawns {
		cfg, exists := configMap[s.mType]
		if !exists {
			name := fmt.Sprintf("Monster %s", s.mType)
			u.SpawnMonster(name, s.mType, s.x, 0.0, s.z)
			spawnedCount++
			continue
		}
		u.SpawnMonster(cfg.Name, cfg.Type, s.x, 0.0, s.z)
		spawnedCount++
	}

	// Spawn extra random monsters if requested by env var (for loadtesting monster density)
	if extraEnv := os.Getenv("SPAWN_EXTRA_MONSTERS"); extraEnv != "" {
		if count, err := strconv.Atoi(extraEnv); err == nil && count > 0 {
			monsterNames := []string{"Jelly Slime", "Wild Boar", "Scavenger Goblin", "Dark Skeleton Soldier"}
			monsterTypes := []string{"slime", "default", "goblin", "skeleton"}
			for i := 0; i < count; i++ {
				idx := rand.Intn(len(monsterNames))
				// Random coordinate around [0, 0] within 35 units
				angle := rand.Float64() * 2 * math.Pi
				dist := 5.0 + rand.Float64()*30.0
				rx := float32(dist * math.Cos(angle))
				rz := float32(dist * math.Sin(angle))
				u.SpawnMonster(
					fmt.Sprintf("%s Extra #%d", monsterNames[idx], i+1),
					monsterTypes[idx],
					rx,
					0.0,
					rz,
				)
				spawnedCount++
			}
			fmt.Printf("👾 Spawned %d extra loadtest monsters around spawn area!\n", count)
		}
	}

	fmt.Printf("👾 Total %d monster bervariasi berhasil di-spawn di titik yang berbeda!\n", spawnedCount)
}

// SpawnMonster creates a new monster entity in the world with stats from DB or fallback defaults
func (u *gameUsecase) SpawnMonster(name string, mType string, x, y, z float32) string {
	u.monstersMu.Lock()
	defer u.monstersMu.Unlock()

	id := fmt.Sprintf("monster-%d-%s", len(u.monsters)+1, mType)
	pos := domain.Vector3{X: x, Y: y, Z: z}

	var hp, maxHP, attack, defense, speed, aggro float32
	var level int
	var goldDrop, xpDrop int

	// Dynamically load monster specifications from GORM database!
	cfg, err := u.configRepo.GetMonsterConfig(mType)
	if err == nil && cfg != nil {
		level = cfg.Level
		hp = cfg.HP
		maxHP = cfg.MaxHP
		attack = cfg.Attack
		defense = cfg.Defense
		speed = cfg.Speed
		aggro = cfg.AggroRange
		goldDrop = cfg.GoldDrop
		xpDrop = cfg.XPDrop
	} else {
		// Secure fallback stats if database query fails or is empty
		switch mType {
		case "boss":
			level = 50
			hp, maxHP, attack, defense, speed, aggro = 5000, 5000, 110, 55, 2.5, 26
			goldDrop, xpDrop = 800, 1200
		case "goblin":
			level = 3
			hp, maxHP, attack, defense, speed, aggro = 250, 250, 20, 5, 3.5, 14
			goldDrop, xpDrop = 15, 20
		case "orc":
			level = 7
			hp, maxHP, attack, defense, speed, aggro = 600, 600, 45, 18, 2.8, 18
			goldDrop, xpDrop = 40, 50
		case "slime":
			level = 1
			hp, maxHP, attack, defense, speed, aggro = 100, 100, 8, 2, 1.8, 10
			goldDrop, xpDrop = 5, 8
		default:
			level = 2
			hp, maxHP, attack, defense, speed, aggro = 200, 200, 15, 4, 3.0, 14
			goldDrop, xpDrop = 10, 15
		}
	}

	monster := &domain.Monster{
		ID:            id,
		Name:          name,
		Type:          mType,
		Level:         level,
		Position:      pos,
		SpawnPosition: pos,
		HP:            hp,
		MaxHP:         maxHP,
		Attack:        attack,
		Defense:       defense,
		Speed:         speed,
		AggroRange:    aggro,
		IsDead:        false,
		GoldDrop:      goldDrop,
		XPDrop:        xpDrop,
	}

	u.monsters[id] = monster

	// Also register into ECS Registry
	u.registry.CreateEntity(domain.EntityID(id))
	u.registry.AddComponent(domain.EntityID(id), &domain.PositionComponent{
		Vector3:   pos,
		Rotation:  0,
		Animation: "idle",
	})
	u.registry.AddComponent(domain.EntityID(id), &domain.HealthComponent{
		HP:    hp,
		MaxHP: maxHP,
	})
	u.registry.AddComponent(domain.EntityID(id), &domain.MonsterComponent{
		MonsterType: mType,
		AggroRange:  aggro,
		Speed:       speed,
		TargetID:    "",
		IsDead:      false,
	})

	return id
}
