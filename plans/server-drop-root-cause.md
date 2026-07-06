# Server Drop Root Cause Analysis

## Summary

**Primary cause: Unbounded goroutine leaks in the game loop.**

Server runs at 20Hz (50ms tick). Three patterns spawn goroutines that can outlive the tick, pile up across ticks, and exhaust memory → kernel OOM killer terminates the process.

---

## Root Cause #1: Broadcast goroutine per tick (CRITICAL)

**File:** [`backend/internal/usecase/game/game_loop.go:42`](../backend/internal/usecase/game/game_loop.go#L42)

```go
// 3. Broadcast game state asynchronously agar game loop tidak block
if u.broadcastCallback != nil {
    go u.broadcastCallback(payload)  // <-- goroutine per tick
}
```

- Each tick spawns 1 goroutine. At 20Hz = 20 goroutines/sec.
- `broadcastCallback` → `hub.BroadcastGameState` → sends to `h.Broadcast` channel (buffer=16).
- If hub `Run()` loop can't drain fast enough (>50ms per frame), the channel blocks.
- **Blocked goroutines don't die.** They wait. Next tick spawns another. They accumulate unboundedly.
- After ~1000 goroutines (~50 seconds of saturation), memory pressure triggers OOM.

**Why it saturates**: Hub fan-out iterates all clients (`clientsMu.RLock`) and non-block-sends to each client's `Send` channel. If many clients are slow (mobile, lag, websocket backpressure), the fan-out itself takes >50ms. Next tick arrives before previous broadcast finished.

---

## Root Cause #2: Autosave goroutine per player (CRITICAL)

**File:** [`backend/internal/usecase/game/game_loop.go:111-115`](../backend/internal/usecase/game/game_loop.go#L111-L115)

```go
for _, p := range players {
    go func(player *domain.Player) {
        _ = u.playerRepo.Update(player)  // <-- goroutine per player
    }(p)
}
```

- Every 10 seconds (200 ticks), spawns N goroutines (one per active player).
- Each calls `cachedUserRepo.Update()` which: JSON marshal → Redis SET → mark dirty.
- Redis SET is fast (~1ms), BUT if Redis is under load or connection pool saturated, it blocks.
- If Redis blocks for 100ms and there are 50 players: 50 goroutines waiting simultaneously.
- **No goroutine pool, no semaphore, no limit.** Goroutines stack across autosave cycles.
- Combined with broadcast goroutine leak, memory pressure doubles.

---

## Root Cause #3: Hub broadcast channel bottleneck (HIGH)

**File:** [`backend/internal/delivery/ws/hub.go:95-109`](../backend/internal/delivery/ws/hub.go#L95-L109)

```go
func (h *Hub) BroadcastGameState(payload domain.GameStatePayload) {
    data, err := msgpack.Marshal(payload)
    ...
    select {
    case h.Broadcast <- data:
    default:
        // drop frame
    }
}
```

- Buffer size = 16. At 20Hz, that's ~0.8 seconds of queuing.
- Once full, frames are **silently dropped**. Clients miss state updates → desync → more client reconnect attempts → more server load.
- Meanwhile, the goroutines from RC#1 are still blocked trying to push to this channel.

Additionally:

**File:** [`backend/internal/delivery/ws/hub.go:112-133`](../backend/internal/delivery/ws/hub.go#L112-L133)

```go
func (h *Hub) BroadcastChatMessage(sender string, msg string) {
    h.clientsMu.RLock()
    defer h.clientsMu.RUnlock()
    for client := range h.clients {
        select {
        case client.Send <- data:
        default:
        }
    }
}
```

- `BroadcastChatMessage` and `BroadcastGenericJSON` bypass the `Broadcast` channel entirely.
- They lock `clientsMu` directly, competing with the hub `Run()` loop which also locks `clientsMu` in its `Broadcast` case.
- Lock contention = slower fan-out = more goroutine pileup from RC#1.

---

## Root Cause #4: No goroutine lifecycle management (MEDIUM)

**Every `go func()` in the codebase ignores context cancellation:**

| File                 | Line     | Goroutine                                            |
| -------------------- | -------- | ---------------------------------------------------- |
| `game_loop.go`       | 42       | `go u.broadcastCallback(payload)`                    |
| `game_loop.go`       | 112      | `go func() { u.playerRepo.Update(p) }()`             |
| `combat.go`          | multiple | `go u.eventCallback(...)` via `BroadcastGenericJSON` |
| `player_registry.go` | 271      | `go func() { u.playerRepo.Update(p) }()`             |

None of these listen to `ctx.Done()`. During server restart/shutdown, they keep running against half-closed connections → panics → crash.

---

## Secondary Issues

### Connection pool exhaustion

- Postgres `SetMaxOpenConns(100)`. Under 50+ players + autosave goroutines + Redis fallbacks, pool can saturate.
- Dirty flush (`FlushDirtyToPostgres`) every 30s uses `gorm.DB.Transaction` with `FullSaveAssociations` — this spawns many sub-queries per player, holding connections longer.

### eventCallback also spawns per-client goroutines

- `combat.go:209-210` calls `u.eventCallback("combat_damage_event", ...)` → `hub.BroadcastGenericJSON` → iterates all clients with `clientsMu` lock. Same competition as RC#3.

---

## Fix Priority Order

1. **Remove `go` from broadcast callback in game loop** — let it block inline. Use channel backpressure instead of goroutine proliferation.
2. **Replace per-player autosave goroutines with batch write** — collect all player data, batch-write in a single goroutine with semaphore.
3. **Increase hub Broadcast channel buffer** and use **worker pool** for fan-out instead of single-goroutine hub loop.
4. **Add context propagation** to all spawned goroutines.
5. **Reduce lock contention** by batching chat/event broadcasts into the same hub channel instead of bypassing it.

---

## Immediate Quick Wins

| #   | Change                                                 | File                   | Impact                         |
| --- | ------------------------------------------------------ | ---------------------- | ------------------------------ |
| A   | Remove `go` from broadcast callback                    | `game_loop.go:42`      | Eliminates RC#1 entirely       |
| B   | Batch autosave into single goroutine with semaphore(4) | `game_loop.go:111-115` | Eliminates RC#2                |
| C   | Increase Broadcast chan buffer 16→64                   | `hub.go:40`            | Buys time before frame drops   |
| D   | Route event broadcasts through `Broadcast` channel     | `hub.go:136-152`       | Reduces lock contention (RC#3) |
