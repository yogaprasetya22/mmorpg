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
	ID           string    `json:"id" gorm:"primaryKey"`
	PlayerID     string    `json:"player_id" gorm:"index;not null"`
	QuestID      string    `json:"quest_id" gorm:"not null"`
	Title        string    `json:"title" gorm:"not null"`
	Type         string    `json:"type" gorm:"default:'daily'"`    // daily, story, collect
	Status       string    `json:"status" gorm:"default:'active'"` // active, completed, failed
	Progress     int       `json:"progress" gorm:"default:0"`
	TargetCount  int       `json:"target_count" gorm:"default:0"`
	RewardGold   int       `json:"reward_gold" gorm:"default:0"`
	RewardXP     int       `json:"reward_xp" gorm:"default:0"`
	Prerequisite string    `json:"prerequisite" gorm:"default:''"` // QuestID that must be completed first
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
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

// StoryQuestTemplates defines the main storyline quest chain
var StoryQuestTemplates = []QuestTemplate{
	{QuestID: "story_01_slimes", Title: "The Slime Threat", MonsterType: "slime", MinLevel: 1, TargetCount: 3, RewardGold: 100, RewardXP: 200},
	{QuestID: "story_02_boars", Title: "Wild Boar Rampage", MonsterType: "default", MinLevel: 2, TargetCount: 5, RewardGold: 200, RewardXP: 400},
	{QuestID: "story_03_goblins", Title: "Goblin Invasion", MonsterType: "goblin", MinLevel: 3, TargetCount: 8, RewardGold: 400, RewardXP: 800},
	{QuestID: "story_04_archers", Title: "Scout the Scouts", MonsterType: "goblin_archer", MinLevel: 5, TargetCount: 6, RewardGold: 600, RewardXP: 1200},
	{QuestID: "story_05_orcs", Title: "The Orc Vanguard", MonsterType: "orc", MinLevel: 7, TargetCount: 8, RewardGold: 900, RewardXP: 2000},
	{QuestID: "story_06_commander", Title: "Face the Commander", MonsterType: "goblin_chief", MinLevel: 10, TargetCount: 3, RewardGold: 1500, RewardXP: 3500},
	{QuestID: "story_07_berserkers", Title: "Rage of the Berserkers", MonsterType: "orc_berserker", MinLevel: 12, TargetCount: 5, RewardGold: 2500, RewardXP: 5000},
	{QuestID: "story_08_shaman", Title: "The Mystic Horde", MonsterType: "orc_shaman", MinLevel: 15, TargetCount: 5, RewardGold: 4000, RewardXP: 8000},
	{QuestID: "story_09_undead", Title: "Rise of the Undead", MonsterType: "skeleton", MinLevel: 20, TargetCount: 8, RewardGold: 6000, RewardXP: 12000},
	{QuestID: "story_10_queen", Title: "The Zombie Queen", MonsterType: "boss", MinLevel: 25, TargetCount: 1, RewardGold: 10000, RewardXP: 25000},
}

// AssignStoryQuest assigns the next available story quest based on prerequisite completion
func (p *Player) AssignStoryQuest() bool {
	// Find completed story quests
	completed := make(map[string]bool)
	for _, q := range p.Quests {
		if q.Status == "completed" && len(q.QuestID) > 5 && q.QuestID[:6] == "story_" {
			completed[q.QuestID] = true
		}
	}

	// Find next story quest
	for i, t := range StoryQuestTemplates {
		if completed[t.QuestID] {
			continue // Already done
		}
		// Check prerequisite: previous quest must be completed
		if i > 0 && !completed[StoryQuestTemplates[i-1].QuestID] {
			continue // Prerequisite not met
		}
		if p.Level < t.MinLevel {
			return false // Not high enough level
		}

		// Assign this quest
		quest := PlayerQuest{
			ID:          p.ID + "-" + t.QuestID,
			PlayerID:    p.ID,
			QuestID:     t.QuestID,
			Title:       t.Title,
			Type:        "story",
			Status:      "active",
			Progress:    0,
			TargetCount: t.TargetCount,
			RewardGold:  t.RewardGold,
			RewardXP:    t.RewardXP,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		if i > 0 {
			quest.Prerequisite = StoryQuestTemplates[i-1].QuestID
		}
		p.Quests = append(p.Quests, quest)
		return true
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
