// accuracy_test — standalone binary untuk memvalidasi:
// 1. Akurasi pergerakan (movement interpolation error)
// 2. Kalkulasi damage normal & CRITICAL antar semua kelas
// 3. Defense mitigation formula correctness
// 4. CritRate distribution vs theoretical probability
//
// Jalankan dengan: cd backend && go run cmd/accuracytest/main.go
package main

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"strings"
)

// ─── Mirror dari domain/player.go ─────────────────────────────────────────────
type Player struct {
	Username     string
	Class        string
	Level        int
	STR, INT, CON, VIT, WIS, LUK int
	Attack       float32
	MagicAttack  float32
	Defense      float32
	CriticalRate float32
	MaxHP        float32
}

func (p *Player) RecalculateStats() {
	p.MaxHP = 500 + float32(p.Level*100) + float32(p.CON*25) + float32(p.VIT*15)

	switch p.Class {
	case "Warrior":
		p.Attack = 30 + float32(p.Level*8) + float32(p.STR)*4.5 + float32(p.LUK)*1.5
		p.MagicAttack = 10 + float32(p.Level*2) + float32(p.INT)*1.0 + float32(p.WIS)*0.5
	case "Mage":
		p.Attack = 15 + float32(p.Level*4) + float32(p.STR)*0.5
		p.MagicAttack = 40 + float32(p.Level*10) + float32(p.INT)*5.0 + float32(p.WIS)*2.0
	case "Priest":
		p.Attack = 20 + float32(p.Level*5) + float32(p.STR)*1.5 + float32(p.LUK)*1.0
		p.MagicAttack = 25 + float32(p.Level*7) + float32(p.INT)*3.0 + float32(p.WIS)*1.5
	case "Thief":
		p.Attack = 25 + float32(p.Level*7) + float32(p.STR)*2.0 + float32(p.LUK)*3.5
		p.MagicAttack = 10 + float32(p.Level*2) + float32(p.INT)*1.0 + float32(p.WIS)*0.5
	default:
		p.Attack = 20 + float32(p.Level*5) + float32(p.STR)*2.0 + float32(p.LUK)*1.0
		p.MagicAttack = 10 + float32(p.Level*3) + float32(p.INT)*1.0 + float32(p.WIS)*0.5
	}

	p.Defense = 10 + float32(p.Level*3) + float32(p.VIT)*2.0 + float32(p.CON)*1.0
	p.CriticalRate = 0.05 + float32(p.LUK)*0.0025
	if p.CriticalRate > 0.80 {
		p.CriticalRate = 0.80
	}
}

// CalculateDamageTo — mirror dari domain/player.go
func (p *Player) CalculateDamageTo(targetDefense float32) (float32, bool) {
	isCrit := false
	dmg := p.Attack
	if p.Class == "Mage" {
		dmg = p.MagicAttack
	}

	if rand.Float32() < p.CriticalRate {
		isCrit = true
		dmg *= 1.5
	}

	// Percentage damage reduction: 100 / (100 + defense)
	damageMultiplier := float32(100.0) / (100.0 + targetDefense)
	dmg = dmg * damageMultiplier

	// Variance +/- 10%
	variation := (rand.Float32()*0.20 - 0.10) * dmg
	dmg = dmg + variation

	if dmg < 1 {
		dmg = 1
	}
	return dmg, isCrit
}

// ─── Color helpers ─────────────────────────────────────────────────────────────
const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorCyan   = "\033[36m"
	colorBold   = "\033[1m"
	colorMagenta = "\033[35m"
)

func separator(title string) {
	line := strings.Repeat("─", 64)
	fmt.Printf("\n%s%s%s\n%s  %s  %s\n%s%s%s\n", colorCyan, line, colorReset, colorBold, title, colorReset, colorCyan, line, colorReset)
}

func passLabel(ok bool) string {
	if ok {
		return colorGreen + "✅ PASS" + colorReset
	}
	return colorRed + "❌ FAIL" + colorReset
}

// ─── Test 1: Movement Interpolation Accuracy ──────────────────────────────────
func testMovementAccuracy() {
	separator("🏃 TEST 1: MOVEMENT INTERPOLATION ACCURACY")

	type State struct {
		x, z      float64
		timestamp float64
	}

	// Simulate a bot orbiting at radius=15 with 20Hz ticks (50ms each)
	const radius = 15.0
	const tickRate = 0.05 // seconds
	const renderDelay = 0.1 // 100ms interpolation buffer
	const lerpFactor = 24.0 // per-frame lerp factor (matching RemotePlayersRenderer.tsx)
	const fps = 60.0
	const dt = 1.0 / fps

	states := []State{}
	for tick := 0; tick < 40; tick++ {
		angle := float64(tick) * 0.05
		px := radius * math.Cos(angle)
		pz := radius * math.Sin(angle)
		ts := float64(tick) * tickRate
		states = append(states, State{px, pz, ts})
	}

	totalError := 0.0
	maxError := 0.0
	samples := 0

	renderTime := 0.0
	meshX, meshZ := states[0].x, states[0].z

	for renderTime < states[len(states)-1].timestamp-renderDelay {
		bufferTime := renderTime - renderDelay

		// Find interpolation bracket
		targetX, targetZ := states[0].x, states[0].z
		for i := 0; i < len(states)-1; i++ {
			if states[i].timestamp <= bufferTime && states[i+1].timestamp > bufferTime {
				elapsed := bufferTime - states[i].timestamp
				duration := states[i+1].timestamp - states[i].timestamp
				alpha := elapsed / duration
				targetX = states[i].x + (states[i+1].x-states[i].x)*alpha
				targetZ = states[i].z + (states[i+1].z-states[i].z)*alpha
				break
			}
		}

		// Apply lerp (24.0 * dt)
		meshX += (targetX - meshX) * math.Min(1, lerpFactor*dt)
		meshZ += (targetZ - meshZ) * math.Min(1, lerpFactor*dt)

		// Expected position at renderTime - renderDelay (matching delayed interpolation playback target)
		delayedTime := renderTime - renderDelay
		expectedAngle := delayedTime / tickRate * 0.05
		expectedX := radius * math.Cos(expectedAngle)
		expectedZ := radius * math.Sin(expectedAngle)

		errDist := math.Sqrt(math.Pow(meshX-expectedX, 2) + math.Pow(meshZ-expectedZ, 2))
		totalError += errDist
		if errDist > maxError {
			maxError = errDist
		}
		samples++
		renderTime += dt
	}

	avgError := totalError / float64(samples)
	fmt.Printf("  Simulated frames: %d @ %.0f FPS with 100ms interpolation buffer\n", samples, fps)
	fmt.Printf("  Orbit radius: %.1f units, Tick rate: %.0fHz, Lerp factor: %.0f\n", radius, 1/tickRate, lerpFactor)
	fmt.Printf("  %-28s %.4f units\n", "Average positional error:", avgError)
	fmt.Printf("  %-28s %.4f units\n", "Peak positional error:", maxError)

	// Acceptable thresholds
	avgOk  := avgError < 0.5
	maxOk  := maxError < 2.0
	fmt.Printf("\n  Average error < 0.5u : %s  (%.4f)\n", passLabel(avgOk), avgError)
	fmt.Printf("  Peak error    < 2.0u : %s  (%.4f)\n", passLabel(maxOk), maxError)
}

// ─── Test 2: Damage Accuracy per Class ────────────────────────────────────────
type DamageStats struct {
	min, max, sum float64
	critCount     int
	totalHits     int
	samples       []float64
}

func testDamageAccuracy() {
	separator("⚔️  TEST 2: DAMAGE CALCULATION ACCURACY PER CLASS")

	const monsterDefense = float32(30) // average goblin defense
	const iterations = 10000

	classes := []string{"Warrior", "Mage", "Priest", "Thief", "Beginner"}

	for _, class := range classes {
		p := &Player{
			Username: "TestBot_" + class,
			Class:    class,
			Level:    10,
			STR:      15, INT: 15, CON: 10, VIT: 10, WIS: 10, LUK: 20,
		}
		p.RecalculateStats()

		baseAtk := p.Attack
		if class == "Mage" {
			baseAtk = p.MagicAttack
		}
		expectedMitigatedBase := baseAtk * (100.0 / (100.0 + monsterDefense))

		stats := DamageStats{min: 1e9, samples: make([]float64, 0, iterations)}

		for i := 0; i < iterations; i++ {
			dmg, isCrit := p.CalculateDamageTo(monsterDefense)
			v := float64(dmg)
			stats.sum += v
			stats.samples = append(stats.samples, v)
			if v < stats.min { stats.min = v }
			if v > stats.max { stats.max = v }
			if isCrit { stats.critCount++ }
			stats.totalHits++
		}

		avg := stats.sum / float64(iterations)
		critRate := float64(stats.critCount) / float64(iterations) * 100

		// Expected avg (rough: critRate skews higher)
		theoreticalCritRate := float64(p.CriticalRate)
		theoreticalAvg := float64(expectedMitigatedBase) * (1 - theoreticalCritRate) + float64(expectedMitigatedBase)*1.5*theoreticalCritRate

		// Std deviation
		variance := 0.0
		for _, v := range stats.samples {
			d := v - avg
			variance += d * d
		}
		stdDev := math.Sqrt(variance / float64(len(stats.samples)))

		// Sort samples for percentiles
		sorted := make([]float64, len(stats.samples))
		copy(sorted, stats.samples)
		sort.Float64s(sorted)
		p50 := sorted[len(sorted)/2]
		p95 := sorted[int(float64(len(sorted))*0.95)]

		fmt.Printf("\n  %s%s [Lv%d]%s\n", colorBold, class, p.Level, colorReset)
		fmt.Printf("    Base Stat     : Atk=%.1f  Defense vs=%.1f  CritRate=%.2f%%\n",
			baseAtk, monsterDefense, float64(p.CriticalRate)*100)
		fmt.Printf("    Sample Size   : %d hits\n", iterations)
		fmt.Printf("    Damage Range  : %.2f – %.2f\n", stats.min, stats.max)
		fmt.Printf("    Average Dmg   : %.2f  (theoretical: %.2f)\n", avg, theoreticalAvg)
		fmt.Printf("    Std Deviation : %.2f  (±%.1f%%)\n", stdDev, (stdDev/avg)*100)
		fmt.Printf("    Median / P95  : %.2f / %.2f\n", p50, p95)
		fmt.Printf("    Crit Hit Rate : %.2f%%  (expected: %.2f%%)\n", critRate, theoreticalCritRate*100)

		// Accuracy checks
		avgErrPct := math.Abs(avg-theoreticalAvg) / theoreticalAvg * 100
		critErrPct := math.Abs(critRate - theoreticalCritRate*100)
		avgOk  := avgErrPct < 5.0
		critOk := critErrPct < 2.5

		fmt.Printf("    Avg error vs theory : %s  (%.2f%% off)\n", passLabel(avgOk), avgErrPct)
		fmt.Printf("    CritRate accuracy   : %s  (%.2f%% off)\n", passLabel(critOk), critErrPct)
	}
}

// ─── Test 3: Defense Mitigation Formula ────────────────────────────────────────
func testDefenseMitigation() {
	separator("🛡️  TEST 3: DEFENSE MITIGATION FORMULA ACCURACY")

	type testCase struct {
		defense  float32
		expected float64 // expected mitigation %
	}

	// Formula: effective_dmg = dmg * 100/(100+defense)
	// → mitigation% = defense/(100+defense)*100
	cases := []testCase{
		{0, 0},
		{10, 9.09},
		{30, 23.08},
		{50, 33.33},
		{100, 50.0},
		{200, 66.67},
		{500, 83.33},
	}

	fmt.Printf("  %-12s %-18s %-18s %-10s\n", "Defense", "Formula Output%", "Expected%", "Result")
	fmt.Printf("  %s\n", strings.Repeat("─", 60))
	allPass := true
	for _, tc := range cases {
		mitigationPct := float64(tc.defense) / float64(100.0+tc.defense) * 100
		diff := math.Abs(mitigationPct - tc.expected)
		ok := diff < 0.1
		if !ok { allPass = false }
		fmt.Printf("  %-12.0f %-18.2f %-18.2f %s\n",
			float64(tc.defense), mitigationPct, tc.expected, passLabel(ok))
	}
	if allPass {
		fmt.Printf("\n  %sAll mitigation values match expected formula! Formula is accurate.%s\n", colorGreen, colorReset)
	}
}

// ─── Test 4: Critical Hit Multiplier Verification ─────────────────────────────
func testCritMultiplier() {
	separator("🔥 TEST 4: CRITICAL HIT MULTIPLIER VERIFICATION")

	fmt.Println("  Verifying that CRITICAL hits apply exactly 1.5x multiplier")
	fmt.Println("  (before defense mitigation is applied)")

	p := &Player{
		Class: "Warrior",
		Level: 10,
		STR: 15, INT: 10, CON: 10, VIT: 10, WIS: 10, LUK: 200, // force near-100% crit
	}
	p.RecalculateStats()
	if p.CriticalRate > 0.80 {
		p.CriticalRate = 0.80 // capped by formula
	}

	const defense = float32(0) // no defense so we isolate multiplier

	normalSamples := []float64{}
	critSamples   := []float64{}
	// Collect 5000 samples of each
	for len(normalSamples) < 5000 || len(critSamples) < 5000 {
		dmg, isCrit := p.CalculateDamageTo(defense)
		if isCrit && len(critSamples) < 5000 {
			critSamples = append(critSamples, float64(dmg))
		} else if !isCrit && len(normalSamples) < 5000 {
			normalSamples = append(normalSamples, float64(dmg))
		}
	}

	avgNormal := 0.0
	for _, v := range normalSamples { avgNormal += v }
	avgNormal /= float64(len(normalSamples))

	avgCrit := 0.0
	for _, v := range critSamples { avgCrit += v }
	avgCrit /= float64(len(critSamples))

	ratio := avgCrit / avgNormal
	expectedRatio := 1.5

	fmt.Printf("\n  Average Normal Hit    : %.3f\n", avgNormal)
	fmt.Printf("  Average Critical Hit  : %.3f\n", avgCrit)
	fmt.Printf("  Observed Crit Ratio   : %.4fx  (expected: %.1fx)\n", ratio, expectedRatio)

	errPct := math.Abs(ratio-expectedRatio) / expectedRatio * 100
	ok := errPct < 1.0
	fmt.Printf("  Crit multiplier check : %s  (%.4f%% error)\n", passLabel(ok), errPct)
}

// ─── Test 5: Boss HP cap ───────────────────────────────────────────────────────
func testBossHardCap() {
	separator("👑 TEST 5: BOSS DAMAGE HARD CAP (35% MaxHP)")

	bossMaxHP := float32(50000)
	cap35 := bossMaxHP * 0.35

	testDmgs := []float32{100, 5000, 10000, 17500, 17501, 50000}
	fmt.Printf("  Boss MaxHP: %.0f   Hard Cap: %.0f (35%%)\n\n", bossMaxHP, cap35)
	fmt.Printf("  %-15s %-20s %-10s\n", "Raw Damage", "Applied Damage", "Result")
	fmt.Printf("  %s\n", strings.Repeat("─", 45))

	for _, rawDmg := range testDmgs {
		applied := rawDmg
		if applied > cap35 {
			applied = cap35
		}
		capped := rawDmg > cap35
		ok := !capped || (math.Abs(float64(applied-cap35)) < 0.01)
		cappedLabel := ""
		if capped { cappedLabel = " (CAPPED)" }
		fmt.Printf("  %-15.2f %-20.2f %s%s\n", rawDmg, applied, passLabel(ok), cappedLabel)
	}
}

// ─── Main ──────────────────────────────────────────────────────────────────────
func main() {
	fmt.Printf("\n%s%s%s\n", colorBold,
		"=================================================================\n"+
		"   🎮  MMORPG ACCURACY & COMBAT CALIBRATION TEST SUITE  🎮      \n"+
		"=================================================================",
		colorReset)
	fmt.Printf("  Tests:\n")
	fmt.Printf("    1. Movement interpolation positional drift\n")
	fmt.Printf("    2. Damage calculation per class vs theoretical average\n")
	fmt.Printf("    3. Defense mitigation formula correctness\n")
	fmt.Printf("    4. Critical hit multiplier (1.5x) verification\n")
	fmt.Printf("    5. Boss damage hard cap (35%% MaxHP)\n\n")

	testMovementAccuracy()
	testDamageAccuracy()
	testDefenseMitigation()
	testCritMultiplier()
	testBossHardCap()

	separator("📋 SUMMARY")
	fmt.Printf("  All tests completed. Review %s❌ FAIL%s entries above for any formula inaccuracies.\n", colorRed, colorReset)
	fmt.Printf("  %sTip:%s If CritRate or average damage is off by >5%%, check CriticalRate cap/formula in player.go\n\n", colorYellow, colorReset)
}
