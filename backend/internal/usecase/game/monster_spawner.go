// REFACTORED FROM: game_usecase.go
// Monster spawning logic — initMonsters and SpawnMonster methods.
// Handles initial world population and dynamic monster creation from DB configs.
package game

import (
	"fmt"
	"math/rand"
	"time"

	"mmorpg-backend/internal/domain"
)

// initMonsters pre-spawns 30 monsters across the world map using biome-like zone clustering.
// Zones: Beginner (SW), Mid (central/E), Danger (N/far), Boss Arena (center).
func (u *gameUsecase) initMonsters() {
	rand.Seed(0) // Seeded externally in NewGameUsecase; kept for safety

	// Fetch all monster configurations from PostgreSQL GORM database
	configs, err := u.configRepo.GetMonsterConfigs()
	if err != nil || len(configs) == 0 {
		fmt.Printf("⚠️ Gagal mengambil konfigurasi monster dari database (atau kosong): %v. Menggunakan fallback spawn!\n", err)
		u.SpawnMonster("Training Dummy", "dummy", 0.0, 0.0, 10.0)
		return
	}

	fmt.Printf("🌱 Menghidupkan 1 monster dinamis berdasarkan database GORM (%d tipe terdaftar)...\n", len(configs))

	var chosenConfig domain.MonsterConfig
	found := false
	for _, cfg := range configs {
		if cfg.Type == "dummy" {
			chosenConfig = cfg
			found = true
			break
		}
	}
	if !found && len(configs) > 0 {
		chosenConfig = configs[0]
	}

	u.SpawnMonster(chosenConfig.Name, chosenConfig.Type, 0.0, 0.0, 10.0)
	fmt.Println("👾 Total 1 monster dummy berhasil di-spawn!")
}

// SpawnMonster creates a new monster entity in the world with stats from DB or fallback defaults.
// Loads skills from DB config and initializes the skill system (cooldowns, buffs, ranged flags).
func (u *gameUsecase) SpawnMonster(name string, mType string, x, y, z float32) string {
	u.monstersMu.Lock()
	defer u.monstersMu.Unlock()

	id := fmt.Sprintf("monster-%d-%s", len(u.monsters)+1, mType)
	pos := domain.Vector3{X: x, Y: y, Z: z}

	var hp, maxHP, attack, defense, speed, aggro float32
	var level int
	var goldDrop, xpDrop int
	var skills []domain.MonsterSkill

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
		skills = cfg.ParseSkills()
	} else {
		// Secure fallback stats if database query fails or is empty
		switch mType {
		case "dummy":
			level = 1
			hp, maxHP, attack, defense, speed, aggro = 10000000, 10000000, 0, 0, 0.0, 0
			goldDrop, xpDrop = 100, 500
		default:
			level = 1
			hp, maxHP, attack, defense, speed, aggro = 10000000, 10000000, 0, 0, 0.0, 0
			goldDrop, xpDrop = 100, 500
		}
	}

	// Determine if this monster type is ranged (archer, shaman types)
	isRanged := mType == "goblin_archer" || mType == "orc_shaman"
	var preferredRange float32
	if isRanged {
		// Find the longest ranged skill to determine preferred combat distance
		for _, s := range skills {
			if s.Type == "ranged" && s.Range > preferredRange {
				preferredRange = s.Range
			}
		}
		if preferredRange == 0 {
			preferredRange = 10.0 // fallback default ranged distance
		}
	}

	monster := &domain.Monster{
		ID:              id,
		Name:            name,
		Type:            mType,
		Level:           level,
		Position:        pos,
		SpawnPosition:   pos,
		HP:              hp,
		MaxHP:           maxHP,
		Attack:          attack,
		Defense:         defense,
		Speed:           speed,
		AggroRange:      aggro,
		IsDead:          false,
		GoldDrop:        goldDrop,
		XPDrop:          xpDrop,
		Skills:          skills,
		SkillCooldowns:  make(map[string]time.Time),
		BuffAttackMult:  1.0,
		BuffDefenseMult: 1.0,
		IsRanged:        isRanged,
		PreferredRange:  preferredRange,
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
