package game

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/looplab/fsm"
	"mmorpg-backend/internal/domain"
	"mmorpg-backend/internal/repository/redis"
)


type GameUsecase interface {
	StartGameLoop(ctx context.Context)
	RegisterPlayer(playerID string, username string)
	UnregisterPlayer(playerID string)
	UpdatePlayerMovement(playerID string, x, y, z, rotation float32, animation string, targetID string)
	HandlePlayerAttack(playerID string, targetType string, targetID string, clientDmg float32, isCrit bool)
	GetStatePayload() domain.GameStatePayload
	SpawnMonster(name string, mType string, x, y, z float32) string
	
	// New RPG Actions
	DistributeStatPoints(playerID string, stat string, amount int)
	EquipPlayerItem(playerID string, playerItemID string)
	UseConsumable(playerID string, playerItemID string)
	CastPlayerSkill(playerID string, skillID string, targetID string)
	ChangeClass(playerID string, newClass string)
}

type gameUsecase struct {
	registry   *domain.Registry
	playerRepo domain.PlayerRepository
	stateRepo  redis.StateRepository
	configRepo domain.ConfigRepository
	
	players    map[string]*domain.PlayerNetworkState
	playersMu  sync.RWMutex
	
	monsters   map[string]*domain.Monster
	monstersMu sync.RWMutex

	activePlayers   map[string]*domain.Player
	activePlayersMu sync.RWMutex

	patrolTargets   map[string]domain.Vector3
	patrolWaiting   map[string]time.Time
	patrolTargetsMu sync.Mutex
	
	fsmMap          map[string]*fsm.FSM
	fsmMu           sync.RWMutex
	
	broadcastCallback func(payload domain.GameStatePayload)
}

func NewGameUsecase(
	registry *domain.Registry,
	playerRepo domain.PlayerRepository,
	stateRepo redis.StateRepository,
	configRepo domain.ConfigRepository,
	broadcastCallback func(payload domain.GameStatePayload),
) GameUsecase {
	u := &gameUsecase{
		registry:          registry,
		playerRepo:        playerRepo,
		stateRepo:         stateRepo,
		configRepo:        configRepo,
		players:           make(map[string]*domain.PlayerNetworkState),
		monsters:          make(map[string]*domain.Monster),
		activePlayers:     make(map[string]*domain.Player),
		patrolTargets:     make(map[string]domain.Vector3),
		patrolWaiting:     make(map[string]time.Time),
		fsmMap:            make(map[string]*fsm.FSM),
		broadcastCallback: broadcastCallback,
	}

	// Pre-spawn some monsters in the world
	u.initMonsters()

	return u
}

func (u *gameUsecase) initMonsters() {
	rand.Seed(time.Now().UnixNano())

	// Fetch all monster configurations from PostgreSQL GORM database
	configs, err := u.configRepo.GetMonsterConfigs()
	if err != nil || len(configs) == 0 {
		fmt.Printf("⚠️ Gagal mengambil konfigurasi monster dari database (atau kosong): %v. Menggunakan fallback spawn!\n", err)
		u.SpawnMonster("Wicked Zombie Queen", "boss", 0.0, 0.0, 10.0)
		u.SpawnMonster("Jelly Slime 1", "slime", -10.0, 0.0, -10.0)
		u.SpawnMonster("Scavenger Goblin 2", "goblin", 15.0, 0.0, -15.0)
		u.SpawnMonster("Orc Vanguard 3", "orc", 10.0, 0.0, 20.0)
		return
	}

	fmt.Printf("🌱 Menghidupkan spawner monster dinamis berdasarkan database GORM (%d tipe terdaftar)...\n", len(configs))

	regularCount := 0
	for _, cfg := range configs {
		if cfg.Type == "boss" {
			// Spawn Legendary Boss at center coordinates
			u.SpawnMonster(cfg.Name, cfg.Type, 0.0, 0.0, 10.0)
			fmt.Printf("👾 Spawned BOSS: %s di posisi center (0.0, 10.0)\n", cfg.Name)
		} else {
			// Spawn 2 to 3 regular instances for each database configuration type
			numSpawns := 2
			if cfg.Type == "slime" || cfg.Type == "default" {
				numSpawns = 3
			}

			for i := 0; i < numSpawns; i++ {
				regularCount++
				angle := float64(rand.Intn(360)) * 3.14159 / 180.0
				radius := float32(10 + rand.Intn(30)) // Spaced 10 to 40 units from center
				x := float32(math.Cos(angle)) * radius
				y := float32(0.0)
				z := float32(math.Sin(angle)) * radius

				name := fmt.Sprintf("%s %d", cfg.Name, i+1)
				u.SpawnMonster(name, cfg.Type, x, y, z)
			}
		}
	}

	fmt.Printf("👾 Total %d monster reguler dan boss dinamis berhasil di-spawn berdasarkan database GORM!\n", regularCount)
}

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

func (u *gameUsecase) SimulateMonstersTick(dt float32) {
	// Snapshot player positions first under short read-lock, then release
	u.playersMu.RLock()
	playerSnapshot := make(map[string]*domain.PlayerNetworkState, len(u.players))
	for id, p := range u.players {
		cp := *p // value copy — safe to read without lock after this
		playerSnapshot[id] = &cp
	}
	u.playersMu.RUnlock()

	// Snapshot monsters list (pointers — mutations below are still guarded by monstersMu)
	u.monstersMu.Lock()
	monsters := make([]*domain.Monster, 0, len(u.monsters))
	for _, m := range u.monsters {
		monsters = append(monsters, m)
	}
	u.monstersMu.Unlock()

	// Process each monster AI with no broad locks held — reads from snapshots
	for _, m := range monsters {
		u.processMonsterAIWithSnapshot(m, dt, playerSnapshot)
	}
}

func (u *gameUsecase) RegisterPlayer(playerID string, username string) {
	u.playersMu.Lock()
	defer u.playersMu.Unlock()

	// 1. Get stats from database once on login/connection
	pData, err := u.playerRepo.GetByID(playerID)
	if err != nil || pData == nil {
		// Create default player row if it doesn't exist
		pData = &domain.Player{
			ID:         playerID,
			Username:   username,
			Class:      "Beginner",
			Gender:     "Male",
			HairStyle:  1,
			HairColor:  "#5A3E2D",
			Level:      1,
			XP:         0,
			Gold:       200,
			STR:        10,
			INT:        10,
			CON:        10,
			VIT:        10,
			WIS:        10,
			LUK:        10,
			StatPoints: 5, // Stat points to distribute
			HP:         1000,
			MaxHP:      1000,
			MP:         200,
			MaxMP:      200,
			MapName:    "Starter Zone",
			LastX:      0,
			LastY:      0,
			LastZ:      0,
			Inventory: []domain.PlayerItem{
				{
					ID:         playerID + "-item-1",
					PlayerID:   playerID,
					ItemID:     "sword_starter",
					Name:       "Wooden Sword",
					Type:       "equipment",
					SlotType:   "weapon",
					Quantity:   1,
					IsEquipped: true,
					SlotIndex:  0,
					AddAttack:  15,
				},
				{
					ID:         playerID + "-item-2",
					PlayerID:   playerID,
					ItemID:     "potion_red",
					Name:       "Red Potion",
					Type:       "consumable",
					SlotIndex:  1,
					Quantity:   5,
					AddHP:      150,
				},
				{
					ID:         playerID + "-item-3",
					PlayerID:   playerID,
					ItemID:     "potion_blue",
					Name:       "Blue Potion",
					Type:       "consumable",
					SlotIndex:  2,
					Quantity:   5,
					AddMP:      50,
				},
			},
			Skills: []domain.PlayerSkill{
				{
					ID:         playerID + "-skill-1",
					PlayerID:   playerID,
					SkillID:    "strike",
					Name:       "Heavy Strike",
					Level:      1,
					Type:       "active",
					ManaCost:   15,
					MaxCD:      3.0,
					Damage:     1.5,
					IsUnlocked: true,
				},
				{
					ID:         playerID + "-skill-2",
					PlayerID:   playerID,
					SkillID:    "heal",
					Name:       "Lesser Heal",
					Level:      1,
					Type:       "active",
					ManaCost:   25,
					MaxCD:      6.0,
					Damage:     120, // Heal HP value
					IsUnlocked: true,
				},
			},
			Quests: []domain.PlayerQuest{
				{
					ID:          playerID + "-quest-1",
					PlayerID:    playerID,
					QuestID:     "quest_goblin",
					Title:       "Defeat Goblins",
					Status:      "active",
					Progress:    0,
					TargetCount: 3,
					RewardGold:  100,
					RewardXP:    150,
				},
			},
		}
		
		// Recalculate stats for correct attributes mapping
		pData.RecalculateStats()
		pData.HP = pData.MaxHP
		pData.MP = pData.MaxMP
		_ = u.playerRepo.Create(pData)
	}

	// Respawn player on reconnect if they logged out dead (HP == 0)
	if pData.HP <= 0 {
		pData.HP = pData.MaxHP
		_ = u.playerRepo.Update(pData)
		fmt.Printf("🛡️ Player %s has been resurrected on login because they were dead.\n", username)
	}

	// 2. Cache player data in memory
	u.activePlayersMu.Lock()
	u.activePlayers[playerID] = pData
	u.activePlayersMu.Unlock()

	// Initial starter state
	state := &domain.PlayerNetworkState{
		ID:        playerID,
		X:         pData.LastX,
		Y:         pData.LastY,
		Z:         pData.LastZ,
		Rotation:  0,
		Animation: "idle",
		Class:     pData.Class,
		Gender:    pData.Gender,
		Username:  pData.Username,
	}
	u.players[playerID] = state

	// Add to ECS Registry
	u.registry.CreateEntity(domain.EntityID(playerID))
	u.registry.AddComponent(domain.EntityID(playerID), &domain.PositionComponent{
		Vector3:   domain.Vector3{X: pData.LastX, Y: pData.LastY, Z: pData.LastZ},
		Rotation:  0,
		Animation: "idle",
	})
	u.registry.AddComponent(domain.EntityID(playerID), &domain.PlayerComponent{
		Username: username,
		Level:    pData.Level,
	})
	u.registry.AddComponent(domain.EntityID(playerID), &domain.HealthComponent{
		HP:    pData.HP,
		MaxHP: pData.MaxHP,
	})

	// Save initial position in Redis cache asynchronously
	go func() {
		_ = u.stateRepo.SavePlayerState(context.Background(), state)
	}()

	fmt.Printf("👤 Player %s (%s) registered and cached in memory!\n", username, playerID)
}

func (u *gameUsecase) UnregisterPlayer(playerID string) {
	u.playersMu.Lock()
	defer u.playersMu.Unlock()

	pState, stateExists := u.players[playerID]
	var lastX, lastY, lastZ float32
	if stateExists && pState != nil {
		lastX = pState.X
		lastY = pState.Y
		lastZ = pState.Z
	}

	delete(u.players, playerID)
	u.registry.DestroyEntity(domain.EntityID(playerID))

	// Clean up Redis position
	go func() {
		_ = u.stateRepo.DeletePlayerState(context.Background(), playerID)
	}()

	// Save final player data to GORM Postgres asynchronously on disconnect
	u.activePlayersMu.Lock()
	if pData, exists := u.activePlayers[playerID]; exists {
		if stateExists {
			pData.LastX = lastX
			pData.LastY = lastY
			pData.LastZ = lastZ
		}
		go func(p *domain.Player) {
			_ = u.playerRepo.Update(p)
		}(pData)
		delete(u.activePlayers, playerID)
	}
	u.activePlayersMu.Unlock()

	fmt.Printf("👤 Player %s left the game world. Final state flushed to DB.\n", playerID)
}

func (u *gameUsecase) GetStatePayload() domain.GameStatePayload {
	// Acquire both locks in a consistent order to avoid deadlock (players first, then monsters)
	u.playersMu.RLock()
	playerStates := make([]domain.PlayerNetworkState, 0, len(u.players))
	for _, p := range u.players {
		playerStates = append(playerStates, *p)
	}
	u.playersMu.RUnlock()

	u.monstersMu.RLock()
	monsterStates := make([]domain.Monster, 0, len(u.monsters))
	for _, m := range u.monsters {
		monsterStates = append(monsterStates, *m)
	}
	u.monstersMu.RUnlock()

	// Sorting removed: game clients don't require sorted state — eliminates alloc per tick
	return domain.GameStatePayload{
		Players:  playerStates,
		Monsters: monsterStates,
	}
}

// DistributeStatPoints allocates user StatPoints to attributes and recalculates
func (u *gameUsecase) DistributeStatPoints(playerID string, stat string, amount int) {
	u.activePlayersMu.Lock()
	playerData, exists := u.activePlayers[playerID]
	if !exists || playerData == nil {
		u.activePlayersMu.Unlock()
		return
	}

	if playerData.StatPoints < amount || amount <= 0 {
		u.activePlayersMu.Unlock()
		return
	}

	switch stat {
	case "str":
		playerData.STR += amount
	case "int":
		playerData.INT += amount
	case "con":
		playerData.CON += amount
	case "vit":
		playerData.VIT += amount
	case "wis":
		playerData.WIS += amount
	case "luk":
		playerData.LUK += amount
	default:
		u.activePlayersMu.Unlock()
		return
	}

	playerData.StatPoints -= amount
	playerData.RecalculateStats()
	u.activePlayersMu.Unlock()

	// Update GORM Postgres DB asynchronously
	go func(p *domain.Player) {
		_ = u.playerRepo.Update(p)
	}(playerData)

	// Sync HP boundaries to ECS registry
	if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
		h := healthComp.(*domain.HealthComponent)
		h.MaxHP = playerData.MaxHP
		if h.HP > playerData.MaxHP {
			h.HP = playerData.MaxHP
		}
	}

	fmt.Printf("💪 Player %s distributed %d points into %s. New values: (STR=%d, INT=%d, CON=%d, VIT=%d, WIS=%d, LUK=%d, StatPoints=%d)\n",
		playerData.Username, amount, stat, playerData.STR, playerData.INT, playerData.CON, playerData.VIT, playerData.WIS, playerData.LUK, playerData.StatPoints)
}

// EquipPlayerItem toggles equipped state on weapons/armors and triggers recalculation
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

	// Sync to DB
	go func(p *domain.Player) {
		_ = u.playerRepo.Update(p)
	}(playerData)

	fmt.Printf("🛡️ Player %s equipped %s into slot %s.\n", playerData.Username, targetItem.Name, slotType)
}

// UseConsumable consumes potions and applies health/mana healing
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

	// Remove item if depleted
	if item.Quantity <= 0 {
		playerData.Inventory = append(playerData.Inventory[:itemIdx], playerData.Inventory[itemIdx+1:]...)
	}

	u.activePlayersMu.Unlock()

	// Sync DB
	go func(p *domain.Player) {
		_ = u.playerRepo.Update(p)
	}(playerData)

	// Update Health in ECS Registry
	if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
		h := healthComp.(*domain.HealthComponent)
		h.HP = playerData.HP
	}

	fmt.Printf("🧪 Player %s used %s (+%.1f HP, +%.1f MP). HP: %.1f/%.1f\n",
		playerData.Username, item.Name, hpHeal, mpHeal, playerData.HP, playerData.MaxHP)
}

// Use targetSkill.Damage value as healing value for Lesser Heal
func (u *gameUsecase) CastPlayerSkill(playerID string, skillID string, targetID string) {
	u.activePlayersMu.Lock()
	playerData, exists := u.activePlayers[playerID]
	u.activePlayersMu.Unlock()
	if !exists || playerData == nil {
		return
	}

	u.playersMu.Lock()
	if pState, exists := u.players[playerID]; exists {
		pState.TargetID = targetID
	}
	u.playersMu.Unlock()

	var targetSkill *domain.PlayerSkill
	for i := range playerData.Skills {
		if playerData.Skills[i].SkillID == skillID {
			targetSkill = &playerData.Skills[i]
			break
		}
	}

	if targetSkill == nil || !targetSkill.IsUnlocked {
		return
	}

	if playerData.HP <= 0 {
		return
	}

	if playerData.MP < float32(targetSkill.ManaCost) {
		fmt.Printf("⚠️ Player %s tidak memiliki cukup MP untuk %s (%d MP)\n", playerData.Username, targetSkill.Name, targetSkill.ManaCost)
		return
	}

	posComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Position")
	if !found {
		return
	}
	playerPos := posComp.(*domain.PositionComponent).Vector3

	// Deduct Mana Cost
	u.activePlayersMu.Lock()
	playerData.MP -= float32(targetSkill.ManaCost)
	u.activePlayersMu.Unlock()

	// 1. Lesser Heal Support logic
	if skillID == "heal" {
		u.activePlayersMu.Lock()
		healPower := targetSkill.Damage
		playerData.HP += healPower
		if playerData.HP > playerData.MaxHP {
			playerData.HP = playerData.MaxHP
		}
		u.activePlayersMu.Unlock()

		// Save DB
		go func(p *domain.Player) {
			_ = u.playerRepo.Update(p)
		}(playerData)

		// Sync HP to ECS
		if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
			h := healthComp.(*domain.HealthComponent)
			h.HP = playerData.HP
		}

		fmt.Printf("✨ Player %s cast %s (+%.1f HP, Cost: %d MP). HP: %.1f/%.1f\n",
			playerData.Username, targetSkill.Name, healPower, targetSkill.ManaCost, playerData.HP, playerData.MaxHP)
		return
	}

	// 2. Damage Active spell attack logic
	u.monstersMu.Lock()
	monster, mExists := u.monsters[targetID]
	if !mExists || monster.IsDead {
		u.monstersMu.Unlock()
		return
	}

	dist := playerPos.DistanceTo(monster.Position)
	if dist > 55.0 {
		u.monstersMu.Unlock()
		fmt.Printf("⚠️ Cast %s gagal: Target %s terlalu jauh (%.2f unit)\n", targetSkill.Name, monster.Name, dist)
		return
	}

	baseAttack := playerData.Attack
	if targetSkill.SkillID == "fireball" {
		baseAttack = playerData.MagicAttack
	}
	skillDamage := baseAttack * targetSkill.Damage

	// MOBA-style percentage damage reduction: 100 / (100 + defense)
	damageMultiplier := float32(100.0) / (100.0 + monster.Defense)
	dmg := skillDamage * damageMultiplier

	// Apply variation +/- 10%
	variation := float32((time.Now().UnixNano() % 20) - 10) / 100.0
	finalDamage := dmg * (1.0 + variation)

	isCrit := false
	if rand.Float32() < playerData.CriticalRate {
		isCrit = true
		finalDamage *= 1.5
	}

	if finalDamage < 1 {
		finalDamage = 1
	}

	// Hard cap — no single hit can exceed 35% of target's max HP like seal-m
	maxHitDmg := monster.MaxHP * 0.35
	if finalDamage > maxHitDmg {
		finalDamage = maxHitDmg
	}

	critLabel := ""
	if isCrit {
		critLabel = "🔥 CRITICAL! "
	}

	fmt.Printf("%s✨ Skill Cast: Player %s -> Monster %s with %s (Damage: %.2f, HP: %.2f/%.2f)\n",
		critLabel, playerData.Username, monster.Name, targetSkill.Name, finalDamage, monster.HP-finalDamage, monster.MaxHP)

	monster.TakeDamage(finalDamage)

	// Sync HP in ECS
	if healthComp, found := u.registry.GetComponent(domain.EntityID(targetID), "Health"); found {
		h := healthComp.(*domain.HealthComponent)
		h.HP = monster.HP
	}

	if monster.IsDead {
		fmt.Printf("💀 Monster %s terbunuh oleh skill %s dari %s! Drop: Gold +%d, XP +%d\n",
			monster.Name, targetSkill.Name, playerData.Username, monster.GoldDrop, monster.XPDrop)
		
		u.activePlayersMu.Lock()
		playerData.XP += monster.XPDrop
		playerData.Gold += monster.GoldDrop

		// Check active Quest Targets progress
		for i := range playerData.Quests {
			q := &playerData.Quests[i]
			if q.QuestID == "quest_goblin" && monster.Type == "goblin" && q.Status == "active" {
				q.Progress++
				if q.Progress >= q.TargetCount {
					q.Progress = q.TargetCount
					q.Status = "completed"
					playerData.Gold += q.RewardGold
					playerData.XP += q.RewardXP
					fmt.Printf("🏆 QUEST COMPLETE: %s! Reward: +%d Gold, +%d XP\n", q.Title, q.RewardGold, q.RewardXP)
				}
			}
		}

		// Handle level up sequence
		xpNeeded := playerData.Level * 100
		if playerData.XP >= xpNeeded {
			playerData.Level++
			playerData.XP -= xpNeeded
			playerData.StatPoints += 5
			playerData.RecalculateStats()
			playerData.HP = playerData.MaxHP
			playerData.MP = playerData.MaxMP
			fmt.Printf("🌟 LEVEL UP! Player %s naik ke level %d! +5 Stat Points!\n", playerData.Username, playerData.Level)
		}
		u.activePlayersMu.Unlock()

		// Save record in DB
		go func(p *domain.Player) {
			_ = u.playerRepo.Update(p)
		}(playerData)

		// Sync player HP boundary to ECS registry
		if pHcomp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
			h := pHcomp.(*domain.HealthComponent)
			h.HP = playerData.HP
			h.MaxHP = playerData.MaxHP
		}
	} else {
		// Save MP consumption
		go func(p *domain.Player) {
			_ = u.playerRepo.Update(p)
		}(playerData)
	}

	u.monstersMu.Unlock()
}

// ChangeClass changes player class and grants starting skill books
func (u *gameUsecase) ChangeClass(playerID string, newClass string) {
	u.activePlayersMu.Lock()
	playerData, exists := u.activePlayers[playerID]
	if !exists || playerData == nil {
		u.activePlayersMu.Unlock()
		return
	}

	validClasses := map[string]bool{"Warrior": true, "Mage": true, "Priest": true, "Thief": true}
	if !validClasses[newClass] || playerData.Class != "Beginner" {
		u.activePlayersMu.Unlock()
		return
	}

	playerData.Class = newClass
	
	switch newClass {
	case "Warrior":
		playerData.STR += 5
		playerData.CON += 5
	case "Mage":
		playerData.INT += 8
		playerData.Skills = append(playerData.Skills, domain.PlayerSkill{
			ID:         playerID + "-skill-fireball",
			PlayerID:   playerID,
			SkillID:    "fireball",
			Name:       "Fireball Strike",
			Level:      1,
			Type:       "active",
			ManaCost:   30,
			MaxCD:      4.0,
			Damage:     2.5, // 250% Magic Attack multiplier
			IsUnlocked: true,
		})
	case "Priest":
		playerData.INT += 5
		playerData.WIS += 5
	case "Thief":
		playerData.LUK += 8
	}

	playerData.RecalculateStats()
	playerData.HP = playerData.MaxHP
	playerData.MP = playerData.MaxMP
	u.activePlayersMu.Unlock()

	// Sync class modification to real-time network states
	u.playersMu.Lock()
	if pState, exists := u.players[playerID]; exists {
		pState.Class = newClass
	}
	u.playersMu.Unlock()

	// Save to DB
	go func(p *domain.Player) {
		_ = u.playerRepo.Update(p)
	}(playerData)

	// Sync to ECS
	if healthComp, found := u.registry.GetComponent(domain.EntityID(playerID), "Health"); found {
		h := healthComp.(*domain.HealthComponent)
		h.MaxHP = playerData.MaxHP
		h.HP = playerData.HP
	}

	fmt.Printf("⚔️ Player %s changed class to %s! Attributes recalculated successfully.\n", playerData.Username, newClass)
}
