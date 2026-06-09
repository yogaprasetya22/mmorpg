package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"mmorpg-backend/internal/domain"
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
		XP:         0,
		Gold:       200,
		BaseSTR:    10,
		BaseAGI:    10,
		BaseVIT:    10,
		BaseINT:    10,
		BaseDEX:    10,
		BaseLUK:    10,
		StatPoints: 5,
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
				Damage:     120,
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
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Calculate correct class attributes
	player.RecalculateStats()
	player.HP = player.MaxHP
	player.MP = player.MaxMP

	if err := u.playerRepo.Create(player); err != nil {
		return nil, err
	}

	return player, nil
}

// Simple unique ID generator
func generateUUID() string {
	return time.Now().Format("20060102150405") + "-" + string(rune(65+time.Now().UnixNano()%26)) + string(rune(65+(time.Now().UnixNano()/100)%26))
}
