package domain

import (
	"sync"

	"github.com/yohamta/donburi"
)

type EntityID string

// Component interface (marker)
type Component interface {
	Type() string
}

// Concrete component types
type PositionComponent struct {
	Vector3
	Rotation  float32 `json:"rotation" msgpack:"rotation"`
	Animation string  `json:"animation" msgpack:"animation"`
}

func (p *PositionComponent) Type() string { return "Position" }

type HealthComponent struct {
	HP    float32 `json:"hp" msgpack:"hp"`
	MaxHP float32 `json:"max_hp" msgpack:"max_hp"`
}

func (h *HealthComponent) Type() string { return "Health" }

type PlayerComponent struct {
	Username string `json:"username" msgpack:"username"`
	Level    int    `json:"level" msgpack:"level"`
}

func (pc *PlayerComponent) Type() string { return "Player" }

type MonsterComponent struct {
	MonsterType string  `json:"monster_type" msgpack:"monster_type"`
	AggroRange  float32 `json:"aggro_range" msgpack:"aggro_range"`
	Speed       float32 `json:"speed" msgpack:"speed"`
	TargetID    string  `json:"target_id" msgpack:"target_id"`
	IsDead      bool    `json:"is_dead" msgpack:"is_dead"`
}

func (mc *MonsterComponent) Type() string { return "Monster" }

// Donburi component types definitions
var (
	PositionComp = donburi.NewComponentType[PositionComponent]()
	HealthComp   = donburi.NewComponentType[HealthComponent]()
	PlayerComp   = donburi.NewComponentType[PlayerComponent]()
	MonsterComp  = donburi.NewComponentType[MonsterComponent]()
)

// Registry manages entities and their components using Donburi ECS
type Registry struct {
	mu        sync.RWMutex
	world     donburi.World
	entityMap map[EntityID]donburi.Entity
}

func NewRegistry() *Registry {
	return &Registry{
		world:     donburi.NewWorld(),
		entityMap: make(map[EntityID]donburi.Entity),
	}
}

func (r *Registry) CreateEntity(id EntityID) EntityID {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if _, exists := r.entityMap[id]; !exists {
		// Initialize the entity with all possible components so we can set/get them safely
		entity := r.world.Create(PositionComp, HealthComp, PlayerComp, MonsterComp)
		r.entityMap[id] = entity
	}
	return id
}

func (r *Registry) DestroyEntity(id EntityID) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if entity, exists := r.entityMap[id]; exists {
		r.world.Remove(entity)
		delete(r.entityMap, id)
	}
}

func (r *Registry) AddComponent(id EntityID, c Component) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	entity, exists := r.entityMap[id]
	if !exists {
		return
	}
	
	entry := r.world.Entry(entity)
	if !entry.Valid() {
		return
	}
	
	switch comp := c.(type) {
	case *PositionComponent:
		donburi.SetValue(entry, PositionComp, *comp)
	case *HealthComponent:
		donburi.SetValue(entry, HealthComp, *comp)
	case *PlayerComponent:
		donburi.SetValue(entry, PlayerComp, *comp)
	case *MonsterComponent:
		donburi.SetValue(entry, MonsterComp, *comp)
	}
}

func (r *Registry) RemoveComponent(id EntityID, componentType string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	entity, exists := r.entityMap[id]
	if !exists {
		return
	}
	
	entry := r.world.Entry(entity)
	if !entry.Valid() {
		return
	}
	
	switch componentType {
	case "Position":
		donburi.SetValue(entry, PositionComp, PositionComponent{})
	case "Health":
		donburi.SetValue(entry, HealthComp, HealthComponent{})
	case "Player":
		donburi.SetValue(entry, PlayerComp, PlayerComponent{})
	case "Monster":
		donburi.SetValue(entry, MonsterComp, MonsterComponent{})
	}
}

func (r *Registry) GetComponent(id EntityID, componentType string) (Component, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	entity, exists := r.entityMap[id]
	if !exists {
		return nil, false
	}
	
	entry := r.world.Entry(entity)
	if !entry.Valid() {
		return nil, false
	}
	
	switch componentType {
	case "Position":
		return donburi.Get[PositionComponent](entry, PositionComp), true
	case "Health":
		return donburi.Get[HealthComponent](entry, HealthComp), true
	case "Player":
		return donburi.Get[PlayerComponent](entry, PlayerComp), true
	case "Monster":
		return donburi.Get[MonsterComponent](entry, MonsterComp), true
	}
	return nil, false
}

func (r *Registry) GetEntitiesWith(componentTypes ...string) []EntityID {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	var result []EntityID
	for id, entity := range r.entityMap {
		entry := r.world.Entry(entity)
		if entry.Valid() {
			match := true
			for _, ct := range componentTypes {
				switch ct {
				case "Position":
					if !entry.HasComponent(PositionComp) {
						match = false
					}
				case "Health":
					if !entry.HasComponent(HealthComp) {
						match = false
					}
				case "Player":
					if !entry.HasComponent(PlayerComp) {
						match = false
					}
				case "Monster":
					if !entry.HasComponent(MonsterComp) {
						match = false
					}
				}
				if !match {
					break
				}
			}
			if match {
				result = append(result, id)
			}
		}
	}
	return result
}
