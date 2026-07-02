/**
 * Village layout generator — deterministic via seed.
 * Creates central buildings + surrounding houses + fences.
 *
 * Location: packages/world-core/src/generators/village-generator.ts
 */

import type { CreateNodeInput, Vec3 } from "../schema/node";
import { createSeededRandom, type SeededRandom } from "./seeded-random";

export interface VillageParams {
    seed: number;
    /** Village center */
    center: Vec3;
    /** Radius of the village */
    radius?: number;
    /** Number of buildings */
    buildingCount?: number;
    /** Building types to use */
    buildingTypes?: string[];
    /** Tag for all generated nodes */
    tag?: string;
}

const VILLAGE_DEFAULTS = {
    radius: 30,
    buildingCount: 12,
    buildingTypes: ["house", "barn", "well", "mill", "blacksmith", "chapel"],
};

type VillageDefaults = typeof VILLAGE_DEFAULTS;

export function createVillageLayout(params: VillageParams): CreateNodeInput[] {
    const p: Required<Omit<VillageParams, "tag">> & { tag?: string } = {
        ...VILLAGE_DEFAULTS,
        ...params,
    };
    const rng = createSeededRandom(p.seed);
    const nodes: CreateNodeInput[] = [];
    const tag = p.tag ?? `village_${p.seed}`;
    const types = rng.shuffle(p.buildingTypes);

    // Central zone — village core
    nodes.push({
        type: "zone",
        name: "Village Center",
        position: { ...p.center },
        scale: { x: p.radius * 0.8, y: 0.1, z: p.radius * 0.8 },
        properties: { seed: p.seed, zoneType: "village_core" },
        tags: [tag, "zone", "village_core"],
    });

    // Place buildings in concentric rings
    const ringCount = 2;
    let placed = 0;

    for (let ring = 0; ring < ringCount && placed < p.buildingCount; ring++) {
        const ringRadius = p.radius * ((ring + 1) / ringCount) * 0.7;
        const countInRing = Math.min(
            p.buildingCount - placed,
            Math.ceil((p.buildingCount * (ring + 1)) / ringCount),
        );

        for (let i = 0; i < countInRing && placed < p.buildingCount; i++) {
            const angle =
                ((2 * Math.PI) / countInRing) * i + rng.range(-0.3, 0.3);
            const r = ringRadius + rng.range(-2, 2);
            const buildingType = types[placed % types.length];
            const size =
                buildingType === "barn" || buildingType === "mill" ? 3 : 2;

            nodes.push({
                type: "structure",
                name:
                    buildingType.charAt(0).toUpperCase() +
                    buildingType.slice(1),
                position: {
                    x: p.center.x + Math.cos(angle) * r,
                    y: p.center.y,
                    z: p.center.z + Math.sin(angle) * r,
                },
                rotation: { x: 0, y: rng.range(0, 360), z: 0 },
                scale: { x: size, y: rng.range(1.5, 3), z: size },
                properties: { seed: p.seed, buildingType, ring },
                tags: [tag, "structure", buildingType],
            });

            placed++;
        }
    }

    // Fence posts around perimeter
    const fenceRadius = p.radius * 0.85;
    const fenceCount = 20;
    for (let i = 0; i < fenceCount; i++) {
        const angle = ((2 * Math.PI) / fenceCount) * i;
        if (rng.next() < 0.3) continue; // gaps in fence
        nodes.push({
            type: "structure",
            name: "Fence Post",
            position: {
                x: p.center.x + Math.cos(angle) * fenceRadius,
                y: p.center.y,
                z: p.center.z + Math.sin(angle) * fenceRadius,
            },
            scale: { x: 0.2, y: 1.5, z: 0.2 },
            properties: { seed: p.seed, fencePost: true },
            tags: [tag, "structure", "fence"],
        });
    }

    return nodes;
}
