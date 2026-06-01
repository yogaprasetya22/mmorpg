// REFACTORED FROM: game_usecase.go
// SpatialHashGrid — O(1) cell-based spatial partitioning for aggro/proximity checks.
package game

// SpatialHashGrid provides O(1) cell-based spatial partitioning lookup for aggro checks.
type SpatialHashGrid struct {
	cellSize float32
	buckets  map[int][]string
}

func NewSpatialHashGrid(cellSize float32) *SpatialHashGrid {
	return &SpatialHashGrid{
		cellSize: cellSize,
		buckets:  make(map[int][]string),
	}
}

func (g *SpatialHashGrid) hash(x, z float32) int {
	// Simple multiplier hashing for 2D cell coordinate projection
	ix := int(x / g.cellSize)
	iz := int(z / g.cellSize)
	return (ix * 73856093) ^ (iz * 19349663)
}

func (g *SpatialHashGrid) Insert(id string, x, z float32) {
	h := g.hash(x, z)
	g.buckets[h] = append(g.buckets[h], id)
}

func (g *SpatialHashGrid) GetNearby(x, z, radius float32) []string {
	var result []string

	minX := int((x - radius) / g.cellSize)
	maxX := int((x + radius) / g.cellSize)
	minZ := int((z - radius) / g.cellSize)
	maxZ := int((z + radius) / g.cellSize)

	// Traverse bounding cells
	for ix := minX; ix <= maxX; ix++ {
		for iz := minZ; iz <= maxZ; iz++ {
			h := (ix * 73856093) ^ (iz * 19349663)
			if ids, exists := g.buckets[h]; exists {
				result = append(result, ids...)
			}
		}
	}
	return result
}
