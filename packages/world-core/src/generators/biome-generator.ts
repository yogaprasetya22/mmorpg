/**
 * Biome painter — creates vegetation/structure zones based on biome type.
 *
 * Location: packages/world-core/src/generators/biome-generator.ts
 */

import type { CreateNodeInput, Vec3 } from "../schema/node";
import { createSeededRandom, type SeededRandom } from "./seeded-random";

export type BiomeType = "forest" | "grassland" | "swamp" | "desert" | "tundra";

export interface BiomeParams {
    seed: number;
    type: BiomeType;
    /** Bounding center */
    center: Vec3;
    /** Zone radius */
    radius?: number;
    /** Object density (0-1) */
    density?: number;
    /** Tag */
    tag?: string;
}

const BIOME_DEFAULTS = {
    radius: 40,
    density: 0.6,
};

const BIOME_ASSETS: Record<
    BiomeType,
    { trees: string[]; decor: string[]; groundMaterial: string }
> = {
    forest: {
        trees: ["oak", "pine", "birch", "maple"],
        decor: ["rock", "log", "mushroom", "bush"],
        groundMaterial: "grass_dark",
    },
    grassland: {
        trees: ["oak", "apple"],
        decor: ["flower", "grass_tuft", "rock_small"],
        groundMaterial: "grass_light",
    },
    swamp: {
        trees: ["willow", "dead_tree", "mangrove"],
        decor: ["lilypad", "mushroom", "vine", "log_mossy"],
        groundMaterial: "mud",
    },
    desert: {
        trees: ["cactus", "palm", "dead_bush"],
        decor: ["rock_sandstone", "skull", "bone"],
        groundMaterial: "sand",
    },
    tundra: {
        trees: ["pine_snow", "dead_tree"],
        decor: ["rock_snow", "ice_shard"],
        groundMaterial: "snow",
    },
};

export function paintBiome(params: BiomeParams): CreateNodeInput[] {
    const p = { ...BIOME_DEFAULTS, ...params };
    const rng = createSeededRandom(p.seed);
    const nodes: CreateNodeInput[] = [];
    const tag = p.tag ?? `biome_${p.type}_${p.seed}`;
    const assets = BIOME_ASSETS[p.type];

    // Zone container
    nodes.push({
        type: "zone",
        name: `${p.type.charAt(0).toUpperCase() + p.type.slice(1)} Biome`,
        position: { ...p.center },
        scale: { x: p.radius, y: 0.1, z: p.radius },
        properties: {
            seed: p.seed,
            biomeType: p.type,
            groundMaterial: assets.groundMaterial,
        },
        tags: [tag, "zone", "biome", p.type],
    });

    // Place trees
    const treeCount = Math.floor(p.radius * p.density * 0.8);
    for (let i = 0; i < treeCount; i++) {
        const angle = rng.range(0, Math.PI * 2);
        const r = rng.range(0, p.radius * 0.9);
        const treeType = rng.pick(assets.trees);

        nodes.push({
            type: "vegetation",
            name: treeType,
            position: {
                x: p.center.x + Math.cos(angle) * r,
                y: p.center.y,
                z: p.center.z + Math.sin(angle) * r,
            },
            rotation: { x: 0, y: rng.range(0, 360), z: 0 },
            scale: {
                x: rng.range(0.8, 1.5),
                y: rng.range(1, 3),
                z: rng.range(0.8, 1.5),
            },
            properties: { seed: p.seed, treeType, biome: p.type },
            tags: [tag, "vegetation", "tree", treeType],
        });
    }

    // Place decor
    const decorCount = Math.floor(p.radius * p.density * 1.2);
    for (let i = 0; i < decorCount; i++) {
        const angle = rng.range(0, Math.PI * 2);
        const r = rng.range(1, p.radius * 0.95);
        const decorType = rng.pick(assets.decor);

        nodes.push({
            type: "vegetation",
            name: decorType,
            position: {
                x: p.center.x + Math.cos(angle) * r,
                y: p.center.y,
                z: p.center.z + Math.sin(angle) * r,
            },
            rotation: { x: 0, y: rng.range(0, 360), z: 0 },
            scale: { x: 0.5, y: rng.range(0.3, 1), z: 0.5 },
            properties: { seed: p.seed, decorType, biome: p.type },
            tags: [tag, "vegetation", "decor", decorType],
        });
    }

    return nodes;
}
