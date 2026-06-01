// REFACTORED FROM: player.go
// PlayerQuest domain model + quest templates + quest generation logic.
// Separated from player.go to follow Single Responsibility Principle.
package domain

import (
	"math/rand"
	"time"
)

// PlayerQuest represents quests accepted by the player character
type PlayerQuest struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	PlayerID    string    `json:"player_id" gorm:"index;not null"`
	QuestID     string    `json:"quest_id" gorm:"not null"`
	Title       string    `json:"title" gorm:"not null"`
	Status      string    `json:"status" gorm:"default:'active'"` // active, completed, failed
	Progress    int       `json:"progress" gorm:"default:0"`
	TargetCount int       `json:"target_count" gorm:"default:0"`
	RewardGold  int       `json:"reward_gold" gorm:"default:0"`
	RewardXP    int       `json:"reward_xp" gorm:"default:0"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// QuestTemplate defines a blueprint for daily quest generation
type QuestTemplate struct {
	QuestID     string
	Title       string
	MonsterType string
	MinLevel    int
	TargetCount int
	RewardGold  int
	RewardXP    int
}

// DailyQuestTemplates contains all available daily quest blueprints
var DailyQuestTemplates = []QuestTemplate{
	{
		QuestID:     "quest_slime",
		Title:       "Slime Purge",
		MonsterType: "slime",
		MinLevel:    1,
		TargetCount: 5,
		RewardGold:  60,
		RewardXP:    100,
	},
	{
		QuestID:     "quest_boar",
		Title:       "Boar Hunter",
		MonsterType: "default",
		MinLevel:    1,
		TargetCount: 4,
		RewardGold:  80,
		RewardXP:    150,
	},
	{
		QuestID:     "quest_goblin",
		Title:       "Goblin Menace",
		MonsterType: "goblin",
		MinLevel:    1,
		TargetCount: 3,
		RewardGold:  100,
		RewardXP:    200,
	},
	{
		QuestID:     "quest_goblin_archer",
		Title:       "Scout Cleanout",
		MonsterType: "goblin_archer",
		MinLevel:    4,
		TargetCount: 4,
		RewardGold:  150,
		RewardXP:    300,
	},
	{
		QuestID:     "quest_orc",
		Title:       "Orc Incursion",
		MonsterType: "orc",
		MinLevel:    6,
		TargetCount: 4,
		RewardGold:  200,
		RewardXP:    450,
	},
	{
		QuestID:     "quest_goblin_chief",
		Title:       "Goblin Commander",
		MonsterType: "goblin_chief",
		MinLevel:    8,
		TargetCount: 2,
		RewardGold:  300,
		RewardXP:    600,
	},
	{
		QuestID:     "quest_orc_berserker",
		Title:       "Orc Berserkers",
		MonsterType: "orc_berserker",
		MinLevel:    10,
		TargetCount: 3,
		RewardGold:  400,
		RewardXP:    850,
	},
	{
		QuestID:     "quest_orc_shaman",
		Title:       "Mages of the Horde",
		MonsterType: "orc_shaman",
		MinLevel:    12,
		TargetCount: 3,
		RewardGold:  500,
		RewardXP:    1200,
	},
	{
		QuestID:     "quest_skeleton",
		Title:       "Dark Skeleton Hunt",
		MonsterType: "skeleton",
		MinLevel:    15,
		TargetCount: 3,
		RewardGold:  800,
		RewardXP:    2000,
	},
	{
		QuestID:     "quest_boss",
		Title:       "Zombie Queen Slayer",
		MonsterType: "boss",
		MinLevel:    25,
		TargetCount: 1,
		RewardGold:  5000,
		RewardXP:    10000,
	},
}

// HasActiveQuests checks if the player has any quests with "active" status
func (p *Player) HasActiveQuests() bool {
	for _, q := range p.Quests {
		if q.Status == "active" {
			return true
		}
	}
	return false
}

// GenerateDailyQuests picks a random eligible quest template and assigns it to the player
func (p *Player) GenerateDailyQuests() {
	// Filter templates by player level
	var eligible []QuestTemplate
	for _, t := range DailyQuestTemplates {
		if p.Level >= t.MinLevel {
			eligible = append(eligible, t)
		}
	}

	if len(eligible) == 0 {
		return
	}

	// Pick a random template
	randIdx := rand.Intn(len(eligible))
	t := eligible[randIdx]

	// Create new quest
	questID := t.QuestID + "_" + time.Now().Format("20060102")

	p.Quests = []PlayerQuest{
		{
			ID:          p.ID + "-quest-" + time.Now().Format("150405"),
			PlayerID:    p.ID,
			QuestID:     questID,
			Title:       t.Title,
			Status:      "active",
			Progress:    0,
			TargetCount: t.TargetCount,
			RewardGold:  t.RewardGold,
			RewardXP:    t.RewardXP,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		},
	}
}
