/**
 * Spatial terrain height cache.
 *
 * Avoids redundant BVH raycasts / noise evaluations by caching heights
 * in a grid-keyed Map.  Entries expire after `TTL_MS` to pick up
 * sculpted terrain changes within ~2 seconds.
 *
 * Usage:
 *   const h = getCachedTerrainHeight(x, z, () => expensiveRaycast(x, z));
 */

const GRID = 1;              // 1-metre cells (round to nearest int)
const TTL_MS = 2_000;        // 2-second expiry
const MAX_ENTRIES = 2_048;   // prevent unbounded growth

interface CacheEntry {
  h: number;
  t: number;                 // performance.now() timestamp
}

const cache = new Map<string, CacheEntry>();

// Pre-allocated key buffer — avoids string concat allocation per call
let _keyBuf = '';

export function getCachedTerrainHeight(
  x: number,
  z: number,
  fallback: () => number,
): number {
  const gx = Math.round(x / GRID);
  const gz = Math.round(z / GRID);
  _keyBuf = `${gx},${gz}`;

  const now = performance.now();
  const entry = cache.get(_keyBuf);
  if (entry && now - entry.t < TTL_MS) {
    return entry.h;
  }

  const h = fallback();

  // Evict oldest entries if cache is full
  if (cache.size >= MAX_ENTRIES) {
    // Delete ~25% of entries (oldest first) to batch-evict
    let toDelete = MAX_ENTRIES >> 2;
    for (const key of cache.keys()) {
      if (toDelete-- <= 0) break;
      cache.delete(key);
    }
  }

  cache.set(_keyBuf, { h, t: now });
  return h;
}

/** Force-clear all cached heights (e.g. after terrain sculpt commit). */
export function clearTerrainCache() {
  cache.clear();
}
