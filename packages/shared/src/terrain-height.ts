import { SimplexNoise } from "three-stdlib";
import * as THREE from "three";

const createSeededRandom = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++)
        h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    return {
        random: () => {
            h = (Math.imul(1103515245, h) + 12345) & 0x7fffffff;
            return (h >>> 0) / 0x80000000;
        },
    };
};

const noise = new SimplexNoise(createSeededRandom("SEAL_M_STABLE_SEED") as any);

const TERRAIN_SIZE = 1500;

export function getTerrainElevation(
    x: number,
    z: number,
    environmentType: "STORM" | "DIORAMA" | string,
    baseDistance: number = 24,
    config?: { height: number; scale: number; seed: number },
    excludeSculpt: boolean = false,
): number {
    const dist = Math.sqrt(x * x + z * z);
    let elevation = 0;

    const h = config?.height ?? 35.0;
    const s = config?.scale ?? 1.0;
    const seed = config?.seed ?? 0;
    const sh = (config as any)?.sharpness ?? 2.0;

    if (
        environmentType === "STORM" ||
        environmentType === "RAIN" ||
        environmentType === "THUNDER" ||
        environmentType === "CLEAR"
    ) {
        const mask = THREE.MathUtils.smoothstep(
            dist,
            baseDistance + 10.0,
            baseDistance + 60.0,
        );

        const n1 = Math.max(
            0,
            noise.noise((x + seed) * 0.008 * s, (z + seed) * 0.008 * s),
        );
        const n2 = Math.max(
            0,
            noise.noise((x + seed) * 0.025 * s, (z + seed) * 0.025 * s),
        );
        const n3 = Math.max(
            0,
            noise.noise((x + seed) * 0.08 * s, (z + seed) * 0.08 * s),
        );

        let combined = (n1 + n2 * 0.3 + n3 * 0.1) / 1.4;

        elevation += Math.pow(combined, sh) * h;
        elevation *= mask;
    } else {
        const mask = THREE.MathUtils.smoothstep(
            dist,
            baseDistance + 15.0,
            baseDistance + 50.0,
        );
        elevation +=
            noise.noise((x + seed) * 0.015 * s, (z + seed) * 0.015 * s) * h;
        elevation +=
            noise.noise((x + seed) * 0.04 * s, (z + seed) * 0.04 * s) *
            (h * 0.2);
        elevation *= mask;
    }

    if (
        !excludeSculpt &&
        typeof window !== "undefined" &&
        (window as any).sculptHeights
    ) {
        const heights = (window as any).sculptHeights;
        const u = (x + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
        const v = (z + TERRAIN_SIZE / 2) / TERRAIN_SIZE;

        const px = Math.max(0, Math.min(255, Math.round(u * 255)));
        const py = Math.max(0, Math.min(255, Math.round((1 - v) * 255)));
        const idx = py * 256 + px;
        const sculptOffset = heights[idx] || 0;
        elevation += sculptOffset;
    }

    return Math.max(elevation, -100.0);
}
