// REFACTORED FROM: player.go
// Player combat calculations — authoritative damage formulas, XP scaling, and level progression.
// Separated from player.go to follow Single Responsibility Principle.
package domain

import (
	"math"
	"math/rand"
)

// CalculateDamageTo computes the authoritative damage dealt by this player to a target.
// It applies physical/magic defense reduction, Soft DEF subtraction, RES/MRES mitigation,
// and Critical Hit Shield with a creative multiplier from CRATE.
func (p *Player) CalculateDamageTo(
	targetLevel int,
	targetLUK int,
	targetDefense float32, // Hard DEF or Hard MDEF
	targetSoftDEF float32, // Soft DEF or Soft MDEF
	targetRES int, // RES or MRES
) (float32, bool) {
	isCrit := false
	dmg := p.Attack

	if p.Class == "Mage" {
		dmg = p.MagicAttack

		// Magic Hard MDEF reduction: Hard MDEF / (Hard MDEF + 1000)
		reductionFactor := targetDefense / (targetDefense + 1000.0)
		dmg = dmg * (1.0 - reductionFactor)

		// S.MATK Amplification: dmg * (1 + SMATK / 100)
		dmg = dmg * (1.0 + float32(p.SMATK)/100.0)

		// M.RES Mitigation: 0.1% reduction per point of target MRES (MRES / 1000)
		mresMitigation := float32(targetRES) / 1000.0
		if mresMitigation > 0.90 {
			mresMitigation = 0.90 // Cap absorption at 90%
		}
		dmg = dmg * (1.0 - mresMitigation)

		// Soft MDEF subtraction
		dmg = dmg - targetSoftDEF
	} else {
		// Physical Attack
		// Critical check
		realCrit := p.CriticalRate
		critShield := float32(targetLevel)/15.0 + float32(targetLUK)/5.0
		netCritChance := realCrit - (critShield / 100.0)
		if rand.Float32() < netCritChance {
			isCrit = true
			// Critical damage scales with (140 + CRatePlus)%
			dmg = dmg * (1.40 + float32(p.CRatePlus)/100.0)
		}

		// Physical Hard DEF reduction: Hard DEF / (Hard DEF + 4000)
		reductionFactor := targetDefense / (targetDefense + 4000.0)
		dmg = dmg * (1.0 - reductionFactor)

		// P.ATK Amplification: dmg * (1 + PATK / 100)
		dmg = dmg * (1.0 + float32(p.PATK)/100.0)

		// RES Mitigation: 0.1% reduction per point of target RES (RES / 1000)
		resMitigation := float32(targetRES) / 1000.0
		if resMitigation > 0.90 {
			resMitigation = 0.90 // Cap absorption at 90%
		}
		dmg = dmg * (1.0 - resMitigation)

		// Soft DEF subtraction
		dmg = dmg - targetSoftDEF
	}

	if dmg < 1.0 {
		dmg = 1.0
	}

	// Add slight variance +/- 10%
	variation := (rand.Float32()*0.20 - 0.10) * dmg
	dmg = dmg + variation

	if dmg < 1.0 {
		dmg = 1.0
	}

	return dmg, isCrit
}

// GetRequiredXP returns the XP required to reach the next level based on an exponential curve.
func GetRequiredXP(level int) int {
	if level <= 0 {
		return 100
	}
	// Formula: 100 * level^1.8
	return int(math.Round(100.0 * math.Pow(float64(level), 1.8)))
}

// CalculateXPGain computes the final XP drop from a monster, applying a penalty/bonus based on level difference.
func (p *Player) CalculateXPGain(monsterLevel int, baseXP int) int {
	diff := monsterLevel - p.Level
	var multiplier float32

	switch {
	case diff >= 15:
		multiplier = 1.40
	case diff >= 10:
		multiplier = 1.25
	case diff >= 5:
		multiplier = 1.15
	case diff >= -5:
		multiplier = 1.00
	case diff >= -10:
		multiplier = 0.75
	case diff >= -15:
		multiplier = 0.35
	default:
		multiplier = 0.10
	}

	gained := float32(baseXP) * multiplier
	if gained < 1 {
		return 1
	}
	return int(math.Round(float64(gained)))
}
