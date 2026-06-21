package auth

import (
	"errors"
	"time"

	"mmorpg-backend/internal/domain"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthUsecase interface {
	Register(username, password string) (*domain.User, error)
	Login(username, password string) (string, *domain.User, error)
	ValidateToken(tokenStr string) (string, error)

	// Character selection and creation
	GetCharacters(userID string) ([]*domain.Player, error)
	CreateCharacter(userID string, name string, class string, gender string, hairStyle int, hairColor string, customAvatarURL string) (*domain.Player, error)
}

type authUsecase struct {
	playerRepo domain.PlayerRepository
	userRepo   domain.UserRepository
	jwtSecret  []byte
}

type Claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

func NewAuthUsecase(playerRepo domain.PlayerRepository, userRepo domain.UserRepository, jwtSecret string) AuthUsecase {
	return &authUsecase{
		playerRepo: playerRepo,
		userRepo:   userRepo,
		jwtSecret:  []byte(jwtSecret),
	}
}

func (u *authUsecase) Register(username, password string) (*domain.User, error) {
	if len(username) < 3 {
		return nil, errors.New("username account harus minimal 3 karakter")
	}
	if len(password) < 6 {
		return nil, errors.New("password harus minimal 6 karakter")
	}

	// Check if user already exists
	existing, err := u.userRepo.GetByUsername(username)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("username account sudah digunakan")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &domain.User{
		ID:        generateUUID(),
		Username:  username,
		Password:  string(hashedPassword),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := u.userRepo.Create(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (u *authUsecase) Login(username, password string) (string, *domain.User, error) {
	user, err := u.userRepo.GetByUsername(username)
	if err != nil {
		return "", nil, err
	}
	if user == nil {
		return "", nil, errors.New("username atau password salah")
	}

	// Compare password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return "", nil, errors.New("username atau password salah")
	}

	// Generate JWT token encoding UserID
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID: user.ID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(u.jwtSecret)
	if err != nil {
		return "", nil, err
	}

	return tokenString, user, nil
}

func (u *authUsecase) ValidateToken(tokenStr string) (string, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return u.jwtSecret, nil
	})

	if err != nil {
		return "", err
	}

	if !token.Valid {
		return "", errors.New("token tidak valid")
	}

	// Verify that the user still exists in the PostgreSQL database (prevents stale token errors on seed/wipe)
	user, err := u.userRepo.GetByID(claims.UserID)
	if err != nil {
		return "", err
	}
	if user == nil {
		return "", errors.New("user tidak ditemukan atau telah dihapus")
	}

	return claims.UserID, nil
}

// GetCharacters retrieves all characters for a specific user ID
func (u *authUsecase) GetCharacters(userID string) ([]*domain.Player, error) {
	return u.playerRepo.GetByUserID(userID)
}

// CreateCharacter authoritatively creates a new custom RPG character
func (u *authUsecase) CreateCharacter(userID string, name string, class string, gender string, hairStyle int, hairColor string, customAvatarURL string) (*domain.Player, error) {
	if len(name) < 3 {
		return nil, errors.New("nama karakter minimal 3 karakter")
	}

	// Verify that character name is unique
	existing, err := u.playerRepo.GetByUsername(name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("nama karakter sudah digunakan oleh pemain lain")
	}

	playerID := generateUUID()

	// Create RPG character object
	player := &domain.Player{
		ID:              playerID,
		UserID:          userID,
		Username:        name, // Stored in Username column to maintain compatibility
		Class:           class,
		Gender:          gender,
		HairStyle:       hairStyle,
		HairColor:       hairColor,
		CustomAvatarURL: customAvatarURL,
		Level:           1,
		XP:              0,
		Gold:            200,
		BaseSTR:         10,
		BaseAGI:         10,
		BaseVIT:         10,
		BaseINT:         10,
		BaseDEX:         10,
		BaseLUK:         10,
		StatPoints:      5,
		HP:              1000,
		MaxHP:           1000,
		MP:              200,
		MaxMP:           200,
		MapName:         "Starter Zone",
		LastX:           0,
		LastY:           0,
		LastZ:           0,
		Inventory: []domain.PlayerItem{
			buildClassStarterWeapon(playerID, class),
			{
				ID:        playerID + "-item-2",
				PlayerID:  playerID,
				ItemID:    "potion_red",
				Name:      "Red Potion",
				Type:      "consumable",
				SlotIndex: 1,
				Quantity:  5,
				AddHP:     150,
			},
			{
				ID:        playerID + "-item-3",
				PlayerID:  playerID,
				ItemID:    "potion_blue",
				Name:      "Blue Potion",
				Type:      "consumable",
				SlotIndex: 2,
				Quantity:  5,
				AddMP:     50,
			},
		},
		Skills:    buildClassSkills(playerID, class),
		Quests:    []domain.PlayerQuest{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Assign first story quest
	player.AssignStoryQuest()

	// Calculate correct class attributes
	player.RecalculateStats()
	player.HP = player.MaxHP
	player.MP = player.MaxMP

	if err := u.playerRepo.Create(player); err != nil {
		return nil, err
	}

	return player, nil
}

// buildClassStarterWeapon returns the appropriate starter weapon for a given class
func buildClassStarterWeapon(playerID string, class string) domain.PlayerItem {
	switch class {
	case "Mage":
		return domain.PlayerItem{
			ID: playerID + "-item-1", PlayerID: playerID,
			ItemID: "staff_starter", Name: "Wooden Staff",
			Type: "equipment", SlotType: "weapon", WeaponCategory: "staff",
			Quantity: 1, IsEquipped: true, SlotIndex: 0, AddAttack: 12,
		}
	case "Beginner": // Archer
		return domain.PlayerItem{
			ID: playerID + "-item-1", PlayerID: playerID,
			ItemID: "bow_starter", Name: "Wooden Bow",
			Type: "equipment", SlotType: "weapon", WeaponCategory: "bow",
			Quantity: 1, IsEquipped: true, SlotIndex: 0, AddAttack: 14,
		}
	case "Priest": // Tank
		return domain.PlayerItem{
			ID: playerID + "-item-1", PlayerID: playerID,
			ItemID: "mace_starter", Name: "Wooden Mace",
			Type: "equipment", SlotType: "weapon", WeaponCategory: "mace",
			Quantity: 1, IsEquipped: true, SlotIndex: 0, AddAttack: 13,
		}
	case "Thief": // Assassin
		return domain.PlayerItem{
			ID: playerID + "-item-1", PlayerID: playerID,
			ItemID: "dagger_starter", Name: "Wooden Dagger",
			Type: "equipment", SlotType: "weapon", WeaponCategory: "dagger",
			Quantity: 1, IsEquipped: true, SlotIndex: 0, AddAttack: 12,
		}
	default: // Warrior / Fighter
		return domain.PlayerItem{
			ID: playerID + "-item-1", PlayerID: playerID,
			ItemID: "sword_starter", Name: "Wooden Sword",
			Type: "equipment", SlotType: "weapon", WeaponCategory: "sword",
			Quantity: 1, IsEquipped: true, SlotIndex: 0, AddAttack: 15,
		}
	}
}

// buildClassSkills returns class-specific skill sets for character creation
func buildClassSkills(playerID string, class string) []domain.PlayerSkill {
	base := []domain.PlayerSkill{
		{ID: playerID + "-skill-heal", PlayerID: playerID, SkillID: "heal", Name: "Lesser Heal", Level: 1, Type: "active", ManaCost: 25, MaxCD: 6.0, Damage: 120, IsUnlocked: true},
	}
	switch class {
	case "Warrior", "Tank":
		return append(base,
			domain.PlayerSkill{ID: playerID + "-skill-1", PlayerID: playerID, SkillID: "strike", Name: "Heavy Strike", Level: 1, Type: "active", ManaCost: 15, MaxCD: 3.0, Damage: 1.5, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-2", PlayerID: playerID, SkillID: "shield_bash", Name: "Shield Bash", Level: 1, Type: "active", ManaCost: 30, MaxCD: 8.0, Damage: 2.0, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-3", PlayerID: playerID, SkillID: "war_cry", Name: "War Cry", Level: 1, Type: "active", ManaCost: 40, MaxCD: 30.0, Damage: 0, IsUnlocked: true},
		)
	case "Mage":
		return append(base,
			domain.PlayerSkill{ID: playerID + "-skill-1", PlayerID: playerID, SkillID: "fireball", Name: "Fireball", Level: 1, Type: "active", ManaCost: 35, MaxCD: 4.0, Damage: 2.5, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-2", PlayerID: playerID, SkillID: "ice_bolt", Name: "Ice Bolt", Level: 1, Type: "active", ManaCost: 25, MaxCD: 3.0, Damage: 1.8, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-3", PlayerID: playerID, SkillID: "lightning", Name: "Lightning Storm", Level: 1, Type: "active", ManaCost: 50, MaxCD: 10.0, Damage: 3.0, IsUnlocked: true},
		)
	case "Priest":
		return []domain.PlayerSkill{
			{ID: playerID + "-skill-1", PlayerID: playerID, SkillID: "heal", Name: "Greater Heal", Level: 1, Type: "active", ManaCost: 30, MaxCD: 5.0, Damage: 200, IsUnlocked: true},
			{ID: playerID + "-skill-2", PlayerID: playerID, SkillID: "blessing", Name: "Blessing", Level: 1, Type: "active", ManaCost: 45, MaxCD: 30.0, Damage: 0, IsUnlocked: true},
			{ID: playerID + "-skill-3", PlayerID: playerID, SkillID: "holy_light", Name: "Holy Light", Level: 1, Type: "active", ManaCost: 30, MaxCD: 4.0, Damage: 2.0, IsUnlocked: true},
		}
	case "Thief", "Assassin":
		return append(base,
			domain.PlayerSkill{ID: playerID + "-skill-1", PlayerID: playerID, SkillID: "strike", Name: "Backstab", Level: 1, Type: "active", ManaCost: 20, MaxCD: 2.5, Damage: 2.0, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-2", PlayerID: playerID, SkillID: "poison_strike", Name: "Poison Strike", Level: 1, Type: "active", ManaCost: 25, MaxCD: 5.0, Damage: 1.5, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-3", PlayerID: playerID, SkillID: "stealth", Name: "Stealth", Level: 1, Type: "active", ManaCost: 35, MaxCD: 20.0, Damage: 0, IsUnlocked: true},
		)
	case "Beginner": // Archer / Marksman
		return append(base,
			domain.PlayerSkill{ID: playerID + "-skill-1", PlayerID: playerID, SkillID: "double_strafe", Name: "Double Strafe", Level: 1, Type: "active", ManaCost: 12, MaxCD: 1.5, Damage: 2.0, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-2", PlayerID: playerID, SkillID: "arrow_shower", Name: "Arrow Shower", Level: 1, Type: "active", ManaCost: 25, MaxCD: 4.0, Damage: 1.2, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-3", PlayerID: playerID, SkillID: "arrow_repel", Name: "Arrow Repel", Level: 1, Type: "active", ManaCost: 18, MaxCD: 6.0, Damage: 1.8, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-4", PlayerID: playerID, SkillID: "ankle_snare", Name: "Ankle Snare", Level: 1, Type: "active", ManaCost: 15, MaxCD: 10.0, Damage: 0, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-5", PlayerID: playerID, SkillID: "improve_concentration", Name: "Improve Concentration", Level: 1, Type: "active", ManaCost: 20, MaxCD: 30.0, Damage: 0, IsUnlocked: true},
			domain.PlayerSkill{ID: playerID + "-skill-6", PlayerID: playerID, SkillID: "rain_of_arrows", Name: "Rain of Arrows", Level: 1, Type: "active", ManaCost: 60, MaxCD: 45.0, Damage: 3.5, IsUnlocked: true},
		)
	default: // Fallback: return base skills only
		return base
	}
}

// Simple unique ID generator
func generateUUID() string {
	return time.Now().Format("20060102150405") + "-" + string(rune(65+time.Now().UnixNano()%26)) + string(rune(65+(time.Now().UnixNano()/100)%26))
}
