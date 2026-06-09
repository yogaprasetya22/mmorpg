package postgres

import (
	"gorm.io/gorm"
	"mmorpg-backend/internal/domain"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetAvatarCategories returns all avatar categories with embedded assets for the configurator UI
func GetAvatarCategories(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var categories []domain.AvatarCategory
		if err := db.Order("position asc").Find(&categories).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var assets []domain.AvatarAsset
		if err := db.Find(&assets).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Embed assets into their parent categories for optimal frontend ingestion
		for i := range categories {
			categories[i].Assets = []domain.AvatarAsset{}
			for _, asset := range assets {
				if asset.Group == categories[i].ID {
					categories[i].Assets = append(categories[i].Assets, asset)
				}
			}
		}

		c.JSON(http.StatusOK, categories)
	}
}

// GetAvatarAssets returns all avatar assets flat list
func GetAvatarAssets(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var assets []domain.AvatarAsset
		if err := db.Find(&assets).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, assets)
	}
}
