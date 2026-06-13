// Party system — create, invite, leave, disband, and shared XP on monster kills.
package game

import (
	"fmt"
	"math"
	"time"

	"mmorpg-backend/internal/domain"
)

// Party represents a group of players sharing XP and social features
type Party struct {
	ID        string
	LeaderID  string
	MemberIDs []string
	MaxSize   int
	CreatedAt time.Time
}

// CreateParty creates a new party with the requesting player as leader
func (u *gameUsecase) CreateParty(playerID string) string {
	u.partiesMu.Lock()
	defer u.partiesMu.Unlock()

	// Check if player already in a party
	for _, p := range u.parties {
		for _, mid := range p.MemberIDs {
			if mid == playerID {
				return "" // Already in a party
			}
		}
	}

	partyID := fmt.Sprintf("party-%d", time.Now().UnixNano()%1000000)
	party := &Party{
		ID:        partyID,
		LeaderID:  playerID,
		MemberIDs: []string{playerID},
		MaxSize:   5,
		CreatedAt: time.Now(),
	}
	u.parties[partyID] = party

	u.activePlayersMu.Lock()
	if p, ok := u.activePlayers[playerID]; ok {
		p.PartyID = partyID
	}
	u.activePlayersMu.Unlock()

	// Broadcast party creation event
	u.eventCallback("party_event", map[string]interface{}{
		"type":     "created",
		"partyId":  partyID,
		"leaderId": playerID,
		"members":  party.MemberIDs,
	})
	fmt.Printf("🎉 Party %s created by player %s\n", partyID, playerID)
	return partyID
}

// InviteToParty adds a player to an existing party
func (u *gameUsecase) InviteToParty(leaderID string, targetID string) bool {
	u.partiesMu.Lock()
	defer u.partiesMu.Unlock()

	var party *Party
	for _, p := range u.parties {
		if p.LeaderID == leaderID {
			party = p
			break
		}
	}
	if party == nil {
		return false
	}
	if len(party.MemberIDs) >= party.MaxSize {
		return false
	}

	// Check target not already in a party
	for _, existingParty := range u.parties {
		for _, mid := range existingParty.MemberIDs {
			if mid == targetID {
				return false
			}
		}
	}

	party.MemberIDs = append(party.MemberIDs, targetID)

	u.activePlayersMu.Lock()
	if p, ok := u.activePlayers[targetID]; ok {
		p.PartyID = party.ID
	}
	u.activePlayersMu.Unlock()

	u.eventCallback("party_event", map[string]interface{}{
		"type":     "member_joined",
		"partyId":  party.ID,
		"playerId": targetID,
		"members":  party.MemberIDs,
	})
	fmt.Printf("👥 Player %s joined party %s\n", targetID, party.ID)
	return true
}

// LeaveParty removes a player from their party
func (u *gameUsecase) LeaveParty(playerID string) {
	u.partiesMu.Lock()
	defer u.partiesMu.Unlock()

	var targetParty *Party
	for _, p := range u.parties {
		for i, mid := range p.MemberIDs {
			if mid == playerID {
				targetParty = p
				p.MemberIDs = append(p.MemberIDs[:i], p.MemberIDs[i+1:]...)
				break
			}
		}
		if targetParty != nil {
			break
		}
	}

	if targetParty == nil {
		return
	}

	u.activePlayersMu.Lock()
	if p, ok := u.activePlayers[playerID]; ok {
		p.PartyID = ""
	}
	u.activePlayersMu.Unlock()

	// Disband if empty or transfer leadership
	if len(targetParty.MemberIDs) == 0 {
		delete(u.parties, targetParty.ID)
		u.eventCallback("party_event", map[string]interface{}{
			"type":    "disbanded",
			"partyId": targetParty.ID,
		})
	} else if targetParty.LeaderID == playerID {
		targetParty.LeaderID = targetParty.MemberIDs[0]
		u.eventCallback("party_event", map[string]interface{}{
			"type":      "leader_changed",
			"partyId":   targetParty.ID,
			"newLeader": targetParty.LeaderID,
			"members":   targetParty.MemberIDs,
		})
	} else {
		u.eventCallback("party_event", map[string]interface{}{
			"type":     "member_left",
			"partyId":  targetParty.ID,
			"playerId": playerID,
			"members":  targetParty.MemberIDs,
		})
	}
	fmt.Printf("👋 Player %s left party %s\n", playerID, targetParty.ID)
}

// GetPartyMembers returns member IDs of the player's party (empty if no party)
func (u *gameUsecase) GetPartyMembers(playerID string) []string {
	u.partiesMu.RLock()
	defer u.partiesMu.RUnlock()

	u.activePlayersMu.RLock()
	p, ok := u.activePlayers[playerID]
	u.activePlayersMu.RUnlock()
	if !ok || p == nil || p.PartyID == "" {
		return nil
	}

	party, exists := u.parties[p.PartyID]
	if !exists {
		return nil
	}
	return party.MemberIDs
}

// distributePartyXP splits bonus XP among nearby party members on monster kill
func (u *gameUsecase) distributePartyXP(playerID string, xpGained int, monsterPos domain.Vector3) {
	members := u.GetPartyMembers(playerID)
	if len(members) <= 1 {
		return
	}

	// Split 50% bonus XP among nearby party members
	bonusPool := int(float64(xpGained) * 0.5)
	perMember := int(math.Max(1, float64(bonusPool)/float64(len(members)-1)))

	u.activePlayersMu.Lock()
	for _, memberID := range members {
		if memberID == playerID {
			continue
		}
		member, exists := u.activePlayers[memberID]
		if !exists || member == nil {
			continue
		}
		// Check distance (within 50 units)
		memberPos := domain.Vector3{X: member.LastX, Y: member.LastY, Z: member.LastZ}
		if monsterPos.DistanceTo(memberPos) > 50.0 {
			continue
		}
		member.XP += perMember
		fmt.Printf("🎁 Party XP: %s received +%d bonus XP\n", member.Username, perMember)
	}
	u.activePlayersMu.Unlock()
}
