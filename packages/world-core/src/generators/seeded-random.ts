/**
 * Deterministic PRNG — mulberry32 algorithm.
 * Same seed → same sequence. No external deps.
 *
 * Location: packages/world-core/src/generators/seeded-random.ts
 */

export interface SeededRandom {
    /** Returns float in [0, 1) */
    next(): number;
    /** Returns float in [min, max) */
    range(min: number, max: number): number;
    /** Returns integer in [min, max] inclusive */
    int(min: number, max: number): number;
    /** Pick random element from array */
    pick<T>(arr: readonly T[]): T;
    /** Shallow shuffle (Fisher-Yates) */
    shuffle<T>(arr: readonly T[]): T[];
}

export function createSeededRandom(seed: number): SeededRandom {
    let state = seed | 0 || 1;

    function next(): number {
        let t = (state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    return {
        next,
        range(min, max) {
            return min + next() * (max - min);
        },
        int(min, max) {
            return Math.floor(min + next() * (max - min + 1));
        },
        pick(arr) {
            return arr[this.int(0, arr.length - 1)];
        },
        shuffle(arr) {
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
                const j = this.int(0, i);
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        },
    };
}
