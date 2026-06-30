const GRID = 1;
const TTL_MS = 2_000;
const MAX_ENTRIES = 2_048;

interface CacheEntry {
    h: number;
    t: number;
}

const cache = new Map<number, CacheEntry>();

function hashKey(gx: number, gz: number): number {
    return (gx * 73856093) ^ (gz * 19349663);
}

export function getCachedTerrainHeight(
    x: number,
    z: number,
    fallback: () => number,
): number {
    const gx = Math.round(x / GRID);
    const gz = Math.round(z / GRID);
    const key = hashKey(gx, gz);

    const now = performance.now();
    const entry = cache.get(key);
    if (entry && now - entry.t < TTL_MS) {
        return entry.h;
    }

    const h = fallback();

    if (cache.size >= MAX_ENTRIES) {
        let toDelete = MAX_ENTRIES >> 2;
        for (const key of cache.keys()) {
            if (toDelete-- <= 0) break;
            cache.delete(key);
        }
    }

    cache.set(key, { h, t: now });
    return h;
}

export function clearTerrainCache() {
    cache.clear();
}
